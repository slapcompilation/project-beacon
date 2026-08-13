---
verify: strict
---

# Reading — the Security phase

Pages read in full (13 + the course):
`security/overview`, `security-glossary`, `users-and-groups`,
`restricted-views`, `branching-restricted-views`, `property-security-markings`,
`classification-based-access-controls`, `checking-permissions`,
`emulation-mode`, `protecting-sensitive-data`, `securing-a-data-foundation`,
`securing-a-business-application`; `platform-security-management/`:
`manage-granular-policies`, `manage-restricted-views`, `manage-markings`,
`manage-roles`, `manage-groups`, `manage-users`,
`disabling-ignore-inherited-permissions`, `disabling-propagate-view-requirements`;
plus `docs/foundry-deep-dives/06-security-primitives.md` (the course capture —
its record half; its pre-teardown "Beacon mapping" half is stale and ignored).

Images read closely (22 of the 182 mirrored — the ones claims rest on):
the whole restricted-view wizard (`restricted-views-0..6.png`,
`rv-type-class.png`, `marking_org_policy.png`), the CBAC diagrams
(`classification-example.png`, `file-data-classifications-inheritance.png`,
`file-data-class-screenshot.png`, `project-classification.png`,
`max-class-diagram.png`, `project-max-classification.png`),
`property-security-condensed-pill.png`, `checking-permissions-sidebar.png`,
`checking-permissions-dataset.png`, `access-graph-example.png`,
`emulation-mode-popover.png`, `branching-restricted-views-protected.png`,
`branching-restricted-views-approve-changes.png`,
`platform-security-management/images/markings-9.png`, `markings-11.png`.
The remaining screenshots (management how-to steps, upgrade-assistant flows)
are inventoried, not parsed.

Pages NOT read, deliberately — enterprise/ops concerns with no schema:
audit logs (3), code scanning (2), disaster recovery, phishing/tokens/files
protections (4), SSO, cover pages, download controls, cross-org collaboration,
data-protection-and-governance, shared-responsibility, report-concerns,
requesting-justification, emulation aside the one page,
`manage-orgs-and-spaces` / `manage-project-constraints` /
`manage-project-templates` (their load-bearing halves were read in
`projects-roles-and-portfolios.md` and `spaces-and-the-resource-path.md`).

---

## 1. The model, in the glossary's own words

The whole model is two kinds of control plus a graded ladder:

> "**Mandatory controls:** An all-or-nothing access restriction. With mandatory
> controls in place, regardless of a user's Role, a user cannot access a
> resource in any way unless the user satisfies the resource's mandatory
> controls. These controls take the form of Organizations and Markings."

> "**Discretionary controls:** Expand the overall capabilities a user has on
> top of their access and are granted via Roles. Discretionary controls are
> additive, meaning that discretionary controls can only add permissions for a
> user and cannot restrict permissions for a user."

The course states the precedence outright: "mandatory controls like
Organizations and Markings always take precedence, preventing access for
ineligible users regardless of their assigned role" (deep dive 06). And access
itself is existence: "If a user does not have access, they will not know the
existence of the resource."

Nearly all of this layer is BUILT here already: organizations and markings as
access requirements (397–404), the file/data split, the project role ladder
with the default role as an organization grant (398), marking categories with
visibility and permissions (472), scoped sessions (404), the simulation (480).
This reading is about what is NOT built, and it is three things: **groups**,
**granular policies / restricted views**, and the **per-user access checker**.

## 2. Groups — the missing grant target

From the glossary and `users-and-groups`:

> "**Group:** A set of users and/or other groups. A group may be internal,
> meaning defined in Foundry, or external, meaning defined by an external
> identity provider (like Active Directory) or user manager. Internal groups
> may contain external groups and users."

> "Access to Projects and resources are usually granted to groups rather than
> individual users."

