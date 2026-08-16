# Reading — Compass, Global Branching, Object Views

Read to close four open questions from `deep-dive-ontology.md`. Three are
answered. **One is not, and the page suggested for it is about something else** —
said plainly below rather than stretched to fit.

Pages read: `mirror/compass/overview.md` (+ both screenshots analysed field by
field), `mirror/ontologies/branching-ontology.md` (+ `rebase-branch-view.png`,
`branch-taskbar-review-button.png`), `mirror/ontologies/ontology-branches-legacy.md`,
`mirror/object-views/overview.md`, `mirror/platform-overview/aip-capabilities.md`,
`mirror/dev-toolchain/overview.md`.

---

## 1 — Compass is the filesystem

> "**Compass** is the filesystem for the Palantir platform."
>
> "The most basic units in the platform are **resources**, which are analogous to
> a *file* in a traditional filesystem. You can store resources in **projects**,
> which are **collaborative spaces that organize people, resources, and folders**
> for a particular purpose."

Four tabs across the top: **Portfolios · Projects · Your files** (visible only to
you) **· Shared with you**.

> "Below the tabs, **quick filter cards** allow you to filter the view by
> portfolios, projects, or **Promoted items**. If you need access to a project,
> select **Request access**…"
>
> "Filter options include **resource type, status, portfolio, project,
> organization, and tag**."

### What `compass-files-landing-page.png` shows, exhaustively

**Workspace sidebar (dark, platform-wide):** Home · Search (⌘J) · Notifications ·
What's New — then Recent · **Files** *(selected)* · Ontology · Applications —
then an **APPLICATIONS** heading: **Projects & files** *(selected)* · Checkpoints
· **Ontology Manager** · **Object Explorer**.

**Compass's own tab bar:** a folder icon and a ✓ icon, then **Portfolios ·
Projects · Your files · Shared with you**. Far right: a **namespace picker**
reading `Governance Documentation Name…` with ✕ ▾, then ⚙.

**Breadcrumb:** `All files` **>** `Governance Documentation Namespace` ✕ ▾, and a
green **+ New project**.

**Quick filters** — three cards, each with its own **Apply**, and a **Hide** link:

| card | its own words |
|---|---|
| **Portfolios** | "groupings of projects which allow you to organize related projects into a **use case or area of interest**" |
| **Projects** | "**secure containers** of related files which allow you to **permission access to the work unit uniformly**" |
| **Promoted items** | "A catalog of the most useful projects, folders and files to jumpstart your work" |

**Filters panel:** `Filters 0` · **Types** (searchable; `Notepad document 2`,
`Folder 1`, "View all (2)") · **Status** (`Promoted items`) · **Portfolios**
(searchable) · **Projects** · **Tags** (`Select tags… ▾`) · **Organizations**.
Every facet carries a live count — derived from what is there, not enumerated.

**The file list. Columns: FILE NAME ⇅ · (org) · LAST MODIFIED ⇅ · TAGS ·
PORTFOLIO.** Each row is an icon, a name, and **the full path underneath it**:

| name | path | org | modified | tags | portfolio |
|---|---|---|---|---|---|
| Platform-Wide Relevant Notepad | `/Governance Documentation Namespace-d86595/Documentation Example/Platform-Wide Relevant Notepad` | 🏢1 | 20 minutes ago | | Example Portfolio |
| Example Project | `/Governance Documentation Namespace-d86595/Example Project` | 🏢1 | **`Request access`** | | |
| Documentation Example | `/Governance Documentation Namespace-d86595/Documentation Example` | 🏢1 | 27 minutes ago | `[Governance] Example Category: Example Tag` | Example Portfolio |
| Example Notepad | `…/Documentation Example/Example Notepad` | 🏢1 | 25 minutes ago | | Example Portfolio |
| **Governance Documentation Namespace** *(Governance Documentation Namespace-d86595)* | `/Governance Documentation Namespace-d86595` | 🏢1 | 28 minutes ago | | |

**Four things only the image says:**

