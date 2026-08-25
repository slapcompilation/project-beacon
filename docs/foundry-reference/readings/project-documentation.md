---
verify: strict
---

# Documentation on projects and folders: cover pages, README, Add description

The queue's entry was `projects/add-documentation` — the one page in a
section otherwise byte-identical to compass/. It turned out to be a corner
of a concept whose center sits elsewhere: **the section's own content is
byte-identical to a section inside `compass/create-a-project.md`, which I
read for the Compass phase and skipped this section of.** The concept has
two mechanisms, and the fuller one (cover pages) lives under security/
because its point is a permission carve-out.

**What I read, counted rather than asserted.**
`projects/add-documentation` (whole; identical to `projects/create` — the
same page under two slugs — and its Add-documentation section identical to
compass/create-a-project's), `security/cover-pages` (whole, 5 paragraphs),
`projects/use-project-navigation-panel` (whole),
`projects/use-project-details-panel` (whole), `projects/overview` (whole).
**Images: five parsed** — `compass/images/new-project.png`,
`compass/images/create-new-project.png` (the projects/ copies reference
these; the projects/images/ folder does not hold them),
`projects/images/project-dashboard.png`, `projects/images/project-details.png`,
`security/images/cover-page.png`. Unparsed from these pages, named:
`projects/images/project-navigation.png`, `autosaved.png`, `references.png`,
`move-to-trash.png`, `restore-trash.png`, `access.png`,
`resource-queues.png`, `compass-files-landing-page.png`,
`project-navigation-with-project-usage-link.png` — they illustrate areas
(Autosaved, References, Trash, Access, queues, the Files landing page) that
this arc records but does not build.

## 1. Folder documentation: README.md, or Add description

> "You can add documentation to any folder by dragging and dropping a Markdown file named `README.md` into the folder, or selecting **Add description** from the folder’s Actions menu. [Standard Markdown ↗](https://daringfireball.net/projects/markdown/syntax) is supported, with some security-related restrictions:"

— `projects/add-documentation.md`

The restrictions, verbatim: "Inline HTML is disabled." and "Unless
otherwise configured, only image files uploaded to Foundry will be
rendered." Then the link syntax:

> "Links to Foundry resources are also supported. Use the following syntax to have the description automatically add links with icon and file name inferred: `[optional link text](rid)`."

— `projects/add-documentation.md`

And the callout: existing `.md` files "will not automatically convert to be
rendered in place, even if they are correctly named `README.md`" — the
rendering hooks at upload.

The details panel names the same concept at both levels:

> "This section provides a Markdown-based rich text editor to [write documentation at the Project or folder level](/docs/foundry/compass/create-a-project/#add-documentation), similar to all the documentation sections throughout the workspace."

— `projects/use-project-details-panel.md`

## 2. Cover pages: project documentation with a discovery carve-out

> "The Project **Cover Page** section offers a Markdown-based rich-text editor for writing comprehensive documentation about the Project."

— `security/cover-pages.md`

> "Cover pages can be configured by Project owners to be discoverable by all users in the Project's organization, even in cases when a Project has markings applied to it. Users without access to the Project or its files can still discover and view the Project's cover page."

— `security/cover-pages.md`

The stated use: goals, guiding users "toward relevant files and active
areas of work", "instructions on which groups new users should request
access to", user guides for contained applications — and for marked
projects, "the discoverable cover page enables relevant users to find the
Project and request access if appropriate."

**What the capture adds that the prose does not**
(`security/images/cover-page.png`): the discoverability setting is an
enumeration of exactly two, radio-selected under "Cover page
discoverability — Requirements for discovering the cover page":

- **All can discover** — "All users within the organization can discover the cover page." (`security/images/cover-page.png`)
- **Require marking access** — "Users within the organization with access to project markings can discover the cover page." (`security/images/cover-page.png`) The rail shows
`Cover page` with a **Public** chip and a gear, against `Project workspace
— Members only`; the page itself renders with a book glyph, "Last updated
on Fri, Oct 4, 2024", an Edit button, and an auto-generated **Table of
contents** card built from the markdown headings. The same settings panel
carries two unrelated toggles (resource-level role grants, propagate view
requirements) that belong to the platform-security-management pages.

The navigation panel confirms placement:

> "The **Cover page** section provides a Markdown-based rich-text editor to write documentation for the Project. For more information, see the [cover pages](/docs/foundry/security/cover-pages/) documentation."

— `projects/use-project-navigation-panel.md`

The dashboard around it:

> "When you open a project dashboard, you can view the following areas: **Files**, **Autosaved**, **References** (file and external), **Trash**, and **Sensitive Data Scanner**."

— `projects/overview.md`

(`projects/images/project-dashboard.png` shows the older chrome: a
`Preview` section holding Cover page above `Project`;
`projects/images/project-details.png` the newer: `Preview — Visible to
others` above `Project workspace — Members only`, plus the details panel's
Overview with Description, Point of contact, and Metadata: RID, Location,
Space, Last modified, Views.)

## 3. What sits adjacent, already ours or recorded

Probed live (`information_schema`, `pg_proc`): `projects` carry
`description`, `default_role`, `space_id` — the create pane's fields
(`compass/images/create-new-project.png`: Name, Description (optional),
Namespace picker — the capture is the older era, Namespace where the prose
says space — Organizations · Any of, and Default role with the caption
that everyone from the org can see the project's existence and is granted
that role). `project_activity` + `record_project_activity` +
`expire_project_activity` already hold the details panel's Activity log
with its one-month expiry. `rid_locator(text) → uuid` resolves a RID —
the backend the `[text](rid)` syntax needs. **Folders hold no
documentation column; projects hold no cover page; nothing holds a
README** — and no file-resource kind exists at all (datasets carry
`project_id`, nothing carries `folder_id`).

## Decisions

1. **`folders.documentation`** — markdown text, the Add-description route
   made real. A fact about one row: a column, not a table.
2. **`projects.cover_page`** (markdown, NULL = none) +
   **`projects.cover_page_discoverability`** — the capture's two-value set
   (`all_can_discover`, `require_marking_access`), NULL meaning the cover
   page follows project access like any other field. The un-configured
   state is not in any capture or sentence; NULL-as-members-only is
   inference, recorded.
3. **Discovery pierces the row policy through a function, never a policy
   arm.** For a marked project, the access model (557-560) hides the row
   from an org member who lacks the marking. "Users without access ... can
   still discover and view the Project's cover page" — a SECURITY DEFINER
   `discoverable_cover_pages()` returning only (project id, rid, name,
   description, cover_page, updated) for projects whose setting admits the
   caller: org membership for `all_can_discover`, org + markings for
   `require_marking_access`. Widening the projects SELECT policy itself
   would expose every column; the function is the carve-out, fail-closed.
4. **The README.md file route is not built**, with its reason: no
   file-resource kind exists in our Compass — nothing can hold a file in a
   folder. Recorded; if a files arc ever lands, the callout's
   upload-time-conversion rule comes with it.
5. **The markdown restrictions are render rules** — the surface renders
   markdown with inline HTML disabled and resolves `[text](rid)` through
   `rid_locator` to an icon-and-name link; the images restriction becomes
   "no external images" (we host no uploads to allow). Cover page surface
   also renders the heading table of contents (capture).
6. **The space-level "Project default roles" setting is not built.** The
   add-documentation page describes it ("To set the default role that is
   initially selected for a particular space, go to the corresponding
   space settings"), but `platform-security-management/manage-orgs-and-spaces`
   enumerates the space settings — create and manage both — and no such
   setting is in the list; the nearest, "Project inherited roles", is role
   grants, not a picker default. An enumeration beats a description.
7. **Recorded, not built**: Point of contact ("Project owners can add a
   point of contact to projects", `projects/images/project-details.png`),
   the Views counter, the Pinned files strip ("The most important files in
   this project", `projects/images/project-dashboard.png`),
   cross-organization discoverability (the page says
   "This functionality is under development" — Foundry itself has not
   shipped it), and Sensitive Data Scanner (a product we do not build).

## Questions

1. **What is the un-configured cover page's visibility?** The capture's
   radio has two values and no off state; the rail chip says Public when
   discoverable. Ours: NULL = project access only. `blocks: nothing.`
2. **Is folder documentation the README, or beside it?** The page offers
   two routes into one outcome and never says whether Add-description
   creates the file. Ours: one column, both routes' outcome. `blocks:
   nothing.`
3. **Does the folder Actions menu say "Add description" or "Add
   documentation"?** The prose says Add description; no capture shows the
   menu. `blocks: nothing.`