Our `project_role_grants` knows only `user_id`. Every walkthrough in the
section grants roles to *groups* ("The goal is to have three groups per
project, each mapped to a default role"), and `manage-groups` gives the full
management shape: group ID permanent, group types
"external, internal, or rule based", the two admin permissions named
Manage permissions and Manage membership, **membership expiration**
(Latest expiration / Maximum duration, reminder
at seven days), the renaming dance (rename keeps the ID; a NEW group with the
old name is created and the renamed one nested inside), and the warning that
external groups must carry an Organization or "the group will become visible
to all users regardless of their Organization."

## 3. Granular policies and restricted views — the row level

From the glossary and `restricted-views`:

> "**Restricted view:** A special kind of dataset where granular access to the
> data within the file is controlled based on defined rules. These rules are
> based on user attributes and will hide or reveal rows of the dataset based
> on the user's level of access."

> "A restricted view is built on top of a backing dataset and cannot be used
> as an input for transforms."

> "After creation, the restricted view can be used as the backing data source
> for an object type in your Ontology."

The policy grammar (`manage-granular-policies`):

- Terms: **user attributes** (User ID, Username, Group IDs, Group names,
  Authorized group IDs, Organization Marking IDs, Marking IDs, custom
  attributes), **columns**, **specific values** — always by UUID:
  "Specifying names instead of IDs is not supported to prevent
  renaming-related issues."
- Eight comparisons: Equal, Intersects, Subset of, Superset of, and the four
  order comparisons — with "Object security policies do not support
  less/greater than comparison operators."
- Weights: constant-vs-field 1, collection-vs-field 1,000, marking condition
  3,000, "The sum of the weights across all the comparisons in a policy must
  be under 10,000", at most ten comparisons.
- The standing NOT warning, three pages verbatim: "Avoid using NOT conditions
  with group, marking, or organization memberships… These tokens may lack the
  attribute the NOT condition checks against, causing the condition to pass
  and grant more access than intended." (Our scoped sessions have exactly this
  hazard; 404 already recorded it.)
- Evaluation is compilation: "Policies are defined as templates into which
  user attributes, group memberships, and data values can be filled. When the
  consuming application requests data… the template is converted into a query."

The wizard (all seven screenshots, restricted-views-0.png through
restricted-views-6.png): Save as → Compose a granular policy → Review access
requirements → Summary. The policy editor has Edit policy / View policy in
JSON / Test policy tabs (restricted-views-4.png), a Match-any-or-all-of-N
header, nested logical operators, and suggested rule shapes — the user's
Group IDs includes Group IDs; a column equals a specific value; the user's
Markings satisfies a marking-IDs column (marking_org_policy.png). The review
step shows the two-panel access-requirements diff with **Start inheriting** /
stop-inheriting on the marking chip — a restricted view may sever an
inherited marking because "the granular policy already controls which rows a
user can see."

Marking-backed rows are documented as data: "Each cell must contain a STRING
ARRAY of Marking IDs", the column annotated with typeclass
`marking_type.mandatory`, and "You may mix Markings and Organizations in the
same column."

Rules that bound the design: the backing dataset and the view live apart —
"Typically, you will want to save your restricted view in a different Project from the input dataset"
— the view is read-only, because
"restricted views are read-only to protect the schema", there is no batch
processing and no Postgres sync, and
"To use granular policies on dataset-backed objects in Object Explorer, you must have *View ontology data source* permissions on the dataset to see any objects of this type."

