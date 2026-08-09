---
verify: strict
---

# Reading — how user edits are applied, and object security policies

Read to answer the four open questions before phase E. **Three are answered
outright**, one only partly, and the pages settle a design choice I would
otherwise have invented.

Pages read: `object-edits/how-edits-applied` (+ both flowcharts and the T0–T14
table), `object-permissioning/object-security-policies`,
`object-views/config-panel-views`.

---

## 1 — What identifies an object instance: the primary key VALUE

Stated in passing, and unambiguous:

> "When a **single object (that is, a row or object with a specific primary key
> value)** receives data from both the input datasource and user edits, these
> received values must be transparently resolved…"

And the whole T0–T14 table is keyed on `pk_column = pk1` across deletions and
recreations. The identity is the **value**, not a synthetic row id — which is
also why the course insists the key be "a deterministic repeatable process. You
should never generate a random ID or GUID."

## 2 — Where instances live: an ephemeral index over a durable merge

> "When an Action is applied… the data-modification logic is **immediately
> applied to the index** in the object databases and **periodically flushed into
> a persistent store** in the form of Foundry datasets owned and managed by
> Funnel."
>
> "**All indexed data in object databases are considered ephemeral**, requiring
> persistent storing of all Ontology data in other ways."
>
> "the Funnel service owns and manages several Foundry datasets, including a
> **merged dataset that combines data coming from datasources and user edits**.
> The merged dataset is automatically built…"

So there are three layers, and only two are durable:

| layer | durable? | what it is |
|---|---|---|
| input datasource | yes | the dataset the object type is backed by |
| **user edit log** | yes | a queue with offset tracking, flushed into datasets |
| **merged dataset** | yes | datasource ⊕ edits, built automatically |
| the index | **no** | "ephemeral", rebuildable from the two above |

The merge build is triggered "whenever there is a new data transaction in object
type datasources, or **in the absence of new data, every 6 hours**, if edits had
been detected on any objects" — the same cadence materializations use.

**This is the answer to the biggest open question, and it is one we are already
most of the way to.** We have datasets, transactions and `dataset_materialize`.
An object instance store is a *materialized merge of a datasource and an edit
log*, and the index is a disposable cache over it — not a new kind of storage.

## 3 — The algorithm, with a published answer key

The flowchart `Object Data and Visibility with Edits` is a decision procedure
over the instruction log, in four questions:

```
1. Is the latest instruction DELETE?
     yes → not visible REGARDLESS of datasource state
2. Was there a DELETE instruction made?  (i.e. delete, then create again)
     yes → visible. "Create instruction marks the STARTING POINT for the object
            instance and the final state IGNORES ALL DATASOURCE DATA"
3. Was there a CREATE instruction made?
     yes → same terminal as above
4. Is the object present in the datasource?
     yes → visible. "Properties that received user edits through modification
            instructions IGNORE ALL FURTHER DATASOURCE UPDATES. For other
            properties datasource updates determine the final state"
     no  → "not visible UNTIL RESTORED in the datasource"
```

**The state is a replay of an instruction log** — the same shape as the dataset
view (SNAPSHOT / APPEND / UPDATE / DELETE) we already implement and check
against Palantir's printed answer.

And this page prints its answer too: a **fifteen-row table, T0 to T14**, giving
the datasource row, the user edit, and the resulting object state at each step.
Among the cases it settles:

- **T5** — a row disappears and reappears; "the previous user edit is **still
  applied** to the object when the row reappears".
- **T6** — an unedited property receives a datasource update "and it **is
  applied**"; edited ones are not.
- **T9** — `Create object` yields `col1 = null, col2 = null` even though the
  datasource has values, because the create "ignores all datasource data"
  (the flowchart, `object-edits/images/object-edits-visibility-flowchart.png`).
- **T12** — the row disappears but the object survives, "as it was **last
  created by a user edit**".
- **T14** — "any `Modify object` Action call **will fail**" on a deleted object.

That table is a conformance test, exactly like
`data-integration/datasets#example-of-transaction-types`.

> "**Deletions are not considered an edit.** Once a deletion is applied, the
> object is no longer visible regardless of datasource state. If the object is
> later recreated, **it will not inherit the previous edits**."

And there is no undo:

> "Data already containing user edits can **only be updated via additional user
> edits**. There is no mechanism to directly undo a single user edit…"

Wiping them all is a **schema migration** — the `drop all edits` instruction.

## 4 — Conflict resolution is per DATASOURCE, not per object type

I had this wrong in the build map, which said per object type.

> "Conflict resolution strategies are configured at the object type level…
> **Each datasource of the object type can have different resolution
> strategies.** For example, for an object type backed by two datasources, one
> datasource can use `Apply user edits (default)` while the other datasource
> can use `Apply most recent value`…"

