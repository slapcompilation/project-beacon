<!-- source: https://palantir.com/docs/foundry/integrate-models/instrumentation-telemetry/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Instrumentation and telemetry in models

It is possible to emit certain types of telemetry from your models to allow for monitoring and debugging of inference workflows in production.

The capabilities described on this page apply to core machine learning models. For language models, see the [language model adapters](/docs/foundry/integrate-models/language-models-adapters/) reference.

To learn how to view telemetry emitted by your models, see our [AIP observability documentation](/docs/foundry/aip-observability/overview/).

## Supported telemetry types

Models support custom logs and custom spans. Metrics are not user-defined; Foundry records the total execution duration for all inference calls to a model.

A single span over the total execution duration of an inference call, along with a single request log, is automatically created for every model invocation.

## Environment dependencies

The OpenTelemetry libraries must be added explicitly to your model's environment. Add the following packages:

* `opentelemetry-api` and `opentelemetry-sdk`: Required to emit custom logs and custom spans.
* `opentelemetry-instrumentation`: Required to automatically instrument outbound network requests made from your model.

### Logs

You can emit custom logs from your model and view them retroactively. The following example demonstrates how to emit logs from a model using the standard Python `logging` module.

Foundry will set up the global logger provider for the OpenTelemetry SDK, so logs written through Python's `logging` module are routed to Foundry automatically. If you want to use third-party libraries for logging, you must configure them to emit logs through a logger obtained from the global logger provider.

```python
import logging

import palantir_models as pm

logger = logging.getLogger(__name__)

class ExampleModelAdapter(pm.ModelAdapter):
    ...

    def predict(self, df_in):
        logger.info("Running inference on %d rows.", len(df_in))
        return self.model.predict(df_in)
```

### Spans

You can also create custom spans in your model to track the duration of specific operations within a single inference call. The following example demonstrates how to create a custom span around a preprocessing step.

Foundry will set up the global tracer provider for the OpenTelemetry SDK, and you will be able to retrieve a tracer from it. If you want to use third-party libraries for tracing, you must configure them to emit traces through a tracer obtained from the global tracer provider.

```python
import palantir_models as pm

from opentelemetry import trace

tracer = trace.get_tracer(__name__)

class ExampleModelAdapter(pm.ModelAdapter):
    ...

    def predict(self, df_in):
        with tracer.start_as_current_span("preprocess"):
            features = self._preprocess(df_in)

        with tracer.start_as_current_span("inference"):
            return self.model.predict(features)
```
