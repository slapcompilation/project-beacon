---
verify: strict
---

# Automate — conditions and effects over the Ontology

**CORRECTED 2026-08-15.** This line originally listed eighteen pages as read.
That was false, and it is the failure CLAUDE.md names first — "A link is not a
reading". What was actually read when this was written:

- **In full**: `automate/security`, `automate/permissions`.
- **Partially** (the opening sections, enough for the shape and the quotes
  used): `automate/overview`, `condition-objects`, `condition-time`, `effects`,
  `evaluation-frequency`, `history-visibility-and-scope`.
- **By grep only**, for one passage: `effect-settings` (execution guarantees).
- **Not opened at all**: `condition-settings`, `effect-actions`,
  `effect-function`, `effect-notification`, `effect-fallback`, `limits`,
  `retries`, `muting-pausing-expiration`, `manual-execution`, `history`,
  `automation-dependencies`, `branching-automations`, `streaming`,
  `performance-best-practices`, `integrations`, `notification-settings`,
  `third-party-app-ownership`, and the three worked examples.

Every quotation in this reading traces (`check:readings` passes), so nothing
here is invented — but the decisions were taken with a third of the section
read, and **`retries`, `limits` and `effect-settings` in particular bear
directly on the runner that shipped**. Read them before the next slice.

**That list is CLOSED as of 2026-08-21, and it is kept above rather than
deleted** — a debt that is edited away is a debt nobody can check. Every page it
names is now read and cited below, along with the seven the list itself missed:
`_index`, `automation-administrators`, `execution-settings`,
`marketplace-automate` and the three examples. Thirty-seven of thirty-seven,
counted by listing the directory, not asserted.

## `effect-settings` read at last, 2026-08-17 — and it corrects the audit too

The warning above went unheeded through 521, 522, 543 and 544 — four migrations
into the runner, twice by me, while this paragraph sat here naming the page.
The weekly adversary then reported the runner "contradicts a published stop on
failure rule". Reading the page shows the adversary is **half right, and the
half it got wrong changes what to build.**

The rule is **conditional on an execution mode we do not model at all**:

> In sequential execution, if an effect fails, subsequent effects in the
> sequence will not execute. This applies even if a fallback effect is
> configured and executes successfully. A successful fallback action handles
> the failure of that specific effect but does not allow the sequence to
> continue.

> In parallel execution, effects execute independently and one effect's failure
> does not impact other effects.

And parallel is the **default**, reached whenever sequential is not configurable:

> Action, logic, and function effects can be ordered sequentially. You must have
> at least two of these types of effects to enable sequential execution.
> Otherwise, effects execute in parallel.

**So our runner is not contradicting the page — it implements the documented
default.** Continuing past a failed effect is exactly right for parallel. The
real defect is narrower and different: **sequential mode does not exist here**,
so the stop rule can never be honoured, and an automation that Foundry would let
you order cannot be ordered at all.

