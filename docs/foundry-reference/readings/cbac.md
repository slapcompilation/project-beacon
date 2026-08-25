---
verify: strict
---

# CBAC: the classification banner, and the marking algebra behind it

The queue's entry was the banner (it unblocks 649's
show-with-classification-banner toggle), but the api family carries two
resources — and the second one is the citation a four-month-old CHECK
comment has been waiting for.

**What I read, counted rather than asserted.** The six
`api/admin-v2-resources-cbac-*` pages: `cbac-banners-get-cbac-banner` (48),
`cbac-banner-basics` (5), `cbac-banners` (5, a section stub),
`cbac-marking-restrictions-objects-get-cbac-marking-restrictions` (52),
`cbac-marking-restrictions-basics` and its stub. No images exist on any of
them — api pages carry specs, not captures. The toggle's capture text is
already held verbatim by our platform-experience reading, §4.

## 1. The banner

> "Returns a classification banner string and colors for the given set of marking IDs."

— `api/admin-v2-resources-cbac-banners-get-cbac-banner.md`

> "A user-facing message describing a classification level, for example, MOCK TOP SECRET//NOFORN. The markings and rules about how to combine them are published in documents like [this](https://www.cdse.edu/Portals/124/Documents/jobaids/information/IC-Markings-System-Register.pdf)."

— `api/admin-v2-resources-cbac-banners-cbac-banner-basics.md`

Two display types, defined in the parameter itself:

> "The display type of the banner. Defaults to PORTION_MARKING. BANNER_LINE is the long classification string used in the header of a document; PORTION_MARKING is a short classification string used for individual paragraphs"

— `api/admin-v2-resources-cbac-banners-get-cbac-banner.md`

The response: `classificationString` (required), the `markings` list, one
`textColor` ("The hex value of a color."), and `backgroundColors` as a LIST
of hex values — a banner over several markings striping several colors. The
error set: permission denied, `CbacUnavailable` ("CBAC is not available."),
an unknown display type, not found.

## 2. The restrictions — and the algebra we already half-hold

> "Returns disallowed, implied, and required markings for the given set of marking IDs."

— `api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md`

The three relations, each defined in its field:

> "Markings that cannot appear in conjunction with the provided markings. This includes all such markings, not just those present in the provided set."

— `api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md`

> "Markings that are automatically granted when a user has membership in any of the provided markings."

— `api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md`

> "Markings that must appear in conjunction with the provided markings. Each list contains the requirements for one of the provided markings, and at least one marking from each must be included in the provided markingIds to constitute a valid classification."

— `api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md`

And two computed verdicts. `isValid` — "True if the provided markings
constitute a valid classification, containing no disallowed markings and
satisfying all required marking constraints." — and the one that matters
most here:

> "True if the current user satisfies the provided markings. The user must be a member of all conjunctive markings. The provided disjunctive markings are grouped by category, and the user must be a member of at least one marking in each group."

— `api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md`

**This is the citation 399 planned for.** Our `marking_categories.category_type`
CHECK admits only `conjunctive`, and its own comment says: if a disjunctive
category turns up, this CHECK is where it gets added — with a citation. It
has turned up. Disjunctive categories are attested (member of at least one
marking per category group), and `satisfies_markings` — the predicate under
every markings-guarded policy — currently implements only the conjunctive
half.

## 3. The toggle this unblocks

Our platform-experience reading (§4) holds the capture text verbatim: the static
banner's Show-with-classification-banner toggle, explained as — if a CBAC
banner is configured for the current user, the static banner is hidden by
default; enable to show the static banner below the CBAC banner
(administration's `configure-static-banner.png`, held by that reading). 649
refused to build the column because no CBAC banner existed to interact with;
this arc builds the banner.

## 4. What our substrate holds, probed

`markings` carry `name` — and NO color: 399 invented a color column and 463
dropped it (no markings page says colour; my first probe here read 399 and
missed 463 — the dry-run caught it). `marking_categories`
carry `category_type` (conjunctive-only today) and per-category visibility;
`marking_members` plus group grants (489) feed `satisfies_markings`, which
runs inside `resource_file_access` — i.e., inside nearly every RLS policy we
have. No abbreviation or short-name storage exists on markings.

## Decisions

1. **`cbac_banner(marking_ids, display_type)`** — a function, the endpoint's
   own contract (the caller names the markings; the platform shell passes
   the current user's memberships): classificationString as the marking
   names joined with `//` in category-then-name order (the separator is the
   basics page's own example; the ordering is inference),
   `background_colors` as the named markings' colors in the same order,
   `text_color` white (inference — no page sources it). `BANNER_LINE` and
   `PORTION_MARKING` return the same string today: markings have no short
   form to shorten to, a recorded divergence rather than invented initials.
   `CbacUnavailable` is the empty case: no markings, no banner.
2. **Three relation tables** on markings — `marking_disallowed` (a directed
   pair evaluated symmetrically: cannot appear in conjunction),
   `marking_implied` (membership in A grants B), `marking_requirements`
   (one row per requirement list: marking + an alternatives array, at least
   one of which must accompany it) — each tiny, each real columns.
3. **`cbac_marking_restrictions(marking_ids)`** returns the api's five
   fields: the three lists read from the relation tables,
   `is_valid` (no disallowed pair among the provided set, every provided
   marking's requirement lists each intersect the set), and
   `user_satisfies_markings` answered BY `satisfies_markings` — composed,
   never restated.
4. **The algebra upgrade, with this citation**: `disjunctive` joins the
   `category_type` CHECK, and `satisfies_markings` learns the full rule —
   member of every marking in conjunctive categories; at least one per
   disjunctive category group; and an implied marking counts as membership
   (single-level, no transitive closure — inference, recorded). This
   predicate guards everything, so the probe must show old behaviour
   unchanged for purely-conjunctive data.
5. **The 649 toggle lands**: `platform_banners.show_with_classification_banner`
   (default false, the capture's off state), now that the banner it
   interacts with exists.
6. **The surface** — the shell renders the CBAC banner for the current
   user's memberships above everything, hiding the static banner unless the
   toggle says otherwise — its own PR, with the post-build reconciliation
   pass.

## Questions

1. **What orders the classification string?** The example shows `//` joins;
   nothing orders the segments. Ours: category name, then marking name.
   `blocks: nothing.`
2. **Where does textColor come from?** Unstated; ours is white. `blocks:
   nothing.`
3. **Is implication transitive?** The field says "automatically granted",
   silent on chains. Ours: single-level. `blocks: nothing.`
4. **What shortens a PORTION_MARKING?** Real-world registers abbreviate;
   markings here have no short name. Same string until storage exists.
   `blocks: nothing.`
