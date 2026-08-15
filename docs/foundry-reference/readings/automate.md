---
verify: strict
---

# Automate — conditions and effects over the Ontology

Pages read: `automate/overview`, `condition-time`, `condition-objects`,
`condition-settings`, `effects`, `effect-actions`, `effect-function`,
`effect-notification`, `effect-fallback`, `effect-settings`,
`evaluation-frequency`, `limits`, `retries`, `muting-pausing-expiration`,
`permissions`, `security`, `manual-execution`, `history`, plus the three
worked examples.

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
> eliminate them due to the distributed nature of the system and the retry
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

> "**Action and Logic effects:** Execute as the automation owner"

> "**Notification effects:** Use each recipient's individual permissions"

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
