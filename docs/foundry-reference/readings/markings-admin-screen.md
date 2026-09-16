---
verify: strict
---

# Markings, the second pass — the admin screen and the wire model

**This does not replace `docs/foundry-reference/readings/markings.md`, and must
not be read as superseding it.** That reading is the one the engine was built
from — migrations 399–404, the divergences, the decisions already taken — and
it read two pages and four captures closely. This is a second pass over the
whole corpus: 43 pages and 35 captures, aimed at the two things that reading
did not cover, because nothing needed them yet: **the administration screen**
and **the published wire model**. Where the two overlap, that reading has
priority on the concept and this one on the shape; where they disagree, the
disagreement is named here rather than quietly resolved.

One such check, run deliberately because it is the trap of this subject: that
reading says "The prose lists four; `markings-9.png` shows the dropdown, which
offers **three**", and §4 below reaches the same split from the published enum.
**It was right in 2026-08 and this pass confirms it** — which is worth stating,
because my first reader in this pass got it wrong and filed `Members` as a
fourth role.

**Pages read in full: 43.** Thirteen prose pages —
`platform-security-management/manage-markings`, `platform-security-management/_index`,
`platform-security-management/manage-restricted-views`,
`platform-security-management/manage-granular-policies`, `security/markings`,
`security/protecting-sensitive-data`, `security/access-control-propagation`,
`security/security-glossary`, `security/checking-permissions`,
`security/property-security-markings`,
`security/classification-based-access-controls`, `security/restricted-views`,
`security/branching-restricted-views` — and the thirty API
pages under `api/v2/admin-v2-resources/` that publish markings as a wire type.

**Captures, counted: these pages reference 84 and I opened 35.** Every one of
the other forty-nine is named below, because a coverage claim here is
falsifiable and mine have been false before.

*Opened (35):* `manage-markings.png`, `markings-0.png`, `markings-1.png`,
`markings-4.png`, `markings-5.png`, `markings-6.png`, `markings-7.png`,
`markings-8.png`, `markings-9.png`, `markings-10.png`, `create_marking.png`,
`file_hierarchy_marking.png`, `file_hierarchy_marking_message.png`,
`data_dependecies_message.png`, `marking-file-inheritance.png`,
`marking_org_policy.png`, `markings-dataset.png`, `markings-project.png`,
`markings-data-missing.png`, `file-data-class-screenshot.png`,
`checking-permissions-dataset.png`, `checking-permissions-sidebar.png`,
`protect-sensitive-data0.png`, `protect-sensitive-data1.png`,
`protect-sensitive-data4.png`, `property-security-condensed-pill.png`,
`property-security-object-property-list-widget.png`, `restricted-views-1.png`,
`restricted-views-2.png`, `restricted-views-3.png`, `restricted-views-4.png`,
`restricted-views-5.png`, `restricted-views-6.png`, `rv-type-class.png`,
`scoped_session_login_example.png`.

*Named and not opened (49), with the reason grouped:* the branching-approval
set, which is a workflow we do not have —
`branching-restricted-views-approve-changes.png`,
`branching-restricted-views-approved-changes.png`,
`branching-restricted-views-manage-approvals.png`,
`branching-restricted-views-protected.png`,
`branching-restricted-views-rebase-in-progress.png`,
`branching-restricted-views-rebase-required.png`,
`branching-restricted-views-save-to-new-branch.png`, `restricted-views-0.png`;
the Data Lineage security-simulation set, which is a different application —
`checking-permissions-data-lineage-access-information.png`,
`checking-permissions-data-lineage-data-mode.png`,
`checking-permissions-data-lineage-example-1.png`,
`checking-permissions-data-lineage-example-2.png`,
`checking-permissions-data-lineage-resource-mode.png`, `data_lineage_expand.png`,
`data_lineage_legend.png`, `data_lineage_marking.png`, `access-graph-entry.png`,
`access-graph-example.png`; the transaction-comparison set —
`comparing_marking_added.png`, `comparing_marking_removed.png`,
`comparing_transactions.png`; the scoped-session set, read elsewhere —
`change_scoped_session.png`, `no_scoped_session_example.png`,
`scoped_session_banner.png`; the classification set, which is CBAC and gated on
a category type we do not build — `classification-example.png`,
`max-class-diagram.png`, `project-classification.png`,
`project-max-classification.png`, `file-data-classifications-inheritance.png`;
the property-marking variants — `property-security-marking-array.png`,
`property-security-marking-struct.png`,
`property-security-marking-derived-property.png`,
`property-security-object-table.png`, `show-security-icon-in-widgets.png`; the
orgs-and-spaces captures that belong to `_index.md`'s real subject rather than
to markings — `control-panel-create-space.png`, `manage-organizations.png`,
`space-inheritance-role-grants.png`, `space-permissions.png`,
`space-settings.png`; and the remainder — `markings-2.png`, `markings-3.png`,
`markings-11.png`, `markings-12.png`, `markings-13.png`, `markings-folder.png`,
`file_hierarchy_folder.png`, `protect-sensitive-data2.png`,
`protect-sensitive-data3.png`, `checking-permissions-workshop.png`.

