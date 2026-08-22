---
verify: strict
---

# Reading — the Ontology Manager save session

The whole `ontology-manager/` section read end to end, centred on the save
session: what the work-in-progress state holds, who it belongs to, what the
**Review edits** dialog is, what an error is versus a warning, and what happens
when someone else saved while you were editing.

**Pages read in full (10 in `ontology-manager/`):** `save-changes`,
`restore-changes`, `export-import`, `_index`, `overview`, `navigation`,
`view-usage`, `cleanup`, `ontology-roles-migration`,
`migrate-to-project-based-permissions`.

**Sublinks followed, outside the section:** `ontologies/branching-ontology`,
`ontologies/test-changes-in-ontology`, `ontologies/ontology-branches-legacy`,
`object-link-types/edit-object-type` (named by `save-changes.md` for breaking
changes), `object-link-types/metadata-statuses` (for the status values seen in
screenshots).

**Sublinks named but NOT read:** `action-types/action-metrics`,
`monitoring-views/overview`, `monitoring-views/rules-reference`,
`functions/function-metrics`, `functions/decorators`, `functions/edits-overview`,
`object-permissioning/ontology-permissions`,
`object-permissioning/ontology-permissions-legacy`, `upgrade-assistant/overview`,
`object-databases/object-storage-v1`, `global-branching/*`, `compass/overview`.

**Images read: all 56 in `ontology-manager/images/`**, plus 4 from
`ontologies/images/` (`save-to-ontology`, `propose-changes`,
`modify-protected-object`, `review-rebase-changes`). Every one was opened with
the Read tool; the ones that carry information the prose does not are listed in
their own section below.

---

## 0 — A correction to the brief, before anything else

The brief said `save-changes.md` is the one page with no screenshot, and that
therefore the shape of the save dialog has to come from elsewhere. **That is no
longer true.** After the re-mirror, `save-changes.md` references **ten** images
and all ten are on disk:

`save-button-header.png`, `save-button-review.png`, `save-review-edits-error.png`,
`save-review-edits-error-navigate.png`, `save-review-edits-update-merge.png`,
`save-review-edits-merge-conflict.png`, `save-review-edits-discard.png`,
`save-review-edits-discard-all.png`, `save-review-edits-warning.png`,
`save-error-message.png`.

This matters, because almost everything below that is precise — the tab list,
the entry anatomy, the per-field diff, the conflict panel layout — comes from
those ten screenshots and appears in **no sentence on the page**.

---

## 1 — The specific question: is the working state a second layer above a branch?

**Confirmed. Two layers.** Three independent sentences settle it, and none of
them is the one in the brief.

The working state exists first, and is not a branch:

> Any changes you make in the Ontology Manager are stored locally in a work-in-progress state. For these Ontology changes to be available for others and reflected in user-facing applications, you must save your changes.

A branch can be created **out of** an already-populated working state, which is
only possible if the two are different things:

> If you already have changes to the ontology that you would like to include in a branch, you can select **Save to new branch** from the save dialog to create a separate branch with those changes.

And the sentence the brief quoted, now with its context: rebasing pulls `main`
onto the branch and puts the branch's **already-saved** changes back into the
working state, so the working state can be re-populated from a branch, which
again requires two layers:

> During rebasing, changes from `main` are loaded onto your branch, while any previously saved changes from your current branch are reloaded back into the working state, which you can see in the **All changes** tab.

The screenshots corroborate directly. In every full-window shot the header
carries **both** an unsaved-edit counter and a branch selector, side by side:

> 2 edits … Save … Main
> — ontology-manager/images/review-restore-unsaved-changes-button.png

And a rebase banner names the relationship in one line — saved-on-branch changes
being *restored into* the review dialog:

> Rebase in progress. The changes previously saved on the branch have been restored in the 'All changes' tab. Resolve all conflicts and errors before saving and finishing the rebase.
> — ontologies/images/review-rebase-changes.png

So the model is: **working state → (save) → branch → (proposal, merge) → main**,
where `main` is itself a branch and the working state sits above whichever branch
is selected. A save is the transition from layer 1 to layer 2 — nothing else in
the section performs it.

One nuance the pages do **not** settle: whether the working state is scoped *per
branch* (i.e. switching branches swaps working states) or is one state that
follows you. See Questions.

---

## 2 — What the working state holds: resources at the top, fields underneath

The prose gives the top level only:

> Each resource in the Ontology that you edit will have its own entry in the **Review edits** dialog.

The screenshots give the rest, and they are unambiguous: **one entry per
resource, and inside it a per-field before/after diff, grouped into named
sections, with nested sub-resources getting their own sub-entry.**

From the canonical review dialog, an object type entry expanded:

> Review edits … All edits (2) … [Example Data] Aircraft … 2 edits
> — ontology-manager/images/save-button-review.png

> GENERAL INFORMATION … Title property display_name carrier_code … PROPERTIES … Seat Number … Property display name Number Of Seats Seat Number
> — ontology-manager/images/save-button-review.png

In that image the old value (`display_name`, `Number Of Seats`) is rendered
struck-through in grey and the new value (`carrier_code`, `Seat Number`) in
green. So the unit of change is **a field of a named resource**, not the whole
resource.

The nesting is three deep — resource → section → sub-resource → field:

> [Example Data] Aircraft … GENERAL INFORMATION … PROPERTIES … Seat Number … Property display name … Property type Integer Decimal
> — ontology-manager/images/save-review-edits-error-navigate.png

Sections and sub-entries carry their own edit counts:

> PROPERTIES … 1 edit … Seat Number … 2 edits
> — ontology-manager/images/save-review-edits-discard-all.png

**Inference (not stated anywhere):** the counting is consistent if a *group*
badge counts its edited children and a *leaf* badge counts changed fields. In
`save-review-edits-discard-all.png` the tab reads `All edits (3)`, the resource
badge reads `2 edits` (= general information 1 + properties 1), `PROPERTIES`
reads `1 edit` (= one edited property), and `Seat Number` reads `2 edits` (=
two changed fields). The three field changes are Title property, Property display
name, Property type. The arithmetic works under that rule and under no simpler
one. I mark it as inference because no page states it.

Link types diff the same way, with the entry titled by both ends:

> Origin Airport 2 Departing Flight 2… 1 edit … LINK TO DEPARTING FLIGHT 2… 1 edit … Display name Departing Flight 2 Departing Flight 2…
> — ontology-manager/images/save-review-edits-update-merge.png

Creations and deletions appear as *state pills* on the entry rather than as
field diffs:

> Unsaved changes 1 … New interface … Created
> — ontology-manager/images/review-restore-unsaved-changes-button.png

> [Planning] OOTO … Deleted … [Planning] Support schedule … Deleted
> — ontology-manager/images/cleanup-staging-example.png

The deletion path is confirmed in prose, on the sublink page:

> A dialog will pop up to confirm you want to stage the object type and all of its associated link types for deletion.

> Note that the deletion of the object type only takes effect after you save your changes, and will break any views or applications referencing the object type.

So a deletion is a working-state entry like any other. `cleanup.md` says the same
for cleanup's bulk actions:

> Deprecation and deletion are staged the same way as normal Ontology modifications.

**What the working state can contain, from the pages and images together:**
object types, properties (created, renamed, retyped, deleted), link types,
interfaces, action types, shared properties, type-group membership, status,
visibility, datasource/column mapping, indexing (see §6), and cleanup
deprecations and deletions.

---

## 3 — Where the working state lives, and how long it survives

The only sentence on the subject is:

> Any changes you make in the Ontology Manager are stored locally in a work-in-progress state.

`stored locally` is the whole of it. The section **never** says per-user,
per-browser, per-device, or whether it survives a reload, a sign-out, or a
different machine. I am not going to guess; this is Question 1.

Four pieces of circumstantial evidence, all marked as such:

1. The unsaved-changes page is scoped to the reader — *by you* is explicit:
   > From the homepage sidebar, select **Unsaved changes** to view a list of all unsaved changes made by you.
