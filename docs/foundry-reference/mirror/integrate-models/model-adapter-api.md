<!-- source: https://palantir.com/docs/foundry/integrate-models/model-adapter-api/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Model adapter API

The model adapter's `api()` method specifies the expected inputs and outputs in order to execute this model adapter's inference logic. Inputs and outputs are specified separately.

At runtime, the model adapter's `predict()` method is called with the specified inputs.

## Example `api()` implementation

The following example shows an API specifying one input, named `input_dataframe`, and one output, named `output_dataframe`. Both the input and output objects are specified as Pandas dataframes, where the input dataframe has one column of `float` type named `input_feature`, and the output dataframe has two columns: (1) a column named `input_feature` of `float` type and (2) a column named `output_feature` of `int` type.

```python
import palantir_models as pm


class ExampleModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "input_dataframe": pm.Pandas(columns=[("input_feature", float)])
        }
        outputs = {
            "output_dataframe": pm.Pandas(columns=[("input_feature", float), ("prediction", float)])
        }
        return inputs, outputs

    ...
```

The API definition can also be extended to support multiple inputs or outputs of arbitrary types:

```python
import palantir_models as pm


class ExampleModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "input_dataframe": pm.Pandas(columns=[("input_feature", float)]),
            "input_parameter": pm.Parameter(float, default=1.0)
        }
        outputs = {
            "output_dataframe": pm.Pandas(columns=[("input_feature", float), ("prediction", float)])
        }
        return inputs, outputs

    ...
```

## API types

The types of inputs and outputs for the model adapter API can be specified with the following classes, defined in detail below:

* `pm.Pandas`, for Pandas Dataframes (\*)
* `pm.Spark`, for Spark Dataframes (\*)
* `pm.Parameter`, for constant, single-valued parameters
* `pm.FileSystem`, for Foundry Dataset filesystem access
* `pm.MediaReference`, for use with Media References
* `pm.Object`, for use with Ontology Objects
* `pm.ObjectSet`, for use with Onology Object Sets

```python
# The following classes are accessible via `palantir_models` or `pm`

class Pandas:
    def __init__(self, columns: List[Union[str, Tuple[str, type]]]):
        """
        Defines a Pandas Dataframe input or output. Column name and type definitions can be specified as a parameter of this type.
        """

class Spark:
    def __init__(self, columns: List[Union[str, Tuple[str, type]]] = []):
        """
        Defines a Spark Dataframe (pyspark.sql.Dataframe) input or output. Column name and type definitions can be specified as a parameter of this type.
        """

class Parameter:
    def __init__(self, type: type = Any, default = None):
        """
        Defines a constant single-valued parameter input or output. The type of this parameter (default Any) and default value can be specified as parameters of this type.
        """

class FileSystem:
    def __init__(self):
        """
        Defines a FileSystem access input or output object. This type is only usable if the model adapter's `transform()` or `transform_write()` method is called with Foundry Dataset objects.

        If used as an input, the FileSystem representation of the dataset is returned.

        If used as an output, an object containing an `open()` method is used to write files to the output dataset.

        Note that FileSystem outputs are only usable via calling `.transform_write()`.
        """

class MediaReference:
    def __init__(self):
        """
        Defines an input object to be of MediaReference type. This input expects either a stringified JSON representation or a dictionary representation of a media reference object.

        This type is not supported as an API output.
        """

class Object:
    def __init__(self):
        """
        Defines an input object to be of Object type. This input expects either a primary key of the specified Object type, or an instance of the Object type itself.

        This type is not supported as an API output.
        """

class ObjectSet:
    def __init__(self):
        """
        Defines an input object to be of ObjectSet type. This input expects either an object set rid for the specified Object type, or an instance of an ObjectSet itself.

        This type is not supported as an API output.
        """
```