**The thirty API pages carry no images at all** — measured, not assumed: there
is no `images/` directory under `api/` and no line in any of them references
one.

**Method.** Four readers, one per slice, each re-read by a second pass whose
only job was to overturn it. The refutations mattered: an invented UI control,
a scale artifact presented as an era difference, a false "not scoped to the
category" claim, a false "capture is cut off" claim, a sixth enum the first
pass declared did not exist, and a schema claim that was wrong by a factor of
fifty-three. Each is corrected in place below and attributed to the pass that
caught it. Separately, I re-verified all 149 quotations mechanically against
the whitespace-collapsed source of the page each was filed under: **148 of 149
traced**, and the one that did not is the same splice the refuter found.

---

## 1. What a marking is

> "**Markings** provide an additional level of access control for files, folders, and Projects within Foundry. Markings define eligibility criteria that restrict visibility and actions to users who meet those criteria."
— security/markings.md

> "Access to a Marking is binary (all-or-nothing). Regardless of [role](/docs/foundry/security/projects-and-roles/#roles), a user cannot access a file in any way unless the user satisfies all Marking requirements."
— security/markings.md

> "A user must be a member of all the Markings on a file, folder, or Project in order to have access, since Markings are conjunctive (boolean `AND`)."
— security/markings.md

> "Markings are a mandatory control, while roles are a discretionary control. Mandatory controls *restrict* access by requiring a user to have a particular Marking in order to access data."
— security/markings.md

> "Mandatory controls are enforced by the platform regardless of any user's role or any application's logic."
— security/access-control-propagation.md

**The line that decides what a marking is for**, and the one most likely to be
got backwards:

> "Markings are designed to *restrict* access to resources like files, folders, and Projects. Markings should not be used to *provision* access."
— security/markings.md

A marking never grants. It only ever subtracts. That is why membership in one
is not access to anything:

> "Markings are granted globally to users. When a user is granted a Marking, the user is globally entitled to view the type of content restricted by that Marking. However, having access to a Marking does not mean that the user can view all content with that Marking; the user must still have permissions through their role."
— platform-security-management/manage-markings.md

## 2. The category, and the two things it decides

> "We need to create a marking category, which is a name for a set of markings."
— security/protecting-sensitive-data.md

A category decides **visibility** and, for classification categories, the
**combinator**:

> "Visibility is defined for a category and all of its Markings together; it cannot be assigned on a per-Marking basis."
— platform-security-management/manage-markings.md

> "In most cases, the names and descriptions of Markings and categories are not sensitive information and should be visible even to users who do not have Marking access. This behavior is determined by the category visibility, which is `Visible` by default."
— platform-security-management/manage-markings.md

> "If a Marking category visibility is `Hidden`, the existence of this category and its Markings is considered sensitive information."
— platform-security-management/manage-markings.md

> "A Marking category can be restricted to a single Organization to ensure that it is never visible to users outside of that Organization."
— platform-security-management/manage-markings.md

There is one exception, and it is the category we actually have:

> "Marking visibility is assigned on a per-category basis, with the exception of the Organization category. Individual Organizations each have their own visibility settings."
— platform-security-management/manage-markings.md

**Disjunction lives on the category, and only for classifications:**

> "A defining feature of classification marking categories is that they can support disjunctive (`OR`) behavior. When a category is conjunctive (`AND`), a user must have access to all classification markings used from that category to access the classified data."
— security/classification-based-access-controls.md

## 3. Nothing here can be deleted, and the screen says so twice

> "Once created, marking categories cannot be deleted."
— platform-security-management/manage-markings.md

