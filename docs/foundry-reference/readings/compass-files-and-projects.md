---
verify: strict
---

# Compass — the Files landing page and the project dashboard, as screens

**Pages read in full: 6** — `compass/overview`, `compass/use-project-navigation-panel`,
`compass/use-project-details-panel`, `compass/resource-status`,
`compass/move-and-share-resources`, `compass/create-a-project`. (`projects/overview`,
`projects/create` and `projects/add-documentation` are byte-identical duplicates
of the first, sixth and sixth.)

**Captures, counted: those six pages reference 20 distinct images and 9 were
opened.** Four by me this pass — `compass-files-landing-page.png`,
`project-navigation.png`, `project-dashboard.png`,
`promote-resource-project-view.png` — and five in the Batch A surface-map pass
whose output this reading folds in: `project-details.png`, `new-project.png`,
`create-new-project.png`, `access.png`, `new-project-resource.png`. **The eleven
I did not open, named so the debt is not silent:** `autosaved.png`,
`change-status-insufficient-permissions.png`, `move-resource.png`,
`move-to-trash.png`, `move-window.png`,
`project-navigation-with-project-usage-link.png`, `references.png`,
`resource-queues.png`, `restore-trash.png`, `share-actions.png`,
`share-resource.png`. Each belongs to a control this reading records as not
built for want of an engine (Move, Share, Autosaved, References, Resource
queues, Trash-as-an-area), so opening them is the first step of building those,
not of building these two screens.

**Why this reading exists.** Five Compass readings already exist —
`compass-folders.md` (folders and trash), `compass-activity-log.md`,
`project-documentation.md`, `request-access-to-a-project.md`,
`home-and-navigation.md` (the shell) — and between them they built folders, the
activity log, cover pages and the access request. **None of them read the two
screens those things hang off.** `SURFACE-BUILD-MAP.md` §3.1 says the Files
landing is a filterable table and the project dashboard a navigation rail
where ours are a card grid and a stack of cards; this is the reading of those
two screens, in the shape `dataset-preview.md` took for §1.

---

## 1. What Compass is, and the two screens

> "**Compass** is the filesystem for the Palantir platform. You can use Compass to organize and manage your projects, resources, and folders."
— compass/overview.md

> "To find your resources, select **Files** in the workspace navigation sidebar."
— compass/overview.md

So the sidebar's `Files` row is the entry, and what it opens is the **Files
landing page**. Selecting a project on it opens the **project dashboard**.

## 2. The Files landing page

> Left of the content, the platform sidebar: `Home`, `Search… ⌘J`, `Notifications`, `What's New`; a rule; `Recent`, `Files` (highlighted), `Ontology`, `Applications`; a rule; an `APPLICATIONS` group holding `Projects & files` (highlighted), `Checkpoints`, `Ontology Manager`, `Object Explorer`.
> — compass/images/compass-files-landing-page.png

> The app header: a folder glyph and a blue ✓ (Data Catalog) glyph, then four tabs each with its own icon — `Portfolios | Projects | Your files | Shared with you`. At the far right a space chip `🗂 Governance Documentation Name… ✕ ▾` and a gear.
> — compass/images/compass-files-landing-page.png

> Beneath it a breadcrumb `📄 All files › 🗂 Governance Documentation Namespace ✕ ▾`, and a green `+ New project` at the right.
> — compass/images/compass-files-landing-page.png

The four tabs are enumerated in prose too, and the quick-filter band under them:

> "Below the tabs, quick filter cards allow you to filter the view by portfolios, projects, or"
— compass/overview.md

> A dismissible `Quick filters` band with `Hide` at its right, holding three cards, each a title, a one-line description and an `Apply` link: `Portfolios` — "Portfolios are groupings of projects which allow you to organize related projects into a use case or area of interest."; `Projects` — "Projects are secure containers of related files which allow you to permission access to the work unit uniformly."; `✓ Promoted items` — "A catalog of the most useful projects, folders and files to jumpstart your work."
> — compass/images/compass-files-landing-page.png

> One wide search field below the band: `Search all portfolios, projects, folders and files…`.
> — compass/images/compass-files-landing-page.png

> "You can further refine the file list using the **Filters** panel in the left sidebar. Filter options include resource type, status, portfolio, project, organization, and tag."
— compass/overview.md