Branching: restricted views ride Global Branching — protection ("Branch
protection > Protect with project policy"), per-resource approvals, rebase
with whole-side resolution ("Keep this version" on Base or Comparison, "no way
to resolve diffs at a finer granularity"), and the compare tab diffs **Policy
changes** and **Marking changes** ("Markings severed: No") side by side.
Adding a view to a branch "automatically builds the restricted view on the
branch. If the restricted view backs any object types, those object types are
also automatically re-indexed on the branch."

## 4. Checking permissions and emulation — seeing as another user

`checking-permissions`: the **Check access** panel answers for ANY user, in
two halves that are exactly our 401 split. Access requirements include
"Having one or more roles (directly, via a group, or a default role)"
and Additional data requirements carry the lineage half:
"A dataset that inherits Markings through lineage requires access to those Markings to see the dataset's data."
The screenshot shows the verdict per requirement with
green/red per item, "Viewer (via group)" naming the granting group, and an
**Explore data lineage** hand-off to the Permissions coloring we read in the
lineage phase. The **access graph** draws organizations, projects, groups and
markings as one graph with `Applied` / `Owner` / `Member` edges.

`emulation-mode` [Beta] is the same question asked of yourself: "a scoped
Foundry session that allows you to test platform behavior based on a subset of
your existing groups and markings", entered from the account menu, surfaced as
a banner, and honest about its floor: "Emulation mode does not change your
organizations or user attributes."

## 5. CBAC — recorded, not for us yet

Classification markings are the government tier: "Configuration of
classification markings requires Palantir involvement." Their three specifics:
**hierarchy**, **disjunctive categories** ("When a category is disjunctive, a
user can be authorized to access marked classified data by having any one
marking of that category" — our 472 category_type knows only 'conjunctive'),
and **ubiquity** (every project a classification, every raw dataset a file
classification). File vs data classification mirrors our file/data marking
split, with data classification "formed by combining" the file classification
and "the data classifications of all upstream data dependencies" — never
directly editable. Project classification is NOT inherited along data
dependencies (the max-class diagram states it in bold), and **project maximum
classification** ("allowed marking limit") caps what may live inside, with
violations blocking builds "the same behavior as project constraint
violations."

## 6. What the images add, that the prose does not

- `markings-11.png`: the lineage simulation legend in practice carries a
  FIFTH state — `Unknown (5)` — beside the four the page documents. Our 480
  built the documented four; the fifth is recorded for the surface.
- `markings-9.png`: the settings sidebar has **Row-level policies** as its own
  section beside Markings/Roles/Groups; marking permissions are exactly three
  checkboxes — Manage permissions / Apply marking / Remove marking — matching
  our 399 vocabulary; the category card prints "Conjunctive · And · All
  applied markings will be required."
- `restricted-views-0.png`: a restricted view is its OWN node kind in Data
  Lineage ("Restricted view (1)" in the legend, an orange RESTRICTED VIEW
  banner), and the example object type is fed by the view AND a writeback
  dataset together.
- `branching-restricted-views-protected.png`: the view page carries Edit
  policy / Edit markings / SQL console actions, a branch selector, and its own
  RID; "Type: Restricted view" with exactly one Input.
- `emulation-mode-popover.png`: the emulation banner is ORANGE and headlines
  the classification ceiling — "DATA UP TO MOCK TOP SECRET//MNF (Emulation
  mode)" — mode banners carry their scope in the strip.
- `file-data-class-screenshot.png`: the full requirement conjunction on a
  classified file is Roles AND Project classification AND File classification
  AND Data classification AND Organizations AND File markings AND Additional
  data markings — the sidebar prints every clause.

## Connects to

- **`markings.md` / 399–404**: the mandatory layer is built; this section
  confirms it three more times and adds nothing to change.
- **`projects-roles-and-portfolios.md`**: roles/role-sets management read
  deeper here — operations as the atoms ("Roles are sets of operations"),
  role sets space-scoped with three default contexts (Project, Ontology,
  Marketplace Installation). Our fixed four-role ladder stands; custom roles
  recorded.
- **`object-permissioning.md`**: object security policies are the ontology
  face of the same granular-policy grammar; the restricted view is the
  dataset face. One grammar, two consumers.
- **480's simulation**: `protecting-sensitive-data` is the workflow our
  simulate-then-apply flow implements; its step list matches, and the fifth
  legend state is the one delta.
- **404's scoped sessions**: emulation mode is self-service scoped sessions;
  the NOT-condition hazard is why our policy compiler must never emit NOT
  over membership attributes.
- **Deprecated, never to build**: "Ignore inherited permissions" and
  "Propagate view requirements" — both in planned deprecation with
  migration-to-Markings guides. We inherit the replacement, not the legacy.

## Decisions I had to make (mine, not Palantir's, unless quoted)

1. **The phase is three slices.** S1 groups; S2 granular policies + restricted
   views (the engine and the resource); S3 the checker surfaces (Check
   access + the policy editor with its Test tab). Ordering is dependency:
   policies compare against group IDs, so groups come first.
2. **S1: internal groups only.** `groups` (internal realm; external realms and
   user managers are identity-provider machinery we do not have) +
   `group_members` (user or group, nested per the glossary) +
   `project_role_grants` learns `group_id` (XOR user_id), and `project_role()`
   folds group grants transitively. Membership expiration lands with it —
   `expires_at` honored at evaluation, the two group-level bounds recorded.
3. **S2: one policy grammar, stored as data, compiled to SQL.** The same shape
   as the OE filter grammar: a validator for rules {left: user attribute |
   column, comparison: the eight, right: column | value | collection},
   match any/all with one nesting level, the documented weights enforced
   (1/1,000/3,000, cap 10,000, ten comparisons). The compiler substitutes the
   caller's attributes (user id, username, group ids transitively, marking
   ids, org marking ids — all derivable from our tables) and emits a WHERE
   fragment — "the template is converted into a query" is literally our
   architecture. NOT over membership attributes is refused at validation, on
   the three-page warning; stricter than Foundry's "avoid", marked as ours.
4. **S2: `restricted_views` is its own resource** — input dataset, project
   placement (in line with the save-apart guidance), policy, severed-markings
   list, RID, protection flag riding the 462 machinery. It can back an object
   type: `object_type_datasources` gains a `restricted_view_id` XOR
   `dataset_id`, and `index_object_type` indexes THROUGH the policy — rows
   the policy hides never reach the type's index… **no: the policy is
   per-caller, so it cannot bake into a shared index.** The index stays whole;
   the READ path (indexed_objects, evaluate/count/aggregate/histogram/search)
   applies the compiled policy per caller, which is where our RLS instincts
   and Foundry's "converted into a query" agree. The index tables stay in the
   no-grants schema, so the policy gate is the only door. Marked as the
   phase's central design decision.
5. **S3: the Check access panel** asks for any user what 401 answers for the
   caller: requirements vs additional-data requirements, verdict per clause,
   the granting group named. The policy editor gets the documented three tabs
   with Test-as-user (which is also what emulation mode wants; full emulation
   is deferred — scoped sessions exist and the banner slot exists).
6. **Deferred whole**: CBAC (Palantir-involvement-gated even in Foundry;
   `disjunctive` joins the category vocabulary only when something consumes
   it), external realms / user managers / SSO, audit logs, role
   customization / role sets, marking-backed restricted views' typeclass
   annotation, Marketplace packaging, the two deprecated settings (never), and
   membership-expiration notifications.

## Open questions

1. Restricted-view **builds**: Foundry materializes a view per policy change
   ("a build schedule will be automatically created"); ours evaluates at read
   time, so there is nothing to build — is a per-view freshness/lifecycle
   still wanted for parity, or is read-time evaluation the honest equivalent?
   (I propose read-time; the "cannot be used as an input for transforms" rule
   then holds by construction.)
2. **Authorized group IDs** (the scoped-session attribute) — bind it to our
   scoped sessions now or when a policy first needs it?
3. The fifth simulation legend state (`Unknown`) — which datasets earn it? No
   prose anywhere; screenshot only.

## Built (2026-08-13) — migrations 481–486, PRs #545–#547

All three slices shipped as decided above; read-time evaluation won open
question 1 by construction.

- **S1 (481–482, #545)**: groups, nested members with expiration honored at
  evaluation, the two group-level bounds enforced by trigger, the two
  administrative permissions creator-seeded, group grants folded transitively
  into project_role(). Multipass is the error namespace.
- **S2 (483–485, #546)**: the grammar as jsonb with the eight comparisons,
  the documented weights, the ten-comparison cap and the
  at-least-one-user-attribute floor; NOT refused outright. restricted_views
  with severed markings behind the remove permission. The compiler emits the
  caller's attributes as function calls; the index stays whole and
  object_set_where carries the gate for every reader; indexed_objects and
  quicksearch take it directly. Restricted-view-backed types are excluded
  from OpenSearch scope AND their documents never leave Postgres.
- **S3 (486, #547)**: check_access with the panel's two halves, the granting
  group named in the role clause; test_restricted_view answers as a named
  user through the same compiled predicate via an exception-safe claims swap.
  Surfaces: CheckAccessPanel on the dataset page, PolicyEditorDialog with the
  three documented tabs.

Recorded narrowings and follow-ups, all marked ours:

- `authorized_group_ids` and `organization_marking_ids` compile fail-closed
  (empty) until scoped sessions bind the former and organizations are backed
  by markings for the latter — an absent attribute must grant nothing.
- A restricted view backs an object type alone; mixing with an open
  datasource is refused (merged index rows cannot be re-attributed).
- The policy composer builds flat rule lists; the grammar and validator
  accept one nested group, and the JSON tab shows whatever is stored.
- Who may open Check access / Test policy (org admin or project Owner) is our
  gate; the page shows the panel, not its opening permission.
- `marking_permissions` still takes user principals only — groups exist now
  (481), so the 399 comment about a future principal ref is actionable.
- The user registry (public.users) holds owner/admin rows only; group
  members and grant pickers list those until it widens into the full
  manage-users shape. The dead `user_org_memberships` read it replaced was a
  teardown zombie that left every picker empty.
- The access graph, emulation mode, and Data Lineage permissions coloring
  from checking-permissions remain unbuilt, recorded in section 6.
