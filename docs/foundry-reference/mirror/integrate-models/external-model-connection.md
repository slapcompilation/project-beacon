<!-- source: https://palantir.com/docs/foundry/integrate-models/external-model-connection/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Integrate an externally hosted model

:::callout{theme="warning" title="Warning"}
`Batch deployments` are currently not supported for externally hosted models. [Configure a Python transform that uses an external model instead.](#python-transforms)
:::

## Benefits of wrapping an externally hosted model in Foundry

Foundry enables the creation of a model that act as a proxy to a model hosted in a third party application, service or model provider such as Azure Machine Learning, Amazon SageMaker, OpenAI, or Vertex AI. This makes it easy for models developed outside of Foundry to be used by Foundry users, pipelines, and operational applications.

Once an externally hosted model has been integrated, Foundry provides the following:

* Full versioning, granular permissioning, and governed model lineage.
* Model management and live deployment via [Modeling Objectives](/docs/foundry/model-integration/objectives/).
* Binding to the Foundry Ontology, allowing for operationalization via [functions on models](/docs/foundry/functions/functions-on-models/) and what-if scenario analysis.

:::callout{theme="neutral"}
The features listed above may not be relevant to your use case. For example, externally hosting your model may not be the right solution if you do not intend to manage or evaluate the model in Foundry, or if you have a general purpose model that should not be bound to a specific object type in the Ontology, such as a large language model.  Instead, you may want to call the model's external API directly from Foundry rather than wrapping it into a Foundry model. <br><br>
In these cases, credentials can be defined in a [Data Connection source](/docs/foundry/data-connection/set-up-source/) instead of being configured as part of the model definition as described below. This source and related [egress policies](/docs/foundry/administration/configure-egress/) can then be imported in [external transforms](/docs/foundry/data-connection/external-transforms/) to enable batch inference, and in your [function](/docs/foundry/data-connection/external-functions/) for live inference.
:::

## Additional considerations for language models

In the case of language models, consider [registering your model](/docs/foundry/aip/bring-your-own-model/) in the platform for use within [AIP tools](/docs/foundry/platform-overview/aip-capabilities/) such as [AIP Logic](/docs/foundry/logic/overview/) or Pipeline Builder's [Use LLM Node](/docs/foundry/pipeline-builder/pipeline-builder-llm/). This can be done using an externally hosted model in Foundry, but creating a model is not necessary. The [registered models page](/docs/foundry/aip/bring-your-own-model/) describes how to register your own model in AIP.

## Create a custom connection to an externally hosted model

To create a connection to an externally hosted model you will need the following:

* Connection details to connect to the externally hosted model.
* A [model adapter](#example-model-adapter-structure) that tells Foundry how to create a connection to and interface with the externally hosted model.
* A [Foundry egress policy](/docs/foundry/administration/configure-egress/) that allows Foundry to connect to the externally hosted model.

You can create a model that proxies an externally hosted model by following the steps below.

### 1. Create a new model

The first step is to create a new model. This can be done either by selecting **+New > Model** in a Foundry Project, or through a new or existing [modeling objective](/docs/foundry/model-integration/objectives/). In the modeling objective, select **Add model**.

The screenshot below shows the creation of a new model in a Foundry project by selecting **+New > Model**.

![Empty compass project showing creating a new model](/docs/resources/foundry/integrate-models/external-model-compass-new-model.png)

The screenshot below shows the creation of a new model through a modeling objective by selecting **Add model** from the External Model screen.

![Empty modeling objective](/docs/resources/foundry/integrate-models/external-model-empty-objective.png)

### 2. Select method of adding a model

Select **Connect an externally hosted model**, then **Next**.

![Select connect an externally hosted model in Palantir Foundry](/docs/resources/foundry/integrate-models/external-hosted-new-model-dialog.png)

### 3. Set egress policy

Select **Custom connection** as the source for your externally hosted model and choose an [**egress policy**](/docs/foundry/administration/configure-egress/#using-a-policy) in the dropdown, then select **Next**.

An egress policy enables a Foundry project or artifact to send data from Foundry to an external system. Egress policies may be controlled by your organization's Foundry security model. If you have the required permissions, you can browse and configure a new egress policy in the [Control Panel application](/docs/foundry/administration/control-panel/).

![Select an egress policy for an externally hosted model in Palantir Foundry](/docs/resources/foundry/integrate-models/externally-hosted-select-egress-policy.png)

### 4. Configure model adapter

Select the model adapter for this model. The model adapter should be configured to take an `ExternalModelContext` at load time to initialize the connection to the externally hosted model. For more information, refer to the documentation on how to create a [model adapter](/docs/foundry/integrate-models/model-adapter-creation/), review [example model adapters](#example-model-adapter-structure) for the external model, and view the [API definition](/docs/foundry/integrate-models/model-adapter-reference/#externalmodelcontext) of the `ExternalModelContext`.

![Define the model adapter for an externally hosted model in Palantir Foundry](/docs/resources/foundry/integrate-models/external-model-adapter-configuration.png)

### 5. Configure model connection

Define the model connection details for your custom model connection. The connection configuration has two components:

* **URL** (optional): This is the base URL that is provided to the model adapter. This is intended to be the URL of the model inference function.
* **Connection Configuration** (optional): The connection configuration will not be encrypted and will be viewable with the model metadata in platform. This component can store specific configuration details such as the model name, inference parameters, or thresholds.

![Define model configuration for an externally hosted model in Palantir Foundry](/docs/resources/foundry/integrate-models/external-connection-configuration.png)

### 6. Configure credentials

Define the credentials configuration for your custom model connection and then select **Next**.

* **Credentials Configuration** (optional): The credentials will be encrypted and safely stored alongside the Model. These credentials will be decrypted and provided to the model adapter at model load time. Note that users who have access to the model will be able to use this model to perform inference regardless of their underlying access to the external model. Select **Next** to proceed to save your model details.

![Define model credentials for an externally hosted model in Palantir Foundry](/docs/resources/foundry/integrate-models/external-credentials-configuration.png)

### 7. Configure details and submit model

Enter your model save location, model name and version notes for this model. This will define the Foundry name, location, and metadata of your model.

If you are creating this model from a modeling objective, select **Submit** to create your model and submit this model to your Modeling Objective. In a modeling objective, you can navigate to the model, see the configuration and optionally update the linked credentials.

If you are creating this model in a Foundry project, choose **Done** to save this model.

![Define model save location for an externally hosted model in Palantir Foundry](/docs/resources/foundry/integrate-models/external-save-location-configuration.png)

### View externally hosted models

The externally hosted model enables a user to update credentials, see the connection configuration, and copy egress policy RIDs so a user can configure [Python Transforms](/docs/foundry/transforms-python/transforms/).

![External model view in Palantir Foundry](/docs/resources/foundry/integrate-models/external-model-asset-view.png)

#### External model submission in a modeling objective

![External model view in Palantir Foundry](/docs/resources/foundry/integrate-models/external-model-submission-view.png)

## Test and operationalize an externally hosted model

There are several ways that you can test and operationalize an externally hosted model. You can:

* [Deploy the model live in a modeling objective](#live-deployment-in-modeling-objectives)
* [Configure a Python transform that uses an external model](#python-transforms)

### Live deployment in modeling objectives

Follow the [instructions to set up a live deployment](/docs/foundry/manage-models/set-up-live/) for real time inference in Foundry.

If you are hosting your model in a modeling objective in the same Foundry project as your model, then your egress policy will be automatically added to the live deployment. Otherwise, you will need to import your egress policy into the hosting project.

### Batch pipelines in modeling objectives

Externally hosted models currently do not support batch deployments or automatic model evaluation in a modeling objective.

### Python transforms

To configure a [Python transform](/docs/foundry/transforms-python/transforms/) that uses an external model, you will need to [manually enable network egress for that connection](/docs/foundry/data-connection/external-transforms-legacy/#configure-egress-and-credentials).

Next, you can find the required egress policy name from the model version and configure a Python transform with that model input.

![Egress and Credential RIDs in the view for an externally hosted model in Palantir Foundry](/docs/resources/foundry/integrate-models/external-model-asset-rids.png)

#### Dependencies

In this example, the following dependencies are set in the Python Transforms repository. Note the added dependency on `external-model-adapters` for model inference and `transforms-external-systems` for interacting with an external system.

```yaml
requirements:
  build:
    - python 3.8.*
    - setuptools

  run:
    - python 3.8.*
    - transforms {{ PYTHON_TRANSFORMS_VERSION }}
    - transforms-expectations
    - transforms-verbs
    - transforms-external-systems
    - external-model-adapters 1.0.0
```

#### Example transform

This simple example takes the externally hosted model and performs inference. Note the required `export_control` and `egress` policy that are added as inputs to the compute function. The egress policy should use the same egress policy as defined in the model.

```python
from transforms.api import transform, Input, Output
from palantir_models.transforms import ModelInput
from transforms.external.systems import EgressPolicy, use_external_systems, ExportControl


@use_external_systems(
    export_control=ExportControl(markings=['<MARKING_ID>']),
    egress=EgressPolicy('ri.resource-policy-manager.<RID>')
)
@transform(
    output=Output("/Foundry/Externally Hosted Models/data/inferences"),
    model=ModelInput("/Foundry/Externally Hosted Models/models/Regression Model"),
    foundry_input=Input("/Foundry/Externally Hosted Models/data/regression_features_input")
)
def compute(
        export_control,
        egress,
        output,
        model,
        foundry_input
    ):
    input_df = foundry_input.pandas()
    results = model.transform(input_df)
    output.write_pandas(results.df_out)
```

## Example model adapter structure

The below provides an example structure for a model adapter intended for use with an externally hosted model.

For additional information, we recommend referencing the following:

* The full [Model Adapter API definition](/docs/foundry/integrate-models/model-adapter-reference/#externalmodelcontext)
* How to [create and publish a model adapter](/docs/foundry/integrate-models/model-adapter-creation/)
* An [example connection to a model hosted in Amazon SageMaker](/docs/foundry/integrate-models/external-model-connection-sagemaker/)
* An [example connection to a model hosted in Google Vertex AI](/docs/foundry/integrate-models/external-model-connection-vertex-ai/)
* An [example connection to an Open AI model](/docs/foundry/integrate-models/external-model-connection-open-ai/)

```python
import palantir_models as pm

import json
import pandas as pd


class ExampleModelAdapter(pm.ExternalModelAdapter):

    def __init__(self, url, credentials_map, configuration_map):
        # Extract model configuration from "Connection configuration" map
        model_name = configuration_map['model_name']
        model_parameter = configuration_map['model_parameter']

        # Extract model credentials from "Credentials configuration" map
        secret_key = credentials_map['secret_key']

        # Initiate http client at model load time
        self.client = ExampleClient(url, model_name, model_parameter, secret_key)

    @classmethod
    def init_external(cls, external_context: pm.ExternalContext) -> "pm.ExternalModelAdapter":
        return cls(
            url=external_context.base_url,
            credentials_map=external_context.resolved_credentials,
            configuration_map=external_context.connection_config,
        )

    @classmethod
    def api(cls):
        inputs = {"df_in": pm.Pandas()}
        outputs = {"df_out": pm.Pandas()}
        return inputs, outputs

    def predict(self, df_in):
        payload = {
            "instances": df_in.apply(lambda row: {"features": row.tolist()}, axis=1).tolist()
        }

        # Client is an example and will need to be edited to connect to your external model
        response = self.client.predict(
            ContentType="application/json",
            Body=json.dumps(payload)
        )

        result = response["Body"].read().decode()
        predictions = pd.DataFrame(json.loads(result)["predictions"])
        return predictions
```
