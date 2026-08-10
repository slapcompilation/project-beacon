<!-- source: https://palantir.com/docs/foundry/administration/configure-workspaces/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Configure workspaces

:::callout{theme="warning" title="Deprecated functionality"}
These docs only apply if you see the **Foundry suite** section in Control Panel. If you see **Application access** instead, refer to [Configure application access](/docs/foundry/administration/configure-application-access/).
:::

If you want to narrow the scope of user access and help users focus on provided workflows, you can customize available apps per Organization or user group in Control Panel via the **Foundry Suite** section.

## Platform access

All users have access to most parts of the Foundry platform unless otherwise restricted. Users who are not in user groups with platform access will only have access to consumer-facing applications built in Slate or Workshop to which they have explicitly been granted access. Additionally, these restricted users will not see a navigational Foundry sidebar nor will they be able to navigate to other parts of Foundry.

For users with platform access, you can further customize which workspaces they are able to use.

## Workspaces

A **workspace** is one of the following:

* A stand-alone application without the Foundry sidebar
* A grouping of related applications that appear with the Foundry sidebar

### Foundry Suite

To get access to the Foundry Suite section in Control Panel, you will need the **Manage application access** workflow (previously called **Manage Foundry suite workspaces**) belonging to the **User experience administrator** role. This role is administered in the **Organization permissions** tab in Control Panel.

Once you have permission to access the Foundry Suite settings, you will see it as an option in the Control Panel sidebar. From the Foundry Suite page, you can restrict platform access and understand which workspaces are enabled for a particular Organization.

![Foundry Suite overview](./images/foundry-suite-overview.png)

### Restrict platform access

To limit which users are able to access the Foundry platform as a whole, choose **Select user groups** and search for user groups which should have access to the platform. Users not in any of those groups will be restricted to using custom consumer-facing applications, and the Foundry application navigation sidebar will not be visible to them. The workspace and application access configuration under **Foundry application access** further down on the page only applies to users with platform access.

![Configure platform access](./images/configure-platform-access.png)

### Configure a workspace

Select **Manage workspace** to configure access to a workspace. You will find more details about the workspace and any associated applications. The example below shows the result of selecting **Manage workspace** for the **Analyze data** workspace. From this page, you can toggle on or off the entire workspace using **Enable workspace** or just specific applications. If an application is considered default for this workspace, it cannot be toggled off.

![Workspace application list](./images/workspace-application-list.png)

### Configure more granular access to workspaces and applications

For a granular configuration of permissions for the workspace, you can limit the access to specified group(s), as shown below.

![Granular workspace settings](./images/granular-workspace-settings.png)

Additionally, within the workspace you can limit access to applications to specified group(s) under **Advanced settings**. Users only have permission to see applications belonging to enabled workspaces. If a workspace is limited to a certain set of groups, an application can only be enabled for that set of groups or a more narrow subset of those groups.

![Granular application settings](./images/granular-application-settings.png)

### Disable access to workspaces and applications

Users without access to a workspace or application will not find the specific applications and workspaces from the sidebar. Additionally, users will encounter a 403 "Permission denied" error if they try to access an unauthorized application or workspace via a link.

:::callout{theme="warning"}
Some applications within workspaces are enabled by default and cannot be turned off within a workspace, as they are considered core functionality of that workspace.
:::

![Permission denied](./images/403-permission-denied.png)
