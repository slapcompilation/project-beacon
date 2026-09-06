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

### 3.1 What `create_or_modify_object` compiles to (read 2026-09-06, built as 760, corrected by 761)

*What this section looked at, counted:* `action-types/rules.md` whole,
`object-link-types/create-ontology-objects-from-gaia.md` whole,
`object-link-types/metadata-typeclasses.md` whole; six captures parsed and
named below — five of the Gaia page's twenty-five, plus
`action-types/images/build-schedule-run-rid-property.png`; the Gaia page's
other twenty were not parsed by me.

The asymmetry tells the design. The Ontology Manager offers the kind; the api
never carries it — §3's count of the `LogicRule` union is the deciding fact —
so at apply time it must become one of the members the api does carry. The
rules page's sentence about combining rules is consistent with that, though it
is about several rules on one object rather than this kind:

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

**What the captures add that the prose does not — six parsed, named.**
`object-link-types/images/configure-milsym-action-type.png`: the Rules tab, a
card titled *1. Modify or create object* with two rows — *Modify existing
selected*, holding a chip with a clearable X, and *Or create a new object with*,
a dropdown showing *Auto-generated primary key* — over one PROPERTY → MAP TO
table that serves both branches; the card's own title chip, the object type, is
drawn the same way. The new wizard names the action *Create or Modify <type>*
where the older capture and the prose say *Create <type>*; the tab also carries
a *Convert to Function Code (Experimental)* panel, seen, not built.
`configure-create-or-modify-action-type-properties.png` and
`configure-milsym-action-type-properties.png`: the same card inside the
wizard's *Map action parameters* step, the chip greyed, the second with a fifth
wizard step *Save location*. `configure-milsym-classification-parameter.png`:
a parameter's *Default value* set to *Object parameter property* from a chip
drawn identically — cube icon, blurred prefix, the type's name. The captures
are *consistent with* the chip being an object reference parameter and cannot
decide it, since the type chip is drawn the same; what decides it is the prose,
"based on an object reference parameter" (rules.md, quoted above).
`object-link-types/images/configure-create-object-type.png`: despite the prose around it, a plain
*Create object* card (older chrome — *Form* in the left nav where the milsym
capture has *Parameters* and *User Interface*, and a ⚠ beside the action's
name), whose table maps *Object Id → Unique Identifier 1* with a key glyph —
**the one MAP TO row without the Configure-parameter arrow every
parameter-mapped row carries.** And `action-types/images/build-schedule-run-rid-property.png`,
the capture that names what that row is: a rule property's MAP TO menu open,
headed *SELECT MAPPING TYPE*, listing *Parameter ▸*, *Static value ▸*, *Unique
Identifier ▸* (the key glyph, with a submenu), *Current User* and *Schedule run
RID*. **Unique Identifier is a mapping type — a value source beside Parameter —
not a parameter.** 668 recorded exactly that as a residual when it admitted
Schedule run RID from the same menu, and `trigger-schedule-build.md` called it
*the form's generate_uuid cousin on the rule side*. Read with the walkthrough's
step four —

> "4. Select **Back to Form** and remove `Object Id` from **Form content** by selecting the **X** icon on the far right side of the **Object Id** panel. Foundry will automatically generate a unique ID for each object created from Gaia."

— `object-link-types/create-ontology-objects-from-gaia.md`

