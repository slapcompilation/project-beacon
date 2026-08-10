<!-- source: https://palantir.com/docs/foundry/aip-observability/run-history/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Run history

To see the run history for a Function, Action or automation, navigate to the resource, then select the **Run history** tab. This provides a complete view of all executions over the past 30 days.

![The Run history tab displays a table of recent executions.](/docs/resources/foundry/aip-observability/workflow-lineage-run-history.png)

## Run history data

The **Run history** table includes:

* **Timestamp:** When each execution finished.
* **Status:** Success (✓) or failure (✗).
* **Runtime:** Total execution time.
* **Caller:** The resource that triggered the execution; this can be a Workshop application, Agent, Third-party application, Automation, Action, or other system component.
* **Source executor:** The top level executable resource type (limited to Function, Action, or Automation) in the call chain.

The run history displays executions from the past 30 days, sorted by timestamp.

## Limitations

* **UDFs in Pipeline Builder:** Execution history is not available for user-defined functions (UDFs) run from a sidecar container, such as in [Python](/docs/foundry/functions/python-functions-builder/) or [Java](/docs/foundry/transforms-java/user-defined-functions/) UDFs.

## Filter run history

You can filter the results by:

* **Status:** View successful or failed executions.
* **Timestamp range:** View executions within a specified date range.
* **User:** View executions triggered by a specific user.
* **Run time range:** View executions within a specified duration range.
* **Version:** View executions for a specified version (only applicable for functions).
* **Caller:** View executions originating from a specified resource.
* **Failure type:** View executions that failed for a specific reason. Learn more about [function](/docs/foundry/functions/function-metrics/#function-failure-types) and [action](/docs/foundry/action-types/action-metrics/#action-failure-types) failure types.

If more than one filter is specified, the results will be filtered to include only those that match all specified filters.

## Inspect a specific execution

To inspect a specific execution, select the **View log details** option to access the full trace and debugging information.

![View log details for a specific execution in the Run history table.](/docs/resources/foundry/aip-observability/workflow-lineage-view-log-details.png)

## Next steps

* View [trace details](/docs/foundry/aip-observability/trace-view/) to understand execution flow.
* Access [service logs](/docs/foundry/aip-observability/service-logs-and-debugging/) for detailed debugging.
* Configure [log permissions](/docs/foundry/aip-observability/log-permissioning/) to enable log visibility.
