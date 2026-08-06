# Reading — Control Panel, the settings surface, and banners

Written to answer "where does a settings page live, and where does a banner go",
after building scoped sessions (migration 404) with no surface.

Pages read in full:
- `mirror/administration/overview.md`
- `mirror/administration/control-panel.md`
- `mirror/administration/configure-platform-experience.md`
- `mirror/quiver/analysis-settings.md`
- (already read for 404) `mirror/administration/configure-scoped-sessions.md`

Images read closely:
- `administration/images/control-panel-homepage.png` — **the whole nav model**
- `administration/images/configure-static-banner.png` — **the banner slot, with a preview**
- `administration/images/platform-version-switcher.png` — where per-user settings live
- `administration/images/disabled_scoped_sessions.png` — a settings page's own shape
- `security/images/scoped_session_banner.png` — the workspace banner in place

---

## Control Panel is one app, and settings are grouped by SCOPE

> "All administrative workflows can be performed in **Control Panel**, Palantir's
> centralized interface for administering the platform."
>
> "Additional settings in Control Panel are presented as **tabs on the side panel,
> grouped by enrollment/Organization levels**. To search for a specific setting,
> open the search dialog by selecting **Search** in the side panel or using
> `Cmd+J`."

`control-panel-homepage.png` shows the grouping, and across the screenshots I have
there are **five** scopes, not two:

| group | entries seen |
|---|---|
| **USER SETTINGS** | Profile, Account, Authorized applications, Notifications, Tokens |
| **PLATFORM SETTINGS** | Groups, Markings, Organizations, Roles, Row-level policies, Tags, Third-party applications, Users |
| **ENROLLMENT SETTINGS** | Authentication, Code Workbook profiles, Contact Information, Enrollment permissions, Modeling objective, Network egress, Object databases, Space management |
| **ORGANIZATION SETTINGS** | Content security policy, Email settings, Foundry suite, Organization permissions, Platform experience, User activity metrics, User inactivity timeout, Vertex |
| **SPACE** | Space permissions, Space management, Project templates, Organization permissions, Foundry products, Organization management |

Different screenshots show different subsets, which `disabled_scoped_sessions.png`
explains: the sidebar carries a **Show all settings ⓘ** toggle. The nav is scoped
to what you are looking at unless you ask for everything.

**The organising principle is the scope a setting applies to** — not the feature
it belongs to. Markings are a *platform* setting; scoped sessions are an
*organization* one; spaces are an *enrollment* one. That is the same hierarchy
`spaces-and-the-resource-path` found: enrollment → organization → space → project.

The home page itself is three stacked cards: **Getting started** (two labelled
groups of task cards — `SETTING UP THE ENROLLMENT`, `SETTING UP AN ORGANIZATION` —
plus "✨ Take a tour of Control Panel"), **Overview** (`ENROLLMENT DETAILS` with the
hostname, and `ORGANIZATIONS`), and **Managing Foundry with Control Panel** (linked
cards regrouped under `ENROLLMENT` and `ORGANIZATION`). Sidebar footer: language
picker, Help, **Open Foundry**, Log out.

### A settings page's own shape

`disabled_scoped_sessions.png` gives the template, and it is plain:

- title + one-line subtitle — "Scoped sessions / Limit a person's access to
  markings to a pre-defined set based on a defined focus of work"
- **tabs** — `Settings` | `Session presets`
- a stack of cards, each a **single labelled toggle with its explanation
  underneath**, not a form grid

`configure-static-banner.png` is the richer variant: same title + subtitle, tabs
across the top (`Home page URL · Languages · Platform logo · Platform title ·
Platform version · Static banner`), a master toggle on the card header, then the
fields, then a **Preview**. Plus `View documentation ↗` and a favourite star at
the top right.

### Per-user settings are a popover at the bottom of the sidebar

`platform-version-switcher.png`: the sidebar's bottom holds `AIP Assist ⌘⇧U`,
`Support`, and `Account`. Selecting **Account** opens a popover with the user's
name and handle, **⚙ Settings**, a `Developer` toggle, `Platform version [Stable ▾]`,
`Language [English ▾]`, and `⎋ Log out`.

So Foundry splits it cleanly: **administration is a separate application; personal
preferences are a popover on the sidebar.** We already have both shapes — a
sidebar and an `/account` page.

## Banners — there are three, and they share one slot

This is the answer to "where does the workspace banner go", and it is more
specific than expected.

### 1. The static banner (organization-configured)

> "You can configure a **static banner** per Organization that renders at the
> **top, bottom, or top and bottom of every page**. The **Banner text** field
> supports basic Markdown syntax. **This setting is disabled by default.**"