— the wizard's *Add property* had created a form parameter for the key
("every new property being added to the rule will automatically create a
parameter with the same name"), the Unique Identifier mapping orphaned it, and
step four removes it. The form-side `generate_uuid` type class 666 honours
("Replaces a string parameter with a UUID." — `object-link-types/metadata-typeclasses.md`)
is that cousin, not this mechanism. No capture opens the *Or create a new object
with* dropdown, so its second option's label is unrecorded; the prose supplies
"a user submitted primary key". The key the walkthrough auto-fills is a string
column:

> "`Object ID`, which you will set as a `string` for Foundry to automatically populate with a unique ID for each Gaia shape you create as an object."

— `object-link-types/create-ontology-objects-from-gaia.md`

**Built (760, corrected by 761) — the card compiles into the rule's own
shapes,** the way 592/594 generate the parameters an interface rule needs.
`action_type_rules` gains `object_parameter_id` (the chip: the object reference
parameter, named by the author or generated by the save after the type and
reused by that name on a re-save) and `create_new_object_with` ∈
{`auto_generated_primary_key`, `user_submitted_primary_key`} — the dropdown's
two values, the first read off the capture, the second the prose's; no page
prints the set, so the CHECK carries no `Values from` declaration, as 676 did
for the cover-page radios, and this paragraph is the trace. Auto-generation
compiles into the key row mapped to the **`unique_identifier` value source** —
the sixth member of `action_rule_value_sources()`, admitted by 761 from the
mapping menu the way 668 admitted the fifth — which `apply_action` resolves to
a UUID string at apply time and which names no parameter. 760 had built it as a
hidden `generate_uuid` parameter; the post-build reconciliation refuted that
against the two captures above, and 761 replaced it before the PR merged. A
user-submitted key is the `create_object` contract unchanged. `apply_action`
reads the selection off the parameter, asks `object_exists` (the merged object
per 422's four steps), and takes the create or the modify arm it already had;
the compiled `object_edits` row is `create` or `modify`, never a third thing. A
selected key that names no object is refused `Actions:ObjectNotFound` — the
api's own constraint: "The parameter value must be the primary key of an
object found within an object set."

**Inferences, each a numbered Decision below:** the caller's primary key stands
in when the parameter is blank; on the modify branch a mapped primary key is
skipped rather than refused; the generated identifier's format; the payload's
default for the dropdown. **Residuals:** 469 refuses create + create-or-modify
on one type in one action, and two create-or-modify rules on one type; Modify's
"cannot reference an object created as a part of the current action" is not
attached to this kind and a key the same action created is simply seen as
existing; the existence check is ontology visibility, not the restricted-view
gate; an object visible only in an index that is not ready does not exist to
this rule until the build completes; "object(s)" is one apply per selection, as
the Explorer already does for modify; the required-property fallback reads the
merged object for properties the rule does *not* map — a mapped parameter left
blank writes a JSON null, which is a value, and is refused when the property is
required (670's rule, shared with `modify_object`; `inline-edits.md` reserves
"defaults to the existing value" for inline edits); `object_parameter_property`
is still refused at apply time, though 760 now supplies the parameter half it
needs; and `ontology_resource_row` replays a rule's properties without
`interface_property_id` and a function rule without its `inputs`, so a
label-only re-save of an interface or function action loses them — 760's re-save
fix covered the parameter-id half only; the other half is a forward correction
of its own.

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
6. **The card's chip is the object reference parameter** — by the prose,
   "based on an object reference parameter"; the captures are consistent with
   it and cannot decide it — so the save generates one after the type when the
   author names none, as 594 generates an interface rule's, and reuses it by
   that name on a re-save (761; 760 had reused any object parameter of the
   type, which a link side might own). *Inference, scoped:* when that parameter
   is blank and the caller passed a primary key, the key is the selection — the
   Explorer's, which is how `modify_object` has been told its object since 445.
   Not widened. Question 5 stays open.
7. **Auto-generation is the `unique_identifier` mapping type on the key row**
   (761) — the MAP TO menu's *Unique Identifier ▸*, a value source beside
   Parameter, resolved to a UUID string at apply time (the format is inference;
   the submenu's options are Question 7). Not a parameter: 760's hidden
   `generate_uuid` parameter was the form-side cousin, refuted after the build
   by `build-schedule-run-rid-property.png` and the missing Configure-parameter
   arrow on the key row. The two dropdown values are a column,
   `create_new_object_with`, bound to the kind by CHECK; a payload that omits
   it gets `auto_generated_primary_key` — *our* default, since no capture shows
   the dropdown before the walkthrough's instruction to select that option, and
   the builder always sends the value explicitly.
8. **On the modify branch a mapped primary key is skipped, not refused**
   (inference): "primary key values cannot be modified by any action type" says
   what may not happen, and refusing would make every such rule unusable once
   an object is selected — the key row is mapped on every auto-keyed one. A
   user-submitted key that is present and differs from the selected one is
   skipped too; refusing that case alone would be defensible and is not built.
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
7. **What does the *Unique Identifier ▸* submenu offer** — numbered identifiers
   (*Unique Identifier 1* suggests more than one per action), a format, both?
   No capture opens it; 761 generates one UUID per key row.
8. **Does Foundry refuse two create-or-modify rules on one object type in one
   action?** 469 does, reading the kind as a create; each may compile to a
   modify, and the page's three refused combinations do not say.