1. **Every path begins with a namespace bearing a hash suffix** —
   `/Governance Documentation Namespace-d86595`. That is *exactly* the Space
   `Path` form from `spaces-and-the-resource-path.md` (`/Test Space-5adf6d`).
   **The UI calls a Space a "Namespace"**, and it is the first element of every
   path. Migration 397 got this right.
2. **The namespace is itself a row in the file list** — display name, then its
   path-name in parentheses. A Space is a resource.
3. **`Request access` appears where the metadata would be.** You can see the
   row's existence and path but not its detail — file access gating metadata,
   rendered.
4. **Tags are namespace-qualified**: `[Governance] Example Category: Example Tag`
   — a namespace, a category, and a value.

### What `project-dashboard.png` shows

**Breadcrumb: `Palantir` > `Flight Alerts at SFO` ☆ ⚙** — *Space > Project*, two
levels, then a favourite star and settings.

**Left panel**, with the project's description above it:

- **Preview** 🏢1 → **Cover page**
- **Project** 🏢1 → **Files** *(selected)* · **Autosaved** · **References** ⓘ
  (→ **File references**, **External references**) · **Trash**
- **Project usage** ↗ · **Access graph** ↗

The 🏢1 badge sits on **each section**, not the project as a whole.

**Main:** a **📌 Pinned** strip — "The most important files in this project",
`0 items` — then **Files** with **Actions ▾** and a green **+ New ▾**. Columns
**NAME ▲ · LAST UPDATED · TAGS**. Rows carry per-type icons and include two
**folders** (`uploaded_data`, `workbook-output`) beside datasets, code workbooks
and analyses. **Right rail:** ⓘ info · 🔒 security · 📡 activity · 🚩 flag ·
⚛ lineage.

The page's own list of the areas:

> * **Files:** A collection of all resources within a project. **Pinned resources
>   appear at the top.**
> * **Autosaved:** Resources created within the project that were **automatically
>   saved without a designated location**.
> * **References:** A collection of resources that **flow into the project**,
>   including file references and external references.
> * **Trash:** Resources deleted from the project, available for **recovery or
>   permanent deletion**.
> * **Sensitive Data Scanner:** a view for reviewing PII detections.

`dev-toolchain/overview.md` confirms the hierarchy from the API side:

> "**Filesystem** — Manage **spaces, projects, folders**, and resource roles."

**So the path is: Space → Project → Folder(s) → Resource**, with **Portfolios** a
cross-cutting grouping of projects rather than a level in the path.

## 2 — Branching, and what replaced proposals

`ontology-branches-legacy.md` is the superseded mechanism. The live one:

> "The ontology integrates with **Global Branching** to enable safe, isolated
> development of ontology resources."
>
> "**Ontology proposal:** When you create a Global Branching proposal on a branch
> that includes ontology changes, an ontology proposal is **automatically
> created** to track the ontology-specific changes."

An ontology proposal is no longer a thing you make; it is a thing that appears
because a Global Branching proposal touched the ontology.

> "You can **only branch from the main ontology**, also known as `main` branch."
>
> "If you already have changes… you can select **Save to new branch** from the
> save dialog… if you make changes to any **protected** ontology resources, you
> will be **required** to save to a new branch."
>
> "While on a branch, a **branch taskbar** at the bottom of the interface will
> display your current branch name and additional metadata."

