<!-- source: https://palantir.com/docs/foundry/automate/performance-best-practices/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Performance best practices

This page describes best practices for optimizing performance and resource usage when configuring automations. Following these guidelines helps minimize compute consumption and ensures your automations run efficiently at scale.

:::callout{theme="info"}
For general information about resource consumption in Foundry, see the [resource management documentation](/docs/foundry/resource-management/usage-types/).
:::

## Overview

Automate can become a source of high resource consumption if the configuration does not follow best practices. The general principle is to **perform operations in bulk whenever possible**.

### Before creating an automation

Before setting up an automation, evaluate whether an Automate is actually needed:

* **Use Automate when** you need automated responses to data changes or scheduled processing that runs without manual intervention.
* **You do not need Automate** if you are manually changing object properties to hardcoded or computed values. In this case, create an [Action type](/docs/foundry/action-types/overview/) and invoke it directly from Workshop or Object Explorer on your target object set. This is more efficient and gives you direct control over when the action runs.

### Understanding Automate's cost levers

There are three levers to consider when optimizing automation performance:

1. **Condition configuration:** What causes an automation to evaluate.
2. **Execution mode:** How condition events generate effect executions.
3. **Effect design:** What the action or function does when executed.

:::callout{theme="info"}
Each lever build on the previous one. Execution modes and effects (Levers 2 and 3) can only be bulk if the automation condition (Lever 1) is configured for bulk operations.
For example, if you condition on each individual object update, you will only have one object as input, forcing you to process objects one at a time.
:::

## Condition configuration (Lever 1)

The condition configuration determines how frequently your automation evaluates and processes objects.

* **Frequently updating objects (100+ updates per day):** For object types that update frequently, combine a time-based evaluation with your object set condition. This caps the number of automation evaluations at the frequency of the time condition.
* **For infrequently updating objects:** An object-update condition alone is sufficient.

Learn more about configuring conditions in the [object set conditions documentation](/docs/foundry/automate/condition-objects/), [time condition documentation](/docs/foundry/automate/condition-time/), and about evaluation frequency options in the [evaluation frequency documentation](/docs/foundry/automate/evaluation-frequency/).

### Example scenario

Consider an object type with 1,000 objects, where each object updates 100 times per day. Using only an "on object update" condition could result in up to 100,000 automation evaluations per day (100 updates × 1,000 objects, assuming updates do not occur simultaneously).

Adding a time condition of 5 minutes caps the maximum evaluations at 288 per day (1,440 minutes ÷ 5)—a reduction of up to 340×.

## Execution mode (Lever 2)

Execution mode determines whether your automation processes all triggered objects together or creates separate executions for individual objects or batches. Learn more about [execution settings](/docs/foundry/automate/execution-settings/).
When configuring your automation's execution mode, prefer **Single execution** (the default) over per-object execution when your use case allows it.

* **Single execution:** The automation's effect runs once for all objects that match the condition, passing the full set of objects to the effect. This configuration processes all triggered objects in one automation run. This is usually more efficient than processing all objects individually.
* **Per-object execution:** The automation's effect runs separately for each object or batch. Use this when you have specific batching requirements that your business logic demands, such as needing to isolate failures or process objects with different configurations.

Learn more about execution modes in the [object set conditions documentation](/docs/foundry/automate/condition-objects/).

**Example scenario:** An action that sends a notification per object and must include object-specific details can be implemented by a per-object-execution of an action that generate and send a notification for this object; or by calling a single-execution of one action that calls a function, which generate multiple notifications via a function. In this case, the second approach should be preferred.

## Effect design (Lever 3)

The design of your action (and any backing function) determines whether you can take advantage of bulk processing. Design your actions to accept object sets as input parameters rather than single object references. This allows passing large numbers of objects efficiently in a single operation.

Learn more about configuring action parameters in the [Action types documentation](/docs/foundry/action-types/overview/).

Summary of the input parameter types, from most to least efficient:

| Input type | Efficiency | Description |
|------------|------------|-------------|
| Object set | Best | A queryable set of objects that can be passed efficiently regardless of size. |
| Object array | Good | An array of object instances; suitable for moderate-sized batches. Configure the parameter as "Object reference" with "allow multiple values" enabled. |
| Single object | Least efficient | A single object reference; use only when business logic requires it. |

When your action is backed by a function, the function should also be designed to handle bulk inputs. For detailed guidance on writing performant functions, see [Optimize function performance](/docs/foundry/functions/optimize-performance/).

Key considerations:

* Accept object sets or arrays as input parameters.
* Perform bulk computations rather than iterating over objects individually.
* Use aggregations on the backend when possible instead of loading all objects into memory.

## Monitoring your automations

Regular monitoring helps you identify and prevent performance issues. Watch for these warning signs:

* **High execution frequency:** Automations running many times per day
* **Rapidly updating objects:** Object types that update very frequently
* **Deep automation chains:** Multiple automations triggering each other
* **Inefficient functions:** Functions with per-object Ontology queries

If you notice any of these patterns, see [Troubleshooting automation performance](/docs/foundry/automate/troubleshooting-performance/) for detailed diagnosis and solutions.

### Tools for monitoring

Use these tools to understand your automation behavior:

* **Execution History in Automate:** Available in your Automate configuration to view execution patterns
* **[Autopilot](/docs/foundry/autopilot/overview/):** Helps understand how automations chain together and their dependencies
* **[Workflow lineage](/docs/foundry/workflow-lineage/overview/):** Traces automation dependencies across the platform

You can access Autopilot and Workflow Lineage through the **Actions** menu on your automation's **Overview** page.

Learn more about automation dependencies in the [automation dependencies documentation](/docs/foundry/automate/automation-dependencies/).
