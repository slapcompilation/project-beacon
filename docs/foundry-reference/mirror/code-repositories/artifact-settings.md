<!-- source: https://palantir.com/docs/foundry/code-repositories/artifact-settings/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Artifact settings

:::callout{theme="neutral"}
If you are looking to import and use Python libraries, see the section on [sharing Python libraries](/docs/foundry/transforms-python/share-python-libraries/).
:::

The **Libraries** tab contains a list of repositories that can be referenced in your code repository, which we refer to as backing repositories. This is a list of all shared code repositories in your Foundry environment, as well as external or public libraries. You can use the Libraries tab to discover and add backing repositories.

:::callout{theme="neutral"}
Viewing artifact settings requires the `artifacts:view-repository` permission, and managing artifact settings requires the `artifacts:manage-repository` permission.
:::

![artifact-settings-tab](./images/repository-artifact-settings-tab.png)

### Add a new artifact to your Code Repository

To add a new artifact, select **Add** and choose one of two types of repositories:

1. **Local repositories:** These are other code repositories in your Foundry environment that were configured as a [shared library](/docs/foundry/code-repositories/libraries/).
2. **External repositories:** Artifact repositories stored out of your Foundry environment. These could be external Foundry repositories or public artifact repositories that are available in your environment.

![artifact-settings-add-repository](./images/repository-artifact-settings-add-repo.png)

If the added artifact repository contains references to additional repositories, they will be added as well. The same access permissions are required for all the dependencies of the added repository.

:::callout{theme="neutral"}
When adding a local repository from a different project, a project reference to that repository will be added. This requires `compass:view-project-imports` and `compass:import-resource-to` on your own code repository and `compass:import-resource-from` permission on the referenced shared repository.
:::

:::callout{theme="warning"}
While it is possible to reorder and delete backing repositories, this might break builds of transforms that use packages from those repositories. Only take this action after considering the possible implications.
:::

## Beta OSDK generator versions toggle

When the **Enable beta OSDK versions** option is enabled, users can generate beta (release candidate) ontology generator versions. The toggle is off by default.

![beta-toggle](./images/repository-artifacts-settings-beta-toggle.png)

To enable beta OSDK versions:

1. Navigate to the **Branches** tab and ensure you are on the default branch.
2. Inside the repository's functions.json file, add `"allowBetaGeneratorVersions": true` to the file. To discover this file, the **Show hidden files** toggle may have to be enabled by selecting the cogwheel at the top near the Files header.

![beta-field-functions-json](./images/repository-artifacts-settings-generator-field.png)

3. Make sure to commit this change in the **Source Control** tab; otherwise, it will not be reflected in the settings.
4. Navigate to the **Libraries Settings** enable the **Beta OSDK Versions** toggle.
5. You can now discover beta generator versions in the **Generator** dropdown when creating a new version in the **Functions Imports** tab.

![beta-versions](./images/repository-artifacts-settings-beta-rc-versions.png)
