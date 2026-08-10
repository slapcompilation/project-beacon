<!-- source: https://palantir.com/docs/foundry/integrate-models/serialization/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Serialization for models

To reuse models across workflows, Palantir needs to be able to deserialize stored weights. Since the serialization process can be specific to model types, the author of the model adapter is expected to detail how this should happen. Note that this is not a concern for container models, where serialization is typically a part of the container lifecycle, or external models, which have externally hosted weights.

## Auto serialization

To simplify serialization and deserialization for model weights within the platform, Palantir provides a number of default serialization methods for saving and loading models:

* [Dill](#dill)
* [Cloudpickle](#cloudpickle)
* [JSON](#json)
* [YAML](#yaml)
* [Hugging Face](#hugging-face)
* [PyTorch](#pytorch)
* [Tensorflow](#tensorflow)
* [XGBoost](#xgboost)
* [Spark MLlib](#spark-mllib)

### How to use a default serializer

A default serializer can be used by annotating the `__init__` method on a [model adapter](/docs/foundry/integrate-models/model-adapter-overview/) with the `@auto_serialize` annotation. By default, Palantir will automatically save and load each of your `__init__` method's inputs using the [Dill](#dill) serializer. By providing arguments to the`@auto_serialize` annotation, you can specify the serializer method to be used for each of the arguments to your `__init__` method. When providing serializer arguments this way, every argument in your `__init__` method must have an equivalent argument in your `@auto_serialize` definition.

:::callout{theme="information" title="Python Dependencies"}
Note that to avoid possible conflicts, the `palantir_models.serializers` package does not contain dependencies on the serialization frameworks below, except for `dill`. You must still add a dependency on the related serialization package when using other serializers from the `palantir_models.serializers` package.
:::

### Example model definition using `auto_serialization`

The below is a valid [Python transform](/docs/foundry/transforms-python/overview/) that trains and publishes a model. Since the `AutoSerializationAdapter` uses the `@auto_serialize` decorator without arguments to serialize the model, the `model` argument to the `__init__` method is serialized using [Dill](#dill).

:::callout{theme="neutral"}
Note that when using versions of `palantir_models` below `0.1536.0`, all serializers will need to be defined as arguments to the `@auto_serialize` decorator.
:::

```python
from transforms.api import transform
from palantir_models.transforms import ModelOutput

from sklearn.linear_model import LinearRegression
import numpy as np


@transform(
    model_output=ModelOutput("/Foundry/path/to/model_asset"),
)
def compute(model_output):
    x_values = [i for i in range(100)]
    y_values = [2 * i for i in x_values]

    X = np.array(x_values, dtype=np.float32).reshape(-1, 1)
    y = np.array(y_values, dtype=np.float32).reshape(-1, 1)

    model = LinearRegression()
    model.fit(X, y)

    model_output.publish(
        model_adapter=AutoSerializationAdapter(
            model,
            {'prediction_column': 'prediction'}
        )
    )

import palantir_models as pm

class AutoSerializationAdapter(pm.ModelAdapter):

    @pm.auto_serialize
    def __init__(self, model):
        self.model = model

    @classmethod
    def api(cls):
        inputs = {"df_in": pm.Pandas()}
        outputs = {"df_out": pm.Pandas()}
        return inputs, outputs

    def predict(self, df_in):
        df_in['prediction'] = self.model.predict(df_in)
        return df_in
```

### Example model definition using multiple `auto_serialization`

The following model adapter defines different serializer methods for each input of its `__init__` method.

```python
import palantir_models as pm
from palantir_models.serializers import DillSerializer, JsonSerializer

class AutoSerializationAdapter(pm.ModelAdapter):

    @pm.auto_serialize(
        model=DillSerializer(),
        config=JsonSerializer()
    )
    def __init__(self, model, config={}):
        self.model = model
        self.prediction_column = config['prediction_column'] if 'prediction_column' in config else 'prediction'

    @classmethod
    def api(cls):
        inputs = {"df_in": pm.Pandas()}
        outputs = {"df_out": pm.Pandas()}
        return inputs, outputs

    def predict(self, df_in):
        df_in[self.prediction_column] = self.model.predict(df_in)
        return df_in
```

## Default serializers

### Dill

The [`palantir_models.serializers.DillSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializersdillserializer) will serialize a Python object with [dill ↗](https://pypi.org/project/dill/) by calling `dill.dump` with `dill.load` to save and load your object to disk.

The `DillSerializer` class can be used to serialize many Python objects, including `scikit-learn` and `statsmodels`.

### Cloudpickle

The [`palantir_models.serializers.CloudPickleSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializerscloudpickleserializer) will serialize a Python object with [Cloudpickle ↗](https://pypi.org/project/cloudpickle/) by calling `cloudpickle.dump` and `cloudpickle.load` to save and load your object to disk.

The `CloudPickleSerializer` class can be used to serialize many Python objects, including `scikit-learn` and `statsmodels`.

### JSON

The [`palantir_models.serializers.JsonSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializersjsonserializer) will serialize a Python Dictionary as JSON by calling `yaml.safe_dump` and `json.safe_load` on your Python Dictionary.

### YAML

The [`palantir_models.serializers.YamlSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializersyamlserializer) will serialize a Python Dictionary with JSON by calling `yaml.safe_dump` and `yaml.safe_load` on your Python Dictionary.

### Hugging Face

The `palantir_models.serializers` library currently provides three default serializers for [Hugging Face models ↗](https://huggingface.co/): `HfPipelineSerializer`, `HfAutoTokenizerSerializer`, and `HfAutoModelSerializer`. All three Hugging Face serializers require that the `transformers` library be added as a dependency to your Python environment.

#### HfPipelineSerializer

The [`palantir_models.serializers.HfPipelineSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializershfpipelineserializer) will serialize a [`transformers.pipeline` ↗](https://huggingface.co/docs/transformers/v4.37.2/en/main_classes/pipelines#pipelines) object with `save_pretrained` and reinstantiate your pipeline object at load.

The `HfPipelineSerializer` has one required string parameter representing the [task ↗](https://huggingface.co/docs/transformers/en/task_summary) of the pipeline. Any additional kwargs will be used for loading the pipeline.

```python
import palantir_models as pm
from palantir_models.serializers import HfPipelineSerializer
from transformers import pipeline
import pandas as pd

class HFNerAdapter(pm.ModelAdapter):

    @pm.auto_serialize(
        pipeline=HfPipelineSerializer("ner"),
    )
    def __init__(self, pipeline):
        self.pipeline = pipeline

    @classmethod
    def api(cls):
        inputs = {"df_in" : pm.Pandas([("text", str)])}
        outputs = {"df_out" : pm.Pandas([("text", str), ("generation", str)])}
        return inputs, outputs

    def predict(self, df_in: pd.DataFrame):
        result = self.pipeline(df_in["text"].tolist())
        df_in["generation"] = result
        return df_in
```

#### HfAutoModelSerializer and HfAutoTokenizerSerializer

The [`palantir_models.serializers.HfAutoModelSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializershfautomodelserializer) and [`palantir_models.serializers.HfAutoTokenizerSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializershfautotokenizerserializer) will serialize a `transformers.AutoModel` and `transformers.AutoTokenizer` model with `save_pretrained` and `from_pretrained`.

Note, for some models and tokenizers it is recommended to use the specific model or tokenizer classes rather than the generic ones; in these cases the specific classes can be passed to the serializers as the first `model_class` argument.

```python
import palantir_models as pm
from palantir_models.serializers import HfAutoModelSerializer, HfAutoTokenizerSerializer
from transformers import AutoModelForSeq2SeqLM
import pandas as pd
import torch


class HFTextGenerationAdapter(pm.ModelAdapter):

    @pm.auto_serialize(
        model=HfAutoModelSerializer(AutoModelForSeq2SeqLM),
        tokenizer=HfAutoTokenizerSerializer()
    )
    def __init__(self, model, tokenizer):
        self.model = model
        self.tokenizer = tokenizer

    @classmethod
    def api(cls):
        inputs = {"df_in" : pm.Pandas([("text", str)])}
        outputs = {"df_out" : pm.Pandas([("text", str), ("generation", str)])}
        return inputs, outputs

    def predict(self, df_in: pd.DataFrame):
        input_ids = self.tokenizer(
            df_in["text"].tolist(),
            return_tensors="pt",
            padding=True
        ).input_ids

        outputs = self.model.generate(input_ids)
        result = self.tokenizer.batch_decode(outputs, skip_special_tokens=True)

        df_in["generation"] = result
        return df_in

```

### PyTorch

The [`palantir_models.serializers.PytorchStateSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializerspytorchstateserializer) will serialize a [`torch.nn.Module` ↗](https://pytorch.org/docs/stable/generated/torch.nn.Module.html) with `torch.save` and `torch.load` to save and load your object to disk.

### TensorFlow

The [`palantir_models.serializers.TensorflowKerasSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializerstensorflowkerasserializer) will serialize a [`tensorflow.keras.Model` ↗](https://www.tensorflow.org/api_docs/python/tf/keras/Model) with `obj.save` and `tensorflow.keras.models.load_model` to save and load your model to disk. When your model is being deserialized, Foundry will call `obj.compile()`.

### XGBoost

The [`palantir_models.serializers.XGBoostSerializer`](/docs/foundry/integrate-models/auto-serialization-reference/#palantir_modelsserializersxgboostserializer) will serialize a [`xgboost.sklearn.XGBModel` ↗](https://xgboost.readthedocs.io/en/stable/python/python_api.html) with `save_model` and `load_model` to save and load your model to disk. The `XGBModel` class is the base class for many XGBoost models including `xgboost.XGBClassifier`, `xgboost.XGBRegressor`, and `xgboost.XGBRanker`.

### Spark MLlib

The `palantir_models.serializers.SparkMLAutoSerializer` will serialize a [`pyspark.ml.pipeline.Pipeline` ↗](https://spark.apache.org/docs/latest/ml-pipeline.html#pipeline) object using the `pyspark.ml.PipelineModel.write().overwrite().save()` and `pyspark.ml.PipelineModel.read().load()` methods. Given that any Spark MLlib model can be wrapped in a Pipeline object, this serializer is intended to serve as a general-purpose serializer for Spark.

### Writing your own AutoSerializer

See the [full implementation](/docs/foundry/integrate-models/auto-serialization-reference/#implementation-of-provided-serializers) of each of the serializers and documentation on [how to add a new default serializer](/docs/foundry/integrate-models/auto-serialization-reference/#how-to-write-a-model-serializer).

If you believe there should be an additional default serializer that is not listed above, contact your Palantir representative.

## Custom Serialization

In cases where the default serializers are insufficient, users can implement the `load()` and `save()` methods. Refer to the [API reference](/docs/foundry/integrate-models/model-adapter-reference/#model-save-and-load) for additional details and examples.