2. The conflict panel labels one side with a user avatar and the phrase for the
   reader's own edits, implying the server can attribute a working state to a
   person:
   > Your changes
   > — ontology-manager/images/save-review-edits-merge-conflict.png
3. The per-resource History tab renders unsaved edits **with an author avatar and
   a timestamp of `Now`**, in the same timeline as saved versions — which is odd
   for something living only in a browser tab:
   > Unsaved … These changes have not yet been saved or published to the ontology.
   > — ontology-manager/images/review-restore-entity-history-button.png
4. Export explicitly serialises it and import explicitly rebuilds it, so it has a
   complete JSON representation:
   > Any changes you have in your working state will be included in the export.

Contrast: Foundry *does* document this mechanism when it wants to. Quiver's page
says exactly where its working state lives —

> Additionally, in between each Save action, Quiver auto-saves your "working" state (storing it in the `state` URL variable, for example `state=j05na7mun3`).

— and the Ontology Manager pages give no equivalent sentence. The silence is
therefore a real gap, not an oversight of mine.

---

## 4 — The Review edits dialog

Opening it is a two-step, and the prose numbers it:

> 1. Select **Save** from the Application header at the top-right corner of the application.

> 2. Open the **Review edits** dialog to review all your changes.
> 3. Finally, select **Save** to update the Ontology.

**Header controls** (image only):

> History +2 … 2 edits … Discard … Save
> — ontology-manager/images/save-button-header.png

**Tabs** (image only — the prose names Errors and Warnings, and never mentions
Conflicts or Migrations):

> All edits (2) … Warnings … Errors … Conflicts
> — ontology-manager/images/save-button-review.png

> All edits (59) … Warnings … Errors … Migrations … Conflicts
> — ontology-manager/images/cleanup-staging-example.png

A sixth tab appears during a rebase:

> All changes (8) … Warnings … Errors … Migrations (0) … Conflicts (1) … Indexing on branch (0)
> — ontologies/images/review-rebase-changes.png

The counter in a tab label **singularises**: `Error (1)`, `Warning (1)`,
`Conflict (1)` versus `Errors (9)`, `Conflicts (0)`. Small, but it is a real
label rule visible across four screenshots.

**What one entry offers.** Reading the row of controls at the right of an entry
across the images: an edit-count badge or an issue-count badge, a *Navigate to*
button, a discard button, and an expand chevron.

> Navigate to
> — ontology-manager/images/save-review-edits-error-navigate.png

> Discard edits
> — ontology-manager/images/save-review-edits-discard.png

matching the prose:

> You can discard the changes you made to a resource by hovering over the entry in the **Review edits** dialog and selecting the trash icon.

> If you receive an error, you can use the open shortcut to navigate to a resource you need to edit before saving.

For a **deleted** resource the trash is replaced by an undo arrow — you restore
it rather than discard it (`cleanup-staging-example.png`); during a **rebase**
both are replaced by a circled-minus (`review-rebase-changes.png`). Neither
variation is in any sentence.

**Footer.** `Discard` on the left, the primary button on the right. The primary
button's *label changes with the mode*: `Save` in the plain dialog,
`Save to ontology` when the cleanup staging screenshot was taken,
`Propose changes` with the propose toggle on, `Create and save to branch` when a
protected resource is in the set, `Finish rebase and save` during a rebase.

**Discard-all** is documented and has two entry points:

> You can discard all unsaved changes you made to the Ontology at any point by selecting the **Discard** button in the header at the top right of the application, or by selecting **Discard** at the bottom of the **Review edits** dialog.

There is a third, unmentioned in prose: a trash icon on the **Unsaved changes**
page card itself (`review-restore-unsaved-changes-button.png`).

---

## 5 — Errors versus warnings

The rule, stated once:

> The **Review edits** dialog will also show you warnings in-line and in the **Warnings** tab for changes you are encouraged to make. While errors need to be handled in order to save, warnings will not prevent you from saving.

And the symptom:

> If the **Save** button is grayed out, you may have an error that is stopping you from saving.

Two remediation routes, both prose:

> * Scroll through your changes and view the error messages in line, or
> * Select the **Errors** tab at the top of the **Review edits** dialog to see the errors preventing you from saving.

### There is no list of errors on this page. There are examples.

The section gives **no enumeration** of what constitutes an error. What it gives
is one worked example in a screenshot, attached to the exact field that caused
it:

> Base type is incompatible with the type of the column mapped to it
> — ontology-manager/images/save-review-edits-error.png

and one worked warning, likewise attached to a property:

> The primary key has a discouraged base type
> — ontology-manager/images/save-review-edits-warning.png

Neither string appears anywhere in the mirrored prose — I grepped the whole
corpus for both. But the **first one has a documented coded twin**, in the page
`save-changes.md` itself points at:

> If you receive the error `OntologyMetadata:IncompatibleFoundryFieldSchemaForPropertyType`, you are trying to save a property with a base type that is incompatible with the column type that is backing it. For example, the type of column X may have been changed to “string”, but is mapped to property X of base type "integer".

So the pattern is: **the dialog shows a human sentence; the coded error name is
documented on the page that owns the kind of change.** Grepping the corpus for
those names produces the closest thing to a catalogue that exists:

`OntologyMetadata:IncompatibleFoundryFieldSchemaForPropertyType`,
`OntologyMetadata:ConflictBetweenLinkTypeStatusAndObjectTypeStatus`,
`OntologyMetadata:ConflictBetweenLinkTypeStatusAndPropertyTypeStatus`,
`OntologyMetadata:ActionWebhookInputsDoNotHaveExpectedType`,
`OntologyMetadata:UnreferencedRuleSets`, `OntologyMetadata:PermissionDenied`,
`Phonograph2:FoundryColumnNameNotFound`, `Phonograph2:InvalidColumnRemoval`,
`Phonograph2:InvalidColumnFieldSchemaChange`, `Phonograph2:SchemaMismatch`,
`Phonograph2:DatasetAndBranchAlreadyRegistered`,
`FieldTypeIncompatibleWithOntologyPropertyType`.

Note that this cuts across two categories: some of those (an unmapped column, an
incompatible base type) look like save-blocking *validation*; others
(`SchemaMismatch`, `DatasetAndBranchAlreadyRegistered`) are runtime failures of
the backing services and surface as the toast in §5.3, not as an Errors tab
entry. The section does not draw that line for us.

**On whether this is `ontology_violations()` under another name.** Partly, and
the difference is load-bearing. The two published examples are both
*single-resource, structural, checkable before writing*: a property's base type
against its mapped column's type; a primary key's base type against the
discouraged tier from `properties-and-keys.md`. That is exactly the territory
`ontology_violations()` covers. But the Foundry error is evaluated **against the
working state at save time and blocks the save**, whereas
`ontology_violations()` is evaluated against what is already stored. Same
predicates, opposite side of the write. See Decisions.

### The confirmation gate is a third thing, and the prose and the image disagree

The prose says the confirmation is the entity's name:

> Once you have read through the impact of your changes detailed in the warning message and understand the implications of those changes, you can type in the name of the entity you edited to proceed with saving.

The screenshot of that exact feature says the confirmation is a **number**:

> If you are confident you would like to move ahead with this operation, please confirm by typing the number of edits that will be lost
> — ontology-manager/images/save-review-edits-warning.png

with the value to type shown as the placeholder, and the consequences spelled
out above it:

> 388 edits will be undone … This includes all additions, deletions and modifications to objects of this type
> — ontology-manager/images/save-review-edits-warning.png

> Applications referencing this entity will break until a full reindex is completed … Including Object Views, Object Explorer, Workshop Modules etc.
> — ontology-manager/images/save-review-edits-warning.png

Two readings are possible and the pages do not choose: either the UI changed and
the prose is stale, or there are two distinct confirmation gates (name-typing for
a breaking metadata change, count-typing for one that destroys object edits).
The screenshot's own banner suggests the latter is at least plural:

> Warning: Certain changes require explicit confirmation below
> — ontology-manager/images/save-review-edits-warning.png

Question 4.

