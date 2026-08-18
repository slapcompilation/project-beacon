<!-- source: https://palantir.com/docs/foundry/integrate-models/evaluations-builtin/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Built-in evaluators

`palantir_models` includes prebuilt evaluators for standard regression and classification models. A built-in evaluator runs inference on your model, compares the predictions against a ground-truth column, and logs a standard set of metrics to the [evaluation](/docs/foundry/integrate-models/evaluations-overview/) for you, so you do not have to compute common metrics by hand.

Built-in evaluators require `scikit-learn` to be installed in your environment.

## The `evaluate` function

The [`palantir_models.evaluations.evaluate`](/docs/foundry/integrate-models/evaluation-reference/) function drives a built-in evaluator. You provide the model, the input data, the name of the ground-truth column, and an evaluator configuration that selects which evaluator to use.

```python
import palantir_models as pm
from palantir_models.evaluations import evaluate, RegressionEvaluatorConfig
from palantir_models.transforms import ModelInput
from transforms.api import transform, Input


@pm.transforms.evaluation("error_analysis")
@transform.using(
    test_data=Input("/Housing/clean/test_set"),
    housing_model=ModelInput("/Housing/models/price_regressor", use_sidecar=True),
)
def compute(test_data, housing_model):
    evaluate(
        model=housing_model,
        inputs=test_data.pandas(),
        targets="actual_price",
        prediction_column="predicted_price",
        evaluator_config=RegressionEvaluatorConfig(),
    )
```

When called inside a transform decorated with [`@pm.transforms.evaluation`](/docs/foundry/integrate-models/evaluations-overview/#create-evaluations), `evaluate` writes to the evaluation automatically; you do not need to call `create_evaluation` yourself. To log into an evaluation you have already created, pass it with the `evaluation` argument.

`evaluate` returns an `EvaluationResult` whose `metrics` attribute holds the computed metrics. The same metrics are also logged to the evaluation as a side effect.

### Inputs, targets, and predictions

* **`inputs`** are forwarded to the model for inference. A `pandas` or `pyspark` DataFrame is passed as a single argument; a `tuple` is unpacked as positional arguments; a `dict` is unpacked as keyword arguments (unless the model declares a single `map` or `struct` input, in which case the dict is passed through as-is). Spark DataFrames are materialized to `pandas` for metric computation, so the data must fit in memory on the driver.
* **`targets`** is the name of the ground-truth column. It must resolve to exactly one column, looked up in `evaluation_df` if provided, otherwise in `inputs`. Use `evaluation_df` to supply the ground-truth column when it is not part of `inputs`.
* **`prediction_column`** is the name of the column in the model's output that holds the predictions. It defaults to the value of `targets`, so set it explicitly when your model's output column has a different name.

### Model requirements

Because `evaluate` runs inference for you, your model adapter must meet a few requirements:

* **Inference method:** `evaluate` calls your adapter's `predict` method if you have overridden it, and otherwise falls back to `transform`. One of these must run inference, and `predict` should accept one argument per declared API input, matched by name.
* **Input shape:** the shape of `inputs` must match the model's declared API inputs, following the dispatch rules in [Inputs, targets, and predictions](#inputs-targets-and-predictions).
* **Output shape:** inference must return a DataFrame — or an `InferenceResults`, `dict`, `tuple`, or `list` containing DataFrames — and exactly one of those DataFrames must contain the `prediction_column`. Evaluation fails if no output DataFrame contains the column, or if more than one does.
* **Probability columns:** for classification `roc_auc`, the configured probability columns must also be present in the output.

## Regression

Use `RegressionEvaluatorConfig` for models that predict continuous values. The regression evaluator logs the following metrics:

| Metric | Description |
| --- | --- |
| `example_count` | Number of examples evaluated. |
| `mean_absolute_error` | Mean absolute error (MAE). |
| `mean_squared_error` | Mean squared error (MSE). |
| `root_mean_squared_error` | Root mean squared error (RMSE). |
| `r2` | R² (coefficient of determination). |
| `max_error` | Maximum residual error. |
| `mean_absolute_percentage_error` | Mean absolute percentage error (MAPE). |

```python
from palantir_models.evaluations import evaluate, RegressionEvaluatorConfig

evaluate(
    model=housing_model,
    inputs=test_data.pandas(),
    targets="actual_price",
    prediction_column="predicted_price",
    evaluator_config=RegressionEvaluatorConfig(),
)
```

## Classification

Use `ClassificationEvaluatorConfig` for binary and multiclass classifiers. Whether the evaluator treats the problem as binary or multiclass is determined automatically from the number of unique classes found across the predictions and labels.

All classification evaluations log the following metrics:

| Metric | Description |
| --- | --- |
| `example_count` | Number of examples evaluated. |
| `accuracy` | Overall accuracy. |
| `precision` | Precision. |
| `recall` | Recall. |
| `f1` | F1 score. |

In addition:

* **Binary classifiers** also log the confusion-matrix counts `true_positives`, `true_negatives`, `false_positives`, and `false_negatives`.
* **Multiclass classifiers** compute `precision`, `recall`, and `f1` using the averaging strategy set by the `average` configuration option.
* When class probabilities are supplied, `roc_auc` is also logged using a one-vs-rest scheme.

### Configuration options

| Option | Type | Description |
| --- | --- | --- |
| `average` | `"weighted"` (default), `"micro"`, `"macro"`, or `"samples"` | Averaging strategy for `precision`, `recall`, `f1`, and `roc_auc` on multiclass models. Ignored for binary classifiers. |
| `class_probabilities_columns` | `Optional[List[str]]` | One model-output column per class, ordered by class index. Required for `roc_auc`. |
| `class_probability_column` | `Optional[str]` | A single model-output column whose row values are array-likes of per-class probabilities. Required for `roc_auc`. |

Supply class probabilities through **exactly one** of `class_probabilities_columns` or `class_probability_column`; providing both raises an error. The referenced columns must be present in the model's output. Without probabilities, `roc_auc` is omitted.

```python
from palantir_models.evaluations import evaluate, ClassificationEvaluatorConfig

evaluate(
    model=churn_model,
    inputs=test_data.pandas(),
    targets="churned",
    prediction_column="prediction",
    evaluator_config=ClassificationEvaluatorConfig(
        average="macro",
        class_probability_column="class_probabilities",
    ),
)
```

## Group built-in metrics into subsets

Every evaluator configuration accepts a `subset` option. When set, all metrics logged by that evaluator are prefixed with `subset/`, which groups them as a [subset](/docs/foundry/integrate-models/evaluations-overview/#subsets) on the model page. This lets you run the same evaluator over different slices of your data and compare them.

```python
from palantir_models.evaluations import evaluate, RegressionEvaluatorConfig

# Evaluate each price tier separately and group the metrics under that tier.
for tier, group in test_data.pandas().groupby("price_tier"):
    evaluate(
        model=housing_model,
        inputs=group,
        targets="actual_price",
        prediction_column="predicted_price",
        evaluator_config=RegressionEvaluatorConfig(subset=tier),
    )
```

This logs metrics such as `affordable/mean_absolute_error` and `luxury/r2`.

Review the [model evaluations Python API reference](/docs/foundry/integrate-models/evaluation-reference/) for full method signatures.
