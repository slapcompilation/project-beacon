<!-- source: https://palantir.com/docs/foundry/building-pipelines/marketplace-schedules/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Add schedule to a Marketplace product

Use [Foundry DevOps](/docs/foundry/devops/overview/) to include your schedules in [Marketplace products](/docs/foundry/devops/core-concepts/#product) for other users to install and reuse. [Learn how to create your first product.](/docs/foundry/foundry-devops/create-products/)

## Supported features

We support including schedules in Marketplace products that satisfy the following:

* The schedule is not user-scoped.
* The schedule does not have [fallback branches](/docs/foundry/code-repositories/branch-settings/#fallback-branches).
* All [triggers](/docs/foundry/building-pipelines/triggers-reference/) should be defined for the same branch.
* No [triggers](/docs/foundry/building-pipelines/triggers-reference/) or [target](/docs/foundry/building-pipelines/create-schedule/#target-datasets) datasets are [Restricted Views](/docs/foundry/security/restricted-views/).

We strongly recommended that all packaged datasets (excluding static datasets) have a corresponding schedule that builds the dataset as a target. If datasets are included without a schedule, the dataset and anything downstream will become stale.

## Adding schedules to products

To add a schedule to a product, first [create a product](/docs/foundry/foundry-devops/create-products/), then [add outputs](/docs/foundry/foundry-devops/create-products/#add-outputs). Choose the **Schedule** output type.

If you have not yet added any [pipelines](/docs/foundry/pipeline-builder/marketplace-pipeline-builder/) or [dataset transformations](/docs/foundry/code-repositories/marketplace-dataset-transformation/), you will not have any schedules to select. Given this, we typically recommend adding these resource types first. Once you have added a pipeline or dataset transformation, view the **Datasets** content type to review which datasets will not be built, and schedules you could add to your product to remedy this.

![add highlighted schedule](/docs/resources/foundry/building-pipelines/marketplace-add-highlighted-schedules.png)

Select any relevant schedules to include with your product. If you don't see any schedules, you should [create one with your source datasets](/docs/foundry/building-pipelines/create-schedule/) and then [create a new version of your product](/docs/foundry/foundry-devops/manage-products/).

![add schedule dialog](/docs/resources/foundry/building-pipelines/marketplace-schedule-dialog.png)