> "Once created, markings cannot be deleted or moved to a different category."
— platform-security-management/manage-markings.md

Both sentences are printed by the page **and** rendered as amber warning
callouts inside the two creation dialogs (`markings-6.png`,
`create_marking.png`) — the same string in both places. The wire model agrees
by omission: across all thirty API pages there is **no DELETE endpoint for a
marking or a category**, proved by grepping every verb line in the entire `api/`
mirror, not inferred from these two pages. `PUT` exists and is narrow —
`ReplaceMarkingRequest` is `name` plus optional `description`, and
`ReplaceMarkingCategoryRequest` is `name` plus `description`. **A category's
type, its visibility and its organization cannot be changed after creation
either.**

## 4. Four vocabularies for three permissions, which is the live trap

CLAUDE.md names two vocabularies for one idea as the recurring trap here. This
subject has **four**, and they are not interchangeable.

The screen's own bullets, which are what the role popover renders:

> "**Manage permissions:** Users who can grant permissions to manage this Marking, its members, and its metadata."
— platform-security-management/manage-markings.md

> "**Apply marking:** Users who can apply this Marking to Projects and resources. This permission only grants the ability to apply a Marking and does not grant membership of a Marking."
— platform-security-management/manage-markings.md

> "**Remove marking:** Users who can remove this Marking from Projects and resources. To remove a Marking, a user must also be able to apply the Marking."
— platform-security-management/manage-markings.md

The API's enum for the same three: `ADMINISTER`, `DECLASSIFY`, `USE` —
published verbatim as `one of` on four pages, three members, counted.

The same page's *prose* naming two of them a third way:

> "You can then assign **Marking Administrators** and **Marking Removers**."
— platform-security-management/manage-markings.md

And a fourth name for removal, on a different page, which is the one that
matters most because it is stated as the *requirement*:

> "The Expand Access permission on the Marking itself, a centrally managed permission, is required to remove a Marking."
— security/markings.md

> "**Expand access:** Expand access refers to any change in the access requirements on a resource such that the audience that can potentially access that resource is expanded. In the case of Markings, the removal of any Marking is an expand access event."
— security/security-glossary.md

**`Members` is not one of the three.** The screen lists it beside them and the
API does not, because it is a different relation entirely — its own endpoint
family (`markingMembers/add`, `/remove`, list) and its own type
(`MarkingMember` is `principalType` + `principalId`, with no role):

> "**Members:** Users who can see resources and Projects protected by this Marking."
— platform-security-management/manage-markings.md

> "All the permissions above are distinct and do not automatically provide users with membership permissions."
— platform-security-management/manage-markings.md

The Organization category names the same two operations differently again, on
its own page — which is the fifth and sixth spelling, and the reason §4 is a
trap rather than a footnote:

> "**Apply organization:** Allows a user to add this organization to resources."
— platform-security-management/_index.md

> "**Expand access:** Allows a user to expand access to resources by adding other organizations or removing this organization."
— platform-security-management/_index.md

*Correction, from the second pass:* the first read filed "marking permissions"
as a **four**-member set including `Members`. The published wire enum is three,
and `Members` is not one of them. Building a four-valued role column would
encode a category error that the API refuses.

## 5. Applying one takes two permissions, and removing it takes three

> "1. You have the “Apply marking” permission on the Marking."
— platform-security-management/manage-markings.md

> "2. You have the “Update Markings on resource” permission, which is included in the Owner role by default."
— platform-security-management/manage-markings.md

Removal needs both of those *and* apply:

> "To remove a Marking, a user must also be able to apply the Marking."
— platform-security-management/manage-markings.md

And the page is explicit that a resource role is not enough on its own:

> "For example, even if a user has the Owner role on a dataset that is marked with the `PII` marking, their Owner role does not allow them to remove the marking without also having the marking’s Expand Access permission."
— security/markings.md

> "Users cannot grant access to Markings to other users unless they have additional administrative permissions on the Marking."
— platform-security-management/manage-markings.md

> "If Marking permissions are granted to a group, then a new user to the group will inherit those permissions."
— platform-security-management/manage-markings.md

## 6. Inheritance, and why applying one is described as dangerous

> "Markings are **inherited** along both the file hierarchy and direct dependencies and propagate through transform and analysis logic. All resources derived from a marked file, folder, or Project will assume a Marking unless the Marking is explicitly removed."
— security/markings.md

