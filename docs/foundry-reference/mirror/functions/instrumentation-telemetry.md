<!-- source: https://palantir.com/docs/foundry/functions/instrumentation-telemetry/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Instrumentation and telemetry in functions

It is possible to emit certain types of telemetry from your functions to allow for monitoring and debugging of production workflows.

To learn how to view telemetry emitted by your functions, see our [Ontology and AIP observability documentation](/docs/foundry/aip-observability/overview/).

## Supported telemetry types

The following table provides an overview of the types of telemetry supported by each function language. Note that a single span over the total execution duration of the function, along with a single request log, is automatically created for all function types.

| Language      | Logs | Spans                         | Metrics                         |
| ------------- | ---- | ----------------------------- | ------------------------------- |
| TypeScript v1 | Yes  | Only product-defined spans\[1] | Only product-defined metrics\[2] |
| TypeScript v2 | Yes  | Yes\[3]                        | Only product-defined metrics\[2] |
| Python        | Yes  | Yes\[3]                        | Only product-defined metrics\[2] |

\[1] Product-defined spans in TypeScript v1 functions include operations like object loads and query executions.

\[2] Foundry records the total execution duration for all types of functions.

\[3] TypeScript v2 and Python functions automatically instrument all outbound network requests, but custom spans can also be added.

### Logs

You can emit custom logs from functions and view them retroactively. The following examples demonstrate how to emit logs from TypeScript v1, TypeScript v2, and Python functions.

In TypeScript v2 functions, Foundry will set up the OpenTelemetry SDK's global logger provider, and you will be able to retrieve a logger from it. If you want to use third-party libraries for logging, you must configure them to emit logs through a logger obtained from the global logger provider.

```typescript tab="TypeScript v1"
export class MyFunctions {
    @Function()
    public myFunction(name: string): string {
        console.log(`This is a custom log line, ${name}.`);
        return `Hello, ${name}!`;
    }
}
```

```typescript tab="TypeScript v2"
import { logs } from "@opentelemetry/api-logs";

const logger = logs.getLogger("my-function");

export default function myFunction(name: string): string {
    logger.emit({
        body: "This is a custom log line.",
        attributes: {
            name
        },
    });

    // You can also use the global console object
    console.log(`This is a custom log line, ${name}.`);

    return `Hello, ${name}!`;
}
```

```python tab="Python"
import logging

from functions.api import function

logger = logging.getLogger(__name__)

@function
def my_function(name: str) -> str:
    logger.info("This is a custom log line.")
    return f"Hello, {name}!"
```

#### Logging best practices

Use the following logging practices:

* **Choose appropriate log levels:** Use `INFO` for normal operations, `WARN` for recoverable issues, `ERROR` for failures, and `DEBUG` for detailed diagnostics.
* **Include relevant context:** Add identifiers, counts, and operation details to help understand execution flow.
* **Avoid logging sensitive data:** Do not log credentials, full API responses that may contain sensitive information, or other security-sensitive content.

For detailed guidance on writing effective logs, viewing service logs, and filtering by log level, see [Service logs and debugging](/docs/foundry/aip-observability/service-logs-and-debugging/).

### Spans

You can also create custom spans in TypeScript v2 and Python functions to track the duration of specific operations. The following example demonstrates how to create a custom span.

In TypeScript v2 and Python functions, Foundry will set up the OpenTelemetry SDK's global tracer provider, and you will be able to retrieve a tracer from it. If you want to use third-party libraries for tracing, you must configure them to emit traces through a tracer obtained from the global tracer provider.

```typescript tab="TypeScript v2"
import { trace } from "@opentelemetry/api";
import { Integer } from "@osdk/functions";

const tracer = trace.getTracer("my-function");

export default function sqrt(n: Integer): Integer {
    const sqrt = tracer.startActiveSpan("my-custom-span", (span) => {
        try {
            return Math.sqrt(n);
        } finally {
            span.end();
        }
    });

    return sqrt;
}
```

```python tab="Python"
import math

from functions.api import function

from opentelemetry import trace

tracer = trace.get_tracer(__name__)

@function
def sqrt(n: int) -> int:
    with tracer.start_as_current_span("my-custom-span"):
        return math.sqrt(n)
```
