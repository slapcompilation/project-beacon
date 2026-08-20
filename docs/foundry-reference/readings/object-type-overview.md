---
verify: strict
---

# The object type Overview, and the four columns it would give a reader

**Why this reading exists.** I asked the database what it holds that no surface
reads — 869 columns across 106 tables, greped name by name against `apps/web`,
`packages/*` and `supabase/functions`. **121 are named nowhere outside tests.**
Four of them sit together on `object_types` and turn out to be one missing card:
`plural_label`, `point_of_contact`, `contributors`, `track_edit_history`.

They were added by 415 and 422, cited from the documentation at the time, and
nothing has ever displayed them. This is the same shape as `icon_color` in #718,
which CLAUDE.md counts as the repository's dominant defect.

**Page read:** `ontology-manager/overview`, in full — but this reading covers
only its **Object type view** section. The Discover, property editor, link type,
action type and function type sections are read and left for their own readings.

**Images parsed (2 of the 13 this page references):**
`ontology-manager/images/oma-user-interface-object-type-view.png` and
`oma-user-interface-overview-annotated.png` — the two the Object type view
section owns.

**Named and NOT parsed here**, because they belong to sections this reading does
not cover: `oma-navigation-annotated.png`, `oma-discover-view.png` (parsed in
`foundry-visual-language.md` instead), `oma-fallback-sections.png`,
`oma-customize-homepage.png`, `oma-type-group-section.png`,
`oma-user-interface-property-editor-v2.png` (parsed in that same reading),
`oma-user-interface-link-type.png`, `oma-user-interface-action-type.png`,
`oma-user-interface-action-type-observability-tab.png`,
`oma-user-interface-function-type.png`,
`oma-user-interface-function-type-observability-tab.png`.

---

## 1. What the page says

> Selecting an object type brings up the object type view, which has the following components:
> * Sidebar with page selections (on the left in the image below)
> * Selected page (on the right in the image below)

and then, unambiguously:

> The **Overview** page of an object type has the following sections, as numbered in the image below:
> 1. Object type metadata
> 2. Properties
> 3. Action types
> 4. Link type graph
> 5. Dependents
> 6. Data
> 7. Usage

**Seven sections on one page.** Not seven tabs — the annotated image shows them
stacked down a single scrolling Overview, with the sidebar beside it for the
*other* pages.

## 2. What the annotated image adds, section by section

The prose gives seven names and nothing else. Everything below is read off
`oma-user-interface-overview-annotated.png`.

**Above the sections**, a page header: the type's coloured tile, its label in
bold, a favourite star, and a subtitle reading `Object type · 4,464 objects`.
Right-aligned, two outlined buttons, `Actions ▾` and `Open in ▾`. A second row
carries the type-group chip `[Example Data] Aviation 14`, a divider, and
`✎ Edit groups`.

**① Object type metadata** — one card, two columns divided by a rule.

| left column | right column |
|---|---|
| `Plural name` → `[Example Data] Aircrafts` | `Status` → `Active ▾` |
| `Description` → `Represents an aircraft` | `Visibility` → `👁 Normal ▾` |
| `Aliases ?` → a `plane ✕` tag | `Index status` → `Not indexed on branch` |
| `Point of contact ?` → an `HB` avatar, with ✉ and ✎ at the right | `Edits` → `Disabled` |
| `Contributors ?` → `None` | *(rule)* |
| `Ontology` → `Ontology` | `ID` → `generated-6a437f16-…` |
| `API name` → `Generated59a386a3ddbf…` | `RID` → `ri.ontology.main.object-type.d5d…` |

Labels are sentence-case grey, values dark. Three fields carry a `?` help icon —
`Aliases`, `Point of contact`, `Contributors` — and no others. Status and
Visibility are **dropdowns in place**; Index status and Edits are read-only tags.

**② Properties** — `Properties 15` with a blue `⊕ New`. Each row is a base-type
glyph, the name, and an optional tag: `Title` in green, `Primary key` in violet.
The rows are **grouped by rules into three blocks**, and the first block is the
two keyed properties. What separates the second and third blocks I cannot tell
from one screenshot — it is not base type, because block two mixes string and
integer.

**③ Action types** — `Action types 1`, `⊕ New` greyed out. Inside, a banded
sub-header `References [Example Data] Aircraft` with its own count, then the
action rows.