The prose does say *which* changes are dangerous, and delegates the catalogue:

> Edits to object types and their properties can have an application-breaking impact on applications relying on those object types. Furthermore, if an object type has writeback enabled, extra caution should be taken when making edits to that object type to ensure that the history of edits made to objects of that type is not removed.

The delegated page gives the actual list — three changes that force an unregister
and reregister:

> * Changing an object type's backing datasource.
> * Changing the primary key of an object type.
> * Deleting an object type.

plus, for a writeback-enabled type, any schema change to a property that has ever
received edits; and the exemptions:

> * Changing the display name, title key, render hints, type classes, and visibility of a property that has received edits will ***not*** require the object type to unregister.

### 5.3 — When the save itself fails

A different failure mode again, after the dialog is satisfied:

> If the backend services powering the Ontology encounter a problem when you save, you will receive an error message "toast" (pop-up), as in the image below. At the end of the text explaining why you can't save, the name of the error message will be printed. The error message name will begin with the prefix `OntologyMetadata:` or `Phonograph2:`.

The screenshot shows the full shape, including a machine-readable operations
payload the prose never mentions:

> Failed to save changes. You do not have the relevant permissions to save changes to the ontology. Please ensure you are part of an admin group and have edit permission on the backing datasource for the object referenced below in order to save your changes to the ontology.
> — ontology-manager/images/save-error-message.png

> OntologyMetadata:PermissionDenied … - operations: {ri.foundry.main.dataset.d9884820-d008-4321-bc6a-d3e8a526bd5c=[ontology:use-datasource]}
> — ontology-manager/images/save-error-message.png

That payload — a RID mapped to a list of missing operations — is precisely the
namespaced-typed-error shape `CLAUDE.md` already commits us to.

And one class of edit is simply not available here at all:

> Changes to Functions can only be made in the Functions repository, and not in the Ontology Manager.

---

## 6 — The stale-save path: Update, then conflicts

Two distinct states, and the prose separates them.

**State A — someone saved, but nothing you touched.** Mergeable without a
decision:

> The **Save** button may also be grayed out if the Ontology has been saved by another user since you began making your changes. You will need to select **Update** from the top of the Review edits dialog to merge the other user's changes with your own.

The banner wording (image only) makes the safety claim explicit, and the
Conflicts tab reads zero:

> There are new updates to the Ontology that you can easily and safely merge with your own. … Update
> — ontology-manager/images/save-review-edits-update-merge.png

**State B — someone saved something you also touched.**

> It is possible that there are merge conflicts between changes another user has made and the changes in your working state. You will be prompted to resolve them. You can choose between keeping the changes in the latest version of the Ontology or overriding them with the changes in your working state.

The banner is different, and counts *entities*, not fields:

> 1 entity you have edited has been updated since you started working on your changes.
> — ontology-manager/images/save-review-edits-merge-conflict.png

The resolution UI, entirely image-only, and this is the part that matters most
for us:

> Some updates made to the Ontology since you started editing are on the same entities as yours. For each, choose to either use the latest changes or keep yours.
> — ontology-manager/images/save-review-edits-merge-conflict.png

> Aircraft 2 … Latest version … GENERAL INFORMATION … 1 edit … Display name Aircraft Aircraft 1 … Your changes … GENERAL INFORMATION … Display name Aircraft Aircraft 2
> — ontology-manager/images/save-review-edits-merge-conflict.png

> Use latest … Keep my changes … Apply
> — ontology-manager/images/save-review-edits-merge-conflict.png

**The granularity is asymmetric, and this is the finding.** The *display* is
per-field (each panel shows a field diff). The *decision* is per-entity — one
button pair per resource, and the sentence says `For each` where `each` is an
entity. There is no per-field take-mine/take-theirs in this dialog. The
resolution is then committed with a separate `Apply`, before the outer `Save`.

### How this differs from `branch_conflicts()` in migration 419

Migration 419 gives us per-resource, per-field change tracking and a three-way
merge. The pages describe something with a different granularity in each layer,
and the difference is not cosmetic:

| | Foundry, save-time (`save-changes.md` + images) | Foundry, rebase-time (`branching-ontology.md`) | ours (419) |
|---|---|---|---|
| what is compared | working state vs latest saved ontology | branch vs `main` | branch vs branch |
| conflict unit | **entity** | **resource** | field |
| resolution options | `Use latest` / `Keep my changes` | `Use Main branch changes` / `Keep current branch changes` / custom | (per field) |
| escape hatch | none shown | edit the resource directly to resolve | — |
| commit | `Apply`, then `Save` | `Finish rebase and save` | — |

The rebase page confirms the resource-level unit and adds the third option we do
not have:

> To resolve conflicts, you can choose to **Use Main branch changes** or **Keep current branch changes** for each resource. Alternatively, you can navigate directly to that resource and apply **custom changes** to resolve its conflicts.

and states the default when a resource has changes on both sides:

> This state allows you to view and access changes from both `main` and your branch. When an ontology resource has changes from both branches, it will display your branch version by default.

A per-field merge is therefore **finer than anything the documentation
describes**. That is not automatically wrong, but it is ours and not theirs, and
per §4 the docs' own conflict *display* is per-field even when the *choice* is
not — so a field-level store with an entity-level decision UI would match both
pages. See Decisions.

The rebase page also names two cases where keeping your side is guaranteed to
fail, which is the kind of thing a merge implementation has to know:

> * **Datasource deletion:** When a conflict occurs on an object type where a backing datasource has been replaced or removed on the `main` branch, choosing to keep your branch changes will lead to a merge failure. In this case, choose the `main` branch changes.

and one surprising thing that counts as a change at all:

> * **Indexing counts as a modification:** Indexing an object type is treated as a modification.

---

## 7 — `restore-changes.md`: history is global *and* per resource

**Global unsaved:**

> From the homepage sidebar, select **Unsaved changes** to view a list of all unsaved changes made by you.

**Global saved history**, and the crucial definition of an entry:

> Select the **History** tab in the homepage sidebar to view a list of all saved Ontology changes with details on when the changes were made and the user who applied them.

> Each entry in the edits history corresponds to a single instance of a user saving changes. You also have the option to consolidate the view by merging changes that have been made by the same author into a single entry.

So **a history entry is a save**, not a resource version. The screenshot shows
the shape: an author + date group, containing one row per affected resource with
a `Created` or `Edited` pill. Note that one group's author is not a person:

> Foundry … Installed by Marketplace
> — ontology-manager/images/review-restore-history-button.png

**Filtering**, both options image-only in their exact wording:

> Hide items you cannot see … Merge changes made by the same author
> — ontology-manager/images/review-restore-hide-changes.png

matching:

> In the **Ontology history** page, you have the option to hide changes to object and link types that you do not have access to view. If this option is not enabled, you will be able to see that a change was made to the Ontology but will not be able to view additional details.

**Per resource — yes, version history is per resource, and the working state
appears inside it.** Both, in one list:

> * The unsaved changes you made to the resource.
> * All saved changes that were made to the resource with details on when the changes were made and the user who applied them.

The screenshot confirms the two-section layout, and the unsaved section carries
its own heading and explanation:

> Unsaved … These changes have not yet been saved or published to the ontology.
> — ontology-manager/images/review-restore-entity-history-button.png

Note `saved or published` — two verbs, which the prose never distinguishes.

Also image-only, an admission of incompleteness rendered as a history row:

> No visible changes or modified attributes are not supported in the history view yet.
> — ontology-manager/images/review-restore-entity-history-button.png

And the footer the prose does mention:

> At the bottom left of an Ontology resource view, a footer states when the resource was last edited and by which user.

### Restore writes into the working state — confirmed, quoted

This is the question the brief asked, and the answer is yes, explicitly:

> After restoring an object type to a previous version, any changes that were made after the entry you selected will be undone. The changes will be added to your working state and you will need to save your changes to the Ontology for your restore to take effect.

