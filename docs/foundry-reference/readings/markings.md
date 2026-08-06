# Reading — markings

The mandatory control we do not have. Three separate things already read need it:
project constraints, the **Markings · All of** card on a project's access panel,
and mandatory control properties on an object type.

Pages read in full:
- `mirror/security/markings.md`
- `mirror/platform-security-management/manage-markings.md`

Images read closely:
- `security/images/markings-0.png` — **a file's access panel: four cards, not three**
- `security/images/markings-data-missing.png` — **the failure mode, and it is not "denied"**
- `platform-security-management/images/markings-9.png` — the three marking permissions
- `platform-security-management/images/markings-5.png` — a category's fields

---

## What a marking is

> "**Markings** provide an additional level of access control for files, folders,
> and Projects… Markings define **eligibility criteria** that restrict visibility
> and actions to users who meet those criteria. To access a resource, a user must
> be a member of **all** Markings applied to a resource."
>
> "Access to a Marking is **binary (all-or-nothing)**. **Regardless of role**, a
> user cannot access a file in any way unless the user satisfies all Marking
> requirements."

And the sentence that places it against everything else in the security model:

> "Markings are a **mandatory** control, while roles are a **discretionary**
> control. Mandatory controls ***restrict*** access by requiring a user to have a
> particular Marking… In contrast, discretionary controls ***expand*** access and
> are granted through data sharing workflows **without centralized restrictions**."

The asymmetry is enforced, not merely described:

> "The **Expand Access permission on the Marking itself**, a centrally managed
> permission, is required to remove a Marking. For example, **even if a user has
> the Owner role on a dataset** that is marked with the `PII` marking, their Owner
> role does not allow them to remove the marking."

An Owner can give away any role they hold. An Owner cannot take a marking off.
That is the whole point of the two-control design.

### Inheritance — and the precise version, which is not "two kinds of marking"

> "Markings are **inherited** along both the file hierarchy and direct dependencies
> and propagate through transform and analysis logic. All resources derived from a
> marked file, folder, or Project will assume a Marking unless the Marking is
> explicitly removed. **Unlike role-based access, which is based on where data
> lives in the platform, Markings travel with the data.**"

A first reading takes that as "two inheritance paths". True, but it misses the
part that decides how any of this is built. **A marking is applied in exactly one
place. What it *becomes* depends on the route it took to reach you:**

- **File hierarchy** — "If a Project or folder has a Marking, **every file or
  folder within it inherits** the Marking. This means that restricting access to a
  Project or folder always restricts access to everything inside it." It arrives
  still a **file marking**.
- **Data dependency** — "**If a dataset has a *file* Marking**, every dataset that
  depends on it inherits that Marking **and the inherited Marking is known as a
  *data marking*.**"

That second sentence is the one that matters, and it is easy to read past. **A data
marking is what a file marking becomes when it crosses a data dependency.** Not a
second kind of marking — the same marking, arriving by a different route, landing
in a *different requirement bucket* with *different consequences*. Which is why the
access panel has "File markings" and "**Additional** data markings", and why one of
them gates metadata while the other gates rows (§ below).

So a marking on a resource is in one of **three** states, and the UI distinguishes
all three:

| state | which card | icon |
|---|---|---|
| applied directly here | **File markings** | plain shield |
| inherited via the file hierarchy | **File markings** | shield with a **folder sidecar** |
| inherited via a data dependency | **Additional data markings** | shield with a **data-lineage sidecar** |

`marking-file-inheritance.png` and `file_hierarchy_marking.png` are the two
complementary cases, same marking, same panel:

```
flight_alerts (in a marked folder)   passengers (derived from a marked input)
  File markings · All of               File markings
    [folder] Information: PII            None · No constraints set · Optional
  Additional data markings             Additional data markings · All of
    None                                 [lineage] Information: PII
```

The tooltip on the second names the provenance outright: "**This marking is
inherited from an input to this dataset.**"

### What the diagrams add

