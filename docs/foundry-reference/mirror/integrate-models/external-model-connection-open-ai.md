<!-- source: https://palantir.com/docs/foundry/integrate-models/external-model-connection-open-ai/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Example: Integrate an Open AI model

The below documentation provides an example configuration and model adapter for a custom connection to an Open AI model. Review [the benefits of external model integration](/docs/foundry/integrate-models/external-model-connection/#benefits-of-wrapping-an-externally-hosted-model-in-foundry) to make sure this is the right fit for your use case.

For a step-by-step guide, refer to our documentation on [how to create a model adapter](/docs/foundry/integrate-models/model-adapter-creation/) and [how to create a connection to an externally hosted model](/docs/foundry/integrate-models/external-model-connection/).

## Example Open AI model adapter

To use this example in Foundry, publish and tag a model adapter using the [model adapter library](/docs/foundry/integrate-models/model-adapter-creation/#model-adapter-library-template) in the Code Repositories application.

This model adapter configures a connection to our Azure-hosted instance of Open AI. This was tested with `Python 3.8.17`,  `pandas 1.5.3`, and `openai 1.1.0`. The following five inputs are required to construct an OpenAI client:

* `base_url` - Provided as **base\_url**
* `api_type` - Provided in **connection configuration**
* `api_version` - Provided in **connection configuration**
* `engine` - Provided in **connection configuration**
* `api_key` - Provided as **resolved\_credentials**

```python
import palantir_models as pm
import models_api.models_api_executable as executable_api

from typing import Optional

import openai
import logging

logger = logging.getLogger(__name__)


class OpenAIModelAdapter(pm.ExternalModelAdapter):
  def __init__(self, base_url, api_type, api_version, engine, api_key):
    # Define engine to be used for completions
    self.engine = engine

    # Setup OpenAI Variables
    openai.api_type = api_type
    openai.api_key = api_key
    openai.api_base = base_url
    openai.api_version = api_version

  @classmethod
  def init_external(cls, external_context) -> "pm.ExternalModelAdapter":
    base_url = external_context.base_url
    api_type = external_context.connection_config["api_type"]
    api_version = external_context.connection_config["api_version"]
    engine = external_context.connection_config["engine"]
    api_key = external_context.resolved_credentials["api_key"]
    return cls(
      base_url,
      api_type,
      api_version,
      engine,
      api_key
    )

  @classmethod
  def api(cls):
    inputs = {"df_in": pm.Pandas(columns=[("prompt", str)])}
    outputs = {"df_out": pm.Pandas(columns=[("prompt", str), ("prediction", str)])}
    return inputs, outputs

  def predict(self, df_in):
    predictions = []
    for _, row in df_in.iterrows():
      messages = [{"role": "user", "content": row['prompt']}]
      try:
        response = openai.ChatCompletion.create(
          engine=self.engine,
          messages=messages,
        )
      except openai.error.Timeout as e:
        logger.error(f"OpenAI API request timed out: {e}")
        raise e
      except openai.error.APIError as e:
        logger.error(f"OpenAI API returned an API Error: {e}")
        raise e
      except openai.error.APIConnectionError as e:
        logger.error(f"OpenAI API request failed to connect: {e}")
        raise e
      except openai.error.InvalidRequestError as e:
        logger.error(f"OpenAI API request was invalid: {e}")
        raise e
      except openai.error.AuthenticationError as e:
        logger.error(f"OpenAI API request was not authorized: {e}")
        raise e
      except openai.error.PermissionError as e:
        logger.error(f"OpenAI API request was not permitted: {e}")
        raise e
      except openai.error.RateLimitError as e:
        logger.error(f"OpenAI API request exceeded rate limit: {e}")
        raise e
      predictions.append(response.choices[0].message.content)
    df_in['prediction'] = predictions
    return df_in
```

## Open AI model configuration

Next, [configure an externally hosted model](/docs/foundry/integrate-models/external-model-connection/) to use this model adapter and provide the required configuration and credentials as expected by the model adapter.

Note that the URL and the configuration and credentials maps are completed using the same keys as defined in the model adapter.

### Select an egress policy

The example below uses an egress policy that has been configured for `api.llm.palantir.tech` (Port 443).

![Egress Policy Open AI in the modeling objectives application](/docs/resources/foundry/integrate-models/external-open-ai-egress-configuration.png)

### Configure model adapter

Choose the published model adapter in the **Connect an externally hosted model** dialog.

![Model Adapter configuration panel for Open AI in Palantir Foundry](/docs/resources/foundry/integrate-models/external-open-ai-adapter-configuration.png)

### Configure URL and connection configuration

Define connection configurations as required by the [example Open AI model adapter](#example-open-ai-model-adapter).

This adapter requires a URL of: `https://api.llm.palantir.tech/preview`

This adapter requires connection configuration of the following:

* **api\_type** - The Open AI model type to run inference against.
* **api\_version** - The API version to use.
* **engine** - The model engine to use.

![Connection configuration panel for Open AI.](/docs/resources/foundry/integrate-models/external-open-ai-connection-configuration.png)

### Configure credential configuration

Define credential configurations as required by the [example Open AI model adapter](#example-open-ai-model-adapter).

This adapter requires credential configuration of the following:

* **api\_key** - The secret key needed to query Open AI.

![Credentials configuration panel for Open AI.](/docs/resources/foundry/integrate-models/external-open-ai-credentials-configuration.png)

## Open AI model usage

Now that the Open AI model has been configured, this model can be hosted in a [live deployment](/docs/foundry/manage-models/set-up-live/) or [Python transform](/docs/foundry/transforms-python/overview/).

The below image shows an example query made to the Open AI model in a live deployment.

![Example query using OpenAIAdapter](/docs/resources/foundry/integrate-models/external-open-ai-example-query.png)
