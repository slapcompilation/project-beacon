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

---

## 5. The two open questions, inferred from sibling surfaces (2026-08-19)

No page answers either directly — searched for dependency, reference, "used by"
and deletion-safety pages across the corpus, and the only prose about Dependents
remains the word in the list of seven. But both are inferable from pages that
describe the *same shapes* elsewhere, and the inferences point away from what
this reading first proposed.

### 5.1 The kind list is not a universal vocabulary — it is what the platform has

`app-building/curating-apps`, describing the same applications that make up the
kind list:

> "Foundry platform apps are tools like Quiver, Contour, Data Connection, Pipeline Builder, and more. You can configure the option to display or hide platform apps from users in Control Panel under the **Application access** tab. This allows you to show only certain sub-groups of apps in Applications Portal, as well as in the rest of Foundry."

**"as well as in the rest of Foundry"** is the load-bearing clause. An
application hidden for an enrollment is hidden everywhere, which must include a
panel that names it as a dependent kind. So the kind list a tenant sees is
scoped to the applications that tenant actually has — the rendered zeroes are
kinds the platform *has* and this object type does not use, not a catalogue of
everything Foundry ships.

**That reverses Decision 1.** Registering seven kinds we have no counterpart for
would model applications Foundry itself would hide from a platform that lacks
them, and would produce a panel no Foundry tenant would ever see. Two kinds, and
zeroes among those two, reproduces the behaviour exactly at our scale.

*(Inference, flagged. The clause is about Application access rather than about
Dependents specifically.)*

### 5.2 A dependent you cannot see does not count

The same page states the rule twice for the Applications Portal's own
groupings:

> "Only collections that have promoted apps linked to them are displayed in Applications Portal, and only if you have access to view/discover these apps. If a collection has no promoted apps linked to it, or if you do not have access to any apps on the collection, it will not be displayed."

> "Only tags that have promoted apps linked to them are displayed in Applications Portal as filters, and only if the user has access to view/discover these apps. If a tag is not added to any promoted apps, or if a user has no access to any apps with that tag, it would not be displayed."

**A grouping is shown only if the caller can see its members, and members the
caller cannot see do not count toward it** — stated for collections and again
for tags, which is as close to a general rule as this corpus gives. And
`view-usage` says the equivalent for the panel directly beside this one: its
metrics "only includes the usage from users who have access to the object type".

So a dependent count is scoped to what the caller may already see. That is the
safe direction anyway; it is now the documented-by-analogy one.

*(Inference, flagged.)*

### 5.3 A finding from the same search: deletion is gated on status, not dependents

> "It cannot be deleted. A resource’s status must be `experimental` or `deprecated` before it can be deleted."

Nothing anywhere blocks deletion because something depends on the resource. That
confirms Dependents is **informational** — it tells an editor what will break,
and the gate that actually stops them is the status one. We already enforce that
(`Ontology:ResourceIsActive`, 321/327), so nothing is owed here.

## Decisions, revised

1. **REPLACES Decision 1. Register the two kinds we have**, not nine.
   `curating-apps` scopes the application list to the enrollment, so a panel
   listing Workshop on a platform without Workshop is not a fidelity gain — it
   is a shape Foundry would not render either. Zeroes still appear, for the two.
2. **Dependent reads are scoped to what the caller can already see**, per the
   collections-and-tags rule and the usage page's equivalent. A kind whose only
   instances are invisible to the caller reports zero, exactly as a collection
   with no visible apps is not displayed.
3. **Nothing gates deletion on dependents**, and nothing should: the status gate
   is the documented one and we have it.
4. **BUILT (580).** `dependent_kinds()` registers the two, `object_type_dependents()`
   returns the instances, `object_type_dependent_counts()` is the left pane with
   its zeroes. The permission rule needed no code: leaving the function
   **non-DEFINER** means RLS already hides what the caller may not see, which is
   the collections-and-tags rule arriving for free rather than being restated.

   **The counted-once rule needed a test, and it is the one that could have gone
   wrong.** An automation can reach an object type twice — through the object
   set it watches and through an action its effects invoke — and the header
   being the sum of the kind counts only holds if that is one dependent. The
   `UNION` (not `UNION ALL`) is what makes it so, and an assertion drives both
   paths on one automation to prove it.
