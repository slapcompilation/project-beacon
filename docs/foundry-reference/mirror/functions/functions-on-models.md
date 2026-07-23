<!-- source: https://palantir.com/docs/foundry/functions/functions-on-models/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Functions on models

You can deploy models in the context of the Ontology by using functions that invoke models during their runtime. Model functions are automatically generated wrappers around live model deployments that can be imported into a functions repository and called from your code. This enables you to add custom business logic around model predictions, integrate models with Ontology objects, or orchestrate multiple model calls.

## Overview

Model functions can be published from two types of deployments:

* **[Direct model deployments](/docs/foundry/manage-models/create-a-model-deployment/):** Published directly from the model page.
* **[Modeling Objective live deployments](/docs/foundry/manage-models/set-up-live/):** Published from the deployment details page in a Modeling Objective.

Both methods create a function with the same input and output API as your model. For details on function behavior, version upgrades, and configuration options, see the [Model functions developer guide](/docs/foundry/model-integration/model-functions-guide/).

Model functions are fully supported in TypeScript v1, TypeScript v2, and Python functions.

## Import a live deployment in a repository

Once a function for a live deployment has been created either [on the model itself](/docs/foundry/manage-models/create-a-model-deployment/#3-publish-a-function-for-the-deployment) or in a [modeling objective](/docs/foundry/manage-models/set-up-live/#publish-function), it must be imported for usage in a specific repository. Select **Add** and **Query Functions** in the **Resource Imports** menu on the left side bar in the repository. Models are searchable by the function name that was chosen during publishing. Note that Python and TypeScript v2 repositories only support model functions that are tied to an ontology, as described in the section below.

:::callout{title="Notes" theme="neutral"}
For TypeScript v1 repositories, it is also possible to import a model function by selecting **Models**, which is functionally equivalent to importing it under **Query Functions**.

Legacy function on models that use the **API Name** card in Modeling Objectives instead of the preferred [model publication dialog](/docs/foundry/manage-models/set-up-live/#publish-function) can still be imported under the **Modeling Objectives** section, but are being sunset.
:::

## Ontology or space-bound functions

Starting from February 2026 onwards, all new model functions will be tied to an ontology. This is a prerequisite for usage in [TypeScript v2 and Python functions](/docs/foundry/functions/language-models-python-tsv2/), which only allow ontology resource imports. Prior to this date, model functions were tied to the model's [space](/docs/foundry/security/orgs-and-spaces/). TypeScript v1 allows importing both types of model functions, but the import and usage semantics vary slightly as [detailed below](#if-the-function-is-registered-to-an-ontology).

To check if a function is bound to an ontology, navigate to your model: model functions that are not bound to an ontology will indicate that a migration is available. [Learn more on migrating your function to be ontology-bound](#migrating-model-functions-to-ontology-bound-functions).

## Call a model function from Python or TypeScript v2 functions

Once a function for a live deployment has been created, it must be imported for usage in a specific repository. It can then be queried [like any query function](/docs/foundry/functions/query-functions/#call-a-query-function).

### Example code: Python

```python
from functions.api import function, Double
from foundry_sdk_runtime import AllowBetaFeatures
from ontology_sdk import FoundryClient
from ontology_sdk.ontology.objects import Flight


@function(beta=True)
def predict_flight_delays(flight: Flight) -> Double:
    # Prepare the input to match the model function's API.
    model_output = FoundryClient().ontology.queries.flight_model_deployment(
        df_in=[
            {
                "lastArrivalTime": flight.last_arrival_time,
                "lastExpectedArrivalTime": flight.last_expected_arrival_time,
            },
        ]
    )
    return model_output.df_out[0].prediction
```

### Example code: TypeScript v2

```typescript
import { Client } from "@osdk/client";
import { Double } from "@osdk/functions";
import { flightModelDeployment, Flight } from "@ontology/sdk";

async function predictFlightDelays(client: Client, flight: Flight): Promise<Double> {
    // Prepare the input to match the model function's API.
    const modelOutput = await client(flightModelDeployment).executeFunction({
        "df_in": [
            {
                "lastArrivalTime": flight.lastArrivalTime,
                "lastExpectedArrivalTime": flight.lastExpectedArrivalTime,
            },
        ]
    });
    return modelOutput.df_out[0].prediction;
}

export default predictFlightDelays;
```

## Write a model-backed TypeScript v1 function

### If the model function is registered to a space

We first need to import the function:

```typescript
// If the model function is tied to a space and not to an ontology,
// copy the import snippet from the Resource imports sidebar.
```

Then, write a function that takes a flight, prepares data for the model, and interprets the result of the model execution. The model is imported as an asynchronous function that respects the [model's input and output specification or API](/docs/foundry/integrate-models/model-adapter-api/). From this, TypeScript can ensure, at compile time, that the correct data structure is sent to and received from the model deployment.

Note that if your model's API expects a single tabular input and output, the associated function will accept single TypeScript objects with properties corresponding to the columns specified for the input if the [**Enable row-wise processing** option](/docs/foundry/model-integration/model-functions-guide/#row-wise-publishing) is enabled, which is the default. The `predictFlightDelaysRowWise` function below demonstrates this pattern. Alternatively, consider [using an Object or ObjectSet directly in the model API](/docs/foundry/integrate-models/model-adapter-reference/#for-object-inputs) to facilitate use of your model with objects in functions.

The `predictFlightDelays` function below returns a [`FunctionsMap`](/docs/foundry/functions/types-reference/#map), which is the TypeScript v1 type used to return a map keyed by objects or scalar values. In this example, it maps each `Flight` object to its predicted delay value.

```typescript
import { Function, Double, FunctionsMap } from "@foundry/functions-api";
import { Flight } from "@foundry/ontology-api";

@Function()
public async predictFlightDelaysRowWise(flight: Flight): Promise<Double> {
    // Prepare the input to match the model function's API.
    // This model function expects a single flight.
    // If you'd like to process multiple flights at a time,
    // edit your model function and uncheck "Enable row-wise processing".

    // Note you can also use an Object directly in the model API
    // to avoid tedious mapping between a model API and an object type's properties.
    const modelInput = {
        "lastArrivalTime": flight.lastArrivalTime,
        "lastExpectedArrivalTime": flight.lastExpectedArrivalTime,
    };
    // Call the Live deployment.
    const modelOutput = await FlightModelDeploymentRowWise(modelInput);
    return modelOutput.prediction;
}

@Function()
public async predictFlightDelays(flights: Flight): Promise<FunctionsMap<Flight, Double>> {
    let functionsMap = new FunctionsMap();
    // Prepare the input to match the model function's API,
    // for the case where row-wise processing is not enabled.

    // Note you can also use an ObjectSet directly in the model API
    // to avoid tedious mapping between a model API and an object type's properties.
    const dfIn = flights.map(flight => ({
        "lastArrivalTime": flight.lastArrivalTime,
        "lastExpectedArrivalTime": flight.lastExpectedArrivalTime,
    }));
    // Call the Live deployment.
    const modelOutput = await FlightModelDeployment(
        {"df_in": dfIn}
    );
    for (let i = 0; i < flights.length; i++) {
        functionsMap.set(flights[i], modelOutput.df_out[i].prediction);
    }
    return functionsMap;
}
```

Note the above example assumes the following Model API:

```python
import palantir_models as pm


class ExampleModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "df_in": pm.Pandas(columns=[("lastArrivalTime", datetime.datetime), ("lastExpectedArrivalTime", datetime.datetime)])
        }
        outputs = {
            "df_out": pm.Pandas(columns=[("prediction", float)])
        }
        return inputs, outputs
    ...

```

### If the function is registered to an ontology

In this case, both the import and the query syntax need to be updated as detailed by the comments in the snippet below:

```typescript
import { Function, Double } from "@foundry/functions-api";
// Add the Queries import to use an ontology-bound model function
import { Queries, Flight } from "@foundry/ontology-api";

export class MyFunctions {
    @Function()
    public async predictFlightDelays(flight: Flight): Promise<Double> {
        // Call your model by API Name from Queries
        const modelOutput = await Queries.flightModelDeployment({
            "df_in": [
                {
                    "lastArrivalTime": flight.lastArrivalTime,
                    "lastExpectedArrivalTime": flight.lastExpectedArrivalTime,
                },
            ]
        });
        return modelOutput.df_out[0].prediction;
    }
}
```

### Migrating model functions to ontology-bound functions

When you migrate a space-bound model function to an ontology-bound function from the user interface, existing published versions of TypeScript v1 functions that use the model will continue to work. However, the import syntax will no longer be recognized, meaning preview and tagging new releases of the repository consuming the model function will no longer work.

To update your TypeScript v1 function after migration:

1. Open your code repository and select the **Resource imports** sidebar.
2. Select the newly created version of the model function, by updating the resources.json file to the new version.
3. Update your function code to use the query function syntax as detailed above, or see the dedicated documentation on [calling a query function](/docs/foundry/functions/query-functions/#call-a-query-function) for more details.

:::callout{theme="warning"}
Direct model function usage through the [Foundry Platform SDK](/docs/foundry/dev-toolchain/overview/#platform-sdks) and the [Functions.Query ↗](https://github.com/palantir/foundry-platform-python/blob/develop/docs/v2/Functions/Query.md) method will break immediately upon migration. This is because this consumption pattern refers to the function by its API name, which is migrated globally across all model function versions at once. To remediate these consumers, update the API name to its new value after the migration.
:::

## Performance considerations

Models are executed as part of the runtime of the function, therefore all standard [limits](/docs/foundry/functions/manage-functions/#enforced-limits) apply.
If your function backs an Action, there are [further limits](/docs/foundry/action-types/scale-property-limits/#edit-limits) on the number of resulting edits.
When calling live deployments, model input and output data is sent through the network with an upper limit of 50 MB. Including that additional throughput, the total execution time of the function cannot exceed 30 seconds. If you wish to increase this timeout limit per function, contact your Palantir representative.