`markings-project.png` — "Security marking added to project" → "Access restricted
to everything inside project". The right-hand panel does **not** redraw the shield
on each file; a single Marking chip has a **brace spanning the whole container**.
The marking lives on the container and *reaches* the contents — it is not copied
onto them. That is a modelling instruction: store the application once, resolve
the effective set on read.

`markings-dataset.png` — "Security marking added to dataset" → "Dependent datasets
inherit security marking". **Two** upstream datasets feed one downstream, and the
marking is applied to only one of them. After: the marked input carries a shield,
the downstream carries a shield, the *unmarked* input carries none — and the edge
from the marked parent is drawn **bold** while the edge from the unmarked parent is
drawn **faded**.

**So data-marking inheritance is a union over inputs, not a requirement on all of
them.** One marked input is enough to mark everything downstream. The prose says
"every dataset that depends on it inherits"; the diagram says which edges carry it.

Both routes are immediate, and both are described as dangerous in the same words:

> "Applying a Marking is considered a **sensitive action**, since the Marking will
> **immediately** be inherited along all file and data dependencies. This could
> **unintentionally lock out other users downstream**."
>
> "Similarly, **removing** a Marking is considered a sensitive action… which will
> **immediately** remove the Marking from downstream files and data dependencies."

## What the file access panel shows — four cards, not three

`markings-0.png` is the same panel as `pmc-1.png` from the projects reading, but on
a **file**, and it has one more card:

> "Users must meet **all** of the following requirements to access this file"

| card | contents |
|---|---|
| **Roles** ⓘ | "Your role: **Owner**" · "Showing roles granted **directly on this file**" |
| **AND** | |
| **Organizations · Any of** ⓘ | `Sky Industries` |
| **AND** | |
| **File markings** ⓘ (Add) | `None` · "**No constraints set** · Optional ⓘ" |
| **AND** | |
| **Additional data markings · All of** ⓘ | `Information: PII` — with a **different icon** from a file marking |

**File markings and data markings are separate requirement cards**, and the chip
for a data marking carries a lineage glyph rather than a plain shield. The two
inheritance paths from the prose are two rows in the UI, distinguishable at a
glance. The management page confirms the convention: "A marking inherited along
the file hierarchy is indicated by a **folder sidecar icon**"; "A marking inherited
along a data dependency is indicated by a **data lineage sidecar icon**."

Note also the project constraint appearing inline as "No constraints set ·
Optional" — the *limit on what may be applied* sits in the same card as the
*requirement*, and they are different things.

## The file/data access split, named by the UI itself

The panel is not four loose cards. `data_dependecies_message.png` shows it is
**two named sections**, and the second one states its own scope:

> **Data access requirements**
> "People must meet these **additional** requirements **propagated from data
> upstream** in order to access **data in this file**."
> MARKINGS · All of → `[lineage] Information: PII`

And the header badge popover (`marking-file-inheritance.png`, `markings-data-missing.png`)
splits under the same two headings:

```
File access          Data access
  Organizations        Markings · All of
    Sky Industries       [lineage] Information: PII
```

So the conjunction partitions:

| section | requirements | gates |
|---|---|---|
| **File access** | Roles **AND** Organizations·Any of **AND** File markings·All of | whether the resource **exists** for you, and its metadata |
| **Data access** | Additional data markings·All of | whether you can **read the rows** |

That is why they are separate cards rather than one list: they are enforced at
different moments against different things.

## The failure mode is not "denied" — it is "metadata yes, data no"

This is the most valuable thing in the reading, and it is only in a screenshot.

> "a user may fulfill **file** access requirements without meeting the **data**
> access requirements inherited from upstream datasets. In this scenario, the user
> can **detect the presence of the derived dataset and view the file metadata, but
> cannot access the data** within the file dataset… This is **different from** when
> a user cannot discover a resource because they do not meet the file marking
> requirements."

`markings-data-missing.png` shows exactly that state. The header badge popover
splits under two headings — **File access** → Organizations → `Sky Industries`,
and **Data access** → `Markings · All of` → `Information: PII`. The About panel
still renders everything: description, Updated, Created, Location, Type, **Size: 9
columns**, Updated via, Tags, Health Checks, and **Inputs** with its lineage link.

