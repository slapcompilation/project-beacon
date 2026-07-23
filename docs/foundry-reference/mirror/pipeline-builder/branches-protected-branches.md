<!-- source: https://palantir.com/docs/foundry/pipeline-builder/branches-protected-branches/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Branch protection

When there are multiple authors contributing to the same Pipeline Builder instance, or when the pipeline backs critical data assets, you can *protect* your branch to achieve a greater level of governance and defense against unintentional changes. A *protected branch* can only be modified with a pull request and must satisfy a predefined set of requirements.

## How to protect branches

Navigate to the **Settings** drop down in the top left. Select **Manage branches**.

![Screenshot of the settings dropdown.](/docs/resources/foundry/pipeline-builder/branches-settings.png)

Select the **Branch protection** tab. In this tab, enable **Require proposals...** to protect the Main branch and any other branches specified in the text box below. Select **Save** when done.

![Screenshot of where to configure multiple protected branches.](/docs/resources/foundry/pipeline-builder/branches-multiple-protected.png)

All protected branches require users to make changes on a separate branch before those changes can be merged into protected branches. Currently, all protected branches in Pipeline Builder share the same approval rules.

## Enrollment-level branch protection

Administrators can enable default branch protection for the `Main` branch of all new pipelines on an enrollment. Branch protection enhances the security and integrity of your repository by requiring proposals to be approved before any changes can be made to a protected branch.

:::callout{theme="warning"}
Enabling enrollment-level branch protection will **not** affect existing pipelines. To change the branch protection of existing pipelines, see [how to protect branches](#how-to-protect-branches) above.
:::

![Screenshot of where to configure enrollment-level branch protection.](/docs/resources/foundry/pipeline-builder/branches-enrollment-setting.png)

Go to Control Panel and navigate to **Pipeline Builder**. Then, toggle the setting for **Enable branch protection by default for new pipelines**. This will make `Main` branches on new pipelines protected branches, so they will require proposals before changes can be merged.
