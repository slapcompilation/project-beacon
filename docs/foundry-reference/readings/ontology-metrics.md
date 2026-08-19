---
verify: strict
---

# Ontology metrics — the ledger F2 named

**Pages read:** `ontology-manager/view-usage` in full, both its images parsed
field by field.

**Why now.** F2 (578) registered `no_registered_usage` and could not compute it.
This is the thing it was waiting for — and the reason that flag is dangerous
without it is on this page rather than the cleanup one.

---

## 1. The four terms, defined exactly

> "**Reads:** A read is recorded when an application loads objects for a specified object type. This can include displaying objects in a table in Workshop, returning all objects from search for a given object type, aggregating a property on an object type, and so on."

> "Note that one read represents one load request from [Object Storage v1 (Phonograph)](/docs/foundry/object-databases/object-storage-v1/) or the Object Set Service (OSS). Many objects loaded or aggregated at once will only be recorded as a single read. Also note that any object type or link type usage happening in Ontology Manager is not included."

> "**Writes:** A write is recorded when an application makes edits to objects of this type as the result of an [Action](/docs/foundry/action-types/overview/), [Function](/docs/foundry/functions/overview/), Foundry Form, direct Object Explorer edit, or API call. Note that one write represents one edit request sent to [Object Storage v1 (Phonograph)](/docs/foundry/object-databases/object-storage-v1/). Many objects edited in bulk at once will only be recorded as a single write."

> "**Interactions:** The total number of reads and writes on objects of this type over the last 30 days."

> "**Active users:** The number of unique user IDs that triggered the reads and writes recorded over the last 30 days."

Three consequences that decide the schema before any table is drawn:

* **A read is a REQUEST, not an object.** Counting rows returned would produce a
  different number from Foundry's for the same traffic.
* **Ontology Manager's own traffic is excluded** — otherwise browsing the
  cleanup queue would keep every object type looking alive, and the tool would
  defeat itself.
* **Interactions and Active users are derived**, not stored: a sum and a
  distinct count over the same 30-day window.

---

## 2. It covers link types too

> "The Ontology Manager can be configured to show usage metrics for object types and link types."

So the ledger is keyed by a resource that is an object type **or** a link type —
two columns with exactly one set, as `action_type_rule_properties` does since
570, not a `kind` discriminator.

---

## 3. The Usage tab is the data model, drawn

`oma-user-interface-usage-tab.png` shows four displays for one object type
(`Aircraft`, 193 objects), and between them they fix the grain:

> Usage over time · Reads & Writes · Start date · End date
> — ontology-manager/images/oma-user-interface-usage-tab.png

> Active users
> — ontology-manager/images/oma-user-interface-usage-tab.png

> Application type (22) · Quiver 2356 / 0 · actions 1874 / 2 · Fusion 1504 / 0
> — ontology-manager/images/oma-user-interface-usage-tab.png

> Aggregate usage · Interactions 8772 · Reads 8770 · Writes 2 · Active users 89
> — ontology-manager/images/oma-user-interface-usage-tab.png

> Others · Last updated 12 hours ago · Last interaction 1 hour ago
> — ontology-manager/images/oma-user-interface-usage-tab.png

**Every one of those is an aggregate of `(resource, day, application, user) →
reads, writes`.** The time chart groups by day; Active users counts distinct
users per day; Application type groups by application with reads and writes
side by side; Aggregate usage sums the window; Last interaction is a max. Nothing
displayed needs a finer grain, and nothing needs a coarser one — which is a
stronger reason for a daily rollup than "it is cheaper".

The aggregate panel also shows the shape of real traffic: **8,770 reads against
2 writes.** A per-object read ledger at that ratio would be enormous and would
still answer the same questions.

`oma-user-interface-overview-usage.png` is the same series as a small card with
a **See more** into the tab, and the prose matches: the Overview graph is a
"High-level summary of usage over the last 30 days".