**④ Link type graph** — `Link types 4`, `⊕ New`, and **two view toggles**, a
graph icon and a list icon, the graph one active. The canvas has zoom-in,
zoom-out and fit buttons stacked top-left, nodes drawn as bordered chips with
their coloured tiles, thin grey edges, and a `⊕ Create new link type` button
sitting in the canvas like another node.

**⑤ Dependents** — `Dependents 14`, two panes. Left, the kinds with counts and
the selected one filled pale blue: `Workshop 9`, `Function 2`, `Graph Template
1`, `Quiver Dashboard 1`, `Use cases 1`, then `Automation`, `Developer Console
App`, `Map Layer`, `Map Template` all at `0`. **Zero-count kinds are listed, not
hidden.** Right, the dependents themselves as blue links, and a `⊕ Create new`
footer.

**⑥ Data** — rows of `‹dataset› synced` with a right-aligned relative time
(`7 weeks ago`, `4 months ago`, `11 months ago`), scrollable, with a `See all`
footer link.

**⑦ Usage** — a bar chart with a `See more` link, y-axis at 0/4/8 and x-axis
labelled by month and year.

## 3. What we have, measured against that

Our type detail is a **vertical Blueprint `Tabs`** with `Overview`, `Security`,
`Datasources`, `Interfaces`, `Capabilities`, `Dependents`, `Usage` and a
conditional `Materializations`. `ObjectTypesPage.tsx` already carries a comment naming
sections 5 and 7 of this very list, so the mapping was started and left
unfinished. (Our own comments are not citations; the gate reminded me by
refusing that sentence when it was written with quote marks round it.)

| Foundry section | ours |
|---|---|
| ① Object type metadata | **absent entirely** |
| ② Properties | the `SchemaEditor`, and only while editing — no read-only list |
| ③ Action types | absent from the type view |
| ④ Link type graph | `LinkTypesSection`, on our Overview tab |
| ⑤ Dependents | its own tab |
| ⑥ Data | absent |
| ⑦ Usage | its own tab |

**The gap that has columns behind it is ①.** Every other missing section needs an
engine built first; this one needs only a card, because the data is already
stored:

| field | column | read by |
|---|---|---|
| Plural name | `object_types.plural_label` (415) | nothing |
| Point of contact | `object_types.point_of_contact` (415) | nothing |
| Contributors | `object_types.contributors` (415) | nothing |
| Edits | `object_types.track_edit_history` (422) | nothing |
| Aliases | `object_types.aliases` (415) | the ⌘K search only — never shown or edited |
| Status, Visibility | `status`, `visibility` | the header's `StatusControl` |
| API name, ID, RID | `api_name`, `id`, `rid` | the list, partly |
| Index status | the indexing state | the list's tag |

## 4. Verification pass — three decisions did not survive it

The operator asked whether these match the documentation exactly before building.
They do not. What follows is the adversarial pass, and it found that **I had
grepped the mirror and not the courses** — CLAUDE.md rule 3 says to read
`docs/foundry-deep-dives/` before concluding anything, and it is where the
decisive evidence was.

**CONFIRMED, and twice over.** `foundry-deep-dives/01-ontology.md` independently
records the same page:

> Object type Overview page: Plural name, Description, Aliases, Point of contact, Contributors,
> Ontology, **API name** (`UsernameFlightAlerts`); right box: **Status: Experimental ▾**, Visibility:
> Normal ▾, Edits: Disabled; **ID** (`username-flight-alerts`), **RID "Set on save"**.
> — docs/foundry-deep-dives/01-ontology.md

Same seven fields, same order, same right-hand box. It adds two things the
screenshot could not: **`RID` reads `Set on save`** before a type is first saved,
and the right box on a new type has **no `Index status` row** — that row appears
only once there is an index to have a status.

**Status and Visibility as dropdowns is confirmed in prose**, not just by a caret:

> 1. Select the dropdown next to the current status.
> 2. Select the new status.

— `object-link-types/metadata-statuses.md`

**`Edits` is no longer an inference.** It maps to a real per-object-type feature:

> logging all edits to an object is desired, [edit history](/docs/foundry/object-edits/user-edit-history/) can be enabled for an object type

— `action-types/action-log.md`

**FALSIFIED — Decision 6 was wrong.** I decided the plural name gets no
auto-derivation because no page said how it derives. Two sources say it does:

> 2. Name: `[<username>] Flight Alert` (plural auto-updates).
> — docs/foundry-deep-dives/01-ontology.md

> Note that the **Plural name** and **Object type ID** will auto-populate from **Name** for convenience.

