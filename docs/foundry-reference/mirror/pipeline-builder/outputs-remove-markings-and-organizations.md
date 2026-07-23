<!-- source: https://palantir.com/docs/foundry/pipeline-builder/outputs-remove-markings-and-organizations/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Remove markings and organizations from outputs

Access requirements for platform resources are controlled by [markings](/docs/foundry/security/markings/) and [organizations](/docs/foundry/security/orgs-and-spaces/). Markings restrict access in an all-or-nothing fashion: to access a resource, a user must be a member of all markings applied to the resource. Additionally, markings are inherited through file hierarchies and direct dependencies. On the other hand, for organizations, users must be a member or guest member of at least one organization applied to a project to meet access requirements. Organizations are inherited via the file hierarchy and direct dependencies.

If you have the `Remove marking` permission for a specific marking, you can now remove that inherited Marking from outputs in Pipeline Builder. This is equivalent to the [`stop_propagation`](/docs/foundry/building-pipelines/remove-inherited-markings/) argument in Code Repositories.

:::callout{theme="neutral"}
Removing a marking on an output is equivalent to stopping the propagation of a marking from an input.
:::

## Prerequisites

You must complete the following steps before you can remove markings or organizations using Pipeline Builder.

### Enable branch protection

1. In Pipeline Builder, select **Settings**, then **Manage branches**.

![The Settings and Manage branches options in Pipeline Builder.](/docs/resources/foundry/pipeline-builder/markings-settings.png)

2. Select the **Branch protection** tab.

![The Manage branches branch protection pop-up menu in Pipeline Builder.](/docs/resources/foundry/pipeline-builder/markings-manage-branch.png)

### Require code approvals

1. From the **Branch protection** tab, check the boxes to **Require proposals to update protected branches** and **Require approval before merging**.
2. Specify the desired approval policy. An example approval policy is shown below.

![An example approval policy in Pipeline Builder.](/docs/resources/foundry/pipeline-builder/markings-example-code-approval.png)

### Enable changes to security markings in pipeline settings

Navigate to the **Security approvals** tab and check the box next to **Allow changes to security markings in this pipeline**. You must have the `Owner` role on the pipeline to complete this step.

![Security approvals tab in Pipeline Builder.](/docs/resources/foundry/pipeline-builder/markings-security-approvals.png)

Once you **Allow changes to security markings in this pipeline**, you cannot disable branch protection or remove code approval requirements. You must disable **Allow changes to security markings in this pipeline** to disable those features.

Once you remove a marking in a protected branch, you cannot disable the **Allow changes to security markings in this pipeline** from the **Security approvals** tab. You must undo the removal of the marking first to disable this setting.

## Remove markings or organizations

1. [Create a branch](/docs/foundry/pipeline-builder/branches-create-a-branch/) off of the protected branch.

2. Navigate to **Pipeline outputs** on the right side of your screen, and hover over the output with the markings(s) you want to remove. Then, select **Edit**.

![The Pipeline outputs tab in Pipeline Builder.](/docs/resources/foundry/pipeline-builder/markings-pipeline-output.png)

3. Select the **Configure markings** dropdown menu under the output dataset.

![Configure markings dropdown on Pipeline Builder output.](/docs/resources/foundry/pipeline-builder/markings-configure-markings-option.png)

4. To remove markings: Under the **Markings** tab in the pop-up menu, select the red remove icon next to the marking(s) you want to remove.

![A pop-up dialog for removing markings on an output in Pipeline Builder.](/docs/resources/foundry/pipeline-builder/markings-inherited-markings.png)

The removed markings will now show up under the **Markings removed** section in the dialog.

![The removed markings in the "Markings removed" section in the pop-up dialog.](/docs/resources/foundry/pipeline-builder/markings-removed.png)

5. To remove organizations, select the **Organizations** tab. To fully remove an organization marking, you must remove all inputs that contains the desired organization you want to remove. If you want to remove all organizations from all inputs, select **Remove all inputs**.

:::callout{theme="warning"}
Outputs inherit organizations from the project they are in. Move your output to a separate project if you need to remove an organization that is on the existing project.
:::

