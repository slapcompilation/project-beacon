<!-- source: https://palantir.com/docs/foundry/integrate-models/experiments-overview/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Experiments

An *experiment* is an artifact that represents a collection of metrics produced during a model training job. Experiments allow developers to log hyperparameters and metrics during a training job, visualize them on the model page, and compare between different model versions.

## Why use experiments?

The model development process is inherently iterative, and it can be difficult to keep track of different attempts at producing a model. Experiments provide a lightweight Python API for logging details related to those different attempts, including metrics and hyperparameters. Those metrics and hyperparameters can be visualized and compared between different model versions to provide a better understanding of how different parameters affect the model's performance. Below is an overview of how to create and write to experiments.

![Parallel coordinate plot parameter config](/docs/resources/foundry/integrate-models/parallel-coordinate-plot-parameter-config.png)

## Create experiments

The `ModelOutput` class used to publish models from [Jupyter® Code Workspaces](/docs/foundry/integrate-models/model-asset-code-workspaces/) and [Code Repositories](/docs/foundry/integrate-models/model-asset-code-repositories/) provides hooks for creating experiments.

Create experiments in Code Workspaces:

```python
from palantir_models.code_workspaces import ModelOutput
# `my-alias` is an alias to a model in the current workspace
model_output = ModelOutput("my-alias")
experiment = model_output.create_experiment(name="my-experiment")
```

Create experiments in Code Repositories:

```python
from transforms.api import configure, transform, Input
from palantir_models.transforms import ModelOutput

@transform(
    input_data=Input("..."),
    model_output=ModelOutput("..."),
)
def compute(input_data, model_output):
    experiment = model_output.create_experiment(name="my-experiment")
```

If any two experiments for a given model use the same name, they will be automatically deduplicated, allowing for the same code to be used multiple times without worrying about renaming the experiment.

Occasionally, model training code may fail due to network errors when writing to the experiment, or overflowing the maximum size of the series. While the Python client aims to handle these errors as gracefully as possible, there may be times where that is not possible. Clients can choose how errors should be handled, selecting from three different error handling variants:

* `FAIL` - Will instantly re-raise the error and the code will fail.
* `WARN` *(default)* - Will log a warning for the error, then suppress all future errors.
* `SUPPRESS` - Will not log anything.

The error handler mode can be set during experiment creation as shown below:

```python
from palantir_models.experiments import ErrorHandlerType
experiment = model_output.create_experiment(name="my-experiment", error_handler_type=ErrorHandlerType.FAIL)
```

## Publish experiments

In order for experiments to be displayed in the model page, they must be published alongside a model version. Once published, experiments can be viewed in the model page.

```python
model_output.publish(model_adapter, experiment=experiment)
```

[Learn more about visualizing experiments after publishing.](/docs/foundry/integrate-models/experiments-visualize/)

## Logging

Experiments support five types of logs: hyperparameters, metrics, images, plots, and tables.

### Log hyperparameters

