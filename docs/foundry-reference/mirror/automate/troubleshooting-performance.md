<!-- source: https://palantir.com/docs/foundry/automate/troubleshooting-performance/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Troubleshooting automation performance

This guide helps you identify the root cause of unexpected performance issues and provides solutions. This page covers common performance spike patterns, a systematic diagnostic process, and immediate mitigation steps to reduce resource consumption.

:::callout{theme="info"}
For proactive guidance on designing efficient automations, see [Performance best practices](/docs/foundry/automate/performance-best-practices/).
:::

## Common performance spike patterns

Below are common patterns to help identify and diagnose performance issues with automations.

### Pattern 1: Active automation on frequently updating objects

**Symptoms:** The automation ran many times in a short period, generating unexpected resource consumption. For example, an automation with a large number of object updates can generate many automation runs, each potentially triggering downstream effects.

**Root cause:** An object type updates very frequently, and the automation is configured with an "on object update" condition without a time-based cap. Often this happens when an automation that was previously paused gets unpaused.

**How to fix:**

1. Immediately pause the automation to stop further executions.
2. Add a time-based condition with an appropriate interval to cap execution frequency.
3. Verify that **Single execution** mode is enabled.
4. Resume the automation and monitor execution counts closely for the next day.

### Pattern 2: Chained automations snowball

**Symptoms:** Multiple automations are running in sequence, with execution counts growing exponentially.

**Root cause:** Automations form a chain where each automation edits objects, triggering the next automation in the sequence:

* `Automation A` edits objects
* These edits trigger `Automation B`, which processes each object separately
* `Automation B` edits more objects, triggering `Automation C`
* The multiplicative effect can turn initial updates into exponentially more executions

**How to fix:**

1. Pause all downstream automations in the chain.
2. Evaluate whether you can consolidate the logic into fewer automations.
3. Ensure that any remaining automations use bulk processing (ObjectSet inputs and **Single execution** mode).
4. Re-enable automations one at a time, monitoring execution counts after each.

### Pattern 3: Inefficient function operations

**Symptoms:** Function execution time is high, and resource consumption scales poorly with object count.

**Root cause:** Functions contain loops that query the Ontology once per iteration instead of processing objects in bulk.

**How to fix:**

1. Review the function code for loops with Ontology queries inside.
2. Refactor to load all required objects upfront or use backend aggregations.
3. Change action inputs to accept ObjectSets instead of individual objects when possible.

For comprehensive function optimization guidance, see [Optimize function performance](/docs/foundry/functions/optimize-performance/).

### Pattern 4: Function self-calling loop

**Symptoms:** A single function is being called many times, often recursively.

**Root cause:** A function edits objects, and those edits trigger the same automation that calls the function, creating a loop. Without guards in place, this can continue until manually stopped.

**How to fix:**

1. Add a status flag or timestamp to objects to prevent re-processing.
2. Add conditional logic to check whether processing is needed before making edits.
3. Consider whether the logic should be moved outside of Automate entirely.

## Diagnostic process

To investigate a performance spike, follow these steps:

1. **Check automation execution history:** Open the automation and review the execution history. Key questions to consider:
   * How many times did it run in the last day?
   * When did the spike in executions begin?
   * Is the frequency increasing over time?

2. **Identify condition frequency:** Examine the condition configuration and object update patterns. Key questions to consider:
   * How often are objects being updated that meet the conditions?
   * Is a time-based condition configured? If so, what is the interval?
   * Are updates happening more frequently than expected?

3. **Trace automation chains:** Use [Autopilot](/docs/foundry/autopilot/overview/) or [Workflow Lineage](/docs/foundry/workflow-lineage/overview/) to understand dependencies. Key questions to consider:
   * Which automations trigger other automations?
   * What is the full chain of effects?
   * Are there potential snowball effects where one execution multiplies?

4. **Review function implementation:** Examine the functions being called by the automations. Key topics to investigate:
   * Do functions contain loops with Ontology queries?
   * Are bulk processing patterns being used correctly?
   * Check function execution times and external call counts.

5. **Look for recursive conditions:** Determine if automations are triggering themselves. Key questions to consider:
   * Does the function edit objects that cause the same automation's conditions to be met again?
   * Are there status flags or guards to prevent recursive processing?
   * Does the execution history show rapid repeated calls?

## Immediate mitigation steps

When a performance or resource consumption spike is found, take these actions in priority order:

1. **Stop the bleeding**
   * Immediately pause the automation that is causing the spike. This prevents further resource consumption during investigation.

2. **Assess impact**
   * Check Resource Management to understand the total resource impact.
   * Identify any downstream automations that may also need to be paused.
   * Determine how far back the issue extends.

3. **Apply quick fix**
   * Add a time-based condition if one is missing.
   * Change execution mode to **Single execution** if it is set to multiple.
   * Add conditional logic to the function to skip unnecessary processing.

4. **Monitor recovery**
   * Resume the automation with reduced frequency or limited scope.
   * Watch execution counts closely for the next day.
   * Verify that resource consumption returns to expected levels.

## Tools and resources

Below are several resources for diagnostic information.

### For execution history and cost breakdowns

* **[Automate execution history](/docs/foundry/automate/history/):** Shows run counts, timing, and success or failure status
* **[Function logs](/docs/foundry/aip-observability/service-logs-and-debugging/):** Contains error messages and execution timing details
* **[Ontology Manager](/docs/foundry/ontology-manager/overview/):** Shows query costs, though this is less useful for immediate troubleshooting
* **[Resource Management](/docs/foundry/resource-management/overview/):** Provides overall cost breakdown by service and resource type

### Automation workflow overview

* **[Autopilot](/docs/foundry/autopilot/overview/):** Control center for managing and monitoring automation workflows at scale
* **[Workflow Lineage](/docs/foundry/workflow-lineage/overview/):** Visualizes automation dependencies and chains
