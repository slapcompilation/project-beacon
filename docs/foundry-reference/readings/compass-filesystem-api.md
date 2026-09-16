---
verify: strict
---

# Compass as a wire model: the filesystem v2 API

**Pages read in full: 41**, the whole of
`docs/foundry-reference/mirror/api/v2/filesystem-v2-resources/`, which is
exactly 41 `.md` files: `_index`, 13 `resources-*` (with `resources.md`), 6
`folders-*`, 3 `spaces-*`, 8 `projects-*`, 5 `resource-roles-*` and 5
`project-resource-references-*`. Read in four slices — Resource, Folder/Space,
Project, roles-and-references — each slice re-read by a second pass whose only
job was to overturn the first. **Fourteen of its claims were overturned and are
corrected below; the corrections are named, not smoothed over.**

**Images, counted: 0.** `grep -c "images/"` across all 41 files returns zero on
every one, and there is no `images/` directory anywhere under `api/`. So this
reading has no "what the images add" section and the absence is measured rather
than assumed — for an `api/` section that is the normal state, and it is why
CLAUDE.md files these pages under *under-read* rather than unmirrored. What
replaces that section is the one headed **What the API settles that the prose
does not**,
below.

**This section is cited by no reading in this repository before this one**, and
it is the wire form of the model `docs/foundry-reference/readings/compass-files-and-projects.md`,
`docs/foundry-reference/readings/organization-permissions.md` and `docs/foundry-reference/readings/portfolios-and-space-roles.md`
each read from the prose side.

---

## 1. There is one resource type, and its `type` is derived, not stored

> "A Foundry filesystem resource. This includes resources such as datasets, Workshop modules and Slate applications along with folders and Projects."
— api/v2/filesystem-v2-resources/resources-resource-basics.md

`Resource` is a single published object with **14 fields**, not a family of
per-kind types. Its discriminator:

> "The type of the resource derived from the Resource Identifier (RID)."
— api/v2/filesystem-v2-resources/resources-get-resource.md

**That sentence is the whole design.** The type is a *projection of the RID*,
not an independent column that could disagree with it. Our `rid_of(service,
type, id)` already encodes the type into the RID, so the derivation direction
matches; what we do not have is the reverse map, and §10 records that.

The enum has **85 members**, counted mechanically on each of the four pages that
publish it (`resources-get-resource.md`, `resources-get-resources-batch.md`,
`resources-get-by-path.md`, `resources-get-by-path-resources-batch.md`) — 85
tokens, 85 distinct, identical on all four. It runs `AIP_PROFILE`,
`AIP_AGENTS_AGENT`, `AIP_AGENTS_SESSION`, … `ARTIFACTS_REPOSITORY`,
`BELLASO_CIPHER_CHANNEL`, `BLACKSMITH_DOCUMENT`, `BLOBSTER_ARCHIVE`, and on
through every product Foundry ships.

*Correction, mine:* my first crude grep of this directory reported **88** and I
said so before the second pass ran. 88 counted the three `trashStatus` members
alongside the 85. The published figure is 85.

The other enum in the whole section is that `trashStatus`: `DIRECTLY_TRASHED`,
`ANCESTOR_TRASHED`, `NOT_TRASHED` — three members, on the same four pages, plus
`FOLDER | SPACE | PROJECT` on the Folder pages (§3). There are no others: a
`one of` sweep over all 41 pages returns only these.

## 2. Placement is four RID fields, and each one has an exception clause

> "The full path to the resource, including the resource name itself"
— api/v2/filesystem-v2-resources/resources-get-resource.md

> "The parent folder Resource Identifier (RID). For projects, this will be the Space RID."
— api/v2/filesystem-v2-resources/resources-get-resource.md

> "The Project Resource Identifier (RID) that the resource lives in. If the resource itself is a Project, this value will still be populated with the Project RID."
— api/v2/filesystem-v2-resources/resources-get-resource.md