---

## 4. It is off until an administrator turns it on

> "Usage on the **Overview** tab and detailed usage metrics in the **Usage** tab are configured from the **Ontology settings** tab in Control Panel using the **Ontology metrics** toggle. This toggle can only be enabled or disabled by Ontology administrators and changes may take up to 60 minutes to take effect in Ontology Manager."

> "If you see “No usage for the last 30 days” in the usage graph when you would expect to see usage statistics, then it’s possible that internal tables may not have been configured. Contact your Palantir representative for more information."

That warning is the whole reason F2 could not guess at this. **When metrics are
off, every object type looks unused.** A cleanup flag reading "no registered
usage" would then propose deleting the entire ontology. Foundry's own answer is
that the underlying data is opt-in and the flag is a toggle.

---

## 5. Cross-organization visibility has its own rule

> "If your organization shares an Ontology with another organization, then the **Usage** tab will be accessible by users of all organizations that have the Ontology metrics turned on. The usage metrics displayed only includes the usage from users who have access to the object type and those who are from organizations that have the Ontology metrics enabled."

Two filters on one number, and they are different in kind: **who may see the
metrics** (any org with the toggle on) versus **whose usage is counted** (users
with access to the object type, from orgs with the toggle on). A user in an org
that never enabled metrics is invisible in the totals even to their own
colleagues.

---

## Decisions

1. **A daily rollup at `(resource, day, application, user) → reads, writes`**,
   because that is exactly the grain all four displays aggregate from. Not an
   event ledger: 8,770 reads for one object type in a month is the documented
   scale, and no display asks a question a rollup cannot answer.
2. **The resource is an object type OR a link type**, as two nullable columns
   with exactly one set — the page covers both, and a `kind` discriminator is
   the shape this repo has deleted three times.
3. **A read is recorded once per load request**, at the object-set read path,
   not once per row returned. Counting rows would be a different number from
   Foundry's for identical traffic.
4. **Ontology Manager's own reads are excluded**, which means the recorder needs
   to know its caller — so recording is an explicit call from the read path, not
   a trigger on a table. A trigger cannot tell who is asking.
5. **Enablement is a stored switch per ontology, and OFF is not ZERO.** This is
   the load-bearing decision: `no_registered_usage` may only be computed where
   metrics have been on for the whole window, and must otherwise report *no
   data* rather than *no usage*. Anything less turns a cleanup queue into a
   proposal to delete everything.
6. **Interactions and Active users are derived, never stored** — a sum and a
   distinct count. Storing them would create two numbers that can disagree.
7. **Writes can be sourced from the edit path we already have; reads need new
   instrumentation.** That asymmetry is worth stating because it decides the
   order: the ledger and the write half are one change, the read half is
   wherever `evaluate_object_set` and the index reads live.
8. **Not built from this reading yet.** These Decisions want reciting first.

## Questions

1. **What is an "application" here?** The tab shows `Application type (22)` with
   Quiver, actions and Fusion among them, so it is a fixed vocabulary of Foundry
   products rather than free text — but the list is not published anywhere in
   this page, and 22 is only visible as a count. `blocks:` whether the column is
   a CHECK or free text. Recording it as free text with the caller naming
   itself is the safe start.
2. **Is the 30-day window fixed or configurable?** Every definition says "the
   last 30 days" and the tab offers Start date and End date filters, so the
   *display* ranges freely while the *definitions* are fixed at 30. Whether
   retention is longer than 30 days is unstated. `blocks:` how long rollup rows
   are kept.
3. **What does the Others panel's Last updated measure?** It sits beside Last
   interaction under the same heading (§3), and the two carry different values,
   so it is not the last interaction. Most
   likely the last time the metrics pipeline ran — which would mean the numbers
   are eventually consistent, and consistent with "changes may take up to 60
   minutes to take effect". `blocks: nothing` — recorded so a freshness field is
   not invented as something else.
