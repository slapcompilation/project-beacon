---
verify: strict
---

# Platform experience

The Known-gap entry says "Platform branding", and the page says the branding
is one tab of six: **Platform experience** in Control Panel is Home page URL,
Languages, Platform logo, Platform title, Platform version, and Static banner
— the tab bar in every capture confirms the set. Reading the whole page
instead of the logo paragraph is exactly the failure rule 1 of "How to read a
Foundry page" exists to prevent, and here the images carry half the
specification the prose omits.

**What I read, counted rather than asserted.**
`administration/configure-platform-experience` whole (149 lines). **Images:
five of thirteen parsed** — `configure-platform-logo.png`,
`configure-platform-title.png`, `configure-static-banner.png`,
`configure-homepage-url.png`, `configure-languages.png`. The eight I did not
parse are all of the Platform-version subsystem, which §5 rules out of scope:
`configure-platform-version.png`, `platform-version-switcher.png`,
`platform-version-switcher-dialog.png`, `platform-version-switcher-request.png`,
`platform-version-default.png`, `platform-version-default-dialog.png`,
`platform-version-default-request.png`, `version-tag.png`.

## 1. Who configures, and at which scope

> "You can configure platform logos per Enrollment if you have **Enrollment administrator** permissions. If you do not have those permissions, then you can only configure logos per Organization."

— `administration/configure-platform-experience.md`

The logo and title tabs carry an Enrollment/Organization scope list on the
left (`configure-platform-logo.png`, `configure-platform-title.png`); the
banner tab has no scope list at all — it is per-Organization only, matching
the prose. The page's viewing gate names three roles: Enrollment
administrator, Organization administrator, User experience administrator.

## 2. The logo: four sizes, a published fallback table, four formats

> "The platform logo can be configured per Enrollment and Organization, replacing any occurrences of the default Palantir logo with an image of your choice. You can provide up to four different logo sizes: favicon, small, medium, and large. If you do not provide an image for each size, then Foundry uses an appropriate fallback size. The favicon does not have any fallback behavior. When customizing your logo, you should upload a favicon and *at least* one of the other three sizes."

— `administration/configure-platform-experience.md`

The fallback is an enumerated TABLE, not a description: Favicon → none;
Small → Medium, Large; Medium → Small, Large; Large → Medium, Small. The
order within each row is the preference order.

What the capture adds: the format vocabulary — "SVG and PNG format images are
recommended, and often look best. JPEG and GIF format images are also
supported" (`administration/images/configure-platform-logo.png`) — and
per-size guidance: the favicon "must be legible at a resolution of just 16x16,
and look good against both light and dark backgrounds"
(`administration/images/configure-platform-logo.png`), sized for roughly four
millimeters on screen; the small logo is "a compact icon used when the medium
sized platform logo would be too detailed"
(`administration/images/configure-platform-logo.png`), roughly five. Each size
is an upload slot with a current-image preview row, naming the default
Palantir favicon and, on the other sizes, the fallback logo.

## 3. The title

> "The platform title can be configured per Enrollment and Organization and replaces references to the platform with the provided title. The default platform title is `Palantir`."

— `administration/configure-platform-experience.md`

Renaming also renames the in-platform documentation ("`ABC documentation`").
The capture (`configure-platform-title.png`) adds a scope-worthy caveat the
prose omits: "This feature is currently in development. Not all references may
be replaced." — so even Foundry ships title replacement incomplete, which
licenses an incremental consumer set here.

## 4. The static banner: half its spec is only in the capture

> "You can configure a static banner per Organization that renders at the top, bottom, or top and bottom of every page. The **Banner text** field supports basic Markdown syntax. This setting is disabled by default."

— `administration/configure-platform-experience.md`

