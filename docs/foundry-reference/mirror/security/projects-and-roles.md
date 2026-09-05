<!-- source: https://palantir.com/docs/foundry/security/projects-and-roles/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Projects and roles

**Projects** are the primary way to organize work in Foundry and the primary boundary for [discretionary](/docs/foundry/security/access-control-propagation/#discretionary-controls) role grants. You will likely want to set your pipeline up as a series of projects. To collaborate with others, you will grant various users and groups roles on each project. Together, projects and roles are how discretionary access control is managed across Foundry. Mandatory controls ([markings](/docs/foundry/security/markings/), [Classification-based Access Controls](/docs/foundry/security/classification-based-access-controls/), and [organizations](/docs/foundry/security/orgs-and-spaces/)) remain in force across projects and through derivation. When the goal is to keep data protected through downstream derivation, use a mandatory control. For the full model, see [Access control propagation](/docs/foundry/security/access-control-propagation/).

Learn more about [securing a data foundation](/docs/foundry/security/securing-a-data-foundation/) in Foundry.

## Projects and resources

[Projects](/docs/foundry/compass/move-and-share-resources/) are the primary container for discretionary role grants in Foundry and can be thought of as buckets of shared work. Project boundaries determine who can read or modify the resources inside; mandatory controls (markings, Classification-based Access Controls, organizations) apply alongside role grants, rather than replacing them. Projects are a key means of organizing data and enabling open collaboration within a secure space.

Each project is a collaborative space that organizes users, files, and folders for a particular purpose. Projects should be designed such that users collaborating within each project have approximately uniform access to the content, but varied permissions on that content. For example, everyone in your project may have default Viewer role but only one specific group may have Editor role on all project resources. Projects enforce security boundaries, which enables work to be contained in a space. Work (transformation, analysis, etc.) is done in a project, and the output of that work lives alongside its logic within the project.

![The correct way to set up a project is ensuring a repository and its outputs live together.](./images/project-containment.png)

Since work and its output must live in the same project, to reuse or build off of work in other projects you must use [References](#references).

To make permission management easier, we recommend granting [group](/docs/foundry/security/users-and-groups/#groups) roles at the project level. Managing project permissions with groups allows a set of users with the same permissions to be managed together, reducing the clutter of individual role grants. Project contents will inherit the [roles](#roles) granted at the project level, providing users uniform access to the content in the project.

## Create projects

Users need `Editor` or `Owner` permissions on a space to create projects in that space.

<img src="./images/create-projects.png" alt="+ New project option to the top right of the page." width="250">

Space permissions can be managed from the [space settings](/docs/foundry/platform-security-management/manage-orgs-and-spaces/#manage-a-space) page.

## Request access to a project

Users can submit access requests for projects they are not authorized to access. The access request will include all changes required to give the user access to a project, including any required [Markings](/docs/foundry/security/markings/).

Project access requests can be submitted from multiple access points in the Foundry filesystem view:

* **Request access**
  * Located next to the project name in the **Projects & files** view.
  * Appears when opening a resource that a user does not have permission to view (for example, a direct link).
* **Request project access**
  * Located in the project view if a user only has the Discoverer role on the project.
* **Request additional access**
  * Located in the **Actions** dropdown in the project view if a user has access to the project.

After selecting one of the above entry points, the user is presented with a **Request access** pop-up. They must provide a reason for access, the users and groups that should be granted access (if requesting on behalf of others), and how they should be granted access.

As mentioned [above](#projects-and-resources), we recommend managing permissions on projects through groups. In the **Request access** pop-up, users can select to get access to a group with an appropriate role on the project. For groups that are [managed internally to Foundry](/docs/foundry/platform-security-management/manage-groups/#group-internal-realms), users can pick a group to join, which will route the request to the group administrators for approval. Custom request flows for groups can be configured to help requesting users select the appropriate group to join. You can find more information regarding custom approval access request configuration in the [platform security management documentation](/docs/foundry/platform-security-management/manage-groups/#custom-approvals-access-request-form). Additionally, you can hide groups to prevent users from requesting access to them. Learn how in the [manage groups documentation](/docs/foundry/platform-security-management/manage-groups/#exclude-groups-from-access-request-form).

![Request access flow for projects.](./images/project_access_request.gif)

For groups that are managed externally to Foundry, users will be presented with a message and URL redirecting them to request access to the necessary group outside the Foundry platform. Learn how to configure this message and URL in the [external group documentation](/docs/foundry/platform-security-management/manage-groups/#group-external-realms).

If there are no groups assigned to the project, a user can request to be added directly to the project with a given role. This will create a project access request task and require approval from users who have the Owner role on the project.

Once users create a request, a message should appear indicating that the request succeeded. View the created request by selecting **View details** on the message, or navigate to the [Approvals inbox](/docs/foundry/approvals/overview/#approvals-inbox) in the Foundry workspace sidebar and select **My requests** from the filter on the left.

<img src="./images/success_message.png" alt="Success message for access request submission." width="350">

### File and folder access requests

When users select **Request access** on a file or folder inside a project, the access request will be submitted on the project itself (not the specific resource). When reviewing the request, the file or folder where the request was submitted is shown to provide additional context.

![Resource requests access request.](./images/resource_access_request_request.png)

## Sharing and moving resources

To enforce projects as a security boundary, we recommend moving resources into projects that have been permissioned for your use case rather than sharing directly from **Your files**. This allows clarity of access and legibility of who has access to what. The users and groups who have access to your project can be managed by clicking on the access panel:

![Share and move resources.](./images/access-panel.gif)

## References

Projects are the central security boundary in Foundry, which extends to Foundry’s build system. A build takes in any number of input datasets and produces any number of output datasets. Those inputs and outputs *must* be in the same project. However, to make a useful pipeline, you will likely want to use datasets from other projects. When using datasets from other projects, we recommend applying file references.

![File references as a wrapper for datasets.](./images/references.png)

Adding a file reference allows you to use an upstream dataset in your project, as long as you have the required [role](#roles) for that use case. Once imported, your colleagues will not need access to the upstream project to see datasets derived in your project, as long as they satisfy any organizations and markings on the dataset.

![Reference to a notional "Flight delays" dataset.](./images/reference_to_flights.png)

In the image above, we referenced the flights dataset from the `Flight Control System [Datasource]` project in our `Flight Delays [Transform]` project. If we add a user to our transform project, they will be able to view the `delays` dataset and build additional transforms on top of it. However, to view the raw `flights` dataset or build any additional transformations on top of it they would still require `Viewer` role on the upstream project.

Projects and references help organize collaboration, as project owners can easily add users to their own projects and ensure the latter have the right permissions.

To add file references to a project you usually must have the `Viewer` role on the source project and `Editor` on the destination project. For more information on permissions required to add references to a project, see [Project references and permissions](/docs/foundry/code-repositories/use-project-references/#project-references-and-permissions).

References can be added from many places in Foundry, such as [Code Repositories](/docs/foundry/code-repositories/overview/), [Code Workbook](/docs/foundry/code-workbook/overview/), [Pipeline Builder](/docs/foundry/pipeline-builder/overview/), [Fusion](/docs/foundry/fusion/overview/), and [Contour](/docs/foundry/contour/overview/).

You cannot add references to files that live in **Your files** because it may cause permission issues. If you want to reference a file that lives in **Your files**, first [move the file](/docs/foundry/compass/move-and-share-resources/) into a project so that it is visible to your colleagues.

### Central data governance via Markings

In some situations, we may want to more centrally control access to a category of data. Perhaps anyone with access to any kind of flight data should go through a mandatory training first. Applying a Marking to the raw `flights` dataset will require that users go through a central body to get access to `flights` and anything derived from it, e.g. the `delays` dataset. For more information on using Markings, see [Markings](/docs/foundry/security/markings/).

## Roles

Roles are sets of permissions that grant different levels of access to resources. Roles are a discretionary permission and generally granted at the project level to provide uniform capabilities on all resources within the project's scope. However, mandatory controls (organizations, markings, and [Classification-based Access Controls](/docs/foundry/security/classification-based-access-controls/)) will *always* prevent an ineligible user from accessing a resource, regardless of the user's role. These controls also propagate through derivation, so downstream resources inherit the same requirements. Roles, by contrast, govern access to the resource itself; they do not extend to data after it has been read from the resource.

From most powerful to least powerful, the default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. Each role can assign other users the same or lesser role. For example, an Owner can grant any other user the Owner, Editor, Viewer, or Discoverer role, while the Discoverer can only grant other users the Discoverer role. These defaults can be customized to include completely [new roles](/docs/foundry/platform-security-management/manage-roles/#customizing-the-default-roles). Roles are independent sets of operations rather than a strict hierarchy. In a customized role set, a more powerful role is not guaranteed to include every operation granted by another role.

Importantly, like mandatory controls, role grants inherit to child resources. For example, granting a user Viewer on a project or folder gives them Viewer on all resources contained by that project or folder. And typically groups of users are granted roles on a project.

![Flight delay project](./images/flight-delay-project.png)

Learn more about [configuring your Organization's roles](/docs/foundry/platform-security-management/manage-roles/).

### Role grants on folders and files

As mentioned above, we recommend that roles be granted only at the project level to provide uniform capabilities on all resources within the project's scope. To enforce this behavior, you can use the toggle to disable folder and file role grants in the **Settings** section in the project view. When this setting is disabled, role grants can only be granted at the project level, not at the folder or file level. This toggle can be set by users with the `Owner` role on the project.

![Advanced settings - roles](./images/advanced_settings_roles.png)

If the role grants setting is disabled for projects already containing resources with role grants, role grants against these individual resources will be removed. Once an existing role grant is removed, it cannot be re-added until the setting is re-enabled. Similarly, if resources with role grants are moved to a project where the role grants setting is disabled, resource-level role grants will be removed. Users are warned of this behavior when disabling the role grants setting and when moving resources to a project with a disabled role grant setting.

Additionally, project link sharing capability will also be removed as link sharing gives the receiver of the link a direct role grant on the individual folder or file.

Role grants on folders and files are disabled by default. Space administrators can change the default behavior at the space level. We recommend keeping role grants on folders and files disabled.

![Space settings role grants.](./images/space-settings-role-grants.png)