Two strategies:

**Strategy 1 — Apply user edits (default).** "the final state of an object is
always determined by the user edits applied to it, **regardless of any future
datasource updates** for edited properties."

**Strategy 2 — Apply most recent value.** "user edits are **only applied if the
timestamp of the user edit is more recent** than the timestamp value coming from
the datasource." Requirements, each stated:

- a property of type **timestamp** — "the date property type will not work"
- **in UTC**
- **backed by a timestamp column from the input datasource**
- and the comparison uses *only* the datasource value: "Even if users change the
  timestamp property via user edits, the conditional comparison will **only**
  happen between the timestamp from the input datasource and the user edit
  application time."
- no timestamp value in the datasource → "**all three conditional edits are
  applied**, regardless of their associated timestamps"

**Edit-only properties are exempt from both:** "user edits will **always apply**
regardless of the timestamp on the input datasource."

> "If an edit updates properties across multiple datasources, then whether those
> edits will be conditionally applied or always applied will be determined by
> **the resolution strategy of the datasource that backs the property**."

## 5 — Object security policies decouple the object from its datasource

This one changes something I had already built on.

> "Object security policies allow you to configure view permissions on an object
> instance by configuring security policies **on the object type, independently
> of the permissions on the backing data source**. These are used to achieve
> **row-level security**."
>
> "**When an object or property security policy is configured, users do not need
> `Viewer` permissions to the object type's backing data sources** to view object
> instances."

The training course said the opposite — "the permissions a user has to the
backing datasource(s) also determines whether they can see the corresponding
object data" — and this page names that as the **legacy** model:

> "If your enrollment uses the legacy **datasource-derived permissions model**,
> users still require `Viewer` permissions on the backing data source… **Because
> datasource-derived permissions defeat the decoupling that object security
> policies provide, we recommend migrating to project-based permissions**…"

**Three levels, and the failure mode differs:**

| policy | grants | when it fails |
|---|---|---|
| **object security policy** | row-level | "the object instance **will not be viewable**" |
| **property security policy** | column-level | "they will see a **null value** in place of the property value" |
| both together | **cell-level** | — |

> "By default, object security policies are applied to **all** properties. When a
> property security policy includes a property, the user must pass **both**…"

**Three restrictions, all enforceable:**

- "An object security policy **must already be configured**" before a property one.
- "**The primary key property cannot be a member of any property security
  policy.**" (The same rule `object-permissioning` gave us for mandatory control
  properties.)
- "A non-primary key property can be a member of **at most one** property
  security policy."

Editing them requires **Owner on the object type** — "you must hold the `Owner`
role on the project that contains the object type".

### And a security warning worth carrying into our own code

> "**Avoid using `NOT` conditions with group, marking, or organization
> memberships.** Using a `NOT` condition in these circumstances is a
> misconfiguration. The platform supports **scoped tokens**, which carry only a
> subset of a user's permissions. These tokens may **lack the attribute the
> `NOT` condition checks against, causing the condition to pass and grant more
> access than intended.**"

We have scoped sessions (migration 404). This is the same hazard: a negated
check against an attribute a narrowed token does not carry **fails open**.

## 6 — Object instance panels: a UI page, not an architecture one

> "The default object instance panel view shows a single **Property List widget**
> that displays **prominent properties** of a single instance of the object type."

It confirms `visibility = prominent` is what a default panel reads, and that a
panel is bound to *one instance* — but it does not say how the instance is
identified. §1 answers that from elsewhere.

---

# What this changes

**Answered:**

1. **Instance identity** — the primary key *value*.
2. **Where instances live** — an ephemeral index over a durable **merged
   dataset** (datasource ⊕ edit log). We already have the pieces.
3. **Edits vs pipeline data** — an instruction log replayed by a four-step
   decision procedure, with a **fifteen-row published answer key**.
4. **Edits granularity** — the toggle is per object type; **conflict resolution
   is per datasource**; edit-only properties are exempt from both strategies.

**Corrected in the build map:** conflict resolution is per *datasource*, not per
object type.

**New for phase E:** object and property security policies are a third layer
beside markings and RLS, and they **decouple object access from datasource
access** — which is the opposite of what the training course says, because the
course describes the legacy model.

## Open questions

1. **The `Apply most recent value` flowchart** (second image) — mirrored but not
   yet read closely; the prose covers the behaviour, the chart may add edge cases.
2. **Schema migrations** (`object-edits/schema-migrations`) — the mechanism that
   drops all edits, and presumably how a property rename survives. Unread.
3. **Funnel batch pipelines** (`object-indexing/funnel-batch-pipelines`) — named
   as where the merged dataset is built. Unread.