> "If a dataset has a file Marking, every dataset that depends on it inherits that Marking and the inherited Marking is known as a data marking."
— security/markings.md

> "Applying a Marking is considered a sensitive action, since the Marking will **immediately** be inherited along all file and data dependencies. This could unintentionally lock out other users downstream."
— security/markings.md

> "Applying a Marking is a sensitive operation and can restrict downstream users."
— platform-security-management/manage-markings.md

> "You can activate the simulation mode during this step to see where and how the Marking will propagate."
— platform-security-management/manage-markings.md

The two inheritance routes are distinguished **in the UI by a sidecar icon**,
and the page says which is which:

> "A marking inherited along the file hierarchy is indicated by a folder sidecar icon."
— platform-security-management/manage-markings.md

> "A marking inherited along a data dependency is indicated by a data lineage sidecar icon."
— platform-security-management/manage-markings.md

Severance is possible in exactly one direction:

> "You can only remove inherited Markings from Restricted Views and datasets."
— platform-security-management/manage-markings.md

> "To remove an inherited Marking from a Restricted View, edit the Restricted Views and click **Stop Propagating** next to the appropriate Marking."
— platform-security-management/manage-markings.md

And the consequence of *not* meeting a data requirement is a partial state the
UI has to render:

> "Note that a user may fulfill file access requirements without meeting the data access requirements inherited from upstream datasets. In this scenario, the user can detect the presence of the derived dataset and view the file metadata, but cannot access the data within the file dataset"
— security/markings.md

> "A dataset that inherits Markings through lineage requires access to those Markings to see the dataset's data."
— security/checking-permissions.md

## 7. The screen, which is what we do not have

> "Markings are managed in the Foundry Settings under the Markings section. Markings are then applied on resources across the platform."
— platform-security-management/manage-markings.md

> "Administrative users can create Markings and Marking categories and control their metadata, visibility, and membership. Access to the Marking section of the Platform Settings requires special platform permissions."
— platform-security-management/manage-markings.md

**Shape, read off the captures.** One bordered card under an `H1
Manage markings` with the subtitle `Create, edit, and organize security
markings.` and a single search input pinned top-right, placeholder
`Filter markings…`. The card is a **drill-down**, not a fixed grid: the column
set *changes* as panes open —

| state | columns |
|---|---|
| nothing selected | Categories │ marking table |
| a category selected | Category details │ marking table |
| a marking selected | Category details │ marking table │ Marking details |
| a `Manage` link clicked | the fourth column is replaced in place by the editor |

*Correction, from the second pass:* the first read described the marking table
as "always present" with three columns, and a build that renders three columns
unconditionally would be wrong — the set collapses as panes open. It also said
the table is **not** scoped to the selected category; re-opening `markings-5.png`
and `markings-10.png` shows every listed marking belongs to the selected
category. **The table is scoped.**

The **Categories column** is a flat list of names with a right chevron and one
full-width primary button pinned at the bottom, `+ New marking category`.
Selecting a row replaces the column with **Category details**: the name and an
inline description (placeholder `Add description…`), `Created … by …`,
`Category type` showing `Conjunctive` with the helper `All applied markings
will be required.`, `Category visibility` (`Visible` / `Visible to everyone.`),
`Organization`, and `Category permissions` with a `Manage` link and a row of
initial avatars where a group renders as a two-person glyph. Its footer button
is `+ New marking…` — **so a marking cannot be created without a category
selected**, which is the UI enforcing the same thing the schema should.

The **Marking details** pane carries the name, description, `Marking ID` as a
raw UUID with a copy icon, `Created`, and three `Manage` links —
`Marking permissions`, `Members`, `Apply marking` — each above a read-only row
of avatars. The **role editor** those links open is one control: a search field
`Add a user or group…` that both adds and filters, then one row per principal
with a dropdown whose popover holds `<n> roles selected`, a danger-red
`Remove all`, and **three checkboxes** — `Manage permissions`, `Apply marking`,
`Remove marking`. **Members is a separate panel** with a different shape: a
`View all marking members` switch, the same add/search field, and a checkbox
per principal. They are not the same control and must not be built as one.

