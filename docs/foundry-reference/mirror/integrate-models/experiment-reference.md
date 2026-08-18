<!-- source: https://palantir.com/docs/foundry/integrate-models/experiment-reference/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# API: Model experiments

The model experiments Python API provides a set of methods for writing metrics and hyperparameters to experiments. This page contains information on available functions and classes in the `palantir_models.experiments` package.

## `palantir_models.experiments.Experiment`

A class for tracking model training experiments. An experiment can be created from any `ModelOutput` class.

```python
model_output.create_experiment(name="experiment-name")
```

| Function | Description |
| --- | --- |
| [`log_param(key, value)`](#experimentlog_param) | Log a single parameter to an experiment. |
| [`log_params(parameter_map)`](#experimentlog_params) | Log a set of parameters to an experiment. |
| [`log_metric(name, value, step)`](#experimentlog_metric) | Log a metric value to an experiment under the given series. |
| [`log_metrics(metric_values, step)`](#experimentlog_metrics) | Log a set of metric values to an experiment under the given series. |
| [`log_image(name, image, caption, step)`](#experimentlog_image) | Log an image to an experiment under the given series. |
| [`as_mlflow_run()`](#experimentas_mlflow_run) | Creates a context block and sets the active MLflow run to write to the experiment. |

## `palantir_models.experiments.ErrorHandlerType`

An enum for controlling how errors are handled when running experiment code. This specifically governs errors caused by non-user code such as network errors when writing metrics, or experiment size overflows.

| Variant | Description |
| --- | --- |
| `ErrorHandlerType.FAIL` | Fail on any error. Will re-raise the error back to the caller. |
| `ErrorHandlerType.WARN` | Warn on the first error, then suppress the rest. |
| `ErrorHandlerType.SUPPRESS` | Do not log anything. |

The desired error handler type can be passed to `ModelOutput.create_experiment` when creating an experiment as shown below:

```python
from palantir_models.experiments import ErrorHandlerType
model_output.create_experiment(
    name="mnist-experiment",
    error_handler_type=ErrorHandlerType.WARN
)
```

***

## `Experiment.log_param`

`palantir_models.experiments.Experiment.log_param(key: str, value: Union[bool, date, datetime, float, int, str])`

* Logs the given parameter `value` to the given `key`.
* Parameters can be overwritten by logging to the same parameter key.

```python
experiment.log_param(key="learning_rate", value=1e-3)
```

### Parameters

* **`key`:** `str`
  * The name of the parameter to write.
* **`value`:** `Union[bool, date, datetime, float, int, str]`
  * The value to write to the parameter.

***

## `Experiment.log_params`

`palantir_models.experiments.Experiment.log_params(parameter_map: Dict[str, Union[bool, date, datetime, float, int, str]])`

* The batched version of [`log_param`](#experimentlog_param).

```python
experiment.log_params(parameter_map={
    "learning_rate": 1e-3,
    "model_type": "CNN"
})
```

### Parameters

* **`parameter_map`:** `Dict[str, Union[bool, date, datetime, float, int, str]]`
  * A mapping of parameter name to parameter value.

***

## `Experiment.log_metric`

`palantir_models.experiments.Experiment.log_metric(metric_name: str, metric_value: float, step: Optional[int] = None)`

* Logs the metric value in the series.
* If the series does not exist (has not been logged to yet), one will be created.
* If `step` is provided, an attempt to log at that step will be made. If the step has already been logged to, an error will be raised.
* If `step` is not provided, the current step of the series will be auto-incremented by 1.

```python
experiment.log_metric(metric_name="train/loss", metric_value=1.5)
experiment.log_metric(metric_name="train/loss", metric_value=0.9) # will auto-increment the step
```

### Parameters

* **`metric_name`:** `str`
  * The name of the metric series to write the value to.
* **`metric_value`:** `float`
  * The value to write.
* **`step`:** `Optional[int]`
  * Optional step to write to. If the provided step is less than the current step, an error will be raised. If the step is not provided, the step will be auto-incremented.

***

## `Experiment.log_metrics`

`palantir_models.experiments.Experiment.log_metrics(values: Dict[str, float], step: Optional[int] = None)`

* The batched version of [`log_metric`](#experimentlog_metric).
* Logs all provided values to their respective series at the same step.
* If any series does not exist (has not been logged to yet), it will be created.
* If `step` is provided, an attempt to log at that step will be made. If the step has already been logged to on any series, an error will be raised.
* If `step` is not provided, the current step of the all the series will be independently auto-incremented by 1.

```python
experiment.log_metrics(values={
    "train/loss": 1.5,
    "train/acc", 0.7
})
```

### Parameters

* **`values`:** `Dict[str, float]`
  * Mapping of metric name to metric value.
* **`step`:** `Optional[int]`
  * Optional step to write to. If the provided step is less than the current step of any series being written to, an error will be raised. If the step is not provided, the steps of each series will be independently auto-incremented.

***

## `Experiment.log_image`

`palantir_models.experiments.Experiment.log_image(series_name: str, image: Union[str, bytes, "PIL.Image.Image"], caption: Optional[str] = None, step: Optional[int] = None)`

* Logs the image in the series.
* The image must be a path to a PNG image, PNG image bytes, or a [Pillow ↗](https://pillow.readthedocs.io/en/stable/index.html) image.
* If the series does not exist (has not been logged to yet), one will be created.
* If `step` is provided, an attempt to log at that step will be made. If the step has already been logged to, an error will be raised.
* If `step` is not provided, the current step of the series will be auto-incremented by 1.

```python
experiment.log_image("bounding_boxes", image="/path/to/image.png", caption="My caption", step=1)
```

### Parameters

* **`series_name`:** `str`
  * The name of the image series to write the value to.
* **`image`:** `Union[str, bytes, "PIL.Image.Image"]`
  * The image to write.
* **`caption`:** `Optional[str]`
  * Optional caption to write alongside the image.
* **`step`:** `Optional[str]`
  * Optional step to write to. If the provided step is less than the current step, an error will be raised. If the step is not provided, the step will be auto-incremented.

***

## `Experiment.log_plot`

`palantir_models.experiments.Experiment.log_plot(series_name: str, plot_data: "plotly.graph_objects.Figure", caption: Optional[str] = None, step: Optional[int] = None)`

* Logs the plot in the series.
* The plot must be a [Plotly ↗](https://plotly.com/python/) `plotly.graph_objects.Figure`.
* If the series does not exist (has not been logged to yet), one will be created.
* If `step` is provided, an attempt to log at that step will be made. If the step has already been logged to, an error will be raised.
* If `step` is not provided, the current step of the series will be auto-incremented by 1.

```python
import plotly.express as px

fig = px.line(x=[1, 2, 3], y=[4, 3, 2])
experiment.log_plot("training/accuracy", plot_data=fig, caption="Accuracy over epochs", step=10)
```

### Parameters

* **`series_name`:** `str`
  * The name of the plot series to write the value to.
* **`plot_data`:** `"plotly.graph_objects.Figure"`
  * The plot to write.
* **`caption`:** `Optional[str]`
  * Optional caption to write alongside the plot.
* **`step`:** `Optional[int]`
  * Optional step to write to. If the provided step is less than the current step, an error will be raised. If the step is not provided, the step will be auto-incremented.

***

## `Experiment.log_table`

`palantir_models.experiments.Experiment.log_table(table_name: str, table: Union["polars.DataFrame", "pandas.DataFrame"], description: Optional[str] = None)`

* Logs the table to the experiment.
* The table must be either a [pandas ↗](https://pandas.pydata.org/docs/) or [Polars ↗](https://pandas.pydata.org/docs/) DataFrame.

```python
import pandas as pd

leaderboard = pd.DataFrame({
    "model_type": ["xgboost", "decision_tree", "torch_nn"],
    "score": [0.75, 0.6, 0.93],
    "rank": [2, 3, 1]
})

experiment.log_table("model_leaderboard", leaderboard)
```

### Parameters

* **`table_name`:** `str`
  * The name of the table.
* **`table`:** `Union["polars.DataFrame", "pandas.DataFrame"]`
  * The table data to write.
* **`description`:** `Optional[str]`
  * Optional description to write alongside the table.

***

## `Experiment.as_mlflow_run`

`palantir_models.experiments.Experiment.as_mlflow_run()`

* Creates an active MLflow run which will write to the experiment
* Requires `MLflow >= 2.0.0`

```python
with experiment.as_mlflow_run() as run:
    ...
```

***
