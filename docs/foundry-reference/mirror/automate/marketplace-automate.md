<!-- source: https://palantir.com/docs/foundry/automate/marketplace-automate/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Add automations to a Marketplace product

Use [Foundry DevOps](/docs/foundry/devops/overview/) to include your automations in [Marketplace products](/docs/foundry/devops/core-concepts/#product) for other users to install and reuse. [Learn how to create your first product.](/docs/foundry/foundry-devops/create-products/)

:::callout{theme="warning"}
The following Automation features are not supported by Marketplace products:

* Automations using [saved object sets](/docs/foundry/object-explorer/save-explorations/).
* Automations with recipients that are not groups.
:::

:::callout{theme="warning"}
Automations that use an [action](/docs/foundry/automate/effect-actions/) or [AIP Logic](/docs/foundry/automate/effect-logic/) effect cannot be installed in "production" mode as automations with these effects do not automatically upgrade.
:::

## Add automations to products

To add an Automation to a product, first [create a product](/docs/foundry/foundry-devops/create-products/), then [add outputs](/docs/foundry/foundry-devops/create-products/#add-outputs). Choose the **Add files** option to navigate to the automation from within the [Compass](/docs/foundry/compass/overview/) filesystem and add it to your product.
