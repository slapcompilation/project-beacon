---
verify: strict
---

# An object set as an action parameter — and the thing that has to read it

**Pages read in full: 9.** `action-types/parameter-overview`,
`action-types/parameters-filter`,
`action-types/parameter-performance-considerations`,
`action-types/dropdown-security`, `action-types/submission-criteria`,
`action-types/rules`, `action-types/use-actions`, and two api pages —
`ontologies-v2-resources-action-types-get-action-type` for the parameter type
union and `ontologies-v2-resources-actions-apply-action` for the value encoding.

**Images: 18 referenced by those pages, and I parsed none of them.** That is a
debt and it is mine. It is a proportionate one only because every question this
reading answers is settled by prose or by an api spec, and the images belong to
two features that turned out not to be this one — the object dropdown and the
multiple-choice filter. Anyone building either of those parses them first.

**The prose barely covers the subject.** `parameter-overview` is seventeen lines
and enumerates nothing:

> Each parameter is defined by a type, which dictates what kind of values it can take.

— action-types/parameter-overview.md

So the api is the authority here, which is the usual division: the prose
describes the product and `api/` publishes the union.

---

## 1. The type exists, and its shape differs from the object parameter's

The parameter type union is published on the action type endpoint, under a
caption that says what it is:

> "A union of all the types supported by Ontology Action parameters."

— api/ontologies-v2-resources-action-types-get-action-type.md

and one of its members is:

> - `objectSet` · object

— api/ontologies-v2-resources-action-types-get-action-type.md

carrying `objectApiName` and `objectTypeApiName`. **Neither is marked required**,
and that is the detail worth having: the `object` member on the same page marks
both required. So an object *reference* parameter must name its object type and
an object *set* parameter need not. A set parameter may be untyped.

## 2. The value is a RID or an inline definition

The apply endpoint publishes one table for every parameter value's JSON
encoding, and the row is unambiguous:

> | Object Set                          | string OR the object set definition

— api/ontologies-v2-resources-actions-apply-action.md

The example alongside it is
`ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`.
Two accepted forms, then: a reference to a stored set, or the set spelled out
inline. `readings/rid-grammar.md` records what the three object-set RID tokens
mean and why ours is not being changed.

## 3. One published refusal, and it is a real one

> Submission criteria do not support attachment and object set parameters. These parameter types are removed from the selection panel.

— action-types/submission-criteria.md

A criterion cannot test an object-set parameter. That is a fact about one row and
belongs in a CHECK or a guard, not in a comment.

## 4. What consumes one, which is the finding that scopes the build

`action-types/rules` never mentions an object set. I went looking for the rule
kind that takes one and there is none — the documented rule kinds act on an
object, a link or an interface, one at a time. Two pages that *do* talk about
object sets in an action context turn out to be about something else entirely:
`dropdown-security` and `parameters-filter` describe an object set used to
populate the **dropdown** of an object *reference* parameter. Same words, other
feature, and mistaking one for the other would have produced a parameter type
wired to the wrong machinery.

So an object-set parameter is for a **function-backed** action. That matches what
we already have: `action_rule_kinds()` carries a `function` kind whose runtime is
the isolate rather than SQL, and its guest receives parameter values positionally
through the input mapping, so a set's value would already reach the guest with no
change at all.

**And that is exactly where it would stop.** The guest's host reader answers
three operations — count, page and fetch-one — each keyed on an object type and
filters, each gated on the type being a declared import. None of them takes a set
identifier. A guest handed a RID today can do nothing with it.

That makes the boundary of a useful first build clear, and it is not where I
would have drawn it before reading: the parameter type alone is storage nothing
consumes. **The parameter and the host read are one change or neither.**

The host read has a published constraint of its own to respect:

> the permissions of the end user running the function determine which objects are loaded

— functions/permissions.md

so resolving a set identifier runs as the caller, exactly as the three existing
operations do, and a set whose objects the caller cannot see comes back short
rather than refused.

## Connects to

- `readings/automate-effect-inputs` material in `readings/automate.md` and
  migration 630, which built the `Single object` effect input and named this as
  the blocker for the other three kinds. An object-set parameter is what unblocks
  `Object set` inputs and, with them, the three grouping execution modes.
- `readings/notifications.md` — dynamic recipients read user ids off the
  triggering objects, and wait on the same shape.
- `readings/functions.md` and the edit-functions arc, for the guest contract the
  host read has to fit.

## 5. What building it found (797–799)

Two things, neither visible from any page, and the second is a claim I made and
the suite refused.

**The payload CHECK had an `ELSE NULL` arm, and a CHECK passes on NULL.** Every
`data_kind` had its own arm and anything else returned null, so the moment a new
kind existed it could carry any payload at all — a base type on an object-set
parameter, an interface on an object one. Adding the kind without noticing would
have opened the hole rather than closed it. 797 rebuilt the constraint with an
arm per member and an `ELSE false`, so the next kind cannot ride through the way
this one could have. Third appearance of the same shape in this repository, after
the decimal with no precision and the validator that let a notification with no
recipients through.

**Our `data_kind` is not the api's union, and 797 said it was.** The declaration
it added — values from the action type endpoint — is a falsifiable claim, and two
of the five values fail it. The api lists each primitive as its own member, while
ours collapses all of them into one `base_type` whose actual value lives in a
separate column, and carries `interfaceObject`, which that union does not have.

So three of our five are the api's spellings and two are ours. A set assembled
that way has no single page to name, and naming one anyway is exactly the failure
a declaration exists to prevent. 799 withdraws the claim and says which three
came from where, rather than renaming fourteen primitives to satisfy a comment.

## Decisions (2026-09-11 — NOT YET READ BY A HUMAN)

1. **Build the parameter type and the host read together**, because either alone
   is unreached. The type is `objectSet` in the api's spelling, snake_cased to
   match the column's existing set.
2. **The object type is optional on it**, because the api marks it so, unlike the
   object reference parameter on the same page.
3. **Accept both published value forms** — a stored set's identifier, and an
   inline definition — since the encoding table gives them equal standing.
4. **Submission criteria refuse it**, by the rule the page states, alongside
   attachments.
5. **No new rule kind.** Nothing in the documented rule set consumes a set, and
   inventing one would be building a mechanism Foundry does not have.
6. **The host read is a fourth operation on the existing reader**, gated the same
   way the other three are: the set's subject type must be a declared import, and
   the read runs as the caller.

## Questions

1. **What does an untyped object-set parameter mean at apply time?** The api lets
   both naming fields be absent and no page says what a set of mixed object types
   does to a function's signature.
2. **Is an inline object set definition the same grammar as the exploration
   filters?** `generate-urls` publishes a filter grammar and the encoding table
   says only "the object set definition"; nothing read here says they are one
   language.
3. **18 images unparsed**, all belonging to the dropdown and filter features this
   reading deliberately separated from its subject.
