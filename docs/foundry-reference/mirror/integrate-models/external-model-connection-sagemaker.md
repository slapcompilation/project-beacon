<!-- source: https://palantir.com/docs/foundry/integrate-models/external-model-connection-sagemaker/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Example: Integrate an Amazon SageMaker model

The below documentation provides an example configuration and model adapter for a custom connection to a model hosted in Amazon SageMaker. Review [the benefits of external model integration](/docs/foundry/integrate-models/external-model-connection/#benefits-of-wrapping-an-externally-hosted-model-in-foundry) to make sure this is the right fit for your use case.

For a step-by-step guide, refer to the documentation on [how to create a model adapter](/docs/foundry/integrate-models/model-adapter-creation/) and [how to create a connection to an externally hosted model](/docs/foundry/integrate-models/external-model-connection/).

## Example Amazon SageMaker tabular model adapter

First, [publish and tag a model adapter](/docs/foundry/integrate-models/model-adapter-creation/#model-adapter-library-template) using the model adapter library in the Code Repositories application. The below model adapter configures a connection to a model hosted in Amazon SageMaker using the [AWS SDK for Python (Boto3) ↗](https://aws.amazon.com/sdk-for-python/) and framework. The below code was tested with versions `Python 3.8.17`, `boto3 1.28.1` and `pandas 1.5.3`.

Note that this model adapter makes the following assumptions:

* This model adapter assumes that data being provided to this model is tabular.
* This model adapter will serialize the input data to JSON and send this data to the hosted Amazon SageMaker model.
* This model adapter assumes that the response is deserializable from JSON to a pandas dataframe
* This model adapter takes four inputs to construct a Boto3 client.
  * `region_name` - Provided as **connection configuration**
  * `endpoint_name` - Provided as **connection configuration**
  * `access_key_id` - Provided as **credentials**
  * `secret_access_key` - Provided as **credentials**

```python
import palantir_models as pm
import models_api.models_api_executable as executable_api

import boto3
import json
import pandas as pd
import logging
from typing import Optional
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class SageMakerTabularAdapter(pm.ExternalModelAdapter):
    """
    :display-name: SageMaker Tabular Model Adapter
    :description: Default model adapter for SageMaker models that expect tabular input and output tabular data.
    """

    def __init__(self, region_name, endpoint_name, access_key_id, secret_access_key):
        self.endpoint_name = endpoint_name
        self.runtime = boto3.client(
            'runtime.sagemaker',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region_name
        )

    @classmethod
    def init_external(cls, external_context) -> "pm.ExternalModelAdapter":
        region_name = external_context.connection_config["region_name"]
        endpoint_name = external_context.connection_config["endpoint_name"]
        access_key_id = external_context.resolved_credentials["access_key_id"]
        secret_access_key = external_context.resolved_credentials["secret_access_key"]
        return cls(
            region_name,
            endpoint_name,
            access_key_id,
            secret_access_key
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
        try:
            response = self.runtime.invoke_endpoint(
                EndpointName=self.endpoint_name,
                ContentType="application/json",
                Body=json.dumps(payload)
            )
        except ClientError as error:
            logger.error("SageMaker inference call failed. This can indicate an error with this Model's egress "
                         "policy. Double check your configured egress policy and ensure the remote endpoint is still "
                         "available.")
            raise error
        try:
            # Output from model is assumed to be json serializable
            # if result is too large for executor this deserialization may cause an OOM
            result = json.loads(response['Body'].read().decode())
        except ValueError as error:
            logger.error("This SageMakerTabularAdapter expects results to be json serializable.")
            raise error
        return pd.json_normalize(result)
```

## Amazon SageMaker tabular model configuration

Next, [configure an externally hosted model](/docs/foundry/integrate-models/external-model-connection/) to use this model adapter and provide the required configuration and credentials as expected by the model adapter. In this example, the model is assumed to be hosted in `us-east-1`, but this is configurable.

Note that the URL is not required by the above `SageMakerTabularAdapter` and so is left blank; however, the configuration and credentials maps are completed using the same keys as defined in the Model Adapter.

### Select an egress policy

The below uses an egress policy that has been configured for `runtime.sagemaker.us-east-1.amazonaws.com` (Port 443).

![Egress Policy Amazon SageMaker in the modeling objectives application](/docs/resources/foundry/integrate-models/external-sagemaker-egress-configuration.png)

### Configure model adapter

Choose the published model adapter in the **Connect an externally hosted model** dialog.

![Model Adapter configuration panel for Amazon SageMaker in Palantir Foundry](/docs/resources/foundry/integrate-models/external-sagemaker-adapter-configuration.png)

### Configure connection configuration

Define connection configurations as required by the [example Amazon SageMaker tabular model adapter](#example-amazon-sagemaker-tabular-model-adapter).

This adapter requires connection configuration of:

* **region\_name** - The AWS region name where the model is hosted.
* **endpoint\_name** - The unique identifier for the externally hosted model.

![Connection configuration panel for Amazon SageMaker in Palantir Foundry](/docs/resources/foundry/integrate-models/external-sagemaker-connection-configuration.png)

### Configure credential configuration

Define credential configurations as required by the [example Amazon SageMaker tabular model adapter](#example-amazon-sagemaker-tabular-model-adapter).

This adapter requires credential configuration of:

* **access\_key\_id** - This is the unique identifier for the user whose credentials will call the SageMaker model.
* **secret\_access\_key** - This is the secret key for the user whose credentials will call the SageMaker model.

![Credentials configuration panel for Amazon SageMaker in Palantir Foundry](/docs/resources/foundry/integrate-models/external-sagemaker-credentials-configuration.png)

## Amazon SageMaker tabular model usage

Now that the Amazon SageMaker model has been configured, this model can be hosted in a [live deployment](/docs/foundry/manage-models/set-up-live/) or [Python transform](/docs/foundry/transforms-python/overview/).

The below image shows an example query made to the Amazon SageMaker model in a live deployment.

![Example query using SageMakerTabularAdapter](/docs/resources/foundry/integrate-models/external-sagemaker-example-query.png)
