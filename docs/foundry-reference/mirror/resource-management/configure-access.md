<!-- source: https://palantir.com/docs/foundry/resource-management/configure-access/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# Configure access

By default, users do not have access to Resource Management, with the exception of [project usage](#project-usage). Access is managed through Control Panel [enrollment permissions](/docs/foundry/administration/enrollments-and-organizations-permissions/) and [workspaces](/docs/foundry/administration/configure-workspaces/), and both must be configured for a user to have access.

There are two [roles](/docs/foundry/administration/enrollments-and-organizations-permissions/#roles) in enrollment permissions that control access to Resource Management: **Resource management viewer** and **Resource management administrator**.

* **Resource management viewer** allows users to view usage and resource allocation.
* **Resource management administrator** additionally allows users to change resource allocation by creating [Resource Queues](/docs/foundry/resource-management/resource-queues/#create-resource-queues) and allocating projects to [usage accounts](/docs/foundry/resource-management/ecosystem/).

For more details on the associated workflows, view details on the roles in Control Panel. A user needs to have one of these roles in order to view usage data in Resource Management.

Resource Management is part of the **Support** workspace in the **Application access** page of Control Panel. A user must have access to the **Resource management** application in this workspace to successfully view or use the application.

## Project usage

Access to the [**Project usage**](/docs/foundry/resource-management/project-usage/) page is governed by the security operation "View project usage in Resource Management", with identifier `usage-aggregator:view-project-usage`.

By default, this operation is granted to users with the `Owner` role on the project, but administrators can configure access by [managing roles](/docs/foundry/platform-security-management/manage-roles/) in Foundry Settings.
