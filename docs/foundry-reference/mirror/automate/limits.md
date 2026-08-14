<!-- source: https://palantir.com/docs/foundry/automate/limits/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Limits

The Automate application implements several limits to improve performance for execution and triggering effects. These limits and the expected behavior are listed in the table below.

## Automation scale limits

| Description                                                                                                    | Limit     | Behavior when limit is reached                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Maximum input size for `Objects added` or `Objects removed` conditions with scheduled execution     | 100,000   | Error message when saving the automation OR runtime error when evaluating the automation if the input set grows beyond the limit |
| Maximum input size for `Run on all objects` condition with scheduled execution     | 1,000,000   | Error message when saving the automation OR runtime error when evaluating the automation if the input set grows beyond the limit |
| Max number of recipients per automation                                                                        | 10,000    | Error when saving or evaluating the automation                                                                                   |
| Max number of objects per automation evaluation for real-time execution                                        | 10,000    | First 10,000 object events are processed, or error is thrown                                                                     |
| Max number of objects per automation evaluation for scheduled automations when per-object execution is enabled | 10,000     | Runtime error during evaluation before any effects are executed; no objects are processed                                        |
| Max size of object set for manual execution                                                                    | 5,000,000 | Error message when executing the automation                                                                                      |
| Max batch size of automation                                                                                   | 1,000     | Runtime error                                                                                                                    |

## Automation runtime limits

| Description                                   | Limit   | Behavior when limit is reached                                                                                             |
| --------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Max time an automation event can wait in queue effect execution | Configurable | The event is terminated and none of the effects execute                                                                    |
| Max time an automation event can wait in execution queue | 45 mins | The event is terminated and none of the effects execute                                                                    |
| Max time an automation event can run           | 4 hours | The event is terminated; effects that completed before the timeout are preserved, but remaining effects do not execute     |

Automation events may wait in a queue for several reasons:

* **Queue effect executions setting:** When [Queue effect executions](/docs/foundry/automate/condition-settings/#queue-effect-executions) is enabled, events execute sequentially and must wait for previous events to complete before starting.
* **Internal parallelism limits:** Even when the **Queue effect executions** setting is not toggled on, there is an internal limit on how many events can execute in parallel. When many events are triggered in quick succession, they enter the queue in trigger order and begin executing in trigger order, but may not complete in trigger order depending on each event's runtime.
