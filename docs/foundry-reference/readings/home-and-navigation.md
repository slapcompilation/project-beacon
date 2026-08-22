---
topic: What a signed-in Foundry user sees — landing page, chrome, application switching
verify: strict
date: 2026-08-10
---

# Reading — home and navigation

**Pages read in full**

- `getting-started/orientation-and-nav.md`, `getting-started/orientation-and-nav-.md` (same file, two slugs)
- `getting-started/login.md`
- `getting-started/quicksearch.md` (and `compass/quicksearch.md` — same file, two slugs)
- `administration/configure-workspaces.md`
- `administration/configure-homepage-url.md` (= `configure-languages.md` = `configure-platform-experience.md`, one page under three slugs)
- `administration/configure-application-access.md`
- `app-building/curating-apps.md`
- `ontology-manager/_index.md`, `ontology-manager/overview.md` (same file, two slugs)
- `ontology-manager/navigation.md`
- `compass/overview.md`
- `object-views/config-app-sidebar.md` (a name collision, not the platform sidebar — see §7.6)

**Read in full, and nothing below quotes them:** `getting-started/_index.md` /
`getting-started/overview.md` (same file, two slugs),
`getting-started/application-reference.md` (the six capability tables; first
three read line by line), `platform-overview/overview.md`. They are the
section's front doors and a capability matrix — they placed the surfaces
relative to one another, and no sentence of theirs is load-bearing below.

**Pages scanned, not read in full, and why:** `getting-started/introductory-concepts.md`,
`projects-and-resources.md`, `next-steps-by-role.md`, `training-application.md`,
`start-with-examples.md`, `authentication.md`, `delivering-a-use-case.md`,
`file-support-ticket.md`, `foundry-platform-summary-llm.md` — grepped for
`sidebar|home page|homepage|landing|navigate to|left panel|top bar|header`; only
`projects-and-resources.md` returned a chrome sentence and it repeats
`orientation-and-nav.md`.

**Sublinks named by these pages that I did NOT read:** `carbon/overview`,
`slate/overview`, `assist/overview`, `object-explorer/overview`,
`security/orgs-and-spaces`, `compass/tags`, `approvals/overview`,
`administration/control-panel` (read one sentence only),
`platform-overview/development-life-cycle`. Carbon is the largest gap: it is
named as both a home-page target and a workspace builder and I have no reading of it.

**Images parsed (21)**

| file | what it is |
|---|---|
| `getting-started/images/homepage.png` | **the platform landing page**, full window |
| `getting-started/images/nav-sidebar.png` | the Workspace sidebar, expanded, with the doc's ①–⑤ legend |
| `getting-started/images/notifications.png` | sidebar expanded + Notifications flyout |
| `getting-started/images/recent.png` | sidebar collapsed to a rail + Recent flyout |
| `getting-started/images/favorite-area.png` | the favorites area, empty state |
| `getting-started/images/manage-favorites.png` | the Manage your favorites dialog |
| `getting-started/images/apps-portal.png` | Applications Portal, platform apps |
| `getting-started/images/apps-portal-popover.png` | favorites groups + app hover preview |
| `app-building/images/apps-portal-promoted-apps.png` | Applications Portal, promoted apps |
| `app-building/images/apps-portal-sidebar-promoted.png` | favorites groups, a third variant |
| `compass/images/compass-files-landing-page.png` | **best full-window chrome shot**: sidebar + an app |
| `ontology-manager/images/oma-navigation-annotated.png` | OMA chrome, annotated |
| `ontology-manager/images/oma-discover-view.png` | OMA Discover, unannotated, high-res |
| `ontology-manager/images/oma-fallback-sections.png` | OMA Discover, new-user state |
| `ontology-manager/images/oma-customize-homepage.png` | the Customize homepage dialog |
| `ontology-manager/images/oma-type-group-section.png` | a group section on Discover |
| `ontology-manager/images/oma-user-interface-navigation-search.png` | **older** OMA header |
| `ontology-manager/images/oma-user-interface-navigation-search-in-header.png` | older OMA, search results |
| `ontology-manager/images/oma-user-interface-navigation-homepage-sidebar.png` | older OMA, object types list |
| `ontology-manager/images/oma-user-interface-navigation-back-home.png` | Back home + object type Overview |
| `ontology-manager/images/oma-user-interface-navigation-back-home-hover.png` | the Back home hover menu |

Also parsed while confirming §7.4, already covered by `ontology-manager-save-session.md`:
`oma-user-interface-object-type-view.png`, `oma-user-interface-overview-annotated.png`,
`oma-user-interface-property-editor-v2.png`, `oma-user-interface-link-type.png`,
`oma-user-interface-action-type.png`, `oma-user-interface-function-type.png`,
`oma-user-interface-action-type-observability-tab.png`,
`oma-user-interface-function-type-observability-tab.png`.

`app-building/curating-apps.md` referenced four images by absolute
`/docs/resources/…` path that were not on disk; I ran
`node scripts/mirror-foundry-docs.mjs --images app-building/curating-apps.md`,
which fetched all four and rewrote the links to `./images/`.

---

## 1. There are two chromes, and they nest

This is the single most important structural fact and no page states it outright.
It has to be assembled from three sentences and confirmed in a screenshot.

The outer chrome is the platform's:

> The sidebar is your constant companion in the platform and the starting point for navigation. Open and collapse the sidebar with the icon in the upper right or with the keyboard shortcut `Cmd+O` (macOS) or `Ctrl+O` (Windows).

The inner chrome belongs to whichever application is open. Ontology Manager's is
described in its own words:

> The two persisting elements of Ontology Manager are the top bar and the sidebar. The top bar and sidebar serve as navigation elements, providing intuitive access to various features, functionalities, and sections within the application.

The nesting is only visible in a screenshot. `compass/images/compass-files-landing-page.png`
shows the dark platform sidebar down the left edge and, to its right, Compass's
own white header with its own tabs — two sidebars and one top bar, on one screen.

And the outer chrome can be suppressed. `object-views/generate-urls.md`:

> append a URL query parameter `embedded=true`, which will load the view without the Workspace sidebar.

**So: platform sidebar (dark, always left) + application chrome (light, owns the
top bar) + application content.** Our shell currently has one sidebar doing both jobs.

---

## 2. The platform landing page

### 2.1 What the prose says — which is almost nothing

> New Palantir enrollments come with a default home page that helps users orient themselves and learn about the platform. Administrators or builders can also create custom landing pages for various user groups on the platform. Some enrollments may use a completely customized home page, while others may use standard components to provide access to frequently-used parts of the platform.

> While most home pages focus on navigation, you may also find announcements about the platform, starting points for common workflows within your organization, or links to custom documentation on the landing page.