Two consequences worth naming: a restore is **not** a revert commit — it is a
computed diff loaded into layer 1, and therefore reviewable in the same **Review
edits** dialog, discardable, and subject to the same errors, warnings and
conflicts as any hand edit. And restoring is documented **only for object
types** — the heading is literally scoped that way, and no equivalent sentence
exists for link types, action types, interfaces or shared properties. The
mechanism is two clicks:

> 1. Select the restore button ![restore button](./images/restore-button.png) (anti-clockwise arrow)
> 2. Select **Confirm**.

---

## 8 — Export/import operates on the **working state**, not on saved ontology

Unambiguous, three times:

> You can export your Ontology working state by selecting the **Advanced** settings page from the application's home page and then selecting **Export**.

> Any changes you have in your working state will be included in the export.

> Next, select **Import,** which will recreate the entire working state from the JSON file in the application. You will see the number of changes made in the file that need to be saved in the application header.

That last clause closes the loop: an import lands as unsaved edits and must go
through the same save session. The screenshot's card text says it a fourth time,
and adds a semantic the prose omits:

> Export Ontology … The exported Ontology will include any unsaved changes.
> — ontology-manager/images/import-export-edit-ontology-json.png

> Import Ontology … The imported Ontology can replace or be merged with the current Ontology.
> — ontology-manager/images/import-export-edit-ontology-json.png

**`replace or be merged` is image-only and is a real second mode.** The prose
only describes recreation.

Two constraints:

> You should not depend on the exported JSON schema as it may change over time.

> An exported Ontology working state with conditional formatting rules configured on its properties cannot be imported to an Ontology other than the one it was exported from.

with the matching error:

> If you receive the error `OntologyMetadata:UnreferencedRuleSets`, you are trying to import an Ontology working state with conditional formatting rules that are not defined in that Ontology and cannot be transferred over.

Two stated use cases — code-editing the ontology, and copying one ontology's
working state into another:

> * If you'd like to copy the working state of one Ontology to another Ontology, you can export the Ontology's current state as a JSON file and then import the copied JSON back into the platform (making any desired changes to the JSON in a code editor).

---

## 9 — `_index.md` versus `overview.md`: they are the same file

The brief asked what differs. **Nothing does.** `diff` reports exactly one
differing line, the mirror's own provenance comment: `_index.md` carries
`.../ontology-manager/` and `overview.md` carries `.../ontology-manager/overview/`.
Byte-identical otherwise, 121 lines each. Palantir serves the same page at both
URLs; the mirror faithfully stored it twice.

The same is true of `ontologies/branching-ontology.md` and
`ontologies/test-changes-in-ontology.md` — identical but for the source comment,
both titled `Branching the ontology`. **Do not treat any of these four as four
sources.** They are two.

The content, briefly, since it is the application frame the save session sits in:

> **Ontology Manager** (sometimes called the Ontology Management Application, or OMA) enables you to build and maintain your organization's Ontology.

Three access routes, one of which is a URL we could mirror:

> * Adding `/workspace/ontology` to the end of your Foundry home page URL (for instance, `https://example.website.com/workspace/ontology`).

The top bar's three jobs, which is where the save controls live:

> The top bar has three main functionalities. It allows users to search for Ontology resources, create new Ontology resources, and navigate between or create new branches.

The object type Overview's seven numbered sections:

> 1. Object type metadata
> 2. Properties
> 3. Action types
> 4. Link type graph
> 5. Dependents
> 6. Data
> 7. Usage

And two page-list claims that the screenshots **contradict** — see §10.

---

## 10 — What the images add that the prose does not

The section's prose describes about a third of what its screenshots show. Listed
by what it changes.

### 10.1 The Review edits dialog has tabs the prose never names

`Conflicts` appears in **every** review-dialog screenshot; `Migrations` in two;
`Indexing on branch` in the rebase one. `save-changes.md` names only Errors and
Warnings. A build driven by the prose alone would ship a two-tab dialog.

### 10.2 The diff is per field, with strike-through/green rendering

Nothing in `save-changes.md` says an entry contains a before/after at all. Every
review screenshot shows it. It is the single most important structural fact in
the section and it lives only in pixels.

### 10.3 An edited field is marked *in place*, on the resource page

Not just in the dialog. The object type Overview renders a green dot beside the
label of an edited field, and the property list renders one beside a
newly-created property:

> Name … [Example Data] Aircraft … 1 edit … Discard … Save
> — ontology-manager/images/oma-user-interface-navigation-back-home.png

> New property 4
> — ontology-manager/images/oma-user-interface-property-editor-v2.png

(In the first, a green dot sits immediately after the word `Name`; in the second,
after `New property 4`. Both are unlabelled in prose.) **Inference:** the green
dot is the working-state marker. It is consistent across both screenshots and
nothing else explains it, but no sentence confirms it.

### 10.4 The Save button is a split button

`save-changes.md` describes a plain `Save`. The usage-tab screenshot shows a
caret; the branching page's screenshot shows what is under it:

> Save to ontology … Save to new branch
> — ontologies/images/save-to-ontology.png

That dropdown is the *entire* bridge between the save session and branching, and
it is invisible in the `ontology-manager/` prose.

### 10.5 A protected resource replaces the save entirely

> To update protected resources, your changes must be saved to a new branch. Learn More
> — ontologies/images/modify-protected-object.png

> Branch name … update-frequent-flyers-description … Ontology … Foundry branches for an ontology can only be created in the same ontology
> — ontologies/images/modify-protected-object.png

with the entry itself flagged, and the footer carrying a toggle plus a renamed
primary button:

> Frequent Flyer … Protected … 1 edit
> — ontologies/images/modify-protected-object.png

> Discard … Save to new branch … Create and save to branch
> — ontologies/images/modify-protected-object.png

Confirmed in prose on the branching page:

> When modifying protected resources, the **Save** dialog is replaced with **Create and save to branch**, requiring you to save changes to a new branch.

### 10.6 The legacy propose-toggle, and how to tell it is legacy

`cleanup-staging-example.png` and `ontologies/images/propose-changes.png` both
show a toggle inside the dialog:

> Propose your changes … Selecting this will create a Branch with your Ontology changes and a draft Proposal to approve those changes. Open the Branch to view and add edits. Once all edits are approved, merge the Proposal.
> — ontology-manager/images/cleanup-staging-example.png

with, when on, a title and description form appearing beside the diff:

> Title (Required) … Modified "Rfc" … Description (optional, supports Markdown syntax) … Enter a short description of the changes in this proposal
> — ontologies/images/propose-changes.png

**This is the legacy model.** The legacy page describes exactly that toggle:

> Alternatively, if you already have changes to the Ontology that you would like to include in your proposal, you can select save and toggle **Propose your changes** from the save dialog.

and is marked sunset:

> Ontology branches (formerly known as ontology proposals) are being sunset. On enrollments with Global Branching enabled, you can no longer create ontology branches.

The current equivalent is the `Save to new branch` menu item. A screenshot on a
*live* page (`cleanup.md`) is therefore showing a superseded UI — worth knowing
before copying it.

### 10.7 The rebase working state labels each change's origin

> Current Employee … 5 edits … Display name Test Employee Current Employee … Description Test Current Employees … New Office ID [changed on Main]
> — ontologies/images/review-rebase-changes.png

`[changed on Main]` is a per-entry provenance suffix. Nothing in prose mentions
that the working state distinguishes where a change came from. For a two-layer
implementation this is the difference between a merged view being legible and
being a soup.

### 10.8 The homepage sidebar is a complete resource inventory

> Unsaved changes 1 … Discover … Proposals … History … Resources … Object types 7,128 … Properties … Shared properties 164 … Link types 2,496 … Action types 12,574 … Groups 132 … Interfaces 114 … Functions 10,576 … Health issues … Cleanup … Ontology configuration
> — ontology-manager/images/review-restore-unsaved-changes-button.png

A second screenshot adds a resource kind absent from the first:

> Value types 0
> — ontology-manager/images/review-restore-history-button.png

and an older one shows the previous shape, with `Advanced` where
`Ontology configuration` now sits, and a beta-flasked entry that appears in no
prose anywhere in this section:

