<!-- source: https://palantir.com/docs/foundry/integrate-models/evaluations-faq/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Evaluations FAQ

## How is an evaluation different from an experiment?

An [experiment](/docs/foundry/integrate-models/experiments-overview/) tracks a model training run: it records parameters and stepped metric series as the model trains, and integrates with MLflow. An [evaluation](/docs/foundry/integrate-models/evaluations-overview/) captures a single snapshot of how a finished model version performs against a set of test data. The two use different APIs: experiments are written from a `ModelOutput`, while evaluations are written from a `ModelInput`.

## Where can I author evaluations?

Evaluations are authored in [Code Repositories](/docs/foundry/integrate-models/model-asset-code-repositories/), using the [`@pm.transforms.evaluation`](/docs/foundry/integrate-models/evaluations-overview/#create-evaluations) decorator together with a `ModelInput`. See [Author and run evaluations](/docs/foundry/integrate-models/evaluations-writing/) for a complete example.

## Why does writing an evaluation fail with a permission error?

Evaluations can only be written to a model that is in the **same project** as the code repository where the evaluation logic runs. If the model and the repository are in different projects, the write is denied. Move the model or the repository so that they share a project.

## Which model version does an evaluation apply to?

An evaluation is always linked to the single model version that the `ModelInput` resolves and loads into the transform. By default this is the latest version on the build's branch; you can pin a version with `model_version` or target a branch with `branch`. See [Determine which model version is evaluated](/docs/foundry/integrate-models/evaluations-writing/#determine-which-model-version-is-evaluated).

## How do I evaluate a new model version that was just created?

To evaluate a new model version, you can either [setup a schedule](/docs/foundry/integrate-models/evaluations-visualize/#create-a-schedule) that will run the evaluation logic whenever a new model version is published, or navigate to the evaluations view and run the evaluation using the [**Run** option](/docs/foundry/integrate-models/evaluations-visualize/#running-an-evaluation) at the top of the page.

## Do evaluation names need to be unique?

No. Reused names are automatically made unique, so the same code can run multiple times without renaming. If you do not provide a name, the evaluation set name is used.

## What happens to an evaluation if my build fails?

Nothing is published. The evaluation is committed to its evaluation set only when the build succeeds; if the build fails, the evaluation is aborted.

## How do I evaluate the same model in more than one way?

Use a separate evaluation set for each methodology. Because the set name is fixed in the transform definition by the decorator, define a separate transform with a different set name for each distinct analysis. A model can have up to 100 evaluation sets.

## How do I compare evaluations across model versions?

An [evaluation set](/docs/foundry/integrate-models/evaluations-overview/#evaluation-sets) holds all of the evaluations produced by the same methodology across model versions. Because every evaluation is tied to a specific version, you can compare how a metric evolves on the model page as the model is retrained.

## What types of data can I log to an evaluation?

Metrics (numeric values), images (PNG or Pillow images), plots (Plotly figures), and tables (pandas or Polars DataFrames). You can group related logs into [subsets](/docs/foundry/integrate-models/evaluations-overview/#subsets) using a `prefix/name` convention. See the [Limits](/docs/foundry/integrate-models/evaluations-overview/#limits) for size and length constraints.

## Do I need scikit-learn to write evaluations?

Only if you use the [built-in evaluators](/docs/foundry/integrate-models/evaluations-builtin/). Logging your own metrics, images, plots, and tables does not require scikit-learn.
