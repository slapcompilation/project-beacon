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

`history` names **eleven** event types — `Automation triggered`,
`Automation recovered`, `Condition edited`, `Subscribed`, `Unsubscribed`,
`Evaluation failed`, `Paused`, `Resumed`, `Muted`, `Unmuted` — and
`automation_runs` records none of them. It records an outcome per effect per
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
   eleven event types are about subscription, and nothing in the schema
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
   half of an event; the eleven event types are not built. The tab names what
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