The Folder view of the same three fields is stricter, and names the root:

> "The parent folder Resource Identifier (RID). For Projects, this will be the Space RID and for Spaces, this value will be the root folder (`ri.compass.main.folder.0`)."
— api/v2/filesystem-v2-resources/folders-get-folder.md

> "The Space Resource Identifier (RID) that the Folder lives in. If the Folder is a Space, this value will be the same as the Folder RID."
— api/v2/filesystem-v2-resources/folders-get-folder.md

> "The Project Resource Identifier (RID) that the Folder lives in. If the Folder is a Space, this value will not be defined."
— api/v2/filesystem-v2-resources/folders-get-folder.md

**Every containment field is self-referential at its own level** — a Project's
`projectRid` is itself, a Space's `spaceRid` is itself, and the chain
terminates at a single literal root folder RID. The hierarchy is one edge
(`parentFolderRid`) with two denormalised ancestors (`projectRid`, `spaceRid`)
carried on every row so that a permission check never has to walk.

One more field carries a caveat that is a performance disclosure, not a
definition:

> "The timestamp that the resource was last modified. For folders, this includes any of its descendants. For top level folders (spaces and projects), this is not updated by child updates for performance reasons."
— api/v2/filesystem-v2-resources/resources-get-resource.md

## 3. Folder, Space and Project are one type with a discriminator

> "A folder can be a regular Folder, a [Project](/docs/foundry/getting-started/projects-and-resources/#projects) or a [Space](/docs/foundry/security/orgs-and-spaces/#spaces)."
— api/v2/filesystem-v2-resources/folders-get-folder.md

> "Folders are used to organize resources within projects to provide further structure and to keep things clean."
— api/v2/filesystem-v2-resources/folders-folder-basics.md

*Correction, from the second pass:* that first sentence is **not** on
`folders-folder-basics.md`, where the first slice filed it. It is published on
`folders-get-folder.md:33`, `folders-create-folder.md:37` and
`folders-get-folders-batch.md:42` — three pages, none of them the basics page.
This is exactly the failure CLAUDE.md calls the most expensive kind: a real
sentence filed under the wrong page.

The endpoints are ordinary, and their one-line summaries are worth carrying
because they bound what the API will do:

> "Creates a new Folder."
— api/v2/filesystem-v2-resources/folders-create-folder.md

> "List all child resources of the Folder."
— api/v2/filesystem-v2-resources/folders-list-children-of-folder.md

**There is no create-Space endpoint and no create-Resource endpoint.** Spaces
can only be listed; a Space is made somewhere this API does not reach. Folders
and Projects are the only two things it creates, and Projects get their own
endpoint rather than a `type: PROJECT` argument to the folder one.

A Space publishes fields no folder has, and three of them decide policy:

> "The list of Organizations that are provisioned access to this Space. In order to access this Space, a user must be a member of at least one of these Organizations."
— api/v2/filesystem-v2-resources/spaces-list-spaces.md

> "By default, this Space will use a Last Out deletion policy, meaning that this Space and its projects will be deleted when the last Organization listed here is deleted."
— api/v2/filesystem-v2-resources/spaces-list-spaces.md

> "The ID of the default Role Set for this Space, which defines the set of roles that Projects in this Space must use."
— api/v2/filesystem-v2-resources/spaces-list-spaces.md

> "Resource usage for projects in this space will accrue to this Usage Account by default."
— api/v2/filesystem-v2-resources/spaces-list-spaces.md

**A Space publishes a `rid`.** Migration `397_a_path_starts_at_the_space.sql`
ends its WHAT-IS-NOT-HERE-on-purpose list with `-- • A RID. No space RID
appears anywhere in the mirror.` That reason has expired:
`spaces-list-spaces.md` publishes `rid` · string · required. It is the same
defect class as the `779` arc — a refusal outliving its reason — and it is
recorded here rather than acted on, because 397 is applied and immutable.