*Corrections, from the second pass:* the `Category type` control in the New
marking category dialog is **not a switch** — it is the same static
two-interlocking-rings glyph rendered in the details pane, confirmed by
cropping and upscaling `markings-6.png` 4×. The first read listed a switch as
fact, which would have produced a toggle Foundry does not have and which the
published enum (`CONJUNCTIVE | DISJUNCTIVE`) could not drive anyway. Both
dialogs are **≈500px wide — Blueprint's default `Dialog`** — not the 340px the
first read reported, which blended two capture scales. And `markings-8.png` is
**not** cut off: the `Apply marking` section is complete, so the open question
built on that supposed truncation is void.

**Three eras are in the mirror, not two**, which matters because CLAUDE.md
makes era-dating a precondition of measuring. Era A (`markings-4/5/7`) has
`Authorized apps` in the nav and a two-column marking table; Era B
(`manage-markings.png`, `markings-8/9/10`) adds `Date created` and
`Third-party applications`; Era C (`markings-6.png`) has a left icon rail and
`Resource usage` and drops three nav entries. **Calibrate to Era B.**

*Correction, from the second pass:* the first read concluded Era A and Era B
"disagree on row pitch" from 36px against 40px and told the build to follow
Era B. Both numbers are real but the captures are at different scales, so the
difference is **a scale artifact, not an era difference** — CLAUDE.md's named
calibration failure, run backwards. Take Era B for its *content* (the third
column), not because its rows are taller.

## 8. Where a marking surfaces on a resource

The only captured place a marking is applied is the resource's **Access >
Requirements** panel: a stack of bordered blocks separated by the literal word
`AND`, each titled with its combinator — `Organizations · Any of`,
`File markings · All of`, `Additional data markings · All of` — over the
sentence `Users must meet all of the following requirements to access this
file`. The affordance is `Add ›` when there are no file markings and `Manage ›`
when there are. A chip reads `Category: Marking` (`Information: PII`), with the
sidecar icon of §6 and a hover tooltip naming the inheritance route.

> "You can view a file's marking by selecting it to open the right-side detail pane, and looking under the **Access requirements > Markings** section."
— platform-security-management/manage-markings.md

> "The **Check access** panel can be used to confirm if a user meets the access requirement for the Project, folder, or file."
— security/checking-permissions.md

## 8b. The adjacent controls, read and not built

Three pages were read because a marking reaches them, and each settles one
boundary. None is built in this pass.

> "Granular policies allow you to configure row-level security for datasets and objects. They are used by [restricted views](/docs/foundry/security/restricted-views/) and [object security policies](/docs/foundry/object-permissioning/object-security-policies/) to determine which specific rows or object instances a user has permission to access."
— platform-security-management/manage-granular-policies.md

A granular policy is the **discretionary** twin of a marking, and the pages are
explicit that swapping one for the other loses propagation:

> "A marking on the resource provides a propagating mandatory control. A granular policy on a restricted view provides a non-propagating discretionary filter. Removing the marking trades a control that travels through derivation for one that does not."
— security/access-control-propagation.md

> "Restricted views limit dataset access to only the rows that a user has permission to see. A restricted view is built on top of a backing dataset and cannot be used as an input for [transforms](/docs/foundry/data-integration/data-pipeline/) or other batch derivation jobs that produce new datasets."
— security/restricted-views.md

And the boundary of that filter is stated plainly, which is the half most
likely to be assumed rather than read:

> "The restricted view policy filters what a user can read. It does not extend to functions, actions, AIP Logic, OSDK responses, writeback operations, or exports."
— security/restricted-views.md

> "To create and edit restricted views, you must meet the following criteria granted within the Granular Permissions Administration workflow in the Roles interface."
— platform-security-management/manage-restricted-views.md

And a marking can sit on a **property**, not only a resource — which is a
different surface again, in Workshop rather than in Settings:

And a restricted view's policy can be developed on a branch, which is the
approval workflow §7's skipped captures show and we do not have:

> "[Restricted views](/docs/foundry/security/restricted-views/) integrate with Global Branching to enable safe, isolated development of granular permissioning policies."
— security/branching-restricted-views.md

> "Property security markings display the markings and CBAC values configured through [object and property security policies](/docs/foundry/object-permissioning/object-security-policies/) when you view or select a property in the following [Workshop](/docs/foundry/workshop/overview/) widgets:"
— security/property-security-markings.md

## 9. The wire model

Thirty pages, five enums, eighteen endpoints, thirty error codes, no images.