> Semantic search
> — ontology-manager/images/cleanup-filters.png

The list also tells us where `Unsaved changes` sits in the IA: **above** Discover,
Proposals and History, and it appears only when the count is non-zero (present in
`review-restore-unsaved-changes-button.png` with badge 1; absent in
`review-restore-history-button.png`). That last is inference from two screenshots,
not a stated rule.

### 10.9 Resource-page tab lists contradict the prose

`_index.md` says the link type view has two pages:

> Selecting a link type from the link type graph of an object type's **Overview** tab (see image below) opens the link type view (with **Overview** and **Datasources** pages).

The screenshot shows **four**:

> Overview … Security … Datasources … Usage
> — ontology-manager/images/oma-user-interface-link-type.png

And for action types the prose says:

> Selecting an action type from the action type section of an object type's **Overview** tab opens the action type view, with further access to the **Overview**, **Logic** and **Observability** pages.

The screenshot shows nine, and **none of them is called Logic**:

> Overview … Rules … Parameters … User Interface … Capabilities … Security & Submission Criteria … Automations … History … Observability
> — ontology-manager/images/oma-user-interface-action-type.png

**Inference:** `Rules` is what `Logic` became. The object type sidebar likewise
grew: an older screenshot shows Overview / Properties / Security / Datasources /
Capabilities / Object views / Interfaces / Automations / Usage, and the newest
adds `Materializations` and `History`:

> Overview … Properties 9 … Security … Datasources … Capabilities … Object views … Interfaces … Materializations … Automations … Usage … History
> — ontology-manager/images/review-restore-entity-history-button.png

### 10.10 Three RID forms, one of them fully legible

> RID ri.ontology.main.relation.651e59…
> — ontology-manager/images/oma-user-interface-link-type.png

A **link type RID uses the token `relation`**, not `link-type`. Our
`rid-grammar.md` reading records link types as having no attested form; this
attests one, partially.

> RID ri.actions.main.action-type.e…
> — ontology-manager/images/oma-user-interface-action-type.png

> RID ri.function-registry.main.function.1686f24c-2542-4081-9a3f-a844fbe86a31
> — ontology-manager/images/oma-user-interface-function-type.png

The function RID is complete and unredacted — service `function-registry`,
instance `main`, type `function`, a UUID locator. And the ontology itself:

> RID ri.ontology.main.ontology.00000000-0000-0000-0000-0000… API name default
> — ontology-manager/images/import-export-edit-ontology-json.png

An all-zero UUID for the default ontology, whose API name is literally `default`.

### 10.11 The object type metadata block, field by field

> Plural name … Description … Aliases … Point of contact … Contributors … Ontology … API name … Status Active … Visibility Normal … Index status Not indexed on branch … Edits Disabled … ID … RID
> — ontology-manager/images/oma-user-interface-overview-annotated.png

`Index status` and `Edits` are state, not settings, and neither is named in the
section's prose. `Not indexed on branch` is a distinct value from the `Success`
seen elsewhere:

> Index status Success … Edits Enabled
> — ontology-manager/images/oma-user-interface-navigation-back-home.png

### 10.12 Dependents is a typed index of consumers

> Dependents 14 … Workshop 9 … Function 2 … Graph Template 1 … Quiver Dashboard 1 … Use cases 1 … Automation 0 … Developer Console App 0 … Map Layer 0
> — ontology-manager/images/oma-user-interface-overview-annotated.png

Nine consumer kinds with counts, including zeroes. This is the resource graph
`CLAUDE.md` cites as the reason we need no `shape_registry`, rendered.

### 10.13 The property editor's real shape

> Properties (13) … Column mapping … 9 of 9 Columns mapped … Create property … Property name … Status … Visibility … Base formatter … Column
> — ontology-manager/images/oma-user-interface-property-editor-v2.png

> General … Display … Interaction … Details … Advanced … Name … Description … Base type … Allow multiple … Value type … Status … Configuration … Title key … Primary key
> — ontology-manager/images/oma-user-interface-property-editor-v2.png

Both keys are toggles in a `Configuration` block, and the title-key toggle shows
which property currently holds it. This confirms `create-object-type.md`'s
checkbox finding from a second, independent screenshot.

### 10.14 Bulk operations on the resource list

> 2 object types selected … Clear … Open in … Rename … Delete … Edit status … Edit visibility … New object type
> — ontology-manager/images/project-based-perm-bulk-res-migration.png

> Object Storage V2 migration … Edit groups … Project permission migration … Move project
> — ontology-manager/images/project-based-perm-bulk-res-migration.png

and the single-resource menu:

> Edit object view … Copy configuration to another object type … Project permission migration … Delete
> — ontology-manager/images/project-based-perm-individual-res-migration.png

`Rename`, `Edit status` and `Edit visibility` in bulk all land in the working
state; the section never says so, but `cleanup.md`'s staging sentence generalises
it.

### 10.15 Cleanup: a flag the prose omits, and default priorities

`cleanup.md` lists six flags. The filter popover shows a seventh:

> No registered usage in 30d 3167 … Past deprecation date 16 … Trashed datasource 112 … Phonograph deindexed 735 … Datasource not updated in 90d 5035
> — ontology-manager/images/cleanup-filters.png

and the settings page gives each a default priority and an on/off default, none
of which is in prose:

> Optimized for usage … Default … Recommended flags for usage optimization … Custom … Choose custom flags to use
> — ontology-manager/images/cleanup-configuration-view.png

> Saving changes to flag settings will reset previous Cleanup results.
> — ontology-manager/images/cleanup-configuration-view.png

(`No registered usage in 30 days`, `Past deprecation date`, `Trashed datasource`,
`Phonograph deindexed` default on at High; `Datasource not updated in 90 days` on
at Medium with an editable day count; `Description missing` and the display-name
regex default **off** at Low.) The prose says you are *prompted to recalculate*;
the dialog says the previous results are *reset*.

### 10.16 Discover, and the fallback headings

> Object types recently modified in … ontology 32 … Prominent object types 2
> — ontology-manager/images/oma-fallback-sections.png

> Personalize your homepage by selecting and arranging sections to create a tailored ontology experience. The ontology will start up with object types from your selected sections, ensuring the entities most relevant to you are readily available.
> — ontology-manager/images/oma-customize-homepage.png

> Items per section … Add section … Group … Favorite object types … Favorite groups … Recently viewed object types
> — ontology-manager/images/oma-customize-homepage.png

### 10.17 The roles migration wizard has a third option

`ontology-roles-migration.md` says two:

> The migration wizard will appear with two suggested role options: **Datasource roles** and **Ontology admins and datasource roles**.

The screenshot shows three, plus a default-role selector:

> Datasource roles … Datasource roles & Ontology Admins … Start from scratch … Don't quick add, add roles manually
> — ontology-manager/images/oma-migrating-one-resource-roles-suggestions.png

> Default role … Choose default role for users with access to Ontology … Ontology Viewer
> — ontology-manager/images/oma-migrating-one-resource-roles-suggestions.png

### 10.18 Usage, in numbers

> Interactions 8772 … Reads 8770 … Writes 2 … Active users 89
> — ontology-manager/images/oma-user-interface-usage-tab.png

`view-usage.md` defines all four terms; the screenshot shows the panel that
carries them plus `Last updated` and `Last interaction`, and a per-application
breakdown the prose only gestures at.

---

## 11 — The five context pages, in one pass each

**`navigation.md`.** `Cmd/Ctrl + K` opens search; search from the home page
filters the home page rather than opening a popover; results highlight the
matched field. The searchable set is worth recording verbatim, because it is a
complete resource list:

> You can search for any object type, property, link type, action type, shared properties, interfaces, or functions you are interested in.

Home-page list filtering is by three axes:

> These pages allow for filtering object types and link types based on their visibility, development status, and indexing issues.

which the screenshot renders as three columns, `STATUS`, `VISIBILITY`, `ISSUES`
(`oma-user-interface-navigation-homepage-sidebar.png`). And the one indexing
failure the prose names:

