<!-- source: https://palantir.com/docs/foundry/integrate-models/model-adapter-reference/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# API: ModelAdapter reference

A [model adapter](/docs/foundry/integrate-models/model-adapter-overview/) is a published Python library that provides the communication layer between Foundry and stored model artifacts to enable Foundry to load, initialize, and run inference on any model.

To implement a `ModelAdapter`, you must understand the classes listed below:

## ModelAdapter implementation

The `ModelAdapter` class is an abstract base class that all model adapter implementations must extend. There are four abstract methods that all model adapters must implement:

1. `load()`
2. `save()`
   * Note that `load()` and `save()` are not required for model adapters defined with [default serializers](/docs/foundry/integrate-models/serialization/#auto-serialization).
3. `api()`
4. `predict()` for single-output, and `run_inference()` for multi-output

```python
import palantir_models as pm
import models_api.models_api_executable as executable_api

class ExampleModelAdapter(pm.ModelAdapter):

    @classmethod
    def load(
        cls,
        state_reader: pm.ModelStateReader,
        container_context: Optional[executable_api.ContainerizedApplicationContext] = None,
        external_model_context: Optional[executable_api.ExternalModelExecutionContext] = None
    ) -> "pm.ModelAdapter":
        """
        Python or binary models:
            This is the method that Foundry will call to deserialize your ModelAdapter. The author of this ModelAdapter is expected to write logic to load the state of their trained model(s) from the same location that the model was saved/serialized to in the save method, and also initialize the model.

        Container models:
            This is the method that Foundry will call after your container has been launched as a sidecar to this ModelAdapter. The author of this ModelAdapter is expected to use the contents of the container_context to initialize any class variables the adapter might need. For example, users will often extract the relevant service URIs to send POST requests to the container within #run_inference.

        Externally hosted models:
            This is the method that Foundry will call when your model adapter is initialized. The author of this ModelAdapter is expected to write logic to initialize and persist a connection to their externally hosted model as well as other required model configuration.


        :param state_reader: A ModelStateReader object that can be used to read model files.
        :param container_context: This is only provided for container backed models, and defaults to None. The container context
          includes a mapping from container name to service URIs and the shared directory mount path.
        :param external_model_context: This is only provided for externally hosted models, and defaults to None. The external_model_context includes references to the configuration a user defines when creating an externally hosted model that uses this Model Adapter.

        :return: An instance of a ModelAdapter.
        """

    def save(self, state_writer: pm.ModelStateWriter) -> None:
        """
        This is the method that Foundry will call to serialize your model adapter. This method is only required if this ModelAdapter is being used to wrap a newly trained or refit model in Foundry.

        The author of this ModelAdapter is expected to write logic to save the state of their trained model(s) and relevant metadata to a ModelStateWriter.

        :param state_writer: The ModelStateWriter object to which the model is serialized and saved.
        """

    @classmethod
    def api(cls) -> pm.ModelApi:
        """
        This defines the expected input and output data structures of this model.

        :return: The ModelApi object for the model
        """

    def run_inference(self, inputs, outputs) -> None:
        """
        This method will be called with the relevant input and outputs defined in the ModelAdapter.api method.

        Runs inference on the associated model.

        :param inputs: A namedtuple of the inputs defined in the ModelAdapter.api method.
        :param outputs: A namedtuple of the outputs defined in the ModelAdapter.api method.
          Outputs should be written to in the run_inference method.
        """

    def predict(self, *args, **kwargs) -> Union[Tabular, Parameter]:
        """
        This method is used to perform inference on a multi (>=1) input to single output (tabular or parameter) model.
        The inputs are expected to be written into the signature of this method by the name that defines them in the api() method. The resulting output is returned by this method.

        Note that the run_inference() method is not defined by the user if predict() is used.
        """
```

## Model `save()` and `load()`

The `palantir_models.serializers` library provides many [default serializers](/docs/foundry/integrate-models/serialization/#auto-serialization) that can be used for model serialization (save) and deserialization (load) for common modeling frameworks.

In some cases, users may want to implement custom logic for model serialization or deserialization. This may be necessary when, for example, there is no default serializer available for a modeling framework you are using or when you require manual control over which models are loaded into memory at any given time.

In these more complex cases, please see the implementation of [save](#save) and [load](#load) below.

## `Save`

### ModelStateWriter

A **ModelStateWriter** is provided to the `ModelAdapter.save` method so a `ModelAdapter` can save/serialize model artifacts to Foundry storage.

```python
# ModelStateWriter can be imported from palantir_models.models

from io import IOBase
from typing import ContextManager

class ModelStateWriter:
    def open(self, asset_file_path: str, mode: str = "wb") -> ContextManager[IOBase]:
        """
        Open a file-like object to serialize model artifacts and parameters.
        """

    def put_file(self, local_file_path, asset_file_path=None):
        """
        Put a local file in this model's repository.
        :param asset_file_path: If provided, the file will be placed at this path in the repository.
            Otherwise the file will be placed in the root directory of the repository.
        """

    def put_directory(self, local_root_path, asset_root_path = "/"):
        """
        Put a local directory and its contents into this model's repository.
        :param asset_root_path: The path relative to the root path of the repository to place this directory.
        """
```

The `save()` method is called whenever a model adapter is published in a transform via `model.publish()`, upon which the ModelStateWriter's contents are packaged into a zip file that is persisted in an artifacts repository referenced by the newly-created model version.

### Example: ModelStateWriter

The following example saves a model as a `model.pkl` file.

```python
from palantir_models.models import ModelAdapter, ModelStateWriter

class ExampleModelAdapter(ModelAdapter):
    def __init__(self, model):
        self.model = model

    ...

    def save(self, state_writer: ModelStateWriter):
        with state_writer.open("model.pkl", "wb") as model_outfile:
            pickle.dump(self.model, model_outfile)

    ...
```

## `Load`

### ModelStateReader

A **ModelStateReader** is provided to the `ModelAdapter.load` method so a `ModelAdapter` can read/deserialize saved model artifacts and initialize a model.

```python
# ModelStateReader can be imported from palantir_models.models
from tempfile import TemporaryDirectory

class ModelStateReader:
    def open(self, asset_file_path: str, mode: str = "rb") -> ContextManager[IOBase]:
        """
        Open a file-like object to deserialize model artifacts and parameters.
        """

    def extract_to_temp_dir(self, root_dir: str = None) -> AnyStr:
        """
        Returns a TempDirectory containing the model artifacts associated with this model.
        :param root_dir: If specified, the root directory to extract
        """

    def extract(self, destination_path: str = None) -> None:
        """
        Extracts the repository to the provided local directory path.
        :param destination_path: If specified, the directory where the repository will be extracted
        """
```

The `load()` method is called whenever a model adapter is instantiated (via `ModelInput` in a transform, or launching a live or batch deployment that is backed by a model). This method then accesses the same artifacts repository that `ModelStateWriter` writes to, and provides access to its contents via `ModelStateReader`. `load()` is called before any transforms or inference logic is executed.

### Example: ModelStateReader

The following example loads a model file and returns and instance of the model adapter initialized with it.

```python
from palantir_models.models import ModelAdapter, ModelStateReader

class ExampleModelAdapter(ModelAdapter):
    def __init__(self, model):
        self.model = model

    @classmethod
    def load(cls, state_reader: ModelStateReader):
        with state_reader.open("model.pkl", "rb") as model_infile:
            model = pickle.load(model_infile)
        return cls(model)

    ...
```

When used in conjunction with the `save()` method shown above, this method would retrieve the same `model.pkl` object that was persisted in the `save()` method. A `ModelStateReader` object is also provided to containerized models, and is backed by the user's uploaded zip file.

### ContainerizedApplicationContext

The **ContainerizedApplicationContext** is optional and will be provided to the `ModelAdapter.load` method if, and only if, the model is backed by a container image or images. The context object includes a shared directory mount path and a mapping from container name to their service URIs. Each container can have multiple service URIs as it is valid to have multiple open ports.

```python
# Note that this class type does not need to be imported within an authored adapter
class ContainerizedApplicationContext:
    def services(self) -> Dict[str, List[str]]:
        """
        Mapping from individual container name to list of service URIs the container provides.
        """

    def shared_empty_dir_mount_path(self) -> str:
        """
        The mount path of a shared empty directory that is available inside all containers and to the model adapter.
        The directory is readable and writable by containers and by the model entrypoint.
        """
```

An example populated services variable might look like the following:

```python
{
    "container1": ["localhost:8080"],
    "container2": ["localhost:8080", "localhost:8081"],
}
```

### Example: ContainerizedApplicationContext

The following example initializes a model adapter with a specific volume path, host, and port from the provided ContainerizedApplicationContext.

```python
from palantir_models.models import ModelAdapter, ModelStateReader
import models_api.models_api_executable as executable_api

class ExampleModelAdapter(ModelAdapter):
    def __init__(self, shared_volume_path, model_host_and_port):
        self.shared_volume_path = shared_volume_path
        self.model_host_and_port = model_host_and_port

    @classmethod
    def load(cls, state_reader, container_context: executable_api.ContainerizedApplicationContext):
        shared_volume_path = container_context.shared_empty_dir_mount_path
        model_host_and_port = container_context.services["container1"][0]
        return cls(shared_volume_path, model_host_and_port)

    ...
```

### ExternalModelContext

The **ExternalModelContext** is optional and will be provided to the `ModelAdapter.load` method if, and only if, the model is an externally hosted model. The context object contains an object representing the externally hosted model along with the user-defined map of decrypted secrets needed to connect to this externally hosted model.

```python
# Note that this class type does not need to be imported within an authored adapter
class ExternalModelContext:
    def external_model(self) -> models_api_external_ExternalModel:
        """
        Object representing the externally hosted model notably contains the base_url and connection_configuration.
        """

    def resolved_credentials(self) -> Dict[str, str]:
        """
        Mapping of user-defined decrypted secret values needed to connect with this externally hosted model.
        """

# Note that this class type does not need to be imported within an authored adapter
class models_api_external_ExternalModel:
    def base_url(self) -> str:
        """
        User-defined url representing where this externally hosted model is hosted.
        """

    def connection_configuration(self) -> Dict[str, str]:
        """
        User-defined dictionary of unencrypted configuration fields.
        This is intended to store specific configuration details such as the model name, inference parameters, or prediction thresholds.
        """


```

### Example: ExternalApplicationContext

The following example initializes a model adapter that executes requests to an externally hosted model. For more information on working with externally hosted models, [read the documentation](/docs/foundry/integrate-models/external-model-connection/).

```python
from palantir_models.models import ModelAdapter, ModelStateReader
import models_api.models_api_executable as executable_api

class ExampleModelAdapter(ModelAdapter):
    def __init__(self, url, credentials_map, configuration_map):
        # Extract model configuration from "Connection configuration" map
        model_name = configuration_map['model_name']
        model_parameter = configuration_map['model_parameter']

        # Extract model credentials from "Credentials configuration" map
        secret_key = credentials_map['secret_key']

        # Initiate http client at model load time
        self.client = ExampleClient(url, model_name, model_parameter, secret_key)

    @classmethod
    def load(
            cls,
            state_reader: ModelStateReader,
            container_context: Optional[executable_api.ContainerizedApplicationContext] = None,
            external_model_context: Optional[executable_api.ExternalModelExecutionContext] = None,
            ) -> "ModelAdapter":
        return cls(
            url=external_model_context.external_model.base_url,
            credentials_map=external_model_context.resolved_credentials,
            configuration_map=external_model_context.external_model.connection_configuration,
        )

    ...
```

## Model API

The model adapter's `api()` method specifies the expected inputs and outputs in order to execute this model adapter's inference logic. Inputs and outputs are specified separately.

### Example `api()`

```python
import palantir_models as pm

class ExampleModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "df_in": pm.Pandas([('input_feature', float)])
        }
        outputs = {
            "df_out": pm.Pandas([('output_feature', int)])
        }
        return inputs, outputs

    ...
```

### Model inputs

The **ModelInput** type contains input types that can be defined in the `ModelAdapter.api` method. Model adapters support the following input types:

1. Tabular
2. Parameter
3. FileSystem
4. MediaReference
5. Object
6. ObjectSet

```python
# DFType, and ModelInput can be imported from palantir_models.models.api

class ModelInput:
    Tabular = TabularInput
    FileSystem = FileSystemInput
    Parameter = ParameterInput
    MediaReference = MediaReferenceInput

class TabularInput:
    def __init__(self, name: str, df_type: DFType = DFType.SPARK, columns: List[ModelApiColumn]):
        """
        Used to specify that a ModelAdapter expects a tabular input.
        This input type will then convert the tabular input to the type specified in `df_type` if applicable.
        Pandas dataframes, Spark dataframes, and TransformInputs are accepted as tabular input types.
        """

class ParameterInput:
    def __init__(self, name: str, type: type, default = None):
        """
        Used to specify that a ModelAdapter expects a constant value parameter of type 'type'.
        The available types for parameter inputs are: str, int, float, bool, list, dict.
        If not passed directly in the args to .transform(), the provided default value will be used.
        """

class FileSystemInput:
    def __init__(self, name: str):
        """
        Used to specify that a ModelAdapter expects a filesystem input.
        """

class MediaReferenceInput:
    def __init__(self, name: str):
        """
        Used to specify that a ModelAdapter expects a Media Reference as an input.
        """

class ObjectInput:
    def __init__(self, object_type: OntologyObject):
        """
        Used to specify that a ModelAdapter expects a Python OSDK Object as an input.
        """

class ObjectSetInput:
    def __init__(self, object_type: OntologyObject):
        """
        Used to specify that a ModelAdapter expects a Python OSDK ObjectSet as an input.
        """

class DFType(Enum):
    SPARK = "spark"
    PANDAS = "pandas"

class ModelApiColumn(NamedTuple):
    """
    Used to specify the name and type of columns of a tabular input.
    """
    name: str
    type: type
    required: bool = True

```

### Tabular inputs

A `TabularInput` is used to specify that an input provided to `model.transform()` is expected to be of a tabular type. In the context of this model adapter's inference logic, the type of this input will be the `df_type` parameter as specified in the `api()` method. Appropriate type conversions, if necessary, will be performed. The following tabular types are permissible:

1. TransformInput
2. Pandas DataFrame
3. Spark DataFrame
   * Note: Spark DataFrames are only supported for tabular inputs in the adapter API which specify `df_type=DFType.SPARK`. Conversion for tabular inputs specifying `DFType.PANDAS` is not supported for Spark DataFrames.

#### Column types

TabularInputs also specify a list of `ModelApiColumn`s which describe the expected column schema of the tabular input. The `type` parameter can be one of the following:

1. `str`
2. `int`
3. `float`
4. `bool`
5. `list`
6. `dict`
7. `datetime.date`
8. `datetime.time`
9. `datetime.datetime`
10. `typing.Any`
11. `MediaReference`

The `List` and `Dict` type aliases from the `typing` library are also accepted. Some examples are as follows:
`List[str]`; `Dict[str, float]`. Review the [specific requirements](/docs/foundry/integrate-models/model-adapter-api/#requirements-for-direct-function-publishing-and-model-use-in-functions) on using these types when [publishing the model as a function](/docs/foundry/model-integration/model-functions-guide/).

### Parameter inputs

A `ParameterInput` is used to specify that an input provided to `model.transform()` is expected to be of a parameter type. Parameters are constant-valued inputs of a type specified with the `type` parameter. The following types are accepted for parameter inputs:

1. `str`
2. `int`
3. `float`
4. `bool`
5. `list` (\*)
6. `dict` (\*)
7. `typing.Any` (\*)
8. `palantir_models.NDArray` for [NumPy n-dimensional arrays](/docs/foundry/integrate-models/model-adapter-api/#ndarray-type)

Parameter inputs can also specify a `default` value for when an input to `model.transform()` corresponding to the parameter input defined in the model adapter's `api()` method is not provided.

:::callout{theme="neutral"}
Review the [specific requirements](/docs/foundry/integrate-models/model-adapter-api/#requirements-for-direct-function-publishing-and-model-use-in-functions) on using these types when [publishing the model as a function](/docs/foundry/model-integration/model-functions-guide/).
:::

### FileSystem inputs

A `FileSystemInput` is used to specify that an input provided to `model.transform()` is expected to be of a filesystem type. Only TransformInputs are supported as input types for `FileSystemInput`.

### MediaReference inputs

A `MediaReferenceInput` is used to specify that an input provided to `model.transform()` is expected to be a media reference. Media references are expected to be of `str` type and contain the full media reference object definition. The model adapter will convert this media reference string to a `MediaReference` object which contains methods to interact with the media item being referenced.

### Object and ObjectSet inputs

For `Object` or `ObjectSet` inputs, the object type is specified when defining the input in the model adapter API. This object type will be imported from an [Ontology SDK](/docs/foundry/ontology-sdk/python-osdk/) generated for a chosen Ontology.

When performing model inference, the object or object set can be passed to the model in the following ways:

### API enforcement

As a general principle, the model adapter API is not strictly enforced at inference time, although enforcement is generally stricter for [live inference](/docs/foundry/manage-models/create-a-model-deployment/) and particularly for [Functions](/docs/foundry/model-integration/model-functions-guide/), which are strongly typed.

Parameter types are always enforced, and any parameter input to `model.transform()` that does not correspond to the designated type will throw an error.

The model adapter allows additional columns that are not specified in the API to be passed within a tabular input at inference time. Foundry will not drop additional columns from the input before passing it to the `predict` method. This is important for ensuring model adapters work with evaluation, as [described in the Model Adapter API guide](/docs/foundry/integrate-models/model-adapter-api/#requirements-for-objectives-evaluation). In the batch inference case, the adapter will not throw an error if some columns specified in the API are missing. The `MediaReference` type is an exception. It expects each element in the column to be a media reference string. During batch inference, it will convert each element to a `MediaReference` object before being passed to this model adapter's inference logic both for batch and live inference.

In the live inference case, however, model inputs will be cast to their declared type (if defined) to ensure type safety. This is true of any columns in tabular inputs. A side-effect of this behavior is that an error will be thrown if a column with a specified type is not found in the input data, or if the data cannot be cast to the specified type.

#### For Object Inputs

1. An instance of the OntologyObject type specified in the model adapter API's Object input.
2. A primary key of the specified object type.

#### For ObjectSet Inputs

1. An instance of and ObjectSet for the OntologyObject type specified in the model adapter API's ObjectSet input.
2. An object set rid for the specified object type.

### Model outputs

A **ModelOutput** contains the output types defined in the `ModelAdapter.api` method.

```python
# ModelOutput can be imported from palantir_models.models.api

class ModelOutput:
    FileSystem = FileSystemOutput
    Parameter = ParameterOutput

class TabularOutput:
    def __init__(self, name: str):
        """
        Used to specify that a ModelAdapter will produce a tabular output.
        Only Pandas or Spark dataframes are supported as tabular output types.
        """

class ParameterOutput:
    def __init__(self, name: str, type: type, default = None):
        """
        Used to specify that a ModelAdapter will produce a constant value parameter of type 'type'.
        The available types for parameter outputs are: str, int, float, bool, list, dict.
        If not written to via `run_inference()`, the provided default value will be used.
        """
```

Both of the available model outputs act similarly to their input counterparts. One primary difference is that `TabularOutput` does *not* have a `df_type` parameter. It is able to accept both Pandas and Spark dataframes.

## Model inference

### The `predict()` method

For models with a single output of tabular or parameter type, the `predict()` method can be used instead of the `run_inference()` method to define the inference logic of the model adapter. The arguments of this method will be the names of the input objects defined in the model adapter's `api()` method. It is not required that the arguments retain the same order as they are defined, however the names must match.

### `predict()` method example

The following example defines a `predict()` method for a multi-tabular-input, single-tabular-output model adapter.

```python
import palantir_models as pm

class ExampleModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {"input_1": pm.Pandas(), "input_2": pm.Pandas()}
        outputs = {"output_dataframe": pm.Pandas()}
        return inputs, outputs

    def predict(self, input_1, input_2):
        resulting_dataframe = ... # Some inference logic using input_1 and input_2
        return resulting_dataframe
```

In the above example, the two inputs (`input_1` and `input_2`) are referenced by name in the signature of the `predict()` method. The dataframe that the function returns, `resulting_dataframe`, will be written to the single output named `output_dataframe`.

### The `run_inference()` method

In the case of multi-output models, or models that write to filesystems, custom inference logic must be defined via the `run_inference()` method. This method takes two arguments: `inputs` and `outputs`. Both of these arguments are `NamedTuples` whose names correspond to the `name` parameters of the inputs and outputs defined in the `api()` method.

### Inputs

Referencing an input by name will access the object that was passed in to `model.transform()` corresponding to the `api()` input of the same name.

### Example: Input

Given the following `ModelAdapter` definition:

```python
from palantir_models as pm

class ExampleModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "df_in": pm.Pandas([("input_feature", float)])
        }
        outputs = {
            "df_out_one": pm.Pandas([("feature_one", int)]),
            "df_out_two": pm.Pandas([("output_feature_1", int),
                                     ("output_feature_2", float)])
        }
        return inputs, outputs

    def run_inference(self, inputs, outputs):
        my_input_df = inputs.df_in

        my_output_one = outputs.df_out_one
        my_output_two = outputs.df_out_two

    ...
```

And the following call to `.transform()`:

```python
@transform(
    my_input_data=Input(...),
    my_output_data_one=Output(...),
    my_output_data_two=Output(...),
    my_model=ModelInput(...)
)
def compute(my_input_data, my_output_data_one, my_output_data_two, my_model):
    my_model_outputs = my_model.transform(my_input_data)
```

The `my_input_df` object in the model adapter's `run_inference()` method, being a reference to the input named `"input_dataframe"` which is a tabular input of Pandas type, will be equal to a pandas representation of the `my_input_data` TransformInput that is passed in from the transform.

### Outputs

Referencing an output by name will provide a writable object corresponding to the `api()` output of the same name. Each of these objects has a `.write()` method to specify which data will be written to each output.

### Example: Output

Given the following `ModelAdapter` definition:

```python
from palantir_models as pm

class ExampleModelAdapter(pm.ModelAdapter):
    ...

    @classmethod
    def api(cls):
        inputs = {
            "input_dataframe": pm.Pandas([('input_feature', float)])
        }
        outputs = {
            "output_dataframe_one": pm.Pandas([('output_feature', int)]),
            "output_dataframe_two": pm.Pandas([('output_feature', int)]),
        }
        return inputs, outputs

    def run_inference(self, inputs, outputs):
        my_input_df = inputs.input_dataframe
        my_output_dataframe_one = do_something_to_input_and_return_a_new_dataframe(my_input_df)
        my_output_dataframe_two = do_something_else_to_input_and_return_a_new_dataframe(my_input_df)
        outputs.output_dataframe_one.write(my_output_dataframe_one)
        outputs.output_dataframe_two.write(my_output_dataframe_two)

    ...
```

And the following call to `.transform()`:

```python
@transform(
    my_input_data=Input(...),
    my_output_data_one=Output(...),
    my_output_data_two=Output(...),
    my_model=ModelInput(...)
)
def compute(my_input_data, my_output_data_one, my_output_data_two, my_model):
    my_model_outputs = my_model.transform(my_input_data)
    my_output_dataframe_one = my_model_outputs.output_dataframe_one
    my_output_dataframe_two = my_model_outputs.output_dataframe_two
    my_output_data_one.write_pandas(my_output_dataframe_one)
    my_output_data_two.write_pandas(my_output_dataframe_two)
```

The `my_output_dataframe_one` and `my_output_dataframe_two` objects in the transform will be equal to the object that was written to the `output_dataframe_one` and `output_dataframe_two` outputs in the model adapter's `run_inference()` method (in this case, `my_output_dataframe_one` and `my_output_dataframe_two`).

## Media references

Information on media references in Foundry can be found [here](/docs/foundry/media-sets-advanced-formats/media-overview/#media-references).

In the case that parameter inputs or tabular input columns of type `MediaReference` are specified in the model adapter's `api()`, media reference strings that are provided via `model.transform()` will be converted to `MediaReference` objects. This object type provides methods to interact with the media reference.

```python
class MediaReference:
    @property
    def media_reference(self):
        """
        The raw media reference string.
        """

    @property
    def media_item_rid(self):
        """
        The media item rid extracted from the media reference.
        """

    def get_media_item(self):
        """
        Returns the media item as a file-like object.
        """

    def get_media_item_via_access_pattern(self, access_pattern_name, access_pattern_path):
        """
        Returns the access pattern of the media item as a file-like object.
        Depending on the media set's persistence policy, this may cache the access pattern once calculated.
        """

    def transform_media_item(self, output_path, transformation):
        """
        Applies the transform to the media item and returns it as a file-like object.
        The output_path will be provided to the transformation.
        The transformation computation will be done by Mio, not by this Spark module.
        """

    def get_media_item_metadata(self):
        """
        Returns the media item metadata (width, height, etc.)
        """

    def transform_and_wait(self, transformation, output_path="", poll_interval_seconds=3.0, poll_timeout_seconds=30.0):
        """
        Applies the transformation and polls the media service until the result is ready.
        Raises a TimeoutError if the transformation does not complete within poll_timeout_seconds.
        """

    def transformation_calculation_hint(self, transformation, output_paths):
        """
        Pre-warms the transformation for the given output paths so that subsequent transform_and_wait calls hit a warm or cached calculation.
        """
```

### Example: MediaReference adapter

The following example defines a model adapter that accepts a tabular input with a `MediaReference` column, reads each referenced media item, and runs inference on its contents. During batch inference, each element of the column is converted to a `MediaReference` object before being passed to the adapter's inference logic.

```python
import palantir_models as pm

class ImageClassifierAdapter(pm.ModelAdapter):
    # The load() and save() methods are omitted for brevity.

    @classmethod
    def api(cls):
        inputs = {
            "df_in": pm.Pandas(columns=[("image", pm.MediaReference)])
        }
        outputs = {
            "df_out": pm.Pandas(columns=[("prediction", str)])
        }
        return inputs, outputs

    def predict(self, df_in):
        predictions = []
        for media_reference in df_in["image"]:
            with media_reference.get_media_item() as media_item:
                predictions.append(self.model.classify(media_item.read()))
        df_in["prediction"] = predictions
        return df_in
```
