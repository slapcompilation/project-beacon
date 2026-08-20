---
verify: strict
---

# The Resource List widget, and what it settles about icons

**Why this reading exists.** The operator pointed at
`workshop/widgets-resource-list` as a page that "provides multiple images of
resources to understand the UI". It does — seventeen of them, more rendered
Foundry chrome in one page than anything else I have read. It is a Workshop
widget page, so it does *not* answer the Ontology Manager table question
(`foundry-visual-language.md` Question 6). It answers three others, and it
falsifies a column we shipped.

**Pages read:** `workshop/widgets-resource-list` in full, every paragraph.

**Sublinks I did not read**, listed so the next session knows they are owed:
`workshop/concepts-variables`, `workshop/concepts-events`,
`dataset-preview/overview`, `slate/overview`, `object-explorer/overview`, and a
`carbon/overview` that is not mirrored here at all.

**Images parsed (17 of 17, all of them):**
`widgets-resource-list-overview.png`, `-compass-resources.png`,
`-compass-resources-subtypes.png`, `-object-types.png`,
`-object-types-subtypes.png`, `-object-sets.png`, `-minimal.png`,
`-classic.png`, `-prominent.png`, `-image-card-minimal.png`,
`-image-card-classic.png`, `-image-card-prominent.png`,
`-overrides-activate.png`, `-overrides.png`, `-event.png`,
`-event-selection.png`, `-event-selected-reference.png`.

---

## 1. What the widget is

> The **Resource List** widget is used to display various types of Foundry resources

Three list types, each with a static and a dynamic form:

> * Static: users can manually define a list of resources to display in the list.
> * Dynamic:
>   * Recent: resources that have been recently interacted with by the user.
>   * Favorite: resources that have been favorited by the user.
>   * Folders: resources located in a list of projects and/or folders specified by the user.
>   * Tags: users can specify a list of tags so that resources that have one of these tags will be displayed.

and for object types:

> * All: every object type visible to the user in the Ontology.
> * Prominent: object types that are visible to the user that have been marked as prominent.
> * Favorite: object types that have been favorited by the user.

**`Prominent` is an Ontology property of an object type, not a widget setting** —
"marked as prominent" is done in the Ontology and read here. We already have it:
migration 321 defines `visibility IN ('prominent','normal','hidden')`. Nothing to
change; recorded because a second page now independently confirms the vocabulary.

## 2. Two formats and three styles, and the OMA's cards are one of them

> * Two item formats:
>   * List
>   * Image cards
> * Three display styles:
>   * Minimal
>   * Prominent
>   * Classic

Six screenshots show all six combinations. What the prose does not say, and the
images do:

| style | list format | image-card format |
|---|---|---|
| Minimal | bare rows, 1px rules, **regular-weight** title | thumbnail, then icon + regular title + description, no border |
| Classic | bare rows, 1px rules, **semibold** title | thumbnail, then a **bordered footer block** with semibold title |
| Prominent | **each row is its own bordered card**, larger icon in a tile | the **whole item is a card**, thumbnail inside it |

**This is what the Ontology Manager's Discover cards are** — image-card format,
Prominent style. `foundry-visual-language.md` §9 measured that card at 298x181
and recorded its 30x30 icon tile as measured but unbuilt. This page shows what
goes in it.

## 3. The icon treatment, and it is two treatments

Consistent across five screenshots, and I looked for a counter-example:

- **Object types and object sets** render as a **saturated rounded tile with a
  white glyph** — Aircraft on red, F1 Driver on orange, Airport on red, Case on
  violet, Alpine Peaks on green, Alert on red, State (COVID-19) on green.
- **Files and Projects resources** render as a **pale tinted tile with a coloured
  glyph** — Workshop modules as violet-on-pale-violet.

So an object type's `icon` and its colour are one filled tile, and a resource's
icon is a tinted one. The overview screenshot shows both, one above the other, in
the same module.

## 4. What it says about icon colour, which falsifies our column

> * Icon: Can be overridden with a choice of the name and a predefined or custom color.

The configuration panel shows what "the name" and "predefined" mean:

> ICON NAME … Endorsed
> ICON COLOR … Orange 5
> — workshop/images/widgets-resource-list-overrides.png

**`Endorsed` is a Blueprint icon name.** `Orange 5` is a **Blueprint palette entry
named by ramp and step**, and its swatch measures `#f0b66e` against Blueprint's
`$orange5` `#fbb360` — the same desaturation this corpus shows elsewhere, and no
other Blueprint orange is within reach.

**Ours is a free hex string.** Migration 586 gives `object_types.icon_color` a
`CHECK (icon_color ~ '^#[0-9A-Fa-f]{6}$')`, and
`packages/platform/src/datasourceMapping.test.ts:240` asserts that the value
`'blue'` is *rejected*. Foundry's own picker offers exactly that kind of value.

