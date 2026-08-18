<!-- source: https://palantir.com/docs/foundry/integrate-models/auto-serialization-reference/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# API: `palantir_models.serializers` reference

The `palantir_models.serializers` library provides many [default serialization](/docs/foundry/integrate-models/serialization/#auto-serialization) methods for saving and loading models that are trained inside Foundry; most models should be able to use one of the default model serializers.

## How to write a model serializer

In some cases it can be useful to create a reusable `auto_serializer`, for example, if your organization has a model format that is reused and often integrated into Foundry as models then creating a reusable `auto_serializer` can standardize and reduce duplicated code across different models and teams.

To create an `auto_serializer`, you should extend the `palantir_models.models._serialization.ModelSerializer` base class and implement the `__init__`, `serialize`, and `deserialize` methods.

* The `__init__` method is the constructor that a consumer of your serializer will interact with.
* The `serialize` method will be provided with the object that you should serialize to the [`palantir_models.models._state_accessors.ModelStateWriter`](/docs/foundry/integrate-models/model-adapter-reference/#modelstatewriter).
* The `deserialize` method will be called at model load time and allows you to reinstantiate and return the serialized model from the provided [`palantir_models.models._state_accessors.ModelStateReader`](/docs/foundry/integrate-models/model-adapter-reference/#modelstatereader).

Your `auto_serializer` should be published as a [shared Python library](/docs/foundry/transforms-python/share-python-libraries/).

## Implementation of provided serializers

For reference, we provide implementations of existing default serializers in `palantir_models.serializers`.

### palantir\_models.serializers.CloudPickleSerializer

```python
import importlib
from types import ModuleType
from palantir_models.models._serialization import ModelSerializer
from palantir_models.models._state_accessors import ModelStateWriter, ModelStateReader


class CloudPickleSerializer(ModelSerializer[object]):
    """Serializer utilizing the cloudpickle library for generic objects"""

    file_name = "cloudpickle.pkl"
    cloudpickle: ModuleType

    def __init__(self):
        self.cloudpickle = importlib.import_module("cloudpickle")

    def serialize(self, writer: ModelStateWriter, obj: object):
        with writer.open(self.file_name, "wb") as cloudpickle_file:
            self.cloudpickle.dump(obj, cloudpickle_file)

    def deserialize(self, reader: ModelStateReader) -> object:
        with reader.open(self.file_name, "rb") as cloudpickle_file:
            obj = self.cloudpickle.load(cloudpickle_file)
        return obj
```

### palantir\_models.serializers.DillSerializer

```python
import importlib
from types import ModuleType
from palantir_models.models._serialization import ModelSerializer
from palantir_models.models._state_accessors import ModelStateWriter, ModelStateReader


class DillSerializer(ModelSerializer[object]):
    """Serializer utilizing the dill library for generic objects"""

    file_name = "dill.pkl"
    dill: ModuleType

    def __init__(self):
        self.dill = importlib.import_module("dill")

    def serialize(self, writer: ModelStateWriter, obj: object):
        with writer.open(self.file_name, "wb") as dill_file:
            self.dill.dump(obj, dill_file, recurse=True)

    def deserialize(self, reader: ModelStateReader) -> object:
        with reader.open(self.file_name, "rb") as dill_file:
            obj = self.dill.load(dill_file)
        return obj
```

### palantir\_models.serializers.HfAutoModelSerializer

```python
class HfAutoModelSerializer(ModelSerializer):
    """
    Serializer for huggingface transformers AutoModel classes, using the
    from_pretrained and save_pretrained methods.
    Allows configuring a specific subclass (e.g. AutoModelForSequenceClassification or
    BertForTokenClassification) and passing additional kwargs to from_pretrained
    (e.g. num_labels=2).
    """

    DIR_NAME = "model"

    def __init__(self, model_class=None, **load_kwargs):
        if model_class is None:
            transformers = importlib.import_module("transformers")
            model_class = transformers.AutoModel
        self.model_class = model_class
        self.load_kwargs = load_kwargs

    def serialize(self, writer: ModelStateWriter, obj):
        model_dir = writer.mkdir(self.DIR_NAME)
        obj.save_pretrained(model_dir)

    def deserialize(self, reader: ModelStateReader):
        model_dir = reader.dir(self.DIR_NAME)
        return self.model_class.from_pretrained(model_dir, **self.load_kwargs)
```

### palantir\_models.serializers.HfAutoTokenizerSerializer

```python
class HfAutoTokenizerSerializer(ModelSerializer):
    """
    Serializer for huggingface transformers AutoTokenizer.
    """

    DIR_NAME = "tokenizer"

    def __init__(self, tokenizer_class=None, **load_kwargs):
        if tokenizer_class is None:
            transformers = importlib.import_module("transformers")
            tokenizer_class = transformers.AutoTokenizer
        self.tokenizer_class = tokenizer_class
        self.load_kwargs = load_kwargs

    def serialize(self, writer: ModelStateWriter, obj):
        tokenizer_dir = writer.mkdir(self.DIR_NAME)
        obj.save_pretrained(tokenizer_dir)

    def deserialize(self, reader: ModelStateReader):
        tokenizer_dir = reader.dir(self.DIR_NAME)
        return self.tokenizer_class.from_pretrained(tokenizer_dir, **self.load_kwargs)
```

### palantir\_models.serializers.HfPipelineSerializer

```python
import importlib
from palantir_models import ModelSerializer, ModelStateReader, ModelStateWriter


class HfPipelineSerializer(ModelSerializer):
    """
    Serializer for huggingface transformers pipelines.
    Allows setting the pipeline task (e.g. sentiment-analysis).
    """

    DIR_NAME = "pipeline"

    def __init__(self, pipeline_type, **load_kwargs):
        self.transformers = importlib.import_module("transformers")
        self.pipeline_type = pipeline_type
        self.load_kwargs = load_kwargs

    def serialize(self, writer: ModelStateWriter, obj):
        pipeline_dir = writer.mkdir(self.DIR_NAME)
        obj.save_pretrained(pipeline_dir)

    def deserialize(self, reader: ModelStateReader):
        pipeline_dir = reader.dir(self.DIR_NAME)
        return self.transformers.pipeline(self.pipeline_type, model=pipeline_dir, **self.load_kwargs)
```

### palantir\_models.serializers.JsonSerializer

```python
import importlib
from types import ModuleType
from typing import Dict
from palantir_models.models._serialization import ModelSerializer
from palantir_models.models._state_accessors import ModelStateWriter, ModelStateReader


class JsonSerializer(ModelSerializer[Dict]):
    """Serializer for json-convertible objects and dictionaries"""

    file_name = "config.json"
    json: ModuleType

    def __init__(self):
        self.json = importlib.import_module("json")

    def serialize(self, writer: ModelStateWriter, obj: Dict):
        with writer.open(self.file_name, "w") as conf:
            self.json.dump(obj, conf)

    def deserialize(self, reader: ModelStateReader) -> Dict:
        with reader.open(self.file_name, "r") as conf:
            return self.json.load(conf)
```

### palantir\_models.serializers.PytorchStateSerializer

```python
import importlib
from types import ModuleType
from palantir_models.models._serialization import ModelSerializer
from palantir_models.models._state_accessors import ModelStateWriter, ModelStateReader


class PytorchStateSerializer(ModelSerializer):
    """Serializer for PyTorch state dictionaries."""

    STATE_DICT_FILE_NAME = "model_state_dict.pt"
    torch: ModuleType

    def __init__(self):
        self.torch = importlib.import_module("torch")

    def serialize(self, writer: ModelStateWriter, obj: dict):
        """Serializes the state_dict of a PyTorch model."""
        with writer.open(self.STATE_DICT_FILE_NAME, "wb") as file_path:
            self.torch.save(obj, file_path)

    def deserialize(self, reader: ModelStateReader) -> dict:
        """Deserializes the state_dict of a PyTorch model."""
        with reader.open(self.STATE_DICT_FILE_NAME, "rb") as file_path:
            state_dict = self.torch.load(file_path)
            return state_dict
```

### palantir\_models.serializers.TensorflowKerasSerializer

```python
import enum
import importlib
import os
from types import ModuleType
from typing import Any, Dict, Optional

from palantir_models.models._serialization import ModelSerializer
from palantir_models.models._state_accessors import ModelStateReader, ModelStateWriter


class TensorflowFormat(enum.Enum):
    DIR = 0
    H5 = 1
    KERAS = 2

    def get_save_path(self, dir_path):
        if self == TensorflowFormat.DIR:
            return dir_path
        if self == TensorflowFormat.H5:
            return os.path.join(dir_path, "model.h5")
        if self == TensorflowFormat.KERAS:
            return os.path.join(dir_path, "model.keras")


class TensorflowKerasSerializer(ModelSerializer):
    """Serializer for tensorflow keras models"""

    DIR_NAME: str = "tensorflow_saved_model_dir"
    __tensorflow: ModuleType

    def __init__(self, format=TensorflowFormat.DIR, custom_objects: Optional[Dict[str, Any]] = None):
        self.__tensorflow = importlib.import_module("tensorflow")
        self.__custom_objects = custom_objects
        self.__format = format

    def serialize(self, writer: ModelStateWriter, obj: "tensorflow.keras.Model"):
        dir_path = writer.mkdir(self.DIR_NAME)
        self._save_model(dir_path, obj)

    def deserialize(self, reader: ModelStateReader) -> "tensorflow.keras.Model":
        dir_path = reader.dir(self.DIR_NAME)
        obj = self._load_model(dir_path)
        obj.compile()
        return obj

    def _save_model(self, dir_path: str, obj: "tensorflow.keras.Model"):
        try:
            save_path = self.__format.get_save_path(dir_path)
            obj.save(save_path)
        except ValueError as exc:
            if "Invalid filepath extension for saving" in str(exc):
                raise ValueError(
                    "Serialization failed due to invalid save format. Specify the correct file format in the TensorflowKerasSerializer constructor:\n"
                    "\tTensorflowKerasSerializer(format=TensorflowFormat.DIR) to use directory saving. This save format is considered legacy in Tensorflow\n"
                    "\tTensorflowKerasSerializer(format=TensorflowFormat.H5) to use .h5 file format saving\n"
                    "\tTensorflowKerasSerializer(format=TensorflowFormat.KERAS) to use .keras file format saving\n"
                ) from exc
            raise exc

    def _load_model(self, dir_path: str) -> "tensorflow.keras.Model":
        save_path = self.__format.get_save_path(dir_path)
        return self.__tensorflow.keras.models.load_model(save_path, custom_objects=self.__custom_objects, compile=False)
```

### palantir\_models.serializers.XGBoostSerializer

```python
from palantir_models import ModelSerializer
from palantir_models.models._serialization import ModelStateReader, ModelStateWriter
from xgboost.sklearn import XGBModel


class XGBoostSerializer(ModelSerializer[XGBModel]):
    """Simple Serializer for XGBoost SkLearn Models."""

    file_name = "xgboost_model.json"

    def serialize(self, writer: ModelStateWriter, obj: XGBModel):
        with writer.open(self.file_name, "w") as xgbfile:
            obj.save_model(xgbfile.name)

    def deserialize(self, reader: ModelStateReader) -> XGBModel:
        model = XGBModel()
        with reader.open(self.file_name, "r") as xgbfile:
            model.load_model(xgbfile.name)
            return model
```

### palantir\_models.serializers.YamlSerializer

```python
import importlib
from types import ModuleType
from typing import Dict
from palantir_models.models._serialization import ModelSerializer
from palantir_models.models._state_accessors import ModelStateWriter, ModelStateReader


class YamlSerializer(ModelSerializer[Dict]):
    """Serializer for yaml-convertible objects and dictionaries"""

    file_name = "config.yaml"
    yaml: ModuleType

    def __init__(self):
        self.yaml = importlib.import_module("yaml")

    def serialize(self, writer: ModelStateWriter, obj: Dict):
        with writer.open(self.file_name, "w") as conf:
            self.yaml.safe_dump(obj, conf)

    def deserialize(self, reader: ModelStateReader) -> Dict:
        with reader.open(self.file_name, "r") as conf:
            return self.yaml.safe_load(conf)
```