> The `Filters 0` rail at the left, with a collapse glyph: `Types` (a `Search types…` box, then checkboxes with counts — `Notepad document 2`, `Folder 1` — and `View all (2)`); `Status` (a `✓ Promoted items` checkbox); `Portfolios` (a `Search portfolios…` box and `Example Portfolio`); `Projects ▾`; `Tags` with a `Select tags… ▾` control; `Organizations ▾`.
> — compass/images/compass-files-landing-page.png

**The list is a table, and its row carries five things.**

> Columns `FILE NAME ⇅ | LAST MODIFIED ⇅ | TAGS | PORTFOLIO`. A row is a type icon and the name in blue, with the resource's full path in grey beneath it (`/Governance Documentation Namespace-d86595/Documentation Example/Platform-Wide Relevant Notepad`); then an organisation-count chip `🏢 1`; then LAST MODIFIED as a relative time (`20 minutes ago`, `27 minutes ago`); then TAGS as a chip (`[Governance] Example Category: Example Tag`); then PORTFOLIO as an icon and name (`Example Portfolio`).
> — compass/images/compass-files-landing-page.png

> A row the viewer cannot open carries a `Request access` button in the LAST MODIFIED cell instead of a time — the `Example Project` row does.
> — compass/images/compass-files-landing-page.png

> The space itself appears as the last row, its api name in parentheses after its display name: `Governance Documentation Namespace (Governance Documentation Namespace-d86595)`.
> — compass/images/compass-files-landing-page.png

> A rail of five icon tabs runs down the right edge: ⓘ, 🔒, a feed glyph, a flag, a graph.
> — compass/images/compass-files-landing-page.png

## 3. The project dashboard

Two captures, four years apart, and they agree on the rail and disagree on the
header — §7 dates them.

> "The Project navigation panel includes **Preview** and **Project workspace** sections which provide tools for documentation and managing lists of files."
— compass/use-project-navigation-panel.md

> The rail: the project's description at the top (`Example project for documentation media.`); `Preview 🏢1` over `📖 Cover page`; `Project 🏢1` over `📁 Files` (selected, pale blue), `Autosaved`, `✳ References ⓘ` with the children `File references` and `External references`, `🗑 Trash`; a rule; `Project usage ↗` and `Access graph ↗`.
> — compass/images/project-navigation.png

The areas are enumerated in prose, and the enumeration has **five** members —
one of which no capture here shows:

> "When you open a project dashboard, you can view the following areas: **Files**, **Autosaved**, **References** (file and external), **Trash**, and **Sensitive Data Scanner**."
— compass/overview.md

> "* **Files:** A collection of all resources within a project. Pinned resources appear at the top for quick access."
— compass/overview.md

> "* **Autosaved:** Resources created within the project that were automatically saved without a designated location."
— compass/overview.md

> "* **References:** A collection of resources that flow into the project, including file references and external references."
— compass/overview.md

> "* **Trash:** Resources deleted from the project that are available for recovery or permanent deletion."
— compass/overview.md

> "* **Sensitive Data Scanner:** A view for operational users to review [personally identifiable information (PII)](/docs/foundry/sensitive-data-scanner/overview/) detections."
— compass/overview.md

**The Files area itself:**

> "The **Files** tab displays a collection of all files within a Project. The most important files in the project will appear in the pinned section at the top of this panel."
— compass/use-project-navigation-panel.md

> Header: a folder glyph, then the breadcrumb `🗂 Palantir › 📄 Flight Alerts at SFO ☆ ⚙`. Main: a `📌 Pinned` strip reading `The most important files in this project` with `0 items` at its right; then a `Files` heading with `Actions ▾` and a green `+ New ▾` at the right; then a table `NAME ⌃ | LAST UPDATED | TAGS` whose rows are a type icon and a name (`Code Workbook - 2022-04-19 16:10:02`, `Dataset - 2022-04-19 16:06:09`, two `New Analysis (…)`, `New Code Workbook (…)`, the folders `uploaded_data` and `workbook-output`) with an absolute timestamp (`Tue, Apr 19, 2022, 9:10:27 PM`). The same five-icon rail runs down the right edge.
> — compass/images/project-dashboard.png