## 4. The trash is a three-operation protocol over a two-state ancestry

> "Move the given resource to the trash. Following this operation, the resource can be restored, using the `restore` operation, or permanently deleted using the `permanentlyDelete` operation."
— api/v2/filesystem-v2-resources/resources-delete-resource.md

> "Restore the given resource and any directly trashed ancestors from the trash. If the resource is not trashed, this operation will be ignored."
— api/v2/filesystem-v2-resources/resources-restore-resource.md

> "Permanently delete the given resource from the trash. If the resource is not directly trashed, a `ResourceNotTrashed` error will be thrown."
— api/v2/filesystem-v2-resources/resources-permanently-delete-resource.md

> "The trash status of the resource. If trashed, this could either be because the resource itself has been trashed or because one of its ancestors has been trashed."
— api/v2/filesystem-v2-resources/resources-get-resource.md

`DIRECTLY_TRASHED` against `ANCESTOR_TRASHED` is **not decoration**: it is the
field `restore` reads and the field `permanentlyDelete` refuses on. A trash
implemented with one boolean cannot express either operation correctly — restore
would resurrect a child whose parent is still in the trash, and permanent
deletion would accept a resource that was never directly trashed.

Three kinds refuse the trash outright, each published as its own error:

> "Spaces cannot be trashed."
— api/v2/filesystem-v2-resources/resources-delete-resource.md

> "Auto-saved resources cannot be trashed."
— api/v2/filesystem-v2-resources/resources-delete-resource.md

> "Hidden resources cannot be trashed."
— api/v2/filesystem-v2-resources/resources-delete-resource.md

## 5. Access requirements, in one sentence

> "Access requirements for a resource are composed of Markings and Organizations. Organizations are disjunctive, while Markings are conjunctive."
— api/v2/filesystem-v2-resources/resources-get-access-requirements.md

> "In order to meet access requirements, users must be a member or guest member of at least one Organization applied to a Project."
— api/v2/filesystem-v2-resources/resources-get-access-requirements.md

> "To access a resource, a user must be a member of all Markings applied to a resource to access it."
— api/v2/filesystem-v2-resources/resources-get-access-requirements.md

> "Every user is a member of only one Organization, but can be a guest member of multiple Organizations."
— api/v2/filesystem-v2-resources/resources-get-access-requirements.md

> "Organizations are inherited via the file hierarchy and direct dependencies."
— api/v2/filesystem-v2-resources/resources-get-access-requirements.md

This is the rule `docs/foundry-reference/readings/access-model-and-permission-vocabulary.md` derived from the prose — (org AND
markings) — published as a type description rather than endpoint prose, which is
why no endpoint-first reading of this API would ever find it. Two details the
prose side never settled:

- **Organizations are applied to a *Project***, and inherited downward. Ours
  hangs `organization_id` on every row independently (`folders`, `datasets`,
  `projects`, `project_resources` each carry one), which can drift from the
  project's own set in a way Foundry's placement cannot.
- **Guest membership satisfies the disjunction.** We have no guest concept.

Both list endpoints mark inheritance per item rather than filtering it out:

> "Boolean flag to indicate if the marking is directly applied to the resource, or if it's applied to a parent resource and inherited by the current resource."
— api/v2/filesystem-v2-resources/resources-get-access-requirements.md

*Correction, from the second pass:* the first slice filed a "directly applied
only" claim on `resources-list-markings-of-resource.md` using a sentence that is
not on that page. The flag above is the published mechanism, and it says the
opposite — inherited entries **are** returned, tagged.

## 6. Roles are named sets, and one principal is everybody

> "Roles are sets of permissions that grant different levels of access to resources."
— api/v2/filesystem-v2-resources/resource-roles-resource-role-basics.md

> "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."
— api/v2/filesystem-v2-resources/resource-roles-add-resource-roles.md

The principal of a role grant is a union, and its third arm has no id at all:

