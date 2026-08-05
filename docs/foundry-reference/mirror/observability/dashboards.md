<!-- source: https://palantir.com/docs/foundry/observability/dashboards/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Observability dashboards

Observability dashboards let you compose Foundry telemetry into custom, reusable views built from [Workshop](/docs/foundry/workshop/overview/) widgets. Rather than inspecting each resource one at a time, you can assemble the signals that matter for a workflow onto a single page and lay them out to match how your team operates.

Today, observability dashboards are built with the [Observability Chart](/docs/foundry/workshop/widgets-observability-chart/) widget, which plots a resource's metrics over time. Additional observability widgets are in development.

## How observability dashboards differ from AIP observability

[AIP observability](/docs/foundry/aip-observability/overview/) provides built-in metrics, distributed tracing, execution history, and logs, embedded throughout the platform in applications such as [Workflow Lineage](/docs/foundry/workflow-lineage/overview/), [Ontology Manager](/docs/foundry/ontology-manager/overview/), and more. These capabilities are available out of the box and require no configuration.

Observability dashboards draw on the same underlying signals, but you build them yourself in Workshop: choose the resources and metrics that matter and arrange them on a page as desired.

## Build a dashboard

The [Observability Chart](/docs/foundry/workshop/widgets-observability-chart/) widget plots the metrics of a single resource—such as execution counts, P95 duration, CPU, and memory—over a time range. Because it is a standard Workshop widget, you can:

1. Add several Observability Chart widgets to a single Workshop module, each charting a different action, function, or compute module.
2. Bind their start and end times to shared [timestamp variables](/docs/foundry/workshop/concepts-variables/), so selecting a range on one chart re-scopes every widget bound to the same variables.
3. Arrange them alongside other widgets using Workshop's layout tools to reflect the structure of your workflow.

The result is a custom observability dashboard that lets operators assess the health of every charted resource in a workflow from a single page. See the [Observability Chart widget](/docs/foundry/workshop/widgets-observability-chart/) page for configuration details.