| type | shape |
|---|---|
| `Marking` | 7 fields — `id`, `categoryId`, `name` required; `description`, `organization` optional |
| `MarkingCategory` | 8 fields — adds `categoryType`, `markingType`, and a **required** `description` (optional on `Marking`; the two differ) |
| `MarkingMember` | `principalType` + `principalId`. **No role, no grantedAt, no grantedBy** |
| `MarkingRoleAssignment` | `principalType` + `principalId` + `role` |
| `MarkingRoleUpdate` | the WRITE shape — `role` + `principalId`, **dropping `principalType`** |
| `MarkingCategoryRoleAssignment` | `role` + `principalId` |
| `CbacMarkingRestrictions` | `disallowedMarkings`, `impliedMarkings`, `requiredMarkings` (a list of lists) |

**The five enums, each complete and counted on the page:** `MarkingRole` =
`ADMINISTER, DECLASSIFY, USE` (3); `MarkingCategoryRole` = `ADMINISTER, VIEW`
(2); `MarkingCategoryType` = `CONJUNCTIVE, DISJUNCTIVE` (2); `MarkingType` =
`MANDATORY, CBAC` (2); `PrincipalType` = `USER, GROUP` (2).

*Correction, from the second pass:* there is a **sixth**, which the first read
explicitly denied — `displayType` = `BANNER_LINE, PORTION_MARKING`, on
`cbac-banners-get-cbac-banner.md`. A flat there-is-no-sixth-enum claim
is the kind of claim that is only ever worth making after the sweep that
proves it, and that sweep had been scoped to a filename pattern that missed the
banner pages.

Two more facts a build needs: category creation carries a **required**
`isPublic` boolean inside `initialPermissions` — visibility is **not** a
two-valued string on the wire — and creating a marking requires at least one
`ADMINISTER` assignment (`CreateMarkingMissingInitialAdminRole`).

Bounds: `Maximum page size 100.` on both list endpoints, and the member and
role-assignment lists *ignore* `pageSize` outright.

## 10. Against our schema

Every figure here was re-run against `information_schema`, `pg_proc`,
`pg_constraint` and `pg_policies` on 2026-09-16.

**The engine is almost entirely built and nothing reaches it.** A grep of
`apps/web/src` for `marking_permissions`, `marking_members`,
`markingPermissions` or `markingMembers` returns **zero hits**. There is no
Markings section on the Settings page, which renders six sections and none of
them this.

| Foundry | ours | verdict |
|---|---|---|
| category type `CONJUNCTIVE \| DISJUNCTIVE` | `marking_categories_category_type_check`, 2 members, **with** a `Values from …` COMMENT | we-have-it |
| marking roles `ADMINISTER \| DECLASSIFY \| USE` | `marking_permissions_permission_check`, 3 members, **no declaring COMMENT** | we-differ (undeclared) |
| category roles `ADMINISTER \| VIEW` | `marking_category_permissions.role` CHECK | we-have-it |
| `markingType` `MANDATORY \| CBAC` | nothing | we-lack-it |
| `isPublic` boolean | a two-valued visibility string | we-differ |
| membership is a bare principal list | `marking_members`, 0 rows | engine-without-surface |
| the whole admin screen | nothing | **engine-without-surface** |
| no DELETE for a marking | `guard_marking_immutability` | we-have-it |

*Corrections, from the second pass, so none is re-litigated:* the claim that
**all 53 of our markings are organization markings is false — it is 1 of 53**,
and it was load-bearing for an argument that every marking we have takes a
different permission model. `simulate_marking_changes` **does** have a surface
(`features/lineage/api.ts`), and the sidecar inheritance glyph **is** rendered
(`DatasetPage.tsx`) — both were filed as engine-without-surface and neither is.
Nine RLS policies routing category visibility are **seven**. `SettingsPage`
renders **six** sections, not five.

**Three findings worth acting on, in order:**

1. **`resource_markings` was open on UPDATE** — RLS `FOR ALL USING (true)`, a
   guard trigger that is `BEFORE INSERT OR DELETE` only, and every identifying
   column updatable. One statement removed a marking without the remove
   permission and applied another without the apply permission. **Closed by
   807**; the sweep for the same shape returns exactly one table.