— `pipeline-builder/outputs-add-ontology-output.md`

Migration 415's column comment had this right all along and I contradicted our
own migration. **Its wording, though, is a quotation of nothing:** the string it
quotes appears in no mirrored page, because the substance comes from the course
material. `check:readings` cannot trace it and never re-checks an applied
migration. Re-attributed rather than left as a false citation.

**CONTRADICTED — Decision 4 is a divergence, not a match.** §1 lists Dependents
and Usage as sections **5 and 7 of the Overview page**. Choosing to leave them as
tabs is us being *less complete* than Foundry, which is allowed but must be
scoped and declared rather than described as a match.

**UNVERIFIABLE — Decision 2's vocabulary.** Both fields are confirmed as object
type fields by two independent sources, and `None` for empty comes from the
screenshot. But **nothing states what a point of contact may be.** The only
prose on the concept is about Projects, and there it may be a **group**:

> Setting contact details for a group can be useful if you want to set a group as a Project point of contact in the Project resource sidebar.

— `platform-security-management/manage-groups.md`

415 made it `uuid REFERENCES auth.users(id)` — users only. If object types follow
projects, that is too narrow. Neither the API nor any page settles it:
`pointOfContact` and `contributors` **do not appear in the object type API at
all**, so the two-vocabularies rule applies and the Ontology Manager's prose wins
by default — except there is no prose.

### What the deep dive adds that we do not have

Its per-type left rail is `Overview, Properties, Security, Datasources,
Capabilities, Object views, Interfaces, Materializations, Automations, Usage,
History`. Ours has no `Object views`, `Automations` or `History`. Recorded, not
scoped here.

## Decisions

1. **Build section ① as a card at the top of our Overview tab**, in Foundry's
   two-column shape: metadata left, a status panel right, with `ID` and `RID`
   below a rule. This gives four dead columns their first reader and puts
   `aliases` on screen, where the search already depends on it.
2. **`Point of contact` and `Contributors` render as people, not uuids.** They
   are `auth.users` references; the card resolves them to a name or initials, and
   shows `None` where empty, which is what the screenshot does.
3. **Status and Visibility stay dropdowns in place**, as the image shows, and
   reuse the existing `StatusControl` rather than growing a second one.
4. **Do not move Dependents and Usage onto the Overview.** Foundry shows them in
   both places; we have them as tabs and duplicating them buys nothing until the
   Overview is a real dashboard.
5. **Do not build ②, ③ or ⑥ in this pass.** A read-only Properties list, an
   Action types section and a Data sync list are each their own engine, and
   bundling them makes a large change impossible to attribute.
6. **REVERSED after verification: `plural_label` DOES auto-derive from the
   name, and the operator may override.** The course material says the plural
   auto-updates and Pipeline Builder says it auto-populates from Name for
   convenience. Migration 415 had this right; my first decision contradicted our
   own migration because I grepped the mirror and not the courses.
7. **Declared divergence, scoped:** our Overview will carry section ① and ④ only.
   Foundry's has all seven. Sections ⑤ and ⑦ stay as tabs — we have them, and
   duplicating them onto the Overview buys nothing until it is a real dashboard.
   ②, ③ and ⑥ are unbuilt engines. This is us being *less complete* than Foundry,
   not stricter, and it is recorded here so nobody reads the Overview as finished.
8. **`RID` shows `Set on save` until the type is first saved**, and the
   `Index status` row is absent until there is an index — both from the course
   material, neither visible in the screenshot.
9. **Do not narrow or widen `point_of_contact` in this pass.** It stays a user
   reference. Whether a group may hold it is unsettled — the only prose on the
   concept is about Projects, where a group may — and widening it on that
   analogy would be inventing a mechanism. Question 5.

## Questions

1. **What groups the Properties list into three blocks?** Not base type. Possibly
   the datasource, possibly a property group we do not model.
2. **What does `Actions ▾` contain on the type header?** The image shows the
   button closed.
3. **Is `Edits` the same flag as `track_edit_history`?** The column was added by
   422 for object edit replay and the label sits in the status panel reading
   `Disabled`. The mapping is inference, not quotation.
4. **Does `Open in ▾` have a meaning for us?** It lists other Foundry
   applications, most of which we do not have.
5. **May a group be an object type's point of contact?** For a Project it may.
   For an object type no page says, and the field is absent from the API.
6. **Where do `Object views`, `Automations` and `History` belong?** The course
   material lists all three on a type's left rail and we have none of them.