The landing page is **configuration, not a fixed page**. `configure-homepage-url.md`
gives it a URL and two alternatives:

> Most new Foundry enrollments will display a default narrative home page that helps users learn about the Foundry platform. The URL of this home page is `/narrative`.

> If a Slate dashboard should be used as the Organization's home page, set the value to

…and likewise a Carbon workspace. The default is per Organization, with per-group
overrides:

> An Organization's home page URL can be configured per Organization or per user group in the **Platform experience** tab of Control Panel.

> If certain user groups should be sent to a home page URL that differs from the Organization default, you can add group-specific overrides under **Group override** from the left sidebar. The first entry in that list, where a user is a member of any of the listed groups, will be used.

The sidebar's Home entry is defined by where it goes, not by what is there:

> Home: Return to your organization's landing page
> — getting-started/images/nav-sidebar.png

### 2.2 What the screenshot shows, and it is the only source

`getting-started/images/homepage.png` is captioned in the markdown as an *example*
of a platform home page. **Not one word of its content appears in any mirrored
page** — I grepped the corpus for `Welcome to Palantir Foundry`,
`Applications for Data Ops` and `Explore business nouns` and all three return zero
files. Everything below is read off pixels.

Three regions, left to right:

**(a) The collapsed platform sidebar**, a dark icon-only rail down the left edge,
roughly 72px wide at this capture. Top to bottom: an expand control; Home
(highlighted — a lighter block behind the icon, marking the current page); Search;
Notifications with an amber dot; a divider; Recent; Files; a divider; four
favourited-resource icons (an orange funnel, a violet magnifier, a folder-with-star,
a cube-with-star); a large gap; then a bottom cluster of five — a globe-like mark,
a crossed-arrows mark, a `?`, a circular avatar reading `EX`, and an arrow leaving
a box.

**(b) A navigation column**, roughly 255px wide. A large square illustration with
an amber border — a stylised foundry crucible pouring molten metal, purple-to-orange
gradient. Beneath it a small letter-spaced grey label, then a three-item table of
contents with `➤` markers:

> NAVIGATION … Applications for Data Ops … Applications for Analytics … Applications for Operations
> — getting-started/images/homepage.png

The first entry is near-black (active); the other two are grey.

**(c) The main column.** A full-width blue-gradient banner, rounded, with a waving-hand
emoji and two lines of white text:

> 👋 Welcome to Palantir Foundry. … Foundry is a data platform built for powerful data transformations, analysis, and data-driven decision-making.
> — getting-started/images/homepage.png

Then three titled sections, each a 3-column grid of white cards. Each card is
`[icon tile] [blue title] / [grey one-line tagline]`. Seventeen cards in all,
verbatim:

> Applications for Data Ops … Dataset / Branch and version data … Code repositories / Author data pipelines … Data Lineage / Manage data pipelines … Projects / Manage access controls … Data prep / Clean unformatted data … Catalog / Endorse trusted data assets
> — getting-started/images/homepage.png

> Applications for Analytics … Code workbook / Develop data science models … Machine Learning / Manage and deploy models … Contour / Visualize, filter, and transform data … Reports / Create a data-driven report … Quiver / Explore time series data … Vertex / Build a connected company
> — getting-started/images/homepage.png

> Applications for Operations … Object Explorer / Explore business nouns and verbs … Fusion / Use familiar spreadsheet interface … Forms / Input structured data … Slate / Create an application … Workshop / Build interactive, object-backed apps
> — getting-started/images/homepage.png

Counts: 6, 6, 5. The Operations grid's second row has two cards and one empty cell,
so the grid is a fixed three columns and does not centre a short row.

**What the image adds that the prose does not:** the entire page. The prose says a
home page focuses on navigation; the image says *how* — a left TOC column that
mirrors the section headings, a welcome banner, and app cards grouped by audience
(Data Ops / Analytics / Operations) rather than by capability. It also shows the
platform sidebar in its collapsed form, and that Home stays visibly selected while
you are on it.

**What it does not settle:** whether this screenshot *is* `/narrative`. The alt text
calls it an example; the page never links the screenshot to the URL. See Questions.

### 2.3 A second landing page exists, for Files

Compass has its own landing page, and it is where the sidebar's Files entry goes:

> Files: Jump to the Projects landing page, powered by Compass
> — getting-started/images/nav-sidebar.png

> To find your resources, select **Files** in the workspace navigation sidebar. At the top of the page, you can use tabs to navigate between **Portfolios**, **Projects**, **Your files** (visible only to you), and **Shared with you**.

> Below the tabs, quick filter cards allow you to filter the view by portfolios, projects, or **Promoted items**.

`compass/images/compass-files-landing-page.png` shows the shape, and it is worth
copying because it is a *list* landing page rather than a *card* one: a header row
of tabbed destinations, a breadcrumb (`All files >` a namespace chip), a green
`+ New project` at top right, a dismissible `Quick filters` band of three
explanatory cards each with its own `Apply` link, one wide search input, then a
two-pane body — a collapsible `Filters` rail (Types / Status / Portfolios /
Projects / Tags / Organizations) beside a table with columns:

> FILE NAME … LAST MODIFIED … TAGS … PORTFOLIO
> — compass/images/compass-files-landing-page.png

One row substitutes a `Request access` button where the timestamp would be — the
list renders permission state inline rather than hiding the row.

---

## 3. The persistent chrome, top to bottom

### 3.1 The prose inventory

> The sidebar has five primary sections that allow you to navigate to different features and tools within the platform:

The legend beside `nav-sidebar.png` is the only place the entries are named. It is
a single table cell in which the doc's circled section numbers sit between the
entries, so each entry is quoted on its own below. Section ①:

> Home: Return to your organization's landing page

> Search...: Open the Quicksearch dialog

> Notifications: View platform and application notifications

> What's New: Read product announcements and release notes in the platform

Section ②:

> Recent: Quickly navigate to recently accessed resources

> Files: Jump to the Projects landing page, powered by Compass

> Applications: Find and access all platform applications using this portal

Sections ③ and ④ are one entry each:

> Applications (Favorited): Find applications you have previously added a star to. Organize and access your favorite applications

> Files (Favorited): Find files you have previously added a star to. Organize and access your favorite resources and objects

Section ⑤:

> AIP Assist: LLM-powered assistant for getting help

> Support: Access Palantir documentation, training resources, and help

> Account: Find account details and review permissions and groups

> Other Workspaces: Access custom Workspaces and the Control Panel (availability depends on permissions)

Note `favorite` in ③ and `favourite` in ④ — one table cell, both spellings.

### 3.2 What the sidebar screenshots add

`getting-started/images/nav-sidebar.png` — expanded, ~250px wide, dark:

- **Above section ①**, unmentioned in prose: the Palantir logo at top left (a
  rainbow-gradient ring over a layered teal glyph) and a collapse control at top
  right. This confirms the prose's *icon in the upper right* means upper right
  **of the sidebar**, not of the window.
- **Keyboard hints render inline, right-aligned:** `⌘J` on Search, `⌘⇧U` on AIP Assist.
- **What's New carries an amber dot badge.**
- **Section ③ has a header row**, not just items:

> APPLICATIONS … View all
> — getting-started/images/nav-sidebar.png

- The favourited applications carry a lifecycle tag under the name:

> AIP Agent Studio … Beta … Quiver … AIP Threads … Beta … Control Panel
> — getting-started/images/nav-sidebar.png

- Section ④ is headed `FILES` and holds two resources with resource-type icons.
- **Section ⑤ shows only three rows — AIP Assist, Support, Account.** There is no
  `Other Workspaces` row, although the prose lists one. The Account row is a
  circular avatar with the user's initials (`CL`), not an icon.

`getting-started/images/notifications.png` — the same sidebar, one version apart:
`What's New` is **absent from section ①** and its content has moved into the
Notifications flyout as a dismissible callout:

> Check out what's new … The latest and greatest features … View all announcements
> — getting-started/images/notifications.png

The flyout's items are Ontology proposals — a direct link between platform
notifications and the Ontology Manager's `Proposals` entry.

`compass/images/compass-files-landing-page.png` — a **third** primary-nav inventory,
and the one closest to what we would build, because it contains an entry the other
two lack:

> Home … Search… ⌘J … Notifications … What's New … Recent … Files … Ontology … Applications
> — compass/images/compass-files-landing-page.png

`Ontology` sits between `Files` and `Applications` as a **top-level destination** in
this capture. It appears in no prose anywhere in the corpus that I found. Below the
divider, this enrollment's favourites are:

> APPLICATIONS … Projects & files … Checkpoints … Ontology Manager … Object Explorer
> — compass/images/compass-files-landing-page.png

`getting-started/images/recent.png` shows the **collapsed** rail with a flyout: the
rail keeps the same order, the active item gets a lighter block, and the flyout
opens to the right with a small pointer. So collapsing does not drop sections; it
drops labels.

### 3.3 Favourites: the group headers are not stable

Four screenshots, four different sets of headers for the same region:

> APPLICATIONS … FILES
> — getting-started/images/nav-sidebar.png

> APPS · View all … Your favorited apps will appear here.
> — getting-started/images/favorite-area.png

> PLATFORM APPS · View all … PROMOTED APPS · View all … PROJECTS & FILES · View all … OBJECTS · View all
> — getting-started/images/apps-portal-popover.png

> PLATFORM APPS · View all … PROMOTED APPS · View all … OBJECT TYPES · View all
> — app-building/images/apps-portal-sidebar-promoted.png

The prose adds a fifth name for the same thing (`Applications (Favorited)`,
`Files (Favorited)`) and a sixth in `curating-apps.md`:

> Once pinned, a section called **Promoted Apps** will appear in the Foundry sidebar with a list of your favorite promoted apps.

Eight distinct labels across six sources. The **stable** part is the shape: an
uppercase header, a `·` separator, a `View all` link, then items; groups appear
only when non-empty; and the empty state is one sentence with an embedded link:

> Your favorited apps will appear here.
> — getting-started/images/favorite-area.png

Hovering a favourited app opens a preview card to its right — thumbnail, icon, name,
description, owner:

> Aircraft Maintenance Inbox … Inbox of maintenance events of active aircrafts, updates daily with data from the entire fleet. … By example-group
> — getting-started/images/apps-portal-popover.png

That renders exactly the metadata `curating-apps.md` requires:

> Every promotion application has the following required metadata that will be displayed in Applications Portal and in the left sidebar:

`manage-favorites.png` is the bulk editor reached from `View all`: a titled dialog
(`Manage your favorites`), two columns `Apps` and `Files`, each subtitled
`Suggestions based on your activity.` with a `Favorite all` link, star toggles per
row, a `SUGGESTED` sub-header on the Files side that also renders each resource's
full path, a lightbulb footer hint and a filled blue `Done`.

### 3.4 What else lives in the sidebar

Three more things are pinned there by administration pages, and none is in the legend:

> Users who have access to additional languages will see a locale switcher in their Foundry sidebar that enables language selection.

> When viewing a platform version other than the stable release, a small tag will be visible in the sidebar to indicate that the user is viewing a different release.

> To change the platform version, navigate to account settings in the bottom of the left sidebar

And one thing sits *above* everything including the sidebar — the static banner:

> You can configure a static banner per Organization that renders at the top, bottom, or top and bottom of every page.

(`control-panel-and-banners.md` already read the banner slot; this is a second
independent attestation.)

### 3.5 The sidebar can be taken away entirely

> Users who are not in user groups with platform access will only have access to consumer-facing applications built in Slate or Workshop to which they have explicitly been granted access. Additionally, these restricted users will not see a navigational Foundry sidebar nor will they be able to navigate to other parts of Foundry.

So sidebar visibility is a permission outcome, not a layout preference. The
mechanism is `Application access`, and the doc is explicit that it is cosmetic:

> Application access is not a security feature; it only simplifies the frontend user experience for users that do not need to view certain applications.

---

## 4. Moving between applications

There are five documented routes, and they are not equivalent.

**(a) The Applications entry → Applications Portal.**

> There is a single Applications Portal for each enrollment or tenant on a multi-tenant enrollment.

> Applications Portal is a tool for discovering and accessing all apps in Foundry. This includes both (1) core Foundry platform apps and (2) trusted custom apps that admins promote to Applications Portal.

> You can open Applications Portal by selecting the **Applications Portal** icon in the left sidebar.

> Applications portal is an integral tool in the left sidebar, even without any promoted custom apps.

`getting-started/images/apps-portal.png` shows it as a **modal over the current
page**, not a route: it has a title bar with an `×`. Its left rail is a counted tree:

> All apps 75 … Platform apps 40 … Analyze data 7 … Build & monitor pipelines 10 … Data Governance 4 … Manage & deploy models 1 … Operational applications 13 … Support 5 … Promoted apps 35 … Automotive 4 … Aviation 3 … Human Resources 1 … Information Technology 7 … Operations Management 6 … Other 18
> — getting-started/images/apps-portal.png

`40 + 35 = 75` ✓ and the platform children sum to 40 ✓. The promoted children sum to
39, not 35 — **inference:** a promoted app can belong to more than one collection,
which `curating-apps.md` permits since collections are a many-relation; the page
never says so.

Its toolbar is a search field plus tag-category dropdowns:

> Search for applications... … Analytics … Collection … data classification … Engineering … More
> — getting-started/images/apps-portal.png

which matches:

> Tags are displayed as labels on the promoted apps cards and can be filtered from the top right of Applications Portal.

and the rail headings match:

> Collections are displayed on the left sidebar as titles of sections in Applications Portal.

Platform apps render as two-column rows of `[pastel icon tile] name / description`;
promoted apps render as three-column **cards with thumbnails**, an owner line and
tag chips of the form `category: value`:

> COVID command tower … View live COVID Common Operating Picture, filter by region, date and population. Data updates every 4h, based on 27 source systems. … By Issues Test User 2 … Engineering: Accuracy … +1
> — app-building/images/apps-portal-promoted-apps.png

An external link is badged on the thumbnail (`External ↗`), a card with no
description simply omits the line, and a star appears on hover at the card's right.
A pinned `✔ Promote App ↗` sits at the bottom of the rail.

**(b) Pinning.**

> You can "pin" your favorite apps to the left sidebar for easy access. Select the star icon next to the application's name from the Applications Portal or when you are editing the application.

**(c) Quicksearch.** Two modes, one of which is explicitly a navigator:

> Jump-to mode only searches on titles of apps, resources, and objects.

> The interface includes a top results tab and four tabs by which to filter: **Apps**, **Objects**, **Datasets**, or **Files**.

**(d) A direct URL.** Ontology Manager names its own:

> Adding `/workspace/ontology` to the end of your Foundry home page URL

**(e) From another application's context.** Also from `ontology-manager/_index.md`:

> Right-clicking on an object type in Data Lineage and selecting **Configure object type**

Denial is uniform across (a)–(d):

> Users without access to an application will not be able to discover it from the sidebar or Application Portal.

> All applications are grouped by category and lifecycle stage, and sorted alphabetically.

### 4.1 Workspaces are the older name for the portal's categories

`configure-workspaces.md` opens with a deprecation notice:

> These docs only apply if you see the **Foundry suite** section in Control Panel. If you see **Application access** instead, refer to Configure application access.

Its definition is still the clearest statement of what a grouping *is*:

> A grouping of related applications that appear with the Foundry sidebar

and the alternative:

> A stand-alone application without the Foundry sidebar

The page's worked example names the `Analyze data` workspace — which is exactly a
category in the portal's rail. **Inference, and I am fairly confident of it:** the
portal's `Platform apps` categories are the former workspaces, renamed. No page says
so; the shared name and the shared purpose are the whole basis.

`Other Workspaces` in the sidebar is a third meaning again — Control Panel and Carbon:

> The main platform workspace is defined by the Workspace sidebar that we have been exploring. You can access other workspaces by selecting **Open other workspaces**.

and `administration/control-panel.md` gives a second, different route to the same place:

> You can access Control Panel from the Applications Portal.

---

## 5. The colours

All of this is **my judgment from pixels**, not quotation. Nothing in the corpus
states a hex value. Blueprint names are the nearest match, offered so a builder has
a starting token rather than a guess.

### 5.1 The platform chrome is dark; every application is light

Read from `homepage.png`, `compass-files-landing-page.png`, `nav-sidebar.png`,
`notifications.png`, `recent.png`, `apps-portal-popover.png`.