2. **A monitoring view can inherit a marking but cannot carry one.**
   `effective_file_markings` handles `p_kind = 'monitoring_view'` in its chain
   and project branches — and those **do** execute, so inheritance works — while
   `resource_markings_resource_kind_check` admits only
   `project | dataset | folder | restricted_view`, so the *direct-application*
   clause can never match for that kind. (I first wrote this up as "an arm that
   can never execute", which is wrong and is corrected here: three quarters of
   the function's monitoring-view handling is live.)

   **This is a divergence, not a bug, and it runs in the direction CLAUDE.md
   cares about: we are STRICTER than Foundry.** `DATA_HEALTH_MONITORING_VIEW` is
   one of the 85 published `Resource` kinds and `addMarkings` takes any
   `resourceRid`, so Foundry lets a monitoring view be marked directly.
   Widening our CHECK is not a one-line change: `guard_marking_application`'s
   final `ELSE` resolves ownership through `datasets`, so a monitoring view
   would find no row, `owns` would be false, and every non-admin would be
   refused — a capability that looks present and is not. **Deferred rather than
   half-built**, and scoped here: nothing in the product applies a marking to a
   monitoring view, and the day something does, the guard gets its branch in the
   same migration as the CHECK.
3. **`can_see_marking_category` was wider than the page** — it admitted any
   `holds_marking_permission`, which includes `apply`, where the page grants
   implicit viewership to *administrator* and *remover* only. On a visibility
   rule, wider is the direction that leaks, and seven RLS policies route through
   it. **Closed by 808**, which proves the hole existed before the patch as well
   as that it is shut after.

## Connects to

- `docs/foundry-reference/readings/access-model-and-permission-vocabulary.md` —
  (org AND markings) AND (≥1 role); §1 and §5 are its mandatory half.
- `docs/foundry-reference/readings/compass-filesystem-api.md` — the same
  conjunctive/disjunctive sentence, published as a wire type.
- `docs/foundry-reference/readings/organization-permissions.md` — `_index.md`'s
  `Apply organization` / `Expand access` pair is the Organization category's
  version of §4.
- `supabase/migrations/807_an_applied_marking_is_added_or_removed_never_reassigned.sql`
  — finding 1 above.
- `docs/SURFACE-BUILD-MAP.md` §3.9, which lists Markings as the largest
  engine-without-surface in the repo. This reading is its source.

## Decisions (2026-09-16 — NOT YET READ BY A HUMAN)

1. **The screen is `/settings/markings`**, a drill-down card whose column set
   changes with depth (§7) — not a fixed three-column grid, which the first
   read would have produced.
2. **The role editor renders the screen's three labels**, `Manage permissions`
   / `Apply marking` / `Remove marking`, over a column holding the API's
   `ADMINISTER | DECLASSIFY | USE`. Our `marking_permissions` CHECK already has
   three members; **it gains the `Values from …` COMMENT it never declared**,
   which is a migration.
3. **`Members` is built as a separate panel**, because it is a separate
   relation with no role (§4). Four-valued role columns are refused.
4. **Neither dialog offers a delete, anywhere**, and both carry the amber
   callout verbatim (§3). Nothing renders an edit for a category's type,
   visibility or organization after creation, because `Replace` cannot change
   them.
5. **`Category type` renders as the static two-ring glyph, not a switch** —
   the second pass's correction, and the reason to re-read a capture before
   building a control off it.
6. **Calibrate to Era B for content, not for pitch** (§7). The pitch difference
   is a scale artifact.
7. **`markingType` (`MANDATORY | CBAC`) is not built in this pass**, and CBAC
   with it: disjunctive categories, classification parsing, banners and the
   sixth enum are a second arc. Recorded, not invented.
8. **Findings 2 and 3 of §10 are corrected forward in their own migration**,
   not folded into the screen's.

## Questions

1. **What does `View all marking members` toggle?** Not captured. The API's
   `transitive` parameter — members of groups within groups — is the likeliest
   meaning, and that is inference from a different page, not from the screen.
2. **What does the category role dropdown contain?** The only capture of it is
   truncated to `Manage permissi…` and clips with an ellipsis, so the popover is
   unrecoverable. The API says `ADMINISTER | VIEW`; the prose says
   `Category Administrators` / `Category Viewers`; the control says neither.
3. **Is `Expand access` the same permission as `Remove marking`?** §4 has four
   names for three permissions and this is the pair I cannot collapse with
   evidence. The Organization category has a permission literally called
   `Expand access`, which suggests they are the same idea at two scopes — but
   suggests is not says.
4. **What is the empty state of either editor?** No capture I opened shows a
   marking with zero principals.
5. **Why is `description` required on a category and optional on a marking?**
   Published, consistent across all four category pages, unexplained.
