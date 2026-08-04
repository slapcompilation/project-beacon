<!-- source: https://palantir.com/docs/foundry/aip-observability/overview/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# AIP observability

AIP observability features provide visibility into your AIP and Ontology workflow executions through metrics, tracing, logs, and execution history. As part of a comprehensive observability strategy across the platform, these features are integrated into Workflow Lineage to enable cross-functional teams to monitor and optimize performance at every level of the applications, workflows, and products built with AIP and the Ontology.

![Example Workflow Lineage view trace view](/docs/resources/foundry/aip-observability/aip-observability-overview-example.png)

## Key capabilities of AIP observability

* **[Metrics](/docs/foundry/aip-observability/metrics/):** Monitor near real-time success/failure counts and P95 execution duration for functions, actions, and AIP Logic.
* **[Execution history](/docs/foundry/aip-observability/run-history/):** Track functions, actions, automations, and AIP Logic executions over the past 30 days.
* **[Distributed tracing](/docs/foundry/aip-observability/trace-view/):** Visualize the complete execution flow across functions, actions, language models, automations, and ontology loads.
* **[Logging and debugging](/docs/foundry/aip-observability/service-logs-and-debugging/):** Access service logs, custom function log messages, token usage, prompts, error details, and more.
* **[Log search](/docs/foundry/aip-observability/log-search/):** Search across all service logs for a source executor to find specific log messages, errors, or patterns across multiple executions.
* **[Performance monitoring](/docs/foundry/aip-observability/performance-monitoring-and-optimization/):** Identify bottlenecks and optimize execution times.
* **[Observability dashboards](/docs/foundry/observability/dashboards/):** Build operational dashboards in Workshop by plotting metrics for functions, actions, and compute modules over time with the Observability Chart widget.
* **[Log export to Foundry streaming dataset](/docs/foundry/administration/configure-logging/):** Have your logs exported to a streaming dataset and perform complex analysis on your telemetry.

## Getting started with AIP observability

To use AIP observability:

1. Navigate to a function, action, or automation in Workflow Lineage.
2. Select the **Run history** tab to view recent executions.
3. Choose **View log details** on any execution to access [traces](/docs/foundry/aip-observability/trace-view/) and [logs](/docs/foundry/aip-observability/service-logs-and-debugging/).
4. Ensure proper [log permissions](/docs/foundry/aip-observability/log-permissioning/) are configured for your resources.

## Observability across the platform

AIP observability integrates with the rest of the Palantir platform to provide insight into all of your Ontology and AIP workflows, even if AIP is not enabled on your enrollment. The following tools work together to provide comprehensive visibility into your systems, from individual function execution to platform-wide resource consumption.

### Monitoring performance and optimization

* **[Function instrumentation](/docs/foundry/functions/instrumentation-telemetry/):** Overview of the tools to instrument functions in production.
* **[Function monitoring](/docs/foundry/functions/monitoring/):** Set up alerts for function performance and failure rates.
* **[Action metrics](/docs/foundry/action-types/action-metrics/):** Analyze action execution patterns and performance.
* **[Action monitoring](/docs/foundry/action-types/monitoring/):** Configure monitoring rules to track action performance and reliability.
* **[Model instrumentation](/docs/foundry/integrate-models/instrumentation-telemetry/):** Overview of the tools to instrument models in production.

### Monitoring resource usage and costs

* **[AIP usage metrics](/docs/foundry/workflow-lineage/aip-usage-observability/#aip-usage-metrics):** Model usage coloring and charts for tracking token usage and model requests.
* **[Logic compute usage](/docs/foundry/logic/compute-usage/):** Track compute consumption in AIP Logic applications.
* **[AIP compute usage](/docs/foundry/aip/aip-compute-usage/):** Understand compute allocation and usage across AIP features.

### Monitoring model performance

* **[AIP Evals](/docs/foundry/aip-evals/getting-started/):** Evaluate and monitor LLM performance systematically.