| region | reading | nearest Blueprint |
|---|---|---|
| Sidebar background | very dark neutral, ~`#1C2127`–`#252A31` | Dark Gray2 `#1C2127` / Dark Gray3 `#252A31` |
| Sidebar active / hover row | one step lighter, ~`#2F343C` | Dark Gray4 `#2F343C` |
| Sidebar item label | near-white | Light Gray5 `#F6F7F9` / Light Gray2 `#D3D8DE` |
| Sidebar section header, shortcut hints | mid grey | Gray3 `#8F99A8` |
| Sidebar badge (What's New dot) | amber | Orange3 `#C87619` — reads brighter, ~`#D9822B` |
| Favourite star, filled | gold | Gold4 `#D1980B` — reads brighter, ~`#F0A72B` |

The sidebar carries **no blue**. Selection there is expressed by a lighter
background block, not by an accent colour.

### 5.2 Application surfaces

| region | reading | nearest Blueprint |
|---|---|---|
| Page background | very light neutral, ~`#F5F6F8` | Light Gray5 `#F6F7F9` |
| Card / panel | pure white with a 1px light border | `#FFFFFF` on Light Gray1 `#D3D8DE` |
| Application top bar | white, bottom-bordered | `#FFFFFF` |
| Body text | near-black | Dark Gray5 `#383E47` / `#1C2127` |
| Secondary text, placeholders | mid grey | Gray1 `#5F6B7C` / Gray3 `#8F99A8` |
| Link / interactive text | blue | Blue3 `#2D72D2`; the home page's card titles read deeper, ~Blue2 `#215DB0` |
| Selected nav row (new OMA) | pale blue fill, blue label | Blue5 `#8ABBFF` at low alpha over white |
| Selected nav row (old OMA, portal) | white fill with a **blue 1–2px border** | Blue3 `#2D72D2` border |

### 5.3 The primary button is green, not blue

This surprised me and I checked it in four separate screenshots. Foundry's
confirm/create action is a **filled deep green**, roughly `#1C7C4A`
(Blueprint Green2 `#1C6E42` / Green3 `#238551`):

- `+ New project` — `compass/images/compass-files-landing-page.png`
- `Create branch` — `ontology-manager/images/oma-user-interface-navigation-search-in-header.png`
- `Save` — `ontology-manager/images/oma-user-interface-navigation-back-home.png`

Blue is reserved for **links and selection**. Where a dialog's confirm is blue
(`Done` in `manage-favorites.png`, `Add` in `oma-customize-homepage.png`) it is a
dialog, not a page action.

Neutral/secondary buttons are white with a grey border: `New ▾`, `Actions ▾`,
`Open in ▾`, `Discard`, `Cancel`.

### 5.4 Status colour is carried by tags, and the vocabulary is ours

From `oma-user-interface-navigation-homepage-sidebar.png` and
`oma-user-interface-object-type-view.png`:

| tag | colour reading |
|---|---|
| `Experimental` | dark amber text on pale orange |
| `Active` | dark grey text on pale grey (neutral, not green) |
| `Normal` (visibility, with an eye icon) | blue text on pale blue |
| `Success`, `Enabled` | green text on pale green |
| `Not indexed on branch` | amber text on pale orange |
| `Disabled` | grey text on pale grey |
| `Primary key` | violet text on pale violet |
| `Title` | green-grey text on pale green |

That `Active` is **neutral grey rather than green** is the load-bearing detail: green
means *healthy right now*, grey means *this is the lifecycle stage*. Two different
axes, two different palettes.

### 5.5 Where colour is absent

Card bodies, table rows, gutters and the whole page background are achromatic.
Colour appears only on: the app-icon tile, status tags, links, the selected row, the
green primary button, and the favourite star. An object type's icon tile is the one
place where an arbitrary hue appears, and it is per-type (Campaign blue, Workstation
amber, Employee magenta, Report teal — `ontology-manager/images/oma-discover-view.png`).

---

## 6. The Ontology Manager's own home

### 6.1 How you get there

> Selecting the **Ontology Manager** icon from the Workspace sidebar's **Apps** section

Note that no sidebar screenshot shows a section called `Apps`; the closest is
`APPS` in `favorite-area.png` and `APPLICATIONS` in `nav-sidebar.png`. This is the
same instability as §3.3.

### 6.2 The header, left to right

> The top bar has three main functionalities. It allows users to search for Ontology resources, create new Ontology resources, and navigate between or create new branches.

The image supplies every control:

> Ontology Management … Search by name, RID, aliases... … ⌘ K … Main … New
> — ontology-manager/images/oma-discover-view.png

Left: the application icon, then the application title.

**Corrected 2026-08-20, by measuring the same image.** This line read "a
blue-violet rounded-square app icon holding a white 3-D cube" and every part of
that is wrong. The icon is a **flush pale-blue block the full height of the
header** — `#eef3ff` here, `#f1f5fe` on the older capture — about 50px wide, with
**square corners and no inset**, and its cube is drawn in three tones of blue
(`#1e52a7`, `#4385ee`, `#99c2ff`), not white. We had built the sentence: a 28px
violet rounded tile holding a white cube. Written down as the cheapest lesson
here — **a colour read by eye at 28px is a guess, and this one survived into the
product because nothing ever counted it.** Centre: the search field, grey-filled, with a magnifier and an
inline `⌘ K` hint. Right: a branch icon, the current branch name and a caret; then
an outlined `New` with a caret. Confirmed by prose:

> In the middle of the header of the application is the **Search** bar. You can click into the **Search** bar or hold down `Cmd/Ctrl + K` to open the **Search** bar dialog.

The header is **stateful**. With unsaved work it becomes a counter plus two buttons:

> 1 edit … Discard … Save
> — ontology-manager/images/oma-user-interface-navigation-back-home.png

and with none, `Discard` is disabled and the green button reads `Create branch`
(`oma-user-interface-navigation-search-in-header.png`).

### 6.3 The sidebar, top to bottom, with counts

`ontology-manager-save-session.md` §10.8 already inventoried this from
`review-restore-unsaved-changes-button.png`. **My reads agree on the order and the
membership**, and add a fourth capture of the same list with a different tenant's
counts, from a higher-resolution image:

> …ontology … Discover … Proposals … History … Resources … Object types 3,312 … Properties … Shared Properties 344 … Link types 4,555 … Action types 7,665 … Groups 223 … Interfaces 34 … Value types 45 … Functions 5,423 … Health issues … Cleanup … Ontology configuration
> — ontology-manager/images/oma-discover-view.png

Three things this adds to §10.8:

1. **`Value types` is inline here**, in the same group as `Functions`, separated by a
   rule from the `Resources` group above. §10.8 had to take it from a second
   screenshot. The grouping is: `Object types` → `Interfaces` | rule |
   `Value types`, `Functions` | rule | `Health issues`, `Cleanup`.
2. **`Properties` carries no count** while every sibling does — in this capture and
   in §10.8's. Two independent captures, same omission.
3. **Above everything sits an ontology switcher** — a folder icon, the ontology's
   name, and a vertical double-caret. §10.8 does not mention it, and no prose in
   `ontology-manager/` mentions it either. It is the UI for the fact
   `deep-dive-ontology.md` established: the Ontology is a resource you select between.

`Ontology configuration` is pinned to the very bottom, separated by a rule and a
large gap — the only bottom-pinned item.

**Disagreement with §10.8, minor:** my capture reads `Shared Properties` with a
capital P; §10.8's reads `Shared properties`. The older design
(`oma-user-interface-navigation-homepage-sidebar.png`) also reads `Shared properties`.
Prose in `navigation.md` uses `Shared Properties`. Casing is unstable; nothing turns on it.

### 6.4 What the main pane shows on landing

> The Discover view offers a highly customizable landing page tailored to your preferences. By default, the Discover view showcases favorite object types, recently-viewed object types, and favorite groups.

The prose lists three sections but not their **order**, and the order is the opposite
of the sentence:

> Recently viewed object types 32 … Configure … See all … Favorite object types 32 … Configure … See all … Favourite type groups 6 … Configure … See all
> — ontology-manager/images/oma-discover-view.png

Each section header is `title + grey count badge`, with `Configure` and `See all →`
right-aligned. Note `Favorite` and `Favourite` in the same screenshot, and that the
third section is `Favourite type groups` where the prose calls it `Favorite groups`.

An object-type card is:

> Campaign … 16k objects … 9 dependents … CRM 46 … Marketing 332 … A marketing campaign is a planned and organized effort to promote a specific comp…
> — ontology-manager/images/oma-discover-view.png

so: icon tile, name, instance count, a rule, dependents count, a rule, zero or more
type-group chips each with their own count, then a truncated description. A favourited
card adds a gold star at top right and a prominence flag:

> Employee … 2k objects … 9 dependents • Prominent … Human resources 34 … All employees in the organization
> — ontology-manager/images/oma-discover-view.png

A card with no groups simply omits the chip row (`Transport`, in
`oma-fallback-sections.png`), and a card with no description shows italic grey
`No description` (`oma-type-group-section.png`). A type-group section card renders a
**miniature link graph** with cardinality-labelled edges and its own zoom controls.

### 6.5 The empty / new-user state

> In case the user is new to the Ontology, two specialized sections will be presented: one which displays all object types that were recently modified within that Ontology, and one for all prominent object types.

The image gives the headings, and the first **interpolates the ontology name**:

> Object types recently modified in … ontology 32 … Prominent object types 2
> — ontology-manager/images/oma-fallback-sections.png

### 6.6 Customising it

> The Discover view provides the flexibility to configure the sections that appear on the page and control the number of items displayed within each section. The available sections include "Recently viewed object types," "Favorite object types," and "Favorite groups." Additionally, you have the option to add a separate section for a specific group, allowing you to explore all object types within that group.

The dialog (`oma-customize-homepage.png`) is a reorderable list with drag handles,
one numeric control and one add menu:

> Customize homepage … Personalize your homepage by selecting and arranging sections to create a tailored ontology experience. The ontology will start up with object types from your selected sections, ensuring the entities most relevant to you are readily available. … Items per section 6 … Add section … Cancel … Apply
> — ontology-manager/images/oma-customize-homepage.png

`Add section` opens a menu of four in which **three are greyed out and only `Group`
is live**, with a submenu:

> Group … Favorite object types … Favorite groups … Recently viewed object types
> — ontology-manager/images/oma-customize-homepage.png

**Inference:** the three greyed entries are the sections already present in the list
behind the menu, so a built-in section can be added at most once while `Group`
sections are unlimited. The dialog never says this.

The `Group` submenu is a two-pane picker — a `Choose group…` field, a left list of
groups with counts, a right preview showing the chosen group's member object types,
and a filled blue `Add`.

### 6.7 What selecting a resource changes

Two things change and one does not.

**The sidebar is replaced, not extended.** The whole resource list is swapped for the
selected entity's pages, with a back link at the top:

> Once you have opened an object type, link type, or action type, you have the option to select **Back home** from the top left corner of the view's sidebar.

The back link's label is **not constant**: `Back home` in
`oma-user-interface-navigation-back-home.png`, `Object types` in
`oma-user-interface-object-type-view.png`, `Home` in
`oma-user-interface-action-type.png` and `oma-user-interface-function-type.png`.

Beneath it sits an identity block — icon, name, instance count, a favourite star, a
green health check and an overflow menu — and then the page list. Hovering the back
link opens a two-section menu:

> RECENTLY EDITED … [Example Data] Delays … [Example Data] Flights … RELATED … Object types … Link types
> — ontology-manager/images/oma-user-interface-navigation-back-home-hover.png

The prose promises more than the crop shows:

> Hovering over the **Back home** button will also bring up quick links to recently edited object types, link types, and action types, as well as all resources that are related to the one you are currently viewing.

The image's `RECENTLY EDITED` holds only object types and `RELATED` only two
submenus; the capture is cropped at 400px so this is not a contradiction, just
unconfirmed.

**The header does not change.** The app icon, title, search, branch selector and
`New` persist across every resource view I parsed.

**The main pane becomes the selected page.** For an object type's Overview the prose
numbers seven sections and the annotated image confirms all seven:

> 1. Object type metadata 2. Properties 3. Action types 4. Link type graph 5. Dependents 6. Data 7. Usage

`capabilities-value-types-and-groups.md` already covers these; the one thing I will
add for layout purposes is that **section 5 is a two-pane index** — a left list of
dependent *kinds* with counts, a right list of the instances of the selected kind:

> Dependents 14 … Workshop 9 … Function 2 … Graph Template 1 … Quiver Dashboard 1 … Use cases 1 … Automation 0 … Developer Console App 0 … Map Layer 0 … Map Template 0
> — ontology-manager/images/oma-user-interface-overview-annotated.png

The counts sum to 14, matching the badge, and zero-count kinds are **still listed** —
the index shows the full vocabulary of dependent kinds, not only the populated ones.

### 6.8 Searching from the home page

> Searching in the **Search** bar from the home page will update the home page with the list of resources that match the search.

The image proves the mechanism precisely: the sidebar gains a `Search results` entry
and every resource count is replaced by its **match** count.

> Search results 150 … Object types 1 … Link types 0 … Action types 0 … Shared properties 0 … Interfaces 0 … Functions 149 … Health issues 1,941
> — ontology-manager/images/oma-user-interface-navigation-search-in-header.png

`1 + 149 = 150` ✓. So the sidebar is a faceted result count, not a static menu.
(`Health issues` keeps its unfiltered count, which suggests it is not part of the
facet — inference.)

> The search results will highlight which field your search term matched on.

The highlight is an amber background on the matched substring, and the matched field
is **named inline** when it is not the title:

> [FRP] Aircraft … Plural display name:Aircraft Example Data
> — ontology-manager/images/oma-user-interface-navigation-search-in-header.png

### 6.9 The resource list pages

> The **Object types**, **Link types**, **Action Types**, **Shared Properties**, **Interfaces**, and **Functions** pages can be selected from the home page sidebar. These pages allow for filtering object types and link types based on their visibility, development status, and indexing issues.

The prose names six pages; the sidebar holds eleven resource entries plus three
navigation entries. The image gives the list page's actual columns:

> Object types (5) … New object type … NAME … STATUS … VISIBILITY … ISSUES
> — ontology-manager/images/oma-user-interface-navigation-homepage-sidebar.png

with per-row checkboxes, a funnel filter button, a gear for column settings, and
values `Experimental` / `Active` under STATUS and `Normal` under VISIBILITY. The
ISSUES column is empty in every capture I have, so this state is undocumented in pixels:

> Object types whose backing datasources are unregistered or have failed to reindex into Object Storage v1 (Phonograph) will have red error messages in the issue column of the object type page.

In this older design `Properties` is a **child** of `Object types`, drawn with a tree
connector; in the current design it is a sibling.

---

## 8. The dedicated screens (second pass, operator-directed)

Added after the operator pointed at `getting-started/overview` and
`orientation-and-nav` with the correction that the sidebar is *navigation into
the depths*, not an app list. Two screens the first pass did not absorb.

### 8.1 The login screen

`login.md` documents passkey/SSO flows; the screen itself is
`getting-started/images/sign-up-step.png`:

- The page is **dark** — same near-black as the platform sidebar (~Dark Gray2),
  not a light page with a card.
- Centered column: a small grey logo **mark** (no wordmark), then a large white
  serif-weight title:

> Welcome to AIP
> — getting-started/images/sign-up-step.png

- Below, a **bordered dark card** (1px grey border, rounded, transparent-dark
  fill): heading `Sign in`, one grey instruction line, then **icon-prefixed
  inputs** — a person glyph in a filled dark input, a lock glyph in an outlined
  input — and a **full-width blue button**:

> Sign in … One-time password … Next
> — getting-started/images/sign-up-step.png

  The button reads muted blue (~Blueprint Blue1 `#184A90`–Blue2 `#215DB0` at
  this disabled state).
- Bottom-right, OUTSIDE the card, a blue link:

> Need help?
> — getting-started/images/sign-up-step.png

- Prose places account recovery on this page too: "use the **Reset passkey**
  option found on the login page **below the login form**".

**Inference for ours:** the flow (email → Next → passkey) is passkey-shaped;
ours is email+password in one step. The SCREEN transfers — dark page, mark,
white welcome title, bordered card, icon inputs, full-width blue action,
help/reset links below — the flow does not.

### 8.2 Quicksearch

`quicksearch.md` is unusually complete prose:

> Access Quicksearch from the **Search** icon in the left sidebar, or use `Cmd+J` (macOS) or `Ctrl+J` (Windows).

> **Jump-to mode:** Provides a short list of personalized results to directly navigate users to the main types of available content: platform applications, custom applications, objects, datasets, and other resources.

> **Search only on titles:** Jump-to mode only searches on titles of apps, resources, and objects. To search additional fields and metadata, use the full results mode.

> **Permissions:** Quicksearch respects all existing permissions in the platform.

The dialog itself (`getting-started/images/quicksearch-dropdown.png`): a **dark
dialog** (~Dark Gray3) over the page. Top row: magnifier + the query, `Clear`
and `×` right. Beneath, a **blue-bordered row**:

> All search results for 'auto' … ⏎ to see all results
> — getting-started/images/quicksearch-dropdown.png

Then a grey-caps section header:

> JUMP TO … Highlighted samples from your results
> — getting-started/images/quicksearch-dropdown.png

Each result row: **[icon] [bold white name] [grey path or kind]**, and a
right-aligned rounded **kind pill** — `Apps`, `Files`, `Datasets` — dark grey
fill, light label. The dialog footer is a **hotkeys bar**:

> HOTKEYS … ⌘ + J Open Quicksearch … ↑ / ↓ Move in list … ⏎ select item
> — getting-started/images/quicksearch-dropdown.png

The 250-object-type cap and the Active>Prominent>Normal>Experimental priority
are stated in a callout; deprecated and hidden types are not searched.

### 8.3 The section illustrations are not app icons

`getting-started/images/{Datasets,Objects,Get-Started}.svg` are line-art
illustrations (white ground, black strokes, pale blue `#d9f0ff` accents) used
as documentation section art. The application icons in the screenshots are the
coloured tiles of §5.5. Nothing here to adopt as an icon set.

## 7. Contradictions and instabilities found

Seven. Every one is prose lagging behind its own screenshots, or one page lagging
behind another — the same pattern `ontology-manager-save-session.md` logged.

**7.1 Which side is the chrome on.** `login.md` says twice:

> select **Account** at the bottom of the right toolbar, then select **Settings**.

Everything else says left, including `configure-homepage-url.md` (*account settings
in the bottom of the left sidebar*), `curating-apps.md` (*the left sidebar*),
`building-pipelines/find-manage-schedules.md`:

> look for **Build schedules** in the Foundry navigation sidebar to the left of your browser.

and every screenshot. **`login.md` is wrong.** There *is* a right-hand icon rail in
`compass-files-landing-page.png`, but it belongs to Compass and holds panel toggles,
not Account. Build left.

**7.2 The AIP Assist shortcut.** Prose says `Cmd+U`; `nav-sidebar.png` renders `⌘⇧U`.
And its corner: `orientation-and-nav.md` says *the lower-right corner of the sidebar*,
`getting-started/_index.md` says *a dedicated icon in the lower-left corner of the
interface*. Both are describing the same bottom row of a left sidebar.

**7.3 `Other Workspaces` is in the legend but not in the screenshot.** Section ⑤ of
`nav-sidebar.png` has three rows, not four.

**7.4 Resource-page tab lists.** Already logged as §10.9 of
`ontology-manager-save-session.md`; I re-derived it independently from the same
images and **confirm it** — the link type view shows four pages against the prose's
two, the action type view shows nine and none is called `Logic`. I add one the
earlier reading did not note: `_index.md` says an action's Observability tab shows
usage *over the last 30 days*, while the tab's own range selector reads `Past 1 Week`
in both observability screenshots.

**7.5 Application taglines are not a registry.** The same app carries different
one-liners on different surfaces. `Workshop` is *Build interactive, object-backed
apps* on the home page and *Build operational applications* in Manage-your-favorites;
`Object Explorer` is *Explore business nouns and verbs* versus *Search and explore
objects*; `Reports` is *Create a data-driven report* versus *Collect, document and
share your work*. Only `Contour` matches across both. The Applications Portal uses a
third, longer register. Do not model one canonical description string.

**7.6 `sidebar` names at least three different things.** The Workspace navigation
sidebar; an application's own left sidebar (OMA's); and a third that is neither:

> The **applications sidebar** is used to display and embed applications, analyses, actions, and other resources related to the current object.

That one lives *inside* an Object View. `object-views/config-app-sidebar.md` looked
relevant from its MAP title and is not.

**7.7 `dependents` versus `dependencies`.** The OMA cards say `9 dependents` in
`oma-discover-view.png` and `9 dependencies` in `oma-type-group-section.png` and
`oma-customize-homepage.png`, for the same field. `_index.md` names the Overview
section `Dependents`. Different screenshot vintages; `dependents` matches the prose.

**7.8 MAP.md is stale, and it nearly cost me this reading.** `CLAUDE.md` says to grep
MAP.md before concluding Foundry lacks something. MAP.md indexes 36 sections; the
mirror holds 55. **Nineteen mirrored sections are absent from it**, including
`getting-started`, `platform-overview` and `administration` — the three most important
sections for this reading. Grepping MAP.md for `home`, `homepage`, `landing`,
`orientation`, `waffle` and `app switcher` returns **zero** rows, which would have
supported the false conclusion that Foundry documents no landing page at all. The
full list of missing sections: `administration`, `ai-fde`, `analytics-connectivity`,
`autopilot`, `data-lifetime`, `data-lineage`, `dataset-preview`, `dev-toolchain`,
`devops-release-management`, `getting-started`, `global-branching`, `object-backend`,
`object-indexing`, `object-permissioning`, `ontology-sdk`, `pb-functions-expression`,
`platform-overview`, `superrepo`, `time-series`.

