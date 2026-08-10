<!-- source: https://palantir.com/docs/foundry/data-connection/listeners-overview/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Listeners

Listeners enable the Palantir platform to receive events from other systems that do not support OAuth 2.0 authentication directly or cannot provide a configurable payload compatible with standard Foundry API endpoints.

To accept inbound connections from these systems, data connection listeners provision a URL endpoint, implement the specific message signing or other verification schemes for specific external systems, and allow a simple and low-latency mechanism to receive data feeds into Foundry.

![The event listeners homepage.](/docs/resources/foundry/data-connection/event-listeners.png)

## Types of listeners

Foundry supports three types of listeners, each designed for different integration scenarios and processing approaches:

| Listener type | Status | Connection type | Output destination |
|---|---|---|---|
| HTTPS listeners | GA | Request-response | [Streams](/docs/foundry/data-integration/streams/) |
| WebSocket listeners | Experimental | Persistent bidirectional | [Compute modules](/docs/foundry/compute-modules/overview/) |
| Email listeners | Beta | Inbound email | [Media sets](/docs/foundry/data-integration/media-sets/) |

### HTTPS listeners

HTTPS listeners receive webhook requests from external systems through HTTPS endpoints. Events are written to a [stream](/docs/foundry/data-integration/streams/), enabling processing through [Automate](/docs/foundry/automate/streaming/), [streaming pipelines](/docs/foundry/building-pipelines/streaming-overview/), or batch processing using the stream's backing dataset.

[Learn more about HTTPS listeners.](/docs/foundry/data-connection/listeners-https/)

### WebSocket listeners \[Experimental]

:::callout{theme="warning" title="Experimental"}
WebSocket listeners are an experimental capability that may not be available in your enrollment. To enable this capability, contact Palantir Support.
:::

WebSocket listeners are primarily designed for real-time audio and telephony workflows, enabling bidirectional communication between Foundry and external services such as Twilio, Genesys, and Azure Communication Services. Inbound WebSocket connections are processed directly by a [compute module](/docs/foundry/compute-modules/overview/) where you can host a custom WebSocket server.

[Learn more about WebSocket listeners.](/docs/foundry/data-connection/listeners-websocket/)

### Email listeners

:::callout{theme="neutral" title="Beta"}
Email listeners are in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development. Contact Palantir Support to request access to email listeners.
:::

Email listeners allow Foundry to receive inbound emails at dedicated email addresses for downstream processing. Each listener has a unique email address scoped to your enrollment, and applies sender allowlisting, email authentication, and attachment validation before forwarding content.

[Learn more about email listeners.](/docs/foundry/data-connection/listeners-email/)

## When to use listeners

Listeners are one of many options to ingest data into the Palantir platform. Before setting up a listener, evaluate whether your use case meets the criteria below for inbound connections or for external systems that cannot be customized.

### For inbound connections

Listeners can be used solely for inbound connections when an external system establishes the connection into Foundry. To make requests from Foundry to external systems, use [sources](/docs/foundry/data-connection/set-up-source/). No-code capabilities are also available, such as [syncs](/docs/foundry/data-connection/set-up-sync/) and [outbound webhooks](/docs/foundry/data-connection/webhooks-overview/). Custom code-based data connections are also available with [external transforms](/docs/foundry/data-connection/external-transforms/), [functions](/docs/foundry/functions/api-calls/), [compute modules](/docs/foundry/compute-modules/sources/), and more.

### When the external system cannot be customized

Listeners should only be used when the external system cannot be customized to connect to Foundry. For example, many webhook and WebSocket providers have bespoke payload shapes and cannot properly authenticate with Foundry, instead relying on other authentication and verification protocols.

For cases where you can customize the external system, such as when the system allows you to write custom integration code, use the [public API](/docs/foundry/api/v2/general/overview/authentication/) instead. With the public API, you can push to streams, upload to datasets, or directly interact with your ontology.

***

*All product names, logos, and brands mentioned are trademarks of their respective owners. All company, product, and service names used in this document are for identification purposes only.*
