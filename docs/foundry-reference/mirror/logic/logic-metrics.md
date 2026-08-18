<!-- source: https://palantir.com/docs/foundry/logic/logic-metrics/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# AIP Logic metrics

AIP Logic resources are backed by functions, and when an AIP Logic resource executes, metrics are surfaced for the underlying function execution, including success and failure counts and the P95 execution duration over the last 30 days.

You can view these metrics in [Ontology Manager](/docs/foundry/ontology-manager/overview/) or in [Workflow Lineage](/docs/foundry/workflow-lineage/overview/). In Workflow Lineage, select the AIP Logic node for a given execution. This provides visibility into:

* **Success/failure metrics:** Monitor the current status of your AIP Logic executions with success and failure counts for the underlying function.

![AIP Logic execution metrics displayed in Workflow Lineage.](./images/logic-metric-in-wfl-executions.png)

* **P95 duration metric:** Track the 95th percentile (P95) execution duration, helping you detect performance bottlenecks and optimize workflows.

![AIP Logic P95 duration metric displayed in Workflow Lineage.](./images/logic-metric-in-wfl-p95.png)

You can also access [run history](/docs/foundry/aip-observability/run-history/), which provides a complete view of executions over the past seven days. Learn more about [AIP observability](/docs/foundry/aip-observability/overview/).

All metrics are updated in near-real-time using the latest data from the Foundry Telemetry Service (FTS). This ensures you have access to the most current information for monitoring, debugging, and maintaining the health of your AIP Logic resources.

Failure types for AIP Logic executions follow the same categories as [function failure types](/docs/foundry/functions/function-metrics/#function-failure-types). Refer to the [function metrics](/docs/foundry/functions/function-metrics/) documentation for a full list of failure categories.

## Permissions

To view AIP Logic metrics, you must be a `viewer` on the AIP Logic resource.
