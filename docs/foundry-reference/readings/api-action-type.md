---
verify: strict
---

# ActionTypeV2, and a rule arm we have no counterpart for

**Why this reading exists.** The third reading of a resource shape from `api/` —
`api-authentication.md` read that corpus before any of them. 592 took the action
parameter's `data_kind` from that corpus, but nothing has read `ActionTypeV2`
whole against `action_types` and `action_type_rules`.

**Page read:** `api/ontologies-v2-resources-action-types-get-action-type` in
full, including the `LogicRule` union. Cross-checked against
`action-types/submission-criteria`.

**Consulted, not quoted:** the five mirrored `ontology/*scenario*` pages, named
in §2 as the feature we do not model.

**No images.** `api/` pages carry none.

---

## 1. The top level, and one field we do not have

`ActionTypeV2` carries eight fields: `apiName`, `description`, `displayName`,
`status`, `parameters`, `rid`, `operations`, and

> Optional description intended for tool use contexts, such as AI agents.

— `api/ontologies-v2-resources-action-types-get-action-type.md`

which is `toolDescription`, and `action_types` has no column for it. Every other
field maps: `api_name`, `description`, `label`, `status`, the
`action_type_parameters` rows, `rid`, and `action_type_rules`.

**Not built.** A column nothing reads is the defect this repository keeps
closing, and no Ontology Manager page describes editing it — the api is the only
source. Recorded because it is the one field an AI-facing product would want and
would otherwise re-invent under another name.

## 2. `applyScenario` has no counterpart in our twelve

The union's arms: `applyScenario`, `createInterfaceObject`, `createLink`,
`createObject`, `deleteInterfaceObject`, `deleteLink`, `deleteObject`,
`modifyInterfaceObject`, `modifyObject`. **Nine.**

Eight map onto `action_rule_kinds()` exactly — `createObject` to `create_object`,
`createInterfaceObject` to `create_object_of_interface`, and so on. The ninth
does not map onto anything: **we have no scenario rule and no scenario at all**,
while the mirror carries five pages — `overview-ontology-scenario`,
`temporary-scenario`, `persisted-scenario`, `merge-scenario`, `osdk-scenario`.

**Re-probed 2026-08-21, because this reading's sibling made the same claim from
the same weak evidence and was wrong.** `api-interface-type.md` said interface
extension was missing because `information_schema` had no table whose name
contained `extend`; the table is `interface_extensions`, which does not contain
that substring. So this claim was re-asked three ways instead: `pg_class` for a
relation of ANY relkind matching `scenario` — none; `pg_proc` by name **and by
`prosrc`** — none; `information_schema.columns` by table or column — none. The
only hits anywhere are migrations 083/136/156, which belong to the product the
teardown deleted. The absence is real.

So `applyScenario` is not a missing rule. It is one arm of a documented feature
we have not started, and the api is where its absence becomes visible.

**`DELIVERABLE-MAP.md` records this union as eight arms.** It is nine. Whether it
grew upstream or was miscounted, the number in that file is wrong, and the
`api/` refetch of 2026-08-19 is the likelier explanation.

## 3. Twelve against nine, which is the expected asymmetry

Ours has four kinds the api does not expose: `create_or_modify_object`,
`function`, `create_link_on_object_of_interface` and
`delete_link_on_object_of_interface`. `DELIVERABLE-MAP.md` already read this
correctly — it is what the Ontology Manager can configure versus what a program
can send, not two spellings of one idea — and this reading is the first check of
that claim against the union itself. It holds.

Three of those four were marked not-executable in `action_rule_kinds()` for
reasons that have nothing to do with the api: no link instance store, and no rule
column pointing at an interface link constraint.

### 3.1 What `create_or_modify_object` compiles to (read 2026-09-06, built as 760)

The asymmetry tells the design. The Ontology Manager offers the kind; the api
never carries it; so at apply time it must become one of the members the api
does carry. The rules page says so in its own words:

> "When multiple rules are defined, the actions backend compiles rules to generate a single edit per object (e.g., **Add object**, **Modify object(s)**, or **Delete object(s)**)."