**7.9 Duplicate pages inflate the corpus.** Four sets mirror one upstream page under
several slugs, differing only in the source-URL comment (and sometimes an image
path): `ontology-manager/_index` = `overview`; `getting-started/_index` = `overview`;
`getting-started/orientation-and-nav` = `orientation-and-nav-`;
`compass/quicksearch` = `getting-started/quicksearch`; and
`administration/configure-homepage-url` = `configure-languages` =
`configure-platform-experience`, all three with identical headings and line counts.

---

## 8. Connects to

- **`ontology-manager-save-session.md` §10.8–§10.10** — the OMA sidebar inventory,
  the tab-list contradictions and the `relation` RID token. §6.3 above extends 10.8
  with a fourth capture, the `Value types` placement and the ontology switcher;
  §7.4 confirms 10.9 rather than restating it.
- **`deep-dive-ontology.md`** — *the Ontology is a resource you select between*. §6.3
  found the control that does the selecting.
- **`compass-branching-and-views.md`** — Space → Project → Folder → Resource. §2.3 is
  that hierarchy's landing page, and its tabs (`Portfolios`, `Projects`, `Your files`,
  `Shared with you`) are the top of it.
- **`projects-roles-and-portfolios.md`** — the `Request access` button rendered inline
  in a Compass row (§2.3) is the entry point to the flow that reading describes.
- **`control-panel-and-banners.md`** — the static banner above everything including
  the sidebar; attested a second time here from `configure-homepage-url.md`.
