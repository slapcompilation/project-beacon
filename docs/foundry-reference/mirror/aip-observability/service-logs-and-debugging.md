<!-- source: https://palantir.com/docs/foundry/aip-observability/service-logs-and-debugging/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Service logs and debugging

To access detailed logging information, navigate to the **Details** view after selecting the **View log details** option for a specific execution.

The service logs provide:

* **Chronological log entries:** All log messages generated during execution.
* **Log levels:** `INFO`, `WARN`, `ERROR`, `DEBUG`, and `TRACE` messages.
* **Custom log messages:** Any console.log() or logging statements from your functions or models.

![Example Workflow Lineage with service logs](/docs/resources/foundry/aip-observability/workflow-lineage-service-logs.png)

## Permission required

To view traces and service logs, an administrator must enable [log access](/docs/foundry/aip-observability/log-permissioning/) for the relevant project. Users always have access to logs for their own executions from the past 24 hours, except on [CBAC stacks](/docs/foundry/security/classification-based-access-controls/), where log access must be enabled to view trace and service logs.

## Filtering logs

To filter for specific log levels, use the **log levels** selector at the top of the table:

![Example Workflow Lineage with service log filter](/docs/resources/foundry/aip-observability/workflow-lineage-service-log-filter.png)

Available log levels:

* **ERROR:** Error messages and stack traces
* **WARN:** Warnings about potential issues
* **INFO:** General information about execution flow
* **DEBUG:** Detailed debugging information
* **TRACE:** Detailed trace information

To see the full details of any log entry, select the **Content** field:

![Example Workflow Lineage with service log details](/docs/resources/foundry/aip-observability/workflow-lineage-service-log-details.png)

## Writing effective logs in your functions

Effective logging helps you debug issues quickly and understand your function's behavior in production. Follow these best practices:

### Choose appropriate log levels

* **INFO:** Use for normal operation flow and key business events.
* **WARN:** Use for recoverable issues or unexpected conditions that don't prevent execution.
* **ERROR:** Use for failures that prevent normal operation.
* **DEBUG:** Use for detailed diagnostic information (avoid in production).

### Include relevant context

We recommend including identifiers and relevant data that can help you understand what has happened:

```typescript tab="TypeScript v1"
// TypeScript v1 example - Good logging practices
console.log("Processing order", orderId, "for user", userId); // Include relevant IDs
console.log("Retrieved", results.length, "items from Ontology"); // Include counts/metrics
console.warn("Retry attempt", attemptNumber, "of", maxRetries, "for operation", operationId); // Include retry context
console.error("Failed to process order", orderId, "Error:", error.message); // Include error details
```

```typescript tab="TypeScript v2"
import { logs } from "@opentelemetry/api-logs";
const logger = logs.getLogger("my-function");

// TypeScript v2 example - Good logging practices
logger.emit({
    severityText: "INFO",
    attributes: { LOG_MESSAGE: `Processing order ${orderId} for user ${userId}` }, // Include relevant IDs
    body: { orderId, userId },
});
logger.emit({
    severityText: "WARN",
    attributes: { LOG_MESSAGE: `Retry attempt ${attemptNumber} of ${maxRetries} for operation ${operationId}` }, // Include retry context
    body: { attemptNumber, maxRetries, operationId },
});
logger.emit({
    severityText: "ERROR",
    attributes: { LOG_MESSAGE: `Failed to process order ${orderId}. Error: ${error.message}` }, // Include error details
    body: { orderId, error: error.message },
});
```

### Avoid logging sensitive data

Never log sensitive information that could compromise security:

```typescript
// ❌ Don't do this
console.log("User credentials", username, password);
console.log("API response", fullApiResponse); // May contain sensitive data

// ✅ Do this instead
console.log("Authentication attempt for user", username);
console.log("API call completed with status", response.status);
```

## See also

* [Log search](/docs/foundry/aip-observability/log-search/): Search across logs from all executions for a source executor.
* [Log permissions](/docs/foundry/aip-observability/log-permissioning/): Configure who can view logs.
* [Trace view](/docs/foundry/aip-observability/trace-view/): Correlate logs with execution timeline.