But the preview reads:

> **Failed to load preview** — "Cannot read all dataset transactions in paths,
> insufficient permissions." *(with a **Request access** button)*

And one field changes tellingly: where the accessible dataset offers "**Calculate
row count**", this one says "***Row count not available***". A row count is a data
read, so it is gone with the data.

`marking-file-inheritance.png` pushes it further than is comfortable. The user who
cannot read a single row **can read the entire schema**, on the Columns tab:

```
tail_num string · col_id_index integer · flight_id string · carrier_code string
passport_id long · first_name string · last_name string · age long
membership_status string · phone_number string · credit_card string
credit_card_provider string · employment string · address_latitude · address_longitude
```

They can see that this dataset has a `credit_card` and a `passport_id` column
without being able to see one value in either. **Column names are metadata, and
data markings do not protect metadata.** That is a deliberate line, and anyone
building this has to draw it in the same place or discover the difference the hard
way.

**This is the object-type/object split from `object-permissioning`, one layer
down.** There it was "To see an object type, you must have View permissions on the
object type… To see objects, you must hold View permissions on the object type
**and access to the data**." Here it is File access versus Data access on a
dataset. The platform draws the same line in both places, and the error messages
are different on purpose: undiscoverable versus discoverable-but-unreadable.

## Markings restrict; they do not provision

> "Markings are designed to ***restrict*** access… **Markings should not be used to
> *provision* access.** When a user satisfies a set of Marking criteria, they
> receive access to the Marking and associated resources. However, **a user
> *eligible* for access should not always *have* access.** Users should be granted
> access to files based on role-based permissions on Projects."

The worked example: a finance user completes PII training and so is *eligible* for
the `PII` marking, but their `Viewer` role on the finance project is what decides
what they actually see. Eligibility is a gate, not a grant.

Four documented structures for choosing what to mark:

1. **One marking per sensitive data category** — "the most commonly-used"; several
   sensitivities on one resource means several markings, and "only users eligible
   to access **all** relevant sensitive categories can receive access".
2. **One marking per sensitive data owner** — the owner decides. "Markings
   propagate. This means that if a user with access to the data tries to create
   derived resources… **the data owner will need to grant the other user access to
   the Marking** to unlock their access to the derived resources."
3. **Markings for different pipeline stages** — a `Raw Data` marking removed after
   processing, replaced by category markings downstream.
4. **To restrict discovery** — "you should use them if you must **hide the
   existence** of a resource… users who do not have access to the Marking will not
   see the marked data in search results or in the Project/folder view."

