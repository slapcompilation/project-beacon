<!-- source: https://palantir.com/docs/foundry/functions/webhooks/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Webhooks in functions

:::callout{theme="warning"}
The following documentation is specific to TypeScript v1 functions. For more [robust capabilities](/docs/foundry/functions/language-feature-support/#typescript-v1-vs-typescript-v2), including support for Ontology SDK and configurable resource requests, we recommend [migrating to TypeScript v2](/docs/foundry/functions/typescript-v2-migration/).
:::

:::callout{theme="neutral"}
Webhooks can be published as first-class functions. This means you can invoke them from Workshop, the Ontology SDK, Actions, and other functions. To publish a webhook as a function instead, see [Webhook functions](/docs/foundry/data-connection/webhooks-reference/#webhook-functions).
:::

This guide will walk you through setting up a function that can make requests to external systems using [webhooks](/docs/foundry/data-connection/webhooks-overview/).

:::callout{theme="neutral" title="Prerequisites"}
This guide assumes you have already created a data connection source and a webhook. For more information, see the [documentation how to create a data connection source and webhook](/docs/foundry/data-connection/external-functions/).
:::

Webhooks backed by outbound applications are supported. For more information, see the [Supported workflows](/docs/foundry/administration/configure-outbound-applications/#supported-workflows) section in the outbound application configuration page.

## Import sources into a functions repository

Before following this guide, make sure you already created a functions repository and understand how to write and publish functions as described in [our tutorial](/docs/foundry/functions/getting-started/).

You must first enable the source to be imported into Code Repositories. To do this, go to the **Enable code imports** menu for your REST API source and enable the option to allow the source to be imported into Code Repositories. Since it is not possible to perform exportable Marking validations in all workflows where functions are used, you must also enable exports to the source without Marking validations in the **Enable exports** menu for each source.

![Code import configuration.](/docs/resources/foundry/functions/source-code-import-configuration.png)

![Export configuration.](/docs/resources/foundry/functions/source-export-configuration.png)

Next, to use a webhook in functions, the backing REST API source of the webhook must first be imported into the repository. Select the [**Resource imports** left-side panel](/docs/foundry/functions/resource-imports-sidebar/) to view the sources imported into the repository. Select **Add > Sources** to display a search dialog where you may select the source you want to import. Only sources with API names may be imported through this dialog.

![External functions source import modal showing a specific source selected for import](/docs/resources/foundry/functions/external-functions-source-import-modal.png)

:::callout{theme="neutral"}
Source imports into Function repositories for webhook usage work differently than source imports to Python transforms repositories and compute modules. Function repositories that utilize a given source only for webhook usage will *not* be displayed in the list of repositories shown on the source overview. Any user with `Viewer` access to a source will be able to import and use those webhooks in external functions.
:::

## Use webhooks in functions

Once you import the REST API source to the functions repository, it will be available in the TypeScript environment and accessible through the namespace of the source:

```typescript
import { Function } from "@foundry/functions-api";
import { MyDictionarySource } from "@foundry/external-systems/sources";
```

If you get the error `Cannot find module '@foundry/external-systems' or its corresponding type declarations.`, ensure the value for `enableExternalSystems` is set to `true` in the `functions-typescript/functions.json` file. Once you update it and commit the changes, the system should install the necessary packages, including `@foundry/external-systems`.

![External functions import error message.](/docs/resources/foundry/functions/external-functions-import-error-message.png)

### Example: Make multiple calls from a Function

In the example below, we will explain how to make multiple calls to the dictionary API using a single Function.

If your Function does not make any Ontology edits, you will create a `@Query()` function. If you would like to make Ontology edits, it would instead require the `@OntologyEditFunction` decorator. Learn more about making Ontology edits from functions in our [documentation](/docs/foundry/functions/api-ontology-edits/).

Using the standard [TypeScript async/await pattern ↗](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-1-7.html#asyncawait-support-in-es6-targets-node-v4), multiple webhook calls can be made simultaneously from a Function. Check the success of calls using the `isOk` helper function exported from `@foundry/functions-api`.

The following Function accepts a list of words as a TypeScript string array and makes one call for each word:

```typescript
import { OntologyEditFunction, isOk } from "@foundry/functions-api";
import { MyDictionarySource } from "@foundry/external-systems/sources";

export class MyFunctions {

    @OntologyEditFunction()
    public async defineWords(words: string[]): Promise<void> {

        const results = await Promise.all(words.map(word => MyDictionarySource.webhooks.GetDefinition.call({
            wordToDefine: word
        })));

        results.forEach((result, i) => {
            if (isOk(result)) {
                const output = result.value.output;
                output.dictionary_definitions.forEach(definitions_for_word => {
                    definitions_for_word.meanings.forEach(meaning => {
                        meaning.definitions.forEach(def_for_part_of_speech => {
                            console.log(`Found a ${meaning.partOfSpeech} definition for "${words[i]}": ${def_for_part_of_speech.definition}`);
                        })
                    })
                });
            }
        });
    }
}
```

Log output for an input of `["tuba", "cool"]`:

```
LOG [2023-07-28T03:16:22.968Z] Found a noun definition for "tuba": A large brass musical instrument, usually in the bass range, played through a vibration of the lips upon the mouthpiece and fingering of the keys.
LOG [2023-07-28T03:16:22.968Z] Found a noun definition for "tuba": A type of Roman military trumpet, distinct from the modern tuba.
LOG [2023-07-28T03:16:22.968Z] Found a noun definition for "tuba": A large reed stop in organs.
LOG [2023-07-28T03:16:22.968Z] Found a noun definition for "tuba": A Malayan plant whose roots are a significant source of rotenone, Derris malaccensis.
LOG [2023-07-28T03:16:22.968Z] Found a noun definition for "tuba": A reddish palm wine made from coconut or nipa sap.
LOG [2023-07-28T03:16:22.968Z] Found a noun definition for "tuba": A tube or tubular organ.
LOG [2023-07-28T03:16:22.968Z] Found a noun definition for "cool": A moderate or refreshing state of cold; moderate temperature of the air between hot and cold; coolness.
LOG [2023-07-28T03:16:22.968Z] Found a noun definition for "cool": A calm temperament.
```

## Error handling

To help mitigate failures when working with a networked system, functions expose errors propagated from webhooks using Result objects, which give information about the kind of error that occurred:

```typescript
import { OntologyEditFunction, isOk } from "@foundry/functions-api";
import { MyDictionarySource } from "@foundry/external-systems/sources";

export class MyFunctions {

    @OntologyEditFunction()
    public async defineWords(words: string[]): Promise<void> {

        const results = await Promise.all(words.map(word => MyDictionarySource.webhooks.GetDefinition.call({
            wordToDefine: word
        })));

        results.forEach((result, i) => {
            if (isOk(result)) {
                // Extract the response
            } else {
                const errorName = result.error.name;

                if (errorName === "WebhookExecutionFailedToStart") {
                    console.log("We were unable to initiate a request to the dictionary API.");
                } else if (errorName === "ParsingResponseFailed") {
                    console.log("The external request succeeded, but the response couldn't be parsed.");
                } else {
                    console.log("Something went wrong.");
                }
            }
        });
    }
}
```

When handling errors, authored code should listen for specific names and react accordingly. Functions currently return the following errors:

| Error | Description |
| ----- | ----------- |
| `WebhookExecutionFailedToStart` | The webhook failed to start. If this error is returned, it can be safely assumed that no request was made to the external system. |
| `WebhookExecutionTimedOut` | The webhook execution began, but no response was received from the external system within the configured webhook time limit. |
| `RemoteRestApiReturnedError` | The external system returned an error. Only returned for webhooks configured on a REST API source. |
| `RemoteApiReturnedError` | The external system returned an error. Only returned for webhooks configured on a non-REST API source. |
| `ParsingResponseFailed` | The webhook execution was successful, but the response from the external system could not be successfully parsed. This can happen if, for example, the response from the external system did not contain an expected field. Since the result of a webhook call will not necessarily be used, it is up to the application builder whether this should marked as a failure to end users. |
| `ServerError` | An internal problem occurred within the webhooks service or the connector. |
| `UnknownError` | An error occurred which could not be directly attributed to any Foundry service. |

This list of error types may change; users should structure their code to include a default case in the event that the Function executor returns an error with a new name.

### Example: Handle errors when making multiple webhook calls from a single Function

The following code describes how to handle multiple webhook calls where some succeed and some fail within the same function. In our example, a `RemoteRestApiReturnedError` is returned in the event that the dictionary server cannot find the definition for a given word.

```typescript
import { OntologyEditFunction, isOk } from "@foundry/functions-api";
import { MyDictionarySource } from "@foundry/external-systems/sources";

export class MyFunctions {

    @OntologyEditFunction()
    public async defineWords(words: string[]): Promise<void> {

        const results = await Promise.all(words.map(word => MyDictionarySource.webhooks.GetDefinition.call({
            wordToDefine: word
        })));

        results.forEach((result, i) => {
            if (isOk(result)) {
                const output = result.value.output;
                output.dictionary_definitions.forEach(definitions_for_word => {
                    definitions_for_word.meanings.forEach(meaning => {
                        meaning.definitions.forEach(def_for_part_of_speech => {
                            console.log(`Found a ${meaning.partOfSpeech} definition for "${words[i]}": ${def_for_part_of_speech.definition}`);
                        })
                    })
                });
            } else {
                if (result.error.name === "RemoteRestApiReturnedError") {
                    console.log(`ERROR: ${words[i]} could not be defined`, result.error.message);
                }
            }
        });
    }
}
```

Inputting `["asdf", "shire"]` to the above Function returns the following result:

```
LOG [2023-07-28T15:38:47.263Z] ERROR: asdf could not be defined Request returned an unsuccessful response code: 404 Response body: {"title":"No Definitions Found","message":"Sorry pal, we couldn't find definitions for the word you were looking for.","resolution":"You can try the search again at later time or head to the web instead."}
LOG [2023-07-28T15:38:47.264Z] Found a noun definition for "shire": Physical area administered by a sheriff.
LOG [2023-07-28T15:38:47.264Z] Found a noun definition for "shire": Former administrative area of Britain; a county.
LOG [2023-07-28T15:38:47.264Z] Found a noun definition for "shire": The general area in which a person lives or comes from, used in the context of travel within the United Kingdom.
LOG [2023-07-28T15:38:47.264Z] Found a noun definition for "shire": A rural or outer suburban local government area of Australia.
LOG [2023-07-28T15:38:47.264Z] Found a noun definition for "shire": A shire horse.
LOG [2023-07-28T15:38:47.264Z] Found a verb definition for "shire": To (re)constitute as one or more shires or counties.
```

## Limitations

Currently, there are no limits to the number of requests that can be made from within an Ontology edit function, but existing [functions resource limits](/docs/foundry/functions/manage-functions/#enforced-limits) still apply. [Webhook limits](/docs/foundry/data-connection/webhooks-reference/#limits) are also enforced.

Functions currently support webhooks with the following input and output types:

* Attachments
* Booleans
* Integers
* Longs
* Doubles
* Strings
* Optionals
* Dates
* Timestamps
* Lists
* Enums (list of allowed String type values)
* Records with and without expected fields

When calling webhooks from a `@Query` function, the webhook must perform only `Read API` calls that do not mutate the external system. Query functions are frequently retried or silently executed on pageload, and thus do not provide the same level of structured deliberate execution that is possible with an `@OntologyEditFunction`. When configuring a webhook, you can specify whether it is safe to execute from a Query function by using the option for `Read API` or `Write API`.

### Unsupported webhook features

* Webhooks that use the `OR` type as an input or output parameter are currently not supported. No code will be generated for those webhooks.

## Handle version changes in functions and webhooks

Functions and webhooks have versions, and callers may invoke any version of a Function or webhook. When a Function is published, the most recent webhook version available at that time will be pinned to it.

When a functions repository is opened in the [Code Repositories](/docs/foundry/code-repositories/overview/) application, the generated code bindings used for autocomplete will always use the most recent version of the webhook. This webhook version is displayed in the **Resource imports** side panel to the left.

![Resource import side panel in a functions repository, showing a source with a single webhook.](/docs/resources/foundry/functions/external-functions-import-sidebar.png)

:::callout{theme="warning"}
Make sure your webhook is stable before publishing functions that rely on its functionality.
:::

Remember to republish the Function and bump users to new versions when changes are made to the webhook or Function. Previously published, pinned versions of the Function will still be available for use.

## Permissions

The following table summarizes the permissions that are required to author, publish, and consume external functions.

| Action | User | Permission required |
|--------|------|---------------------|
| Import webhook to a functions repository | Function editor | `webhooks:editor` on the webhook, which is granted to the **Editor** default role. |
| Publish Function invoking a webhook | Function editor | `webhooks:execute` permission on the source, which is only granted to **Owner** and **Editor** default roles. |
| Configure an Action to use an `@OntologyEditFunction()` that calls webhooks | Action editor | `webhooks:grant-action-validated-execution` permission on the webhook and `Viewer` permission on the Function |
| Execute a `@Query()` webhook from Workshop | End user | `webhooks:execute` permission on the source, which is only granted to `Owner` and `Editor` default roles. |
| Execute an `@OntologyEditFunction()` from an Action | End user | The user must meet the [submission criteria](/docs/foundry/action-types/submission-criteria/) for the Action. No permissions on the source, webhook, or Function are checked in this case. Users creating and managing Actions must ensure that submission criteria are configured appropriately. |

## Monitoring, troubleshooting, and debugging

Use the following platform tools to gain more insight into webhook executions from functions:

* [Webhook execution history](/docs/foundry/data-connection/webhooks-reference/#webhook-history), which is available in the **History** tab when viewing a single webhook in [Data Connection](/docs/foundry/data-connection/overview/).
* The Function usage history, available in [Ontology Manager](/docs/foundry/ontology-manager/overview/), shows a history of when functions were executed including the inputs, outputs, and user that triggered the Function.
* [Code authoring preview for functions](/docs/foundry/functions/foo-getting-started/#test-in-live-preview), which provides performance profiling, debug output, and more.

## Best practices

We recommend the following best practices when using external sources to call webhooks from functions:

* Thoroughly test webhooks with the [test webhook side panel](/docs/foundry/data-connection/webhooks-setup/#test-the-webhook) in Data Connection before attempting to use those webhooks in functions.
* Use webhook input and output `record` type parameters with expected fields, if possible. Using explicit types, rather than JSON, means that Function code is less likely to throw unexpected runtime errors.
* Use the `isOk` and `isErr` built-in functions exported from `@foundry/functions-api` to check for success and error states, and narrow down the type of error through the name field.
* If users will be writing to both an external system and the Ontology from a single Function call, remember that the write to the Ontology could fail, even if the write to the external system succeeds. Be sure that measures are in place to deal with such inconsistencies, and grant users visibility into the state of their modification to both systems if needed.
