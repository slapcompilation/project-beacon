<!-- source: https://palantir.com/docs/foundry/data-connection/webhooks-overview/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Webhooks

You can use Data Connection to configure **webhooks** to connect Foundry to systems and workflows outside of Foundry.

:::callout{theme="neutral"}
This section contains information on *outbound* webhooks (Foundry making requests to another system). If you need to receive *inbound* webhooks (another system sending requests to Foundry), consider using [listeners](/docs/foundry/data-connection/listeners-overview/) instead.
:::

Each webhook provides a way to make a request to an external system outside of Foundry. For example, you could create a webhook that performs an HTTP request to an external server when a user selects a button in a Foundry application, connecting that application to existing workflows and source systems.

Each webhook is associated with a single [source](/docs/foundry/data-connection/core-concepts/#sources) in Data Connection. The source stores the credentials necessary for connecting to the external system. Depending on the type of source the webhook is associated with, certain task types are available for use. For example, when using [REST](/docs/foundry/available-connectors/rest-apis/), you can flexibly configure an HTTP call that should be made to an external service.

Webhooks can be configured flexibly to accept specific inputs and capture outputs from external system requests. Additionally, you can set time, concurrency, and rate limits on webhook executions. For detailed configuration options, see the [webhooks reference](/docs/foundry/data-connection/webhooks-reference/).

Review the following documentation to learn more about webhooks:

* [Set up a webhook](/docs/foundry/data-connection/webhooks-setup/).
* Review the [webhooks reference](/docs/foundry/data-connection/webhooks-reference/) to learn more about configuration, limits, and permissions.
* Review the [actions documentation](/docs/foundry/action-types/webhooks/) to learn about how webhooks can be configured for end-user applications.
* [Call webhooks from external functions](/docs/foundry/data-connection/external-functions/) for writing custom code to interact with external systems.
* [Publish a webhook as a function](/docs/foundry/data-connection/webhooks-reference/#webhook-functions) so it can be used in Workshop, Ontology SDK (OSDK), functions, and actions.
