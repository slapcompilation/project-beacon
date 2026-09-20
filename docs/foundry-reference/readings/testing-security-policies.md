---
verify: strict
---

# Reading — the Test security policies modal

The last large published-and-unbuilt piece of the object security arc. 821–834
built every slot a policy has, the readers that enforce them, and two surfaces
that explain them. This is the one that lets an operator find out whether the
policy they are writing does what they meant **before** they save it.

**Why it needs a reading rather than a build.** Everything before it enforced a
policy for the *caller*. This evaluates a policy for *someone else*, against an
object that may not exist, using a policy that has not been saved. Each of those
three is a seam we do not have, and the shape of the seam is what a reading is
for. 834 is the cautionary case: `datasource_readable` was the obvious helper and
answered for the wrong subject, and only reading it caught that.

Pages read in full:
- `mirror/object-permissioning/object-security-policies.md` — the
  §Test object security policies section and its limitations subsection.

Both images that section references are parsed below, and they are the only two:
`osp-testing-entry-point.png` (3156x1062) and `osp-testing-dialog.png`
(2396x1402). Neither is a crop — the dialog capture shows the modal's own title
bar, close button and bottom edge, and the entry-point capture shows the sidebar
through to the section's empty space below the last row. I also re-measured
`osp-object-security-policy-properties.png` (2100x646) for the era question
below. The rest of the page's images belong to readings that already cover them
(`object-permissioning.md`, `policy-mandatory-controls.md`).

## What the prose says

The feature, in one sentence, and every clause of it is load-bearing:

> "When configuring object security policies, you can test a specific user's ability to view the properties of an indexed object type based on your unsaved object security policy."

Three constraints fall straight out of it: the subject is **a specific user**,
not the caller; the object type must be **indexed**; and the policy under test is
**unsaved**.

The second sentence adds the hypothetical:

> "You can also edit the values of properties referenced in granular policies to test hypothetical object instances and determine if your policy is correctly configured."

So the values a granular rule compares against are **editable in the test**, and
only for properties a granular policy references.

The entry point is named:

> "Select **Test policies** from the **Security policies** section to launch the **Test security policies** modal."

And the modal's two panes:

> "In the **Test security policies** modal, use the **Configure test** panel to select a **User** whose visibility access you wish to test on a given **Object**. The **Results** section indicates which properties on the object the user can view based on the current security policy configuration."

## What the images add that the prose does not

### `osp-testing-dialog.png` — the modal

Two panes. The left is the policies table; the right is `Configure test` above
`Results`.

The left table's columns, read off the header row:
`Policy name | Type | Access summary | Applies to | Pass | Actions | ⚙`.
Two rows:

- `city dataset`, with a dataset glyph and rendered as a **link**, `Type` =
  `Object`, `Access summary` = an office-building glyph with `1` and a shield
  glyph, `Applies to` = `All properties` (underlined), **Pass = a green check**.
- `Marking on Lifecycle`, plain text and **not** a link, `Type` = `Property`,
  same access summary, `Applies to` = `2 Properties`, **Pass = a red cross**.

`Pass` exists only here — the section's own table (below) has no such column,
which is right, because passing is a property of the tested user and not of the
policy. The `Type` tag text is also shorter here (`Object` / `Property`) than in
the section (`Object security policy` / `Property security policy`).

The right pane:

- `User` — a dropdown, its value blacked out in the capture.
- `Object` — a dropdown reading `Krosno` with a pink map-pin glyph, and an `✕`
  to clear it.
- `Results` — the heading carries a dotted underline (an info affordance), and
  the tested object's title chip repeats on the right of that row.
