<!-- source: https://palantir.com/docs/foundry/cipher/cipher-marketplace/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Add Cipher resources to a Marketplace product

Use [Foundry DevOps](/docs/foundry/devops/overview/) to include Cipher in [Marketplace products](/docs/foundry/devops/core-concepts/#product) for other users to install and reuse. [Learn how to create a Marketplace product](/docs/foundry/foundry-devops/create-products/) to get started.

## Supported features

We support packaging [Cipher channels](/docs/foundry/cipher/core-concepts/#channels) and [licenses](/docs/foundry/cipher/core-concepts/#licenses) in Marketplace products. When packaging Cipher resources in Marketplace products, keep the following in mind:

* When installing a Marketplace-packaged Cipher channel, it will maintain the same cryptographic algorithm, but will auto-generate a new cryptographic key.
* When installing a Marketplace-packaged Cipher license that optionally specifies an expiration date, it will maintain the same expiration date upon installation.

## Package Cipher resources

1. Navigate to the Marketplace application.

2. Select **DevOps** at the bottom of the page, then **Select store** on the DevOps page. In the **Select your store** dialog choose your store.
   * If you have already chosen a store, you can select the store name in the upper right to open the **Select a store** dialog to choose a different store if needed.

3. To add a Cipher channel or license to a product, you can create a new product or edit an existing product.
   * To create a new product, select **+ New product**. Follow the [product creation tutorial](/docs/foundry/foundry-devops/create-products/) for additional guidance.
   * To edit an existing product, select the product and then select **Start new version** on the top right.

4. Choose the **Add files** option to navigate to the Cipher resource from within the [Compass](/docs/foundry/compass/overview/) filesystem and add it to your product.

5. Select the appropriate resources.

6. When you finish editing the Marketplace product, open the **Review and publish** tab and select **Publish**.

:::callout{theme="neutral"}
To ensure that the datasets your Cipher resources are built on do not become stale, consider building in a schedule. For more information, refer to [adding schedules to products](/docs/foundry/building-pipelines/marketplace-schedules/).
:::
