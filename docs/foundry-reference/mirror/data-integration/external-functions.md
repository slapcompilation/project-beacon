<!-- source: https://palantir.com/docs/foundry/data-integration/external-functions/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# External Functions

External Functions allow you to call [webhooks](/docs/foundry/data-connection/webhooks-overview/) from a Function and use them to interact with external systems. You can call these systems from applications built using [Workshop](/docs/foundry/workshop/overview/), [Actions](/docs/foundry/action-types/overview/), and [Functions](/docs/foundry/functions/overview/).

:::callout{theme="neutral"}
Webhooks can also be published directly as reusable Ontology functions without writing wrapper code. For more information, see [Webhook functions](/docs/foundry/data-connection/webhooks-reference/#webhook-functions).
:::

To use a webhook in a Function, you must first configure a [Data Connection source](/docs/foundry/data-connection/set-up-source/) that supports the webhooks capability. Normally this will be a [REST API source](/docs/foundry/available-connectors/rest-apis/#rest-api-source). Once you have a source with webhooks configured, you can import the source into your [Functions repository](/docs/foundry/functions/getting-started/) and create Functions that call webhooks and other logic.

You can apply external Functions for a variety of use cases, including the following:

* Use a single function to make an HTTP request to an external server and create a record, then write a matching record to the Ontology.
* Wrap a webhook call with custom pre- and post-processing logic. This is particularly useful if custom logic is required to go from Function inputs to the desired webhook request input parameters, or if post-processing on the webhook response is required before making Ontology edits.
* Chain together multiple external webhook requests and Ontology edits with intermediate processing logic. A single webhook cannot perform a dynamic number of external requests, but this can be accomplished using external Functions.
* Query an external system using a read-only request to render data ephemerally in a Workshop application.

:::callout{theme="neutral"}
External functions may not currently be used to make arbitrary API calls from TypeScript code without first defining the request as a webhook in Data Connection.
:::

## Concepts

* A [Data Connection source](/docs/foundry/data-connection/set-up-source/) represents a connection to an external system, including any configuration for how to reach that system (such as networking details), and securely stored credentials.
* [Webhooks](/docs/foundry/data-connection/webhooks-overview/) are a capability supported by some source types that allow you to build structured requests to run interactively and send requests to that system.
* An [Ontology edit Function](/docs/foundry/functions/api-ontology-edits/) is a [Function](/docs/foundry/functions/overview/) that can be later configured as a [Function-backed Action](/docs/foundry/action-types/function-actions-overview/) to write back to an object. It is annotated with the `@OntologyEditFunction()` decorator.
* A [query Function](/docs/foundry/functions/query-functions/) is a read-only Function that cannot have any side effects, like altering an external system. It is annotated with the `@Query()` decorator.

## Setup guide

In the following setup guide, we will walk through creating a webhook that calls a [free public dictionary API ↗](https://dictionaryapi.dev/). If you already have an existing source with webhooks configured, proceed to [external sources in functions](/docs/foundry/functions/webhooks/) for calling the webhooks from functions.

:::callout{theme="neutral"}
The dictionary API illustrated here is unaffiliated with Palantir and may change at any time. This tutorial is not an endorsement, recommendation, or suggestion to use this API for production use cases.
:::

### Create a Data Connection source

To connect to an external system from Functions, you must have a REST API source that can connect to the desired external API. You can follow instructions below to configure a new REST API source.

1. Navigate to the Data Connection application within Foundry and choose **New Source**. From the list of options, select **REST API**.

![Data connection new source page with a red box around the REST API card](./images/external-functions-choose-rest-api-source.png)

2. Review the **Overview** page, then select **Continue** in the bottom right. You will be prompted to choose the connection runtime: a [Foundry worker](/docs/foundry/data-connection/core-concepts/#foundry-worker), an [agent worker](/docs/foundry/data-connection/core-concepts/#agent-worker), or an [agent proxy runtime (sunset)](/docs/foundry/data-connection/agent-proxy-runtime/). A Foundry worker is the preferred method when interacting with anything reachable from Foundry's network directly (via [direct connection egress policies](/docs/foundry/administration/configure-egress/#direct-connection-egress-policies) or anything hosted on a network different from Foundry's (via [agent proxy egress policies](/docs/foundry/administration/configure-egress/#agent-proxy-egress-policies).
   We will use a Foundry worker with a direct connection policy to connect to our free dictionary API.

3. Choose a name for your source, and select a project to which it should be saved.

4. Fill out the **Domains** section with the connection information of the API source. The configuration for our free dictionary API example is shown below:

![REST API source creation page showing configuration to connect to api.dictionaryapi.dev without any authentication](./images/external-functions-configure-dictionary-api-source.png)

5. For this example, we also need to create the necessary egress policy. The policy will be automatically suggested in the **Network Connectivity** section if you completed the previous step:

![Suggested egress panel showing a suggested policy for api.dictionaryapi.dev on port 443](./images/external-functions-suggested-egress-for-dictionary-api.png)

6. Select **Save**, then choose **Save and continue** to complete the source setup. Before we configure a webhook to use on this source, navigate back to the source **Overview** page and ensure that an API name is set. This name is required to reference the source in code.

![Dialog for setting the API name of a source, showing an API name of MyDictionarySource](./images/external-functions-set-api-name-for-source.png)

### Create a webhook on a Data Connection source

Now, you must set up the webhook on the REST API source you configured in the previous step. Then, before you can call a webhook from a Function, you must configure the webhook and assign it an API name. A Data Connection source may have multiple webhooks associated with it. Note that your source API name should be unique within a namespace, and the webhook API name must be unique within the source.

Follow the steps below to configure a webhook that makes a request to the dictionary API to fetch the definition of a single word.

1. On the **Overview** page for the source, choose **Create webhook**. Give the webhook a name, description, and API name. As with the API source, we will reference the webhook in code.

![New webhook page showing a webhook called getDefinition](./images/external-functions-create-dictionary-api-webhook.png)

2. Define a parameter to pass in when executing the webhook. In our example, we will use a single string input parameter, `wordToDefine`.

![The webhook configuration screen within the API source in Data Connection.](./images/external-functions-create-dictionary-api-webhook-input.png)

3. Now, fill in the dictionary resource path in the URL, with the input parameter referenced at the end as shown below:

![The dictionary API resource path, with the input parameter added to return the correct data.](./images/external-functions-create-dictionary-api-webhook-call.png)

In our example, the API is a GET request that does not modify any data. Therefore, we will leave the default setting of `Read API`, allowing the webhook to be used in both types of Functions: `@Query()` and `@OntologyEditFunction()`. Webhooks marked with `Write API` may only be used in an `@OntologyEditFunction()`.

4. On the next page, you will see a panel that allows you to execute the webhook as currently configured. If you run the webhook, you will see an unparsed response:

![A test of the response of the API source webhook.](./images/external-functions-dictionary-api-webhook-test-connection.png)

5. Webhooks allow taking the response object returned from the external system and parsing fields according to a typed schema. For this example, we will extract a list of definitions for each returned part of speech. Run the webhook to ensure that some output is returned for a common word ("technology", for example).

Once the webhook is saved, it is usable across the platform.

[Learn more about webhook configuration options and usage.](/docs/foundry/data-connection/webhooks-reference/).

### Next Steps

To begin using this source in a function, proceed to the guide on [external sources in functions](/docs/foundry/functions/webhooks/).
