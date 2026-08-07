<!-- source: https://palantir.com/docs/foundry/integrate-models/evaluation-reference/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# API: Model evaluations

The model evaluations Python API provides a set of methods for creating evaluations and logging metrics, images, plots, and tables to them.

## `palantir_models.transforms.evaluation`

The `palantir_models.transforms.evaluation` decorator creates an evaluation. Apply it to wrap a transform and indicate the [evaluation set](/docs/foundry/integrate-models/evaluations-overview/#evaluation-sets) written to on the model inputs:

```python
from transforms.api import configure, transform, Input
import palantir_models as pm
from palantir_models.transforms import ModelInput

# This decorator is required to be applied to create evaluations.
# The decorator indicates the evaluation set that will be written to on the model input(s).
@pm.transforms.evaluation("error_analysis")
@transform.using(
    input_data=Input("..."),
    model_input=ModelInput("..."),
)
def compute(input_data, model_input):
    evaluation = model_input.create_evaluation(name="my-evaluation")
```

In the above example, the evaluation will be written to the `error_analysis` [evaluation set](/docs/foundry/integrate-models/evaluations-overview/#evaluation-sets) on the `model_input` model. If the evaluation set does not yet exist, it is created automatically the first time the transform runs.

### Parameters

* **`evaluation_set_name`:** `str`
  * The name of the evaluation set to write evaluations to. Must be a non-empty string.

***

## `ModelInput.create_evaluation`

`palantir_models.transforms.ModelInput.create_evaluation(name: Optional[str] = None) -> Evaluation`

* Creates and returns an [`Evaluation`](#palantir_modelsevaluationsevaluation) for the model loaded by this `ModelInput`.
* Must be called from within a transform decorated with [`@pm.transforms.evaluation`](#palantir_modelstransformsevaluation).
* The returned evaluation is associated with the model version produced or used by the transform. At the end of a successful build, the evaluation is automatically committed to the evaluation set; if the build fails, the evaluation is aborted.
* Calling `create_evaluation` more than once in the same transform returns the same evaluation instance.

```python
evaluation = model_input.create_evaluation(name="my-evaluation")
```

### Parameters

* **`name`:** `Optional[str]`
  * The name of the evaluation. If not provided, the evaluation set name is used. Names do not need to be unique; reused names are automatically made unique.

***

## `palantir_models.evaluations.Evaluation`

A class for logging the results of a model evaluation. An `Evaluation` is created from a `ModelInput` using [`create_evaluation`](#modelinputcreate_evaluation) and captures how a single model version performs against a set of test data.

Unlike an [experiment](/docs/foundry/integrate-models/experiment-reference/), an evaluation records a single snapshot of results rather than a stepped time series, so its logging methods do not accept a `step` argument.

| Function | Description |
| --- | --- |
| [`log_metric(key, value)`](#evaluationlog_metric) | Log a single metric to the evaluation. |
| [`log_metrics(metrics)`](#evaluationlog_metrics) | Log a set of metrics to the evaluation. |
| [`log_image(name, image, caption)`](#evaluationlog_image) | Log an image to the evaluation. |
| [`log_plot(name, plot_data, description)`](#evaluationlog_plot) | Log a plot to the evaluation. |
| [`log_table(name, table, description)`](#evaluationlog_table) | Log a table to the evaluation. |

The `evaluation_rid` property returns the resource identifier (RID) of the evaluation.

***

## `Evaluation.log_metric`

`palantir_models.evaluations.Evaluation.log_metric(key: str, value: Union[int, float])`

* Logs a single metric `value` under the given `key`.
* Metric values must be numeric (`int` or `float`).
* Logging to an existing key overwrites the previous value.

```python
evaluation.log_metric("mae", 14250.0)
```

### Parameters

* **`key`:** `str`
  * The name of the metric to write.
* **`value`:** `Union[int, float]`
  * The numeric value to write.

***

## `Evaluation.log_metrics`

`palantir_models.evaluations.Evaluation.log_metrics(metrics: Dict[str, Union[int, float]])`

* The batched version of [`log_metric`](#evaluationlog_metric).
* All values must be numeric (`int` or `float`).

```python
evaluation.log_metrics({
    "mae": 14250.0,
    "r2": 0.91,
})
```

### Parameters

* **`metrics`:** `Dict[str, Union[int, float]]`
  * A mapping of metric name to numeric metric value.

***

## `Evaluation.log_image`

`palantir_models.evaluations.Evaluation.log_image(name: str, image: Union[str, bytes, "PIL.Image.Image"], caption: Optional[str] = None)`

* Logs an image to the evaluation.
* The image must be a path to a PNG image, PNG image bytes, or a [Pillow ↗](https://pillow.readthedocs.io/en/stable/index.html) image. Other image formats are rejected.

```python
evaluation.log_image("residual_distribution", pillow_image)
evaluation.log_image(
    "error_heatmap",
    "path/to/image.png",
    caption="Geographic error heatmap",
)
```

### Parameters

* **`name`:** `str`
  * The name of the image to write.
* **`image`:** `Union[str, bytes, "PIL.Image.Image"]`
  * The image to write.
* **`caption`:** `Optional[str]`
  * Optional caption to write alongside the image.

***

## `Evaluation.log_plot`

`palantir_models.evaluations.Evaluation.log_plot(name: str, plot_data: "plotly.graph_objects.Figure", description: Optional[str] = None)`

* Logs a plot to the evaluation.
* The plot must be a [Plotly ↗](https://plotly.com/python/) `plotly.graph_objects.Figure`. Other plot types are rejected.

```python
import plotly.express as px

fig = px.box(df, x="price_tier", y="residual", title="Residuals by price tier")
evaluation.log_plot(
    "residuals_by_tier",
    fig,
    description="Residual distribution across all price tiers",
)
```

### Parameters

* **`name`:** `str`
  * The name of the plot to write.
* **`plot_data`:** `"plotly.graph_objects.Figure"`
  * The plot to write.
* **`description`:** `Optional[str]`
  * Optional description to write alongside the plot.

***

## `Evaluation.log_table`

`palantir_models.evaluations.Evaluation.log_table(name: str, table: Union["polars.DataFrame", "pandas.DataFrame"], description: Optional[str] = None)`

* Logs a table to the evaluation.
* The table must be either a [pandas ↗](https://pandas.pydata.org/docs/) or [Polars ↗](https://pola.rs/) DataFrame. Other data types are rejected.

```python
import pandas as pd

error_by_tier = pd.DataFrame({
    "price_tier": ["affordable", "mid_range", "luxury"],
    "mae": [8200.0, 15400.0, 42300.0],
    "r2": [0.94, 0.91, 0.87],
})

evaluation.log_table("error_by_price_tier", error_by_tier)
```

### Parameters

* **`name`:** `str`
  * The name of the table.
* **`table`:** `Union["polars.DataFrame", "pandas.DataFrame"]`
  * The table data to write.
* **`description`:** `Optional[str]`
  * Optional description to write alongside the table.

***