- Then one block per property: the label, the value beneath it, and a status
  glyph on the right. Read in order: `Cntry Name` / `Poland` ✅ · `Lifecycle` /
  a dark chip reading `Lifecycle: Operational` with a shield ✅ · `Admin Name` /
  `Krosno` ✅ · `City Name` / `Krosno` ✅ · `Fips Cntry` / *No value* ❌ ·
  `Geometry` / *No value* ❌ · `Gmi Admin` / `POL-KRS` ✅ · `Objectid` / `1552`
  ✅ · `Port Id` / `0` ✅ · `Status` / (cut off by the modal's scroll) ✅.

**Three things the prose does not say, and the image does:**

1. **The pencil is on only two of the ten properties** — `Cntry Name` and
   `Lifecycle`. Those are the editable ones, and the prose says which properties
   those are: the ones "referenced in granular policies". So the pencil is not a
   general editor; it marks a property a rule compares against.
2. **A marking-valued property renders as its marking chip**, not as a raw value
   — `Lifecycle: Operational` on a dark pill with a shield. That is the same
   `base_type = 'marking'` property the `satisfies` comparison takes.
3. **A denied property keeps its row and its label and loses its value**,
   displayed as an italic *No value* beside a red cross. That is the third denial
   shape exactly as 827 built it — the key stays, the value is null — rendered.

**And the two panes agree with each other**, which is the part worth stating: the
object policy passes, so the object is visible at all; the property policy fails,
and exactly two properties read *No value* against its `2 Properties`. The modal
is showing both denial shapes composed, in the order 830's proof had to follow.

### `osp-testing-entry-point.png` — the section, and an era problem

The `Security policies` section header carries, left to right: the section icon
and title, then **`▶ Test policies`** (which the doc has boxed in red as its
annotation), then a `•••` overflow, then a collapse chevron. Beneath it, on its
own right-aligned row, **`⊕ Add property security policy`**. Then a **table**:
`Policy name | Type | Access summary | Applies to | Actions | ⚙`.

There is no `Add object security policy` affordance anywhere in the capture,
while an object policy already exists in the list — consistent with 821's
`UNIQUE (object_type_id)`, and a second witness for it.

**This section is not the section we built, and I checked rather than assumed.**
`osp-object-security-policy-properties.png`, which `SecurityPoliciesCard.tsx`
names as one of its three sources, shows the same section as **bordered cards**:
a sentence — "Policies can be customized to control who can access data on a
conditional basis." — then one card per policy with the counts **before** the
type tag, and an outlined `+ Add property security policy` at the **bottom
left**. The entry-point capture has a real table with column headers, a gear for
column configuration, the Add affordance moved to the **top right**, and the
`Test policies` action that does not exist in the card era at all.

So these are two generations, our card list is faithful to the older one, and the
feature this reading is about lives only in the newer one. That is a decision,
not a detail — see below.

## What it connects to

- **827 / 830** — the *No value* rendering IS `property_policy_nulls`. The modal
  is a per-user view of the same computation, so it should call the same
  predicate rather than a parallel one. The 834 lesson applies at full force:
  our nulling helpers resolve the CALLER, and this needs the tested user.
- **`test_restricted_view(p_view, p_user)`** (486) is the precedent in this
  repository and it already solves the subject problem: it swaps
  `request.jwt.claims` around the **same compiled predicate** and restores them
  exception-safely. Whatever this becomes should be that shape, not a second
  evaluator. A second evaluator is how a test starts passing while production
  fails.
- **833 / 834** — the object policy's `Pass` is not only its granular arm; a
  policy also carries markings, and `object_policy_markings` is per-policy and
  already computed.
- **The unsaved policy** is the genuinely new seam: every predicate we compile
  today reads the policy row out of the table by id.

## Decisions

**None of these are built. This block is the thing to read before any of it is.**

1. **Take the claims-swap, not a second evaluator.** `test_restricted_view` is
   the precedent and the reason is stated above. The function should compile the
   policy through `object_security_predicate` / `property_policy_nulls` and
   evaluate it with the tested user's claims installed, restoring them in an
   exception handler.
2. **The policy under test is an ARGUMENT, not a lookup.** "your unsaved object
   security policy" cannot be read from `object_security_policies`, so the
   candidate policy jsonb has to be passed in. This is the one place the existing
   compilers need a new entry point rather than a new implementation.
3. **The hypothetical object is an OVERRIDE MAP over a real row**, not a fabricated
   row. The capture tests a real object (`Krosno`) and edits two of its values;
   the prose calls the result a "hypothetical object instance". Passing overrides
   for the granular-referenced properties and reading the rest from the index is
   both simpler and closer to what the image shows.
4. **`Pass` is per policy and per user; the property verdicts are per property.**
   Two result shapes, and the modal shows both at once.
5. **Only granular-referenced properties are editable.** The set is computable —
   it is the properties a policy's rules name, which `object_type_policy_fields`
   already enumerates for the composer.
6. **THE ERA QUESTION, and I am not deciding it alone.** Building the modal means
   building the newer table, because `Test policies` and the `Pass` column belong
   to it. That either (a) moves the whole section to the table era, changing a
   surface we shipped in #1008/#1010 and that is faithful to its own capture, or
   (b) leaves the section as cards and gives the modal a table, so one screen
   shows both generations. I lean to (a) — the table era is the one carrying the
   current feature, and CLAUDE.md's rule is to build the way Foundry builds it —
   but it is a visible rewrite of a shipped surface and the operator should
   choose. **Whichever is chosen, the surface should name the era it follows.**

## Questions I could not answer from the page

1. **What the Results pane shows when the OBJECT policy fails.** Every capture
   has it passing. The row could vanish entirely, or show every property as *No
   value*. The denial shapes are different — withheld row versus nulled value —
   so this is not a cosmetic choice, and I could find nothing that states it.
2. **What the `•••` overflow on the section header contains.** It is never opened
   in any capture.
3. **What the `⚙` column-configuration control offers.** Also never opened.
4. **Whether `Pass` for an object policy folds its markings arm**, or reports the
   granular arm alone. The capture's passing check is consistent with both.
5. **How the organization warning is rendered.** The limitation is stated —
   "Foundry indicates this by displaying a warning callout that enumerates the
   organizations you do not have permissions on" — so the callout's existence and
   contents are published, but no capture shows it.

## Limitations the page states, which are requirements on any build

> "You cannot test [derived property](/docs/foundry/ontology/derived-properties/) visibility, as this also relies on the user's visibility on the derived property's source object."

Derived properties are excluded by name, with a reason that also explains it: the
verdict would need the far object's visibility too. We have derived properties
(757 onward), so this is an exclusion we must implement, not one we get for free.

> "If you are neither a member nor administrator of an organization that is referenced in the security policy, then guest memberships and secondary organizations will not be taken into account during testing."

The test is explicitly **not** authoritative for a caller who lacks standing in
a referenced organization, and the product says so in the UI rather than
silently. A build that computed the "true" answer regardless would be diverging
from the page, and a build that computed a wrong answer without the callout
would be worse.
