---
verify: strict
---

# Reading — Object Views: the standard view, the configured view, and the Workshop module underneath

Written to close `ONTOLOGY-CREATION-REVIEW.md` finding F8 — "consumption's
first break: there is no Object View, of either kind". Nothing is built from
this until the Decisions block below has been read by a person.

**Pages read whole, 23 of 23 files in `mirror/object-views/`:** `object-views/_index`,
`object-views/overview`, `object-views/standard-object-views`,
`object-views/core-object-views`, `object-views/config-overview`,
`object-views/config-object-views`, `object-views/config-panel-views`,
`object-views/config-tabs`, `object-views/config-profiles`,
`object-views/config-app-sidebar`, `object-views/config-legacy-object-views`,
`object-views/manage-versions`, `object-views/branching-object-views`,
`object-views/generate-urls`, `object-views/comment-on-objects`,
`object-views/marketplace-object-views`,
`object-views/use-full-views-in-platform`,
`object-views/use-panel-views-in-platform`,
`object-views/widgets-properties-links`, `object-views/widgets-visualization`,
`object-views/widgets-filtering`, `object-views/widgets-layout`,
`object-views/widgets-apps-files`.

**Images.** The 23 pages reference 75 unique files. I diffed the references
against `mirror/object-views/images/` in both directions: none dangling, none
orphaned, and no page still points at a `media/` path. I parsed every one of
the 75. The 61 PNGs I opened directly. The 14 animated files are GIFs, and the
Read tool refuses the large ones, so I decoded them with a throwaway
stdlib script that composites frames into a PNG and looked at named frames —
which means **for the GIFs I have seen still frames, not motion**, and I say
below which frames.

PNGs parsed: access-yaml-config.png, add-application-sidebar-groups.png,
add-new-tab.png, add-profile-to-object-view-tab.png,
application-sidebar-object-view.png, comments_in_helper.png,
configure-widgets.png,
configuring-applications-sidebar_applications-sidebar-config.png,
core-object-view-panel.png, cross-section-filtering.png,
custom-object-views_profiles_multipass_ui.png,
delete-tab-in-advanced-settings.png, delete-tab-in-editor-sidebar.png,
filter-across-tabs.png, full-object-view-airport-example.png,
linked-objects-component.png, marketplace-add-tabs.png, move-tabs.png,
object-explorer-full-object-view.png, object-explorer-object-view-edit.png,
object-view-branch-resources.png, object-view-edit-history.png,
object-view-header-diagram.png, object-view-rebase-conflict-resolution.png,
object-view-rebase-example.png, object-view-save-publish.png,
ontology-manager-object-view-edit.png, overview-full-object-view.png,
panel-object-set-view-in-gaia-maps-vertex.png,
panel-object-view-in-gaia.png, panel-object-view-in-maps.png,
panel-object-view-in-vertex.png, panel-object-view-type-switching.png,
removing-object-view-branch-resource.png,
standard-full-and-panel-object-view.png, switch-object-view-profiles.png,
switch-profile-view-editor.png, tab-settings.png, tab-visibility.png,
toggle-core-custom-view-in-selection.png, widget-general-format-settings.png,
widgets_hp-filter-container.png, widgets_hu-edits-history.png,
widgets_hu-import-additional-files.png,
widgets_hu-linked-compass-resources.png, widgets_hu-links.png,
widgets_hu-media-preview.png, widgets_hu-properties-oma.png,
widgets_hu-properties.png, widgets_hu-tabs.png,
widgets_hu-upload-additional-files.png, widgets_hu-upload-files.png,
widgets_hu-vertical-stack.png, widgets_hyperlink.png,
widgets_linked-object-view-with-sidebar.png,
widgets_linked-object-view-without-sidebar.png,
widgets_markdown-hubble-plugin-1.png, widgets_markdown-hubble-plugin-2.png,
widgets_property-cards-config.png, widgets_property-cards.png,
widgets_timeline.png.

GIFs, with the frames I actually looked at: manage-tabs.gif (frames 60, 150,
300, 430 of 479 — I never sampled a frame with the per-tab chevron menu open,
so that menu's contents are unread); panel-object-view-configuration.gif (0,
200, 380 of 437 — I saw the Resolution-presets submenu and not the
Application-presets one); vertex-full-object-view.gif (300 and 500 of 524);
overview-panel-object-view.gif (0, 40 of 61);
workshop-object-view-widget-example.gif (0, 45 of 62);
panel-object-view-in-workshop.gif (45 of 62); panel-object-view-edit.gif (first
frame only); widgets_hp-multi-select-filter-1.gif (0, 100 of 152);
widgets_hu-grouped-events-table.gif (0, 60 of 85); widgets_hp-dropdown-filter.gif
(80 of 122); widgets_hp-buttons-filter.gif (90 of 140);
widgets_hp-daterange-filter.gif (110 of 154); widgets_hp-filter-sidebar.gif (200
of 291); widgets_hu-filter-summary-1.gif (160 of 222).

**Sublinks I followed and read whole:** `workshop/widgets-object-view`,
`workshop/widgets-property-list`, `workshop/widgets-links`,
`action-types/use-actions`, `questions-answers/object-views-community`.
**Read in the named part only:** `object-explorer/view-results` (its Previewing
Results section), `object-link-types/property-metadata` (its Visibility entry),
`object-link-types/metadata-render-hints` (three rows — the section has its own
reading, `docs/foundry-reference/readings/render-hints.md`),
`object-edits/user-edit-history` (its head).

**Sublinks the pages name that I never opened**, and which therefore owe their
own reading: `workshop/overview`, `workshop/concepts-layouts`,
`workshop/concepts-variables`, `workshop/scenarios-overview`,
`workshop/versions`, `workshop/branching-integration`, `workshop/widgets-chart`,
`workshop/widgets-object-list`, `workshop/widgets-comments`,
`workshop/widgets-button-group`, `workshop/module-interface`,
`workshop/embedded-modules`, `object-link-types/base-types`,
`object-link-types/link-types-overview`, `object-link-types/edit-properties`,
`object-link-types/conditional-formatting`,
`object-link-types/value-formatting`, `action-types/inline-edits`,
`action-types/upload-attachments`, `security/users-and-groups`,
`ontology-manager/ontology-roles-migration`,
`object-permissioning/ontology-permissions`,
`global-branching/resource-protection-and-approval-policies`,
`quiver/dashboards-object-view`, `map/overview`, `geospatial/ontology`,
`time-series/time-series-properties`. The images those pages carry are unparsed
too — in particular the three screenshots in `action-types/use-actions`, which
are the only pictures of the Actions section that exists in an Object View. The
Marketplace page also links into a `foundry-devops` section that is not in our
mirror at all, so that link goes nowhere here.

---

## 0. The shape of the section itself, before any of its content

Two pairs of files hold identical text. `_index.md` and `overview.md` are
byte-identical after the mirror's source comment, and so are
`core-object-views.md` and `standard-object-views.md` — the second pair is the
same page published at an old slug and a new one, and the old slug is the word
Foundry used to use for the standard view. That word survives in the product:
in one capture the view selector in the panel header reads `Core`, not
`Standard view`.

> Core
> — object-views/images/core-object-view-panel.png

> Standard view
> — object-views/images/toggle-core-custom-view-in-selection.png

**The section looked partially mirrored; it is not — the URL index carries
dead pages.** `all-foundry-urls.txt` lists 25 real slugs under
`/object-views/` plus the section root; 23 files are on disk. The three
absent — `config-widgets`, `config-workshop-tabs`,
`use-object-views-in-platform` — were verified 2026-08-28 by re-running the
mirror (26 known, 23 skipped-already-mirrored, 3 failed) and then fetching
each URL directly: all three serve a 404 upstream. So the mirror holds
every page that exists and CLAUDE.md's missing-by-the-SECTION rule
survives. What this actually caught: the URL refresh only UNIONS and never
prunes, so pages Palantir removed linger as known URLs forever — the 4,818
count overcounts by at least these three. Their slugs suggest they were the
predecessors of `config-legacy-object-views`, `config-object-views` and the
two `use-*-views-in-platform` pages — inference from the slug alone. There
is also a `questions-answers/object-views-community` page, which *is*
mirrored, and which I read.

## 1. What an Object View is

> Object Views are reusable representations of object data. They provide a central hub for all information related to an object and include key information about the object, including property data, object links, and related applications.

— `object-views/overview.md`

Two kinds, two form factors, and the two axes are independent: standard and
configured each come in full and panel.

## 2. Standard versus configured, and what Foundry creates by itself

This is the part F8 turns on, and the section says it in three places that do
not quite agree. Taking them in order.

### 2.1 The standard view is created for every object type

> When you create and configure an object type in your Ontology, Foundry automatically creates a standard Object View to provide a standardized representation of all its objects, ensuring other users have a holistic understanding of its schema and links.

— `object-views/standard-object-views.md`

It is derived, not authored:

> The standard Object View matches the object type's configuration by spotlighting prominent properties in either a dedicated table or in other visual formats if the property's base type is a time series, media reference, or geospatial property. Normal properties are displayed in a regular table, and hidden properties are not visible.

— `object-views/standard-object-views.md`

`prominent`, `normal` and `hidden` are the property **visibility** metadata,
defined outside this section:

> An indication to user applications for how prominently to display the property. A `prominent` property will lead applications to show this property first to users. A `hidden` property will not appear in user applications. By default, the `start date` property will have visibility `normal`.

— `object-link-types/property-metadata.md`

### 2.2 The *configured* default is created by Foundry too

This is the sentence the review's F8 did not have, and it changes what has to
be built:

> Default configured Object Views are automatically created for each object type. The default full Object View contains a list of prominent properties, or all non-hidden properties if none are prominent, and a list of the object's links. The default panel contains the same list of properties. The default views will dynamically update to reflect changes made to the object type, such as new properties or property renames, but once an Object View is edited it becomes user-managed and all further updates must be made manually.

— `object-views/config-overview.md`

Two mechanisms in one paragraph. The default configured view is **generated**
from the object type; and it is **live** — it tracks new properties and renames
— until the first edit, at which point it **detaches** and becomes hand-managed.
That detach-on-first-edit rule is the whole design and has no counterpart
anywhere in our schema.

The composition of the generated default is stated widget by widget:

> The default configured full Object View for all object types shows a single Property List widget displaying prominent properties of the object type, and a Links widget that displays the object's links, if any exist.

— `object-views/config-object-views.md`

> The default object instance panel view shows a single Property List widget that displays prominent properties of a single instance of the object type.

— `object-views/config-panel-views.md`

The legacy page says the same thing in the older vocabulary, which is useful
because it names the unit as a *tab*:

> A tab containing this widget is created as the default Object View for any newly defined object type.

— `object-views/widgets-properties-links.md`

And an image gives that tab its name and its identifier. The Marketplace dialog
lists the tabs of a `Car Part Issue` object view, and there is exactly one:

> Select object view tabs to include. Only tabs built using the Workshop editor can be added. Overview
> — object-views/images/marketplace-add-tabs.png