**The column is named differently on the two screens** — `LAST MODIFIED` on the
landing page, `LAST UPDATED` inside a project — and the time is relative on the
first and absolute on the second. Both captures are of the product; neither
name is ours to choose.

**Selecting a row opens a toolbar; right-clicking opens the same list as a menu.**

> With one row selected (highlighted blue, a ☆ beside its name), a toolbar appears above the table carrying the selected resource's name at the left and, at the right, twelve glyphs in four groups: rename, move, copy link, copy RID | request access, edit requirements, view markings | add tags, add to Data Catalog, pin | change status, move to trash.
> — compass/images/promote-resource-project-view.png

> The context menu on that row: `Open ↗`, `Configure justification prompt ↗`; a rule; `Rename`, `Move…`, `Copy link`, `Copy RID`; a rule; `Request additional access`, `Edit requirements…`, `View markings`; a rule; `Add tags…`, `Add to Data Catalog…`, `Pin in project`, `Change status ▸`; a rule; `Move to trash…`.
> — compass/images/promote-resource-project-view.png

> `Change status ▸` opens a submenu with one enabled item — `✓ Promoted`, described as "Globally mark this item as a significantly useful resource for all users" — over a greyed `Remove status`.
> — compass/images/promote-resource-project-view.png

> The breadcrumb in this era includes the portfolio: `🗂 Governance Documentation Namespace › 📊 Example Portfolio › 📄 Documentation Example ☆ ⚙`, and the `Actions ▾` button of the older capture is gone, leaving only the green `+ New ▾`.
> — compass/images/promote-resource-project-view.png

The menu's items are the prose's, three pages of it:

> "Select a file to move, then select the **Move** icon."
— compass/move-and-share-resources.md

> "In the **Move** window, change the file name if desired, choose a new location for your file using the location dropdown menu and select **Move**. You may also use **Browse** to navigate for your preferred move location."
— compass/move-and-share-resources.md

> "You will need specific cross-Project permissions to move a file out of a Project and into another. Typically, only the resource `Owner` can move files out of Projects."
— compass/move-and-share-resources.md

> "You can also create resources directly from your Project by selecting **+ New** in the upper right of the Project dashboard."
— compass/move-and-share-resources.md

> "In the **Share** panel, you can activate link sharing so anyone with the link can access the resource. You can also grant access to specific users or groups."
— compass/move-and-share-resources.md

> "You can mark a resource as **Promoted** to signal that it is recommended for all users. Promoted resources receive the following benefits:"
— compass/resource-status.md

> "* **Visual indicator:** Promoted resources are marked with a checkmark icon, allowing users to quickly identify high-value content."
— compass/resource-status.md

> "To promote a resource, you must have the **Editor** [role](/docs/foundry/security/projects-and-roles/#roles) or higher on that resource, and you must be granted the **Resource Curator** role at the [space](/docs/foundry/security/orgs-and-spaces/#spaces) level."
— compass/resource-status.md

## 4. The details panel is a rail of tabs, and Overview is a field list

> "You can open the resource details panel by selecting one of the right-hand side icons on the Project page."
— compass/use-project-details-panel.md

> "The **Overview** panel gathers general information about the resource, including its resource identifier (RID)."
— compass/use-project-details-panel.md

> "The first field in **Metadata** is **RID**, the project's resource identifier. To copy it, select the copy button at the end of the read-only **RID** field."
— compass/use-project-details-panel.md

> "The remaining **Metadata** fields, in the order they appear, are **Location**, **Space**, **Iceberg storage**, **Tags**, **Portfolio**, **Status**, **Collections**, **Created**, **Last modified**, and **Views**. Fields are shown only when details are available."
— compass/use-project-details-panel.md

That last clause matters for the build: **a field with no value is not
rendered**, so the seven of those ten we cannot answer yet are absent rather
than blank.

> "If you can see a project's cover page but not its contents, **Overview** shows a reduced **Metadata** section containing only the project's own **RID**, **Location**, and **Space**."
— compass/use-project-details-panel.md

That reduced form is already built (759). The Access tab:

> "The **Access** tab in the resource panel allows you to manage group and user access roles within a Project."
— compass/use-project-details-panel.md

