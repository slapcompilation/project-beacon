<!-- source: https://palantir.com/docs/foundry/model-studio/core-concepts/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Core concepts

This page introduces the core concepts behind [Model Studio](/docs/foundry/model-studio/overview/).

## Models

[Models](/docs/foundry/integrate-models/integrate-overview/) provide a common interface for integrating models in Foundry. Model Studio training runs produce a model that can be used in downstream applications like [Python transforms](/docs/foundry/integrate-models/transform-model-input/), [Pipeline Builder](/docs/foundry/pipeline-builder/transforms-trained-model/), [functions](/docs/foundry/model-integration/functions-on-models/), and more.

### Experiments

[Experiments](/docs/foundry/model-integration/experiments/) are artifacts that represent a collection of metrics produced during a model training job. Each model version produced by Model Studio will have an associated experiment that displays representative parameters and metrics about the training job. For example, some trainers may render a graph of a model ensemble that was produced during training under the **Plots** tab.

## Trainers

Model studio trainers are the actual model training implementation that is used to train a model. Each trainer is targeted at a specific task.

* **[Time series forecasting](/docs/foundry/model-studio/trainers-timeseries-forecasting/):** Predicts future values by analyzing patterns in training data.
* **[Regression](/docs/foundry/model-studio/trainers-regression/):** Predicts continuous numeric values by learning relationships between input features and target variables in the training data.
* **[Classification](/docs/foundry/model-studio/trainers-classification/):** Assigns input data to predefined categories or classes by identifying patterns and distinctions in training data.

## Training jobs

Training jobs launched from Model Studio will always run against the latest training configuration. Running multiple jobs in a row will continue to use the same configuration, although outputs may change due to changing input data. Each run is tracked and can be viewed in the [Model Studio home page](/docs/foundry/model-studio/navigation/#home-page).

Training jobs run as standard transforms in Foundry, meaning that data lineage is respected and any markings applied to input datasets will be applied to the output model.

Compute usage is measured and reported as Foundry compute-seconds. Review our [usage types documentation](/docs/foundry/resource-management/usage-types/) for more details.

## Parameters

Each trainer defines a set of parameters that can be used to control the training job. Trainers also offer distinct parameters that are specific to that trainer.

When configuring a model studio, in-platform documentation will provide details about given parameters. You can view a trainer's documentation page to learn more about that trainer's parameters.
