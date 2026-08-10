<!-- source: https://palantir.com/docs/foundry/integrate-models/spark-models/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Support for Spark ML Models in `palantir_models`

Apache Spark™ is one of the main engines backing compute in Foundry and offers [extensive Machine Learning capabilities ↗](https://spark.apache.org/docs/latest/ml-guide.html). While Foundry supports Spark MLlib, this comes with some caveats due to the specificities of Spark as an inherently distributed machine learning framework.

For example, some Foundry features rely on encapsulating the model in a container image, leveraging underlying infrastructure such as [Rubix ↗](https://blog.palantir.com/introducing-rubix-kubernetes-at-palantir-ab0ce16ea42e) to provision and manage multiple containers running the model. Foundry does not yet support building such a container image for Spark models.

Thus, we recommend that users favor frameworks that natively support single-node training and inference, such as `scikit-learn`, `xgboost` or `keras`. Spark ML is particularly discouraged if the model is to be [consumed as a REST API](#live-inference).

## Spark Model training & batch inference

In Foundry, we recommend training Spark models in [code repositories](/docs/foundry/model-integration/tutorial-train-code-repositories/), since [code workspaces](/docs/foundry/code-workspaces/getting-started/) run on a single node and [code workbooks](/docs/foundry/code-workbook/getting-started/) are considered legacy. However, authoring a Spark ML model in Foundry does not fundamentally differ from authoring in other frameworks:

* The [Model API](/docs/foundry/integrate-models/model-adapter-api/) supports [Spark DataFrames as inputs](/docs/foundry/integrate-models/model-adapter-api/#api-types).
* [MLlib pipeline models ↗](https://spark.apache.org/docs/latest/ml-pipeline.html#pipeline) can be [auto-serialized](/docs/foundry/integrate-models/serialization/) using the `SparkMLAutoSerializer` class introduced in version 0.1599.0 of `palantir_models`.

Here is example code to train a multi-class classification model on the [open-source Iris dataset ↗](https://en.wikipedia.org/wiki/Iris_flower_data_set) with Spark ML:

```python
# src/main/model_training/model_training.py
from pyspark.ml import Pipeline
from pyspark.ml.classification import RandomForestClassifier
from pyspark.ml.feature import StringIndexer, VectorAssembler

from transforms.api import transform, Input, Output
from palantir_models.transforms import ModelOutput

from main.model_adapters.adapter import SparkModelAdapter


@transform(
    iris_data_in=Input("<PATH_TO_FOLDER>/iris_data"),
    model_output=ModelOutput("<PATH_TO_FOLDER>/spark_model"),
    inference_data_out=Output("<PATH_TO_FOLDER>/inference_data_out")
)
def compute(iris_data_in, model_output, inference_data_out):
    iris_data = iris_data_in.dataframe()
    # assuming columns sepallength, sepalwidth, petallength, petalwidth, variety
    feature_cols = iris_data.columns[:-1]
    train_data, test_data = iris_data.randomSplit([0.7, 0.3], seed=42)

    assembler = VectorAssembler(inputCols=feature_cols, outputCol="features")
    label_indexer = StringIndexer(inputCol="variety", outputCol="label", handleInvalid="keep")

    rf = RandomForestClassifier(
        labelCol="label",
        featuresCol="features",
        numTrees=10,
        maxDepth=5,
        seed=42
    )
    pipeline = Pipeline(stages=[assembler, label_indexer, rf])
    model = pipeline.fit(train_data)

    # Wrap the trained model in a ModelAdapter
    foundry_model = SparkModelAdapter(model)

    predictions = foundry_model.transform(test_data).df_out
    # Publish and write the trained model to Foundry with the experiment
    # Once the model and experiment are published, they are immediately visible in the model page
    inference_data_out.write_dataframe(
        predictions
    )
    model_output.publish(
        model_adapter=foundry_model,
    )
```

And the corresponding adapter code:

```python
# src/main/model_adapters/adapter.py
import palantir_models as pm
from palantir_models.serializers import SparkMLAutoSerializer
from pyspark.ml.functions import vector_to_array
from pyspark.sql import functions as F


class SparkModelAdapter(pm.ModelAdapter):
    NUM_CLASSES = 3

    @pm.auto_serialize(model=SparkMLAutoSerializer())
    def __init__(self, model):
        self.model = model

    @classmethod
    def api(cls):
        input_cols = [
            ("sepallength", float),
            ("sepalwidth", float),
            ("petallength", float),
            ("petalwidth", float),
            # The input training dataset also has this column, but it doesn't need to be
            # added to the adapter since it will not be present at actual inference time.
            # ("variety", str),
        ]
        output_cols = input_cols + [
            ("label", int)
        ]
        inputs = {
            "df_in": pm.Spark(columns=input_cols),
        }
        outputs = {"df_out": pm.Spark(columns=output_cols)}
        return inputs, outputs

    def predict(self, df_in):
        predictions = self.model.transform(df_in)
        # For simplicity, do not return the probability and label vectors, and simply return
        # the label as specified in the API.
        return predictions.drop("features", "rawPrediction", "probability", "prob_array")

```

### Live inference

While [technically supported as an experimental feature in Modeling Objectives](/docs/foundry/manage-models/set-up-live/#spark-model-support), usage of Spark models for live inference is generally discouraged. We suggest preferring models built with other, single-node libraries when designing a model for Live Inference.