`configure-static-banner.png` carries the rest: a **Text color** field
(default #FFFFFF) and **Banner color** field (default #2D72D2 — Blueprint's
blue), a Position segmented control reading Top | Bottom | Top and bottom, a
**Show when printing** toggle (on in the capture), a **Show with
classification banner** toggle (off) explained as "If a CBAC banner is
configured for the current user, the static banner is hidden by default.
Enable to show the static banner below the CBAC banner.", an escaping note
("Special Markdown symbols such as *, ~, _, and # may need to be escaped by a
backslash"), and a live preview drawing the banner as a full-width bar in the
banner color with centered, uppercased, bold text.

## 5. The three tabs this platform cannot hold yet

- **Languages**: a fixed picker of ten languages plus two browser-preference
  toggles (`configure-languages.png`). We have no localization system; a
  language table with no translator is an engine nothing reaches.
- **Platform version**: stable/beta/prior needs a versioned frontend we do
  not have, and both its Manage dialogs write through the Control Panel
  Approvals inbox — a recorded separate gap. Its eight captures are the
  unparsed ones in the header.
- **Home page URL**: expressible today (an Organization default plus group
  overrides, "the first matching group setting is used, falling back to the
  organization default if none match" — `configure-homepage-url.png`), and
  its consumer is the post-login redirect. Deferred as its own small chunk,
  recorded, so the branding chunk stays one PR.

## Decisions

1. **Three tables, real columns, no settings-blob**: `platform_logos`
   (scope + size + image bytes + content type), `platform_titles` (scope +
   title), `platform_banners` (organization + enabled + text + text color +
   banner color + position + show-when-printing). Scope is a nullable
   `organization_id` — NULL is the Enrollment row, because this deployment IS
   the enrollment and no enrollments table exists to point at.
2. **Vocabularies from the page and its captures**: sizes
   favicon/small/medium/large (prose); content types SVG/PNG/JPEG/GIF (the
   capture's format sentence); banner positions top/bottom/top_and_bottom
   (the segmented control). Defaults: banner disabled, text #FFFFFF on
   #2D72D2, show-when-printing on.
3. **The fallback table is a resolver function**, `platform_logo(org, size)`:
   organization row first, then enrollment row, then the platform default —
   and within a scope, the page's own per-size preference order. Favicon
   falls back across SCOPE but never across SIZE.
4. **Writers**: organization rows by that organization's administrators
   (auth_role owner/admin — the same gate the audit export uses, from the
   same permissions page family). Enrollment rows have NO writer until
   enrollment-level permissions exist; the callout says exactly this split
   and the fail-closed half is recorded, not invented around.
5. **Org row beats enrollment row** where both exist. The page never states
   precedence — marked as inference; the callout's "you can only configure
   logos per Organization" reads as the narrower scope being the operative
   one for that organization's users.
6. **The consumers ship in the same arc**: favicon link swap, sidebar brand
   mark, document/platform title, and the banner bar (top/bottom/both,
   markdown links, print visibility via CSS). The
   show-with-classification-banner toggle is NOT built: no CBAC banner exists
   here for it to interact with, and a column nothing reaches is the defect
   this repo keeps finding. Recorded with the CBAC material.
7. **Our defaults are ours, marked**: the default title here is `Beacon`, not
   `Palantir` — the mechanism is what is copied, not the trademark — and the
   image bytes are capped at 1 MiB per size (no published cap; favicon
   guidance says 16x16, so a cap is hygiene, and the number is ours).

## Questions

1. **Does an Organization logo replace the Enrollment logo per size, or per
   set?** If an org uploads only a favicon, does its sidebar logo come from
   the enrollment set or the org's (empty) set? Unstated. Decision 3 resolves
   per SIZE (org favicon, enrollment medium) as the least surprising blend.
   `blocks: nothing` — the resolver pins it either way.
2. **What exactly does each size render in Foundry's shell?** The capture
   names browser-tab for favicon and "too detailed" contexts for small, but
   the medium/large placements are never named. Ours: small for the collapsed
   rail, medium for the expanded sidebar header, large for the sign-in page —
   marked as inference from the millimeter guidance. `blocks: nothing.`
