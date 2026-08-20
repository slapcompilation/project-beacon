---
verify: strict
---

# Foundry's visual language, measured rather than described

**Why this reading exists.** The operator's judgement was that our UI "has some
of the feeling of Foundry, but it's not identical or pretty close". Every earlier
attempt to answer that question here was made by eye — §5.1 of
`home-and-navigation` records the platform chrome as a very dark neutral in a
range, beside a nearest-Blueprint column — a guess with an error bar on it.

**Method.** Foundry's screenshots are mirrored as PNGs, so the colours are on
disk and can be counted rather than estimated. A dependency-free decoder (zlib is
in node core) inflates each image, un-filters the scanlines and tallies every
pixel. What follows is measurement, not impression: percentages are of total
pixels in that image.

**Pages read:** `slate/concepts-styles` in full — the page CLAUDE.md names as its
founding failure, and this is the first reading to cover its Colors, Icons and
Custom fonts sections rather than one sentence of it.

**Images measured (12):** `ontology-manager/images/cleanup-navigation-from-homepage.png`,
`cleanup-configuration-navigation.png`, `cleanup-start-cleanup-button.png`,
`oma-navigation-annotated.png`, `oma-user-interface-navigation-homepage-sidebar.png`,
`oma-discover-view.png`, `save-review-edits-error.png`,
`object-link-types/images/create-object-type-metadata-step.png`,
`functions/images/tsv2-functions-helper-run.png`,
`compass/images/compass-files-landing-page.png`,
`foundry-branching/images/homepage.png`, `getting-started/images/homepage.png`.

The header said **11** over a list of **10** from the day it was written, and
`check:readings` passed it: the guard compared a claim against a *page's*
screenshots and never compared a number against the paths beside it. It does
now, and this line is what it caught first.

---

## 1. Foundry uses Blueprint's palette unmodified

Every colour measured resolves to a Blueprint token exactly. Not approximately —
the same hex.

| measured | share of image | Blueprint token |
|---|---|---|
| `#ffffff` | 45–78% | `$white` |
| `#f6f7f9` | 12–55% | `$light-gray5` |
| `#dce0e5` | 1.4% | `$light-gray2` |
| `#edeff2` | 1.4% | `$light-gray4` |
| `#5f6b7c` | 0.6% | `$gray1` |
| `#1c2127` | 0.2–0.4% | `$dark-gray1` |
| `#2d72d2` | 0.3% | `$blue3` |
| `#252a31` | 8.7% | `$dark-gray2` |
| `#2f343c` | 1.4% | `$dark-gray3` |

Taken from `@blueprintjs/colors@5.1.16`'s own `_colors.scss`, not from memory.
The page says why this would be so:

> Blueprint provides a range of [core and extended color names ↗](https://blueprintjs.com/docs/#core/colors) that have been chosen with WCAG 2.0 compliance in mind (for accessible application design).

— `slate/concepts-styles.md`

**The palette is already accessible.** That sentence is the one our own
stylesheet argued with.

## 2. Ours is a systematically darkened copy, and that is the mismatch

`globals.css` defines its tokens as HSL, with a comment on each explaining the
deviation — cooler than default, one step sharper, blue3-deep for AAA on white.
Every one is a near-miss in the same direction.

| role | Foundry (measured) | ours | delta |
|---|---|---|---|
| page background | `#f6f7f9` | `#f1f3f7` | darker, cooler |
| card / surface | `#ffffff` | `#ffffff` | — |
| border | `#dce0e5` | `#d0d5dc` | **much darker** |
| body text | `#1c2127` | `#1a1f25` | darker |
| muted text | `#5f6b7c` | `#5d6776` | slightly off |
| primary | `#2d72d2` | `#285aaf` | **much darker, duller** |
| danger | `#cd4246` (`$red3`) | `#c3373b` | darker |
| success | `#238551` (`$green3`) | `#277b5a` | darker |
| warning | `#c87619` (`$orange3`) | `#c97509` | near |

The primary is the loudest: `#285aaf` sits between `$blue1` and `$blue2`, two
steps below the blue Foundry actually uses. Every button, link, active nav row
and selected tab in the product is that colour, so a two-step error there is
most of the "not identical".

**The reason it was done is written in the file — "AAA on white" — and the reason
it should not have been is written on the page: the palette was already chosen
for WCAG compliance.** We solved a solved problem and lost the resemblance doing
it.

## 3. The type scale is the other half, and it is bigger than the colour

Blueprint's scale is 14px body, 12px small, 16px large. It has no 10px and no
11px. Ours, counted across `apps/web/src`:

| size | uses |
|---|---|
| `text-[10px]` | 178 |
| `text-xs` (12px) | 156 |
| `text-[11px]` | 135 |
| `text-sm` (14px) | 67 |
| `text-base` (16px) | 9 |

**469 of 545 — 86% — are below Blueprint's body size, and 313 are at sizes
Blueprint does not define.** Our base is right (`font-size: .875rem` = 14px);
almost nothing uses it. Foundry's screenshots are comfortable at 13–14px
throughout; ours renders the same information two to four pixels smaller at every
level, which reads as a denser, more cramped product even when the colours match.

## 4. Font, and one clue worth marking as inference

Ours is IBM Plex Sans. Blueprint's default is the system stack, and the
screenshots were captured on macOS (they show ⌘K), so Foundry's rendered text
there is the system face.

The page's custom-font section supports uploading an OTF and binding it by RID,
and its worked example names the family:

```css
@font-face {
    font-family: alliance1;
```

— `slate/concepts-styles.md`

**Inference, flagged:** `alliance1` is very likely Palantir's brand typeface
(Alliance), which would make it Foundry's own UI font rather than the system
stack. The page does not say so — it is an example of the upload mechanism — and
Alliance is commercial, so this changes nothing we can ship. Recorded because the question of why their
text looks the way it does now has a candidate answer that is not our font being
wrong.

## 5. Icons: the page shows Blueprint v6, and so are we

> ```html
> <span class="bp6-icon-standard bp6-icon-clean"></span>
> ```

— `slate/concepts-styles.md`

The prose defuses it immediately — "The method for referencing Blueprint icons
varies by version… follow the Icon CSS API instructions for your specific
version".

**This reading first said "we are on v5", and that was false.**
`apps/web/package.json` pins `@blueprintjs/core: ^6.12.1` and
`@blueprintjs/icons: ^6.9.1`. The claim cost something: seven `bp5-` selectors
were live in `apps/web/src` and matched nothing — the branch taskbar's white
button and tag styling, and a non-ideal-state size override. Fixed with this
reading. The lesson is the cheap one: **our own version is in a file, not in my
memory**, and a wrong reading of it hid dead CSS behind a plausible sentence.

## 6. What §5.1 estimated, now measured

`home-and-navigation` §5.1 read the platform chrome as a very dark neutral
somewhere between two Blueprint greys. The measurement resolves it: the sidebar is
`#252a31` (`$dark-gray2`) at 8.7% of the Compass landing page, with `#2f343c`
(`$dark-gray3`) for raised rows. **Ours uses `#1c2127` — one step darker than
Foundry's.**

Everything else §5.1 says holds: the platform chrome is dark, every application
is light, and no Ontology Manager capture contains a dark region at all.

## Decisions

1. **Delete the deviations. Foundry's palette is Blueprint's, so ours is too** —
   the light tokens take `$white`, `$light-gray5`, `$light-gray2`, `$dark-gray1`,
   `$gray1`, `$blue3`, `$red3`, `$green3`, `$orange3` at their published values.
   Contrast was never the problem the deviations solved.
2. **The platform sidebar moves from `$dark-gray1` to `$dark-gray2`**, measured,
   keeping `$dark-gray3` for the active row.
3. **The type scale is a separate change**, not folded in here. It touches 313
   call sites, changes layout rather than only colour, and mixing it with a
   palette swap would make a visual regression impossible to attribute.
4. **The font stays IBM Plex Sans.** Alliance is commercial and unshippable, and
   the measured evidence for it is an example variable name.
5. **Blueprint is v6 and the corpus is v6**, so `bp6-` is the prefix everywhere;
   every `bp5-` selector in `apps/web/src` was dead and is gone.
6. **The sidebar takes the numbers in §7**, and the old-Ontology-Manager captures
   are not measured against again for anything but history.

## 7. The Ontology Manager sidebar, counted

**The trap, first.** I measured this twice and the first set was off a different
product. `ontology-manager/images/cleanup-*.png` and
`oma-user-interface-navigation-homepage-sidebar.png` are the **old** Ontology
Manager: a column of white cards on the page, an `Overview` row, `Search results`,
`Advanced`, `Properties` nested under `Object types` with an elbow connector, and
a selected row drawn as a white fill inside a **blue border**.
`home-and-navigation.md` line 67 already labels one of them "older OMA" and its
§5.2 already lists the two selection styles as separate rows. I read neither
before measuring, and calibrated the live sidebar to a product Foundry replaced.

The current one is `oma-discover-view.png` — a 2x capture, so every device pixel
below is halved. Where the two eras disagree the old one is quoted for contrast,
because the difference is large enough to matter: the old sidebar is 275px on a
44px row pitch, the current one 252px on 33px.

| property | current OMA | old OMA | ours before |
|---|---|---|---|
| pane | 252px, bordered right | 275px card, 22px gutters | 240px |
| row pitch | **33px** | 44px | ~32px |
| row box | **30px**, 3px apart | 38px, 6px apart | 32px, touching |
| icon | **16px** | 16px | 14px |
| icon from pane edge | **18px**, or 23px under `Resources` | 18px | 16px |
| icon → label | **8px** | 12px | 10px |
| icon colour | **gray1 `#546071`** | gray1 | inherited the label's |
| label | **14px**, dark-gray1 `#1f2328` | 14px | 13px |
| count | **16px pill**, light-gray4, dark digits | 22px pill | loose 11px text |
| group heading | **14px semibold**, indented to 23px | (none) | 12px |
| selected fill | **`#eaf1fd`** — blue4 at ⅛ over white | `#fafbff` + a `#7ca4ed` border | primary at 14% |
| selected label | **blue2 `#215db0`** | blue3 | blue3 |
| rule between groups | 1px light-gray4, full width | full width | inset |
| rule inside `Resources` | 1px, **stops 21px short each end** | (none) | — |

**The one structural finding.** `Resources` is not a heading over a list, it is an
**indented block**, and it runs further than it looks: every icon from
`Object types` down through `Cleanup` sits 5px further in than `Discover`'s, the
counts are inset by the same 5px on the right, and the rules *inside* it stop
short at both ends while the rule *above* it bleeds the full pane. `Health issues`
and `Cleanup` are inside that block, not a group below it — we had them below it.

**Icons, named from an 8x crop of the icon column** (`scratchpad`, not committed).
Fifteen rows, left to right: a two-tone compass needle, `people`, `history`,
`cube`, `properties`, `globe`, `arrows-horizontal`, `take-action`, `grid`,
`inheritance`, two interlocked rings, `function`, `pulse`, `clean`, `cog`.

Ours matched every one it has except **`Interfaces`, which used `layers` where
Foundry draws `inheritance`** — a box with an arrow leaving it, which is the
right picture for the concept and not the one we had.

**Inference, flagged:** the `Discover` glyph is a bare two-tone needle 9px wide.
Blueprint's `compass` — what we use — draws a circle around its needle, and no
circle is present at any zoom. I could not name the icon Foundry uses from the
image, so ours is left alone and this stays a question.

## 8. The header, counted

Same capture, same 2x halving. The header itself was already right — 48px, white,
1px bottom border — and so were the branch and `New` controls at Blueprint's 30px
button height. Three things were not.

| property | Foundry | ours before |
|---|---|---|
| application icon | **50px wide, full header height, square corners, flush at x0**, `#eef3ff` fill, a three-tone blue cube ~23px | 28px violet `#7961db` rounded 6px, inset 12px, white 16px cube |
| title | **16px**, starting 66px in | 15px, starting 50px in |
| search field | **352 x 32**, light-gray5 `#f5f6f8`, centred on the **header** | flexible to 520px, 30px tall, light-gray4, centred on the leftover space |

**The search is centred on the header, not on what is left of it.** Measured
centre 615.75 against a header centre of 614.5; centring it in the gap between
the brand and the actions would put it at 637. That is a 22px difference and it
is why the header never quite sat right.

**The application icon is the correction that matters**, because
`home-and-navigation.md` §6.2 described it as "a blue-violet rounded-square app
icon holding a white 3-D cube" and we built exactly that. It is none of those
things. Both eras agree on a flush, square-cornered, pale-blue block running the
full height of the header.

**Inference, flagged:** Foundry's cube is artwork in three blues, not an icon
font glyph, so ours draws Blueprint's `cube` in the darkest of the three
(`#1e52a7`) on the same pale block. That is as close as a monochrome glyph gets.

## Questions

1. **Does Blueprint v6 change the palette?** Nothing measured disagrees with
   v5's `_colors.scss` and we are on v6, so this is not urgent.
2. **What icon is `Discover`?** A bare two-tone needle, 9px wide, no circle
   around it — so not `compass`, which is what we draw. Unresolved from the
   image; ours is left alone until it is.
3. **What is Foundry's actual body size in CSS pixels?** §3 said the device
   pixel ratio was unknown; it is not. **A 1px CSS rule is a hairline, so a
   divider's thickness in device pixels gives the ratio directly** — 2px on
   `oma-discover-view.png`, 1px on the cleanup captures. What the ratio does not
   settle is the font size: glyph ink measures 11.5px tall for a
   no-descender label, which puts the face anywhere from 12px to 15px depending
   on how much of the edge is antialiasing. The type-scale change still anchors
   on Blueprint's published scale, not on this.
4. **Is `oma-discover-view.png` colour-accurate?** Its greys sit 2–4 units off
   the cool Blueprint tokens the other captures hit exactly — its divider reads
   `#e6e6e8` against `#eeeff2` elsewhere — so the image looks slightly
   desaturated. Hues survive it (the blue fill measures cleanly), so it was used
   for geometry and structure, and the other captures for grey hue.
