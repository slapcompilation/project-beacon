---
verify: strict
---

# Compass — folders, trash, and the rest of the filesystem

Pages read in full: `compass/overview.md`, `move-and-share-resources.md`,
`use-project-navigation-panel.md`, `resource-status.md`, `tags.md`,
`data-catalog.md`, `manually-upload-data.md`,
`getting-started/projects-and-resources.md`, and the two deprecation pages
(`platform-security-management/disabling-ignore-inherited-permissions.md`,
`disabling-propagate-view-requirements.md`). `create-a-project.md`,
`use-project-details-panel.md` and `quicksearch.md` were read in the
projects and quicksearch phases. Read because the map's next entry is the
resource hierarchy both markings and roles claim to inherit through.

## 1. The filesystem's nouns

From `compass/overview.md`:

> "**Compass** is the filesystem for the Palantir platform."

From `getting-started/projects-and-resources.md`:

> "A *resource* is analogous to a *file* in a traditional system."

> "Within projects, resources can be organized into **folders** to provide
> further structure and keep things clean."

> "In addition to projects created for collaboration, every user has a
> personal project."

The project dashboard's areas, verbatim from the overview: **Files**,
**Autosaved**, **References**, **Trash**, and **Sensitive Data Scanner**.

## 2. Folders carry no permissions — by Foundry's own deprecations

The one setting that ever made a folder a permission boundary is going away:

> "The **Ignore inherited permissions** setting is in the
> [planned deprecation](/docs/foundry/platform-overview/development-life-cycle/)
> phase of development, and most enrollments are no longer able to use this
> feature as of December 2024."

And its replacement guidance names our own architecture:

> "Projects and Markings are the preferred tools because, unlike the "Ignore
> inherited permissions" setting, they visibly define the requirements
> necessary to view underlying data."

So the security phase's sentence stays literally true — a role on the
project reaches everything inside — and a folder is organization, never a
gate. Markings, however, DO apply to folders: the migration page offers
"replacing the folder or file with a" Marking as a first-class option and
repeatedly applies one "on the folder or file", so the marking machinery
must flow through the folder chain.

## 3. Move, and who may

From `move-and-share-resources.md`:

> "You will need specific cross-Project permissions to move a file out of a
> Project and into another. Typically, only the resource `Owner` can move
> files out of Projects."

## 4. Trash

From `use-project-navigation-panel.md`:

> "You can restore files from the Trash if you change your mind."

> "Restoring a file places it where it was before you deleted it and returns
> previous permissions."

Permanent deletion is the X button; no page states a retention timer, so
ours is manual-only. The overview's one-liner:

> "**Trash:** Resources deleted from the project that are available for
> recovery or permanent deletion."

## 5. The catalog layer

Promoted status (`resource-status.md`): the only status is **Promoted**,
boosting search, badged with a checkmark, and gated twice —

> "To promote a resource, you must have the **Editor**
> [role](/docs/foundry/security/projects-and-roles/#roles) or higher on that
> resource, and you must be granted the **Resource Curator** role at the
> [space](/docs/foundry/security/orgs-and-spaces/#spaces) level."

Tags (`tags.md`):

> "Tags are structured metadata that can be applied to resources for
> categorization and discovery. Tags are a helpful construct, but they do
> **not** add or imply security."

> "Tags are organized into categories; the visibility of each category can
> be restricted to one or more Organizations."

Collections (`data-catalog.md`):

> "Collections are groups of those files that contain all curated data for a
> given topic, audience, or purpose."

## Decisions I had to make (mine, not Palantir's, unless quoted)

1. **Two slices.** C1: the tree — `folders`, placement, markings through the
   folder chain, move with its Owner gate, and trash. C2: the catalog layer
   — tags with org-visible categories, collections, per-resource Promoted,
   and the personal project provisioned per user.
2. **`folders` is a resource**: project-bound (NOT NULL), nested via
   `parent_folder_id` (NULL is the project root), cycle-guarded, RID
   `ri.compass.main.folder.<uuid>` — attested, and identical to a project's
   by 396's own finding that the format alone does not distinguish them.
3. **Placement is a column beside `project_id`, never a new generic table**:
   `folder_id` on datasets and restricted_views, and on `project_resources`
   for the registered ontology kinds — each guarded so the folder's project
   equals the resource's. Compass's own registry role is already played by
   `project_resources`; this slice does not re-answer that question.
4. **Markings flow file → folder chain → project**: `resource_markings`
   admits `folder`, and `effective_file_markings` walks the chain between
   the resource and its project.
5. **Trash is a timestamp**, `trashed_at`/`trashed_by` on the placeable
   tables and folders. Restore nulls it — placement untouched, which is
   exactly "places it where it was before you deleted it and returns
   previous permissions". Permanent delete is a real DELETE, manual only.
   Trashing a folder trashes by the chain at read time, not by cascading
   writes.
6. **Recorded, not built**: Autosaved (its access is representative-
   configured), cover pages, the Sensitive Data Scanner (a product we do
   not have), References (cross-project usage tracking — wants the
   resource-graph index the teardown noted), project usage, portfolios,
   media-set upload, and the access graph (already on the security ledger).

## Built (2026-08-13) — slice C1: migrations 497–498, PR #559

Decisions 2–5 shipped as recited: `folders` with the attested RID and the
cycle/cross-project guards; placement as a column beside project_id on
datasets, restricted views and project_resources, each guarded to its own
project; move-out Owner-gated with cross-project moves landing at the new
root; markings flowing resource → folder chain → project by restating
`effective_file_markings` once (all seven consumers inherit) and teaching
the apply guard the two new kinds; trash as a timestamp with the chain
evaluated at read time and restore-in-place. Surface: the Files card on the
project page (tree, filing, trash with restore and permanent delete).

Build-time find, worth its own line: the fixture's owner applied a marking
they were not a MEMBER of and went blind to the file they had just marked —
migration 399's own permissions-are-not-membership design, demonstrated
live. Every subsequent step no-opped silently and two assertions passed
vacuously on NULLs before the first loud failure. Assertions that depend on
visibility now assert rowcounts, not absence of error.

## Built (2026-08-14) — slice C2: migrations 499–500, PR #562

Decision 1's catalog half shipped as recited: tag categories org-visible
with their tags (deletion cannot be undone and strips every resource, per
the page), collections admin-curated and org-readable, the Promoted flag on
projects, folders, datasets and restricted views behind the curator
stand-in, and a personal project provisioned for every user — hidden from
everyone else by a RESTRICTIVE policy, because the permissive read and
admin-write policies OR together and any one of them would have leaked it.
Surfaces: the Tags section in Settings, the Data Catalog page (collections,
tag filters, promoted-first with the checkmark), and the catalog entry in
the portal.

Two build-time finds: the restrictive-policy lesson above, and a name
collision — 499's flag gate was created as guard_promotion, the SAME name as
the ontology STATUS gate from 454/460/461, and CREATE OR REPLACE silently
rewrote live machinery until 23 tests failed. 500 restored the original
verbatim and renamed ours guard_promoted_flag. Grep pg_proc for the name
before creating any function; the resource_project collision was caught
pre-flight the same hour, this one was not.

## Open questions

1. Datasets and restricted views sit outside `project_resources` (they
   carry `project_id` directly) while ontology kinds sit inside it — the
   placement column therefore lives in two shapes. Unifying Compass
   registration into one indexed resource graph is the standing
   `shape_registry` question, deliberately not answered here.
2. The Resource Curator space-level role (Promoted's second gate) — our
   spaces have no role machinery; C2 proposes org admin as the stand-in,
   marked ours, until space roles exist.
