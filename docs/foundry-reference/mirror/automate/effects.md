<!-- source: https://palantir.com/docs/foundry/automate/effects/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Effects

Effects define what happens when an automation is triggered. When a condition is met, the automation executes one or more effects to perform actions, apply logic, execute functions, or send notifications.

## Effect types

Automate supports the following types of effects:

* **[Action effects:](/docs/foundry/automate/effect-actions/)** Execute actions on objects, such as creating, modifying, or deleting object instances.
* **[Logic effects:](/docs/foundry/automate/effect-logic/)** Execute AIP Logic functions.
* **[Function effects:](/docs/foundry/automate/effect-function/)** Execute a function when the automation condition is met.
* **[Notification effects:](/docs/foundry/automate/effect-notification/)** Send notifications to users or groups when the automation triggers.

## Fallback effects

Action, logic, and function effects can be configured with a [fallback effect](/docs/foundry/automate/effect-fallback/). Fallback effects execute when the primary effect fails, allowing you to handle errors gracefully by sending notifications, logging failures, or triggering alternative workflows.

With sequential execution, a successful fallback does not allow subsequent effects to continue. Learn more about [failure behavior](/docs/foundry/automate/effect-settings/#failure-behavior) in effect settings.

## Retries

Automate provides [retry functionality](/docs/foundry/automate/retries/) to handle transient errors:

* **Per-effect automatic retries:** Configure automatic retries on individual action and logic effects to handle temporary errors such as rate limits.
* **Event retries:** Configure retry strategies for entire trigger events to handle persistent errors such as service outages.

## Effect settings

Configure how effects execute with [effect settings](/docs/foundry/automate/effect-settings/), including:

* **Concurrency:** Run effects sequentially or in parallel
* **Object edits:** Control how multiple edits are handled
* **Execution guarantees:** Understand at-least-once execution semantics