**Branch protection covers exactly five resource types** — object types, action
types, link types, interface types, shared property types — and explicitly **not**
type groups, and **not** rule sets ("the protection status of the containing
object type will be enforced"). And:

> "ontology resources must be **migrated to use project permissions** before they
> can be protected."

Which ties the ontology to Compass: protection is managed "via the parent
project's **Files** tab."

### Rebasing

> "If your global branch does **not** contain changes to the ontology, rebasing
> occurs **automatically**. Once you introduce ontology changes to your branch,
> **including indexing an object type**, you will need to **manually** rebase…"

**Indexing is a modification.** That is stated twice — here, and in the
limitations: "Indexing an object type is treated as a modification. If the
resource is protected by a project policy, you will need policy approval to merge."

The flow: a blue dot on **Main branch updates** → **Rebase branch** → if conflicts,
the **Conflicts** tab; if only errors, the **Errors** tab; **All changes** shows
both sides, defaulting to your branch's version. Per resource you choose **Use
Main branch changes** / **Keep current branch changes** / navigate to it and make
a **custom change** that dissolves the conflict. Then **Finish rebase and save**.

### What `rebase-branch-view.png` shows — the full resource list

This is the most valuable image in the set, because it is the **complete
Ontology Manager sidebar**:

**Nav:** Discover · **Proposals** · **Main branch updates** *(selected, blue ●)* ·
History

**Resources:**

| resource | count |
|---|---|
| Object types | 74 |
| **Properties** | *(no count)* |
| Shared properties | 25 |
| Link types | 67 |
| **Action types** | 61 |
| **Groups** | 13 |
| Interfaces | 14 |
| **Value types** | 11 |
| **Functions** | 8,474 |

**Footer:** **Health issues** · **Cleanup**

**Three of these I had never catalogued: Groups, Value types, Functions.**
"Groups" is the `+ Add to group` on the object type Overview and the "Type
groups" excluded from branch protection. "Value types" appears nowhere in the
deep dive at all.

The page body lists resources with a change badge — `Office · Created`,
`Employee · 11 edits` — and **a link type renders as both its ends**:
`Employees ⋈ Office · Created`.

### What `branch-taskbar-review-button.png` shows

**The taskbar (bottom, blue):** branch selector `⑂ <branch> ▾` · a folder badge
with a **count of changed resources** (`5`) · green **Merge proposal** · **View
proposal ↗**.

**The proposal popover:** `⑂ Proposal for <branch>` · **Open in ▾**; then
`**Open**` (green pill) · *"<user> **wants to merge into** ⑂ Main **from** ⑂
<branch>"*; then **one row per resource**:

| resource | reviewers | approval | check |
|---|---|---|---|
| Manufacturing pipeline *(a pipeline, not ontology)* | 👤+ **Manage** | Auto-approved | ✕ |
| **Manager** · *"Indexed 5 days ago"* | 👤 2 · **Review ↗** | Awaiting approval | 🕐 |
| **Employee** · *"Indexed 5 days ago"* | 👤 2 · **Review ↗** | Awaiting approval | 🕐 |
| **Manager ⚭ Employee** *(a link type)* | 👤 2 | Auto-approved | ✓ |
| **Create Case File** *(an action type)* | 👤 2 | Auto-approved | ✕ |

**Approval status and merge check are separate columns** — a row can be
Auto-approved and still carry a red ✕. And the sub-label is *"Indexed 5 days
ago"*, so indexing is surfaced per resource, as the prose says it is a change.

> "**Each ontology resource is considered an individual task.**"
>
> "While ontology entities are treated as separate resources in Global Branching,
> they are **grouped under a single local ontology proposal**. This means adding
> a reviewer to one ontology resource effectively **adds that reviewer across all
> ontology resources**."
>
> "Users with approval rights **can approve proposals even if not added as
> reviewers**. Use the reviewers list to **track** who should review changes, not
> to **restrict** approvals."

Merge checks run when a proposal is created, and "Failed checks can include
conflicts between your branch and the `main` branch, which would require you to
rebase."

Two of the five known limitations are the same shape and worth keeping: if a
**backing datasource** or a **conditional formatting rule set** was replaced or
removed on `main`, keeping your branch's version **fails the merge** — you must
take main's.

## 3 — Object Views

> "Object Views are **reusable representations of object data**… a central hub
> for all information related to an object, including **property data, object
> links, and related applications**."

Two kinds:

> 1. **Standard Object Views:** "Standardized, out-of-the-box representations that
>    **automatically reflect an object type's configuration**. Available for **all**
>    object types… **without any configuration**."
> 2. **Configured Object Views:** "Fully customizable representations built using
>    **Workshop**… When a configured Object View is created, it **becomes the
>    default view**, though users can always **switch back** to the standard."

> "Standard Object Views exist alongside configured Object Views **as a
> first-class viewing option**… they remain accessible **even after** a configured
> Object View is built."

Two **form factors**, both available to both kinds:

> 1. **Full Object Views:** "A comprehensive overview… an in-depth display of all
>    related information."
> 2. **Panel Object Views:** "Intended for **integration with other applications**
>    and should focus on the most critical data for a specific workflow."

So the **Object views** tab on an object type is where its configured view is
attached, and the standard one is derived and never goes away.

## 4 — Capabilities: the question is still open

**The suggested page does not answer it.** `platform-overview/aip-capabilities.md`
is a thirteen-line stub about generative AI:

> "Palantir AIP provides a full set of capabilities for building with generative
> AI and connecting AI to operations… governed access to a wide range of LLMs…
> building LLM-driven functions, creating and managing agents, managing the
> evaluation suites… defining the automations…"

That is *AIP's* capabilities in the marketing sense. The **Capabilities** entry in
the object type's left rail — sitting between *Datasources* and *Object views* —
is a different thing, and **it is not in the corpus**: the only `capabilities`
page across 4,764 URLs is `aip-analyst/capabilities`, and the only mirrored one is
this stub.

**Not guessed at.** Left open rather than filled with a plausible shape.

`dev-toolchain/overview.md` was read alongside it and is genuinely useful, but for
a different reason — it enumerates the platform's API surface, and one line
confirms the filesystem hierarchy directly: *"**Filesystem** — Manage **spaces,
projects, folders**, and resource roles."* It also names **Ontology MCP**, which
"exposes **object types, action types, and query functions** as MCP tools" — the
same three-way split as the OSDK's Application SDK panel.

---

# What this changes in the S1–S7 map

### The correction I need to make to my own map

**S2 (edit session) and S3 (optimistic concurrency) were an invention.** I
described a working state with a Review dialog and a version counter, derived
from `save-changes.md` alone. The real mechanism is **branches**: you branch from
`main`, rebase to take main's changes, resolve conflicts **per resource**, open a
**proposal** in which **each resource is a task with its own approval**, and
merge. `save-changes.md` describes the *no-branch* path; branching is the general
one, and protection **forces** it.

So S2/S3 collapse into one thing and it is bigger than I said.

### The resource list is bigger than I had

`object_types`, `shared_properties`, `link_types`, `interfaces` we know about.
**`action_types`, `groups`, `value_types`, `functions` are resources of the
Ontology** and I had catalogued none of them as such. `Properties` is a
catalogue view across all types, distinct from `Shared properties`.

### Revised order

| | what | changed by this reading |
|---|---|---|
| **S1** | `ontologies` — the container, its folder, and per-ontology API-name uniqueness | unchanged, and now confirmed: Space → Project → Folder → Resource, and Compass owns it |
| **S2** | **Global branching**: `main` + branches, per-resource change tracking, rebase with per-resource conflict choice | **replaces** the invented edit-session/version pair |
| **S3** | **Proposals**: one per branch, each resource a task with approval status, reviewers shared across all ontology resources, merge checks separate from approval | new; was folded into S3 wrongly |
| **S4** | Object type metadata to completion, **+ groups** | `groups` is a real resource, not just a label |
| **S5** | Link ends — two per link type | unchanged; confirmed by the `Employees ⋈ Office` rendering |
| **S6** | Action types | unchanged, and confirmed as one of the five protectable types |
| **S7** | Object storage / indexing | **indexing is a modification** — it belongs to the branch, not beside it |

### Compass gaps this surfaced

We have `spaces` (397) and `projects`, and `resource_location()` builds the path.
We do **not** have: **folders** (a project contains folders), **portfolios**,
**tags**, **Trash**, **References**, **Pinned**, **promoted status**. The
Filesystem API line names the first as core: "spaces, projects, **folders**, and
resource roles."

## Open questions

1. **Capabilities.** Undocumented in the corpus. Needs a URL or a screenshot.
2. **Value types** (11 in the sidebar) — a resource of the Ontology that appears
   in no page read so far.
3. **Groups** — the `+ Add to group` control and 13 of them, but no page read
   explains what a type group *does* beyond being excluded from branch protection.
4. **Health issues / Cleanup** — two footer entries in the Ontology Manager
   sidebar; `mirror/ontology-manager/cleanup.md` exists and is unread.
