---
verify: strict
---

# Reading — Slate: styles

Pages read in full:
- `mirror/slate/concepts-styles.md`

Read, and nothing below quotes them: `mirror/slate/style-overview.md`,
`mirror/slate/applications-style-text.md`, `mirror/slate/styles-global-stylesheet.md`.
They place the three stylesheet scopes around the one page this reading rests
on; no sentence of theirs is load-bearing here.

Images read: `images/global-stylesheets.png`, `images/text-css3.png`,
`images/theme-dark-mode.png`. (`text-css1`, `text-css2` are earlier frames of the
same walkthrough as `text-css3`.)

---

## What the pages say

**Blueprint is the substrate, not a choice.** "Slate is built on top of the
Palantir open source Blueprint framework and, like any other website, styles the
DOM using CSS." Blueprint supplies the consistent look and a built-in Dark Mode
toggle, and these are "not 'skins' or 'templates', but rather built in to each
Slate widget."

**Styling is override work.** A specific UI means "providing a set of style
overrides that provide new rules", and the stated difficulty is knowing where
Slate's defaults apply and writing "a CSS selector with the correct level of
specificity to override it". The recommended tool is the browser Inspector.

**The CSS is LESS.** Compiled on page load, so inspected output can differ from
what was written. Global stylesheets are the exception: "support only CSS and do
not support Less."

### Three scopes

| scope | rule | quote |
|---|---|---|
| Widget styles | per widget, inherited by a container's children | "avoid putting styles into individual widgets" for larger projects |
| Local stylesheet | **exactly one per application** | "Each Slate application has exactly one local stylesheet" |
| Global stylesheets | space-level, shared across applications | experimental; CSS only |

**The intended pattern is named classes, not utilities:** "define new classes in
the **Styles** panel and apply them to individual widgets using the **Additional
Classes** configuration."

Widget styles are explicitly a development tool: they "can collide with styles
from the stylesheets, which can lead to unexpected results… custom styles should
only be used for development and iterations, while the stylesheet is ideal for
managing complex styles."

### Blueprint's three surfaces

- **Colors** — "chosen with WCAG 2.0 compliance in mind", referenced as LESS variables.
- **Components** — read the **CSS API**, not the JavaScript API, to see whether the
  `pt-x` class plus plain HTML reproduces the component.
- **Icons** — by class, version-dependent: `<span class='bp6-icon-standard bp6-icon-clean'>`.

### Dynamic styling

"All CSS styles must be static" — no template expressions inside a class. Three escapes:

1. **Dynamic Additional Classes** — pre-define classes, pick between them at runtime.
   For large apps, "a central function that determines all the correct classes to
   apply to all the different widgets for any given condition and then return a
   more complex map between a widget and the correct classes."
2. **`style` attribute** — templatable, but only on HTML widgets and table cells.
3. **`?$theme=dark`** — loads the page dark; one-time, does not persist.

**Custom fonts** — upload an `.otf` to Foundry, then `@font-face` with the blob
**rid** as `src`.

---

## What the images add, that the prose does not

**`global-stylesheets.png` — the Styles Editor.** The most informative image, and
none of this is in the text:

- The editor has **two tabs: `Styles` and `Variables`**. Variables is never
  mentioned in prose on any of these four pages. **Unknown: what Variables holds.**
- Left rail: a `LOCAL STYLESHEET` section with a single entry named `localStyles`
  — confirming "exactly one" is a UI constraint, not just prose.
- Below it `GLOBAL STYLESHEETS` with **`+ NEW`**, a **search filter**, and the list
  split into **`1 USED IN APPLICATION`** and **`NOT USED`**. Used ones carry a
  delete icon.
- Names carry prefixes: `g_globalStylesheet1`, `c_customStylesheet1…`. **Inference,
  not stated: `g_` global, `c_` custom.**
- Right pane: a `Name` field, the **`Use in application`** toggle (on), and an
  **`Updated`** button greyed out when there is nothing pending — matching the prose
  that edits preview live but only persist on Update.
- A **`Dark theme`** toggle sits at the bottom of the editor.
- The CSS on screen exposes Slate's own DOM: `body`, `div.canvas-body`,
  `.pt-compass-bar`, `sl-app-widget .spinner`. So **`pt-` is Blueprint and `sl-` is
  Slate**, and the platform chrome is styleable by an application's stylesheet.

**`text-css3.png` — the widget editor.** The panel is titled **`DOCUMENT CSS`**.
Shows the cascade result: `sl-markdown` styles every markdown widget blue, `#w1`
overrides one to red, both coexisting.

**`theme-dark-mode.png` — the Foundry shell.** Incidental to styles but directly
relevant to our own nav: a narrow left icon rail, top to bottom — collapse, home,
search, notifications (unread dot), what's-new/gifts (dot), history, files, an
apps grid, then the active application, then a starred folder; at the bottom a
product logo, help, and account. The canvas fills the rest.

---

## Connects to

- **`mirror/object-link-types/create-shared-property.md`** — visibility
  (`prominent` / `normal` / `hidden`) is "an indication to user applications for
  how prominently to display the property". Ontology metadata drives presentation,
  which is the seam where our styling meets our object types.
- **`mirror/workshop/overview.md`** — "All Workshop components follow a unified
  design system". Same Blueprint substrate, different builder.
- **Our `apps/web/src/styles/globals.css`** — is the local-stylesheet tier and
  nothing else yet.
- **Our `features/foundryShell/`** — `theme-dark-mode.png` is the shape it imitates.

## Decisions taken from this reading

- **Blueprint stays, on citation** rather than preference.
- **No Tailwind.** Styling is CSS we own.
- **The three tiers are NOT built yet.** Widget styles and Additional Classes exist
  because a *user* composes widgets and needs an escape hatch. We have no
  widget/application layer, so the tiers would be shape without a consumer. They
  land when that layer does — decided 2026-08-06.

## Open questions

- What does the Styles Editor's **Variables** tab hold? Nothing on these four pages
  says. Likely LESS variables, given the colours paragraph, but that is inference.
- Is the `g_` / `c_` prefix a convention or enforced?
- Blueprint version: the docs show `bp6-` and `pt-` in different places; ours is
  `@blueprintjs/core` v6 with `bp5-` classes in places. Worth pinning down before
  copying any CSS API selector.