![Organization unmarkings tab in unmarkings workflow.](/docs/resources/foundry/pipeline-builder/markings-organizations.png)

6. Select **Apply**. You should now see a shield icon in the upper left of your output board with a negative number signifying how many markings and organizations you are removing.

![The "Remove marking" icon on an output in Pipeline Builder.](/docs/resources/foundry/pipeline-builder/markings-removed-pop-up.png)

:::callout{theme="neutral"}
The changes you applied to markings and organizations on outputs will not go into effect until the branch is merged successfully and deployed on the protected branch. If you try building the dataset on your branch, it will still show the original markings.
:::

Organization removal only affects organizations that are present on the input at the time of the removal. If the organizations associated with the input have changed since your last removal, a warning icon will appear to indicate that the organizations for this input have been modified since the previous removal action.

![The warning icon denoting that the organizations for this input have been modified since the previous removal action.](/docs/resources/foundry/pipeline-builder/markings-organization-warnings.png)

### Propose your changes

1. For your changes to markings and organizations on pipeline output to take effect, [create a proposal](/docs/foundry/pipeline-builder/branches-propose-a-change/) to merge your changes into the protected branch. The proposal will include a section for approving Marking removals, a function similar to [pipeline code approvals](/docs/foundry/pipeline-builder/branches-approve-a-change/).

You must have the `Remove marking` permission to approve the change. Approvers for proposals to remove markings do not need to be pipeline owners and only require `View` access to the proposal.

![A proposal to remove a marking from a pipeline output.](/docs/resources/foundry/pipeline-builder/markings-approval-page-pull-request.png)

Every removed marking or organization will require a separate check, meaning that you could have multiple checks in one proposal. When you approve a marking removal, your approval will apply for every marking that you have permission to review.

Once all required approvals have been granted, the proposal is allowed to merge. Deploying that version will allow the marking removals to take effect.

### Undo a marking or organization removal from a pipeline output

1. To undo the removal of a marking, navigate to **Pipeline outputs** on the right side of your screen and hover over the output with the marking(s) you removed.

2. Select **Edit**.

![The Pipeline outputs tab in Pipeline Builder.](/docs/resources/foundry/pipeline-builder/markings-pipeline-output.png)

3. Select the **Configure markings** dropdown menu under the output dataset.

![Configure markings dropdown menu on Pipeline Builder output.](/docs/resources/foundry/pipeline-builder/markings-configure-markings-option.png)

4. For markings: Select the undo icon next to the **Markings not propagated** section in the pop-up dialog.

![The marking removal pop-up dialog, with the option to undo a marking that stopped propagating.](/docs/resources/foundry/pipeline-builder/markings-undo-remove-marking.png)

5. For organizations, select the undo icon next to the inputs associated with the organization.

![The marking removal pop-up dialog, with the option to undo an organization that stopped propagating.](/docs/resources/foundry/pipeline-builder/markings-organization-undo.png)

6. Select **Apply**, then save your pipeline from the top right of your screen.

![The "Save" option for the pipeline, found in the top right of the screen.](/docs/resources/foundry/pipeline-builder/markings-save-pipeline.png)

7. [Propose your changes](/docs/foundry/pipeline-builder/branches-propose-a-change/) to begin [approval checks](/docs/foundry/pipeline-builder/branches-approve-a-change/).

8. Once approved, [deploy](/docs/foundry/pipeline-builder/outputs-deliver-pipeline/) your pipeline.

:::callout{theme="neutral"}
Elevated permissions are not required to undo the removal of a marking, unlike the permissions required to remove a marking.
:::

### Markings and job groups

In a job group, markings from all inputs will be inherited by all outputs within the same job group. To view an example and learn more about job groups, review our [documentation](/docs/foundry/pipeline-builder/management-job-groups/).

### Markings and multiple protected branches

If there are marking removals on any branch, you must stop removing markings from all branches in the pipeline before protecting or unprotecting branches. When multiple branches are protected, marking removals will target all protected branches.

When security approval settings are enabled, you will not be able to change branch protection settings, including protecting or unprotecting branches.