> "A principal representing all users of the platform."
— api/v2/filesystem-v2-resources/resource-roles-add-resource-roles.md

`everyone` is published on all three role endpoints (`add`, `list`, `remove`).
**We have no way to express it** — every grant table here keys on a `user_id` or
a `group_id`, so "everyone" can only be approximated by a group someone must
maintain. This is the third independent witness that **roles are sets, not
ranks** (`project_devops_marketplace` recorded the second).

Whether these endpoints are legal on a given resource is itself a project-level
switch, published three times in this directory:

> "Whether role grants should be allowed on individual resources within the Project. When not specified, defaults to true."
— api/v2/filesystem-v2-resources/projects-create-project.md

> "Whether role grants are allowed on individual resources within the Project."
— api/v2/filesystem-v2-resources/projects-create-project.md

*Correction, from the second pass:* the roles slice missed
`resourceLevelRoleGrantsAllowed` entirely while describing the endpoint family
it gates. It is a request field on create (optional, defaulting true), a
required response field on create and on `projects-get-project.md`, and a
required field on create-from-template. **No column of ours corresponds** — a
`%grants_allowed%` sweep over `information_schema` returns nothing.

## 7. Creating a Project is a contract with eight named refusals

`CreateProjectRequest` requires a `spaceRid`, a `displayName`, a `roleGrants`
map of `RoleId` → list of `PrincipalWithId` (each `{principalId, principalType}`
with `principalType` one of `USER`, `GROUP` — note the **write** path has no
`everyone` arm), `defaultRoles`, `organizationRids`, and the optional
`resourceLevelRoleGrantsAllowed` above.

> "The display name of a resource should not be exactly `.` or `..`, contain a forward slash `/` and must be less than or equal to 700 characters."
— api/v2/filesystem-v2-resources/folders-create-folder.md

> "A role is defined to be owner-like if it has the `compass:edit-project` operation. In the common case of the default role-set, this is just the `compass:manage` role."
— api/v2/filesystem-v2-resources/projects-create-project.md

That second sentence answers what a `roleId` *is*: an identifier whose meaning
is a set of operation strings, checked by operation and not by name. The refusal
it belongs to (`CreateProjectNoOwnerLikeRoleGrant`) means **a project cannot be
created without at least one grant that can edit it** — the API refuses the
orphaned-project state rather than repairing it later.

The organization rules are a hierarchy constraint in both directions:

> "Organizations on a project must also exist on the parent space."
— api/v2/filesystem-v2-resources/projects-add-organizations.md

