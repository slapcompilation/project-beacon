<!-- source: https://palantir.com/docs/foundry/model-integration/getting-started/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Getting started

Prior to starting modeling workflows, ensure you have a high-level understanding of core Foundry concepts, [Code Repositories](/docs/foundry/code-repositories/overview/), [Python transforms](/docs/foundry/transforms-python/overview/), [Ontology](/docs/foundry/ontology/overview/), and [Functions](/docs/foundry/functions/overview/).

If you are new to Foundry, the [supervised learning tutorial](/docs/foundry/model-integration/tutorial-intro/) provides a walkthrough from setting up a new project to deploying a model into production.

Review the [dedicated page](/docs/foundry/model-integration/what-to-use/) to learn more about the considerations involved in choosing the right tool.

## Common model creation workflows

* Train a model with data from the Palantir platform in a Jupyter® [code workspace](/docs/foundry/integrate-models/model-asset-code-workspaces/), [code repository](/docs/foundry/integrate-models/model-asset-code-repositories/), or in a [model studio](/docs/foundry/model-integration/model-studio/) for no-code model training
* [Import model weights and register them as a model](/docs/foundry/integrate-models/model-asset-files/)
* [Import and register a container as a model](/docs/foundry/integrate-models/container-model-adapter-example/)
* [Register an externally hosted model](/docs/foundry/integrate-models/external-model-connection/)

## Deploying a model for inference and consumption

* [Using a model as an input to Python transforms](/docs/foundry/integrate-models/model-asset-code-repositories/#run-inference-in-python-transforms)
* [Using a model in Pipeline Builder](/docs/foundry/pipeline-builder/transforms-trained-model/)
* [Creating a batch deployment in Modeling Objectives](/docs/foundry/model-integration/tutorial-productionize/#42-how-to-create-a-batch-deployment-for-batch-processing) and [evaluating model performance](/docs/foundry/evaluate-models/model-evaluation-automatic/)
* [Configuring a live deployment to serve the model as a REST endpoint](/docs/foundry/manage-models/set-up-live/)

## Registering a model for use in the Ontology

* [Register a live deployment to be used as a function](/docs/foundry/model-integration/functions-on-models/)
* [Use the model function in another function to write custom business logic using model predictions](/docs/foundry/functions/functions-on-models/)
