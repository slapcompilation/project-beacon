<!-- source: https://palantir.com/docs/foundry/foundry-branching/branch-security/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Branch security

Access to a branch in Global Branching is primarily governed by two mechanisms: roles and organizations.

## Roles

Roles control what actions a user can perform on a branch.

### Owner

Each branch must have at least one `Owner`. The user who creates a branch is automatically assigned the `Owner` role, but the role may also be assigned. Owners have full control over the branch and can:

* Edit branch and proposal metadata (the branch name, proposal name, and description)
* Assign and manage roles on the branch
* Create proposals
* Close existing proposals
* Manage the branch's organizations
* Remove the inactive label from the branch
* Archive or restore the branch
* Apply or remove the **Do not merge** setting on the branch's proposals

Branch owners also receive branch notifications, such as inactivity and data-deletion notices.

`Administrators` of the space that a branch belongs to have the same permissions as the `Owner` role. However, administrators do not automatically receive branch notifications.

:::callout{theme="note"}
Branch roles control access to branch management actions only and do not grant permissions to edit resources on the branch. To modify resources, a user must have the appropriate permissions at the project or resource level. To see resources on a branch or a proposal, you must be able to view that resource.
:::

### Managing roles

Roles can be managed by navigating to the **Security** tab on the branch page in the Global Branching application. Only owners and space administrators can modify role assignments.

![The Security tab on a branch page showing branch roles and organization access settings.](./images/branch-security.png)

## Merge permissions

Any user who can view a proposal can merge it, as long as resource-level approvals and checks are satisfied and the **Do not merge** setting is not applied.

Owners retain meaningful control over the merge of the branch through use of approvals and the **Do not merge** setting.

:::callout{theme="note"}
The person who merges may be submitting changes to resources that they cannot edit themselves. This is by design: edit permissions are still required to modify the branched resource in the first place; reviewers can be designated to verify and approve the change; and merging only applies pre-authored and approved changes.
:::

Ontology resources that have not yet been migrated to projects do not currently enforce the constraint that only editors can modify a resource on a branch. In this case, an approval from an editor is required.

### Resource-level approvals

A protected resource requires designated reviewers to approve all changes before they can be merged. Resource-level protection is set by resource owners, and approval policies are defined by project owners. For Code Repositories and Pipeline Builder pipelines, the approval policy is defined within the resource. Learn more about [resource protection and approval policies](/docs/foundry/global-branching/resource-protection-and-approval-policies/).

### Do not merge setting

Branch owners can apply the **Do not merge** setting to proposals on the branch. This setting prevents the proposal from being merged until it is removed. It can only be removed by a branch owner.

## Organizations

In addition to role requirements, a user must be a member of at least one of the organizations listed on a branch in order to access it. Organizations act as an access gate to the branch itself. The organizations for a branch must be a subset of those associated with the space that the branch belongs to.

:::callout{theme="note"}
Branch metadata such as the branch name may be visible on resources added to the branch, even when those resources are not protected by the same organization markings.
:::

## Creating a branch

When creating a branch, choose a name that does not include sensitive information, as branch names may be visible outside the branch's organization restrictions.

<img src="./images/create-new-branch-dialog.png" alt="The Create new branch dialog showing branch name, ontology selection, and branch security settings." width="450">

### Ontology

The ontology selected at creation determines where you can make modifications on the branch. You cannot make changes outside the selected ontology, and the ontology cannot be changed after the branch has been created.

### Space

In most cases, no additional configuration is required — the branch will automatically be assigned to the space associated with the selected ontology. However, if you select the default ontology, you will need to manually select a space.

The space affects the branch in several ways:

* It determines which organizations can be granted access to the branch.
* Administrators of the space have permissions equivalent to the owner role on the branch.
* It determines which retention policy is applicable to the branch.

### Organizations

Organizations determine which users can access the branch. You can select from the organizations associated with the chosen space. The default selection is determined as follows:

* If the space has no organizations, or if your own organization is among those associated with the space, your organization will be pre-selected.
* Otherwise, all organizations associated with the space will be pre-selected.

You can adjust the selection before completing branch creation.