The remaining published refusals on this path, by name:
`ProjectNameAlreadyExists` (CONFLICT, per space), `InvalidDisplayName`,
`InvalidRoleIds` (the role must be in the space's project role set),
`DefaultRolesNotInSpaceRoleSet`, `InvalidOrganizationHierarchy`,
`OrganizationCannotBeRemoved`, `OrganizationMarkingNotOnSpace`,
`InvalidOrganizations`, `NotAuthorizedToApplyOrganization`. The
create-from-template path adds its own, among them `TemplateGroupNameConflict`
and `MissingVariableValue`.

*Correction, from the second pass:* the projects slice wrote that these error
messages were verbatim one-liners. Four of them — `InvalidDisplayName`,
`InvalidOrganizationHierarchy`, `OrganizationCannotBeRemoved` and `InvalidPath`
in the resources slice — are **hard-wrapped across two lines in the source**.
The gate normalises whitespace across the whole file, so a wrapped sentence
still traces; a line-based `grep` for one does not, which is what produced the
false alarm. Recorded because it will come up again on every `api/` page.

## 8. A reference is an import, and it is named by the importer

> "A [reference](/docs/foundry/security/projects-and-roles/#references) represents a resource from outside of the current project that has been imported to the given project."
— api/v2/filesystem-v2-resources/project-resource-references-project-resource-reference-basics.md

> "The user-provided label for this reference, used to identify the import within the project."
— api/v2/filesystem-v2-resources/project-resource-references-list-project-resource-references.md

`ProjectResourceReference` is a union of an `external` arm and a `filesystem`
arm, each carrying `name`, `importedAt` and `importedBy`. **This is the
mechanism behind the project boundary**: a project is closed, and the only way a
resource from another project enters it is as a named, attributed, timestamped
import. We have no such concept — no table, no column — and `project_resources`
(§10) is a membership list with no import arm at all.

*Correction, from the second pass:* the roles-references slice asserted that
`remove` takes an untagged list of identifiers while `add` takes a tagged union.
`project-resource-references-remove-project-resource-references.md:22` publishes
`resources` · list with **no element type at all**, so the asymmetry is
*unpublished*, not published. It becomes Question 3.

## 9. Paging, batching and scopes

> "This is a paged endpoint. The page size will be limited to 2,000 results per page. If no page size is provided, this page size will also be used as the default."
— api/v2/filesystem-v2-resources/folders-list-children-of-folder.md

> "The maximum batch size for this endpoint is 1000."
— api/v2/filesystem-v2-resources/resources-get-resources-batch.md

> "Returns a map from RID to the corresponding resource. If a resource does not exist, or if it is a root folder or space, its RID will not be included in the map."
— api/v2/filesystem-v2-resources/resources-get-resources-batch.md

**A batch read cannot distinguish "absent" from "forbidden" from "is a space".**
All three produce the same observation: a missing key. Any UI built on this must
render one state for all three, because the API has decided not to leak which.
The single-read endpoint is where the distinction lives, as two errors:

> "Getting the root folder as a resource is not supported."
— api/v2/filesystem-v2-resources/resources-get-resource.md

> "Getting a space as a resource is not supported."
— api/v2/filesystem-v2-resources/resources-get-resource.md

Every endpoint page but one carries the scope sentence:

> "Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-read`."
— api/v2/filesystem-v2-resources/resources-get-resource.md

Path lookup is the one endpoint keyed on something other than a RID, and it is a
**query** parameter, not a path one — `?path=`:

> "The path to the resource. The leading slash is optional."
— api/v2/filesystem-v2-resources/resources-get-by-path.md

## What the API settles that the prose does not

There are no images in this section (measured in the header), so this is the section that does the
work instead. Each of these is settled here and by no prose page we have read:

1. **`type` is derived from the RID** — the prose never says where a resource's
   kind comes from. It is not a column; it is a projection.
2. **One polymorphic `Resource`, 85 kinds.** Not a type per product. This is
   the single most important shape fact in the section, and it is the *opposite*
   of the three-times mistake only because the type carries **no payload** —
   identity and placement only. See §10.
3. **`ri.compass.main.folder.0`** — the root is a literal, published RID.
4. **Trash is three operations over two ancestry states**, with named refusals
   for spaces, auto-saved and hidden resources.
5. **Organizations disjunctive, Markings conjunctive**, in one sentence, with
   guest membership satisfying the former.
6. **Organizations attach to a Project** and inherit, rather than to each row.
7. **`everyone` is a role-grant principal** with no id.
8. **A role is owner-like if it has `compass:edit-project`** — roles are checked
   by operation, not by name or rank.
9. **`resourceLevelRoleGrantsAllowed`** — per-resource grants are a project
   switch that defaults on.
10. **References are named, attributed imports**, which is what makes a project
    a boundary rather than a folder.
11. **2,000-row pages and 1,000-key batches** — real bounds, where the prose
    gives none.
12. **A batch read collapses absent, forbidden and is-a-space into one silence.**

## 10. Against our schema — Compass is an index, and we have one

Everything in this section is verified against `information_schema`, `pg_proc`
and `pg_constraint` on 2026-09-16, and several of the four slices' original
figures were wrong; the corrected numbers are the ones printed.

**The finding that matters: `Resource` carries no payload.** Fourteen fields —
rid, displayName, description, documentation, path, type, createdBy, createdTime,
updatedBy, updatedTime, trashStatus, parentFolderRid, projectRid, spaceRid — and
not one of them is the resource's content. Compass is an **index over things
stored elsewhere**: identity, placement, naming, timestamps, trash. That is
why one table for 85 kinds is not the universal-table mistake CLAUDE.md deleted
three times — `object_records` held *properties*; `Resource` holds a *location*.

**And `project_resources` is already that index, under-scoped.** Its primary key
is `(resource_kind, resource_id)` and its CHECK admits exactly two kinds:

```
project_resources_resource_kind_check = CHECK (resource_kind = ANY (ARRAY['object_type','object_set']))
```

Migration 330 created it with five kinds; `module`, `document` and `user_tool`
were dropped later. So the table is shaped right and scoped to two of our
dozens of resource kinds.

| Foundry publishes | ours | note |
|---|---|---|
| one `Resource` row per filesystem thing | 35 tables carry `rid`; 33 carry `project_id`; 15 carry `folder_id` | placement is spread across the schema instead of indexed once |
| `type` derived from the RID | `rid_of/3`, `rid_of/4`, `rid_display/1`, `rid_locator/1`, `rid_valid/1` | we build RIDs and can extract a uuid from one; **nothing maps a RID back to its row** |
| `path` on every resource | `spaces.path`, `folders.path`; `projects` has none | a project cannot answer "what is your path" |
| `description` + `documentation` | `documentation` exists on `folders` and `portfolios` only | the two-field split is honoured on two tables |
| `updatedBy` / `updatedTime` | `updated_by` on six tables, none of them a filesystem resource | |
| `trashStatus` with two trashed states | `trashed_at` on 15 tables, `trashed_by` on **5** | one boolean-ish timestamp, so §4's protocol cannot be expressed; and ten of the fifteen lose who did it |
| Space has a `rid` | `spaces` has 6 columns and no `rid` | 397's stated reason has expired (§3) |
| `resourceLevelRoleGrantsAllowed` | nothing; no `%grants_allowed%` column exists | |
| `everyone` principal | grants key on `user_id` or `group_id` | inexpressible (§6) |
| references (named imports) | nothing | |
| role sets per space | `space_roles.space_id` is **nullable**, and all three live rows are NULL | so ours is already platform-wide, which is closer to a role *set* than the per-space reading assumed |
| projects created by an endpoint with eight refusals | `provision_personal_project()` is the only function that inserts into `public.projects`; `create_project` exists as a **workflow** in `space_role_workflows` | the capability is modelled; the creation contract is not |

**Seven `resource_kind` CHECKs exist across the schema, carrying three distinct
member sets** — `('object_type','object_set')` on `project_resources`, an
ontology set (`object_type, link_type, shared_property, interface, action_type,
type_group`), and a filesystem set (`project, dataset, folder,
restricted_view`) used by `resource_markings`, `resource_tags` and others. Three
vocabularies for one idea, where Foundry publishes one enum of 85.

*Corrections to the slices' own schema claims, so they are not re-litigated:*
`trashed_by` is on 5 tables, not 15; `project_id` is on 33, not 24; `folder_id`
+ `project_id` columns total 48, not 52; `documentation` is on two tables, not
one; `folders` has 12 columns (the slice named ten, omitting `organization_id`
and `promoted`); `folders.rid` **is** governed — `rid_valid()` exists and
`guard_folder()` runs on the table; `create_space` is
`create_space(p_name text, p_description text DEFAULT ''::text)`;
`space_organizations.organization_id` is `ON DELETE CASCADE` and
`projects.space_id` is `ON DELETE RESTRICT`; and `project_resources` also
carries `organization_id` and `added_at`.

## Connects to

- `docs/foundry-reference/readings/compass-files-and-projects.md` — the screens. **Its Decision 1 is
  revised by this reading**: see Decision 1 below.
- `docs/foundry-reference/readings/access-model-and-permission-vocabulary.md` — (org AND markings) AND (≥1 role), here published
  as one sentence (§5).
- `docs/foundry-reference/readings/organization-permissions.md` — roles bundle workflows; §6 and §7 add
  that a role is identified by the operations it carries.
- `docs/foundry-reference/readings/portfolios-and-space-roles.md` — §3's Space fields (role set, deletion
  policy, usage account) are the four it recorded as unmodelled.
