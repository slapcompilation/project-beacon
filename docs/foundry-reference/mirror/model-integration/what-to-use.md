<!-- source: https://palantir.com/docs/foundry/model-integration/what-to-use/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Selecting the right modeling tool

Palantir's modeling suite of products enables users to develop, manage, and operationalize models. This page compares different products to help you choose the right tool for your needs.

For guided assistance with modeling tasks, [AI FDE](/docs/foundry/ai-fde/overview/) offers a dedicated **Machine learning** mode that helps you train, evaluate, deploy, and tune models. The agent can guide you through the full workflow, from feature engineering through model training and deployment, using either [Model Studio](/docs/foundry/model-integration/model-studio/) or pro-code repositories. To get started, select the machine learning mode from the AI FDE mode selector or describe your modeling task and let the agent select the mode automatically.

## Feature engineering

| Product | Details   |
|---------|-------------------|
| [Pipeline Builder](/docs/foundry/pipeline-builder/overview/) | Large scale point-and-click data transformation |
| [Code Workspaces](/docs/foundry/code-workspaces/overview/) | Interactive, pro-code data analysis and transformation in familiar environments such as JupyterLab®|
| [Python Transforms](/docs/foundry/transforms-python/overview/) | PySpark data pipeline development in Foundry's web-based IDE, [Code Repositories](/docs/foundry/model-integration/tutorial-train-code-repositories/) |

## No-code model training

No-code model training tools are available in [Model Studio](/docs/foundry/model-integration/model-studio/), providing a simple point-and-click interface for creating production-grade machine learning models.

## Pro-code model training

### Available libraries

The `palantir_models` library provides flexible tooling to publish and consume models within the Palantir platform, using the concept of [**model adapters**](/docs/foundry/integrate-models/model-adapter-overview/). The `foundry_ml` library, its predecessor, has been formally deprecated as of [October 2025](/docs/foundry/announcements/2024-02/#the-foundry_ml-python-library-will-be-deprecated-in-favor-of-the-palantir_models-library-on-october-31-2025).

### Code authoring environments

| Product | Library support | Details     |
|---------|-------------------|------------|
| [Code Workspaces](/docs/foundry/code-workspaces/training-models/) | `palantir_models` | Interactive model development in Jupyter® notebooks |
| [Code Repositories](/docs/foundry/model-integration/tutorial-train-code-repositories/) | `palantir_models`| Powerful web-based IDE with native CI/CD features and support for modeling workflows; less interactive than notebooks |

### Training metrics tracking

| Product | Details |
|---------|---------|
| [Experiments](/docs/foundry/model-integration/experiments/) | Framework for logging metrics and hyperparameters during a model training job

### Post-training evaluation

| Product | Details |
|---------|---------|
| [Evaluations](/docs/foundry/model-integration/evaluations/) | Framework for logging evaluation metrics back to the model

## Batch inference

Models can be used for running large scale batch inference pipelines across datasets.

| Product | Details     | Caveats |
|---------|-------------------|-----|
| [Pipeline Builder](/docs/foundry/pipeline-builder/transforms-trained-model/) | No-code model inference directly on the pipeline canvas using the [trained model node](/docs/foundry/pipeline-builder/transforms-trained-model/). Models run as isolated sidecars alongside Spark executors and automatically use the latest model version. | Only supports models with a single tabular input and output. Streaming and Lightweight execution modes are not yet supported. |
| [Python transforms](/docs/foundry/integrate-models/model-asset-code-repositories/#run-inference-in-python-transforms) | Batch inference can be run directly in Python transforms. Supports [pinning a specific model version](/docs/foundry/integrate-models/transform-model-input/#specifying-a-version). | Using the [`@lightweight` decorator](/docs/foundry/api-reference/transforms-python-library/api-transform/#transforms.api.transform.using) and [model sidecars](/docs/foundry/integrate-models/transform-model-input/#running-models-as-sidecar-containers) is recommended. |
| [Modeling objective](/docs/foundry/model-integration/objectives/) [batch deployments](/docs/foundry/manage-models/set-up-batch/) | Modeling Objectives offers broader model management features such as model release management and evaluation. | Does not support multi-output and external models, [models as sidecars](/docs/foundry/integrate-models/transform-model-input/#running-models-as-sidecar-containers), or deployment via Marketplace as [detailed here](/docs/foundry/model-integration/marketplace-models/). |
| [Jupyter® Notebook](/docs/foundry/code-workspaces/training-models/) | Users can create scheduled training and/or inference jobs [directly from Code Workspaces](/docs/foundry/code-workspaces/training-models/#transforms). | Only supports running inference models created from the same notebook; use Python Transforms to orchestrate models created elsewhere. |

## Model deployment

Models can be deployed in Foundry behind a REST API; deploying a model operationalizes the model for use both inside and outside of Foundry.

| Product | Details     |
|---------|-------------------|
| [Model direct deployments](/docs/foundry/manage-models/create-a-model-deployment/) | Auto-upgrading model deployments; best for quick iteration and deployment.|
| [Modeling objective](/docs/foundry/model-integration/objectives/) [live deployments](/docs/foundry/manage-models/set-up-live/) | Production-grade modeling project management; modeling objectives provide tooling for model release management and evaluation. Does not support deployment via Marketplace as [detailed here](/docs/foundry/model-integration/marketplace-models/). |

[Learn more about the difference between direct deployments and deployments through modeling objectives.](/docs/foundry/manage-models/create-a-model-deployment/#comparison-direct-model-deployments-vs-modeling-objective-live-deployments)

## Functions integration

Publishing models as functions makes it easy to use models for live inference in downstream Foundry applications, including [Workshop](/docs/foundry/workshop/functions-use/), [Slate](/docs/foundry/slate/concepts-foundry-functions/), [actions](/docs/foundry/action-types/function-actions-overview/), and [more](/docs/foundry/functions/use-functions/).

| Product | Best for     |
|---------|-------------------|
| [Direct function publication](/docs/foundry/model-integration/functions-on-models/) | No-code function creation on models with live deployments, allowing integration with the Ontology. The same functionality is available in the Model and Modeling Objectives applications. |
| [Importing model functions into Functions repositories](/docs/foundry/functions/functions-on-models/#write-a-model-backed-typescript-v1-function) | Import model functions into TypeScript v1, v2 or Python functions to further process predictions (for example, make ontology edits) with support for Model API type checking. |
