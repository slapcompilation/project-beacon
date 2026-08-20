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
does not map onto anything: **we have no scenario rule and no scenario at all.**
`information_schema` has no table whose name contains one, while the mirror
carries five pages — `overview-ontology-scenario`, `temporary-scenario`,
`persisted-scenario`, `merge-scenario`, `osdk-scenario`.

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

Three of those four are marked not-executable in `action_rule_kinds()` for
reasons that have nothing to do with the api: no link instance store, and no rule
column pointing at an interface link constraint.

## 4. Scenarios reach submission criteria too

The feature is not only a rule arm:

> Submission criteria can also be based on the execution context in which an action submission is evaluated, namely if the action was submitted within an [Ontology Scenario](/docs/foundry/ontology/overview-ontology-scenario/). The Scenario execution context indicates that the action is being evaluated within an Ontology Scenario. It does not identify a particular Scenario.

— `action-types/submission-criteria.md`

So a scenario is an execution *context* a criterion can test, as well as a thing
a rule can apply. Both are absent here, and `action_type_submission_criteria` —
six columns, zero rows, already on the unread-column list — is where the second
half would land.

## Decisions

1. **Nothing is built from this reading.** `toolDescription` and `applyScenario`
   are recorded gaps, and the second is a feature rather than a field.
2. **Do not add `toolDescription` speculatively.** No Ontology Manager page
   describes it and nothing would read it.
3. **Do not add a scenario rule kind.** A rule whose object does not exist is
   worse than an absent one — `action_rule_kinds()` already carries three
   not-executable kinds and each names why.
4. **DELIVERABLE-MAP's count is corrected** from eight to nine in this change,
   with the arm named — a stale number in the file whose job is answering "does
   a page about X exist" is the thing that file exists to prevent.

## Questions

1. **Did the union grow, or was eight a miscount?** The `api/` refetch on
   2026-08-19 is the obvious suspect and `check:doc-drift` would have said so if
   the page were one we had built from.
2. **Is `toolDescription` writable, or derived?** The api marks it optional and
   says nothing about who sets it.
3. **Does a scenario belong in this product at all?** Five mirrored pages
   describe it; nothing here has ever needed it.