(\*) Review the [requirements described below](#requirements-for-direct-function-publishing-and-model-use-in-functions) on using these types when [publishing the model as a function](/docs/foundry/model-integration/model-functions-guide/).

## Specifying tabular columns

For `Pandas` or `Spark` inputs and outputs, columns can be specified as either a list of `strings` specifying the column name, or a list of two-object `tuples` in the format `(<name>, <type>)` where `<name>` is a string representing the column name and `<type>` is a Python type representing the type of the data in the column. If a string is provided for a column definition, its type will default to `Any`.

### Column types

The following types are supported for tabular columns:

* `str`
* `int`
* `float`
* `bool`
* `list` (\*)
* `dict`(\*)
* `datetime.date`
* `datetime.time`
* `datetime.datetime`
* `typing.Any` (\*)
* `MediaReference`

Column types are generally *not* enforced for batch inference, unlike live inference, and are mostly meant as documentation for consumers of this model adapter. Refer to the model adapter [reference](/docs/foundry/integrate-models/model-adapter-reference/#api-enforcement) for further details on specifications for API enforcement.

(\*) Review the [requirements described below](#requirements-for-direct-function-publishing-and-model-use-in-functions) on using these types when [publishing the model as a function](/docs/foundry/model-integration/model-functions-guide/).

## Parameter types

For `Parameter` inputs and outputs, the following types are supported:

* `str`
* `int`
* `float`
* `bool`
* `list`(\*)
* `dict`(\*)
* `typing.Any`(\*)
* `pm.NDArray`(shape: `list[int]`, dtype: `numpy.typing.DTypeLike`)

Parameter types are enforced, and any parameter input to `model.transform()` that does not correspond to the designated type will throw a runtime error.

(\*) Review the [requirements described below](#requirements-for-direct-function-publishing-and-model-use-in-functions) on using these types when [publishing the model as a function](/docs/foundry/model-integration/model-functions-guide/).

## NDArray Type

[NumPy ndarray ↗](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html) (N-dimensional array) types are supported in the Model API via the `pm.NDArray(shape, dtype)` parameter type definition. You must specify both a shape and dtype for your ndarray input.

### Supported dtypes

The following NumPy dtypes are supported:

* `np.str_`
* `np.bool_`
* `np.int8`
* `np.int16`
* `np.int32`
* `np.int64`
* `np.float16`
* `np.float32`
* `np.float64`

### Shape specification

The shape is specified as a `list[int]` where each element represents a dimension. You can use `-1` in any dimension to indicate that the shape check should be ignored for that specific dimension.

### Example usage

```python
import numpy as np
import palantir_models as pm


class NumpyModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "ndarray_in": pm.Parameter(
                type=pm.NDArray([1, 1, 2], np.int8),
                default=np.array([[[1, -5]]], dtype=np.int8)
            )
        }
        outputs = {
            "ndarray_out": pm.Parameter(type=pm.NDArray([1, 1, 2], np.int8))
        }
        return inputs, outputs

    def predict(self, ndarray_in):
        # Call your model on the ndarray
        return self.model.process(ndarray_in)
```

### Using models with NDArray in transforms

In transforms, you can provide either `np.ndarray` objects or lists representing the ndarray as input:

```python
# Using numpy array directly
ndarray = np.array([[[-95, -63]]], dtype=np.int8)

model_output = model.predict(ndarray_in=ndarray)
type(model_output["ndarray_out"])  # <class 'numpy.ndarray'>

# Using list representation (automatically converted)
model_output = model.transform(ndarray_in=ndarray.tolist())
type(model_output["ndarray_out"])  # <class 'numpy.ndarray'>
```

### Using NDArray in Functions

When using models with NDArray inputs in Functions, you must always provide the input as a JSON-compatible nested list. Note that if the output is an `np.ndarray`, the output will also be returned as a nested list:

```typescript
import { model } from "<...>/models";

@Function()
public async ndarray_model_example(input: Integer[][][]): Promise<Integer[][][]> {
    return await model({
        "ndarray_in": input
    });
}
```

## Object and ObjectSet types

For `Object` or `ObjectSet` inputs, the object type is specified when defining the input in the model adapter API. This object type will be imported from an [Ontology SDK](/docs/foundry/ontology-sdk/python-osdk/) generated for a chosen Ontology:

```python
from ontology_sdk.ontology.objects import ExampleRestaurant


class ExampleModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "input_object": pm.Object(ExampleRestaurant),
            "input_object_set": pm.ObjectSet(ExampleRestaurant)
        }
        outputs = {
            "output_dataframe": pm.Pandas(columns=[("input_feature", float), ("prediction", float)])
        }
        return inputs, outputs

    def predict(self, input_object: ExampleRestaurant, input_object_set: ExampleRestaurantObjectSet):
        outputs = ...
        return outputs
    ...
```

## Example `predict()` implementation

This example uses Pandas dataframes as inputs and outputs, alongside a parameter.

```python
class ExampleModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "input_dataframe": pm.Pandas(columns=[("input_feature", float)]),
            "input_parameter": pm.Parameter(float, default=1.0)
        }
        outputs = {
            "output_dataframe": pm.Pandas(columns=[("input_feature", float), ("prediction", float)])
        }
        return inputs, outputs

    def predict(self, input_dataframe, input_parameter):
        outputs["prediction"] = self.model.predict(input_dataframe) * input_parameter
        return outputs
    ...
```

* For tabular outputs, the list of columns specified in the API should only contain the required columns. At runtime, columns that were not specified in the API that are passed to the dataframes will be available in the predict method's input and can be returned as outputs. In the example above, passing a dataframe with columns `input_feature` and `extra_column` will return a dataframe with columns `input_feature`, `extra_column` and `prediction`.
* Some models require that only columns used during training are passed to their prediction method. Therefore, we recommend only extracting the feature columns to pass to the model.
* Some models require the ordering of columns to be preserved. When inputs are passed via REST API requests as JSON objects, the ordering of columns is not necessarily preserved. Therefore, we recommend reordering the columns before passing them to the model's inference method.

## API definition requirements

### Requirements for Objectives batch deployment

Direct setup of [batch deployment](/docs/foundry/manage-models/set-up-batch/) and [automatic model evaluation](/docs/foundry/evaluate-models/model-evaluation-automatic/) in the Modeling Objectives application is only compatible with models that have a single tabular dataset input. If your model adapter requires several inputs, you can set up batch inference [in a Python transform](/docs/foundry/integrate-models/model-asset-code-repositories/#run-inference-in-python-transforms).

### Requirements for Objectives evaluation

[Evaluation in Modeling Objectives](/docs/foundry/evaluate-models/model-evaluation-automatic/) expects a single tabular input and a single tabular output. Both should include label columns to enable the computation of metrics based on comparing predictions to the ground truth in the evaluation set. The following rules must be kept in mind to ensure that your model adapter is compatible with evaluation:

1. Your API must only include a single tabular input and output.
2. Any label or ground truth columns should not be included in the list of columns of the input or output tables.
   * Since declared column types are enforced during [live inference](/docs/foundry/manage-models/create-a-model-deployment/), this would prevent usage of the model for live inference in cases where the label column is not present.
3. The `predict` method should not drop the label or ground truth columns.
   * If these columns were dropped, the evaluation logic, which runs on the inference output from the `predict` method, would not have the label available for comparison.

As an example, consider the following adapter for a regression task:

```python
import palantir_models as pm
from palantir_models.serializers import DillSerializer

class LinearRegressionModelAdapter(pm.ModelAdapter):

    @pm.auto_serialize(
        model=DillSerializer()
    )
    def __init__(self, model):
        self.model = model

    @classmethod
    def api(cls):
        input_columns = [
            ('median_income', float),
            ('housing_median_age', float),
            ('total_rooms', float),

            # Do not include the target variable explicitly in the API
            # since the adapter logic will throw an error in the live
            # inference case if the label is not found.
            # That will necessarily happen when the model is applied
            # to anything other than training or evaluation sets.

            # ('house_price', float) # should not be included
        ]
        output_columns = columns + [('predicted_house_price', float)]
        return {'df_in': pm.Pandas(input_columns)}, \
               {'df_out': pm.Pandas(output_columns)}

    def predict(self, df_in):
        cols_to_keep = ['median_income', 'housing_median_age', 'total_rooms']
        # If we didn't do this, the next line
        # would implicitly drop the 'house_price' column,
        # which represents the 'label' or target variable,
        # making this adapter unsuitable for use with Evaluation
        # in Modeling Objectives.
        if 'house_price' in df_in.columns:
            cols_to_keep.append('house_price')
        df_in['prediction'] = self.model.predict(
            df_in[cols_to_keep]
        )
        return df_in
```

### Requirements for Direct Function Publishing and Model use in Functions

:::callout{theme="neutral"}
Changing the API of a model with a function published will require an update of the consumers of said function, as described in the [model functions guide](/docs/foundry/model-integration/model-functions-guide/).
:::

For the model [to support being published as a function](/docs/foundry/model-integration/model-functions-guide/), the following must be true:

* The Model API can only contain [Parameter](/docs/foundry/integrate-models/model-adapter-api/#parameter-types), [Tabular](/docs/foundry/integrate-models/model-adapter-api/#specifying-tabular-columns), [Object](/docs/foundry/integrate-models/model-adapter-api/#object-and-objectset-types), or [ObjectSet](/docs/foundry/integrate-models/model-adapter-api/#object-and-objectset-types) inputs.
* The API must not contain the `Typing.Any` type.
* For tabular inputs, the API must specify the required input or output columns. Simply using `pm.Pandas()` or `pm.Spark()` is not allowed as it would be implicitly interpreted a TypeScript `Array<any>`.
* Any collection type such as `list` or `dict` must specify element types (for example, using `list[str]` or `dict[str, str]`). Element types are otherwise interpreted as being of the `any` type.