The page permits both — "a predefined **or custom** color" — so a hex is legal for
the custom case and the column is not wrong. It is **under-specified**: it cannot
record that a colour *is* `Orange 5` rather than a hex that happens to match, and
we offer no picker at all.

**And nothing reads it.** `grep` for `icon_color` across `apps/web` and
`packages` returns one test and no surface. That is the dominant defect class in
this repository — an engine with no caller — and this is the fourteenth instance.

## 5. The configuration-panel grammar

Six screenshots of the right-hand panel agree on a consistent grammar, and this
is the part with the widest reach in our own product:

- A field label is **uppercase, letter-spaced, gray1**, followed by a **`?` help
  icon**: `TYPE OF THE RESOURCE LIST ?`, `HEADING TEXT ?`, `FORMAT ?`, `STYLE ?`,
  `DISPLAY OVERRIDES ?`, `ICON NAME`, `ICON COLOR`, `THUMBNAIL POSITION ?`.
  Measured on `-image-card-minimal.png` (2x, from a 2-device-pixel input border):
  **cap height 9 CSS px**, ink `#616b7a` — gray1 exactly. A 12px uppercase face
  has a cap height of 8.6px; a 14px one has 10.1px. **So the label is 12px.**
- An optional section carries a **toggle on the right of its label**, and its
  contents are **indented behind a thin vertical rule** when on.
- An enum choice is a **segmented control**, and they nest two deep:
  `Static | Dynamic`, and under Dynamic, `Recent | Favorite | Folders | Tags`.
- A picked resource is a **chip**: icon, blue link text, and a red trash button.
- A variable is a chip with a **`$` prefix** — `$Resource list 1 Selected object
  type` — plus a pencil and an `✕`.
- An event list is a full-width outlined **`⊕ Add event`** button; an added event
  becomes a bordered block with its own parameter fields.
- The panel is titled `Resource list 1` with the widget kind set right-aligned in
  **uppercase grey** (`RESOURCE LIST`), over tabs `Widget setup | Metadata |
  Display` and a red trash icon.
- Drilling into one item pushes a **`‹  Resource 1`** back-header inside the panel.
- The event picker is a popover with a `Filter...` search and an **uppercase bold
  `APPLICATIONS` section heading** — Blueprint's `MenuDivider` with a title.

## 6. What this settles, and what it does not

**Settles — the uppercase micro-label question.**
`foundry-visual-language.md` §11 shipped 91 sub-12px sizes up to 12px and left a
concern on the record: several raised labels are `font-bold uppercase
tracking-widest`, and I wrote that "Foundry's current Ontology Manager uses no
uppercase micro-label anywhere I have measured", so the treatment might now read
too loud. **This page shows the idiom is Foundry's own**, used on every field
label in every configuration panel, in gray1, and **at the same 12px we moved
to**. The concern is closed in favour of what we shipped.

**Does not settle — Question 6, the table header case.** This page contains no
data table. The two-era question is untouched.

**Does not settle — Question 2, the `Discover` icon.** Not present.

**Partially — Question 5, blue2 or blue3.** A checked toggle measures `#4070cb`,
nearest `$blue3`, in a capture that desaturates. Link text is blue but not
sampled cleanly. Not enough to move `--primary`.

## Decisions

1. **Do not change `icon_color`'s CHECK.** The page permits a custom colour, so a
   hex is legal, and narrowing to a token set would be stricter than Foundry —
   which CLAUDE.md forbids.
2. **Build the object type icon tile**, on the Discover card and anywhere a type
   is listed: a saturated rounded tile in `icon_color` with a **white** glyph,
   30x30 on the card. This gives `icon_color` its first reader.
3. **Do not build a colour picker in this pass.** The predefined set is
   Blueprint's palette by ramp and step, which we can enumerate from
   `@blueprintjs/colors`, but a picker with no surface consuming it repeats the
   very defect §4 names.
4. **Keep the uppercase field-label idiom** at 12px gray1, and stop treating it
   as a divergence.
5. **Nothing in §5's panel grammar is built from here.** It is recorded for the
   Workshop arc, and it is a Workshop page, not an Ontology Manager one.

## Questions

1. **Does an object type's tile use `icon_color` as the fill, or as the glyph?**
   Every object-type tile I measured is a saturated fill with a white glyph, so
   fill — but I have not found a page that says so in prose.
2. **What is the predefined colour set exactly?** "Orange 5" implies ramp x step,
   and Blueprint publishes five steps per ramp, but no page lists the ramps
   Foundry offers.
3. **Does the Ontology Manager use the same uppercase field labels as Workshop?**
   §5 is measured on Workshop panels. The Ontology Manager's own property editor
   (`oma-user-interface-property-editor-v2.png`) shows `Name`, `Description`,
   `Base type`, `Status` in **sentence case** — so the two applications may
   differ, and our Ontology Manager surfaces are the ones that matter.
