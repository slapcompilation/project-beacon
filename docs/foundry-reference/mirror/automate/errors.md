<!-- source: https://palantir.com/docs/foundry/automate/errors/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Evaluation and effect errors

This page describes some common error categories that may be encountered when using Automate.

## Evaluation errors

An automation may fail to evaluate due to problems with the underlying data. Automations are automatically [retried](/docs/foundry/automate/retries/), but some errors may require manual intervention. For example, if the object type being monitored is deleted, automations using that type will fail to evaluate.

### Automation out of sync

Automations may use a reference to a [saved exploration](/docs/foundry/object-explorer/save-explorations/) to define the input. This reference is not dynamic, but instead is stored according to the exploration as it exists when the automation is saved. If the exploration changes, the automation will continue to evaluate using the exploration's old state unless the automation is updated. In this case, a warning banner is displayed on the automation:

![Warning banner for out of sync automation](./images/monitor-out-of-sync-banner.png)

### Snapshot expiration errors

When manually executing automations with large object sets, you may encounter snapshot expiration errors. This occurs when the object set is too large to process before the underlying data snapshot expires.

To work around snapshot expiration errors with large backlogs, use a function-backed object set to process the backlog in manageable batches:

1. Create a function that returns the oldest `N` objects that require processing.
2. Configure your automation to use a function-generated object set that calls this function.
3. Manually execute the automation repeatedly with a reasonable batch size, waiting for each execution to complete.
4. Continue manual executions until the backlog is reduced below the limit (typically less than 100,000 objects).
5. Once the backlog is manageable, your regular condition-based automation can process objects as they arrive.

Learn more about [manual execution](/docs/foundry/automate/manual-execution/) and [function-generated object sets](/docs/foundry/automate/condition-objects/#function-generated-object-sets).

### Permissions

Automation evaluation uses the permissions of the owner or recipients. This ensures that condition evaluation and any subsequent effects always reflect data that the user has access to at the time the automation is evaluated. If a user lacks permission to view object types, saved explorations, or the automation, they may see a permission-related error message instead of successful evaluation.

We strongly recommend storing automations and their related resources in shared [Projects](/docs/foundry/security/projects-and-roles/). Learn more about automation [scope and log visibility](/docs/foundry/automate/history-visibility-and-scope/).

## Effect failures and fallback effects

To handle effect failures gracefully, you can configure a [fallback effect](/docs/foundry/automate/effect-fallback/) for action, Logic, and Function effects. Fallback effects execute when the primary effect fails, allowing you to send notifications, log failures, or trigger alternative workflows.

### Failure propagation

How failures propagate depends on your [effect execution configuration](/docs/foundry/automate/effect-settings/#failure-behavior):

* **Sequential execution:** If an effect fails, subsequent effects in the sequence do not execute. A successful fallback handles the failure but does not allow the sequence to continue. This behavior applies per object: successful objects continue through subsequent effects, while failed objects stop at the fallback.
* **Parallel execution:** Effects execute independently. One effect's failure does not affect other effects.

### Action effect errors

After a successful condition evaluation, action effects may fail to execute. This failure could happen for a variety of reasons, including the following:

* Changes to the action logic make it incompatible with the saved input configuration on the automation.
* The [submission criteria](/docs/foundry/action-types/submission-criteria/) for the action are not met.
* The function backing the action has a runtime execution failure.

If an action effect fails, the history timeline will indicate that one or more actions failed to execute for that event, along with relevant error details.

Note that when per-object execution is enabled, the object identifier surfaced in the error details as the cause of the error represents the object associated with the first request that caused the failure; there may be more hidden failures that are not propagated.

### Cycle detection

Consider a set of automations defined as follows:

* **Automation A:** Monitors an object set of all red cars. When a new red car is added to the ontology, an action triggers to change the car color to blue.
* **Automation B:** Monitors an object set of all blue cars. When a new blue car is added to the ontology, an action triggers to change the car color to red.

Such a sequence of automations would cause an infinite loop, or **cycle**. A framework has been implemented to automatically detect and disable live automations that cause cycles.

For certain automations, cycle detection may be undesirable. Select **Allow cycles** in the [condition settings](/docs/foundry/automate/condition-settings/#cycles) to allow up to 50 cycles. This option is only available when [live monitoring](/docs/foundry/automate/evaluation-frequency/#live-monitoring) is enabled.

![The Allow cycles setting in Automate.](./images/allow-cycles.png)

### Notification effect errors

After a successful condition evaluation, notifications may fail to send. If this occurs, the history event will show a tag indicating that notifications were not sent to subscribers. Additional details will include an error identifier, the error message, and the object or objects that triggered the failure.
