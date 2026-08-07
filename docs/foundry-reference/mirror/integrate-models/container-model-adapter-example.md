<!-- source: https://palantir.com/docs/foundry/integrate-models/container-model-adapter-example/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Example: Implement a container model adapter

The following is an example model adapter defined for a container-backed model. It assumes the image used is a simple flask server listening at the `/mirror` endpoint to take in a request object with "text" as the only field. The model adapter will return that text verbatim in the field "returnedText" with a response object.

You can view the full definition of the `container_context` object in the [API: ModelAdapter reference documentation](/docs/foundry/integrate-models/model-adapter-reference/#containerizedapplicationcontext).

```python
import requests
import json
import pandas as pd

import palantir_models as pm


class ExampleIdentityFunctionModelAdapter(pm.ContainerModelAdapter):
    """
        :display-name: Example Identity Function Model Adapter
        :description: Reference example of a model adapter for container-backed model
    """
    def __init__(self, shared_volume_path, model_host_and_port):
        self.shared_volume_path = shared_volume_path
        self.model_host_and_port = model_host_and_port

    @classmethod
    def init_container(cls, container_context):
        shared_volume_path = container_context.shared_empty_dir_mount_path
        # Note this adapter only expects one container name with one provided service URI.
        model_host_and_port = list(container_context.services.values())[0][0]
        return cls(shared_volume_path, model_host_and_port)

    @classmethod
    def api(cls):
        inputs = {"input_df": pm.Pandas(columns=[("text", str)])}
        outputs = {"output_df": pm.Pandas(columns=[("text", str), ("returnedText", str)])}
        return inputs, outputs

    def predict(self, input_df):
        def run_inference_on_row(row):
            request = {"text": row.text}
            response = requests.post("http://" + self.model_host_and_port + "/mirror", json=request)
            json_res = json.loads(response.content.decode("utf-8"))
            return (row.text, json_res["returnedText"])

        results = [run_inference_on_row(row) for row in input_df.itertuples()]
        columns = ["text", "returnedText"]
        return pd.DataFrame(results, columns=columns)
```