- `supabase/migrations/397_a_path_starts_at_the_space.sql` — its no-space-RID
  reason has expired (§3).
- `supabase/migrations/330_*` — created `project_resources`, the index this
  reading argues is the right shape (§10).

## Decisions (2026-09-16 — NOT YET READ BY A HUMAN)

1. **`compass-files-and-projects.md` Decision 1 is the wrong question, and is
   annotated rather than rewritten.** It asked whether to derive a fifteen-way
   union from `information_schema` or hand-write the branches. Foundry answers
   neither: Compass is an **index** — one row per resource carrying identity and
   placement and no payload — and `project_resources` is that index already,
   scoped to two of our kinds. The Files listing should read the index, and the
   open work is **widening what writes to it**, not choosing a way to derive it.
   The `information_schema` union remains the right *migration path* to populate
   the index, which is why the original decision is annotated, not deleted.
2. **The index gets Foundry's fields, not ours** — `rid`, `type`, `path`,
   `parent_folder_rid`, `project_rid`, `space_rid`, `display_name`,
   `description`, `documentation`, created/updated pairs, trash status. Any
   field that is not identity, placement, naming, timestamp or trash does not
   belong in it, by §10's rule.
3. **Trash becomes two states, not one timestamp**, because `restore` and
   `permanentlyDelete` are undefined without the distinction (§4). This is a
   migration, and it is not taken in this pass.