— `action-types/rules.md`

and the rule's sentence gives the two branches and the create branch's two keys:

> "3. **Create or modify object(s):** Can be used to modify an existing object based on an object reference parameter. If an object is not selected, a new object will be created with either an automatically generated unique ID, or with a user submitted primary key."

— `action-types/rules.md`

The one place the mirror shows the rule configured is the Gaia walkthrough,
which spells the kind the other way round and puts the create branch's key
source on the rule card:

> "Select **Modify or create object** under **Object actions** before choosing **Next**."

> "Select **Auto-generated primary key** from the **Or create a new object with** dropdown menu."

> "Foundry will automatically generate a unique ID for each object created from Gaia."

— `object-link-types/create-ontology-objects-from-gaia.md`

**What the captures add that the prose does not — five parsed, named.**
`object-link-types/images/configure-milsym-action-type.png`: the Rules tab, a
card titled *1. Modify or create object* with two rows — *Modify existing
selected*, holding a chip with a clearable X, and *Or create a new object with*,
a dropdown showing *Auto-generated primary key* — over one PROPERTY → MAP TO
table that serves both branches. `configure-create-or-modify-action-type-properties.png`
and `configure-milsym-action-type-properties.png`: the same card inside the
wizard's *Map action parameters* step, the chip greyed, the second with a fifth
wizard step *Save location*. `configure-milsym-classification-parameter.png`:
a parameter's *Default value* set to *Object parameter property* from a chip
drawn identically — cube icon, blurred prefix, the type's name — which there
can only be an object reference parameter; **that capture decides what the
card's chip is: the rule's object reference parameter, not the object type.**
`configure-create-object-type.png`: despite the prose around it, a plain
*Create object* card (older chrome — *Form* in the left nav where the milsym
capture has *Parameters* and *User Interface*), whose table maps *Object Id →
Unique Identifier 1*, a key-iconed parameter. Read with the walkthrough's step
four —

> "4. Select **Back to Form** and remove `Object Id` from **Form content** by selecting the **X** icon on the far right side of the **Object Id** panel. Foundry will automatically generate a unique ID for each object created from Gaia."

— `object-link-types/create-ontology-objects-from-gaia.md`

