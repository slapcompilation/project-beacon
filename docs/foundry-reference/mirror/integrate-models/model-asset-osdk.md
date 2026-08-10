<!-- source: https://palantir.com/docs/foundry/integrate-models/model-asset-osdk/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Integrate models with the Ontology

This section provides examples on how to leverage the [Ontology](/docs/foundry/ontology/overview/) with models using the [Ontology SDK](/docs/foundry/code-workspaces/ontology/) and [Platform SDK](/docs/foundry/dev-toolchain/overview/#platform-sdks).

## Object and object set inputs in model adapters

You can define a model adapter with object and object set inputs in the `api()` class method of a model adapter. After creating an `ontology_sdk`  package through [Developer Console](/docs/foundry/developer-console/create-application/) or [Code Workspaces](/docs/foundry/code-workspaces/ontology/), the objects can be used in the model adapter as inputs:

```python
from ontology_sdk.ontology.objects import Employee
from ontology_sdk.ontology.object_sets import EmployeeObjectSet

class ObjectsInModelApiAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "object_input": pm.Object(Employee),
            "object_set_input": pm.ObjectSet(EmployeeObjectSet)
        }
        outputs = {
            "param_out": pm.Parameter(type=str)
        }
        return inputs, outputs

    def predict(self, object_input, object_set_input):
        ....
```

To pass in an object or object set for testing, you can select inputs from the Ontology on the model query page when a direct model deployment is running. You can also publish a function on the left side-bar using the Ontology object or object set inputs.

![Example Object and Object Set input on the model query page](/docs/resources/foundry/integrate-models/object-model-query-input.png)

## Use the Platform SDK in a model adapter

You can query functions, objects, and LLMs with the [Ontology SDK](/docs/foundry/code-workspaces/ontology/) and [Platform SDK](/docs/foundry/dev-toolchain/overview/#platform-sdks) by using `FoundryClient()` in models through the `predict` or `transform` method of a model.

```python
from ontology_sdk import FoundryClient

class ObjectsInModelApiAdapter(pm.ModelAdapter):
    ....

    def predict(self, employee_primary_key):
        client = FoundryClient()
        client_first_name = client.ontology.objects.Employee.get(employee_primary_key).first_name
        ...
```

This allows for pro-code LLM based workflows where you can interact with the Ontology and utilize traditional modeling techniques to produce more accurate predictions.