4. **`type` is derived from the RID, never stored independently** (§1). The
   missing half is a RID→row dispatch, which is the one genuinely absent
   primitive §10 found.
5. **We do not invent `everyone`, guest membership, references, role sets or
   `resourceLevelRoleGrantsAllowed` in this pass.** Each is published, each is
   absent here, and each is recorded in §10 as a gap with its page. Building any
   of them is its own reading.
6. **The 85-member enum is not copied into a CHECK.** Ours would be a CHECK over
   the kinds we actually store; the published 85 is Foundry's product catalogue,
   and adopting it wholesale would put 80 values in a constraint that nothing
   can ever satisfy.
7. **397 is not corrected in this pass.** Its expired reason is recorded in §3
   and in this block; correcting it forward belongs with the migration that adds
   `spaces.rid`, not before.

## Questions

1. **What creates a Space?** No endpoint in these 41 pages does, and
   `spaces-list-spaces.md` is the only Space page with content. Ours has
   `create_space()`. Either Foundry puts it behind Control Panel or it is in a
   section we have not mirrored.
2. **What is a `RoleSet`, as a resource?** `defaultRoleSetId` is published on a
   Space and `InvalidRoleIds` refers to "the project role set for the space",
   but no page in this section publishes the type.
3. **Is the reference `remove` list untagged?** `remove-project-resource-
   references.md:22` publishes `resources` · list with no element type, while
   `add` publishes a tagged union. Unpublished, so unanswerable here (§8).
4. **What is the wire encoding of `importedAt`?** Published as `string` ·
   required on both arms with no description and no format refinement.
5. **What orders `listChildren` and `listSpaces`?** Neither publishes an
   ordering, a default page size, or (for `listSpaces`) a maximum. A stable
   listing needs all three.
6. **Do the `api/` pages and Compass's prose pages disagree anywhere?** This
   reading and `compass-files-and-projects.md` were written from disjoint
   sources and agree on everything they both cover, which is weak evidence.