> "For a Project `Owner`, this panel provides an interface to add required markings, manage default access, and configure additional access by granting roles to other users and groups."
— compass/use-project-details-panel.md

## 5. Creating a project

> "If you have the [appropriate permissions](/docs/foundry/security/projects-and-roles/#create-projects), you can create new Projects by navigating to the Projects landing page and selecting **+ New project** located in the upper right."
— compass/create-a-project.md

> "Select **Project** to open a **Create new project** pane."
— compass/create-a-project.md

> "Name your Project, add an optional description, and select a location ([**space**](/docs/foundry/security/orgs-and-spaces/#spaces)) where your Project will live. You can also change the default role for users within your Organization."
— compass/create-a-project.md

> "Select **Create** to enter your new Project dashboard."
— compass/create-a-project.md

So `+ New project` opens a **menu** (Project is one of its entries), the pane is
a modal, and creating lands you on the dashboard.

## 6. What backs a Files table here, and the thing the catalogue falsified

I assumed `project_resources` was our Compass index over every resource kind.
It is not: its CHECK admits **`object_type` and `object_set` only**, so it is an
ontology-in-a-project table, and the `Contents` card our project page renders
from it is showing two kinds of ontology entity by raw id.

What the catalogue actually says (asked, not grepped):

- **Fifteen tables carry `folder_id`** — `code_repositories`, `code_workbooks`,
  `contour_analyses`, `datasets`, `fusion_spreadsheets`, `modeling_objectives`,
  `models`, `monitoring_views`, `quiver_analyses`, `restricted_views`,
  `slate_apps`, `vertex_graphs`, `workbook_templates`, `workshop_modules`, and
  `project_resources` itself. Those fourteen are the filesystem resources.
- **`useFiledResources` reads two of them** (datasets, restricted views), which
  is why our Files card shows two kinds where the capture shows every kind.
- `compass_project_of(kind, id)` covers four kinds; `ontology_resource_label`
  covers six ontology kinds and returns NULL for the rest. Neither answers
  "what is in this folder".
- `resource_tags` + `tags` (with a category) exist — the TAGS column has a
  store. `collections` + `collection_resources` exist — the Collections field
  does too. `promoted` exists on the resource tables (499/556).

## 7. The eras

`project-dashboard.png` is the oldest: an orange rule across the top, rows dated
2022 (one folder 2025), the breadcrumb `Palantir › Flight Alerts at SFO`, an
`Actions ▾` beside `+ New ▾`, and no platform sidebar in frame.
`project-navigation.png` is a crop of the same rail with the newer `Preview /
Project` headings carrying `🏢1` counts. `project-details.png` is newer again —
the header is a name and description with `Actions ▾` and green `+ New ▾`, and
the rail gains `Project Catalog`. `promote-resource-project-view.png` and
`compass-files-landing-page.png` are the current product: rows dated Feb 2026,
the sidebar with `What's New` and `Ontology`, a `Portfolios` tab, `Promoted
items`, a portfolio in the breadcrumb, and no `Actions ▾`.

**Where they disagree, the build takes the newest**, which is the pair I opened
whole — except the time column, where each screen keeps its own name and format
(§3), because that is a difference between two screens and not between two
eras: the newest capture of a project's Files table still prints an absolute
`Wed, Feb 18, 2026, 1:04:26 PM`.

## What the images add that the prose does not

- The four tabs' order and that the space chip and gear sit opposite them (§2).
- That the row's path is a second line under the name, and that the
  organisation count is a chip between the name and the time (§2).
- That `Request access` replaces the timestamp on a row you cannot open (§2).
- The Filters rail's six groups, their search boxes and their counts (§2).
- The whole selection toolbar, its four groups, and the context menu's exact
  order — twelve items the prose names across three pages and never lists (§3).
- `Change status ▸ Promoted` with its sentence, and the greyed `Remove status`.
- That the Pinned strip states its own count (`0 items`) rather than hiding.
- That the two screens name the time column differently, and format it
  differently (§3).

## Connects to

- `SURFACE-BUILD-MAP.md` §3.1 — the gap list this reading is the source for.
- `readings/compass-folders.md` — folders, trash and the placement guard (497);
  its correction that folders **can** carry role grants stands, and our Files
  card's header sentence still contradicts it.
