---
verify: strict
---

# The action Schedule rule

One page, one rule kind: an action that recomputes data. The sweep queue
noted every ingredient exists — schedules (495), `run_build`, the rule
machinery (418/446/592) — and it does.

**What I read, counted rather than asserted.** `action-types/
trigger-schedule-build` (35 lines) whole; both its images parsed —
`advanced-schedule-action-type-rule.png` and
`build-schedule-run-rid-property.png`. Nothing skipped.

## 1. What the rule is

> "By configuring a **schedule rule** on an action type, you can trigger a build of that schedule whenever the action is applied."

— `action-types/trigger-schedule-build.md`

The add-rule menu places it under an **Advanced** group, beneath Ontology
Edits, External Request (Writeback Webhook) and Side Effects
(Notification, Webhook)
(`action-types/images/advanced-schedule-action-type-rule.png`) — the same
menu that confirms our executable-kinds split: the side-effect kinds we
excluded live in their own groups.

**Ordering is stated unconditionally**:

> "When an action type contains a schedule rule, the action's Ontology edits are applied *after* the build begins. Edits do not wait for the build to finish. Instead, the action triggers the build, captures the schedule run RID, and immediately applies the rest of the rules, including the Ontology edits."

— `action-types/trigger-schedule-build.md`

So the schedule rule executes first regardless of its position among the
rules, and what it leaves behind is an identifier.

## 2. The rule's requirement, and the delegation

> "Add a schedule rule to an action type and select a schedule. The schedule must be in [project-scoped mode](/docs/foundry/data-integration/schedules/#project-scope)."

— `action-types/trigger-schedule-build.md`

Our schedules carry exactly that mode (`scope IN ('user','project')`, 495) —
the requirement is holdable as a guard. Permissions are a delegation:

> "The action's [submission criteria](/docs/foundry/action-types/submission-criteria/) manage the permissions needed to trigger a schedule through the action. If users satisfy the action submission criteria, they can run the schedule without any direct permissions on the schedule."

— `action-types/trigger-schedule-build.md`

> "Foundry checks whether a user has permission to run the schedule the first time it is referenced and whenever the schedule rule is edited. Referencing a schedule from an action type delegates control over running it from the schedule to the action type. Anyone who can manage actions on the action type then controls who can trigger the schedule."

— `action-types/trigger-schedule-build.md`

The permission check moves to EDIT time; apply time trusts the action. Our
`run_schedules` heartbeat already holds the run recipe — swap claims to the
schedule's own scoping identity, `run_build`, record a `schedule_runs` row
with outcome Succeeded/Ignored/Failed — so a single-schedule variant of the
same recipe is the delegated runner.

## 3. The run RID is a value source

> "This RID is exposed as a value that can be referenced from the action type's Ontology edit rules, allowing you to write it into a string property of an edited object."

— `action-types/trigger-schedule-build.md`

The capture shows the mechanism precisely: the Schedule rule card with its
picker, then a Create object rule whose property maps to a mapping-type menu
of Parameter / Static value / Unique Identifier / Current User / **Schedule
run RID**, captioned "Store the schedule run's RID to track the build
progress" (`action-types/images/build-schedule-run-rid-property.png`). Two
notes from that menu:

- **Schedule run RID** joins our rule-property `value_source` set — a
  contextual source like `current_user`/`current_time`, naming nothing.
- **Unique Identifier** is a mapping type our set lacks — recorded as a
  residual, not built here (it is the form's generate_uuid cousin on the
  RULE side).

The same capture shows **Required inputs** on the rule — the parameterized-
schedule half ("If the selected schedule is parameterized, you must provide a
value for each schedule parameter." —
`action-types/trigger-schedule-build.md`), excluded below.

Status rendering closes the loop with our own vocabulary:

> "With formatting enabled, Foundry displays the RID value as a link with an icon and text that reflects the current status of the build: `Running`, `Ignored`, `Failed`, or `Succeeded`."

— `action-types/trigger-schedule-build.md`

`Ignored/Failed/Succeeded` are already our `schedule_runs.outcome` tokens
verbatim; `Running` is the in-flight build.

## 4. What stays out, each with its reason

- **Parameterized schedules** ("Required inputs") — our schedules have no
  parameterization; the trigger jsonb has no parameter grammar. Second
  tranche, with parameterization itself.
- **Value formatting** (the status-link rendering) — a surface concern for
  the object view, recorded with the Unique Identifier mapping type.
- **No schedule RID grammar is attested anywhere in the mirror** (grepped
  `ri.*.main.schedule*`: nothing) — a run RID we mint follows our own
  `rid_of` shape and is marked inference.

## Decisions

1. **A new rule kind `schedule`** in `action_rule_kinds()` (targets
   `schedule`, executable, runtime sql), with `action_type_rules.schedule_id`
   and a guard arm: the kind demands the FK, and the schedule must be
   project-scoped — the page's one requirement.
2. **Edit-time permission, apply-time trust**: the rule guard checks the
   EDITOR can run the schedule (organization membership, our schedules'
   manage predicate) at insert and update — the page's own clock. Apply time
   performs no schedule permission check: the delegation.
3. **The delegated runner**: `run_schedule_now(p_schedule)` — the
   single-schedule core of `run_schedules` (claims swapped to the schedule's
   scoping identity, `run_build`, a `schedule_runs` row) — granted to
   authenticated but refusing outside the `beacon.applying_action` window
   605 already opens, so only an action mid-apply can call it.
4. **Ordering held in apply_action**: schedule rules execute before the rule
   loop, unconditionally (the page's sentence); the last run's RID is the
   captured value.
5. **`schedule_runs.rid`** GENERATED as `rid_of('schedules',
   'schedule-run', id)` — grammar inference, no page prints one — and
   `schedule_run_rid` joins the rule-property `value_source` CHECK and
   apply_action's resolution CASE.
6. **The builder surface** (ActionTypesPage rules editor gaining the kind
   and the mapping type) is recorded as a residual with the other Studio
   editor gaps — the engine and the apply path are this arc's scope.

## Questions

1. **Which RID wins with several schedule rules?** The page speaks of "a
   schedule rule" singular. Ours: rules run in position order and the last
   captured RID is the value; one rule is the expected shape.
   `blocks: nothing.`
2. **Does the delegated run consume the schedule's trigger state?** The
   heartbeat's runs do; an action-triggered run is not the trigger firing.
   Ours: it does not touch `trigger_state` — the run is the action's, not
   the trigger's. `blocks: nothing.`