- **`properties-and-keys.md`** — the `Primary key` and `Title` tags in §5.4 are those
  two designations rendered; they sit above a rule, ahead of the other properties.
- **`ontology-core-concepts.md`** — `quicksearch.md` supplies an ordering over our
  `visibility` and `status` CHECK values in one sentence: *prioritized by* `Active`
  *object types with* `Prominent`*, then* `Normal`*, and then* `Experimental` *status
  (deprecated and hidden object types are not searched on)*.
- **Our code.** `apps/web/src/` — the shell is one light sidebar doing both the
  platform's job and the application's. §1 says that is two components. Nothing in
  `apps/web` currently renders a dark rail, an Applications Portal, a favourites
  region, or a `/narrative`-equivalent landing route. `check:surfaces` walks the
  import graph from `main.tsx` and will need whatever we build to be reachable from it.

---

## Decisions I had to make

1. **I treated `getting-started/orientation-and-nav.md` as the canonical description
   of the platform chrome**, over `login.md` where they conflict. Reason: it is the
   page whose subject is navigation, it is linked as such from six other pages, and
   every screenshot agrees with it. `login.md`'s *right toolbar* is recorded in §7.1
   as an error rather than as an alternative layout.

2. **I read colour off pixels and named the nearest Blueprint token.** The corpus
   states no hex value anywhere. I have marked §5 as judgment, given ranges rather
   than single values, and named the specific screenshot each reading comes from so a
   human can disagree by opening the file. If §5 is wrong, it is wrong visibly.

3. **I did not treat `homepage.png` as `/narrative`.** The markdown calls it an
   example; the URL is stated on a different page in a different section. Asserting
   the identity would make our landing page a copy of one tenant's configured page.
   I have written §2.2 as *this is what one platform home page contains* and put the
   identity question in Questions.

4. **I recorded the favourites group headers as unstable rather than picking one.**
   Eight labels across six sources (§3.3). Choosing one would look like a finding.
   What I extracted instead is the invariant: uppercase header, `·`, `View all`,
   items, hidden when empty. That is buildable; the label is a later decision.

5. **I inferred that the Applications Portal's `Platform apps` categories are the
   deprecated workspaces**, and marked it as inference in §4.1. The basis is that
   `configure-workspaces.md`'s worked example is the `Analyze data` workspace and
   `Analyze data` is a portal category with 7 apps. No sentence connects them. I did
   not let this inference carry any structure.

6. **I inferred that a built-in Discover section can be added only once** from three
   greyed menu entries (§6.6), and said so. The alternative reading — that they are
   greyed for an unrelated reason — is not excluded by anything on the page.

7. **I inferred that a promoted app can belong to several collections** from a count
   mismatch (39 children against a parent of 35) in §4. I did not use it for anything;
   it is recorded so the next reader does not think the screenshot is broken.

8. **I mirrored four missing images rather than skipping them.** `curating-apps.md`
   referenced them by absolute `/docs/resources/…` path. Running the mirror script
   with `--images` fetched them and rewrote the links, which modified
   `app-building/curating-apps.md` in the mirror. That is a change to a mirrored page,
   and `check:doc-drift` may notice it — flagging it because I would rather it be
   expected than investigated.

9. **I scoped `application-reference.md` to its first three capability tables.** It is
   143 lines of app-by-app tables and its subject is *which tool for which job*, not
   navigation. I read the Ontology-building table in full because it names Ontology
   Manager, Object Views and Object Explorer — the three surfaces this reading is for.

---

## Questions I could not answer

**1. What is actually on the platform landing page for a *new, unconfigured*
enrollment?** `blocks: the landing page`
The corpus states the URL (`/narrative`) and that a default exists. It never states
its contents. `homepage.png` is captioned as an example and shows an enrollment with
17 apps grouped by audience — a grouping that appears in no prose and matches neither
the Applications Portal's categories nor `application-reference.md`'s six capability
headings. So I have three competing taxonomies of the same apps and no statement of
which one the default home uses.
*Searched:* `grep -rn "narrative"` (3 hits, all the same sentence in the same
triplicated page); the strings `Welcome to Palantir Foundry`,
`Applications for Data Ops`, `Explore business nouns` (0 hits each); MAP.md for
`home|homepage|landing|narrative` (0 rows); `ls mirror/` for a `narrative` or
`carbon` section (neither exists).
**This is the question to put to the operator**, who has an enrollment and can open
`/narrative`.

**2. Is the platform sidebar's `Ontology` entry a current top-level destination?**
`blocks: the sidebar`
It appears in `compass-files-landing-page.png` between `Files` and `Applications`,
and in no other screenshot and no sentence anywhere. It matters because it decides
whether our ontology surfaces hang off a primary nav entry or off Applications.
*Searched:* the corpus for a sidebar entry named Ontology; the other four sidebar
screenshots; `orientation-and-nav.md`'s five-section legend, which does not list it.

**3. Which OMA header is current?** `blocks: nothing`
Two designs are mirrored on the same pages. The newer has a text title, a centred
search, a branch selector and `New` (`oma-discover-view.png`). The older has an
ontology dropdown, `Ontology`/`Proposals` tabs, a right-aligned search and
`Discard`/`Create branch` (`oma-user-interface-navigation-search.png`), with
`Advanced` where `Ontology configuration` now sits and no `Groups` or `Value types`.
The newer is consistent with `ontology-manager-save-session.md`'s captures, so I
would build the newer — but `navigation.md`'s prose still describes the older one's
behaviour and no page is dated.

**4. What does Carbon actually produce?** `blocks: nothing`
Named three times as a thing a user can land in or navigate to — a home page target
(`/carbon/<workspace-rid>`), the builder of custom workspaces, and a promotable app
type — and there is no `carbon/` section in the mirror at all.
*Searched:* `ls mirror/` and `grep -rn "carbon"` (references only, no page).

**5. What separates the property groups on an object type's Overview?**
`blocks: nothing`
`oma-user-interface-object-type-view.png` shows the Properties card split by two
rules into three groups: the key designations, then four properties, then two. The
first split is clearly the keys. The second is not explained anywhere.
*Searched:* `ontology-manager/` in full, `properties-and-keys.md`.

**6. Does the ISSUES column's error state look like anything we would recognise?**
`blocks: nothing`
`navigation.md` promises *red error messages in the issue column* and the column is
empty in every capture in the corpus.

**7. Where does the purple trusted-content checkmark render?** `blocks: nothing`
`curating-apps.md` says *Promoted apps receive the purple checkmark for trusted
content, similar to items in the Data Catalog*, and I cannot find it on any promoted
card in `apps-portal-promoted-apps.png`. A blue-violet check-badge does appear on the
`Promote App` button and on the Compass `Promoted items` filter, so the mark exists —
just not visibly on the cards the sentence is about.