- `readings/project-documentation.md` and `readings/compass-activity-log.md` —
  the Cover page under `Preview`, and the Activity tab of this details rail.
- `readings/request-access-to-a-project.md` — the `Request access` in a row.
- `readings/dataset-preview.md` §5b — `+ New › Dataset` is how a dataset is
  created *in a folder*, which is the Compass end of the dataset chain.

## Decisions (2026-09-14 — NOT YET READ BY A HUMAN)

1. **A resource listing is derived from the catalogue, not hand-written.** The
   Files table needs one row per filesystem resource; fifteen tables carry
   `folder_id`. A fifteen-way `UNION ALL` typed out by hand is the
   `rebuild_relationship_edges_view` mistake in a new costume — a view claiming
   to be derived while a human maintains the branches. `compass_files(p_project,
   p_folder)` builds its UNION **from `information_schema` at call time** over
   the tables that carry `project_id`, `folder_id`, `name` and `rid`, so a
   sixteenth resource kind appears in the filesystem the day its table does.
   The alternative — an allowlist — is the signal CLAUDE.md says means "index
   instead".

   **Revised 2026-09-16 — this decision asked the wrong question, and is
   annotated rather than rewritten so the expiry stays visible.**
   `docs/foundry-reference/readings/compass-filesystem-api.md` reads the 41
   pages of `api/v2/filesystem-v2-resources`, which publish Compass as a wire
   type: one `Resource` with identity, placement, naming, timestamps and trash
   — and no payload. Compass is an *index over things stored elsewhere*, not a
   union derived over the tables that hold them. `project_resources` is already
   that index, primary-keyed `(resource_kind, resource_id)` and scoped by its
   CHECK to two of our kinds. So the Files listing reads the index, and the open
   work is widening what writes to it. The `information_schema` union above
   survives as the migration path that **populates** the index — which is why it
   is annotated and not deleted.
2. **The row's columns are the capture's**: name, path, last modified, tags,
   and (on the landing page) portfolio and the organisation count. `promoted`
   renders as the checkmark `resource-status` describes. Nothing else.
3. **Two screens, two time formats, and the page's own column names** —
   `LAST MODIFIED` relative on the landing page, `LAST UPDATED` absolute in a
   project. Recorded as a divergence between eras that we copy rather than
   reconcile, because both captures are of the product.
4. **A Metadata field with no value is not rendered**, per the page's own
   sentence, so `Iceberg storage`, `Portfolio`, `Status`, `Collections` and
   `Views` are simply absent until something answers them — not blank rows and
   not "—".
5. **The selection toolbar and the context menu carry the same twelve items**,
   and only the ones with an engine are rendered: Rename, Copy RID, Add tags,
   Add to Data Catalog, Change status ▸ Promoted, Move to trash. Move, Copy
   link, Request additional access, Edit requirements, View markings and Pin
   are recorded as gaps with the engine each waits on. A menu item that does
   nothing is the "empty shell" failure at item scale.
6. **`Sensitive Data Scanner` is not built and is named here**, because the
   prose enumerates five areas and every earlier reading of this section
   listed four.
7. **The `Contents` card goes.** It lists `project_resources` rows by raw uuid,
   which no capture shows and no sentence describes; the ontology entities it
   names belong in the Files table like everything else once `compass_files`
   exists.

## Questions

1. **What are the five right-rail icons?** ⓘ and 🔒 are Overview and Access by
   the prose. The feed is Activity by `compass-activity-log.md`. The flag and
   the graph are unattested on these pages — `resource-queues.png` (unopened)
   is probably one of them.
2. **Does `Your files` have its own tab because it is a project, or because it
   is a place?** `your-files-data.png` shows a personal project whose rail has
   no Cover page and no Autosaved; ours lists it as an ordinary project card.
3. **What does the space chip's `✕` clear to?** The breadcrumb reads `All
   files › <space>`; whether clearing it lists every space's resources or only
   the ones you can see is not stated.
4. **Is `Actions ▾` on the Files heading gone, or moved?** The 2022 capture has
   it beside `+ New ▾`; the 2026 capture has only `+ New ▾`, and no page names
   an `Actions` menu on a project.
