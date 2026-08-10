<!-- source: https://palantir.com/docs/foundry/manage-models/modeling-objective-settings/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Modeling Objective settings

A modeling objective has a number of configuration options available and described below. You can navigate to the Modeling Objective settings page from the Modeling Objective home page by clicking **Modeling objective settings** at the top-right of the interface.

## Checks

Objective checks are a way to ensure that models pass predefined quality checks before a model is operationalized. Full details of objective checks are available in the documentation on [how to set up checks for all submissions](/docs/foundry/manage-models/set-up-checks/).

## Deployments

The deployment settings page defines the model submission deployment profile requirements for Python model submissions before they can be operationalized in a batch or live deployment.

![Deployment Settings](/docs/resources/foundry/manage-models/settings_deployment-settings.png)

## Model metadata

Models that are submitted to a modeling objective can have model submission-specific metadata inside a modeling objective. That metadata can be configured for a certain objective to ensure relevant information about the models are tracked. For full configuration details, see the documentation on [how to configure objective metadata](/docs/foundry/manage-models/configure-objective-metadata/).

## Appearance

With appearance settings, you can configure whether an individual modeling objective will display in light mode or dark mode.

![Deployment Settings](/docs/resources/foundry/manage-models/settings_appearance-settings.png)

## Advanced

The advanced settings page has non-standard configuration options. Typically, the advanced settings for a modeling objective should not be adjusted. These settings are provided to allow for backward compatibility with legacy functionality.

### Evaluation settings

There are two advanced configuration options for the evaluation dashboard: **Only show metrics produced by evaluation configuration** and **Show pinned tabs in evaluation dashboard**.

![Advanced Evaluation Settings](/docs/resources/foundry/manage-models/settings_advanced-evaluation-settings.png)

#### Only show metrics produced by evaluation configuration

When a modeling objective is set to only show metrics produced by evaluation configuration, then only metrics created via the [evaluation configuration](/docs/foundry/evaluate-models/model-evaluation-automatic/) will be displayed on the [evaluation dashboard](/docs/foundry/evaluate-models/review-model-metrics/). We recommend enabling this setting to ensure a standard evaluation process for models in your modeling objective. If this setting is not enabled, it is not possible for your modeling objective to know whether the displayed model metrics are up to date.

:::callout{theme="neutral"}
Metric pipelines configured via legacy pipeline management will not be displayed unless **Only show metrics produced by evaluation configuration** is toggled off.
:::

In some circumstances, such as for modeling objectives which were configured before evaluation configuration was released or for non-production modeling objectives that have [metrics defined in code](/docs/foundry/evaluate-models/model-evaluation-code/), it may be preferable to display the metrics from outside of the modeling objective evaluation configuration, which can be enabled with this setting.

#### Show pinned tabs in evaluation dashboard

Optionally, the evaluation dashboard on a modeling objective can be configured to display [custom metric views](/docs/foundry/evaluate-models/review-model-metrics/) alongside subset tabs on the evaluation dashboard.

### Inference and metrics dataset naming

Datasets produced by legacy metrics pipeline management could create naming conflicts if multiple modeling objectives created inference and metrics datasets in the same output folder, leading to unexpected behavior. This is resolved in the updated evaluation dashboard and configuration.

To maintain backwards compatibility, it is possible to use the legacy inference and metrics dataset naming scheme.

#### Updated naming convention:

* Inference datasets: `inference_<Model Submission Name>_<Evaluation Dataset Name>-<Generated Hash>`
* Metrics datasets: `metrics_<Model Submission Name>_<Evaluation Dataset Name>_<Evaluation Library Name>-<Generated Hash>`

#### Legacy naming convention:

* Inference datasets: `<Model Submission Name> inference`
* Metrics datasets: `<Model Submission Name> metrics`