— the auto-generated ID is a *parameter* the author hides from the form, which
is the `generate_uuid` type class 666 already honours server-side ("Replaces a
string parameter with a UUID." — `object-link-types/metadata-typeclasses.md`).
No capture shows the dropdown open, so its second option's label is unrecorded;
the prose supplies "a user submitted primary key". The key the walkthrough
auto-fills is a string column:

> "`Object ID`, which you will set as a `string` for Foundry to automatically populate with a unique ID for each Gaia shape you create as an object."

— `object-link-types/create-ontology-objects-from-gaia.md`

**Built (760) — the card compiles into parameters,** the way 592/594 generate
the parameters an interface rule needs. `action_type_rules` gains
`object_parameter_id` (the chip: the object reference parameter, named by the
author or generated by the save after the type) and `create_new_object_with`
∈ {`auto_generated_primary_key`, `user_submitted_primary_key`} — the
dropdown's two values, the first read off the capture and the wizard's shown
default, the second the prose's; no page prints the set, so the CHECK carries
no `Values from` declaration, as 676 did for the cover-page radios, and this
paragraph is the trace. Auto-generation compiles into a hidden string parameter
carrying `generate_uuid`, mapped onto the primary key — *Object Id → Unique
Identifier 1* — so the create arm's existing key lookup receives the UUID 666
fills; a user-submitted key is the `create_object` contract unchanged.
`apply_action` reads the selection off the parameter, asks `object_exists` (the
merged object per 422's four steps), and takes the create or the modify arm it
already had; the compiled `object_edits` row is `create` or `modify`, never a
third thing. A selected key that names no object is refused
`Actions:ObjectNotFound` — the api's own constraint: "The parameter value must
be the primary key of an object found within an object set."

**Inferences, each a numbered Decision below:** the caller's primary key stands
in when the parameter is blank; on the modify branch a mapped primary key is
skipped rather than refused. **Residuals:** 469 refuses create + create-or-modify
on one type in one action; Modify's "cannot reference an object created as a
part of the current action" is not attached to this kind and a key the same
action created is simply seen as existing; the existence check is ontology
visibility, not the restricted-view gate; an object visible only in an index
that is not ready does not exist to this rule until the build completes;
"object(s)" is one apply per selection, as the Explorer already does for
modify.

## 4. Scenarios reach submission criteria too

The feature is not only a rule arm:

> Submission criteria can also be based on the execution context in which an action submission is evaluated, namely if the action was submitted within an [Ontology Scenario](/docs/foundry/ontology/overview-ontology-scenario/). The Scenario execution context indicates that the action is being evaluated within an Ontology Scenario. It does not identify a particular Scenario.

— `action-types/submission-criteria.md`

So a scenario is an execution *context* a criterion can test, as well as a thing
a rule can apply. Both are absent here, and `action_type_submission_criteria` —
six columns, zero rows, already on the unread-column list — is where the second
half would land.

## Decisions

1. **Nothing was built from this reading until §3.1** (read 2026-09-06), from
   which 760 is built. `toolDescription` and `applyScenario` remain recorded
   gaps, and the second is a feature rather than a field.
2. **Do not add `toolDescription` speculatively.** No Ontology Manager page
   describes it and nothing would read it.
3. **Do not add a scenario rule kind.** A rule whose object does not exist is
   worse than an absent one — `action_rule_kinds()` already carries three
   not-executable kinds and each names why.
4. **DELIVERABLE-MAP's count is corrected** from eight to nine in this change,
   with the arm named — a stale number in the file whose job is answering "does
   a page about X exist" is the thing that file exists to prevent.
5. **`create_or_modify_object` compiles to a `create` or a `modify` edit** (760),
   chosen by whether its object reference parameter selected an object — the
   api has no upsert member and the page says the backend compiles rules to
   one edit per object. The kind stays in the registry because we build the
   Ontology Manager, whose menu offers it.
6. **The card's chip is the object reference parameter** (decided by
   `configure-milsym-classification-parameter.png`), so the save generates one
   after the type when the author names none, as 594 generates an interface
   rule's. *Inference, scoped:* when that parameter is blank and the caller
   passed a primary key, the key is the selection — the Explorer's, which is
   how `modify_object` has been told its object since 445. Not widened.
7. **Auto-generation is a hidden `generate_uuid` parameter mapped onto the
   key**, not a generator in the apply path — the capture's *Object Id → Unique
   Identifier 1* and step four's "remove `Object Id` from **Form content**".
   The two dropdown values are a column, `create_new_object_with`, bound to the
   kind by CHECK; the wizard's shown default, auto-generated, is the payload's
   default too.
8. **On the modify branch a mapped primary key is skipped, not refused**
   (inference): "primary key values cannot be modified by any action type" says
   what may not happen, and refusing would make every such rule unusable once
   an object is selected — the generated key parameter is mapped on every one.
9. **No refusal for a non-string key under auto-generation.** The walkthrough
   *instructs* a string key; nothing says another is refused, and we are not
   stricter than Foundry — a UUID onto a non-string key is the linter's to warn
   about, later.

## Questions

1. **Did the union grow, or was eight a miscount?** The `api/` refetch on
   2026-08-19 is the obvious suspect and `check:doc-drift` would have said so if
   the page were one we had built from.
2. **Is `toolDescription` writable, or derived?** The api marks it optional and
   says nothing about who sets it.
3. **Does a scenario belong in this product at all?** Five mirrored pages
   describe it; nothing here has ever needed it.
4. **What does the "Or create a new object with" dropdown's second option
   say, and does choosing it simply expose the key as a parameter** the way
   *Create object* does? No capture shows it open.
5. **Does the wizard create the chip's parameter itself, or bind an existing
   one?** The greyed chip in the wizard captures reads as pre-filled; the Rules
   tab's X reads as re-bindable. 760 generates when none is named.
6. **How does the public api present an action type carrying this kind** —
   decomposed into `createObject`/`modifyObject`, omitted, or an error? Nothing
   on the get-action-type page says.
