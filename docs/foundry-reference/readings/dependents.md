---
verify: strict
---

# Dependents (Phase F3) — what uses this object type

**Pages read:** `ontology-manager/overview`, and its annotated object-type
screenshot parsed panel by panel. This is the whole corpus for the feature: the
prose gives Dependents **one word**.

**Why now.** F3 is the last item in the build order and the one CLAUDE.md keeps
invoking — "the platform indexes ontology resources, so 'what uses this' is a
query against the resource graph". It is also the thing that would make
`check:surfaces` deletable.

---

## 1. The prose says almost nothing

The object type Overview page is enumerated as seven numbered sections:

> 1. Object type metadata
> 2. Properties
> 3. Action types
> 4. Link type graph
> 5. Dependents
> 6. Data
> 7. Usage

and that is the entire published description of Dependents. Everything below
comes from `oma-user-interface-overview-annotated.png`, which is the image those
numbers annotate.

---

## 2. The panel, parsed

> Dependents 14
> Workshop 9 · Function 2 · Graph Template 1 · Quiver Dashboard 1 · Use cases 1 · Automation 0 · Developer Console App 0 · Map Layer 0 · Map Template 0
> — ontology-manager/images/oma-user-interface-overview-annotated.png

Two panes. The left lists **kinds with counts**; the right lists the **instances
of the selected kind**, each a link — with Workshop selected, nine named
modules, and a `Create new` at the foot of the pane.

Three things follow that the prose could never have given:

* **The header count is the sum of the kinds**: 9+2+1+1+1 = 14. So a dependent
  is counted once per instance, not per reference.
* **The zeroes are rendered.** Automation 0, Developer Console App 0, Map Layer
  0, Map Template 0 all appear. The kind list is a **fixed vocabulary shown
  whole**, not a list of kinds that happen to have dependents — which is what
  makes it a directory rather than a result set.
* **The right pane can create.** `Create new` on a selected kind means this is a
  place of work, not only a report.

---

## 3. The finding that decides the scope

**Every kind in that list is an application, and none is an ontology type.**
Workshop, Function, Graph Template, Quiver Dashboard, Use cases, Automation,
Developer Console App, Map Layer, Map Template.

Action types and link types are *not* dependents — they are sections 3 and 4 of
the same page, with their own panels. So Foundry draws a line this reading has
to keep: **Dependents are consumers OUTSIDE the ontology; ontology-internal
references get their own surfaces.**

Of those nine kinds we have analogues for **two**:

| Foundry kind | ours | the path |
|---|---|---|
| Function | `functions` (501–502) | `function_versions.imports->'object_types'` |
| Automation | `automations` (517) | `condition->>'object_set_id'` → `object_sets.subject_type_id`, and `automation_effects.action_type_id` → `action_type_rules.object_type_id` |
| Workshop, Graph Template, Quiver Dashboard, Use cases, Developer Console App, Map Layer, Map Template | none | — |

Both of ours are **indirect**: one through a jsonb array of ids, the other
through two joins. Neither is a foreign key from an application table to
`object_types`, which is why no amount of reading `pg_constraint` finds them —
the dependency is in the *content* of a resource, not in its shape.

---

## 4. And the thing CLAUDE.md wants from it is a different graph

> "Ontology owners... write linters that check the entity definitions"

The repo's standing note is that this index is what makes `check:surfaces`
deletable. **That is a different question from the one this panel answers.**
Dependents asks which *Foundry applications* consume an object type.
`check:surfaces` asks whether one of *our React files* is reachable from
`main.tsx`. A resource graph over ontology consumers would not answer the
second, and building it while expecting `check:surfaces` to fall out would be
disappointed.

What would retire `check:surfaces` is an index of **our own** resources —
generated object surfaces registering themselves — which
`project_generated_object_views` already describes and which is not this.

---

## Decisions

1. **A kind registry with a `computable` flag**, exactly as `cleanup_flags()`
   (578) and `action_rule_kinds()` carry. Foundry renders zeroes, so a kind we
   have not built and a kind with genuinely no dependents would look identical
   in a UI — and that is precisely the confusion the flag exists to prevent.
   Nine kinds registered, two computed.
2. **Dependents are application consumers, not ontology references.** Action
   types and link types stay out of it: Foundry gives them their own sections on
   the same page, and folding them in would inflate every count while answering
   a question the panel does not ask.
3. **Count instances, not references.** The header is the sum of the kind
   counts, so a Workshop module reading an object type four times is one
   dependent.
4. **The two computable paths are content, not schema** — a jsonb id array and a
   two-join traversal. Anything that looks for foreign keys will find neither,
   which is worth stating because it is why this cannot be derived generically
   from the catalog.
5. **This does not retire `check:surfaces`**, and the map should stop implying
   it will. Two different graphs; only one is this.
6. **Not built from this reading yet.** These Decisions want reciting first —
   and Decision 1 is the one to argue with, because registering seven kinds we
   may never build is either honest or clutter depending on whether the surface
   ever renders them.

## Questions

1. **Is the kind list closed?** Nine are visible and the pane scrolls — `Map
   Template 0` is clipped at the bottom edge, so there may be more. No page
   enumerates them. `blocks:` whether the registry claims to be complete. It
   should not.
2. **What is a "Use case"?** It appears as a dependent kind with a count of 1
   and is the only entry that does not obviously name a Foundry application.
   `blocks: nothing` — it is one of the seven we do not have.
3. **Does a dependent count respect the caller's permissions?** The usage page
   is explicit that its metrics only include users who can see the object type;
   nothing says the equivalent here, and a count that leaks the existence of a
   Workshop module you cannot open would be a disclosure. `blocks:` the read
   path, and worth settling before a surface exists rather than after.
