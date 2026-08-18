<!-- source: https://palantir.com/docs/foundry/integrate-models/evaluations-writing/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Author and run evaluations

This page shows how to write a transform that computes and logs an [evaluation](/docs/foundry/integrate-models/evaluations-overview/), how to control which model version is evaluated, how to break results into [subsets](/docs/foundry/integrate-models/evaluations-overview/#subsets), and how to evaluate versions on other branches.

:::callout{theme="warning"}
The code repository where you author evaluation logic must be in the **same project** as the model you are evaluating. If the model and the repository are in different projects, writing the evaluation fails with a permission error. Move the model or the repository so that they share a project.
:::

## A complete example

The example below evaluates a regression model that predicts house prices against a held-out test dataset. The test dataset contains the input features, an `actual_price` ground-truth column, and a `price_tier` column labeling each row as `affordable`, `mid_range`, or `luxury`.

Ensure that you have [upgraded your code repository](/docs/foundry/code-repositories/repository-upgrades/) and upgraded the `palantir_models` library to `>= 0.2384.0` before writing the evaluation logic.

```python
import plotly.express as px
import palantir_models as pm
from palantir_models.transforms import ModelInput
from transforms.api import transform, Input


@pm.transforms.evaluation("error_analysis")
@transform.using(
    test_data=Input("/Housing/clean/test_set"),
    housing_model=ModelInput("/Housing/models/price_regressor", use_sidecar=True),
)
def compute(test_data, housing_model):
    df = test_data.pandas()

    # Run inference. The exact call depends on your model adapter's API.
    predictions = housing_model.transform(df)["predicted_price"]
    residuals = df["actual_price"] - predictions

    evaluation = housing_model.create_evaluation(name="nationwide")

    # Aggregate error metrics across all predictions.
    evaluation.log_metrics({
        "mae": residuals.abs().mean(),
        "rmse": (residuals ** 2).mean() ** 0.5,
    })

    # A residual distribution plot.
    evaluation.log_plot(
        "residual_distribution",
        px.histogram(residuals, nbins=50, title="Residual distribution"),
    )
```

You can trigger the evaluation by running the transform, same as any other python transform. When the build succeeds, the evaluation is committed to the `error_analysis` evaluation set on the `price_regressor` model. If the build fails, the evaluation is aborted and nothing is published.

## Determine which model version is evaluated

An evaluation is always linked to a single model version: the version that the `ModelInput` resolves and loads into the transform. That same version is the one the evaluation is attached to within the evaluation set, which is what makes it possible to compare the same analysis across versions.

By default, `ModelInput` resolves the latest model version on the build's branch. You can control the resolved version with the `ModelInput` arguments:

* `model_version` pins a specific version. This overrides the `branch` argument.
* `branch` resolves the latest version on a different branch.

```python
# Evaluate a specific, pinned model version.
ModelInput("ri.model.main.model...", model_version="ri.model.main.model-version...")
```

Running the model as a sidecar with `use_sidecar=True` is recommended whenever the model is defined outside the current repository, because it imports the model adapter and its dependencies into a separate container and avoids dependency conflicts. Review the [`ModelInput` class reference](/docs/foundry/integrate-models/transform-model-input/) for details on [specifying a version](/docs/foundry/integrate-models/transform-model-input/#specifying-a-version) and [running models as sidecar containers](/docs/foundry/integrate-models/transform-model-input/#running-models-as-sidecar-containers).

## Construct subsets

[Subsets](/docs/foundry/integrate-models/evaluations-overview/#subsets) group related results under a shared `prefix/name`. A common pattern is to partition the test dataset by a column and log the same metrics for each partition, using the partition value as the prefix.

```python
# Group the test set by price tier and log per-tier error metrics.
for tier, group in df.groupby("price_tier"):
    tier_predictions = housing_model.transform(group)["predicted_price"]
    tier_residuals = group["actual_price"] - tier_predictions

    evaluation.log_metrics({
        f"{tier}/mae": tier_residuals.abs().mean(),
        f"{tier}/rmse": (tier_residuals ** 2).mean() ** 0.5,
    })

    evaluation.log_plot(
        f"{tier}/residuals",
        px.histogram(tier_residuals, nbins=50),
    )
```

This produces `affordable/mae`, `mid_range/mae`, and `luxury/mae` metrics (and matching residual plots) that can be compared side by side on the model page. The prefix is arbitrary, and how you partition the data into subsets is entirely up to you.

## Evaluate versions on other branches

To evaluate a model version that lives on another branch, you have two options:

* **Run the transform on that branch.** When the build runs on a branch, the `ModelInput` resolves the latest model version on that branch by default, so the evaluation is attached to that version.
* **Target the branch from the `ModelInput`.** Set the `branch` argument to resolve the latest version on a specific branch without changing the branch your build runs on.

```python
# Resolve the latest version on the "testing" branch.
ModelInput("ri.models.main.model...", branch="testing")
```

Remember that `model_version` takes precedence over `branch`: if both are provided, the pinned version is used and the branch is ignored.

## Run built-in evaluators

If you are evaluating a standard regression or classification model, you can use the [built-in evaluators](/docs/foundry/integrate-models/evaluations-builtin/) instead of computing metrics by hand. They run inference, compare predictions to a ground-truth column, and log a standard set of metrics to the evaluation for you.

Review the [model evaluations Python API reference](/docs/foundry/integrate-models/evaluation-reference/) for full method signatures.