`configure-static-banner.png` gives the full field list: **Banner text**
(Markdown, "Special Markdown symbols such as `*`, `~`, `_`, and `#` may need to be
escaped by a backslash"), **Text color** (`#FFFFFF`), **Banner color** (`#2D72D2`),
**Position** as a segmented control `Top | Bottom | Top and bottom`, **Show when
printing**, and **Show with classification banner**.

**The Preview is the load-bearing part.** It renders the banner as a coloured
strip **spanning the full window width, above the dark sidebar**, with the
application below. The banner is not inside the app chrome; it is above all of it.

### 2. The classification (CBAC) banner

Stated twice on the same card, and it establishes a precedence:

> "If a CBAC banner is configured, use this configuration to customize its
> position. **The CBAC banner is displayed instead of the static banner.**"
>
> "If a CBAC banner is configured for the current user, the static banner is
> **hidden by default**. Enable [Show with classification banner] to show the
> static banner **below** the CBAC banner."

So: CBAC wins the slot; the static banner is suppressed unless explicitly stacked
underneath it.

### 3. The workspace banner (scoped session)

> "After you select a scoped session, there will be a **workspace banner** showing
> the name of the scoped session." (`security/markings`)
>
> "…may potentially lead to the display of a Foundry **workspace banner**."
> (`configure-scoped-sessions`)

`scoped_session_banner.png` shows it: a thin dark strip at the very top of the
window, **centred**, reading the session name with a caret. Hovering opens a
popover containing the session **name**, its **description**, a **Marking access**
section — "In this scoped session, you will only have access to the following
markings:" with the marking chips — and **Change scoped session…** at the bottom.

**Note the difference in interaction.** The static banner is inert text. The
workspace banner is a *control*: hover for context, click through to change
session.

**Open question:** no page read states the precedence between the workspace banner
and the other two. CBAC-over-static is stated; workspace-versus-either is not.

## The session selector

`scoped_session_login_example.png` and `no_scoped_session.png`. A modal titled
**Choose scoped session**:

- left: a filter box, a group headed `SCOPED SESSIONS` listing the sessions by
  name with a `›` affordance, and — when permitted — a second group headed
  `OTHER SESSIONS` containing a single entry **No scoped session**
- right: the selected session's name, description, and a **Marking access**
  section listing its marking chips. For the unscoped entry the text is instead
  "You will have access to all the markings that you are a member of."
- footer: **Choose scoped session**, which becomes **Choose unscoped session**

Whether it appears at all is governed by two settings and the user's membership:

> "the user would not see the scoped session dialog or the scoped session banner:
> • The user is not a member of any of the Markings used in the scoped sessions.
> • **No scoped session** is enabled for this user.
> • **Always show selector** is disabled."

And with **Always show selector** off, "a user with access to only one scoped
session will not see the scoped session dialog… instead, they will **automatically
log into the only available scoped session**."

## What Quiver's settings page contributes

`quiver/analysis-settings` is not an administration page — it is a *document's*
settings, and that is exactly why it is useful as a contrast:

> "Quiver has a range of settings to configure the display and format in your
> analysis. **These apply to the current analysis, but not to other analyses that
> you create.**"
>
> "**Personal default settings** — Quiver allows you to save your preferred
> analysis settings. These personal default settings will be automatically applied
> to any new analysis you create. You also have the option to apply your personal
> settings to existing analyses."

With a danger callout: "Applying your personal default settings to an existing
analysis will **overwrite existing analysis settings. This will affect other users
who work in the analysis as well.**"

So Foundry has **three settings scopes for a document-level app**: per-artifact,
per-user default, and (via Control Panel) per-organization. The panel opens from a
cog in the side-panels bar, and its sections are named by what they affect
(Global settings, Categorical charts overrides, Time series tooltips, …) with
every entry a **bolded switch name followed by a sentence of prose** — the same
pattern as Control Panel's toggle cards.

One transferable rule, from the display-mode setting: "when a dashboard or
template is **embedded** in an application outside of Quiver, the display mode
will be **inherited from the parent application**." An embedded artifact does not
carry its own chrome preference.

---

## Connects to

- **`markings`** — the session selector and workspace banner are the surface for
  migration 404, which currently has none.
- **`spaces-and-the-resource-path`** — Control Panel's nav groups are that
  hierarchy: enrollment → organization → space. Space management is an
  ENROLLMENT setting; scoped sessions an ORGANIZATION one.
- **`projects-roles-and-portfolios`** — Organization permissions and roles appear
  in Control Panel's ORGANIZATION and PLATFORM groups.
- **Our `/account`** — already the "personal preferences" half. Foundry's
  equivalent is a popover from the sidebar's Account entry, with **Settings**,
  language, and log out.
- **Our memory note "No global top bar"** — see the decision below; a banner is
  not navigation, but it is a top strip, and the two need reconciling explicitly
  rather than silently.

## Open questions

1. **Precedence between the workspace banner and the static/CBAC banner.** Stated
   for CBAC-over-static only.
2. **Where is Scoped sessions in the Control Panel nav?** The screenshot's sidebar
   is truncated and the highlighted entry is not visible. It is an organization
   setting by content; unconfirmed by a screenshot.
3. **Does Control Panel's `Cmd+J` search index settings only, or resources too?**
   The page says "search for a specific setting".

## Decisions

None yet — this reading exists to settle the build shape before writing any of it.
