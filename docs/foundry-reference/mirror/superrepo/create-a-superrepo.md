<!-- source: https://www.palantir.com/docs/foundry/superrepo/create-a-superrepo/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Create a SuperRepo

:::callout{theme="neutral" title="Beta"}
SuperRepo is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

You can create a SuperRepo in two ways: from the Palantir platform, or from the [Foundry CLI](/docs/foundry/superrepo/foundry-cli/). Once it exists, you can work on it in the Palantir platform or locally in your own editor.

## Option 1: Create in the Palantir platform

1. Navigate to the project where you want to save your SuperRepo repository.
2. Select **New > Code repository**.
3. Select **Applications > SuperRepo**.
4. Modify the repository name, location, and Ontology as needed.
5. When you are ready, select **Open in VS Code** to create and launch the repository in [VS Code workspaces](/docs/foundry/vs-code/overview/).

From VS Code, you can use **Work Locally** to clone the repository to your machine and work on your project with the [Foundry CLI](/docs/foundry/superrepo/foundry-cli/).

## Option 2: Create from the Foundry CLI

Once you have [installed the Foundry CLI](/docs/foundry/superrepo/foundry-cli/#installation), you can create a SuperRepo repository directly from the command line:

```bash
foundry create
```

The CLI prompts you for a project name and a target save location.

Your new SuperRepo contains a folder for each supported component type, which you can use as the starting point for your project.

## Next steps

* Review the [core concepts](/docs/foundry/superrepo/core-concepts/) of the SuperRepo development, build, and deployment lifecycle.
* Follow the [end-to-end tutorial](/docs/foundry/superrepo/tutorial-develop-with-a-superrepo/) to make a change that spans the Ontology, functions, and application layers of your SuperRepo.
* [Prepare for your first deployment](/docs/foundry/superrepo/prepare-first-deploy/) when you are ready to install your product on an enrollment.
