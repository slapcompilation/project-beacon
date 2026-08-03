<!-- source: https://palantir.com/docs/foundry/app-building/analytics-operations/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Connecting analytics to operations

Although Foundry's focus is upon enabling [operational workflows](/docs/foundry/app-building/operational-apps/) that capture data back into the system, the results of work done using Foundry's [analytical capabilities](/docs/foundry/analytics/overview/) is also a key part of the puzzle. This page covers how analytical tools can be used to deliver value to end users in a cohesive way that empowers decision-making.

## Dashboards

Often, the results of open-ended exploration of data in the Ontology can result in interesting insights that could be useful for other people in your organization. Starting with a set of objects, drilling down into a subset, and exploring properties using charts or linked objects may yield a repeatable workflow that can be combined with other platform capabilities in a valuable way.

[Quiver](/docs/foundry/quiver/overview/) is the application used for open-ended analysis on object data in Foundry. Quiver dashboards enable you to create parameterized, curated views that end users can use to explore data in a structured fashion. Once you've published a dashboard, you can use it in operational applications in a few different ways:

* Quiver dashboards can be [embedded into Workshop applications](/docs/foundry/quiver/dashboards-workshop/), allowing you to flexibly show dashboards to users as part of a structured workflow.
* Quiver dashboards can be embedded into [Carbon](/docs/foundry/quiver/dashboards-carbon/) so that users can access the template as a tab in their workspace.

Using this functionality, exploratory analysis can quickly transition from an ad-hoc dashboard or insight to being a core part of an operational workflow.

## Models

Foundry's [machine learning](/docs/foundry/model-integration/overview/) capabilities provide a full suite of tools for model development, integration, evaluation, and deployment. Once models have been validated according to organizational criteria, they can be deployed to end users easily.

Workshop's support for [Scenarios](/docs/foundry/workshop/scenarios-overview/) enables the deployment of machine learning directly to end users without requiring any custom development or extensive configuration. Users interact with concepts they are familiar with, while seeing model-backed results in an easy-to-understand form such as a *forecast* or *estimate*.

For more details on tying machine learning to organizational outcomes, refer to [Models in the Ontology](/docs/foundry/ontology/models/).