Note also the concurrency framing, which our SQL heartbeat satisfies trivially
but should not claim as a design: "Effects for a single automation... can be
configured to execute sequentially or in parallel." Our loop runs everything
serially in one transaction regardless — that is an implementation accident, not
parallel semantics, and it differs observably (a parallel run should not see a
prior effect's writes).

**What a fix needs**, recorded so the next attempt does not have to re-derive it:

1. `automations.execution` — `sequential` | `parallel`, **defaulting to
   `parallel`** because the page makes that the fallback.
2. `orderable` on `automation_effect_kinds()`. The page names exactly three —
   action, logic, function — and our registry already holds exactly those plus
   `notification`, so the column restates nothing.
3. A guard that sequential requires **at least two orderable effects**, which
   crosses tables and so is a trigger rather than a CHECK.
4. `run_automations`' effect loop labelled, and `EXIT` after the fallback block
   when the automation is sequential — after, because a successful fallback
   "does not allow the sequence to continue".

**Not built in this pass**, deliberately: restating `run_automations` from a
partial read of its live definition is how 543 shipped a described-but-unapplied
patch, and the whole point of this correction is that the runner has already
been changed four times by someone who had not read this page.

Read because it is §3 of the derived queue and the layer directly above what
F2 finished: its effects are the actions and functions we now run.

## 1. What it is, and what it replaces

> "**Automate** is an application for business automation. With Automate, you
> can define conditions that are checked continuously or on a schedule, along
> with effects that execute automatically when the specified conditions are
> met."

> "Automate is a fully backwards-compatible product that replaces Object
> Monitoring as the single entry point for all business automation in the
> platform."

So the noun is an **automation**, and it is a **condition** plus one or more
**effects**.

## 2. Conditions

Two families. **Time**:

> "There are two ways to configure the time condition: in the user interface or
> as a cron expression."

> "Exactly five fields (space separated): minutes, hours, day of month, month,
> day of week"

> "Note that seconds and years fields are not supported"

**That is the grammar 495 already implements** — five fields, and the same two
refusals. Nothing new to design.

**Object set**, six types, of which one is sunset:

> "**Objects added to set:** Triggers when a new object appears in the set."

> "**Objects removed from set:** Triggers when an object leaves the set."

> "**Objects modified in set:** Triggers when an object is modified in the set."

> "**Run on all objects:** Periodically runs effects on all objects in a given
> object set."

> "**Threshold crossed:** Triggers when a metric threshold is crossed or when a
> function returns true."

The set itself is defined three ways — "dynamically define an object set; select
a saved object set; or select a function that returns an object set", where
"The function must return an `ObjectSet<T>`". We have all three shapes already:
explorations, saved lists, and F1's typed return.

## 3. Evaluation frequency, which is a support matrix

> "Automate offers three evaluation frequency modes for object set conditions:
> live monitoring, scheduled monitoring, and automation-dependent."

The page prints a table of which condition supports which mode. Two rows
matter for scope: a **time condition supports scheduled monitoring only**, and
**objects modified in set supports live monitoring only** — it has no scheduled
column at all. So "modified" cannot be built on a timer by definition.

## 4. Effects

> "**Action effects:** Execute actions on objects, such as creating,
> modifying, or deleting object instances."

> "**Function effects:** Execute a function when the automation condition is
> met."

> "**Notification effects:** Send notifications to users or groups when the
> automation triggers."

> "**Logic effects:** Execute AIP Logic functions."

And a failure path:

> "Action, logic, and function effects can be configured with a fallback
> effect. Fallback effects execute when the primary effect fails, allowing you
> to handle errors gracefully"

## 5. The guarantee, stated plainly

> "Effects follow *at-least-once* execution semantics rather than
> *exactly-once* guarantees. In rare cases, the same effect may execute
> multiple times for the same trigger event."

> "Automate attempts to minimize duplicate executions but cannot completely
> remove them due to the distributed nature of the system and the retry
> mechanisms for handling transient failures."

The page's own mitigation is idempotency: "Implement *idempotent* operations,
meaning operations that produce the same result regardless of how many times
they execute."

## Decisions (mine, not Palantir's, unless quoted)

1. **An automation is one condition and an ordered list of effects**, stored
   the way 495 stores a schedule trigger — typed jsonb with a published
   grammar and a matcher in SQL, because that precedent exists and was
   validated against the page's own examples.
2. **The time condition reuses `cron_matches` unchanged.** Same five fields,
   same refusal of seconds and years, same dom/dow rule. Sharing the function
   rather than restating the grammar is the point.
3. **Effects ship as `action` and `function` only.** Both exist and are
   verified live; `apply_action` and `action-apply` are the action effect, and
   `function-run` is the function effect. **Notification and Logic are recorded,
   not built** — we have no notification system and AIP Logic is a product we
   do not have. Naming them in the registry with `executable = false` follows
   446's shape so the surface can disable rather than hide them.
4. **Evaluation is scheduled only, on the existing minute hand.** Live
   monitoring needs streaming; the matrix says a time condition is scheduled
   anyway, and "Objects modified in set" is live-only, so **that condition kind
   is refused by name** rather than approximated on a timer.
5. **Object-set conditions ship as `added`, `removed`, and `run on all`**, by
   diffing the set's membership between evaluations and keeping the previous
   membership the way `schedules.trigger_state` keeps observed events. Threshold
   crossed needs a metric history we do not have; recorded.
6. **At-least-once is promised explicitly, not quietly.** The page says the
   guarantee is at-least-once and tells authors to be idempotent; our runner
   records an execution before running the effect so a crash re-runs rather
   than skips, and the migration says so in those words.
7. **Fallback effects come with the first slice**, because they are the only
   thing that makes a failed effect visible to an operator, and because F2
   already distinguishes a function that broke from one that spoke.

## Questions, both answered by crawling

**1. Whose rights does an effect run with? THE AUTOMATION OWNER**, and my
proposal of "whoever last edited it" was wrong in a way that matters — an owner
is an explicit, transferable role, not a side effect of the last save.

> "**Condition evaluation:** Uses automation owner's permissions"

> "**Action, Logic, and Function effects:** Execute as the automation owner"

> "**Notification effects:** Use each recipient's individual permissions"

**That first line said "Action and Logic effects" when this reading was
written**, and the drift sweep of 2026-08-18 caught the change. It *widens* the
rule to function effects, which is the direction our schema already took —
`automations.owner_id` governs every effect, with no per-kind exception — so
nothing is falsified. Recorded because the previous wording left function
effects unstated, and an unstated case is where an invention goes.

`permissions` spells out four consequences of executing as the owner:
submission criteria "are evaluated against the owner", functions "receive
authentication tokens from the owner", edit history "shows the owner in the
**Edited by** field", and "**Audit logs** record Ontology edits as performed by
the automation owner".

Ownership is transferred deliberately, and editing is gated on it:

> "You must take ownership of the automation to make edits to the condition or
> effects."

> "Future actions effects will execute on behalf of the new owner."

And it is stated a third time so it cannot be mistaken for a scope setting:

> "Regardless of scoping mode, automations execute as the owner."

**The service identity exists too, and it unblocks something else.**
`permissions` documents third-party application ownership: "Automations can be
owned by third-party applications instead of individual users. When an
automation is owned by a third-party application, it uses a service user for
all executions, providing team continuity when individual users leave or are
out of office." Our schedules recorded project-scope mode as waiting on exactly
that — a service execution identity — so this page answers a question the
pipeline phase left open.

**2. Where does an automation sit? IN A PROJECT**, and its dependencies are
imported there:

> "Project-scoped automations require all transitive resources used in the
> automation to be imported into the project."

Scope is about who sees run history — "Project scope enables team
collaboration by making run history (including effect executions) visible to
all users who satisfy the markings on a run" — not about whose rights run. I
had these two conflated; the pages separate them explicitly.

## Decisions, revised by those answers

8. **`automations.owner_id`, and effects execute as the owner** through 486's
   claims swap — not as the last editor. Condition evaluation uses the same
   identity, so a condition cannot see what its owner cannot.
9. **Editing the condition or effects requires being the owner**, refused by
   name, because the page makes taking ownership the precondition for editing.
10. **Scope (`user` / `project`) governs history visibility only.** Recorded as
    a column now and enforced when history exists; it must never be mistaken
    for an execution identity, which is why the page says so three times.
11. **Third-party-application ownership is recorded, not built** — it needs a
    service user, which the schedules phase is also waiting on. When it lands
    it should serve both.

## Built (2026-08-15) — migrations 517–519

Decisions 1–11 shipped as recited. `automations` carries the condition, the
owner and the scope; `automation_effects` carries the ordered effects and their
fallbacks; `automation_runs` is written **before** each attempt, which is the
at-least-once promise made in the direction the page chooses. The registry
names all four effect kinds with `executable` and `runtime`, so `notification`
and `logic` are disabled rather than absent, and a `function` effect is
executable but not by this heartbeat — the same split 509 drew for function
rules.

Editing the condition or the effects is refused to anyone but the owner, by
name. The runner reads `owner_id` and never `scope`, which a test asserts
against the function body: scope widens who reads `automation_runs` and nothing
else.

**Two things the standing suite caught, both on the first run after 517.**
`automation_runs` had no table comment, which `catalog.test.ts` asks of every
table. And 517 built the runner without wiring it into the minute hand — the
same mistake 442 made with the indexer and 513 had to repair. 518 wired it
immediately, but the pattern is worth naming: **a runner and its caller belong
in the same migration**, because a migration that ships only half of them looks
finished.

**Deferred, and said out loud**: live monitoring, which needs streaming;
`objects_modified` and `threshold_crossed`, which the support matrix and a
missing metric history rule out; notification and Logic effects; and
third-party-application ownership, which waits on the service user that
project-scoped schedules also want.

## Read afterwards (2026-08-15) — two pages that contradict what shipped

Reading `retries` and `limits` in full, having built from neither.

**1. The fallback rule — and I over-read it first.** I recorded this as "the
fallback fires too early, full stop". Reading the sentence again, it is a
DISJUNCTION:

> "Fallback effects are not eligible for event retries. They execute only after
> an object fails with a non-retryable error or reaches the maximum number of
> retries."

The second arm settles it: with no retry strategy configured the maximum number
of retries is zero, which is trivially reached, so a fallback fires at once.

**Upstream reworded this sentence between the reading and 2026-08-18**, and the
rewording sharpens it in our favour: "not eligible for retries" has become "not
eligible for **event** retries", which is the distinction the same sweep added
elsewhere — see §Drift below. The disjunction, which is the load-bearing half,
is unchanged.
**517's behaviour was therefore correct for every automation we can create**,
because retries did not exist here. What was missing was the configuration the
rule hangs on, not the branch.

521 and 522 add it: retry bounds as published, a classifier for the errors the
page calls retryable, and a fallback withheld only when a retryable failure
meets an effect that opted into retries. Behaviour is unchanged for everything
that has no retry configuration.

The retry machinery it depends on is published too: per-effect automatic
retries, configurable, and available **only on action and Logic effects**;
plus event retries with two parameters — a "**Retry interval:** The time
interval between retries. This must be less than 24 hours" and a "**Number of
retries:** The maximum number of times an event will be retried… this must be
between 1 and 5". Retryable means "Rate limits", "Service outages", and
"Ephemeral errors such as `Actions:ObjectVersionChanged`".

**2. The object-set cap is invented and wrong.** `object_set_keys` caps at
10,000, a number I chose. The published limits are per condition:

> "Maximum input size for `Objects added` or `Objects removed` conditions with
> scheduled execution | 100,000"

> "Maximum input size for `Run on all objects` condition with scheduled
> execution | 1,000,000"

with the behaviour also stated — "Error message when saving the automation OR
runtime error when evaluating the automation if the input set grows beyond the
limit". Ours truncates silently at a tenth of the smaller one, which is the
worse failure: a condition that quietly stops seeing objects.

`limits` also publishes runtime bounds we have no equivalent for: 45 minutes
maximum wait in the execution queue, and 4 hours maximum run, where "effects
that completed before the timeout are preserved".

**Neither is fixed here.** Both are recorded in DELIVERABLE-MAP so the next
change starts from the published numbers rather than from mine.

---

## Upstream moved (2026-08-18) — what the drift sweep found

`check:doc-drift` reported 36 pages changed across 14 readings; seven of them are
this reading's. Re-mirroring `automate/` rewrote **37 files**, and
`check:readings` immediately failed on three quotations here — which is the pair
of guards working as one: drift says a page moved, the citation gate says which
sentence we were standing on. All three are fixed above. Nothing falsified what
shipped in 517–521. What follows is the material that is genuinely new.

### Nothing was falsified, and one near-miss is worth stating

`automation_effects_retries_where_allowed` restricts a configured retry to
`kind IN ('action','logic')`, and `retries` now says:

> "Action, logic, and function effects may receive immediate, short-term retries within a trigger event to overcome ephemeral errors such as rate limits."

Read alone, that reads like our CHECK is now wrong. It is not — the same page
still carries the sentence the CHECK was built on:

> "Note that effect retries can currently only be configured on the following:"

followed by Action effects and Logic effects, and nothing else. The sweep added a
*second, separate* mechanism, which `effects` now names explicitly:

> "**Per-effect automatic retries:** Configure automatic retries on individual action and logic effects to handle temporary errors such as rate limits."

> "**Event retries:** Configure retry strategies for entire trigger events to handle persistent errors such as service outages."

**Two mechanisms, and we built the first.** The short-term retries function
effects "may receive" are automatic and not configured, so they are not a
`retry_count`. Checking the *other* sentence on the same page rather than
reacting to the new one is what kept a correct constraint from being widened.

### Multiple cron expressions per time condition — a real gap

> "You can add multiple cron expressions to a single time condition to define more complex scheduling patterns. When using advanced cron mode, select the option to add additional cron expressions."

> "Each cron expression must be non-overlapping with the others"

> "All expressions must individually meet the cron expression requirements listed above"

with the page's worked example: `0 9 1,15 * *` plus `0 10 * * 5`, where "Using
different times prevents the schedules from overlapping when the first or
fifteenth falls on a Friday."

Ours takes one: `automation_condition_valid` requires `condition->>'cron'` to be
a single non-empty string. This is a capability we do not have.

**The non-overlap requirement is stated as a requirement on the author, not as a
refusal by the platform**, and that distinction decides how it should be built —
see Decisions below.

### Automatic pausing due to excessive activity

> "The system may automatically pause an automation when it detects excessive activity. While paused, scheduled and live triggers do not run, but manual runs and event retries remain available."

> "A user with an `Editor` role on the automation can resume a paused automation at any time from the automation overview."

Our `automations.paused` is a boolean an author sets. This describes a *second*
writer of that column and, more interestingly, a **partial** pause: manual runs
and event retries still work. A boolean cannot say which of those is true.

### Manual execution skips a permission check, and says so

> "Manual executions bypass trigger conditions, so Automate does not perform the trigger-object permission checks described above. The input object set is still evaluated with the permissions of the user who starts the manual run."

Two identities in one sentence: the *trigger* checks are skipped, the *input
object set* is read as the person who pressed the button — not as the owner.
That is the first documented exception to the flat rule two paragraphs above it
on the same page — automations execute as the owner regardless of scoping mode —
which this reading's Decision 8 restates without qualification.

### Notification recipients now have stated requirements

> "* At least **Viewer** permission on the automation (required for both static and dynamic recipients)"

> "* **Viewer** permission on the object instances that trigger the automation"

> "* **Viewer** permission on all the properties of the object instances if the triggering object type is a [multi-datasource object type](/docs/foundry/object-permissioning/multi-datasource-objects/)"

> "These requirements apply for both active and pre-registered users."

### And two smaller additions

> "Automate integrates with [Global Branching](/docs/foundry/global-branching/overview/). You can create, test, and modify automations on a branch before merging changes to `main`."

> "Automations can be owned by third-party applications instead of individual users. This ties execution history and permissions to the application's service user, preserving team continuity when an individual owner is unavailable."

The second was already recorded here as "recorded, not built"; it has moved from
the `permissions` page into `security` and grown its own page.

## Decisions from the sweep

1. **Nothing is rebuilt or widened.** The one change that looked like it
   falsified a CHECK did not, and the reason was a second sentence on the same
   page. **When a drifted page seems to contradict a constraint, read the whole
   page again, not the diff** — a diff shows what moved, never what still holds.
2. **Multiple cron expressions — BUILT (573).** A time condition names either
   one `cron` or a non-empty `crons` array, never both, sharing one `timezone`;
   it fires when **any** expression matches. Existing rows keep working.

   **Non-overlap is not enforced, and the build strengthened the reason.** The
   reading's argument was that Foundry states it as a requirement on the author
   and never says the platform refuses an overlapping pair, so a CHECK would be
   inventing enforcement. True, but the decisive reason is narrower: **firing is
   once per tick on any match, so in this engine an overlap is a non-event.**
   Two expressions matching the same minute produce one firing. Foundry
   presumably needs the rule because theirs would fire twice. A CHECK would
   refuse configurations that behave correctly here, which is worse than not
   having one. (It is also intractable to check exactly — the documented dom/dow
   OR rule makes field-wise disjointness unsound — but that is a reason not to
   fake it, not the reason not to do it.)

   **Scope, which nearly went wrong.** This is *Automate's* time condition.
   `building-pipelines/triggers-reference` still says a time trigger is "defined
   using a cron expression and a time zone" — singular — so `schedules.trigger`
   is untouched, and a test asserts that a `crons` array is still refused there.
   The two grammars look alike; only one page moved.

   **The timezone stays on the condition.**
   `condition-time-cron-configuration.png` pairs one cron field with one
   timezone dropdown, which is our shape. That capture predates multiple
   expressions and **no image shows the multi-cron control at all**, so a zone
   per expression would be invented structure.
3. **Automatic pausing is not built.** ~~"Excessive activity" is undefined — no
   threshold, no metric, no window anywhere in the section.~~ **The second
   sentence is FALSE, and the section below names the page that states the
   threshold** — one this reading's own header lists as never opened. The
   verdict stands; its stated reason does not. What it *does* expose
   is that `paused boolean` cannot express the partial pause the page describes,
   and that is recorded as a question rather than guessed at.
4. **Manual execution is not built, and Decision 8 is now qualified.** "Everything
   executes as the owner" is true for triggered runs and false for the input
   object set of a manual run. We have no manual execution, so nothing is wrong
   today — but the unqualified sentence in Decision 8 would have become wrong the
   moment one was added, which is exactly how a stale reading does damage.

   **AMENDED 2026-08-22, after trying to build it.** The blocker is structural,
   not a missing function, and I only found it by writing the migration and
   watching it fail with `permission denied for function
   automation_effect_rows`. The run ledger has ONE writer by construction:
   `automation_runs` carries a SELECT policy and **no INSERT or UPDATE policy at
   all**, and `record_automation_run`, `settle_automation_run` and
   `automation_effect_rows` are SECURITY DEFINER granted to `beacon_runner`
   alone — 553's fix, which inverted the scheduled path rather than elevating
   around it.

   An inline manual run needs one of two things, and both undo 553: those grants
   widened to `authenticated`, which is a forgery surface on the ledger; or the
   entry point made SECURITY DEFINER, which would also elevate `apply_action`
   and let an editor cause writes they could never make themselves.

   The third option is what the pages describe anyway — a manual run is an
   EVENT the execution queue drains ("Max time an automation event can wait in
   execution queue"; events "enter the queue in trigger order and begin
   executing in trigger order"). So `execute_automation_now` should ENQUEUE and
   `beacon_runner` should execute. **That is a structural reason to build the
   event log rather than a preference**, which is what this entry used to be.
5. **Notification recipient permissions are not built**, because we have no
   notification effect delivering to a recipient. Recorded so the four
   requirements arrive with the feature rather than after it.

## Questions from the sweep

1. **Does Foundry refuse overlapping cron expressions, or only ask for
   non-overlap?** Still open, and 573 no longer waits on it: an overlap is
   harmless in our engine either way. It would only matter if firing became
   per-expression rather than per-tick. `blocks: nothing`.
1b. **Does each expression in a multi-cron condition carry its own timezone?**
   Unattested — the only cron screenshot predates the feature and pairs one
   expression with one zone. 573 keeps the zone on the condition.
   `blocks:` a multi-cron authoring surface.
2. **What does a partially paused automation look like in the data?** Scheduled
   and live triggers stop while manual runs and event retries continue, so pause
   is at least a three-state. Whether an auto-pause is distinguishable from an
   author's pause — and whether resuming needs `Editor` specifically — is not
   said. `blocks:` auto-pause, and any UI that shows why an automation is idle.
3. **Is the manual-run identity split documented anywhere else?** One sentence
   carries the whole rule, and it contradicts the flat "execute as the owner"
   summary two paragraphs above it on the same page. `blocks:` manual execution.

## Four pages read at last, 2026-08-21 — and one of them falsifies Decision 3

The header lists eighteen pages as never opened. Four of them are read here in
full, because the unread-column sweep put `automation_effects.retry_count`,
`retry_interval`, `fallback_for` and `automation_runs.attempt`,
`next_attempt_at` on the engine-with-no-surface list, and a surface cannot be
built from pages nobody has read.

**Pages read in full:** `automate/history`, `history-visibility-and-scope`,
`muting-pausing-expiration`, `manual-execution`, and `retries`.

**Images parsed (1 of 21 across those five):**
`activity-single-automation-activity.png`, which is the whole automation view.
The other twenty I did **not** open, and they are named here rather than left
silent: `activity-single-automation-activity-effect-log.png`, `project-scoped.png`,
`auto-mute.png`, `muting-pausing-configuration.png`,
`summary-expiration-date-config.png`, `manual-execution.png`,
`manual-execution-settings.png`, `manual-execution-recipients.png`,
`failed-events.png`, `effect-retry-config.png`, `select-failed-events.png`,
`selected-effects.png`, `retry-job.png`, `manual-exec-failures.png`,
`manual-execution-retry-dialog.png`, `rerunning-failed-batch-job.png`,
`event-retries-configuration.png`, `example-event-retries.png`. **A surface
built from this section must open them first** — that is the whole lesson of
this reading's header.

### Decision 3's stated reason was false

> When the **Auto-mute this automation** setting is enabled, the automation will automatically mute when all effects fail for at least 80% of the past 30 events.

— `automate/muting-pausing-expiration.md`

A metric (all effects fail), a window (the past 30 events) and a threshold
(80%). Decision 3 said no threshold, metric or window existed *anywhere in the
section*; it existed on a page the header already admitted was unopened. **The
decision itself — do not invent an auto-pause — is unchanged and now rests on
the right reason:** the page states a threshold for auto-**mute** and none for
auto-**pause**, and `history` confirms the two are different events.

> `Paused` | Recorded when any user pauses an automation or when an automation is automatically paused due to excessive failures.

— `automate/history.md`

So auto-pause exists and its trigger is unstated, while auto-mute's is exact.
Building the first would still be inventing; building the second would not.

### Mute is not pause, and we have neither

> When an automation is muted, the condition continues to be evaluated and activity is still recorded. However, no effects will be triggered.

— `automate/muting-pausing-expiration.md`

> While an automation is paused, scheduled and live triggers do not run. You can still run the automation manually or retry events; the interface warns that scheduled and live triggers remain disabled. Pausing also interrupts active executions.

— `automate/muting-pausing-expiration.md`

`automations` has `paused boolean` and **no `muted` column at all**. The two are
orthogonal — muted still evaluates, paused does not — so one boolean cannot
carry both, and the "partial pause" question in the sweep is really this: pause
is three-state (running / paused-but-manual / expired-and-blocked) and mute is a
separate axis.

**Expiration is a third thing we do not have:**

> Automations can be configured to have an expiration date or to run indefinitely. The longest permitted expiration date is six months from the present time.

— `automate/muting-pausing-expiration.md`

and it is a harder block than either:

> Expired, trashed, and otherwise disabled automations continue to block all execution, including manual runs.

— `automate/muting-pausing-expiration.md`

### What the retry columns mean, and ours already match

The sweep's five columns are `retries`' two parameters plus the run's position
in a retry chain:

> **Retry interval:** The time interval between retries. This must be less than 24 hours.

— `automate/retries.md`

> **Number of retries:** The maximum number of times an event will be retried. Note that this does not include the initial attempt, and this must be between 1 and 5.

— `automate/retries.md`

Ours: `retry_count BETWEEN 1 AND 5`, `retry_interval < '24:00:00'`, and
`retries_where_allowed` restricting them to `action` and `logic` — which is
this sentence, and it is already exact:

> Note that effect retries can currently only be configured on the following:

— `automate/retries.md`

**So the engine is right and unreachable, which is the worst combination:** a
constraint nobody can see is one nobody knows to satisfy.

`fallback_for` is likewise cited:

> Fallback effects are not eligible for event retries. They execute only after an object fails with a non-retryable error or reaches the maximum number of retries.

— `automate/retries.md`

### The event log, which is the surface we are missing

**CORRECTED 2026-08-22: the number is TEN, and the list below has always had
ten items.** I wrote "eleven" here and repeated it in four more places
including #748's Decisions block, while the enumeration sitting next to the
word disagreed with it. Counting the row of a table I had already transcribed
is the cheapest check there is, and I did not do it — rule 7 one step earlier
than usual.

`history` names **ten** event types — `Automation triggered`,
`Automation recovered`, `Condition edited`, `Subscribed`, `Unsubscribed`,
`Evaluation failed`, `Paused`, `Resumed`, `Muted`, `Unmuted` — and until 622
`automation_runs` recorded none of them. It records an outcome per effect per
run, which is the *effect* half of an event, not the event.

`activity-single-automation-activity.png` draws the whole view, and it is more
structure than the prose gives:

- a left rail on the automation — an All automations back link, the
  automation's icon, name and subtitle, then **Overview**, **History**
  (selected), **Execute**, **Telemetry**;
- `Event log (100+)` with a refresh control, a **Show only my events** toggle
  (which is `history`'s shared-events feature) and a filter button;
- a table of **Event / Time / Errors**, each row an icon, a name, a timestamp
  and an arrow opening a right panel;
- the panel: `Triggered by` with a link out, a second card pairing the trigger
  with a **Time event** and its timestamp, a **Status** card drawn as a
  five-dot vertical timeline — `Poll for patches`, `Evaluation`,
  `Job submitted to queue`, `Job execution`, `Automation complete`, each
  timestamped — and an **Effects** section listing each effect with a green
  `Effect succeeded` and a chevron;
- a bottom bar reading `Effect viewer`.

**The five-stage Status timeline is the find.** The prose says only "the full
execution timeline, including condition evaluation details, effect execution
status, timestamps, and any errors"; the stages are named nowhere but the image.

### Retention, which nothing here implements

> Automation history is retained for six months, then permanently deleted.

— `automate/history.md`

## Decisions from the four pages

1. **No new columns until there is a surface.** `automations` has zero rows and
   nothing under `apps/web/src` names an automation. Adding `muted`,
   `expires_at` and an event log to an engine nothing reaches makes the
   unread-column list longer, which is the defect CLAUDE.md opens with. **The
   next slice of Automate is a screen, not a migration.**
2. **Decision 3's reason is corrected, its verdict kept.** Auto-mute has an
   exact threshold and auto-pause has none; neither is built, and now for
   reasons that are true.
3. **`muted` is a separate column from `paused`, when it is built.** They are
   orthogonal by definition — muted evaluates and records, paused does not.
   One boolean cannot carry both and a tri-state would conflate two axes.
4. **The event log is a table, not a widening of `automation_runs`.** Eleven
   event types, most of which are metadata changes with no effect execution at
   all — `Condition edited`, `Subscribed`, `Muted`. `automation_runs` is the
   effect half and stays as it is.
5. **Manual execution stays unbuilt** — batch size, parallelism, three object
   set kinds and recipient notifications, none of which we have. Decision 4 of
   the sweep is unchanged.
6. **Twenty images remain unparsed and are named**, and no surface is built
   from this section until they are.

## Questions from the four pages

1. **Does an auto-mute unmute itself?** `history` says automations
   automatically unmute when the mute period expires, implying a mute has a
   period — but no page read here states where that period is configured.
   `blocks:` an auto-mute implementation.
2. **What are `Poll for patches` and `Job submitted to queue` in our engine?**
   The timeline's five stages are Foundry's pipeline. Ours is a cron tick
   calling `run_automations`, which has no queue. A faithful Status card may
   have fewer stages, and inventing the missing ones would be drawing a
   pipeline we do not run.
3. **Is `Subscribed`/`Unsubscribed` a feature we have at all?** Two of the
   ten event types are about subscription, and nothing in the schema
   mentions it. `blocks:` a complete event log.

## The surface, 2026-08-21 — four more images, and the status vocabulary is in a filter pane

Decision 1 of the previous section says the next slice of Automate is a screen,
and Decision 6 says no surface is built until the images are open. Four more are
open here.

**Images parsed (5 of 21 now):** `activity-single-automation-activity.png`
(previous section), plus `automate-overview-page.png`,
`getting-started-automations-table-filtered.png`,
`activity-single-automation-activity-effect-log.png`.

**Still unparsed (17), and still named:** `project-scoped.png`, `auto-mute.png`,
`muting-pausing-configuration.png`, `summary-expiration-date-config.png`,
`manual-execution.png`, `manual-execution-settings.png`,
`manual-execution-recipients.png`, `failed-events.png`,
`effect-retry-config.png`, `select-failed-events.png`, `selected-effects.png`,
`retry-job.png`, `manual-exec-failures.png`,
`manual-execution-retry-dialog.png`, `rerunning-failed-batch-job.png`,
`event-retries-configuration.png`, `example-event-retries.png`. Every one of
them is about authoring, manual execution or retry management — none of which
this slice builds.

### The application's IA, from two images that agree

`automate-overview-page.png` and `getting-started-automations-table-filtered.png`
share a header: a lightning app icon, the app name `Automate`, then two tabs —
**Overview** and **Automations** — with `+ New automation` as a **green**
primary on the right beside `Help`.

The prose confirms what each tab holds:

> The **Overview** page shows a list of your recent automation activity, including counts of total automations you can see, automations owned by you, automations of which you are a recipient, and paused automations. You can also see lists of recently viewed automations, failures within the last four weeks, and recently triggered automations.

— `automate/getting-started.md`

The image adds the shapes the sentence does not: `Active automations` with a
count chip and a `View all →` link, three stat cards — `Owned by you` /
*Executed on your behalf*, `For you` / *You receive notifications*, `Paused` /
*Automation is not evaluated* — then a `Recently viewed` table
(`FILES · CREATOR · LAST EDITED BY · LAST VIEWED`) and a
`Failures in last 4 weeks` table (`Automation · Time · Errors`).

### The status vocabulary is an enumeration, and it is in the filter pane

`getting-started-automations-table-filtered.png` lists five statuses as
checkboxes with counts, each with its own glyph:

| status | glyph |
|---|---|
| `Active` | tick in a circle |
| `Error` | exclamation in a circle |
| `Muted` | bell with a slash |
| `Paused` | pause bars |
| `Expired` | slashed circle |

**This is the page that LISTS the set**, so by the rule CLAUDE.md carries it
beats any prose describing one member. The table itself is
`Name · Condition · Status · Creator` with a `···` overflow per row, and the
row is: a rounded tile with the condition's glyph, the name as a link, and
**the condition kind as the subtitle** — `Time` here, `Objects added` in
`activity-single-automation-activity.png`. Two images agree on that, which is
why the subtitle is treated as structure rather than decoration.

The `Condition` cell is a grey pill with the same glyph and the condition in
words — `At 09:00 AM`. The `Status` cell is a green tick and the tag
`Running on schedule`, which is prose for `Active` rather than a sixth value.

### Three of the five we can answer, and two we deliberately cannot

`automations` has `paused boolean` and nothing else of this vocabulary.

- **Paused** — `paused`.
- **Error** — derivable: the automation's most recent run failed.
- **Active** — neither of those.
- **Muted** and **Expired** — need the `muted` and `expires_at` columns the
  previous section decided not to add until a surface exists. They are shown in
  the filter pane **disabled, with the reason on hover**, which is the shape
  `action_rule_kinds()` already set: a kind that cannot run is shown disabled
  rather than hidden, because hiding it makes the vocabulary look smaller than
  it is.

### The Effect viewer, and why the History detail stops where it does

`activity-single-automation-activity-effect-log.png` expands the bottom bar into
an **Effect viewer**: `Triggered by`, a green `Action ran successfully`, and
**Execution trace logs** — a flame chart of `Action effect executing via
automate` / `Action execution` / `Edits calculation` / `Email Drafter request`
with a `Configure log access` control.

**We have no trace, no flame chart and no per-effect log**, so the detail stops
at the run row: outcome, error text, attempt, and the next attempt when one is
scheduled. Drawing an empty flame chart would be drawing a pipeline we do not
run — the same reason the previous section refused to invent the five Status
stages.

## Decisions for the surface

1. **Two tabs, `Overview` and `Automations`**, under the app name, exactly as
   both images show. `+ New automation` is **not** built in this slice — the
   creation wizard is five pages over `condition-settings`, `effect-actions`
   and `effect-function`, none of which are read.
2. **The five statuses are all shown; two are disabled.** Muted and Expired
   carry the reason. The alternative — listing three — would misrepresent the
   vocabulary as smaller than the page that enumerates it.
3. **`Running on schedule` is not a status.** It is the Active tag's wording on
   a time condition. Ours says the same for a time condition and
   `Running on changes` for an object-set one, because a cron is a schedule and
   an object-set trigger is not.
4. **The condition kind is the row's subtitle**, and the condition itself is a
   pill. Both come from the images; the prose describes neither.
5. **`For you` is not built.** Its subtitle is *You receive notifications*, and
   the notification effect is `executable = false` here with the note "No
   notification system exists here". A card that always reads zero for a
   feature we do not have is worse than an absent one.
6. **Status derivation lives in the page, not in a migration.** Decision 1 of
   the previous section holds — this slice adds no schema. If the derivation
   needs an index later, that is a measurement, not a guess.
7. **The History tab shows RUNS, and says so.** `automation_runs` is the effect
   half of an event; the ten event types are not built. The tab names what
   it is rather than borrowing the Event log's title.
8. **`Execute` and `Telemetry` appear in the rail, disabled.** Both images show
   four rail entries. Manual execution is decided-unbuilt, and there is no
   telemetry; hiding them would misdraw the application.

## Questions from the surface

1. **What is `Recently viewed` backed by?** Foundry tracks per-user resource
   views. Nothing here records one, and inventing a view log for a list on one
   page is a table with a single reader. Left out; the Overview shows the
   counts and the failures, which are answerable.
2. **Is `Error` a status or a run outcome?** The filter pane treats it as an
   automation status while `automation_runs.outcome` carries `failed`. Ours
   derives the first from the second, which is an inference — no page states
   the derivation.

### Built — 609 and 610

**609** gives `muted` and `expires_at` their columns, which Decision 1 above
gated on a surface existing. #745 is that surface, so the condition was met.

- **Mute keeps the automation a candidate** and changes only the effect loop,
  because the condition "continues to be evaluated and activity is still
  recorded". Pause is the opposite and was already right.
- **"Activity is still recorded" lands on `skipped`** — a value 517 put in the
  outcome vocabulary that nothing had ever written. An allowed value with no
  producer, given the one the word describes.
- **Expiry is excluded from the candidate set**, not handled in the loop,
  because expired automations "continue to block all execution, including
  manual runs". NULL is the other
  documented choice, "run indefinitely".
- **The six-month cap is a trigger, not a CHECK.** "From the present time" is a
  fact about the moment of setting; a CHECK would re-evaluate it on every write
  and on restore, and refuse a row that was legal when it was written.

**610 exists because 609's third path never ran.** The probe took its own escape
and printed *the muted branch is unproven here* — the database holds no action
type, so there was nothing to attach an effect to. 610 creates one and proves
the branch **by contrast**: muted records `skipped` and nothing else; unmuted
records something else and no `skipped`. One direction alone would pass against
a branch that skipped everything, or one that skipped nothing.

610 also found a guard I did not know about — `guard_automation_effect_ownership`
compares `auth.uid()` to the owner, and a migration has none, so the first run
was refused with `Automate:TakeOwnershipToEdit`. That is the guard working; the
probe now speaks as the owner.

**Auto-mute is still not built, and the refusal is the interesting part.** Its
rule is exact — 80% of the past 30 **events** — but we have runs per effect, and
thirty events is not thirty rows. Choosing a row-based approximation would
invent a threshold Foundry did not state, which is Decision 3's original mistake
one step further on.

**The surface** now answers all five statuses and disables none. The ranking is
what blocks what: expired outranks paused, which outranks muted, which outranks
error. **The first version of that test passed with the order deliberately
wrong** — the fixtures were disjoint, so no ordering could be told from a
coincidence. One automation that is expired and paused and muted at once is
what makes the assertion mean anything, and it now fails under both wrong
orderings.

## Questions from 609

1. **Does unmuting need `Editor` specifically?** The page says a user with an
   `Editor` role on the automation can unmute and can resume. Ours gates writes
   through `editors write automations`, which is the project's editor rather
   than a per-automation role. Close, and not obviously the same thing.
2. **What clears an expiry — the owner, or does an expired automation stay
   expired?** No page read here says whether `expires_at` may be moved forward
   after it has passed. Ours allows it, which is an inference.

### Built — 611, sequential execution

The four steps this reading wrote down in August, now built. Its stated reason
for waiting had expired: the runner's live definition has been read and patched
twice since, and this patch was taken from `pg_get_functiondef` too.

`automate/errors` — read for the event log, not for this — **confirms the stop
rule from a second page**, which is what moved it from inference to build:

> **Sequential execution:** If an effect fails, subsequent effects in the sequence do not execute. A successful fallback handles the failure but does not allow the sequence to continue.

— `automate/errors.md`

`automations.execution` defaults to **parallel**, because the page makes that the
fallback whenever sequential is not configurable; `orderable` joins the effect
kinds registry for the three the page names; a trigger enforces the two-effect
rule on both the automation and its effects, since deleting one can invalidate a
mode that was legal when set; and the runner's effect loop gained a label and one
`EXIT` **after** the fallback block, because a successful fallback "does not
allow the sequence to continue".

**Proved by contrast, in one transaction:** the same two effects with the same
failing first one, run under each mode. Parallel runs both and fails one;
sequential records exactly one run. Either assertion alone would pass against a
runner stuck in one mode.

**Three drafting errors worth keeping, because each was caught by a rule rather
than by luck:**

1. **I retyped `automation_effect_kinds()` instead of patching it.** The retyped
   version invented a `SELECT * FROM (VALUES …) AS t(…)` wrapper the body does
   not have, and changed the `function` kind's runtime from `function` to
   `action-runtime`. `run_automations` compares that runtime to `'sql'`, so it
   would not have failed loudly — the wrong value would simply have been
   published to the surface and to `gen:client`. This is the rule's named cost,
   collected.
2. **A `RETURNS TABLE` signature cannot be widened in place.** Postgres refuses;
   the function is dropped and recreated, which is safe because its callers name
   it from inside function bodies and Postgres does not track those.
3. **plpgsql evaluates every arm of a `CASE` expression.** The guard's first
   draft picked the automation id with one, and `NEW.automation_id` does not
   exist on a row of `automations`. An `IF` chain evaluates only the branch
   taken.

**Not built: partitioning.** The page's worked example is 40 objects at
partition size 20, and we have no partition, so "Sequential execution settings
apply regardless of partitioning configuration" has nothing here to apply to.

## `condition-settings` read, 2026-08-21 — and it defines what an event IS

Read for the event log. It settles the question that blocked auto-mute, in a
parenthesis about queuing:

> Queuing applies at the automation event level (individual runs in automation history). Concurrency settings (parallel vs. sequential effects) still apply within an individual event.

— `automate/condition-settings.md`

**An automation event is one firing.** Effect executions live *inside* an event —
which is why `effect-settings`' sequential/parallel setting is described as
applying "within an individual event", and why `history`'s ten types include
things with no effect execution at all.

So `automation_runs` is not the event log and cannot become it by widening: it
holds one row per **effect** per firing. The event is the firing, and the runs
hang off it. That is Decision 4 of the previous section, now anchored on a
sentence rather than on inference.

**And it unblocks the auto-mute arithmetic.** "All effects fail for at least 80%
of the past 30 events" counts firings, not effect rows. With an event table the
denominator is well-defined; without one, thirty events is not thirty rows and
any ratio computed from `automation_runs` answers a different question.

### Three of the four settings on this page are live-only, and we have no live

`Allow cycles`, `Drop objects over the live automation scale limit` and
`Skip events from peering patches to this object` each state their own
precondition — cycles: "overriding cycle detection is only available for live
monitoring"; dropped objects: "only available with live monitoring enabled";
peering: "This setting only applies to automations using live monitoring with an
object set condition. Time-based triggers and scheduled evaluations are not
affected."

Decision 4 of the sweep already refused live monitoring: evaluation here is
scheduled only, on the minute hand. **So three of these four are not gaps —
they are settings for a mode we deliberately do not have**, and building any of
them would mean building the mode first.

`Queue effect executions` is the fourth, and it is *not* live-gated. It orders
whole events against each other where `execution` orders effects within one.
Ours cannot need it yet for the reason the page gives — it exists to stop
concurrent events conflicting, and our runner takes
`pg_try_advisory_xact_lock('beacon-run-automations')` and processes candidates
one at a time in a single transaction. Queuing is what we already are.

### Cycle detection is a fourth thing, and also live-gated

> A framework has been implemented to automatically detect and disable live automations that cause cycles.

— `automate/errors.md`

`live` is in that sentence. A scheduled automation firing on the minute hand
cannot loop within a tick, and detecting a cross-tick cycle is a different
problem the page does not describe. Not built, and now for a stated reason
rather than an absence of one.

## Decisions for the event log

1. **`automation_events` is a new table, one row per firing**, anchored on
   `condition-settings`' parenthesis. `automation_runs` gains an `event_id` and
   keeps its meaning — the effect half of an event.
2. **The event types we can produce are the ones our engine causes.** Of
   `history`'s ten, this engine can currently cause `Automation triggered`,
   `Evaluation failed`, `Paused`, `Resumed`, `Muted`, `Unmuted` and
   `Condition edited`. Recording a type nothing writes would repeat the
   `skipped` situation in reverse — a value with no producer — so the CHECK
   admits only what a writer exists for.
3. **`Subscribed` and `Unsubscribed` are NOT added.** There is no subscription
   here at all: `history` treats subscription as gating whose history is
   recorded, and nothing in the schema models a subscriber. Adding two tokens
   for a feature we do not have is the half-built version CLAUDE.md forbids.
4. **`Automation recovered` is NOT added.** The page ties it to threshold
   conditions — "Only threshold conditions on object sets generate this event" —
   and our condition grammar has no threshold.
5. **Auto-mute follows in a separate change, not this one.** The denominator
   becomes well-defined the moment events exist, but the rule also needs "all
   effects fail", which is a per-event roll-up of the runs. One mechanism at a
   time, and the event log has to be producing rows before a rule can count
   them.
6. **Three of `condition-settings`' four settings are not built and now say
   why** — they configure live monitoring, which Decision 4 of the sweep
   refused. The fourth, queuing, is what our single-transaction runner already
   does.

## Questions for the event log

1. ~~Does an event exist when the condition does not fire?~~ **ANSWERED — and
   it was answered in three places, one of which this reading already quoted
   without extracting the consequence. See § An event is recorded on the
   transition, below.**
2. **What is retention in practice?** `history` says six months, then permanent
   deletion. Nothing here expires anything, and a cron that deletes history is
   its own decision.
3. **Is `Condition edited` an event on the automation or on the editor?**
   `history` says "Recorded when any user updates the automation condition",
   which is a metadata change with no firing — so it has no runs, and the
   event table must allow that.

## An event is recorded on the TRANSITION, not on every evaluation

I recorded this as an open question and guessed at the cheaper answer. It is
documented, in three places, and the first is the opening sentence of a page
this reading already quotes:

> Automation history tracks **events related to condition evaluation and automation metadata changes** for individual automations.

— `automate/history.md`

Events *related to* condition evaluation — not one per evaluation. The two
condition pages then say what relates them, twice:

> The **Threshold crossed** condition triggers when all defined checks return `true`. Effects are triggered and activity is recorded whenever the threshold is crossed in either direction.

— `automate/condition-objects.md`

> The function is called during evaluation, and events are recorded when the status changes.

— `automate/condition-objects.md`

**Called during evaluation; recorded when the status changes.** That is the
distinction stated outright. And the event table in `history` is consistent with
it throughout — every row is a transition or a metadata change:

| event | what causes it |
|---|---|
| `Automation triggered` | the condition **is met**, or a threshold goes false → true |
| `Automation recovered` | a threshold goes true → false |
| `Evaluation failed` | the evaluation **fails** |
| `Condition edited`, `Paused`, `Resumed`, `Muted`, `Unmuted` | a metadata change |

**So an evaluation that succeeds and matches nothing records nothing**, and a
failed one records `Evaluation failed`. The scheduled digest example depends on
exactly that asymmetry — "Send a weekly list of new `Support Ticket` objects
created in the previous week, **but only if tickets exist**"
(`evaluation-frequency`).

**The lesson is not the answer, it is where the answer was.** `condition-objects`
is 203 lines and this reading had never opened it, while the sentence in
`history` sat inside a block already quoted here. A question filed as open
because the pages *I* had read did not settle it is not an open question; it is
an unread page. `automation-dependencies` (52 lines, also never opened) turned
out to carry a fourth related statement — with the "Always trigger effects when
automation completes" setting toggled **off**, "Nothing happens. Effects execute
only when objects match the condition."

### What this changes for the event log

Nothing in the design, and that is worth saying plainly: recording only
transitions was the guess, and it is what the pages describe. What changes is
its status — it is now cited rather than inferred, and Decision 1 below no
longer rests on a cost argument about 1,440 rows a day.

**One thing it adds.** `history` says condition-based history "is saved at the
user level. You can only see whether an automation triggered for you, not for
other users (even if you created the automation)." Ours has no per-user history
and no subscribers, so an event here is one row for everyone who can see the
automation — a divergence to record now rather than discover later, and the same
absence that already refuses `Subscribed`/`Unsubscribed`.

## `effect-actions` read, 2026-08-21 — and it finds a gap in what shipped this morning

Read as the first of the three pages the authoring wizard needs. It turned up
something upstream of the wizard, on a tab #738 built one section of.

**Images parsed:** `effect-actions-submittable-by-automate.png`.

> Not all actions are appropriate to use with Automate. You can disable an action from being usable in Automate once you configure the action type in Ontology Manager.

— `automate/effect-actions.md`

and the image shows where. **It draws the action type's whole left rail** —
`Overview`, `Rules`, `Form`, `Capabilities`, `Security & Submission Criteria`
(selected), `Automations` — and the tab holds **three** cards:

1. `Submission criteria`, showing `Match All conditions below` over a
   `Current User is …` condition and `Add a condition or a logical operator`.
   That is what #738 built, and the image confirms it independently of the
   picker screenshots it was built from.
2. `Frontend consumers` — one labelled switch,
   `Allow Foundry Automate to submit this action`.
3. `Notification failure settings` — two radio options about what happens when
   notified users cannot see the edited object.

**So the tab I built one section of has two more**, and this is the third source
to name it `Security & Submission Criteria`: the course, this page's prose, and
now the image.

### Frontend consumers is a set, and we have one member

`object-monitors/actions` describes the same card with a second switch —
"Allow An Object Monitor To Submit This Action" — so the section is a set of
consumers, not a boolean. We have exactly one consumer and no object monitors,
so 612 uses a column named for the consumer it gates: a second one is a second
column and an obvious rename, where a join table with one possible row would be
the generic-table mistake in miniature.

### Built — 612

`action_types.automate_can_submit`, DEFAULT true because the prose is about
*disabling* and the image's toggle is on. Enforced at **both ends**, because
they fail differently: a trigger refuses an effect that names a refused action,
so the wizard cannot build something that will never run; and the runner refuses
it again, because the toggle can be turned off **after** the effect exists — the
case the authoring guard cannot reach.

Four cases probed by doing them: allowed by default, refused at authoring once
off, refused at run time when turned off later, and running again when turned
back on. The last is what stops the refusal being blanket.

### Not built, and named

`Notification failure settings` is the third card, and it configures what
happens when notified users cannot see an edited object. We have no notification
effect — `automation_effect_kinds()` marks it `executable = false` — so the card
would configure a path nothing walks.

Two more from this page, recorded rather than built: the per-effect **retry
policy** vocabulary is richer than ours (`constant backoff`, `exponential
backoff`, and *jitter* as either a factor or a duration), where 521 built a
single interval; and an action effect's **execution mode** groups objects
(`once for all`, `once for each batch`, `once for each group`), which needs the
per-object execution we do not have.

**And one sentence that reads on 611**: "the execution sequence is not
guaranteed when multiple actions are configured; actions may be executed in any
order" — that is *within* one action effect, and does not contradict
`effect-settings`' ordering *between* effects. Two different orderings, one page
apart.

## `condition-time` and `effect-function` read, 2026-08-21 — two of the three the wizard needs

**Pages read in full:** `automate/condition-time`, `automate/effect-function`.
**Images parsed (2 of 3):** `condition-time-ui-configuration.png` and
`condition-time-cron-configuration.png` — see below. `condition-time-add-condition.png`
is the wizard's picker and belongs to the slice that builds it. `effect-function`
has no images.

### Automate's cron is stricter than a pipeline schedule's, and both pages say so

> A minimum frequency of once per hour

> The minutes field must be a number between 0 and 59, with no special characters

— `automate/condition-time.md`

Those are one rule seen twice: a single minute value can match at most once an
hour, so enforcing the minute field *is* enforcing the floor.

**And `building-pipelines/triggers-reference` documents the opposite**, with its
own table of legal minute values — `*` is "Every minute", `25/10` is "Every
tenth minute beginning from 25", and `10,20-30` is a list. Same syntax, two
products, opposite rules.

**That is the trap, because `cron_field_matches` is shared.** Tightening the
matcher would refuse pipeline schedules that Foundry documents as legal. The
rule belongs on `automation_condition_valid()` — Automate's own validator, which
already backs a CHECK — and that is the scoping 573 set when it added multiple
crons and left `schedules.trigger` alone.

**Where ours already agreed**, checked field by field rather than assumed: five
fields exactly (refused by name otherwise), `*` `-` `/` `,` supported, and `W`
refused. `L` and `#` are refused too, as `Builds:CronTokenNotBuilt` — the page
lists them as supported, so that is a recorded gap rather than agreement, and it
sits in the shared matcher where both products want them.

### Built — 613

`automate_cron_valid(text)`: five fields and a minute that is a plain 0–59.
`automation_condition_valid` calls it for both spellings, `cron` and each
element of `crons`.

Four things probed, and the fourth is the one that matters: the minute specials
are refused one form at a time; the page's own examples still pass, including
the specials it allows in every other field (`15 8,20 * * *`, `15 8,14 * * 1-5`);
the CHECK bites on a real INSERT; and **`*/5 * * * *` is still a legal schedule
trigger and still matches in `cron_matches`** — so a failure would say the
Automate rule had leaked into pipelines.

**A consequence for every probe after this one:** `* * * * *` is no longer a
valid Automate condition. A probe that needs a firing uses `0 * * * *` and
passes `date_trunc('hour', now())` to `run_automations`, which takes the instant
as an argument for exactly this reason.

### `effect-function`: beta, and it names machinery we already have

The page is explicit that the feature is beta. Two things in it bear on what is
here.

**A function effect pins a VERSION, and ours names only a function.**

> Then, specify the function version. For stable versions (versions 1.0.0 and greater), you can toggle on **Auto upgrade to compatible versions** which will automatically upgrade non-prerelease versions up to the next major version.

— `automate/effect-function.md`

That is `auto_upgrade` and the caret range, word for word — the machinery
`action_type_rules` already carries and `actionRuleVersion` already resolves.
**`automation_effects` has `function_id` and no version at all**, so an effect
cannot pin one and cannot auto-upgrade. 517 gave the action rule a
`function_version_id` and the automation effect nothing, and no page justifies
the asymmetry. A recorded gap that would reuse an engine rather than add one.

**Ontology edits do not come back through a function effect:**

> functions with ontology edit return types cannot apply these edits as part of a function effect; to apply the edit, you will need to use a function-backed action.

— `automate/effect-function.md`

Ours reaches the same outcome by a different road: `run_automations` refuses any
effect whose runtime is not `sql`, so a `function` effect never executes on the
heartbeat at all. The page's rule is narrower than our refusal, and when the
action runtime does pick these up it is the rule that will matter.

**Asynchronous execution is the reason the runtime split exists.** Function
effects "execute asynchronously… the automation submits the function for
execution and then polls for the result", and "Functions can run up to 4 hours".
Nothing in a SQL heartbeat can hold that, which is what
`automation_effect_kinds()` has been saying in its note since it was written.

## Decisions

1. **The cron rule goes on Automate's validator, never on the shared matcher.**
   The pipeline page documents as legal exactly what the Automate page forbids,
   so a change to `cron_field_matches` would be a regression dressed as
   fidelity.
2. **`L` and `#` stay refused, in the shared matcher.** Both products' pages
   list them as supported, so this is one gap for both rather than an
   Automate-specific rule, and it belongs wherever the parsing lives.
3. **Non-overlap is still not enforced**, for the reason 573 gave: firing is
   once per tick on any match, so an overlap is a non-event here.
4. **The function-effect version gap is recorded, not built.** It reuses
   existing machinery, which makes it cheap, but a function effect cannot run
   at all until the action runtime picks these up — so a version to pin would
   pin nothing today.

## Questions

1. ~~Does the wizard's UI mode write a cron, or its own shape?~~ **ANSWERED by
   the two images: one condition, two editing modes.** The advanced toggle
   disables the builder rather than replacing it, so there is no second stored
   shape. See the section below.
2. **Is `auto_upgrade` on a function EFFECT the same flag as on an action
   RULE?** Both pages describe the same behaviour in the same words; whether
   Foundry models them as one setting is not answerable from either page.

### The two condition-step images, parsed — and Question 1 is answered

`condition-time-ui-configuration.png` and `condition-time-cron-configuration.png`
are the same card in its two states, which is itself the answer.

**Both share a header**: a clock tile, `Time`, the subtitle *Triggers when a
specific time is reached. E.g., "Every Monday at 9am."*, and a `Time ▾` picker
top-right — the condition **type** selector, so the card is one step of the
wizard with the type chosen inside it.

**The body is `Define schedule` / *Define how frequently effects should be
executed*, then a grey pill, then the builder, then a divider, then one
toggle:** `Use Cron expression (advanced)`.

| control | UI state | cron state |
|---|---|---|
| the pill | `At 09:00 AM` | `Every hour, between 08:00 AM and 12:00 PM, only on Monday, Tuesday, Wednesday, Thursday, and Friday` |
| `Frequency` | `Daily ▾` | **greyed, still showing `Daily`** |
| `Every [1] day` | a number spinner | **greyed, still showing 1** |
| `Set time` + `At 9:00 AM [tz]` | on | **greyed, still showing 9:00 AM** |
| `Use Cron expression (advanced)` | off | **on** |
| `Cron expression` | — | `0 8-12 * * 1,2,3,4,5` + its own timezone dropdown |
| preview panel | — | the same sentence as the pill |

**Answering Question 1: it is ONE condition with two editing modes.** The
advanced toggle **disables** the builder rather than replacing it — the fields
stay on screen holding their old values. So there is no second stored shape to
model: the builder writes a cron, and the cron is the condition.

**Three things the images add that no prose here states:**

1. **The natural-language string is a RENDERING, shown three times** — in the
   pill at the top of the card, in the preview panel under the expression, and
   in the `Condition` column of the Automations table. `At 09:00 AM` in
   `getting-started-automations-table-filtered.png` was that rendering, not a
   raw cron. #745 read it as Foundry parsing an expression and declined to
   half-build a parser; that diagnosis is now confirmed and the decision stands.
2. **The timezone sits with the condition, in both modes.** It is beside the
   time in the builder and beside the expression in advanced mode, never
   duplicated. 573 kept the zone on the condition and left Question 1b open;
   this is as close to an answer as a single-cron capture can give.
3. **`0 8-12 * * 1,2,3,4,5` independently confirms 613.** A plain-number minute,
   a range in the hour field, a list in day-of-week — exactly what the rule
   permits and forbids, in a capture I had not opened when I wrote it.

**One thing the builder can express that a cron cannot**, recorded rather than
resolved: `Every [N] day` is a spinner, and "every 2 days" has no cron spelling
— day-of-month `*/2` restarts each month. Either the spinner is capped at 1 for
`Daily`, or the builder can produce something the expression cannot. No page
says, and the capture shows `1`.

## Built — the authoring wizard, and `getting-started-add-condition.png` parsed

**Images parsed:** `getting-started-add-condition.png` — the third of
`condition-time`'s trio, and the wizard's own picker.

It draws the whole shape: `← Create new automation`, a rail of four steps —
**Condition** (selected), **Effect**, **Settings**, **Summary** — a pane headed
`Add condition` with *No condition configured yet. Select a condition to define
when this automation should trigger.*, a stack of condition cards, and `Next`
bottom-right. The app header carries `Main ▾`, a branch picker.

### Eight conditions, and we run four

| card | exposes | ours |
|---|---|---|
| Time | — | **yes** |
| Objects added to set | `(x) Added objects` | **yes** |
| Objects removed from set | `(x) Removed objects` | **yes** |
| Objects modified in a set | `(x) Modified objects` | no — live monitoring only |
| Run on all objects | `(x) Objects from set` | **yes** |
| Metric changed | — | no — sunset upstream |
| Threshold crossed | — | no — needs a threshold and a metric |
| Automation dependency | — | no — nothing can depend on another automation |

All eight are offered; the four we cannot run carry their reason, which is the
shape `action_rule_kinds()` set. Hiding them would make the vocabulary look
smaller than the page that enumerates it.

**The image extends the prose on one point.** `effect-actions` lists three
conditions that expose effect inputs — added, removed, modified — and the
picker shows a fourth chip, `(x) Objects from set` on **Run on all objects**.
Recorded as a discrepancy rather than resolved: both are lists, mirrored the
same day, and we have no effect inputs at all, so nothing here turns on it.

### What the wizard does, and what it leans on

The time step is the two screenshots' two states: the builder writes a cron, and
`Use Cron expression (advanced)` **greys the builder rather than replacing it**.
613's rule is mirrored in the wizard so a bad minute is refused before the
database sees it — with the database still deciding.

Every guard from this session's earlier slices shows up: the action picker
offers only action types where `automate_can_submit` (612), the effect step
names the kinds `automation_effect_kinds()` marks not executable, and sequential
is set **after** the effects are inserted, because its guard counts them and
would refuse an automation that has none yet.

### Not built, and named

- **Effect inputs.** The `(x)` chips are drawn on the cards because the picker
  draws them, and nothing consumes one: an object-set condition passes no
  objects to its effects here.
- **Function effects in the wizard.** The kind exists and refuses at run time
  on this runtime, so offering it would author something that cannot run.
- **The branch picker** (`Main ▾`). Automations are not branch-scoped here;
  `branching-automations` is unread.

## Questions

1. **Does `Run on all objects` really expose an effect input?** The picker says
   yes and `effect-actions` lists three without it. Unanswerable from either,
   and moot until effect inputs exist.
2. **What does `Settings` hold in Foundry's wizard?** Ours carries execution
   mode, scope and expiry because those are what the schema has. The step is
   named in the rail and never shown open in any capture read here.

## `effect-fallback` read, 2026-08-21 — a page whose engine shipped without it

**Page read in full.** Its images (`effect-fallback-configuration.png`,
`effect-fallback-error-info.png`) are **not parsed**: they are the wizard's
per-effect configuration panel, which is a slice this does not build.

`fallback_for` has been in the schema since 517 and `run_automations` has
executed fallbacks since 521. The page had never been opened.

### Two confirmations, from a page neither was built from

> Fallback effects are not eligible for event retries. A fallback effect runs only after an object fails with a non-retryable error or reaches the maximum number of retries.

— `automate/effect-fallback.md`

which is `run_automations`' `held` branch exactly, and

> A successful fallback execution does not resume the sequential execution chain. If an effect fails and triggers a fallback, subsequent effects in the sequence will not execute, even if the fallback succeeds.

— `automate/effect-fallback.md`

which is why 611 put its `EXIT` **after** the fallback block. 611 was built from
`effect-settings`; this is the second page saying it, and independent agreement
is the useful kind of confirmation.

### One rule we did not have — 616

> Fallback effects can only be configured for sequential execution and are not available for parallel execution.

— `automate/effect-fallback.md`

Ours allowed a fallback on any automation, and **parallel is the default** — so
the configuration Foundry forbids is the one you get without asking. 616 guards
it in **both directions**, because either alone leaves the illegal state
reachable: a fallback cannot be added to a parallel automation, and an
automation holding one cannot be switched back.

**A consequence neither page states:** an automation with a fallback needs two
orderable effects **plus** the fallback. That follows from 611's rule
(sequential needs two orderable) and this one (fallbacks need sequential), given
611 already excludes fallbacks from that count. Arithmetic, not invention.

### Not built, and named

- **Per-object fallbacks.** "fallback effects are triggered on a per-object
  basis, so if a subset of objects to the parent action fail, only that subset
  will be included" — we have no per-object execution.
- **The error information a fallback can read** — error message, automation RID,
  and the automation **event ID**. Ours runs the fallback with its static
  parameters and passes none of it; the last of the three waits on the event log.
- **Retry policies on the fallback itself**, which is the same
  constant/exponential/jitter vocabulary `effect-actions` names and 521 modelled
  as a single interval.

## `limits` read, 2026-08-21 — and it settles where the auto-pause threshold ISN'T

**Page read in full. No images.** 521 is named "the published limits and the
retry ladder", so this page informed a migration and was never cited here — the
same shape as `effect-fallback`, which is why it was read next.

### Nothing to build: our numbers are the page's numbers

| the page | ours |
|---|---|
| the row reading "Maximum input size for `Objects added` or `Objects removed` conditions with scheduled execution", limit 100,000 | `automation_input_limit` returns 100000 |
| the row for "Maximum input size for `Run on all objects` condition with scheduled execution", limit 1,000,000 | returns 1000000 for `run_on_all` |
| the limit produces an **error**, not a smaller answer | `object_set_keys` raises `Automate:InputTooLarge` |

Exact, including the strictness. Recorded as a confirmation because an
uncited page that turns out to agree is worth as much as one that does not —
it means 521 read it and only the citation was missing.

### The auto-pause threshold is absent from the page that would carry it

The reading's Decision 3 said not to invent an auto-pause, and I corrected its
*reason* earlier today: `muting-pausing-expiration` gives auto-**mute** an exact
threshold — 80% of the past 30 events — and gives auto-**pause** none.

`limits` has a section headed **Automatic pausing due to excessive activity**,
and it still states no threshold:

> The system may automatically pause an automation when it detects excessive activity. While paused, scheduled and live triggers do not run, but manual runs and event retries remain available.

— `automate/limits.md`

That is the page most likely to publish the number, and it does not. **The
absence is now checked on the right page rather than inferred from the pages I
happened to have read** — which is the distinction the event-question crawl
taught, applied deliberately this time.

It also restates the pause semantics `muting-pausing-expiration` gives, and adds
that resuming takes an `Editor` role on the automation — the same per-automation
role our project-level `editors write automations` policy approximates, already
recorded as an open question.

### Limits for machinery we do not have

- **Max batch size 1,000** — no batching here.
- **Max recipients per automation 10,000** — no notification effect.
- **45 minutes in the execution queue, 4 hours maximum run** — our runner is one
  SQL transaction on the minute hand, so there is no queue to wait in and no
  long-running event to terminate. The 4 hours is the same bound
  `effect-function` puts on an asynchronous function, which is the machinery
  that would need it.
- **10,000 objects per evaluation for real-time and for per-object execution** —
  both need modes we refused: live monitoring and per-object execution.

## `branching-automations` read, 2026-08-21 — the picker has TEN cards, not eight

**Page read in full.** Its eleven images are **not parsed**: they are the
branching integration — add-to-branch banners, the approvals panel, the review
and rebase dialogs — and none of it is built here. Named rather than left
silent: `branching-add-automation-to-branch.png`,
`branching-remove-automation-from-branch.png`,
`branching-supported-and-unsupported-conditions.png`,
`branching-protect-from-automation-main-page.png`,
`branching-protected-main-branch-selector.png`,
`branching-save-to-new-branch.png`, `branching-approvals-overview.png`,
`branching-approval-banner.png`, `branching-review-automation-changes.png`,
`branching-approved-automation.png`, `branching-rebase-automation-changes.png`.

### The condition vocabulary is ten, and #752 shipped eight

`getting-started-add-condition.png` shows eight cards and is **cut off** — the
last one, `Automation dependency`, is half out of frame. This page enumerates
the whole picker, as five supported on a branch plus five not:

| supported on a branch | not supported on a branch |
|---|---|
| Time | Threshold crossed |
| Objects added to set | Automation dependency |
| Objects removed from set | **Time series** |
| Objects modified in a set | **Stream** \[Beta] |
| Run on all objects | Metric changed \[Sunset] |

**Time series and Stream are new to us.** The wizard now lists ten, with both
marked: `time_series_properties` is an orphan of the deleted product — zero
rows, no surface, and no datasource kind backs a series — and a stream has no
backing kind at all, since `object_type_datasources_one_backing` admits a
dataset, a restricted view or a media set.

**The rule that decides it is the one CLAUDE.md already carries:** the page that
LISTS the set beats the capture that was cropped. #752's claim of "all eight the
image shows" was true about the image and wrong about the vocabulary.

### The effect vocabulary is four, and ours matches exactly

> All Automate effects are supported on a branch:

— `automate/branching-automations.md`

followed by Action, Logic, Function \[Beta] and Notification. That is
`automation_effect_kinds()` exactly, including which two are Beta or absent
here. This is the page that lists the effect set, and we already agree with it.

### The branch integration, which is a phase we have not started

Automations can be added to a branch, removed from one, protected so that edits
to `main` must go through review, reviewed side by side, and rebased. We have
Global Branching (461–471) and automations do not participate in any of it.

One sharp edge worth carrying if that is ever built:

> Modifying the `name` and `description` of an automation on a branch also modifies those values on `main`.

— `automate/branching-automations.md`

and one that reads on our own overlay work: "A branched automation evaluates its
conditions and executes its effects on the branch", which is a branch-scoped
runner rather than a branch-scoped definition.

### And it confirms the show-disabled pattern

> When you build an automation on a branch, unsupported conditions are disabled in the condition selector.

— `automate/branching-automations.md`

Foundry disables rather than hides, on a different axis from ours — branch
support rather than engine support — but the same treatment. The choice
`action_rule_kinds()` set and #745, #752 followed is Foundry's own.

## Questions

1. **Is `Time series` the same feature as `time_series_properties`?** That table
   registers a series against an object type; this is a condition that triggers
   when one crosses a threshold. Related, plainly, and no page read here joins
   them.
2. **Does the ten include everything?** This page's two lists are exhaustive for
   *branch support*, which is not quite the same claim as exhaustive for the
   picker. No capture read here shows the picker scrolled to its end.

## `effect-logic` and `effect-notification` read, 2026-08-21 — the last two with engines behind them

Both are kinds in `automation_effect_kinds()` marked `executable = false`, so
they are vocabulary we have committed to from pages nobody had read — the
`effect-fallback` shape. **Nothing is built from either**; both describe
products we do not have. What they give is one resolution and one
strengthening.

**Images: none parsed.** Every one belongs to a configuration surface for an
effect that cannot run here — `effect-logic-add-new.png`,
`effect-logic-output-returns-ontology-object.png`,
`effect-notifications-effect-configuration-ui.png`,
`effect-notifications-effect-object-backed-recipients.png`,
`condition-objects-execution-mode-batched.png`,
`condition-objects-execution-mode-grouped.png`,
`condition-objects-execution-mode-per-object.png`,
`template-notifications-example.png`,
`effect-notifications-function-backed-base.png`,
`effect-notifications-function-backed-complex.png`,
`effect-notifications-attachment-notepad-template.png`.

### The effect-input discrepancy resolves toward three

#752 recorded that `effect-actions` lists **three** conditions exposing effect
inputs while the picker image shows a fourth chip on `Run on all objects`.
`effect-notification` is a **third page**, and it lists three:

> Conditions that expose affected objects are:

— `automate/effect-notification.md`, over a list of exactly three: Objects added
to set, Objects removed from set, Objects modified in set.

Two prose pages agree on three; one capture shows a fourth. And the chip's
wording differs — the three are `Added objects` / `Removed objects` /
`Modified objects`, a **delta**, while the fourth reads `Objects from set`,
which is the whole input. Plausibly a different thing rather than a fourth
member. **Recorded as leaning to three, not settled**, and moot until effect
inputs exist.

### The version-pinning gap now has two pages behind it

`effect-function` said a function effect pins a version and may auto-upgrade.
`effect-logic` says the same of a Logic effect, in the same words, and adds a
constraint:

> Note that auto upgrade is not supported with Project scope mode.

— `automate/effect-logic.md`

So the gap recorded from `effect-function` — `automation_effects` has
`function_id` and **no version at all**, where `action_type_rules` pins one and
can auto-upgrade — holds for two of the four effect kinds, and whoever closes it
inherits a rule about `scope` that we already model.

### Confirmed: `logic` is right to be executable = false

> The Logic effect can only call AIP Logic functions that return a list of Ontology edits as their output.

— `automate/effect-logic.md`

`automation_effect_kinds()`' own note — that AIP Logic is a product we do not
have — remains exactly true. The page also shows Foundry disabling rather than
hiding again — staged-write Logic functions "appear as disabled in the function
selector".

### Recorded, and each needs machinery we refused

- **Object grouping** for notifications — once for all, once per group of
  properties, once per object — the same three modes `effect-actions` gives
  action effects, needing per-object execution.
- **Logic parallelisation**, defaulting to groups of 20.
- **Notification recipients** carry their own permission model: at least
  `Viewer` on the automation, plus `Viewer` on the triggering object instances,
  plus on every property when the type is multi-datasource. Worth keeping with
  the notification effect rather than discovering later.
- **Attachments** from Notepad documents, templates and Contour dashboards.
- A sharp edge if manual execution is ever built: "Manual executions of the
  automation bypass the trigger conditions. As a result, permissions on the
  trigger objects are not checked during manual runs."

## The last three pages, 2026-08-21 — the section is now read

`streaming`, `performance-best-practices` and `troubleshooting-performance`,
all in full. That closes the header's list of eighteen unopened pages: **every
page under `automate/` has now been read and cited.**

**Images: none parsed.** `stream-condition.png`, `stream-evaluation-frequency.png`
and `raw-streams.png` all configure a stream, and there is no stream datasource
kind here. The two performance pages carry none.

### A gap the performance page exposes without meaning to

Lever 1 of its three is the whole point of the page:

> **Frequently updating objects (100+ updates per day):** For object types that update frequently, combine a time-based evaluation with your object set condition. This caps the number of automation evaluations at the frequency of the time condition.

— `automate/performance-best-practices.md`

and its worked example turns 100,000 evaluations a day into 288 by attaching a
five-minute cadence.

**CORRECTED 2026-08-21, and the correction is the whole point.** This paragraph
said the five minutes was not the Time condition card but *scheduled monitoring*
of an object set condition. That is wrong, and I only found it by going back to
build from it. The page says "combine a time-based evaluation with your object
set condition" and then "Adding a time condition of 5 minutes", against a
scenario whose condition is "on object update" — Objects modified in set, which
is **live monitoring only**. So Lever 1 is a TIME CONDITION paired with a
live-monitored object condition; it is out of reach here by Decision 4, and its
five minutes contradicts `condition-time`'s own "A minimum frequency of once per
hour" regardless.

**There are two mechanisms and I had merged them into one.** The other is the
real finding, and it is on `evaluation-frequency`:

> "A schedule allows you to check an object set condition at a specific point in
> time or on a regular cadence."

> "Scheduled monitoring evaluates the condition on a user-defined schedule."

— `automate/evaluation-frequency.md`

**Ours had no such thing.** `automation_condition_valid` accepted
`objects_added`, `objects_removed` and `run_on_all` with an `object_set_id` and
nothing else, so every object set condition was evaluated on the minute hand,
every minute, with no way to cap it.

**Built, 617 and 618.** The schedule is an optional `{cron, timezone}` on the
object set condition, taking Automate's cron grammar rather than the pipeline
one, and absent means daily. The load-bearing part is not the grammar: the
cadence gates the whole EVALUATION, because `automation_fires` compares the set
against a snapshot that `run_automations` used to rewrite on every tick. Gate
only the firing and a daily automation fires once a day having seen one minute
of additions, absorbing the rest silently.

618 exists because 617's own assertion for that could not have caught it — it
tested `condition_state IS NULL` on a column that is `NOT NULL DEFAULT '{}'`,
and prod has no object sets so it never ran either. The real contrast is on the
`members` key, and it now lives in the platform suite as well.

### Two vocabularies confirmed, one from an odd angle

`streaming` says "select a stream condition", which is the tenth card #756 added
from `branching-automations` — a third page agreeing that Stream is a condition
in its own right rather than a mode of another.

It also states the constraint that explains the branch list: "Stream-backed
object types only support the **Objects modified in set** condition type for
live monitoring."

### What the troubleshooting page is, and why it changes nothing here

It is a runbook for a platform with Autopilot, Workflow Lineage and Resource
Management, none of which exist here. Its four spike patterns need machinery we
refused — chained automations, per-object execution, function loops — and its
mitigation steps are pause, re-scope, resume.

One line is worth keeping anyway, because it is the same discipline today's
linter investigation arrived at the hard way: the diagnostic process opens with
**check the execution history**, then **identify condition frequency**, then
trace, then review. Measure the observed behaviour first and read the
configuration second. Four wrong hypotheses here went the other way round.

## The seven I had not opened, and the claim I made anyway

I wrote, in this file, that every page under `automate/` had now been read and
cited — and then checked it. Seven pages were not mentioned anywhere in this file: `_index`,
`automation-administrators`, `execution-settings`, `marketplace-automate`, and
the three worked examples. `pnpm check:readings` passed on all 1610 quotations
while that sentence sat at the bottom of the file, because a page-coverage claim
is not something it counts. This is rule 7's failure for the third time, and the
first where I caught it myself rather than an audit catching it.

They are 250 lines together. Reading them was cheaper than weakening the claim,
and three of them carry findings.

### `automation-administrators` names what auto-pause is FOR

Decision 3 of the sweep refused to invent auto-mute because no page named a
trigger for it. A page does:

> "Auto-pausing an automation because of cycles or limits"

— `automate/automation-administrators.md`

So the two causes are enumerated, and we stand differently against each. **Cycle
detection is live-monitoring machinery** — `condition-settings` says overriding
it "is only available for live monitoring" — and we refused live monitoring, so
that half is out of reach by a decision already taken. **Limits we already
hit**: `object_set_keys` raises `Automate:InputTooLarge` today. Foundry pauses
the automation at that point; we raise and leave it armed to raise again next
minute.

That is a real gap with a named cause, and it is the first thing on this list
that could be built without inventing a trigger. Not built here — it changes
runner behaviour, and it belongs with the event log that would record it.

The page also splits the notifications in two, which is the shape of a setting
we do not have: **automation information notifications** (expiration,
auto-pause, evaluation errors) and **effect failure notifications** (an action
failing to execute, a notification failing to send). Its warning is the kind of
detail that only appears on a page nobody reads: "changing **Effect failure
notifications** to `Only administrators` will prevent failure notifications from
being sent to anyone except administrators."

**Image: `settings-automation-administrators.png` not parsed.**

### The cadence, confirmed by a worked example and given a default

`performance-best-practices` gave the lever; the example gives the number:

> "Since we are using a relative time filter, the condition will be evaluated
> using scheduled monitoring. We keep the default of daily evaluation."

— `automate/example-relative-time-condition.md`

Two things the concept page did not say. A **relative time filter forces**
scheduled monitoring — the cause, not just the option — and the schedule has a
**default of daily**. And the weekly-report example attaches one to a plain
condition with no such filter:

> "Since we only want to send the report once a week, we add a schedule to the
> condition and specify that the automation should trigger every Monday morning
> at 8am."

— `automate/example-weekly-report.md`

Four pages now describe the same field. It stays recorded rather than built for
the reason given above, but it is no longer an inference about how Foundry
probably works: it has a default, a forcing condition, and two worked examples.

**Images: two of the three examples' eleven parsed, and they carried the shape
the prose could not.** `example-weekly-report-object-and-time-condition.png` and
`example-relative-time-condition.png` both show `Define schedule` as a second
card below the condition — "Define how frequently the object set condition
should be evaluated" — with **Frequency**, an **Every N** interval, an optional
**Set time**, a timezone, and a `Use Cron expression (advanced)` toggle. That is
our TimeStep component exactly, which is why 617's surface half reused it rather
than building a second one. There is no automations endpoint under `api/`, so
without these two the shape would have been invented.

They also confirm a causal claim the prose only asserts: `Use live monitoring`
is **greyed out** on the relative-time example, whose filter forces scheduled
monitoring, and **live** on the weekly-report example, whose condition does not.
And the relative-time capture shows the daily default with **Set time toggled
off** — so a daily schedule with no time is a real state, and no page says what
hour it then runs. Midnight is 617's inference, marked as such there.

**The other nine are still unparsed.** Named so the debt is recorded and not
silently dropped: `example-relative-time-effect.png`,
`example-relative-time-overview.png`,
`example-weekly-report-effect-select.png`,
`example-weekly-report-notification-recipients.png`,
`example-weekly-report-notification-content.png`,
`example-weekly-report-notification-notepad-template.png`,
`example-weekly-report-notification-attachment.png`,
`example-weekly-report-notification-overview.png`, and the five
`example-dynamic-contract-owners-*.png`.

### A permission rule, stated once, in an example

> "Note that all recipients require at least **Viewer** permission on the
> automation or they will not receive the notification."

— `automate/example-dynamic-contract-owner.md`

A notification effect does not bypass the automation's own access. We have no
notification effect, so nothing to fix — but it is the kind of rule that would
have been invented the other way round, and it is on an example page rather than
on `effect-notification`.

### `_index` and `marketplace-automate`

The index states the product's scope in one sentence — "Automate is a fully
backwards-compatible product that replaces Object Monitoring as the single entry
point for all business automation in the platform" — and enumerates the four
effects, which is the set `automation_effect_kinds()` already carries.

`marketplace-automate` is packaging, and touches the `auto_upgrade` thread one
more time: automations with an action or AIP Logic effect "cannot be installed
in "production" mode as automations with these effects do not automatically
upgrade". Version pinning has now been named by three pages and built by none.

`execution-settings` is an eight-line stub pointing at two pages this reading
already covers.

## The section, closed

**Thirty-seven pages under `automate/`, and now all thirty-seven read** — thirty
before this section, seven in it, counted rather than asserted. What it produced,
in order: 609–610 (mute and expiry), 611 (sequential execution), 612 (Frontend consumers),
613 (the cron rule), 616 (fallbacks require sequential), #745 (the screen),
#752/#756 (the wizard and its ten cards) — and a standing list of things
recorded rather than built, each with the page that names it.

**Every one of those migrations came from a page read for something else.**


## The event log, BUILT — 622 and 623

The operator read #748's Decisions block, which is the gate, and approved it.
What shipped:

**`automation_events`, one row per firing**, with `automation_runs.event_id`
pointing back at it — "Select an event to view the full execution timeline,
including condition evaluation details, effect execution status, timestamps,
and any errors". Seven of the ten types, each with a writer in the same
migration: `automation_triggered` and `evaluation_failed` from the runner, and
`paused`/`resumed`/`muted`/`unmuted`/`condition_edited` from an AFTER UPDATE
trigger, because `history` records them for "any user" who makes the change and
there is more than one path to a paused automation.

The three omitted are omitted for producer-shaped reasons, not for effort:
`Automation recovered` needs a threshold condition (one of the six cards we do
not offer), and `Subscribed`/`Unsubscribed` need a subscriber, which this schema
does not model at all. The probe enumerates rather than samples — it makes all
seven happen through their real paths and fails naming any token that has no
writer.

**The visibility rule now has one statement.** `can_read_automation_history()`
holds the scope predicate and both the runs policy and the events policy call
it, instead of the same EXISTS being written twice.

### The defect the probe found, which is the real yield

Writing the failure half of the probe — an object set the owner cannot read —
took down the whole `run_automations` pass. The handler around
`automation_fires` was there; the **membership snapshot at the bottom of the
loop calls `object_set_keys` again, unwrapped**, so the same unreadable set
raised a second time outside any handler. One broken automation ended the pass
for every other one, and nothing recorded why.

622 wraps it and records `evaluation_failed` when the snapshot fails on its own.
`history` is explicit that a failure is a recorded event — "Recorded when an
automation fails to evaluate for any reason" — and being fatal to forty-nine
other automations is not one of the readings of that sentence.

### 623, because 622 left two holes that existing guards found

`record_automation_run` was dropped and recreated, and came back **reachable by
`authenticated`**: Supabase's `ALTER DEFAULT PRIVILEGES` grants EXECUTE on new
functions to that role explicitly, so 622's `REVOKE ALL … FROM PUBLIC` did not
touch it. `scheduledPathRls.test.ts` caught it. `record_automation_event` had
the identical hole and **nothing failed**, because it was not on that guard's
list — the more dangerous of the two. It is on the list now.

`catalog.test.ts` caught the second: a new table with no COMMENT saying what it
holds.

### What this unblocks, and what it does not

- **Auto-mute** is now countable: "all effects fail for at least 80% of the past
  30 events" has a denominator. Not built — it also needs a per-event verdict.
- **Manual execution** still needs the queue rather than the log; the log is the
  prerequisite, not the mechanism.
- **Retention** is untouched. "retained for six months, then permanently
  deleted" is a cron that deletes history, which is its own decision.


## Auto-mute, BUILT — 624

The event log's first dividend, and the reason it was worth building first.

> "When the **Auto-mute this automation** setting is enabled, the automation will automatically mute when all effects fail for at least 80% of the past 30 events."

— `automate/muting-pausing-expiration.md`

A metric, a window and a threshold, and it was uncountable until an *event* was
a thing: `automation_runs` holds one row per effect per firing, so thirty runs
is not thirty events and any ratio over them answers a different question.

**The screenshot carries the placement**, and the heading it shows appears in no
prose on any page: the toggle sits under **"Configure global effect settings"**
(`automate/images/auto-mute.png`), so it is an effect setting rather than a
condition one — which is where the wizard puts it, beside sequential execution.
The same capture words the rule a second way and that is where "on this
automation" comes from.

**Three inferences, each marked in 624 rather than smuggled**: the default is
off; a full window of thirty is required before anything mutes; and only events
that produced runs are in the window. The second is the one that could be wrong,
and it is chosen in the direction that mutes LESS, because muting is the
disruptive outcome.

The automatic mute is recorded by 622's `AFTER UPDATE` trigger rather than by a
second write path, so it appears in the event log by exactly the route a
person's mute takes.

### A defect 622 shipped, found by writing the probe

`automation_events.occurred_at` defaulted to `now()`, which is the
**transaction's** start time and frozen for its duration. The runner processes
up to fifty automations in one transaction, so every event of a pass carried the
identical timestamp and "the past 30 events" ordered by it was an arbitrary
thirty. 624 moves it to `clock_timestamp()`. This is 496's lesson a second time,
and it only surfaced because the probe needed thirty ordered events in one
transaction.

**Auto-PAUSE is still not built and still for the right reason.** Its trigger is
"excessive activity" with no threshold, metric or window anywhere — the contrast
with this page is what makes the difference visible.
