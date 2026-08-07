<!-- source: https://palantir.com/docs/foundry/integrate-models/spark-distributed-model-training/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Spark distributed model training

In distributed training, the training of a model takes place across multiple computing resources working in parallel. Foundry supports distributed model training in Spark environments. Distributed training enables you to:

* **Train models faster and more efficiently:** Distributed training leverages multiple nodes concurrently to accelerate model training.
* **Scale up training datasets:** By splitting training tasks and data across nodes, you can train models on much larger datasets than what single-node approaches can fit in memory.

:::callout{theme="neutral"}
Currently, only **PySpark XGBoost estimators** are directly supported for distributed model training in Foundry. Additional distributed training libraries may be supported in the future.
:::

Follow the steps below to learn how to perform distributed model training in Foundry.

## 1. Configure your Spark environment

Before using distributed training libraries, you must configure your Spark environment properly using a [Spark profile](/docs/foundry/code-repositories/spark-profiles/).

### Required Spark profile

To perform distributed model training, you must import and apply the `KUBERNETES_OPEN_PORTS_ALL` profile in your repository, as shown in the example code below:

```python
from transforms.api import configure

@configure(profile=[
    "KUBERNETES_OPEN_PORTS_ALL",
])
@transform_df(...)
def compute(...):
    ...
```

:::callout{theme="neutral"}
To reiterate: applying the `KUBERNETES_OPEN_PORTS_ALL` profile is *mandatory* for distributed training.
:::

## 2. Set up distributed training libraries

### Set up an XGBoost Spark estimator

XGBoost provides a seamless PySpark integration for distributed training via a [SparkXGBClassifier ↗](https://xgboost.readthedocs.io/en/latest/python/python_api.html#xgboost.spark.SparkXGBClassifier) or [SparkXGBRegressor ↗](https://xgboost.readthedocs.io/en/latest/tutorials/spark_estimator.html#sparkxgbregressor) estimator.

An example of basic setup for SparkXGBClassifier is as follows:

```python
from xgboost.spark import SparkXGBClassifier

@configure(profile=["KUBERNETES_OPEN_PORTS_ALL"])
@transform(...)
def compute(...):
    xgb = SparkXGBClassifier(
        features_col=<your_feature_col_name>,
        # other parameters as needed
    )
    model = xgb.fit(<your_training_dataframe>)
```

For additional configuration details, refer to the [XGBoost Spark Documentation ↗](https://xgboost.readthedocs.io/en/latest/tutorials/spark_estimator.html).

### Set up GPU support for distributed model training

To leverage GPUs for distributed model training, follow the steps below:

1. Add your project to a [**resource queue**](/docs/foundry/resource-management/resource-queues/) with GPU support.
2. Enable the **GPU profile** by adding the `EXECUTOR_GPU_ENABLED` Spark profile to your transform.
3. Configure the `device` parameter to `'gpu'` or `'cuda'`, depending on your GPU setup.

**Example:**

```python
from transforms.api import configure

@configure(profile=[
    "KUBERNETES_OPEN_PORTS_ALL",
    "EXECUTOR_GPU_ENABLED",
])
@transform_df(...)
def compute(...):
    xgb = SparkXGBClassifier(
        ...,
        device='gpu'  # options: 'cpu', 'gpu', 'cuda'
    )
    model = xgb.fit(...)
```

Refer to the [SparkXGBClassifier documentation ↗](https://xgboost.readthedocs.io/en/latest/python/python_api.html#xgboost.spark.SparkXGBClassifier) for more information on GPU configuration.

## 3. Distributed hyperparameter optimization

Optionally, you may want to perform hyperparameter optimization. We recommend using [**Optuna** ↗](https://optuna.org/) for hyperparameter optimization in [Transforms](/docs/foundry/transforms-python/transforms/).

* Optuna integrates well with Spark and distributed training workflows without additional setup.
* For more details, refer to the [Optuna documentation ↗](https://optuna.org/).

## 4. Use SparkXGBClassifier or SparkXGBRegressor with a model adapter

The built-in `XGBoostSerializer` from `palantir_models.serializers` does **not** directly support XGBoost’s Spark estimators (`SparkXGBClassifier` / `SparkXGBRegressor`).
Instead, you should:

1. Train your Spark XGBoost model as usual.
2. Extract the underlying `Booster` object via `.get_booster()`.
3. Use the `Booster` in your model adapter.

:::callout{theme="neutral"}
**Note:** If you need to run inference in a distributed fashion, you can still register your `ModelAdapter` inside a PySpark UDF. See [PySpark UDFs](/docs/foundry/transforms-python-spark/pyspark-udfs/) for details.
:::

### Example model adapter

```python
from palantir_models.serializers import XGBoostSerializer
import palantir_models as pm

class BoosterModelAdapter(pm.ModelAdapter):

    @pm.auto_serialize(model=XGBoostSerializer())
    def __init__(self, booster):
        self.booster = booster

    @classmethod
    def api(cls):
        <...>

    def predict(self, input_df):
        return self.booster.predict(input_df)
```

### Training and adapter initialization

```python
from transforms.api import configure, transform
from transforms.api.schema import Input, ModelOutput
from xgboost.spark import SparkXGBClassifier  # or SparkXGBRegressor
from your_project.adapters import BoosterModelAdapter

@configure(profile=[
    "DYNAMIC_ALLOCATION_DISABLED",
    "NUM_EXECUTORS_2",
    "KUBERNETES_OPEN_PORTS_ALL"
])
@transform(
    training_df=Input(path="..."),
    model_output=ModelOutput(path="...")
)
def compute(ctx, training_df, model_output):
    # 1. Train the SparkXGBClassifier
    xgb = SparkXGBClassifier(...)
    spark_model = xgb.fit(training_df)

    # 2. Extract the underlying Booster
    booster = spark_model.get_booster()

    # 3. Create your model adapter
    adapter = BoosterModelAdapter(booster)

    # 4. Publish the model to Foundry
    model_output.publish(adapter)
```

For more on configuring adapters, see the [model adapters overview](/docs/foundry/integrate-models/model-adapter-overview/).
