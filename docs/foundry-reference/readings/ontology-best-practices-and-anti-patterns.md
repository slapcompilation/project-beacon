---
verify: strict
---

# Ontology design: best practices, anti-patterns, structural guidance

**These are the pages `readings/README.md` queued as entry 4 — "read BEFORE
designing, not after" — and never opened.** The string `anti-patterns` appeared
nowhere in this directory except that queue line, while the ontology was
designed across 260-odd migrations. Seven finished entries around it made the
eighth look finished too, which is the whole argument for deleting a queue item
the day it ships.

**What I read, counted rather than asserted.** Three distinct pages:

- `ontology/ontology-anti-patterns` (562 lines, **no images**)
- `ontology/ontology-best-practices` (282 lines, **four images**)
- `ontology/ontology-structural-guidance` (346 lines, **no images**)

`ontology/ontology-best-practices-and-anti-patterns` is a **fourth slug holding
byte-identical content to `ontology-best-practices`** — the same double-mirroring
that produced `manage-roles-`, confirmed by diffing the two files past their
source comments. It is not a third page and nothing in it is separately read.

**Images: two of the four parsed** — `composition.png` and `domain-design.png`.
`open-closed.png` and `do-not-repeat.png` are **not parsed**; named so the debt
is recorded rather than dropped. Note these are HTML img tags, not markdown, so
a grep for a markdown image counts zero on all three pages — I nearly filed
"no images" on the strength of that.

## 1. The four principles, in a stated priority order

> "These four principles are derived from extensive field experience across government and commercial implementations. They are presented in priority order. In cases of conflict, higher-priority principles take precedence."

— `ontology/ontology-best-practices.md`

Domain-driven design, don't-repeat-yourself, open-for-extension, composition
over deep hierarchies. The ordering is the load-bearing part: it tells you which
one loses when two collide.

> "If you built the same thing three times, refactor."

> "Favor multiple inheritance via interfaces. Keep things pluggable."

— `ontology/ontology-best-practices.md`

**What `composition.png` adds beyond the prose.** The prose works one example —
`Arena` implementing `Building` and `SchedulableResource` — and mentions a
hypothetical `SchedulableWarehouse`. The image draws **two further implementers
that appear nowhere in the text**, `Office Building` (tenants, vacancy) and
`Restaurant` (region, customerCapacity), each taking arrows from both
interfaces. The point of the diagram is the fan-out the prose only asserts.

`domain-design.png` adds an explicit three-step ordering — understand the
domain, design the ontology, map source data — which restates best practice 4
rather than adding to it.

## 2. The one published number in the whole family

> "More than 10 action types for a single object type"

— `ontology/ontology-anti-patterns.md`

An **Indicator** of Action Sprawl, and the only threshold any of the three pages
states. Every other indicator is qualitative: "many properties that are
frequently null", "End users frequently ask", "Object counts grow
proportionally". Eight anti-patterns are named — System Silos, The Kitchen Sink,
Department Silos, The God Object, The Golden Hammer, Action Sprawl, The Time
Machine, The Misnomer — and only this one is countable.

It is expressible here: `action_type_rules.object_type_id` exists, so distinct
action types per object type is a group-by. **Built as an `ontology_warnings()`
arm in 621**, not a violation — the page calls it an *indicator* of an
anti-pattern, which is softer than either "warned" or "recommended", and
warnings do not block a save.

## 3. What we already have, checked rather than assumed

> "When non-semantic types (types that serve a technical purpose rather than modeling real-world domain entities) are necessary for specific workflows, mark them as hidden to keep default views of the Ontology clean."

— `ontology/ontology-best-practices.md`

Already built and already reached. `object_types.visibility` carries
`prominent | normal | hidden`, declared on its constraint as coming from
`aip-analyst/using-aip-analyst`, and **eighteen** functions read it, including
`search_visible_types`, `search_objects`, `object_set_where` and
`aggregate_object_set`. This is a confirmed inference, not a gap.

Interfaces, shared properties and multiple implementation are likewise built,
which is what principle 4 asks for.

## 4. Naming, where the list is deliberately open

> "Property names are single generic words like `value`, `type`, `status`, `date`, or `name` without qualification"

— `ontology/ontology-anti-patterns.md`

> "Use `monetaryValue`, `quantityOnHand`, and `riskScore`. Do not use `value`, `quantity`, and `score`."

— `ontology/ontology-structural-guidance.md`

Two overlapping bad-lists, and **neither is an enumeration.** The first says
"like", which marks it as illustrative; the second is imperative but names three
words in a best-practice bullet rather than defining a set. Building a closed
check from either would be closing an open set — the `cipher`/`cipher_text`
mistake in a different costume. Recorded as a question, not built.

## 5. The page's own escape clause, which the repo should read

> "These principles are guides, not laws."

> "Steer toward good design without being a roadblock"

> "A slightly imperfect Ontology that is in use and generating value is better than a theoretically perfect one that is still being designed."

— `ontology/ontology-best-practices.md`

Worth quoting because this repository's failure mode is the opposite one, and
because it is Foundry's own instruction not to be stricter than Foundry. The
same section says which corners may not be cut: "Naming quality, semantic
clarity, and security design are hard to fix later."

## Decisions

1. **The Action Sprawl indicator becomes an `ontology_warnings()` arm (621).**
   It is the only published number in three pages, it is expressible against
   `action_type_rules`, and it must not block — an indicator is advisory. The
   probe MAKES it fire at eleven and confirms silence at ten, because an arm
   nobody has seen fire is not a guard.
2. **No arm for the generic-name lists.** Both are open sets by their own
   wording. Recorded in Questions.
3. **Nothing here falsifies the existing ontology.** The mechanisms these pages
   ask for — interfaces and multiple implementation, hidden types, links with
   directional names, derived properties — are built, and `visibility` is
   consumed by eighteen functions rather than merely declared. This reading
   changes one thing and confirms the rest.
4. **The four principles are recorded but not enforced.** Domain-driven design,
   rule of three, open-closed and composition are design judgement, not schema
   facts, and there is no rung on the ladder for judgement. Naming them here is
   the deliverable.

## Questions

1. **Should a generic property name warn?** The two lists overlap on `value` and
   disagree otherwise (`type/status/date/name` versus `quantity/score`), and the
   first is explicitly illustrative. A warning on the union would be inventing a
   set from examples. `blocks: nothing` — it is advisory either way.
2. **Is "singular, concrete nouns" checkable for object types?** The table says
   object types take singular nouns, and our `object_types` already carries a
   `plural_label` beside `label`. Detecting a plural `label` is a heuristic, not
   a rule, and a false positive on an irregular noun would be noise.
   `blocks: nothing`.
3. **Does the God Object indicator have a countable form?** "Many properties
   that are frequently null" needs a null-rate over indexed objects, which we
   can compute from the per-type index tables — but no page states a property
   count or a null fraction, so the threshold would be mine. `blocks:` any God
   Object arm.
