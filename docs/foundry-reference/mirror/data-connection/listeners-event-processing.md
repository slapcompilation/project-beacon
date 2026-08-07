<!-- source: https://palantir.com/docs/foundry/data-connection/listeners-event-processing/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Event processing with HTTPS listeners

HTTPS listeners write events to a [stream](/docs/foundry/data-integration/streams/). You can locate this stream by navigating to your listener's **Overview** page in Data Connection. Once your data resides in a stream, several processing options are available.

## Stream processing with Automate

Streams can be directly processed in [Automate](/docs/foundry/automate/streaming/#automation-on-streaming-datasets), enabling you to execute an action or function for each inbound event. You can create objects in your ontology, run AIP logic, or use [sources](/docs/foundry/data-connection/set-up-source/) in functions to interact with external systems, such as writing data back to the system that sent the event.

![Option to process streams in Automate.](/docs/resources/foundry/data-connection/automate-streams.png)

Processing streaming events with Automate is appropriate when:

* The event stream is not high throughput
* Your event processing is stateless
* Latency of a few seconds is acceptable
* At-least-once processing is sufficient

This approach is suitable for most listener integrations, providing low-cost, low-maintenance event processing workflows.

You can learn more about processing listener events with Automate in the [guide to creating an AI-powered chatbot with listeners](/docs/foundry/data-connection/listeners-slack-bot/).

## Streaming pipelines

Listener event streams can be processed with [streaming pipelines](/docs/foundry/building-pipelines/streaming-overview/) as a lower-latency alternative. These pipelines support high-throughput streams, [stateful event processing](/docs/foundry/building-pipelines/streaming-stateful-transforms/), and (optionally) exactly-once event processing. Streaming pipelines can additionally [leverage UDFs](/docs/foundry/functions/python-functions-builder/) to build powerful real-time event-processing workflows.

![Build streaming pipelines in Pipeline Builder.](/docs/resources/foundry/data-connection/event-stream-pipeline.png)

## Batch pipelines

Every few minutes, the listener event stream will [archive into a backing dataset](/docs/foundry/data-integration/streams/#cold-buffer). This dataset can be used like any other dataset in the platform, allowing you to build [data pipelines](/docs/foundry/data-integration/data-pipeline/) and [back your ontology](/docs/foundry/object-link-types/create-object-type/#create-a-new-object-type).

![Switch to archive mode on your event stream to access the underlying dataset.](/docs/resources/foundry/data-connection/event-stream-archive.png)

For use cases that require historical analysis or that are not real-time, batch pipelines should be used.
