<!-- source: https://palantir.com/docs/foundry/slate/applications-writeback/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Write back data with Actions

You may want to configure your Slate application so that user work in the interactive application is "written back" to the underlying data asset in Foundry. The recommended way to perform writeback in Slate is using [Ontology Actions](/docs/foundry/action-types/overview/). To write data back directly, you can use [OSDK Actions](/docs/foundry/slate/concepts-osdk/) or [API Gateway Queries](/docs/foundry/slate/concepts-queries/#api-gateway-queries). If you prefer to use a submission form for this purpose, consider using the [Action widget](/docs/foundry/slate/widgets-platform/#action).

In addition to reading from the Ontology layer through the platform tab, Slate supports writing back to the Ontology via Actions using the [Action widget](/docs/foundry/slate/widgets-platform/#action).

Slate's writeback to the Ontology is configured through a widget, rather than through the Platform tab, to allow the developer to optionally take advantage of the automatically generated Action Form. This allows developers to avoid recreating all of the form elements from Slate widgets.

In this setup, it's common to place the Action widget within a [Dialog](/docs/foundry/slate/widgets-container/#dialog-widget) container and trigger the container to open with a [Slate Event](/docs/foundry/slate/concepts-events/) when the form should be shown.

Alternatively, the form display can be toggled off, in which case the widget configuration serves as a template to collect the values to submit based on user interactions and inputs in other widgets within the app. Submission is then triggered with an event, most often from a [Button widget](/docs/foundry/slate/widgets-control/#button).

The Action widget also provides hooks for [Slate Events](/docs/foundry/slate/concepts-events/) to broadcast the validation state of the Action as well as its successful or failed submission.

Review the documentation on [Actions](/docs/foundry/action-types/overview/) for more details of how to structure and configure Actions, and the documentation on the [Action Widget](/docs/foundry/slate/widgets-platform/#action) for details on widget configuration in Slate.
