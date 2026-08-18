---
verify: strict
---

# Actions on interfaces

**Pages read:** `action-types/actions-on-interfaces` in full, with all five of
its images parsed field by field.

**Named here but NOT read for this reading:** `action-types/rules` (the twelve
rule kinds — read previously, and the source of every kind name used below),
`interfaces/interface-action-type-constraints` and `action-types/permissions`
(both linked from this page; nothing below rests on a sentence of either, and
the permissions half is quoted from this page's own Permissions section).

**Why now, and the correction it carries.** `readings/interfaces-phase.md` lists
this page among the sublinks it named but did not read, recording it as absent
from the mirror and as the one page that reading most wanted. That was true when
it was written and is not true now — the page was mirrored 2026-08-11. It is
already the citation under migrations 569 and 570, which is the wrong order: the
build came first and the reading is catching up. Recorded rather than hidden,
because the same order is how `object_type_impact` happened.

---

## 1. Two mechanisms, and the page separates them in one line

> There are two main ways you can use interfaces from within actions:

> **Interface action rules:** To create, modify, delete, and link objects of the configured interface.

> **Interface reference parameters:** To reference objects of the configured interface. This parameter is required by the "Modify" and "Delete" interface action rules, but can also be used by any other action rules.

The second sentence is stronger than what 569 recorded. 569's notes say Foundry
*generates* the interface reference parameter; the page says it is **required**
by two of the rules. So the parameter is not a convenience the UI adds — it is
part of the rule's definition, and a modify or delete rule without one is not a
complete rule.

And a third thing, which is not a rule at all:

> Interfaces can also define interface action type constraints, which describe expected action capabilities that implementing object types can satisfy with concrete action types.

> Action type constraints define an interface-level action contract; action rules define the edits performed when an action type is submitted.

That second sentence is the cleanest statement of a distinction the interfaces
reading could not resolve: **a constraint is a contract the interface asks
implementers to satisfy; a rule is an edit an action performs.** They live at
opposite ends — one is a requirement on object types, the other is behaviour of
an action type.

---

## 2. The governing constraint, quoted whole this time

> You can use interface action rules whenever the edits can apply to all the object types that implement the interface. In other words, you can use interface action rules only to modify the *interface shared properties* or to delete objects.

**569 and 570 both quote this sentence with the final clause cut off.** "…only
to modify the interface shared properties" reads as an absolute restriction to
the declared property set. The full sentence carves out deletion, and the reason
is obvious once seen: a delete rule writes no properties at all, so a rule that
must name only interface properties and a rule that names none are the same
thing. **Our guard is unaffected** — it constrains which properties a rule may
name and never requires a rule to name one — but the quote was wrong and is
corrected here.

The worked example the page gives:

> if “Feature request” and “Bug” are object types of the “Ticket” interface, you can use a “Create a ticket” action type to create bugs and feature requests, but you cannot create any property types that are specific to bugs or feature requests.

---

## 3. What the images add that the prose does not

### 3.1 The interface's properties are shared properties

`action_on_interface_rules.png` draws `Ticket` with five properties, and **every
one carries a globe** — the shared-property marker `shared-property-overview.md`
establishes. The prose's phrase *interface shared properties* is therefore
literal, not loose: what an interface rule may write are the interface's
properties, which in every captured example are shared.

The same image shows the property *names differ per implementing type*:
`Ticket ID` reaches `FR ID` on Feature request and `Bug ID` on Bug; `Subject`
reaches `Summary` and `Title`. So an interface rule names an **interface**
property and the mapping resolves it per type — which is precisely why 570's
`interface_property_id` is the right column and 569's object-property reference
was not.

Its footnote states the complement of the rule:

> To edit properties that are specific to the object-type, a separate action type is required.
> — action-types/images/action_on_interface_rules.png

### 3.2 The wizard, which the prose numbers differently

`action_on_interface_new_interface.png` is the creation dialog, and it carries
three things the prose omits.

**Six steps, not five.** The rail reads `Action type · Mapping · Metadata ·
Submission criteria · Permissions source · Roles`. The prose's numbered
procedure lists interface-and-rule, properties, metadata, submission criteria,
create — it never mentions **Mapping**, **Permissions source** or **Roles**.

**Five families of action type, as tabs:** `Object · Link · Function · Webhook ·
Interface`. This is the shape above `rules.md`'s twelve kinds — the wizard
picks a family first, and the twelve are the rules that can then be configured.

**Only three interface options in the picker**, each with a one-line
description:

> Create objects of interface — Configure an action type to create an object instance of the selected interface.
> — action-types/images/action_on_interface_new_interface.png

> Modify objects of interface — Configure an action type to edit an object instance of the selected interface.
> — action-types/images/action_on_interface_new_interface.png

> Delete objects of interface — Configure an action type to delete an object instance of the selected interface.
> — action-types/images/action_on_interface_new_interface.png

**The two link kinds are absent from this picker**, though `rules.md` lists them
and this page documents both. Inference: the wizard chooses the *primary* rule,
and "Create interface link" / "Delete interface link" are rules added to an
action type afterwards, not action-type families. That matches how the page
describes them — as configuration procedures ("To configure a 'Create interface
link' rule"), not as things you start from.

### 3.3 The primary-key hazard, and why the two images are inverses

This is the pair worth the reading. `action_on_interface_primary_key.png` and
`action_on_interface_primary_key_modify.png` use the *same* interface, the
*same* two object types and the *same* mapping, and produce **opposite**
outcomes.

`Ticket` maps four properties — Subject, Status, Created at, Created by — and
does **not** map anything to `FR ID`. Feature request's primary key is `FR ID`;
Bug's primary key is `Title`, which `Subject` maps onto.

| | Feature request (pk `FR ID`, unmapped) | Bug (pk `Title`, mapped from `Subject`) |
|---|---|---|
| **Create a ticket** | ✗ fails | ✓ succeeds |
| **Edit ticket** | ✓ succeeds | ✗ fails |

The create image annotates its failure directly:

> Create action rules will fail on submission if the primary key is not provided.
> — action-types/images/action_on_interface_primary_key.png

and the prose states both halves:

> objects cannot be created without a primary key

> primary key values *cannot be modified* by any action type

**So the interface property a create rule must cover is exactly the one a modify
rule must not write** — and whether either holds depends on the implementing
type, not on the rule. The mitigation the page gives is a modelling one, not a
check:

> make sure that both the interface and the Create rule include an interface property that can be used as the primary key in the object types that implement the interface

**The failure is at submission, per object type.** Neither image shows the rule
being refused at configuration time; both show a red mark on the arm of the
diagram that reaches one type while the other arm stays green. That is a runtime
outcome, and it is the strongest argument that these five kinds are correctly
registered-but-not-executable here: **the check cannot exist until submission
does.**

The modify image also shows two concrete instances entering the action —
`FR-90872` and `App crashes`, one of each type — which is the interface
reference parameter doing its job.

---

## 4. The two link rules

Both are configured the same way, and both hang off something we already model:

> Select the interface link constraint defined on the interface. If the link constraint is between two interfaces, both the source and destination parameters will be automatically generated as interface reference parameters. If the link constraint is between an interface and an object type, the source will be an interface reference parameter and the destination will be an object reference parameter.

`interface_link_constraints` exists (450). So the target of these two rules is
**modellable today** — `action_type_rules` would need an
`interface_link_constraint_id` beside `interface_id`. What is missing is the
link instance store, same as `create_link` and `delete_link`.

The source and destination may also be set by hand:

> An interface reference or object reference parameter referencing an existing object.

> An object created by a "Create object" or "Create object(s) of interface" rule within the same action type.

That second bullet is a rule referencing another rule's output within one action
type — a dependency between rules that our `action_type_rules` has no way to
express, and does not need until links execute.

Two warnings, both about ambiguity when a type implements a constraint more than
once:

> If there are multiple concrete link implementations on the object type for the link constraint, the action will fail.

> If there are multiple concrete link implementations on the object type for the link constraint, the action will attempt to delete all the concrete link implementations.

**Create fails; delete deletes all of them.** Not symmetric, and worth carrying
forward as a stated asymmetry rather than smoothing it.

---

## 5. Permissions, and the limitation that shapes them

> Interface action rules follow the same permissions as object action types.

so nothing new to build there. But the submission side is where the page raises
its own alarm:

> Interface action submission criteria apply uniformly to all object types that implement the interface. Before you create an interface action, carefully review which users will have permission to create, modify, or delete objects across all object types that implement the interface.

> Submission criteria apply uniformly across all object types that implement the interface, so you cannot configure different permissions per object type within a single interface action.

The escape hatch is a per-object-type opt-out, and it names the surface:

> To restrict access, disable interface actions for specific object types in Ontology Manager by selecting its **Interfaces** tab and establishing control over actions inherited from an interface in the **Interface action control** section.

**This answers open question 6 of `readings/interfaces-phase.md`**, which asked
what "interface action type constraints" gates and guessed this page was the
likely home. It was — but the answer is a different mechanism than the guess:
the gate is **Interface action control**, an object type's own switch over
actions it inherits from an interface, and it lives on the object type's
Interfaces tab. It is not the action-type constraint at all.

Three further limitations, quoted because each is a thing we might otherwise
build:

> The ability to apply more granular permission controls to interface actions is under active development.

> Action logs are not yet supported.

> Actions on interfaces cannot be used with functions.

The third is already true here for a different reason: `guard_action_type_rule`
makes a function rule exclusive of every other rule, so a function rule and an
interface rule cannot coexist on one action type. Ours is the broader statement,
and the narrower one needs nothing.

And where they work today:

> **Ontology Manager:** Creation of interface action types and configuration of interface parameters in submission criteria and overrides.

> **Object Explorer and Object Views:** Rendering of actions defined on interfaces.

> For a given object, all object-type-specific and interface-based actions that can be applied to that object will appear in the action dropdown.

That last sentence is a surface requirement for us later: an object's action list
is the union of its own action types and the ones it inherits through every
interface it implements.

---

## Decisions

1. **The quote in 569 and 570 is corrected here, not in the migrations.** Applied
   migrations are immutable; the elided "or to delete objects" changes no
   behaviour, because the guard restricts which properties may be named and
   never requires one. Recorded so the next reader of those headers is not
   misled.
2. **`interface_property_id` was the right correction.** The images show an
   interface property resolving to differently-named properties per implementing
   type — `Subject` reaching both `Summary` and `Title`. A rule naming an object
   type's property could never have meant this.
3. **The primary-key rules are NOT built, and deliberately.** Both are submission
   failures per object type, and we do not submit. Building a configuration-time
   check would be stricter than Foundry and would refuse rules Foundry accepts.
4. **The interface reference parameter is not built.** It is required by the
   modify and delete rules, which is a stronger claim than 569's note records —
   and it is the concrete reason those two are not executable. 569's note says
   Foundry generates the parameter; the page says the rule requires it, which
   makes the rule incomplete without one rather than merely unassisted.
5. **`interface_link_constraint_id` is not added yet.** The target is modellable
   (450 built `interface_link_constraints`), but a column pointing at it with no
   link instance store behind it is half a mechanism, which CLAUDE.md's opening
   rule calls worse than none. It is added when links execute.
6. **The Interface action control gate was already built, and I said otherwise
   until I checked.** 450 added `object_type_interfaces.interface_actions_enabled`
   and cited this page for it — while `interfaces-phase.md` was recording the
   page as unmirrored and question 6 as unanswered. So the schema knew and the
   reading did not. **Nothing had ever read the column**, which is the same
   half-built shape from the other side: declared, defaulted, inert. **571**
   gives it its first caller, because a type that turned interface actions off
   is not edited by the action and its properties do not belong in the answer.
   Recorded as the answer to interfaces-phase question 6 so the guess in that
   reading stops propagating: the gate belongs to the object type, not the
   action type.
7. **`action_editable_properties` had to grow an arm, and the reason is a
   warning about UNION-less joins.** It answered Phase C's design sentence with
   an inner join through `property_id`; after 570 an interface rule's property
   is elsewhere, so every interface action silently reported **zero** writable
   properties. Not an error — a zero, from a function whose job is to say what
   an action may write. **571** adds the interface arm: the interface property
   resolved through `interface_implementation_mappings` to each implementer's
   own property, one row per type. The three resolutions that name no property
   (`choose_backing_column`, `edit_only`, `skip`) are not reported, because a
   property that does not exist yet cannot be writable.
8. **The action-type wizard's five families are recorded, not adopted.** Our
   creation surface does not follow this shape yet, and `Webhook` is a family we
   deliberately do not build.

## Questions

1. **Does an interface rule with no properties mean "delete"?** The sentence
   pairs "only to modify the interface shared properties **or to delete
   objects**", but never says a delete rule may not name properties. Our guard
   permits a delete rule to name interface properties. `blocks: nothing` — no
   rule executes.
2. **Is the interface reference parameter one parameter kind or a constraint on
   the object reference kind?** "similar to the 'object reference' parameter,
   with the exception that the 'interface reference' parameter shows objects of
   any type that implements the interface" reads like a constraint, but the
   link section treats them as two kinds ("the source will be an interface
   reference parameter and the destination will be an object reference
   parameter"). `blocks:` executable modify/delete of interface.
3. **Where do the wizard's `Permissions source` and `Roles` steps come from?**
   Neither appears in this page's prose and neither is in our action-type model.
   `action-types/permissions` is named but was read for submission criteria, not
   for these two steps. `blocks: nothing yet`.
4. **Can one action type carry more than one interface rule, on different
   interfaces?** Nothing forbids it, and our guard permits it — `interface_id`
   is per rule, not per action type. Foundry's wizard picks one interface at
   step 1, which suggests not, but a screenshot of a picker is not a
   constraint. `blocks: nothing` — no rule executes.
5. **What does "Mapping" (wizard step 2) map for an interface action?** For an
   object action it is presumably parameters to properties. For an interface
   action the mapping already exists on the object type's implementation.
   Uncaptured. `blocks: nothing`.
