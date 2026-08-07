<!-- source: https://www.palantir.com/docs/foundry/superrepo/prepare-first-deploy/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Prepare for your first deployment

:::callout{theme="neutral" title="Beta"}
SuperRepo is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

SuperRepo deployment is built on Foundry [Marketplace](/docs/foundry/marketplace/overview/). Your SuperRepo compiles into a native [Marketplace product](/docs/foundry/marketplace/foundry-products/), which you install on an enrollment with the [Foundry CLI](/docs/foundry/superrepo/foundry-cli/).

You can deploy from anywhere, depending on where your SuperRepo source lives: from the Palantir platform through Foundry CI (Jemma), from your own machine, or from any CI system.

## Step 1: Configure your deployment

Configure your deployment target and map required inputs, such as the target namespace, [Project](/docs/foundry/getting-started/projects-and-resources/), and website domain.

Run `foundry deploy configure` from your SuperRepo root. It walks you through the configuration interactively.

When it completes, it writes `env.yml` to your repository root. This file holds your deployment configuration and is reused by every subsequent deployment.

Commit `env.yml` to your repository. Foundry CI reads it when you deploy by tag, as described in [Deploy from the Palantir platform](#deploy-from-the-palantir-platform).

To change any input later, run `foundry deploy configure` again.

![The interactive foundry deploy configure flow prompting for deployment inputs in the terminal.](/docs/resources/foundry/superrepo/foundry-deploy-configure.png)

## Step 2: Deploy

Once you have successfully configured your deployment and you have your `env.yml` file, you can deploy your product to your Foundry enrollment.

### Deploy from the Palantir platform

If your source is hosted inside the Palantir platform, tag your SuperRepo repository and Foundry CI handles the rest.

1. Open your repository in the in-platform [VS Code editor](/docs/foundry/vs-code/overview/).
2. Select **Tag version** in the top-right corner.
3. Enter a tag name and select **Create tag**.

![The Tag version dialog with fields to enter a tag name and create a tag.](/docs/resources/foundry/superrepo/create-tag.png)

Creating a tag triggers a deployment job. To follow its progress, open the **Tags** tab and select the entry in the **Checks** column.

![The Tags tab showing a deployment entry in the Checks column.](/docs/resources/foundry/superrepo/checks-column.png)

### Deploy from outside the Palantir platform

:::callout{theme="neutral"}
To deploy from outside Foundry CI, the `FOUNDRY_TOKEN` environment variable must be set to a token with Foundry DevOps publishing permissions. Review [Authenticate with Foundry](/docs/foundry/superrepo/foundry-cli/#authenticate-with-foundry) for how the CLI reads this variable.
:::

If your source is hosted elsewhere, build and deploy from your terminal or any CI system:

```bash
pnpm run build && foundry deploy
```

Both deployment paths read the same `env.yml`.

![The foundry deploy command output showing that it reads configuration from env.yml.](/docs/resources/foundry/superrepo/read-env-yml.png)

## Step 3: Verify your installation

Once your deployment step succeeds, you can view your installation in [Marketplace](/docs/foundry/marketplace/installations/).

![The Marketplace installation page showing the deployed SuperRepo installation.](/docs/resources/foundry/superrepo/view-installation-marketplace.png)

If you have an [Ontology SDK React application](/docs/foundry/ontology-sdk-react-applications/overview/), two more steps are required before your application is reachable. Open your installed [Developer Console](/docs/foundry/developer-console/overview/) application, then:

1. Under **Website hosting > Website domain**, confirm that your website domain is approved.
2. Under **Website hosting > Assets**, confirm that the latest asset is deployed. If it is not, select the options menu next to your version and choose **Deploy to production**.

![The Developer Console website hosting configuration used to deploy the application to production.](/docs/resources/foundry/superrepo/deploy-to-production.png)