> Object types whose backing datasources are unregistered or have failed to reindex into Object Storage v1 (Phonograph) will have red error messages in the issue column of the object type page.

`Back home` doubles as a jump menu (`RECENTLY EDITED` and `RELATED`, per
`oma-user-interface-navigation-back-home-hover.png`).

**`view-usage.md`.** Four definitions — a read is one load request from the
object store, not one object; a write is one edit request, not one object;
interactions is reads plus writes over 30 days; active users is unique user IDs
over 30 days. Two places to see it (Overview graph, Usage tab), one toggle to
enable it:

> Usage on the **Overview** tab and detailed usage metrics in the **Usage** tab are configured from the **Ontology settings** tab in Control Panel using the **Ontology metrics** toggle.

Relevant to the save session only through its stated purpose:

> High-level summary of usage over the last 30 days, enabling Ontology users to quickly understand the implications of making a breaking change to this resource.

**`cleanup.md`.** Three dispositions with sharply different scopes — `Snooze` is
personal, `Deprecate` is global metadata with an optional deadline, `Delete`
removes the type and its data. The staging sentence is the one that matters here:

> Selecting **Save** in the top right enables saving the changes directly to the Ontology or creating a proposal to request review from another user.

Also: flag configuration is per user, like snoozing —

> Like snoozing object types from the queue, this is an individual customization that does not affect other Ontology editors.

— which is the only *explicit* per-user scoping statement anywhere in the
section, and notably it is about a *preference*, not about the working state.

**`ontology-roles-migration.md` [Legacy].** Marked legacy at the top and
superseded by project-based permissions. Records: roles decouple resource
metadata from instance data; migration is irreversible; bulk is capped at 500 at
a time; action types with no user-checking submission criteria and
function-backed actions without `@edits` decorators cannot be bulk-migrated. Two
sentences bear on the save session:

> Add a condition based on the current user in the **Security & Submission criteria** tab of the Action type in the Ontology Manager (in the **Submission criteria** section) and save to the Ontology before re-attempting the migration.

i.e. a migration can *require* a completed save session first.

**`migrate-to-project-based-permissions.md`.** The current model. Ontology
resources live in Compass projects and inherit their permissions; instance
permissions do not move:

> Object and link instance permissions remain dependent on the backing datasource location.

> Once a resource has been migrated to project-based permissions, it cannot be reverted to ontology roles or datasource-derived permissions.

Naming constraints that matter for any Compass-shaped store:

> Forward slashes ("/") are not allowed, and duplicate names are not permitted. While aliases allow duplicate names to be rendered, the system removes duplicates by appending "(1)" to ensure unique paths.

> An Ontology's resources must be saved in a project within the same space as the ontology itself.

And a setting that changes resource creation:

> To turn on project-permissioning for new ontology resources, ontology owners can navigate to the **Ontology configuration** tab in Ontology Manager and toggle on **Require new ontology resources be saved in a project**.

The three Marketplace diagrams show the before/after placement of ontology
resources (in a system-managed `Ontology service project` before, in the chosen
target project after) and the two-linked-products workaround.

---

## 12 — Contradictions found while grepping the corpus

1. **Name-typing versus count-typing** at the destructive-save gate —
   `save-changes.md` prose versus `save-review-edits-warning.png`. §5.
2. **Link type view: two pages or four**; **action type view: `Logic` or
   `Rules`** — `_index.md`/`overview.md` prose versus their own screenshots. §10.9.
3. **Two role-suggestion options or three** — `ontology-roles-migration.md`
   versus `oma-migrating-one-resource-roles-suggestions.png`. §10.17.
4. **Cleanup flags: six or seven**, and *recalculate* versus *reset* —
   `cleanup.md` versus `cleanup-filters.png` and `cleanup-configuration-view.png`.
   §10.15.
5. **Object type statuses: three or five.** `object-link-types/edit-object-type.md`
   says
   > Choose from the `deprecated`, `experimental`, and `active` statuses.

   while `object-link-types/metadata-statuses.md` says
   > The status can take on one of five values:

   and enumerates promoted, active, experimental, deprecated, example. The
   five-value page is the specific one and the screenshots show `Example` in the
   wild (`migration-assistant-individual-resources.png`), so the three-value
   sentence is stale.
6. **The propose-toggle is legacy but appears on a live page.** §10.6.
7. **Four URLs, two documents.** `_index`/`overview` and
   `branching-ontology`/`test-changes-in-ontology` are duplicate pairs. §9.

None of these is a disagreement about the save session's *semantics*. Every one
is prose that fell behind its own screenshots — which is the argument for reading
the images first, not last.

---

## 13 — A second pass, on four pages outside this section

Added after the operator supplied four more URLs against Questions 1–3. The
useful finding is that **the other authoring applications document what the
Ontology Manager leaves silent**, and they agree with each other.

### 13.1 Workshop state saving is a different concept — it does not apply

`workshop/state-saving.md` is about a *module consumer* deliberately preserving
their own view:

> State saving is a powerful Workshop feature that allows module consumers to store the current state of their work within a module and then either return to that saved state or share the saved state with other users.

It is opt-in per variable, produces a **named Compass resource** with a chosen
location (`User home folder`, `Any Compass location`), and is shareable as a
link. That is a deliberate named save, not an implicit editing buffer. It tells
us Foundry's habit — durable, shareable user state becomes a Compass resource —
and nothing about the working state. **Not evidence for Question 1.**

`autopilot/workbench.md` uses "state" in a third sense again — a Kanban stage:

> States represent distinct stages in your automation workflow. Each state corresponds to a column in the Kanban board and a node on the graph, and defines where objects are in their lifecycle.

Unrelated. Recorded so the next reader does not re-check it.

### 13.2 Question 2 — the working state is scoped to a branch. Answered.

Three pages in three applications say the same thing, and one says it as a
consequence severe enough to warrant a warning callout:

> Branch resets cannot be undone. After resetting, all changes on you original branch will be lost, including saved and unsaved changes.

— `pipeline-builder/branches-propose-a-change.md`

> Unsaved Workshop edits are not preserved through a rebase. Save your changes to the branch before starting the rebase; any in-progress edits that have not been saved will be lost.

— `workshop/branching-integration.md`

together with the Ontology Manager's own rebase sentence from §1 — a branch's
saved changes being *reloaded into* the working state. Unsaved changes belong to
a branch, are enumerated alongside saved ones, and die with it.

**Inference, marked:** if unsaved changes are lost by *resetting a branch*, then
switching branches cannot silently carry them across — but no page says what
switching does, so the specific question of swap-versus-follow stays in
Questions.

### 13.3 Question 3 — auto-merge what does not overlap. Answered, and it vindicates 419.

`workshop/branching-integration.md` states the rule the Ontology Manager pages
only imply:

> A change is marked as a merge conflict when it is edited on both `main` and the branch.

> Workshop auto-merges changes that do not overlap. A change is only flagged as a merge conflict when the same widget, variable, section, or layout position was edited on both `main` and your branch; for those, you must pick a version manually as described below.

**That is a three-way merge with element-level conflict units** — auto-resolution
of non-overlapping edits is only possible against a base. Migration 419 is the
same algorithm with *field* as the element. Not finer-than-documented after all;
the same shape at the granularity the Ontology Manager's own diff already renders
(§10.2).

Slate is the outlier, and its screenshot explains why rather than contradicting
the above. `slate/applications-merging.md` says:

> When a merge conflict is identified, Slate will not attempt merge changes within an element and will contain the other user's changes by default.

and its worked example is exactly Question 3's test — User A edits a Y value,
User B edits a series colour, same widget, conflict. But the merge screenshot
shows three panes labelled

> THEIRS (V16) … RESULT … MINE (UNSAVED CHANGES)
> — slate/images/merge-json-conflict.png

and `MINE` differs from `THEIRS` on **both** lines: `orange` versus `#8F398F`,
and `2` versus `22`. User B never touched the Y value — B's copy simply predates
A's change from `2` to `22`. **A two-way diff cannot distinguish "I edited this"
from "I am behind here"**, so every differing line reads as a conflict and the
only safe default is to take the other side. Slate is coarse because it has no
base, not because element-level is the platform rule.