Three examples follow: hierarchical healthcare tiers (`Identifiable` →
`De-identified` → `Synthetic`, where "at each of these transformation stages the
previous Marking is removed and a Marking highlighting the updated state is
added"); one `Case - xxxxxx` marking per investigation; and per-team markings in a
bank, where an audit report ends up carrying only `Internal Compliance` because
the other two were removed.

## Categories, and a field the prose never mentions

`markings-5.png` and `markings-9.png` show a marking **category**'s Details pane.
Its fields:

| field | example |
|---|---|
| Name, description | `Cities` / `Worksteam X` |
| **Created** | date + author |
| **Category type** | **`Conjunctive · And`** — "**All** applied markings will be required." |
| **Category visibility** | `Visible` — "Visible to all users." |
| **Organization** | "can be seen by users from **all organizations**" *or* "from the following organization: 🏢 Sky Industries" |
| **Category permissions** | Manage → principals |

**`Category type: Conjunctive · And` appears in no sentence on either page.** It is
presented as a *setting* with a value, which strongly implies a second value
exists (disjunctive/or). Everything written says markings are conjunctive — "A
user must be a member of **all** the Markings… since Markings are conjunctive
(boolean `AND`)" — so if a disjunctive category exists, it is undocumented here.
**Marked as an open question rather than assumed.**

Two irreversibility warnings, both in callouts:

> "Once created, marking **categories cannot be deleted**."
> "Once created, **markings cannot be deleted or moved to a different category**."

Visibility is per **category**, never per marking:

> "Visibility is defined for a category and all of its Markings together; **it
> cannot be assigned on a per-Marking basis**."
>
> If `Hidden`, "the existence of this category and its Markings is considered
> sensitive information" and only explicit `Category Viewer`s see it.

And a subtlety about who implicitly counts as a category viewer: everyone with
access to a marking, or a role on one, "will **not appear in API results as
'category viewers' but should be assumed."

## Permissions — four of them, and none implies membership

The prose lists four; `markings-9.png` shows the dropdown, which offers **three**:

| permission | quoted |
|---|---|
| **Manage permissions** | "Users who can grant permissions to manage this Marking, its members, and its metadata." |
| **Apply marking** | "Users who can apply this Marking to Projects and resources. **This permission only grants the ability to apply a Marking and does not grant membership.**" |
| **Remove marking** | "Users who can remove this Marking… **To remove a Marking, a user must also be able to apply the Marking.**" |
| **Members** | "Users who can see resources and Projects protected by this Marking." |

The dropdown holds the first three because **Members is granted on a different
surface** — "Markings are granted **globally** to users." And the separation is
stated outright:

> "All the permissions above are **distinct and do not automatically provide users
> with membership**. For example, a user can have 'Apply marking' and 'Manage
> permissions' access on a Marking and **not be a member** of the Marking. In that
> situation, the users could apply the Marking to files, folders, and Projects…
> **but they could not see the data** marked with that Marking."

You can classify data you cannot read. That is the design, not an accident.

Applying needs two permissions from two different systems:

> "1. You have the '**Apply marking**' permission on the Marking.
>  2. You have the '**Update Markings on resource**' permission, which is included
>     in the Owner role by default."

## Propagation runs on transactions

The step in the apply checklist that connects markings to the dataset layer:

> "Markings propagate along data dependencies **at the transaction level**.
> Incrementally built datasets (of type `APPEND` or `UPDATE`) require special
> treatment. Specifically, the latest view of a dataset built with `APPEND`
> transactions will include dependencies from **old upstream transactions**; by
> contrast, the latest view of a dataset built with `SNAPSHOT` transactions… only
> depends on the **latest** transactions from upstream."

So an incremental dataset carries the markings of every upstream transaction still
in its view — which is precisely the set `dataset_view_transactions` computes. A
`SNAPSHOT` truncates that set, and therefore also truncates inherited markings.
**The view algorithm is the propagation algorithm.**

Removal comes in two flavours, and only one is instant:

- **Directly-applied** — "Removing a Marking directly from a file, folder, or
  Project will **immediately** remove the Marking from any dependencies that
  inherited it. You **do not need to rebuild** datasets downstream."
- **Inherited** — only removable "from Restricted Views and datasets", via
  `stop_propagating` in transform code, and it needs a rebuild: "The
  `stop_propagating` change must propagate along the **latest transactions**…
  which requires you to rebuild the datasets that have the syntax and all the
  datasets downstream." It also "will only take effect on branches that are both
  **protected** and have `Require security approvals before merging` enabled."

---

## Connects to

- **`projects-roles-and-portfolios`** — the same access panel, one level up. This
  supplies the **Markings · All of** card that reading could only point at, and
  splits it into file markings and data markings.
- **`object-permissioning`** — "the primary key property cannot be a member of any
  property security policy" and the four-slot conjunction. **File access vs Data
  access here is the object-type vs object split there.** Also
  `property-security-markings` and `object-link-types/mandatory-control-properties`
  are the object-layer form of a marking, both unread.
- **`datasets-rid-and-object-storage`** — markings propagate *at the transaction
  level*, so `dataset_view_transactions` is the propagation frontier. `SNAPSHOT`
  truncating the view also truncates inherited markings.
- **`spaces-and-the-resource-path`** — an organization carries a **Marking ID**
  because "organizations are a mandatory access control" *like* markings. This
  reading is what that identifier is for.
- **`security/classification-based-access-controls`, `configure-scoped-sessions`,
  `building-pipelines/remove-markings`, `remove-inherited-markings`** — all named,
  all unread.
- **Our schema** — no markings at all. `auth_org_id()` is the Organizations slot
  and nothing else.

## Open questions

1. **Is there a non-conjunctive marking category?** `Category type` is shown as a
   settable field reading `Conjunctive · And`, but every sentence on both pages
   says markings are conjunctive. Either a disjunctive category exists and is
   undocumented here, or the field has one value.
2. **What is a Restricted View, exactly?** It is the only resource besides a
   dataset from which an inherited marking can be removed, and it has appeared in
   three readings now without being read.
3. **Scoped sessions** — "pick a subset of pre-defined Markings to access during
   their Foundry session". A user's effective markings are session-scoped, which
   changes what "a member of all markings" means at query time. Unread, **and it
   is the one unbuilt thing that would change `satisfies_markings`** — everything
   else deferred below sits beside the implementation rather than inside it.

## Known divergences after 399–403

Stated so they are not rediscovered as bugs:

- **No folders.** Foundry marks "files, folders, and Projects"; our containment is
  project → dataset with nothing between, so `resource_markings.resource_kind`
  accepts two values instead of three.
- **`dataset_inputs` is declared, not derived.** Foundry gets the edge from builds
  and shows it as *Inputs*; we have no build system, so a user asserts it. The
  edge is the same relationship — what is missing is the writer.
- **A stop takes effect on the next read.** Foundry's `stop_propagating` "must
  propagate along the latest transactions… which requires you to rebuild". Ours
  resolves on read, so it is immediate — which is the behaviour Foundry already
  has for directly-applied markings ("you do not need to rebuild datasets
  downstream").
- **No audit.** "Markings are intended to allow data protection officers to
  centrally manage and *audit* exactly who can access any given category of data."
  We record who applied a marking and when, and nothing about access attempts.
- **Naming.** `security/markings` calls the remove permission "**Expand Access**";
  `manage-markings` calls it "**Remove marking**" and reserves *Expand access* for
  organizations. We follow the more specific page.
- **Object types are not markable yet.** `resource_markings` is shaped to take
  them, but `object_types` has no datasource binding, so there is nothing to
  protect.

## Decisions taken from this reading

**A marking without inheritance is a tag.** Every quoted property that makes a
marking worth having is inheritance. The vocabulary and an apply action on their
own produce a coloured label that looks like a security control.

### A correction to the first pass

The first version of this reading concluded that *all* of markings blocks on
lineage, on the grounds that building only file markings would misdescribe the
result. **Re-reading the inheritance section against the screenshots, that is
wrong.** Foundry does not treat file and data markings as two halves of one
feature — it gives them **separate requirement cards, separate icons, separate
enforcement points, and separate section headings** (File access vs Data access).
And `file_hierarchy_marking.png` shows a resource sitting in the state
`File markings: PII · Additional data markings: None` — a perfectly ordinary,
complete configuration.

So file markings are a **complete feature that does not need lineage**, and the
correct split is:

| | needs | status |
|---|---|---|
| **File markings** | containment (space → project → resource) — **we have this** | buildable now |
| **Data markings** | a `derived from` edge between datasets — we have none | blocked |

Data markings still block on lineage, and so does Data Lifetime. But that no longer
blocks the whole feature.

### The build, in order

**M1 — vocabulary.** `marking_categories` (name, description, `category_type`
defaulting to `conjunctive`, `visibility` ∈ visible/hidden, optional single-org
restriction) and `markings` (category, name, colour). Both **non-deletable** and
markings **non-movable between categories**, per the two callouts. Visibility lives
on the category and cannot be set per marking.

**M2 — permissions and membership, deliberately separate.**
`marking_permissions(marking, principal, permission ∈ manage|apply|remove)` and
`marking_members(marking, user)`. Two rules to enforce, both quoted: a permission
**never** implies membership, and *remove* requires *apply*. Groups do not exist
here yet, so principals are users; the column should be shaped so a group can be a
principal later.

**M3 — application, and effective file markings.** `resource_markings(marking,
resource_kind, resource_id)` records the **one place** a marking was applied —
`markings-project.png` draws a single brace over a container rather than copying
the shield onto every file, which is the instruction to resolve on read rather than
materialise. Then `effective_file_markings(resource)` = applied here ∪ inherited
from its project ∪ inherited from its space. Applying needs *apply* on the marking
**and** Owner on the resource; that is two permissions from two systems.

**M4 — the file/data access split.** `can_read_dataset` currently gates the
registry row and the physical rows with one predicate. Split it: metadata requires
Roles ∧ Organizations ∧ **file markings**; rows additionally require **data
markings**. The condition I set last time for doing this — "once there is a second
reason for the two to differ" — is now met, because file markings supply the first
half immediately.

**M5 — data markings.** `dataset_inputs`, then propagation as a **union over
inputs** (one marked input marks everything downstream), computed over the
transactions currently in the view. Deferred until lineage exists.

### Built, 2026-08-06 — migrations 399–403

| | |
|---|---|
| **399** | categories, markings, permissions, membership. Immutability triggers, `remove` requires `apply`, `satisfies_markings` |
| **400** | `resource_markings` (one row per *application*), `effective_file_markings`, `file_marking_origin`, apply/remove guard |
| **401** | `dataset_inputs`, `dataset_input_marking_stops`, `effective_data_markings`, and the split: `can_read_dataset` vs `can_read_dataset_data` |
| **402** | `dataset_markings()` — the access panel as one query over the same predicates the policies call |
| **403** | the two holes below |

`packages/ontology/src/markings/` holds the vocabulary and `accessLevel()`;
`/datasets` renders the Access requirements panel. `check:datasets` is at 28
assertions.

Two bugs the build itself surfaced, both caught by an assertion written from a
quoted sentence rather than from the implementation:

- **`stop_propagating` was filtered at the target, not during traversal.** Gathering
  every transitive ancestor and then dropping markings stopped *on this dataset*
  only cuts the last hop — a marking stopped at `clean` still reached `onward`
  through it. Pruning has to happen while walking, so the recursion carries
  `(dataset, marking)` pairs and drops one the moment it meets a stopped edge.
- A plpgsql trigger shared by two tables evaluated `NEW.category_id` for the table
  that has no such column, because plpgsql plans `a AND b` as one statement.

### The re-read, which is the point of this section

The operator asked for `security/markings` to be read again *against the result*.
It found two holes. **Both passed every test written in 399–402**, because both
live in the places that never call the predicates those tests exercise.

**Hole 1 — writing bypassed markings entirely.**

> "Access to a Marking is binary (all-or-nothing). **Regardless of role, a user
> cannot access a file *in any way*** unless the user satisfies all Marking
> requirements."

401 put the check in `can_read_dataset`. `can_write_dataset` was still
organization + role from 395 — so a project Editor who is not a member of a
marking could not read a dataset and could still **write** it, materialize it, and
open transactions on it. *In any way* is one phrase and it covers writes.

**Hole 2 — a marked dataset was still listed.**

> "you should use them if you must **hide the existence** of a resource… users who
> do not have access to the Marking **will not see the marked data in search
> results or in the Project/folder view**."

Every child table (branches, transactions, schemas, files, inputs) reads through
`can_read_dataset` and was correct. The `datasets` table's *own* SELECT policy was
still the bare organization check from 392, so the row appeared in the list — name,
location and all — to someone failing its file markings. Which is exactly the state
the page distinguishes from the data-marking one: "**different from** when a user
cannot discover a resource because they do not meet the file marking requirements."
Projects had the same gap and are markable in their own right.

The lesson generalises: **a predicate is only as good as the places that call it.**
Adding a term to `can_read_dataset` looks like securing reads, and does not touch
the list.

### One thing to get right in M4

Column names are metadata. A user denied by a data marking must still see the
schema — `marking-file-inheritance.png` shows exactly that, down to a visible
`credit_card` column. Hiding the schema would be *more* restrictive than Foundry
and would break the documented "detect the presence… and view the file metadata"
behaviour. Property-level protection is a different feature
(`object-permissioning/property-security-markings`, unread).
