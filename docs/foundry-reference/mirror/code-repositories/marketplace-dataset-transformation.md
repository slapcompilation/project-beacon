<!-- source: https://palantir.com/docs/foundry/code-repositories/marketplace-dataset-transformation/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Add dataset transformation to a Marketplace product

Use [Foundry DevOps](/docs/foundry/devops/overview/) to include your dataset transformations in [Marketplace products](/docs/foundry/devops/core-concepts/#product) for other users to install and reuse. [Learn how to create your first product.](/docs/foundry/foundry-devops/create-products/)

## Supported features

When packaging a dataset transformation (along with its producing Code Repository), all required dependencies are stored as part of the product; this guarantees that the transformation is self-contained and can run successfully anywhere. Repositories can bring Maven, PyPI, and Conda dependencies.

Python, Java, and SQL transformations are supported. Transformations must be produced from a repository with a recent template, otherwise packaging errors may occur. To debug, upgrade your repository in the Code Repositories application. If a transformation can be successfully packaged, it will not cause any installation or runtime errors.

:::callout{theme="warning"}
**The dataset you provide as an input at the time of installation must have column names and variable types that are identical to the source dataset.**

This is because all dataset columns from the source input datasets (for example, an `airplane` dataset used as an input to a dataset transformation, which is then included in a Marketplace product) will be required inputs when [installing](/docs/foundry/marketplace/install-product/), whether or not the columns are referenced in the dataset transformation.
:::

Supported features include:

* Incremental transforms
* Unmarking workflows
* Spark profiles
* Telemetry
* Libraries
* External transforms
* Schemaless datasets

## Adding dataset transformations to products

To add a dataset transformation to a product, first [create a product](/docs/foundry/foundry-devops/create-products/), then [add outputs](/docs/foundry/foundry-devops/create-products/#add-outputs). Choose the **Add files** option to navigate to the dataset transformation from within the [Compass](/docs/foundry/compass/overview/) filesystem and add it to your product.

In some cases, one transformation may produce multiple output datasets. If this is the case, all produced datasets need to be included in the product.

![select repo packaging](./images/marketplace-repo-packaging.png)

### Repository packaging options

There are three ways to package a repository.

* **Exclude all source code:** The repository is packaged without any source code. The only purpose of the repository is to hold the dependencies required when running the transformation. This method includes the compiled user code and all transitive dependencies.
* **Include latest source code, exclude version history:** The repository contains both the source code and the necessary artifacts; however, the Git history (including tags) is not persisted. This is the recommended way to ship repositories as read-only documentation.
* **Include source code and full version history:** The repository is persisted in the product as-is. The entire Git history is saved at packaging time and restored at installation time. This is the only mode which allows you to run checks and rebuild the transformations from within the Code Repositories application after installation.