`THEIRS (V16)` is also the corpus's plainest evidence for optimistic concurrency
on an integer version, which `deep-dive-ontology.md` left open as S3.

Pipeline Builder agrees on units and adds vocabulary:

> Merge conflicts are changes that were made to the base branch in the time since you created a branch from it.

> Rebasing in Pipeline Builder allows you to combine your unpublished changes in your local branch with the latest published changes on your remote branch.

### 13.4 Question 1 — still not stated, but the silence is now informative

No page in 1,760 says where the Ontology Manager's working state is held. What
the second pass adds is a **contrast**: there is exactly one page in the corpus
that describes browser-local draft state, and it says so without ambiguity:

> By default, the AIP Analyst widget keeps draft chat state in memory while the user's browser tab remains open. This lets the widget retain conversation history, context items, and tool results when it is hidden and shown again within the same Workshop module, such as when the widget is placed in a tab or collapsible section. Refreshing or closing the browser tab clears this unsaved draft state.

— `aip-analyst/workshop-widget.md`

**When Foundry means a draft held in browser memory and lost on refresh, it
says so.** The
Ontology Manager says `stored locally in a work-in-progress state` and then
describes that state surviving into a review dialog, an attributed history
timeline, a save-to-new-branch, and a rebase reload.

There is also a precedent for per-user state on a shared server-side resource:

> Marking changes as reviewed is user-specific. When you mark changes as reviewed, it only applies to your user. Other users can independently mark the same changes as reviewed without affecting your review status.

— `pipeline-builder/branches-approve-a-change.md`

**Counter-evidence, stated so it is not buried:** the two "unsaved changes are
lost through a rebase/reset" sentences in §13.2 are *ambiguous*, and can be read
the other way — edits might be lost precisely because they were client-side and
the page reloaded. This reading does not resolve that. Question 1 stands.

### 13.5 Question 6 — the Migrations tab is named after all. Answered.

The agent reported it appears in no sentence in the corpus. It does, outside both
sections searched:

> In addition to displaying a warning, Ontology Manager will present a **Migrations** tab in the **Review changes** interface when the user wants to save their changes to the Ontology. Ontology Manager will block the user from saving changes until they define a migration for the breaking change. This prevents the change from breaking other workflows.

— `object-edits/schema-migrations.md`

So it is a **third save-blocking class**, alongside errors and the confirmation
gate — and it partially answers Question 5. `object-edits/schema-migrations.md`
is unread and now clearly load-bearing.

### 13.6 Question 1 — Quiver is the platform's one worked example, and it is server-side

`quiver/core-concepts.md` describes the same three-layer model the Ontology
Manager has, and unlike every other page in the corpus it says **where the middle
layer lives and how it is addressed**:

> Quiver analyses are saved manually by clicking the Save button in the top right of the application. A version history is also provided, allowing you to view or revert your analysis to previous saved versions. Additionally, in between each Save action, Quiver auto-saves your "working" state (storing it in the `state` URL variable, for example `state=j05na7mun3`). This allows you to refresh your page and get back your exact analysis state even if you have not saved. Note that if you are sharing a URL link with the `state` variable set, this will open that working state rather than the latest analysis version.

Four things are stated outright, and the fourth is the one that decides it:

1. The working state is **auto-saved**, continuously, between explicit saves.
2. It **survives a page refresh** — `get back your exact analysis state even if
   you have not saved`.
3. It is addressed by an **opaque handle** in the URL, `state=j05na7mun3`.
4. That handle is **shareable**, and following it opens *someone else's working
   state* rather than the saved version.

A ten-character token cannot encode an analysis, and a second person opening a
link cannot be served state that only ever existed in the first person's browser.
**The `state` variable is a key to something held on the server.** This is the
only page in 1,766 that describes the mechanism rather than the behaviour.

The history menu is the same shape as the Ontology Manager's, which is what makes
the analogy structural rather than verbal — an unsaved row carrying a **count**,
sitting above numbered saved versions in one list:

> History … Analysis History … Versions … 15 unsaved changes … v8 Chris Fri, Oct 27, 2023, 1:25 PM Current … v7 … v6 … v2 Tom
> — quiver/images/howto-analysis-history-menu.png

Two details in that screenshot are worth having. The saved versions are
**sequential integers** authored by different users (`v8` Chris, `v2` Tom), which
corroborates Slate's `THEIRS (V16)` and settles that a version is an integer, not
a timestamp. And the unsaved row carries **no author and no timestamp** while
every saved version carries both — because it is yours, so attribution would be
redundant. That reframes the Ontology Manager's own unsaved entry (§10.3,
`review-restore-entity-history-button.png`): its avatar and `Now` are the *same
row* rendered by a more talkative application, not evidence of anything.

**Where Quiver must NOT be copied.** Its concurrency model is the opposite of the
Ontology Manager's:

> If multiple users are working on the same analysis at the same time, they are able to work independently without interference, however saving changes will overwrite each others saved changes.

Last-write-wins, with no merge at all. The Ontology Manager has `Update`,
conflicts and keep-or-override (§6), so it is the more careful product and
Quiver's save semantics do not transfer. Only the storage shape does.

**Verdict.** No page states where the *Ontology Manager's* working state lives,
so this is not a quotation and must not be cited as one. But three independent
lines now point the same way:

- Foundry's one documented working state is server-held and survives a refresh.
- Foundry says `in memory … cleared on refresh` explicitly when it means that
  (§13.4), and does not say it here.
- The Ontology Manager's working state survives into a `Save to new branch`, a
  rebase reload, and an attributed history entry — none of which a browser-local
  buffer participates in.

**Inference, and it is the one this phase is built on: server-side.** Not
Quiver's URL-handle addressing, though — no `state` parameter appears in any of
the 56 screenshots, and the Ontology Manager attributes an unsaved entry to a
user rather than to a link. Combined with §13.2, the shape is **one working state
per (user, branch)**.

---

## Connects to

- **`readings/compass-branching-and-views.md`** — recorded that Global Branching
  replaces an edit-session/version pair. This reading refines that: the edit
  session is **not** replaced, it sits *below* the branch. Both exist.
- **`readings/capabilities-typeclasses-and-branching.md`** — recorded branch
  state as per-resource, per-field, which is what migration 419 implements. The
  save-time conflict UI here is per-*entity*; the rebase-time one is
  per-*resource*. Three granularities across three surfaces.
- **`readings/ontology-linting.md`** — the errors/warnings split in the save
  dialog is the same shape as `ontology_violations()`, on the other side of the
  write. §5.
- **`readings/rid-grammar.md`** — `ri.ontology.main.relation.…` partially attests
  a link type RID, which that reading left open. §10.10.
- **`readings/properties-and-keys.md`** — the discouraged-base-type tier is
  exactly what the published warning example fires on. §5.
- **`readings/create-object-type.md`** — both keys as property-level toggles,
  confirmed again by the property editor screenshot. §10.13.
- **`readings/object-edits-and-security.md`** — the destructive-save warning
  counts *object edits* that will be undone, i.e. the instruction log that
  reading describes.
- **Ours:** `ontology_branches` and `branch_conflicts()` (migration 419) exist;
  there is no working-state layer at all, and the Ontology Manager surface writes
  straight through to `object_types` etc. That is the gap this reading is for.

---

## Decisions I had to make

1. **I treated the two-layer question as settled in favour of two layers, and
   said so.** Three sentences plus two screenshots agree, and none of them
   contradicts. If I had found only the rebase sentence the brief quoted I would
   have left it open.
2. **I corrected the brief's premise about `save-changes.md` having no
   screenshot, rather than working around it.** Ten images now exist and they
   carry most of the page's real content; silently building on the old premise
   would have produced a two-tab dialog with no diff rendering.
3. **I recorded the badge-arithmetic rule as inference, not fact.** It reconciles
   four screenshots exactly and nothing else does, but Foundry never states it, so
   it is marked. A builder may rely on it; a reviewer should know it is derived.
