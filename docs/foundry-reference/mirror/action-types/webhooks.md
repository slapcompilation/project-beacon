<!-- source: https://palantir.com/docs/foundry/action-types/webhooks/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Webhooks

A [webhook](/docs/foundry/data-connection/webhooks-overview/) is a concept in Data Connection that enables sending a request to an external system, such as Salesforce, SAP, or any configured HTTP server, typically to modify data in that external system.

By setting up a webhook and then configuring it for use in an action, you can send data to an external system when end users apply an action in Foundry. This enables workflows in Foundry to connect directly with source systems and write back data and decisions into those systems.

This section details the various options available for configuring webhooks in an action. For a step-by-step tutorial, see the documentation on [how to add a webhook in an action](/docs/foundry/action-types/set-up-webhook/).

## Webhooks: Writeback vs. side effect

There are two ways that webhooks can be configured for use in an action: as a **writeback** or as a **side effect**.

<img src="./images/webhooks-add-webhook.png" alt="Add webhook" width="400" />

For convenience, below is a table comparing the behavior of writeback and side effect webhooks.

| Type | When applied | Failure shown to end user? | Timing |
|--- |--- |--- |--- |
| **Writeback** | Before object changes | Yes | Before user sees success or failure |
| **Side effect** | After object changes | No | May be after user sees success message |

The following sections describe writeback webhooks and side effect webhooks in more detail.

### Writeback webhooks

When configured as a **writeback**, the webhook will be executed *before* any other rules are evaluated; if the webhook execution fails, no other changes will be made. If you want to ensure that changes are not made in Foundry before the external system, you should set up your webhook as a writeback.

This behavior enables some degree of transactionality between Foundry and the external system. Using a writeback webhook guarantees that if the request to the external system fails, no changes will be applied to the Foundry Ontology. However, it is still possible that the external request may succeed but Ontology changes could fail.

Because the action stops being applied when a writeback webhook fails, you can only configure a single webhook as a writeback. If this webhook fails when the action is applied, an error will be shown to the end user describing the failure.

When a webhook is configured as a writeback, its output parameters can be used in subsequent rules. See the [output parameters](#output-parameters) section below for more details.

### Side effect webhooks

When configured as a **side effect**, a webhook will be executed *after* other rules are evaluated. This means that modifications to Foundry objects will occur before side effects are applied. You can configure multiple side effect webhooks in a single action, and they will be executed in no particular order. In an action with side effect webhooks, the end user will see a success message after Foundry objects are modified; executing the side effects may happen after the success message is shown.

If you need to call a webhook multiple times from a single action, this can be achieved with a side effect webhook by providing a list of payloads as an input. This will trigger the webhook as many times as there are payloads in the list provided and will be processed in no guaranteed order. An example of this can be found below in the [input parameters](#input-parameters) section.

You should use side effect webhooks when you want to send best-effort notifications or write back to multiple external systems.

## Input parameters

In order to configure a Webhook in an Action, you must populate all of its required input parameters. General reference material about Webhook input parameters is available in the [Data Connection documentation](/docs/foundry/data-connection/webhooks-reference/#input-parameters).

There are two ways to configure Webhook input parameters: by mapping to Action parameters, or by using a Function.

When mapping to **Action parameters**, each required Webhook input must be set to either an Action parameter of the same type, a static value, or a property of an object parameter.

<img src="./images/webhooks-input-parameters.png" alt="Input parameters" width="400" />

When using a [Function](/docs/foundry/functions/overview/), you must select a Function that returns a custom type that includes all of the required Webhook input parameters and strongly matches the Webhook type, otherwise you will receive an `OntologyMetadata:ActionWebhookInputsDoNotHaveExpectedType` error. Using a Function to populate Webhook input parameters can be useful when you want to use logic to populate inputs, especially if this logic is based on Ontology objects. For example, you can retrieve linked objects and pull property values from those objects to prepopulate Webhook inputs.

As an example, suppose you have a Webhook which takes three input parameters with IDs `name`, `industry`, and `country`:

<img src="./images/webhooks-input-parameters-example.png" alt="Input parameters example" width="400" />

You can write a Function that returns a custom interface of the same structure:

```typescript
export interface MyWebhookInput {
    name: string;
    industry: string;
    country: string;
}
```

Then, you can select this Function when configuring Webhook inputs in an Action, mapping Action parameters to the parameters required by the Function:

<img src="./images/webhooks-input-parameters-define-using-action.png" alt="Mapping Action parameters to the parameters required by a Function" width="400" />

Below is a full code example of a Function that loads data from an Ontology object and uses it to populate Webhook inputs.

```typescript
import { Function, UserFacingError } from "@foundry/functions-api";
import { Company } from "@foundry/ontology-api";

export interface MyWebhookInput {
    name: string;
    industry: string;
    country: string;
}

export class MyWebhookFunctions {
    @Function()
    public returnWebhookInput(company: Company): MyWebhookInput {
        if (!company.name || !company.industry || !company.country) {
            throw new UserFacingError("Some required fields are not set.");
        }
        return {
            name: company.name,
            industry: company.industry,
            country: company.country,
        }
    }
}
```

A side effect Webhook may be called multiple times by returning a list of payloads from a Function. Below is an example Function which takes two companies as inputs, and returns a list containing two payloads matching the input parameters expected by a Webhook. If this Function is used from Actions to return the inputs for a side effect Webhook, it will result in two separate Webhook executions.

```typescript
import { Function } from "@foundry/functions-api";
import { Company } from "@foundry/ontology-api";

export interface MyWebhookInput {
    arg1: string;
    arg2: string;
}

export class MyFunctions {
    @Function()
    public createWebhookRequest(company1: Company, company2: Company): MyWebhookInput[] {
        return [
        {
           arg1: company1.someProperty,
           arg2: company1.someOtherProperty,
        },
        {
           arg1: company2.someProperty,
           arg2: company2.someOtherProperty,
        }
        ];
    }
}
```

## Output parameters

When a Webhook is configured as a [writeback Webhook](#writeback-webhooks), you can use its output parameters in subsequent rules. This is useful when the external system returns data that you want to immediately write into a Foundry object or use in a subsequent [notification](/docs/foundry/action-types/notifications/) or [side effect Webhook](#side-effect-webhooks).

General reference material about Webhook output parameters is available in the [Data Connection documentation](/docs/foundry/data-connection/webhooks-reference/#output-parameters).

To use an output parameter in a subsequent logic rule, select **Writeback response** when populating the value for a logic rule, then select the specific output you wish to use:

<img src="./images/webhooks-output-parameters-in-logic-rule.png" alt="Using an output parameters in a Logic Rule" width="400" />

## OAuth 2.0 authentication

When a webhook is configured on a REST API source that uses an [outbound application](/docs/foundry/administration/configure-outbound-applications/) for authentication, Foundry manages the OAuth 2.0 authorization flow on behalf of the user. Developers do not need to handle token acquisition or refresh. Foundry passes the correct access token with every webhook call.

For a full overview of OAuth 2.0 outbound application support across Foundry workflows, see the [OAuth 2.0 outbound applications](/docs/foundry/administration/configure-outbound-applications/) documentation.
