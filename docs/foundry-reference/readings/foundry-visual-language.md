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

**Images measured (11):** `ontology-manager/images/cleanup-navigation-from-homepage.png`,
`oma-navigation-annotated.png`, `oma-user-interface-navigation-homepage-sidebar.png`,
`oma-discover-view.png`, `save-review-edits-error.png`,
`object-link-types/images/create-object-type-metadata-step.png`,
`functions/images/tsv2-functions-helper-run.png`,
`compass/images/compass-files-landing-page.png`,
`foundry-branching/images/homepage.png`, `getting-started/images/homepage.png`.

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

## 5. Icons: the page shows Blueprint v6, we are on v5

> ```html
> <span class="bp6-icon-standard bp6-icon-clean"></span>
> ```

— `slate/concepts-styles.md`

The prose defuses it immediately — "The method for referencing Blueprint icons
varies by version… follow the Icon CSS API instructions for your specific
version" — so v5 is not wrong. Recorded because it dates the corpus: Foundry's
current UI is Blueprint **v6**, and any pixel comparison against a v6 screenshot
carries whatever v6 changed.

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
5. **Blueprint stays on v5.** The page explicitly scopes icon syntax per version.

## Questions

1. **Does Blueprint v6 change the palette?** The corpus shows v6 class names; our
   measurements come from screenshots that may predate or postdate that. Nothing
   measured disagrees with v5's `_colors.scss`, so this is not urgent.
2. **What is Foundry's actual body size in CSS pixels?** The screenshots are at
   unknown device pixel ratios, so 13–14px is read off proportions rather than
   measured. The type-scale change should anchor on Blueprint's published scale,
   not on my estimate from an image.