4. **I did not reconcile the name-typing/count-typing contradiction.** Both
   readings are plausible and choosing one silently is exactly the failure mode
   `CLAUDE.md` names. It is Question 4.
5. **I read the cleanup and roles-migration screenshots as a UI generation
   older than the current prose**, on the evidence of the sunset notice on
   `ontology-branches-legacy.md`, the `Advanced` versus `Ontology configuration`
   sidebar difference, and the `Create branch` versus `New` header button. This is
   inference from three signals; it changes which screenshot to copy, so it is a
   decision rather than an observation.
6. **I framed our per-field merge as finer than the docs, not as wrong.** The
   docs' conflict *display* is per-field even where the *choice* is not, so a
   field-level store with an entity-level decision UI satisfies both pages. But I
   did not decide that this is what we should build — that is a design call for
   the phase, and it needs Question 3 answered first.
7. **I treated `Errors` as save-blocking *validation* and the toast as *runtime
   failure*, and listed the coded error names across both.** The pages do not draw
   the line; I drew it because `PermissionDenied` and `SchemaMismatch` cannot
   plausibly be pre-save checks. Marked as my split, not Palantir's.
8. **I did not build a table of what our `ontology_violations()` should check
   from the two published error examples.** Two examples are not a spec, and
   inventing the other twenty is precisely how an invented mechanism gets in.
9. **I read four images from `ontologies/images/` that no `ontology-manager/`
   page references**, because they are the only pictures of the save dialog's
   branch-aware modes. Cited by their real path so the checker can verify them.

---

## Questions I could not answer

1. **Is the working state per-user, per-browser session, or server-side per
   user? Does it survive a page reload, a sign-out, a different machine?**
   `blocks: the working-state phase` — this decides whether it is a table, a
   per-user row, or client storage, and every other decision depends on it.
   Searched: `stored locally`, `work-in-progress`, `working state`,
   `unsaved changes` across all 1,184 mirrored pages. The only sentence is
   `stored locally in a work-in-progress state`. Quiver documents its equivalent
   precisely (URL `state` variable); the Ontology Manager does not. The
   screenshots point the other way (author avatar, `Now` timestamp, appearing
   inside a server-rendered history timeline), so the two signals conflict.
   **The learn.palantir.com courses would settle this in one screen.**

   **Revised after the second pass (§13.4), in two directions.** The screenshot
   half of this is weaker than first written: `review-restore-history-button.png`
   is the history of **saved** changes, so its avatars and dates say nothing
   about the working state, and only `review-restore-entity-history-button.png`
   bears on it — where the avatar and `Now` are both knowable client-side
   anyway. Treat the screenshots as **neutral**, not as server-side evidence.
   What replaces them is a contrast: `aip-analyst/workshop-widget.md` shows that
   Foundry states browser-memory drafts explicitly when that is what it means,
   and the Ontology Manager does not. Also searched and found nothing: Pipeline
   Builder, Workshop, Slate, Quiver, Data Lineage, global branching, and the
   nine deep-dive courses.

   **RESOLVED as far as the corpus allows — §13.6.** Still not *stated* for the
   Ontology Manager, and it must never be cited as though it were. But
   `quiver/core-concepts.md` documents the one working state in the platform
   whose mechanism is described, and it is server-held, auto-saved, survives a
   refresh, and is addressed by a shareable handle. With the AIP Analyst contrast
   and the three Ontology Manager behaviours a browser buffer cannot perform,
   **the phase is built on server-side, one working state per (user, branch)**,
   declared as inference in the migration header. What would still overturn it:
   any course screen showing unsaved ontology edits lost on refresh, or absent on
   a second machine.

2. ~~**Is the working state scoped per branch?**~~ **ANSWERED — yes.** §13.2.
   Unsaved changes belong to a branch and are destroyed with it, said in two
   applications. What remains is narrower and does not block: *switching*
   branches with edits pending — follow, stay, or refuse — is described nowhere.

3. ~~**What exactly is a conflict compared against?**~~ **ANSWERED — auto-merge
   what does not overlap, conflict on what does.** §13.3. Workshop states the
   rule outright and it is a three-way merge at element granularity, which is
   migration 419's algorithm with *field* as the element. Slate's coarser
   behaviour is explained by its two-way diff, not by a platform rule. **419
   needs no correction.** The narrower open question, which does not block: is
   *field* the right element for an object type, or should co-edits of two
   properties on one type conflict as one entity? The Ontology Manager renders
   its diff per field, so field is the defensible default.

4. **Which destructive changes demand name-typing and which demand
   count-typing — or has one replaced the other?** `blocks: the warnings phase`.
   §5. Searched for `type in the name`, `confirm by typing`, `number of edits` —
   the second appears only in the screenshot, the first only in prose.

5. **Is there a canonical list of save-blocking errors?** `blocks: nothing`
   (we can grow ours from `ontology_violations()`), but it would change how much
   we build. Two examples exist as pixels; twelve coded names exist scattered
   across other pages; no page enumerates them. Searched
   `OntologyMetadata:`, `Phonograph2:`, `Errors tab`, `preventing you from saving`.

6. **What is the `Migrations` tab?** `blocks: nothing`. It appears in two review
   dialogs with a `(0)` count and is named on no page in the corpus. Searched
   `Migrations tab`, and `Migrations` inside `ontology-manager/` and `ontologies/`
   — the only hits are the project-permission and roles migrations, which are a
   different thing entirely.

7. **Does `Update` ever apply changes you would not want, and can it be
   undone?** `blocks: nothing`. The banner claims the merge is safe; there is no
   sentence about reversing an Update short of Discard-all.

8. **Can a working state be restored per resource for anything other than an
   object type?** `blocks: the history phase`. `restore-changes.md` scopes its
   restore section to object types and gives no reason. Searched `restore` across
   `ontology-manager/` and `ontologies/`.

9. **Does discarding one entry cascade?** `blocks: the working-state phase`.
   If I create a property and then set it as the title key, and discard the
   title-key change, what happens to the property? Foundry validates on save, so
   presumably it re-errors — but the dialog offers per-entry discard, not
   per-field, so a partial discard within a resource may not even be expressible.
   Nothing addresses it.

10. **Import: what does `replace or be merged` mean operationally?**
    `blocks: nothing`. Image-only phrase; the prose only describes recreation. Is
    the merge field-wise, resource-wise, or additive-only?

11. **Where does the `+2` on the header `History` control come from?**
    `blocks: nothing`. Visible in `save-button-header.png` beside `History`, with
    `2 edits` shown separately in the same bar. Two different renderings of the
    same count, or two different counts.

12. **Is `Semantic search` an Ontology Manager feature we should know about?**
    `blocks: nothing`. It appears in three cleanup screenshots with a beta flask
    icon and in no sentence in the corpus.

---

## Upstream moved (2026-08-18) — and it corroborates the protection rule

The drift sweep re-mirrored the six pages this reading borrows from. **No
quotation here went stale**, so every sentence it stands on is still current.
`pipeline-builder/branches-propose-a-change` added two things.

The first restates, from the other side, the rule 461-471 built on:

> "The **Resolve changes** action does not work for protected branches. Since **Resolve changes** directly saves changes to the pipeline, and protected branches do not allow direct modifications, you must use the proposal flow to merge changes into a protected branch."

Protection does not merely discourage the direct route — it removes it, and the
proposal flow is what is left. That is the case `branching.test.ts` asserts —
main refuses a placed resource and the approved branch route lands.

The second is a mechanism we do not share, recorded so it is not mistaken for one:

> "When working with multiple long-lived branches — such as staging and deployment branches — using standard merge proposals can cause recurring merge conflicts. This occurs because Pipeline Builder implements merges as squash merge commits, which breaks the shared commit history between branches."

**Squash merges are Pipeline Builder's implementation, not the ontology's.** Our
merge applies an overlay rather than replaying commits, so there is no shared
history to break and no fast-forward escape hatch to build. Recorded because a
later reader finding fast-forward in the docs would otherwise read it as a gap.