Hyperparameters can be logged using the [`Experiment.log_param`](/docs/foundry/integrate-models/experiment-reference/#experimentlog_param) and [`Experiment.log_params`](/docs/foundry/integrate-models/experiment-reference/#experimentlog_params) functions. Hyperparameters are single key-value pairs that are used for storing static data associated with a model training job.

```python
experiment.log_param("learning_rate", 1e-3)
experiment.log_param("model_type", "CNN")
experiment.log_params({
    "batch_size": 12,
    "parallel": True
})
```

Experiments currently support logging hyperparameters of the following types:

* Boolean
* Date/Datetime
* Float
* Int
* String

### Log metrics

Metrics can be logged using the [`Experiment.log_metric`](/docs/foundry/integrate-models/experiment-reference/#experimentlog_metric) and [`Experiment.log_metrics`](/docs/foundry/integrate-models/experiment-reference/#experimentlog_metrics) functions. Metrics are logged to a series, where the series tracks each logged value in a time series. Metric values must be numeric and the step must be strictly increasing.

When logging metrics, if the metric series has not been created, a new series will be created. Additionally, callers may pass a `step` parameter to set the step to log to.

```python
experiment.log_metric("train/acc", 1.5)
experiment.log_metric("test/acc", 15, step=1)
experiment.log_metrics({
    "train/acc": 5,
    "train/loss": 0.9
})
```

### Log images

Images can be logged using [`Experiment.log_image`](/docs/foundry/integrate-models/experiment-reference/#experimentlog_image). Images are logged to a series, where the series tracks each logged image in a time series. Images must be in PNG format or a [Pillow ↗](https://pillow.readthedocs.io/en/stable/index.html) image to be logged; other image formats will be rejected.

When logging images, if the image series has not been created, a new series will be created. Additionally, callers may pass a `step` parameter to set the step to log to.

```python
experiment.log_image("train/bounding_boxes", pillow_image)
experiment.log_image("test/bounding_boxes", image_bytes_arr)
experiment.log_image(
    "test/segmentation",
    "path/to/image.png",
    caption="Segmentation Image",
    step=1)
```

Image logging can also serve as a way to log custom charts.

```python
import matplotlib.pyplot as plt

plt.scatter(x_data, y_data)
plt.savefig("path/to/image.png")
experiment.log_image("scatter", "path/to/image.png")
```

### Log plots

Plots can be logged using [`Experiment.log_plot`](/docs/foundry/integrate-models/experiment-reference/#experimentlog_plot). Plots are logged to a series, where the series tracks each logged plot in a time series. Plots must be provided as a [Plotly ↗](https://plotly.com/python/) `plotly.graph_objects.Figure`; other plot types will be rejected.

When logging plots, if the plot series has not been created, a new series will be created. Additionally, callers may pass a `step` parameter to set the step to log to.

```python
import plotly.express as px

fig = px.line(x=[1, 2, 3], y=[0.2, 0.4, 0.6])
experiment.log_plot("train/acc", fig)
experiment.log_plot("test/acc", fig, step=1)
experiment.log_plot(
    "validation/loss",
    fig,
    caption="Validation Loss over Epochs",
    step=2,
)
```

### Log tables

Tables can be logged using [`Experiment.log_table`](/docs/foundry/integrate-models/experiment-reference/#experimentlog_table). The provided table must be either a [pandas ↗](https://pandas.pydata.org/docs/) or [Polars ↗](https://pandas.pydata.org/docs/) DataFrame. Other data types will be rejected.

```python
import pandas as pd

leaderboard = pd.DataFrame({
    "model_type": ["xgboost", "decision_tree", "torch_nn"],
    "score": [0.75, 0.6, 0.93],
    "rank": [2, 3, 1]
})

experiment.log_table("model_leaderboard", leaderboard)
```

## MLflow

[MLflow ↗](https://mlflow.org/) is an open source toolkit for model training metrics tracking that has a wide range of built-in logging support for different machine learning libraries. Users can leverage MLflow and its [autologging capabilities ↗](https://mlflow.org/docs/latest/tracking/autolog) to streamline the integration of experiments into their model training code with minimal required changes.

After creating an experiment, users can set that experiment as the active MLflow run, and then use MLflow's Python API to write logs to the experiment.

```python
import mlflow

experiment = model_output.create_experiment(name="my-experiment")

with experiment.as_mlflow_run():
    mlflow.sklearn.autolog()
    # training code

model_adapter = MyModelAdapter(trained_model)
model_output.publish(model_adapter, experiment=experiment)
```

MLflow also provides hooks for more advanced machine learning libraries (such as Keras) that may require callbacks to log metrics:

```python
import keras
import mlflow

experiment = model_output.create_experiment(name="my-experiment")

model = keras.Sequential(
    [
        keras.Input([28, 28, 3]),
        keras.layers.Flatten(),
        keras.layers.Dense(2),
    ]
)
model.compile(
    loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
    optimizer=keras.optimizers.Adam(0.001),
    metrics=[keras.metrics.SparseCategoricalAccuracy()],
)

with experiment.as_mlflow_run():
    model.fit(
        data,
        label,
        batch_size=16,
        epochs=8,
        callbacks=[mlflow.keras.MlflowCallback()],
    )

model_adapter = MyModelAdapter(trained_model)
model_output.publish(model_adapter, experiment=experiment)
```

### Limitations of MLflow integration

Currently, MLflow integration with experiments does not support the full suite of MLflow tooling. The following limitations apply:

* Logging can only be done at model publication (training) time.
* Asset support is limited; any asset that is not a PNG will be silently dropped.
* Tags are silently ignored.
* Nested runs are not supported.

## Limits

The below table lists limits related to experiments in Foundry.

| Description | Limit |
|------|------|
| Experiment/metric/hyperparameter name max length | 100 characters |
| Maximum values across all metric series in an experiment | 100,000 |
| Maximum number of hyperparameters per experiment | 500 |
| Maximum number of rows per table | 100,000 |

To increase these limits, contact Palantir support.

Review the [model experiments Python API reference](/docs/foundry/integrate-models/experiment-reference/) for more information.