The legacy tab editor's Advanced pane shows the same word as a generated,
immutable identifier:

> Tab ID overview This value is generated on tab creation and cannot be edited
> — object-views/images/delete-tab-in-advanced-settings.png

and the YAML of that tab opens with it:

> id: overview title: Overview sections:
> — object-views/images/access-yaml-config.png

So: the generated default full view is one tab, titled `Overview`, whose tab id
is `overview`. **No sentence in the section says that.** Three screenshots do.
*(Downgraded in §20.3: only the tab ID `overview` is decently attested; the
title and the exactly-one count are inference — none of the three captures
shows an unedited default.)*

### 2.3 Which one a user sees, and how they switch

> Standard Object Views exist alongside configured Object Views as a first-class viewing option. While standard Object Views display by default when no configured Object View is created, they remain accessible even after a configured Object View is built. Users can toggle between standard and configured Object Views at any time based on their needs.

— `object-views/overview.md`

The switch is a button inside the view's own title bar in Object Explorer and
Ontology Manager:

> Switch to configured view
> — object-views/images/standard-full-and-panel-object-view.png

and a drawer in applications that supply their own header:

> users can hover over the ellipsis drawer icon in an Object View rendered in Palantir applications that use their own custom header, such as Gaia or Vertex, to toggle between standard and configured views.

— `object-views/config-overview.md`

In `toggle-core-custom-view-in-selection.png` that drawer is a small `…` pill on
the section header; opening it reveals a cube glyph labelled `Standard view`
with the tooltip `Switch to configured view`. In `panel-object-view-in-maps.png`
and `panel-object-view-in-vertex.png` the same panel carries both a `…` button
in the object header *and* a separate cube icon at the right of the
Properties/Series/Events strip, and in `panel-object-view-edit.gif`'s first
frame the affordance is a downward chevron rather than an ellipsis. **The glyph
is not stable across captures**; the prose calls it an ellipsis drawer.

One place the toggle does not exist:

> The ability to toggle between standard and configured Object Views is not yet available in Workshop.

— `object-views/config-overview.md`

though the Workshop widget page contradicts that, which I take up in §18.

## 3. Form factors

> **Full Object Views:** A comprehensive overview of an object, representing an in-depth display of all related information.

— `object-views/overview.md`

> **Panel Object Views:** Intended for integration with other applications and should focus on displaying the most critical data for a specific workflow.

— `object-views/overview.md`

The panel is the one both kinds always have:

> All object types have a [standard Object View](/docs/foundry/object-views/standard-object-views/) panel available by default, and you can build [configured panel Object Views](/docs/foundry/object-views/config-panel-views/) to display either an *object instance* or an *object set*.

— `object-views/use-panel-views-in-platform.md`

and it splits again:

> There are two types of configured panel Object Views you can build to display one or multiple objects of an object type: *object instance panels* display individual objects, while *object set panels* display multiple objects as an object set.

— `object-views/config-panel-views.md`

> Object set panels display an aggregated view of multiple instances of a single object type. They appear in applications when you select an object set comprised of several instances of the same object type.

— `object-views/use-panel-views-in-platform.md`

The object set panel has its own generated default:

> The **Charts** tab displays up to five XY Charts that visualize object aggregations grouped by property values.

— `object-views/config-panel-views.md`

> The **List** tab shows an Object List widget displaying up to three properties per object, including the object's title, prominent properties, and media when present.

— `object-views/config-panel-views.md`

`panel-object-set-view-in-gaia-maps-vertex.png` is three side-by-side captures
of that default in Gaia, Map and Vertex. Each shows a header naming the object
type and a count — `Object set • 23 Objects`, `18 objects`, `28 objects` — then
a two-tab strip `Charts` / `List`, then a map, then a horizontal bar chart
titled `Average Arrival Delay`. The prose does not mention that the object set
panel also renders a **map**; the images do, presumably because the type has a
prominent geospatial property. The capture is 8070px wide and I read it at
2000px, so I am confident about the tab names and the counts and less so about
the axis bucket labels.

`panel-object-view-type-switching.png` shows both panel kinds open in the
editor. The instance one's module interface holds a single variable named
`object` bound to one Airport; the set one's holds `managedObj…` bound to `178`
Airports. Both panes report `Object view` version `v16` while their modules
differ (`v0.2.0*` and `v0.5.0`). **One object-view version counter per object
type; a separate semantic version per module.** That is a schema fact and it is
only in that screenshot and in object-view-header-diagram.png.

## 4. What a standard Object View shows

Four display rules for prominent properties:

> **[Media reference properties](/docs/foundry/object-link-types/base-types/#media-references):** Rendered with a dedicated media viewer for viewing all supported media types.

— `object-views/standard-object-views.md`

> **[Time series properties](/docs/foundry/time-series/time-series-properties/):** Displayed as interactive charts showing temporal data patterns.

— `object-views/standard-object-views.md`

> Objects with prominent geohash, geoshape, or geotemporal series reference (GTSR) properties will render on a [Map](/docs/foundry/map/overview/).

— `object-views/standard-object-views.md`

> **Other property types:** All other prominent properties are displayed using a larger, card-style format elevated above a table displaying the remaining standard properties.

— `object-views/standard-object-views.md`

`standard-full-and-panel-object-view.png` turns that into a layout. The standard
view is a stack of named sections. The first is `Prominent`, marked with a star,
and its header carries a three-way segmented control — `Media` | `Map` | `Time
series` — so the three special renderings are *tabs within one section*, not
three sections. Under it: the media viewer with a file list on the left
(`Yellowstone_National_Park.jpg.png`, captioned with the property name `Park
Image`) and a vertical `Metadata` tab on its right edge; then a row of large
value cards, `1872-03-01` over the label `Anniversary` and `WY` over `State`.
The next sections are `Properties` (a plain label/value list) and `Linked
objects`. Property labels are dotted-underlined, which elsewhere in Blueprint
means a tooltip — inference; the page does not say. None of these section names
appears in any sentence of the section.

The same image shows the surrounding chrome in Ontology Manager: an object
picker with a pin, a `Full` | `Panel` segmented control, an `Edit full view` /
`Edit panel view` button, and a floating sun/moon pair for light and dark mode —
which is the prose's

> You can also preview the full and panel form factors, and test how the Object View appears in light and dark mode.

— `object-views/config-overview.md`

### The Linked objects component

> The **Linked objects** component enables you to traverse across [linked objects](/docs/foundry/object-link-types/link-types-overview/) directly within the standard Object View.

— `object-views/standard-object-views.md`

Its four listed capabilities are to view linked objects grouped by link type,
preview their properties inline, open a subset in a new tab, and preview one in
the side panel. `linked-objects-component.png` shows a fifth thing the prose
never mentions: **the component keeps a breadcrumb of the traversal**. Along the
bottom runs `Delta Air Lines Inc.` › `Flights 480,644` › `Arrival Airport 133` ›
`Arriving Route 1,227`, each hop with its own count. The left column lists the
link types out of the current hop with counts (`Departure Airport 177`,
`Destination Airport 133`, `Flight 1,612,101`, `Route Alert 14`); the right
column is a table of the selected group with a search box and an `Open 177 in`
dropdown; the top right has a list/grid view toggle. Two different glyphs
distinguish the four link types in that list — I could not tell what the
distinction is, and it is not stated; cardinality or direction would both fit.

`core-object-view-panel.png` is the same component in the panel form factor,
where it degrades to a tree: the current object, then a highlighted link-type
row (`Aircraft`, count `216`) which expands to a search box, an `Open 216 in`
dropdown, and the linked object titles.

## 5. What a configured Object View is made of

> Each Object View tab is backed by a [Workshop](/docs/foundry/workshop/overview/) module, which enables you to use Workshop to create Object View content with advanced capabilities and features.

— `object-views/config-object-views.md`

> If only one tab is configured, the tab title will be hidden when viewing the Object View, even though it appears in edit mode.

— `object-views/config-object-views.md`

> Deleting a tab also deletes the Workshop module that the tab contains.

— `object-views/config-object-views.md`

Two tab kinds:

> **Managed Workshop modules:** We recommend using Workshop to build a new tab within Object View. This option allows you to develop more sophisticated views that can leverage the full power of Foundry's application building capabilities.

— `object-views/config-tabs.md`

> Managed modules have their permissions automatically kept in sync with the Object View, and cannot be reused.

— `object-views/config-tabs.md`

> **Existing Workshop modules:** You can embed modules that have already been built in Workshop directly into Object View tabs. You can use the same module in multiple Object Views.

— `object-views/config-tabs.md`

And a third, closed kind:

> Some tabs were built with the **Legacy** builder, which allowed you to create simple tabs with limited flexibility for layouts, widgets, and data options. New tabs using this builder can no longer be added, but existing tabs are still supported.

— `object-views/config-tabs.md`

### The editor

> There are three main sections within the Object View editor: the **header**, the **object title bar**, and the **Workshop module**.

— `object-views/config-object-views.md`

`object-view-header-diagram.png` is an annotated diagram of that header and is
the densest single image in the section. Its labels, left to right:
*Ontology name* (`Ontology: Ontology`), *Object type* (`Airport`), *Form factor
selector* (a dropdown open on `Full view` / `Panel view`), *Object view version
number* and *Version of module being edited* rendered as `Object view ✓ v13 |
Module ✓ v0.11.0*`, *Selector for object to preview* (`PREVIEWING OBJECT` and
a picker), *Save and publish edits*, and *Open preview object in Object
Explorer*. Between them, unlabelled and undocumented: **undo and redo buttons**
and a **branch selector reading `Main`**. In manage-tabs.gif the version chip is
`v16*` with a pending glyph instead of a green check and the header adds
`Autosaved at 8:58 PM`; the trailing asterisk is the unsaved marker. That is
inference from the two captures together, not from prose.

Two other entry points into the same editor:

> In Object Explorer, an object type's configured Object View can be accessed when viewing an object by selecting **More > Advanced > Edit object view**.

— `object-views/config-overview.md`

`object-explorer-object-view-edit.png` shows that menu open and gives the whole
`More` menu, which the prose never enumerates: `Add to list`, `Export as
Excel` (with the caveat that order may not be preserved), `Copy for Notepad`,
and `Advanced`, whose submenu is `Edit object view — Edit the widgets displayed
for objects of this type.`, `Explore data lineage`, and `Configure in Ontology
Manager`. `ontology-manager-object-view-edit.png` gives the other entry point
and, incidentally, the Ontology Manager object-type sidebar as it stands today:
`Overview`, `Properties 19`, `Security`, `Datasources`, `Capabilities`, **`Object
views`**, `Interfaces`, `Materializations`, `Automations`, `Usage`, `History`.
That list is the answer to *where does an object view live in the manager*, and
it is only in that image.

### Managing tabs

> Selecting the gear icon opens a dialog that allows you to add, reorder, rename, and delete Object View tabs.

— `object-views/config-object-views.md`

manage-tabs.gif shows the dialog. Frame 60: a modal titled `Manage tabs` listing
`Arrival Delays`, `Departure Delays`, `Route Alerts`, each with a drag handle
and a chevron, above an `Add tab` button and a `Confirm` / `Close` footer.
Frame 150: a new row in edit state with a text field, a tick and a cross, and on
hover a window-with-arrow icon plus a red trash icon — the window icon is the
legacy door:

> To access legacy Object View configuration, navigate to the Object View editor for an object type, select the **Manage tabs** cog icon, and hover over a tab to select the **Open in legacy editor** icon.

— `object-views/config-legacy-object-views.md`

Frame 300 shows the new tab reordered above `Route Alerts` and a pencil for
rename; frame 430 is the settled four-tab list. The behind-the-modal editor in
those frames is a Workshop canvas: a `Layout` tree with a `Header`, pages
(`Arrival Delays (DEFAULT)`, `Page 1`) and a section tree, and a right-hand
section inspector with `ROW HEIGHT` as `Auto (max)` / `Absolute` / `Flex`,
`SECTION HEADER`, `STYLE`, `TITLE`, `ICON`, `CUSTOM COLOR`. That is Workshop's
own vocabulary, not the object view's, and it is why building configured views
means building on top of modules rather than beside them.

In the older editor the same list lives in a right-hand rail whose top-level
tabs are `Tabs`, `Sidebar`, `Settings`:

> Here is a list of tabs configured for the Airport object type. You can add new ones, remove or change the order of existing ones or jump directly to a tab to edit its configuration and widgets.
> — object-views/images/add-new-tab.png

move-tabs.png and delete-tab-in-editor-sidebar.png are the same rail with the
up/down arrows and the red cross highlighted respectively; each row carries both,
so reordering is by arrow rather than only by drag.

## 6. Tab settings and conditional visibility

> A **tab** is the main method of navigation and grouping content within Object View. Each tab contains a Workshop module and has customization options for conditional visibility, filtering settings, and layout settings.

— `object-views/config-tabs.md`

The settings:

> **Title:** The title setting controls the label shown in the tab list within the Object View.

— `object-views/config-tabs.md`

> **Content type:** You can use this configuration to specify a link type or link that appears within the tab, if relevant. If you select the *Link* option, you will see a badge next to the tab title in the Object View which shows how many objects are linked to the currently viewed object.

— `object-views/config-tabs.md`

That badge is visible in three images: `All Departing Flights 24,210` and `All
Arriving Flights 24,196` in add-new-tab.png, `flight-to-pfrs 5` in
access-yaml-config.png, and the whole left nav of overview-full-object-view.png
(`Visits 8`, `Diagnoses 5`, `Procedures 6`, `Prescriptions 5`) — which also
shows that a full Object View's tab strip can be rendered as a **vertical rail**
rather than a horizontal strip. The prose only ever says tab list.

> **Cross-section filtering:** Enable this setting to allow widgets within this tab to publish and consume filters controlled by interactions with the widget.

— `object-views/config-tabs.md`

tab-settings.png gives that setting's real shape: a section headed
`CROSS-SECTION FILTERING` with an `Enabled` checkbox and a free-text identifier
whose value is `filterSet-overview`. cross-section-filtering.png and
filter-across-tabs.png are the same panel with, respectively, the checkbox and
the identifier field ringed in red. In those two the `CONTENT LAYOUT` control is
a plain select reading `two-column`; in tab-settings.png it is a pair of
diagram choices, `Widget list` and `Single widget`, plus a `Column width`
segmented control of `Equal width` / `Wide left` / `Wide right`. **Two eras of
the same setting**, and the prose describes only the older one:

> **Content layout:** All legacy tabs support a two column widget list layout which is activated when widgets specify that they should be aligned to a specific column.

— `object-views/config-tabs.md`

Visibility has two documented conditions:

> **Property values:** This condition is fulfilled if the value of a property on the currently viewed object is equal or unequal to a given value.

— `object-views/config-tabs.md`

> **Link visibility:** This condition is fulfilled if the user viewing the tab has permission to see the object type to which the currently viewed object may be linked.

— `object-views/config-tabs.md`

tab-visibility.png shows both, and shows that the property condition is richer
than *equal or unequal*: the operator dropdown reads `is one of` and the value
is a removable chip list. The link condition names the object type and its link
name together, `Flight [Arriving Flight]`. The rebase dialog confirms the same
grammar independently:

> CONDITIONAL VISIBILITY Museum Name is one of Louvre Museum
> — object-views/images/object-view-rebase-conflict-resolution.png

The visibility pane also states its default in words, which matters for a
schema default: `This tab is currently visible to everyone.` Its sub-tab set
differs by tab kind — a Workshop-backed tab shows `Module | Visibility |
Settings | Advanced` (tab-visibility.png), a legacy one shows `Sections |
Visibility | Settings | Advanced` (tab-settings.png, configure-widgets.png,
delete-tab-in-advanced-settings.png). The first sub-tab is the tab's content and
its name tells you which builder made it.

## 7. Profiles

> **Profiles** enable you to configure how Object Views should be surfaced to users with different roles.

— `object-views/config-profiles.md`

A profile is an ordinary group carrying attributes:

> Object Explorer is powered by a service called `Hubble`.

— `object-views/config-profiles.md`

> Setting the `hubble:isDiscoverable` attribute to `true` will make the profile visible to users who are not members of the group itself. Omitting this attribute means that only users who are in the group can access views assigned to this specific profile.

— `object-views/config-profiles.md`

> Profiles are assigned on a tab level, meaning that for each tab you can assign specific profiles.

— `object-views/config-profiles.md`

> To set a default profile for a user or user group, add them as a member to the group backing the profile. This action will work only if a user is a member of a single profile.

— `object-views/config-profiles.md`

> You can add a maximum of ten profiles to each Object View.

— `object-views/config-profiles.md`

> Newly-created profiles may take up to five minutes to become available in the Object View editor.

— `object-views/config-profiles.md`

custom-object-views_profiles_multipass_ui.png shows four such groups named
`hubble-profile-engineering`, `hubble-profile-management`,
`hubble-profile-quality-control`, `hubble-profile-sales`, all in realm
`palantir-internal-realm`, with the attribute panel listing
`multipass:description`, `hubble:isProfile`, `hubble:displayName` and
`hubble:isDiscoverable` — so `multipass:description` sits alongside the three
the prose names.

switch-object-view-profiles.png and add-profile-to-object-view-tab.png give the
runtime and authoring sides. The picker is headed `Select a view profile` and
lists `General View` above a divider, then the profiles. **`General View` is a
first-class option, not the absence of one**, and the prose never names it.
switch-profile-view-editor.png makes the consequence legible: the editor rail is
headed `All tabs for Quality Control`, states `You are currently viewing the
Quality Control profile. There are 6 tabs across all profiles.`, and annotates
each row with its audience:

> Airport Overview Visible to the Engineering, Management, and Quality Control profiles. Passengers Overview Visible to all profiles and the General View.
> — object-views/images/switch-profile-view-editor.png

Four tabs render for that user against six configured — profile filtering is
visible in the same screenshot pair.

## 8. The applications sidebar

> The **applications sidebar** is used to display and embed applications, analyses, actions, and other resources related to the current object.

— `object-views/config-app-sidebar.md`

> The applications sidebar is an optional, opt-in addition per Object View. The sidebar is not visible to users until you add a group to it.

— `object-views/config-app-sidebar.md`

> The sidebar will not be displayed if it only contains an empty group or groups.

— `object-views/config-app-sidebar.md`

Groups, cards and actions. add-application-sidebar-groups.png shows the `Sidebar`
rail with two groups, `Management Consoles` and `Pinned Actions`, and a group
menu of `Reorder groups` / `Insert new group above` / `Insert new group below` /
`Remove group`. When the sidebar is collapsed its group names run vertically
down the right edge — `Management Consoles, Pinned Actions` in add-new-tab.png —
and when there are none the strip reads `No groups configured`
(access-yaml-config.png). application-sidebar-object-view.png shows the rendered
result: four cards, of which `Alert inbox (Workshop)`, `Passengers Capacity
(Slate)`, `Flight Delay Analysis (Quiver)` and `Airport COVID Response` carry
thumbnails while `External Website ↗` is a bare icon and label — the prose's

> (E) Select Card mode or Compact mode

— `object-views/config-app-sidebar.md`

configuring-applications-sidebar_applications-sidebar-config.png is the numbered
configuration figure and carries the one mechanism the prose leaves vague:

> Parameters allow you to pass details of the current object's properties or some predefined values into the application resource. Their values are accessible within the application using the names you provide. Some parameters are provided by default and their names can't be changed. The selected Workshop module must have promoted variables with external ids matching the parameter names.
> — object-views/images/configuring-applications-sidebar_applications-sidebar-config.png

The prose's version is looser:

> The parameter values are accessible within the embedded Workshop or Slate application as variables with the same name as the parameter name. In Workshop, these must be configured in the variable **Settings** panel as module interface variables.

— `object-views/config-app-sidebar.md`

The same figure shows a thumbnail field holding a RID of the form
`ri.blobster.main.image.<uuid>` — a resource kind our `rid-grammar.md` reading
does not list — and a group settings pane reading `This group is currently
visible to 3 profiles.`, so **sidebar groups take profile visibility too**,
which the prose mentions only as `(d) Edit visibility`.

For URL cards:

> By default, the details of the current object are available using these parameters: `{{objectId}}` & `{{objectTypeId}}`.

— `object-views/config-app-sidebar.md`

> If a user does not have permissions to the embedded application, they would not be able to open it but would still see the application card.

— `object-views/config-app-sidebar.md`

## 9. Actions in an Object View

The object-views section never says how an action reaches an object view. The
action-types section does, and this is where the review's F9 lands:

> Actions can be added to an [Object View](/docs/foundry/object-views/overview/) using the **Actions section**.

— `action-types/use-actions.md`

> * Change the default on-click behavior from opening the form to applying the action immediately using the default values (if valid).

— `action-types/use-actions.md`

> * Specify whether the button should be hidden or disabled if a non-visible parameter is invalid (the idea being that visible parameters could be corrected upon opening the form).

— `action-types/use-actions.md`

> * Provide a default value for each parameter; this can be a property value of the current object or a "local" value (current user, current timestamp, current object, or a manually entered value).

— `action-types/use-actions.md`

and two doors that need no configuration at all:

> 2. From the **Object Actions** dropdown menu in the Object View (top right).

— `action-types/use-actions.md`

> 3. From the **Linked objects view section** in the Object View (top).

— `action-types/use-actions.md`

The Actions section also exists as a legacy widget, and **only an image says
so**. The legacy tab's section list carries four entries with one-line
descriptions:

> Properties Displays properties of an object or a linked object Property Cards Visualize properties and aggregations over linked objects Linked Objects View Displays linked objects in a table, cards, or list view Actions Display actions that users can take on this object
> — object-views/images/configure-widgets.png

`Actions` appears on none of the five widget pages. I grepped the whole mirror
for its description and it occurs nowhere.

## 10. Versioning

> Saved edits to an Object View will be stored as a new version. A version can contain several changes, such as adding, editing, and deleting tabs.

— `object-views/manage-versions.md`

> There are separate [versions for each Workshop module](/docs/foundry/workshop/versions/) included in the Object View.

— `object-views/manage-versions.md`

> If **Automatically publish new versions** is enabled, this button will display **Save and publish** instead, and will publish both tab changes and any changes to the current Workshop module. Automatic publishing is enabled by default.

— `object-views/manage-versions.md`

> As you edit the Workshop module, it will be periodically auto-saved like any other Workshop module, but these changes will not be visible to users until the Object View is published.

— `object-views/manage-versions.md`

> The currently published version will be marked with a green checkmark. Prior published versions will show a grey checkmark. Versions that were never published will not have a checkmark.

— `object-views/manage-versions.md`

> If your Object View is actively used by many users or there are multiple editors collaborating on the view, we recommend disabling automatic publishing.

— `object-views/manage-versions.md`

object-view-save-publish.png shows the split button with the toggle popover
(`When enabled, new changes will automatically publish to users on save. Disable
to save versions without publishing.`) and, beside it, the branch picker.
object-view-edit-history.png is the version dialog and adds four things the
prose omits: versions are grouped by date; each carries an author and a time and
a **description**; each states its parent as `Based on v2`; the current one is
labelled `CURRENT`. It also draws the boundary between the two version
counters, which the prose only implies:

> The Object View history stores changes across all tabs in the Object View. To see content changes of each tab, view the module history in Workshop.
> — object-views/images/object-view-edit-history.png

And it shows what the *first* version is called, which is a creation signal:

> v1 Initial object view version Initial version
> — object-views/images/object-view-edit-history.png

## 11. Branching

> **OV-managed modules:** Capture Workshop content changes made to an object view on a branch. A separate OV-managed module is created for each full object view tab, the object instance panel, and the object set panel.

— `object-views/branching-object-views.md`

> **Full object view tabs:** Capture structural changes to object view tabs, including additions, deletions, renames, profile changes, and visibility condition modifications.

— `object-views/branching-object-views.md`

So the branch-visible resources are exactly two kinds: **one tabs resource per
object view** and **one module per tab or panel**. object-view-branch-resources.png
names them as they appear in the taskbar: `Full Object View Tabs`, the object
type row `Museum` (annotated `Indexed 3 days ago`), `Full Object View • Museum
History`, and `Panel Object View`. Only one panel resource is present although
the prose says a module exists for both panel kinds — either the object-set
panel had not been touched on that branch or it is not created until used; the
page does not say.

> Removing a full object view tabs resource automatically removes all of its associated tabs from the branch.

— `object-views/branching-object-views.md`

removing-object-view-branch-resource.png is the confirmation, and it enumerates
the dependents by name rather than by count.

Merging is stricter than editing — *but only under datasource-derived
permissions, a model the platform has replaced; see §20.2 before building
on this* — and the page's callout says so itself:

> Editing an object view on `main` only requires the `Editor` role on **any** of the object type's backing datasources. Merging changes from a branch requires the `Editor` role on **every** backing datasource.

— `object-views/branching-object-views.md`

> Object views and the Workshop modules that make up object view tabs and panels are logical children of the parent object type.

— `object-views/branching-object-views.md`

> Inherited resource protection is under development and will be released soon. Once available, it will prevent direct edits to `main` for an object view or its modules whenever the parent object type is protected.

— `object-views/branching-object-views.md`

> Tab configuration changes on a [full object view tabs resource](/docs/foundry/object-views/use-full-views-in-platform/) must be rebased separately from tab content changes.

— `object-views/branching-object-views.md`

> [Legacy object view tabs](/docs/foundry/object-views/config-legacy-object-views/) cannot be edited on a branch.

— `object-views/branching-object-views.md`

The two rebase images give the merge UI precisely. Three columns —
`Main branch`, `Current branch`, `Rebase result` — each of the first two with a
`Keep this version` radio at the top for taking a side wholesale. Rows align by
tab; a row absent on one side reads `Tab does not exist. Select to remove tab`;
added rows are green with a `+`, conflicting rows amber with a pencil; the
result column stays empty for an unresolved conflict and `Finish rebase` is
disabled until it is resolved.

> Review the latest changes to the object view tab configuration from the main branch. Non-conflicting changes have been auto-accepted, while conflicts require you to choose between the main branch and your current branch version. Note: changes to any tab content are handled separately in Workshop's rebasing process.
> — object-views/images/object-view-rebase-example.png

Expanding a conflicting row (object-view-rebase-conflict-resolution.png) shows a
per-tab diff with `Details` and `Visibility` sub-tabs and `PROFILES` /
`CONDITIONAL VISIBILITY` sections, with removed conditions in red `−` rows and
added ones in green `+` rows. **The diff is per field, not per tab.**

## 12. Permissions

*(§20.2 first: the two models below are the REPLACED ones; the current
project-based rule is edit access on the object type via the `Editor`
project role.)*

> * If the object type does not use Ontology roles, a user must have the `Object View Admin` application permission in [Control Panel](/docs/foundry/administration/enrollments-and-organizations-permissions/), as well as the `Editor` role on any of the object type's input datasources.

— `object-views/config-overview.md`

> * If the object type uses Ontology roles, the user only requires the `Ontology Editor` role on the object type.

— `object-views/config-overview.md`

> Unless you manually convert the Workshop module for an Object View tab to a standalone module through legacy configuration options, the Workshop module's permissions will be managed by the object type. This ensures that permissions between the module and the object type are kept aligned, so users with permission to edit or view the object type will also be able to edit or view all modules inside the Object View.

— `object-views/config-overview.md`

That last sentence is the one that matters for us: **an object view has no
access control of its own.** It inherits the object type's, except for tabs
deliberately converted to standalone modules.

## 13. Where an Object View appears, and its URLs

> Full Object Views provide comprehensive displays of an object's data. They are the primary view for the object in-platform and can be accessed within platform applications or embedded into custom Workshop applications.

— `object-views/use-full-views-in-platform.md`

> Within the panel, selecting the object's title will open the full Object View in a moveable and resizable modal.

— `object-views/use-full-views-in-platform.md`

vertex-full-object-view.gif shows exactly that: at frame 300 a modal titled
`Object View` sits over the Vertex graph; at frame 500 it has been dragged and
enlarged. workshop-object-view-widget-example.gif (frames 0 and 45) shows the
full view rendered inside a Workshop app under the caption `Object View Widget`,
and panel-object-view-in-workshop.gif frame 45 shows the panel there under a
widget header reading `Object Preview`.
overview-panel-object-view.gif (frames 0, 40) shows the same Patient's panel
beside a card grid, with its tabs rendered as a row of five icons rather than
labels — a rendering the prose does not mention.

The one place the two meet in Object Explorer is the results table:

> To open the object view for an object in a new Object Explorer tab, click the Title column for that object's row. To open a preview of the object view in your Results tab, select one or more objects by clicking the checkbox or any other column in the corresponding row.

— `object-explorer/view-results.md`

> If multiple objects are selected, the object view for any of the first twenty is available for previewing, displayed in a list of cards above the object view.

— `object-explorer/view-results.md`

object-explorer-full-object-view.png shows the result: a `Selection Preview`
panel on the right holding the configured full view with an `Open in tab` button,
while every Title cell in the table is a blue link.

URLs:

> If you are embedding these views within an iframe rather than providing them as links, append a URL query parameter `embedded=true`, which will load the view without the Workspace sidebar.

— `object-views/generate-urls.md`

> This way is recommended when the primary key property value could possibly have special characters.

— `object-views/generate-urls.md`

> This URL loads the Object View within the context of Object Explorer.

— `object-views/generate-urls.md`

The three route shapes the page prints are
`/workspace/hubble/external/object/v0/<object-type-id>?<primary-key-property-id>=<primary-key-property-value>`,
`/workspace/hubble/external/search/v2/?objectId=<objectRid>`, and the bare
`/workspace/hubble/objects/<objectRid>`.

## 14. Comments

> Multiple users often work with a particular object. To facilitate this cooperation, Object Explorer allows users to comment on an object, mention other users, and attach files and images.

— `object-views/comment-on-objects.md`

> You can open the Comments Helper for any object using the **View comments** button in the header of any Object View.

— `object-views/comment-on-objects.md`

> Object Explorer comments on an object are *not* related to the [Comment widget in Workshop](/docs/foundry/workshop/widgets-comments/).

— `object-views/comment-on-objects.md`

comments_in_helper.png is a crop showing the button with its tooltip, sitting
between a refresh icon and an `Actions` dropdown, under Object Explorer's
`Saved searches` and `Lists` menus. The whole page is six sentences and one
image; the Comments Helper itself is never shown.

## 15. Marketplace

> Marketplace products only support [Object View tabs](/docs/foundry/object-views/config-tabs/) that use the [Workshop tab](/docs/foundry/object-views/config-object-views/) builder. The legacy Object View builder is not supported. If you would like to package an Object View tab that leverages the legacy builder, you should first rebuild the tab with the Workshop tab builder.

— `object-views/marketplace-object-views.md`

> Once you have selected an Object View, you can select which tabs you would like to include in your product.

— `object-views/marketplace-object-views.md`

marketplace-add-tabs.png shows the dialog: an object type row
(`Car Part Issue`, with a status chip reading `Active`) and a per-tab toggle
list. Selection is per tab, not per view.

## 16. The legacy widget catalogue

Four pages of it, plus the layout page. It is closed to new tabs and still
supported, so it matters as documentation of *what an object view is expected to
be able to show* rather than as a thing to build.

> The building blocks of legacy Object View tabs are called **widgets**. Widgets are sometimes referred to as *Sections* or *Plugins*.

— `object-views/config-legacy-object-views.md`

> * Properties of the current object
> * Objects linked to the current object
> * Aggregations on properties of objects linked to the current object

— `object-views/config-legacy-object-views.md`

> You must set up the relevant objects and define links in advance within the Ontology metadata.

— `object-views/config-legacy-object-views.md`

Every widget has the same two format groups — `General` (Title, Icon, Help Info)
and `Layout` (Alignment, Sizing) — and widget-general-format-settings.png shows
the first three as they appear, with the widget config split across `Settings`
and `Format`. In a later capture, widgets_markdown-hubble-plugin-2.png, the same
panel's tabs are `Settings`, `Layout`, `JSON`; in widgets_hp-filter-container.png
they are `Settings`, `Format`, `Code Editor`. **Three different names for the
raw-configuration tab across three captures**, while the prose says YAML:

> You can reuse the configuration of a previously created widget by copying the YAML configuration.

— `object-views/config-legacy-object-views.md`

### 16.1 A tab's configuration, read off a screenshot

access-yaml-config.png is the only place in the whole section where the stored
shape of an object view is visible. Its code pane reads:

> id: overview title: Overview sections: - id: hu-properties_48edb8d6 sectionType: hu-properties configVersion: 3 config: title: Properties icon: properties propertiesToShow: object: current-object propertyFilter: type: prominent sections: - normal - long-text - keyword viewOptions: isEditable: true hideUndefined: false shouldLinkToMoreProperties: true layout: both sizing: {}
> — object-views/images/access-yaml-config.png

and the second section begins:

> sectionType: linked-objects-exploration- configVersion: 1 layout: both config: title: Other flights on this route icon: dashboard initialExplorationConfig: type: custom config: objectTypeId: flight-object filters: - type: parametrizedTerms operator: All propertyTypeIds: - arrival_airport_code ignoreNullValueFilters: false
> — object-views/images/access-yaml-config.png

Every one of those keys maps onto a prose-documented option — `propertyFilter:
type: prominent` is *Prominent Properties*, the three `sections` are the three
property sections, `shouldLinkToMoreProperties` is the *View all* link — so the
YAML is a faithful serialisation of the documented widget config, and it is the
only sample of one. Two other images give more `sectionType` values:
widgets_hu-tabs.png (`hu-filter-summary`, `hu-stats-overview`, `hu-chart`) and
widgets_hu-vertical-stack.png (`hp-multi-select-filter`, `hu-chart` twice). The
`hu-` and `hp-` prefixes match the image filenames throughout the section;
`hu-stats-overview` and `hu-chart` are documented on no page.

### 16.2 Properties and links

> The **Properties** widget displays properties of an object or a linked object.

— `object-views/widgets-properties-links.md`

> * Hidden: The property will not be displayed in the Properties widget (or anywhere in the Object View or Object Explorer). This option is used for properties such as internal IDs, relation-columns for links to other objects, and so on.

— `object-views/widgets-properties-links.md`

> Displaying properties of a Linked Object is possible only if the Current Object is linked to only one object…

— `object-views/widgets-properties-links.md`

Data options are `All Properties`, `Prominent Properties`, `Specific
Properties`, `No Properties` with a `Properties to Exclude` selector for the
first two; the three sections are fixed:

> You can remove or change the order of these sections. There are no additional types of sections to these three.

— `object-views/widgets-properties-links.md`

> The order in which properties are displayed is alphabetical. The main way to order properties in a different way is by using the "Sections" mentioned above, under the widget configuration.

— `object-views/widgets-properties-links.md`

widgets_hu-properties.png confirms the alphabetical order running down the left
column then the right, shows the greyed italic `No value` rendering, and shows
the keyword section as chips in a separate block at the bottom. It also shows
the widget titles carrying the mode in words — `Properties of the Flight
(Current Object)` and `Properties of Carrying Aircraft (Linked Object)`.

widgets_hu-properties-oma.png is the Ontology Manager property panel behind all
of this, and it enumerates seven render hints where the object-views prose names
two:

> Render Hints Selectable Sortable Disable formatting Keywords Long text Low cardinality Identifier
> — object-views/images/widgets_hu-properties-oma.png

with `Property visibility` as three radios (`Hidden`, `Normal`, `Prominent`), a
`Keys` block of `Primary key` and `Title key`, and a field labelled
`Authorization RID (not needed if RLPS row-level policies in use)`. Our
`readings/render-hints.md` covers the ten from
`object-link-types/metadata-render-hints`; this capture is a subset of that list
and I did not re-derive it here.

Property Cards:

> Use the Property Cards widget to display important properties (numeric, timestamps, dates, strings, etc.), aggregations, statistics, metrics, KPIs, and any other key information for the current object or for objects linked to it.

— `object-views/widgets-properties-links.md`

> In case of an aggregations, select the type of aggregation - count, unique count / cardinality, average, min, max, sum.

— `object-views/widgets-properties-links.md`

> The Property Cards widget does not support [Functions on Objects](/docs/foundry/functions/functions-on-objects/).

— `object-views/widgets-properties-links.md`

widgets_property-cards-config.png enumerates the layout options the prose only
names as a category: `Background` = `Important` | `Minimal`; `Size` = `Large` |
`Medium` | `Small` | `Tiny`; `Style` = `Detached` | `Joined`; `Alignment` =
`Bottom` | `Top`; `Icon style` = `Standard` | `Circle` | `Light circle`; and
`Number of columns`, which the prose does not mention at all.
widgets_property-cards.png shows two of those settings rendered together and
shows conditional formatting recolouring a value (a green date, a red `No`).

Links:

> The **Links** widget displays an object's links in a tree view, with the ability to traverse through Links and navigate to Linked Objects.

— `object-views/widgets-properties-links.md`

> This widget is currently not affected by filters. Links displayed are always *all* Objects linked to the current Object.

— `object-views/widgets-properties-links.md`

widgets_hu-links.png shows that the tree's group headers are the **link type
API names verbatim** — `flight-origin-airport-links:`, `flights-aircraft:`,
`flight-destination-airport-link:`, `flight-to-pfrs:` — not display names, and
that the list truncates with a footer bar reading `…and 24,213 more objects`.
Its Workshop successor keeps the hover preview and adds a label override and
per-link sorting:

> **Enable object preview on hover:** When hovering over on the title of a linked object, preview the linked object’s properties. By default, the popover includes the linked object’s prominent properties but can be configured for custom properties by specifying links.

— `workshop/widgets-links.md`

Edit History:

> Only changes made via Actions to the object will be shown in Edit History. Changes made in the backing dataset or in the pipeline upstream will not be reflected on this widget.

— `object-views/widgets-properties-links.md`

> Edit History will only reflect the changes made to objects indexed into Object Storage v2 after the [**Track user edit history**](/docs/foundry/object-edits/user-edit-history/) toggle is enabled within Ontology Manager.

— `object-views/widgets-properties-links.md`

> Tracking user edits for object types with marking properties is not supported at this time.

— `object-views/widgets-properties-links.md`

> Each submitted value is logged as an edit, even if it is coming from a default value configured in an action parameter.

— `object-views/widgets-properties-links.md`

widgets_hu-edits-history.png shows one entry's format, which the prose never
gives: an avatar, a headline of the form *someone changed N properties using
&lt;action type name&gt;*, a timestamp, and a card listing each changed property
with its new value. The modern equivalent lives in Workshop:

> can be added to Workshop modules or Workshop-backed object views to display edit histories.

— `object-edits/user-edit-history.md`

### 16.3 Visualization

> This widget is mainly used to display a *table* view of all Linked Objects of a certain type along with their relevant properties.

— `object-views/widgets-visualization.md`

Three view types — table, card, list — with the card view weaker:

> This option does not have the full functionality of the table view. For example, it does not support selection or Object Actions.

— `object-views/widgets-visualization.md`

> This widget is *affected by filters* from other widgets - if the toggle is on - but *does not publish filters* to other widgets sharing cross-filtering with it, even if the filter sidebar is open.

— `object-views/widgets-visualization.md`

widgets_linked-object-view-without-sidebar.png and
widgets_linked-object-view-with-sidebar.png are the two states the page names.
The second shows what *advanced* filtering actually is: a keyword box, an
`+ Add filter` button, collapsed rows reading `Arrival City is Tokyo` and
`Departure City is Chengdu OR Guangzhou OR London OR Singapore`, and, for a
timestamp property, a **histogram by year with a drag-selected range** plus a
`Relative` toggle and a `Range` selector. None of the histogram, the relative
toggle or the OR chips is in the prose.

Timeline and Grouped Events:

> Create a chronological list of events, displayed top-down, sorted by date and time.

— `object-views/widgets-visualization.md`

> For performance reasons, only 50 Linked Objects are displayed by default. As the user scrolls down through the list, additional objects will appear, 100 at a time.

— `object-views/widgets-visualization.md`

widgets_timeline.png's own header reads `Showing 25 of 74962 Events`, not 50 —
either the widget's Results limit was configured to 25 or the page is stale; I
cannot tell from the capture and the widget's config as documented has no
Results-limit option, only the Linked Object View's does.

> Grouped events are plotted on separate parallel lines, with each line including only events that have a property with a certain value, similar to a pivot table.

— `object-views/widgets-visualization.md`

> Max Number of Events - this option is currently not functional.

— `object-views/widgets-visualization.md`

widgets_hu-grouped-events-table.gif explains why that option does nothing. Its
frame 0 carries a warning strip reading `Only showing the 1000 most recent
events - modify the date range to show earlier events`, a list header of
`Showing 1000 events`, a group footer reading `Showing 15 of 56 Groups.` beside
an `Add more Groups` dropdown, and a date-range control reading `from 2 years
ago`. **A hard 1000-event cap, stated nowhere in the prose.** Frame 60 shows a
drag-selection on the graph acting as a filter, with the list header changing to
`Showing 10 of 681 events (clear selection)`. The list rows also label which
date property produced each row (`Scheduled Departure Time` /
`Scheduled Arrival Time`), which is what makes the documented
one-event-many-dates behaviour legible.

### 16.4 Filtering

> **Filter Widgets** allow users to apply different types of filters in order to drill-down into a specific subset of Linked Objects on that Object View.

— `object-views/widgets-filtering.md`

The cross-filtering contract is two settings, one per scope:

> In order to activate filters to apply across different widgets on a single tab of an Object View, or even across tabs, **you have to mark the checkbox of…**

— `object-views/widgets-filtering.md`

> …under the tab Settings has an identical text value across all tabs you wish to filter across. This value is case-sensitive.

— `object-views/widgets-filtering.md`

And the scope of a filter is per-view, per-session:

> Most of the Filter Widgets do not enable you to pre-configure filters to be active by default, such that would narrow down the view for the user (Filter Container is an exception, as it does allow you to set up pre-configured filters).

— `object-views/widgets-filtering.md`

> The user would be able to activate filters on their current view of the current object, but once they move to a different object or refresh, these filters would not apply.

— `object-views/widgets-filtering.md`

A filter always targets a *linked* object, never the object in view:

> In all filter configurations, you will select a Linked Object to the object that you are currently editing, and not the object that you are editing itself.

— `object-views/widgets-filtering.md`

The seven widgets, with the constraints each states:

- **Multiselect.** > The multiselect filter allows users to filter the Object View by multiple values

  — `object-views/widgets-filtering.md`

  > \[Optional] **Maximum Number Of Filter Options:** determines how many distinct values of the property to filter will be displayed. Set by default to 100.

  — `object-views/widgets-filtering.md`

  widgets_hp-multi-select-filter-1.gif frames 0 and 100 show it as a chip field
  over a checked list, with the widgets below going grey and spinning while the
  filter reloads.
- **Dropdown**, single-select, in two modes (`Dynamic List` and `Value List`).
  > The number of displayed values is limited to 100.

  — `object-views/widgets-filtering.md`

  > There is a limit to the number of dropdown filter boxes the UI is able to present under a single dropdown filter widget (around 7-8 different dropdowns).

  — `object-views/widgets-filtering.md`

  widgets_hp-dropdown-filter.gif frame 80 shows `All` as the first option, above
  the property's own values.
- **Button.** > This is a rigid filter; once configured by the Object View Editor, there is no configuration choice available to end users.

  — `object-views/widgets-filtering.md`

  > The Button Filter is off by default, so that it has to be clicked for the filter to apply.

  — `object-views/widgets-filtering.md`

  widgets_hp-buttons-filter.gif frame 90 shows selected buttons filled and
  unselected ones outlined, beside an Active Filters bar reading
  `Distance is greater than 1000` and
  `Destination State Name is one of Colorado, Michigan or Texas`.
- **Date Range**, which is the only one with an explicit submit:
  > Once configured, any widget in the Object View is affected once a date range is chosen and the user selects **Submit**.

  — `object-views/widgets-filtering.md`

  widgets_hp-daterange-filter.gif frame 110 shows the two date fields and the
  `Submit` button mid-click.
- **Linked Object Filter Sidebar.** > This widget enables a high degree of choice, but also higher complexity for the user. It requires the user to understand and know the properties of the Linked Object, while all other Filter Widgets (e.g. Dropdown Filter, Button Filter) pre-configure them.

  — `object-views/widgets-filtering.md`

  widgets_hp-filter-sidebar.gif frame 200 shows per-value counts with bars,
  hover actions `Exclude` and `Only`, a footer of `Including 1 of 32` and
  `Select all`, a `Show more` button, and a bottom bar of
  `Show 3 active filters` / `Collapse all` / `Reset`. All of that is
  image-only.
- **Filter Sandbox Container.** > The Filter Sandbox Container enables you to organize widgets into a container such that all filters inside it are sandboxed, meaning they only affect and are affected by other widgets inside this container.

  — `object-views/widgets-filtering.md`

  > Cross-filtering (filters affecting and being affected by other widgets inside the container) is always enabled for this container.

  — `object-views/widgets-filtering.md`
- **Filter Container**, which is the only widget carrying pre-set filters, with a
  two-toggle publish/subscribe matrix the page spells out in four cases.
  > The pre-defined filters are only applied within the container and do not apply on any widget outside the container.

  — `object-views/widgets-filtering.md`

  > Applying filters inside a filter container will also remove non-matching options in filter widgets, such as [Dropdown Filter](#dropdown-filter). If this behavior is not desired, use [Filter Sandbox Container](#filter-sandbox-container) instead.

  — `object-views/widgets-filtering.md`

  widgets_hp-filter-container.png shows the config with the annotations the page
  refers to, and names the object selector `Object Type to filter` where the
  prose calls it `Linked Object to Filter`.
- **Active Filters**, which has no configuration.
  > This widget displays a summary of all filters that are currently applied on the Object View, and allows the user to either remove individual filters or clear all filters.

  — `object-views/widgets-filtering.md`

  > Currently, it will not remove a filter applied by the Dropdown filter, and users would still need to manually change the value in the dropdown.

  — `object-views/widgets-filtering.md`

  widgets_hu-filter-summary-1.gif frame 160 shows the chip phrasing
  (`is one of A, B or C`, `is <value>`) and a red `Clear filters` link.

### 16.5 Layout

> Each Object View can have three levels of Layout control:

— `object-views/widgets-layout.md`

Tabs, then containers, then content widgets. Five layout widgets: Horizontal
Distribution, Vertical Stack, Tabbed Container, Conditional Container, Markdown.

> If the sum of pixels exceeds Object View limits (about 1150 pixels)…

— `object-views/widgets-layout.md`

> Using this tab is sometimes necessary in central objects in the ontology. However, be mindful that it adds complexity to the user experience, with "tabs within a tab".

— `object-views/widgets-layout.md`

The Conditional Container is the richest, and its condition grammar is the same
one the tab-visibility settings use:

> A conditional container enables content to be displayed or hidden according to a condition.

— `object-views/widgets-layout.md`

Three condition types — Filters (`Specific Filter` / `No Filter` / `Any
Filter`), Properties (`Is defined` / `Is not defined` / `Is one of` / `Is not
one of`), Linked Objects (exist / do not exist) — with the same cardinality
restriction as the Properties widget, and:

> If several conditions are added, conditions are evaluated from top to bottom - the sections of the first condition met will be rendered, and the others ignored.

— `object-views/widgets-layout.md`

> Arrays are currently not supported

— `object-views/widgets-layout.md`

Markdown:

> use the {{propertyName}} format, with double curly brackets, to template your Markdown content with the current object properties values.

— `object-views/widgets-layout.md`

> Enable sanitized HTML rendering - Safe HTML rendering with markdown-it. Embedding HTML from object properties are disabled; all property values are escaped for security.

— `object-views/widgets-layout.md`

> Currently, long texts and arrays included using the {{propertyName}} format might spill out of the text box and are not rendered by default.

— `object-views/widgets-layout.md`

widgets_markdown-hubble-plugin-1.png shows the source and its render side by
side (`The building number is {{BUILDING}}, on {{STREET}}.` becoming
`The building number is 9703, on 64 AVENUE.`), and
widgets_markdown-hubble-plugin-2.png is a markdown feature sweep whose headings
render in small caps — a stylesheet choice worth knowing before matching the
look. widgets_hu-tabs.png and widgets_hu-vertical-stack.png are the two
container config panels, both reading `(*)` beside their required list.

### 16.6 Apps and files

> **Apps and Files widgets** enable embedding, displaying, and linking other Foundry apps within the current Object View.

— `object-views/widgets-apps-files.md`

> Some of the widgets below are not object-aware. This means interaction with other widgets in the Object View is limited.

— `object-views/widgets-apps-files.md`

Slate gets by far the most space, and it is the only documented **event
protocol** between an object view and an embedded app:

> From the object view to the Slate application, the current object context and the active filter state are made available. From the Slate application to the object view, a set of events are provided within Slate which map to behaviors within Object Explorer, such as opening new Object or Exploration tabs and updating the object view filters.

— `object-views/widgets-apps-files.md`

> The object view filters are shared in the IObjectSetFilter format for easy use with the Object Set APIs available within Slate.

— `object-views/widgets-apps-files.md`

Nine message types are printed, all namespaced `HUBBLE_SLATE_WIDGET // …`:
`ACTIVE_FILTERS_UPDATED`, `ACTIVE_FILTERS_BY_OBJECT_TYPE_ID_UPDATED`,
`OPEN_OBJECT_BY_RID`, `OPEN_OBJECT_BY_PRIMARY_KEY`,
`OPEN_NEW_SEARCH_FOR_OBJECT_SET`, `PUBLISH_OBJECT_SET_FILTER`,
`CLEAR_PUBLISHED_FILTERS`, `REFRESH_OBJECT_VIEW`, `REQUEST_ACTIVE_FILTERS` and
`REQUEST_ACTIVE_FILTERS_BY_OBJECT_TYPE`. The open-by-RID payload notes it
`can optionally take a tabId if the object view should be opened on a specific
tab` — the third independent sighting of a tab identifier.

Media Preview:

> Attachment properties store the relevant media within Foundry and ensure that the media is correctly permissioned by inheriting the permissions from the object they have been added to.

— `object-views/widgets-apps-files.md`

> **Mark the column as a `hubble:media_url` in the Ontology:** Create a property for the column in the Ontology, and give it a Typeclass with kind = `hubble` and name = `media_url`.

— `object-views/widgets-apps-files.md`

> Other possibilities are `hubble:icon` and `hubble:thumbnail`. These will use this URL as the icon for an object or as a thumbnail in the search results cards, respectively.

— `object-views/widgets-apps-files.md`

widgets_hu-media-preview.png shows the widget is not a still preview at all but a
full document viewer, with page navigation (`1 of 4`), zoom, an
`Automatic Zoom` selector, download, and a find bar with `Highlight all` and
`Match Case` and a match count. widgets_hu-upload-files.png,
widgets_hu-import-additional-files.png and
widgets_hu-upload-additional-files.png are the three dataset-upload steps the
page's URL recipe depends on; the first confirms the option label
`Bundle all files as a single dataset` and shows the alternative,
`Upload as raw files without modifying the extensions (recommended)`.

Hyperlink, Linked Files, Iframe, Comments:

> If the hyperlink is broken, the user will be re-directed to the landing page of Object Explorer.

— `object-views/widgets-apps-files.md`

widgets_hyperlink.png shows two link buttons rendered with Blueprint intents
(grey `None`, red `Danger`) above a Properties widget with a `View all…` link.

> Files uploaded through this widget are not written-back as a part of the ontology, i.e. they are not saved as a property on the current object.

— `object-views/widgets-apps-files.md`

> There is currently no way to hide one of the two options, so it always shows both…

— `object-views/widgets-apps-files.md`

widgets_hu-linked-compass-resources.png shows exactly that: header actions
`Upload files` and `Link new file`, and an empty state.

> Hiding the report header is possible by adding the following to the URL: `&__rp_headerBar=hidden`.

— `object-views/widgets-apps-files.md`

> If the source dataset for an object type is changed, the corresponding comment feed will disappear.

— `object-views/widgets-apps-files.md`

> These comments are not captured on the object itself and do not enable any future search or reuse of this conversation across Foundry.

— `object-views/widgets-apps-files.md`

## 17. What the images carry that no sentence does

Collected, because these are the pieces most likely to be lost:

1. The generated default tab is titled `Overview` and its immutable id is
   `overview` (marketplace-add-tabs.png, delete-tab-in-advanced-settings.png,
   access-yaml-config.png).
2. A tab has a generated, uneditable **Tab ID**; three other pages address tabs
   by id without ever saying one exists.
3. The standard view's sections are named `Prominent`, `Properties` and
   `Linked objects`, and the three special renderings are a segmented control
   *inside* the Prominent section, not three sections
   (standard-full-and-panel-object-view.png).
4. `General View` is a listed profile option beside the real profiles, and each
   tab's audience is written out in the editor rail
   (switch-object-view-profiles.png, switch-profile-view-editor.png).
5. One object-view version per object type; one semantic version per module;
   the trailing `*` is the dirty marker (object-view-header-diagram.png,
   panel-object-view-type-switching.png).
6. Version history rows carry a description, an author, a time, a `Based on vN`
   parent, and a `CURRENT` marker; the first is `Initial object view version`
   (object-view-edit-history.png).
7. The editor header has undo/redo and a branch picker
   (object-view-header-diagram.png, object-view-save-publish.png).
8. `Object views` is a first-class tab of the object type in Ontology Manager,
   between `Capabilities` and `Interfaces`
   (ontology-manager-object-view-edit.png).
9. An **Actions** widget exists in the legacy catalogue and is on no widget page
   (configure-widgets.png).
10. `hu-chart` and `hu-stats-overview` are real section types with no
    documentation (widgets_hu-tabs.png, widgets_hu-vertical-stack.png).
11. A hard cap of 1000 events on the Grouped Events widget
    (widgets_hu-grouped-events-table.gif).
12. The Linked objects component keeps a per-hop breadcrumb with counts
    (linked-objects-component.png).
13. Panel display-size presets are `320 x 800`, `350 x 500`, `250 x 780`, plus
    application presets and manual entry; the module settings pane also carries
    `Desktop` / `Mobile`, `Marketplace features`, `Auto-refresh`, `Scenarios`
    and `Translations` (panel-object-view-configuration.gif).
14. The panel editor's canvas preset dropdown at the bottom names an
    application by name — `Gaia` (panel-object-view-type-switching.png,
    panel-object-view-configuration.gif).
15. Gaia's panel adds object metadata the object-views prose never mentions:
    `Added 7 months ago`, `Latest location 2 months ago`
    (panel-object-view-in-gaia.png).
16. Sidebar thumbnails are `ri.blobster.main.image.<uuid>` resources, and
    sidebar groups carry profile visibility
    (configuring-applications-sidebar_applications-sidebar-config.png).
17. Object Explorer's `More` menu contains `Add to list`, `Export as Excel`,
    `Copy for Notepad` and `Advanced`
    (object-explorer-object-view-edit.png).
18. `full-object-view-airport-example.png` is captioned in the prose as a
    `Rental` object view and is a screenshot of an **Airport** object. The
    caption is wrong.

## 18. Contradictions and gaps I found by grepping the corpus

1. **Auto-created versus user-created.** `overview.md` and
   `standard-object-views.md` both frame the configured view as something a user
   creates; `config-overview.md` says a default one is created for every object
   type automatically. The page that describes the mechanism concretely — and
   which the two default-composition pages agree with — is `config-overview`,
   so I take auto-creation as the fact and the other phrasing as older framing.
   It leaves a real ambiguity about which view is *default* for a type nobody has
   edited; see Questions.
2. **Toggling in Workshop.** `config-overview.md` says the standard/configured
   toggle `is not yet available in Workshop`, while
   `workshop/widgets-object-view.md` documents `Object View Mode:` as
   controlling which viewing option is displayed, `with an option to toggle
   between them`. The Workshop page is the later mirror (2026-08-18 versus
   2026-08-22 for the object-views section, so actually the *earlier* fetch) and
   the two cannot both be current. Unresolved.
3. **A third panel behaviour.** `config-panel-views.md` names two panel kinds.
   The Workshop widget names three:

   > **Adaptive:** Automatically switches between object instance view and object set view based on the input. When the object set contains exactly one object, it displays the object instance view. When the object set contains zero or multiple objects, it displays the object set view.

   — `workshop/widgets-object-view.md`

   `Adaptive` is a property of the *widget*, not of the object view, so I read
   this as no contradiction — but a builder reading only the object-views
   section would not know the mode exists.
4. **Single-tab hiding, said twice.** `config-object-views.md` and
   `workshop/widgets-object-view.md` agree:

   > Tabs are always hidden for object views with a single tab, so this is only applicable to object views with multiple tabs.

   — `workshop/widgets-object-view.md`

   Since the generated default has exactly one tab, **the default view shows no
   tab strip at all.**
5. **The Load button.** The `Geometry` property in
   toggle-core-custom-view-in-selection.png renders as a `Load` button rather
   than a value. The object-views section never mentions deferred loading; the
   Workshop widget does:

   > Some large properties, such as Geoshape and Vector, are not loaded by default to improve performance. In View mode, users can select **Load** next to an unsupported property to reveal its value on demand.

   — `workshop/widgets-property-list.md`

   Which tells us that panel is the *configured* view rendering a Property List
   widget, not the standard one — inference from the behaviour, since neither
   panel in that image is labelled.
6. **Timeline paging.** Prose says 50 then 100 at a time; the screenshot says
   `Showing 25 of 74962 Events`. Not reconcilable from what is on disk.
7. **Cross-navigation between tabs is impossible.**

   > This is not currently possible. One workaround would be to make your Object View a single tab, which is a single Workshop module, and then put your tabs in that module.

   — `questions-answers/object-views-community.md`

   A Workshop button cannot move the user between object view tabs. That
   constrains any design that treats tabs as a navigation model.
8. **Object View charts exist by name and by no page.**

   > this property will be aggregated in Object Explorer histograms and Object View charts

   — `object-link-types/metadata-render-hints.md`

   and

   > some Object View widgets will only allow filtering on properties with not many possible values

   — `object-link-types/metadata-render-hints.md`

   A `Chart Section` widget is visible in widgets_hp-filter-sidebar.gif. No
   mirrored page documents it. This is one of the three absent slugs, most
   likely `config-widgets`.

## 19. Connects to

- **`readings/object-explorer.md`** — the same service, `hubble`, and the same
  URL space. That reading covers the Results perspective; this one covers what
  clicking a Title cell is supposed to open. Our `ExplorationPage.tsx` renders
  title cells as inert `<td>` values and already has a `PreviewRail` that shows
  up to twenty selected objects — which is Foundry's card list that sits *above*
  an object view we do not have. The rail was built; the thing it sits above was
  not.
- **`readings/object-type-overview.md`** — `ontology-manager-object-view-edit.png`
  shows `Object views` as a sibling of `Overview`, `Properties`, `Security`,
  `Datasources`, `Capabilities`, `Interfaces`, `Materializations`,
  `Automations`, `Usage`, `History`. That is the tab list our OMA object-type
  page should carry, and the Object views tab is a preview surface with a
  `Full` / `Panel` switch, an object picker and an `Edit` button — not an
  editor.
- **`readings/workshop-foundation.md`** — every configured tab and panel *is* a
  Workshop module, so configured views are not a second application: they are
  modules whose owner is an object type and whose permissions come from it.
  Migration 685 already registers an `object_view` widget kind described as
  `Shows the object view of a single object`, and `apps/web/src/features/workshop/widgets.tsx`
  implements it by dumping the first row's properties into a `<dl>`. That is a
  placeholder for the thing this reading specifies, and the two must be
  reconciled rather than built twice. 685 also registers an event kind
  `open_object_view`; `grep` finds it in exactly two migrations and no
  TypeScript, so nothing can act on it — the engine-with-no-surface pattern
  CLAUDE.md names.
- **`readings/create-object-type.md`** — creation is where both views come into
  existence. If default views are generated on type creation, that generation
  belongs with `generate_backing_dataset` and the rest of the wizard's
  post-create work, not in a later phase.
- **`readings/render-hints.md` and `readings/properties-and-keys.md`** —
  `prominent` / `normal` / `hidden` is the sole input to both default views, and
  we already store visibility. The standard view is a *pure function of the
  object type*, which means it needs no new stored resource at all.
- **`readings/branch-overlay.md`** — object views add two new branch-visible
  resource kinds (the tabs resource and per-tab modules) with a
  logical-child relationship to the object type, and a rebase UI that diffs per
  field.
- **`readings/action-form.md` and F9 of the creation review** — the Actions
  section, the Object Actions dropdown and the Linked objects view dropdown are
  the three per-object action doors, and all three live inside the view this
  reading describes.

## 20. Corrected by the adversary pass (2026-08-28)

A foundry-adversary read the section whole against this reading before
anything was built from it. Two findings are blocking and re-taken here;
the rest are downgrades and completeness debt, recorded so the next reader
does not take the stronger claim. Where a §-above says otherwise, THIS
section wins.

**20.1 Decision 1 is RE-TAKEN — the tie-break was void.** I treated
`config-overview` as authoritative on auto-creation "over the softer
phrasing in `overview` and `standard-object-views`" — but the softer
framing is on `config-overview` itself, one section above the paragraph I
called authoritative, and I quoted only the half of the sentence that
agreed with me:

> Foundry creates a [standard Object View](/docs/foundry/object-views/standard-object-views/) for all object types by default. When you create a configured Object View, it becomes the default view for users, though they can switch back to the standard Object View through a toggle button packaged with the Object View.

— `object-views/config-overview.md`

> When you create a configured Object View, Foundry makes it available as the default view for a user; however, users can choose to select the standard view to see object data in its standard format.

— `object-views/standard-object-views.md`

The disagreement is intra-page, so preferring one page over another cannot
resolve it, and my "older framing" claim had no support (all three pages
carry the same mirror date, none is marked legacy). The reconciliation the
evidence now favours — INFERENCE, marked as such: the standard view is
what a user lands on until a configured view is created or the generated
default is edited; "Default configured Object Views are automatically
created" describes the scaffold the editor opens on, not the landing
default. Question 1 stays open but leans standard-first; the F8 route
should render the standard view first and treat the configured default as
the editor's starting point until the operator rules otherwise.

**20.2 §11-§12 encode the two REPLACED permission models.** My Permissions
section is built from `config-overview`'s two bullets — ontology roles and
datasource-derived permissions — which `object-permissioning/ontology-permissions.md`
says the project-based approach replaces. The current model was on a page
I read:

> When the object type uses [ontology roles](/docs/foundry/object-permissioning/ontology-permissions-legacy/#ontology-roles) or [project-based permissions](/docs/foundry/object-permissioning/ontology-permissions/), the contributor or an approving reviewer only needs edit access on the object type. This is typically granted through the `Ontology Editor` role under ontology roles, or through the `Editor` project role under project-based permissions.

— `object-views/branching-object-views.md`

And §11's merging-is-stricter-than-editing rule generalises a callout
the page scopes to datasource-derived permissions ONLY — under ontology
roles or project-based permissions no datasource role is involved at all.
This repo builds project-based permissions, so the build's permission
story is: edit access on the object type, through the `Editor` project
role. §12's conclusion survives — no page anywhere gives an object view
its own ACL — but scoped by 20.8 below.

**20.3 The one-`Overview`-tab default is INFERENCE, not an image fact.**
None of the three captures shows an unedited default:
`delete-tab-in-advanced-settings.png`'s header reads `Editing tab: Airport
Overview` over Tab ID `overview` (the title is NOT "Overview" there);
`marketplace-add-tabs.png`'s list is filtered to Workshop-built tabs, so
"exactly one" counts only those; `access-yaml-config.png` is a heavily
edited view at v34. What is decently attested: a first tab whose ID is
`overview`. The title and the exactly-one count — and §18.4's
no-tab-strip consequence — are downgraded to inference.

**20.4 The widget inventory was short by nine, and a third undocumented
sectionType.** Missing from §16, each named in the section's own pages:
Quiver Dashboard (`widgets-apps-files`), the Charts widget
(`widgets-filtering`, `widgets-apps-files`, `widgets-visualization`),
Linked Objects Gantt Chart (`widgets-visualization`), and Statistics,
Context Stat Section, Linked Statistics, Advanced Statistics, Property
Plus (all `widgets-properties-links`). The YAML I transcribed carries a
third undocumented sectionType, `linked-objects-exploration`, whose widget
— the Linked Objects Exploration widget — is named on
`object-explorer/configure.md`, a page outside my read lists. §18.8's
charts-exist-by-name-and-by-no-page claim survives but understated its own
evidence: three pages inside this section name the Charts widget.

**20.5 Two counts were wrong.** §13's seven-widgets heading tops a list of
EIGHT (`widgets-filtering` has eight widget sections); §16's nine-message-
types heading tops a list of TEN. Corrected here rather than in place so
the miscount stays visible as the lesson it is.

**20.6 The YAML-faithfulness claim holds for the first block only.** Of
the second block's keys, `initialExplorationConfig`, `parametrizedTerms`,
`ignoreNullValueFilters` and `shouldLinkToMoreProperties` appear in no
mirrored prose — the second block is an UNDOCUMENTED serialisation, which
is a finding, not a mapping.

**20.7 Completeness debt, named:** `branching-object-views`'s
Cross-application compatibility, Deployability checks and Approvals checks
sections; `config-panel-views`' Edit-configured-panel settings block
(Module Type, display size, resolution picker, fit-to-canvas);
`widgets-apps-files`' Quiver Dashboard and comment-writeback;
`config-overview`'s pin-a-default-display-object (a stored per-type
default, schema-relevant); `config-tabs`' enumerating sentence (the two
tab types are "Managed Workshop, and Standalone Workshop modules" — the
enumeration, where I took the bullet labels); `config-profiles`' Viewing
Object As entry point; three of six Actions-section options on
`action-types/use-actions.md` including per-parameter visibility
overrides.

**20.8 Smaller downgrades.** §8: sidebar-group profile visibility is in
the PROSE — config-app-sidebar's Edit-visibility bullet parenthesises
making the group visible to only specific user profiles — not an image
discovery. §12's no-own-access-control conclusion must not erase the
view-owned GATES: per-tab profile assignment
(`config-profiles`: omitting the attribute limits access to the group) and
tab visibility conditions are the view's own, even though ACCESS inherits
from the type. §18.7's heading overstates its body — a Workshop BUTTON
cannot cross-navigate (community answer, 2024-10-17); `OPEN_OBJECT_BY_RID`
takes an optional `tabId` and the Workshop widget has an initial-tab
setting, so cross-navigation exists by other doors. §17.5's per-type
version counter is INFERENCE from two unrelated captures, not a schema
fact. §18.2's currency-by-mirror-date arbitration compares fetch dates and
proves nothing. And I never grepped `docs/foundry-deep-dives/text/` (rule
3): five lessons mention object views; `01-ontology/fresh-air-operations`
places the IATA code "near the top of the Overview tab or on the
Properties tab" but its objects had custom views, so it does not settle
Question 6.

**20.9 Question 7 is CLOSED and Question 2 gains evidence.** The adversary
grepped all 1,248 `api/` files: zero hits for object view in any spelling;
the only Hubble tokens are HUBBLE_EXPLORATION_LAYOUT, HUBBLE_EXPORT,
HUBBLE_OBJECT_TYPE; and the Filesystem v2 resource-type enum lists
WORKSHOP_MODULE and HUBBLE_EXPLORATION_LAYOUT but no object-view resource
type. An object view has NO public API surface and is not a Compass
resource in its own right — corroborating `branching-object-views`'
logical-children framing, and a real input to the
materialised-vs-computed fork in Question 2.

## 21. Post-build reconciliation (2026-08-28, after #890)

Migrations 718/719 and the `/objects/:typeId/:pk` surface were built from
this reading through §20 and the operator's three gate decisions
(standard-first landing; the configured default computed until first edit —
a row in `object_views` IS the detach; the whole arc in one chunk). The
reconciliation pass re-read the key pages against what shipped. One delta
found and fixed the same day:

**21.1 The first cut conflated the two composition sentences.** The build
rendered prominent-OR-all-non-hidden — which is `config-overview`'s
sentence about the GENERATED CONFIGURED default — where the standard
view's own page composes differently:

> The standard Object View matches the object type's configuration by spotlighting prominent properties in either a dedicated table or in other visual formats if the property's [base type](/docs/foundry/object-link-types/base-types/) is a time series, media reference, or geospatial property. Normal properties are displayed in a regular table, and hidden properties are not visible.

— `object-views/standard-object-views.md`

Prominent properties are spotlighted ABOVE the table of the remaining
normal ones — both shown, hidden excluded. The surface now renders exactly
that (elevated cards over the property grid). The per-base-type visual
formats (media viewer, time-series chart, map) are residuals with the
stores they need.

**21.2 What the build holds and what it defers, checked.** The built
schema matches the reading's shape: one configured view per type as a
logical child (no project, no RID, no own ACL), tabs as Workshop modules
in the two enumerated kinds, the immutable tab id, the version bump, the
NULL-means-standard resolver, reads composed through `auth_in_ontology`
and writes through `can_index_object_type` (§20.2's current model). Every
residual named at the gate is recorded in this reading (per-tab profiles
and visibility conditions §7, panel views §5, sidebar config §8,
versions-with-restore, view branching §11, the pin-a-default-display
object §20.7, Marketplace §15) and the two structural ones also in 718's
own comments. One decision to keep visible: `UNIQUE(object_type_id)` —
one configured view per type — is OUR reading of the pages (the toggle is
binary, profiles vary per TAB); if a page ever shows several configured
views per type, the constraint is the first thing to fall.

**21.3 The suite lesson worth keeping:** a project-homed object type is
invisible to the `authenticated` role unless a real user (sub claim,
`users` row, project grant) stands behind the claims — the composed read
fails silently otherwise. Fixtures that probe composed policies must model
the user a real session always has.

## Decisions I had to make

1. **RE-TAKEN in §20.1 — read that first.** I treated `config-overview` as
   authoritative on auto-creation over the softer phrasing in `overview` and
   `standard-object-views`; the adversary showed the softer framing is on
   `config-overview` itself and my tie-break was void. The evidence now
   leans standard-first (§20.1's marked inference), and the
   two-views-at-creation consequence is back on the table for the human
   gate rather than settled.
2. **I did not treat the `Core` / `Standard view` label difference as a
   contradiction.** `core-object-views.md` is a duplicate of
   `standard-object-views.md` at an older slug, and `Core` appears in the older
   capture. I read it as a rename and recommend `standard` as the vocabulary,
   because the page that *defines* the pair uses it. Inference; no page states
   the rename.
3. **I read the two panels in `toggle-core-custom-view-in-selection.png` as
   configured (left) and standard (right)**, on the strength of the `Load`
   button being a Property List behaviour and of the right panel carrying the
   `Standard view` label. The image labels neither. Marked as inference in §18.
4. **I described GIF content from still frames and named the frames.** I wrote a
   throwaway GIF decoder to do it because the Read tool rejects files over 5MB.
   Motion, hover transitions and any menu I did not land on are unread; where
   that matters — the per-tab chevron menu in manage-tabs.gif and the
   Application-presets submenu in panel-object-view-configuration.gif — I said
   so rather than guessing.
5. **I recorded the section as partially mirrored** rather than assuming the
   three absent slugs are dead — deliberately, because re-mirroring is a
   change to the corpus and the task was to read it. RESOLVED after the
   reading landed: the orchestrator re-ran the mirror and fetched all three
   directly on 2026-08-28 — each 404s upstream. The section is whole; the
   URL index is what overcounts (it unions and never prunes).
6. **I did not propose a schema.** The obvious shape — an `object_views` table
   with a `form_factor` and an `object_view_tabs` child — is *not* obviously
   right, because the standard view stores nothing and the configured default is
   generated. Deciding whether the default is materialised at creation or
   computed on read is a design decision with a detach rule attached to it, and
   it belongs to whoever builds, with the F8 evidence in front of them. I have
   set it out in Questions 1 instead of choosing.
7. **I counted `_index` and `overview` (and `core-` and `standard-`) as two
   pages each**, so the header says 23 files rather than 21 distinct texts.
   Counting files is what the mirror holds and what the next reader will see.
8. **I attributed image quotations to the file rather than to a frame.** The
   checker resolves an image citation by file existence, and there is no
   convention here for citing a frame. Where the frame matters I named it in the
   surrounding prose.

## Questions I could not answer

1. **When there is a generated default configured view, which view does a user
   land on?** `overview.md` says the standard view shows `when no configured
   Object View is created`, but `config-overview.md` says a configured default
   is always created. Either the generated default does not count as *created*
   for defaulting purposes, or the standard view is never the landing view.
   Searched: every occurrence of `default` in the section, plus
   `workshop/widgets-object-view` (which has an `Object View Mode` setting but
   describes the widget's choice, not the platform's). **blocks: the object view
   route** — it decides what `/objects/<type>/<pk>` renders first.
2. **Is the default configured view materialised, or computed?** The detach rule
   (`once an Object View is edited it becomes user-managed`) reads naturally
   either way: a stored row with a `generated` flag, or nothing stored until the
   first edit. The distinction determines whether creating an object type writes
   rows. Searched: `config-overview`, `config-object-views`,
   `config-panel-views`, `branching-object-views` (whose branch resources are
   only ever shown for *edited* views), the version dialog image (whose `v1` is
   described as `Initial object view version`, which weakly favours
   materialised). **blocks: the creation-path migration.**
3. **What are the object set panel's five charts derived from?** The prose says
   up to five XY charts of aggregations grouped by property values but never
   which properties are chosen or in what order. Searched: `config-panel-views`,
   `workshop/widgets-chart` was not opened. **blocks: the object-set panel
   only** — the instance panel and full view are unaffected.
4. **Do the three absent slugs still exist upstream?** ANSWERED 2026-08-28:
   no — the mirror re-run failed all three and each URL serves a 404
   directly. `config-widgets`, the likeliest home of the undocumented
   Actions and Chart widgets, is gone upstream, so those widgets stay
   screenshot-attested only (`configure-widgets.png` +
   `action-types/use-actions.md`). **blocks: nothing** — the widget specs
   must come from the surviving pages and captures.
5. **What distinguishes the two link-type glyphs in the Linked objects
   component?** `Departure Airport` and `Destination Airport` carry one glyph;
   `Flight` and `Route Alert` carry another. Cardinality and direction both fit.
   Searched: `standard-object-views`, `object-link-types/link-types-overview`
   was not opened. **blocks: nothing** — cosmetic until we render link groups.
6. **Is a `Properties` tab a real thing?** The *View all* option

   > **Include link to 'More properties':** This option will render a **View all** button that takes the user to a **Properties** tab within the same object view.

   — `object-views/widgets-properties-links.md`

   implies a second tab named `Properties` exists alongside `Overview`, and
   access-yaml-config.png's tab strip does show `Overview` then `Properties`.
   Whether that tab is generated with the default or added by a builder is not
   stated anywhere. **blocks: the default-view generator** — it is one tab or
   two.
7. **What is the wire shape of an object view?** `api/` was not searched for
   this reading. Every structural fact above comes from prose and screenshots,
   including the tab id and the two version counters, and CLAUDE.md says `api/`
   has falsified our schema four times. Someone should grep it before any
   `object_views` table is designed. **blocks: the schema**, and I did not do it
   because it is a different corpus from the one I was asked to read.
8. **Does the object-set panel get its own branch resource?**
   `branching-object-views.md` says a module is created for the object instance
   panel *and* the object set panel; object-view-branch-resources.png shows only
   `Panel Object View`. **blocks: nothing today.**
