<!-- source: https://palantir.com/docs/foundry/data-connection/permissions/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Permissions reference

All major concepts in Data Connection — agents, sources, and syncs — are managed in Foundry as [resources](/docs/foundry/getting-started/projects-and-resources/). This enables flexibly organizing these resources across Projects and folders, and allows security primitives such as [markings](/docs/foundry/security/markings/) to be applied to Data Connection resources.

Platform owners should be careful to not over-share Data Connection resources. Users with view and edit permissions on sources and agents should be trusted pipeline developers. The datasets produced by the syncs can be imported to downstream Transforms projects as necessary, thereby granting access to the data without sharing access to the agents or sources.

This page documents how permissions work for all Data Connection resources, including:

* [Agents](#agents)
* [Sources](#sources)
* [Syncs](#syncs)
* [Plugins](#plugins-and-jdbc-drivers)
* [Webhooks](#webhooks)
* [External connections from code](#external-connections-from-code)

## Resource permissions

:::callout{theme="neutral"}
The permissions listed below are defaults. In some environments, the default permission behavior may have been changed using [custom roles](/docs/foundry/platform-security-management/manage-roles/#customizing-the-default-roles).
:::

### Agents

**Owner**

An owner of an agent is usually its creator and gets the following permissions:

* Re-download the agent or regenerate the token for that agent
* Inherits permissions of Editor

**Editor**

An editor of an agent can:

* Deploy a source to that agent.
* Configure an agent using the Agent Manager (change the plugins and configs, and restart the agent).
* Share the agent with other users.
* Inherit Viewer permissions.
* Delete the agent.

:::callout{theme="neutral"}
A user must be the editor of a Project to create an agent in that Project, but must be an *owner* of the Project to administer the agents within that Project. That means that a user may create an agent and then be unable to generate download links or perform other administrative tasks on the agent.
:::

**Viewer**

A Viewer of an agent can:

* See the agent configuration and status.

### Sources

**Owner**

By default, the source owner inherits `Editor` permissions.

A source owner can also:

* Modify export configurations if the user configuring exportable Markings has permission to [remove Markings](/docs/foundry/platform-security-management/manage-markings/#remove-markings) from any Organization or security Markings they add as safe to export to the selected source.
* Allow a source to be imported into code resources.

**Editor**

An editor of a source can:

* Delete the source.
* Change the assigned agents of the source (additionally requires Edit on every agent being added).
* Update the source configuration (additionally requires Edit on the agents assigned to the source).
* Rename the source.
* Create, edit, and delete syncs for that source.
* Run SQL queries on database sources.
* Share the source with other users.
* Explore and preview sources that support these operations, such as JDBC and Directory sources.
* Inherit Viewer permissions.
* Import a source to a code resource

:::callout{theme="warning" title="Warning"}
Keep in mind that syncs can change the source system if the source credentials allow it (e.g. delete files from a directory or S3 source, or drop data from a database via arbitrary SQL). You should only grant Edit access to the source (or the Project containing it) to users whom you would also grant full access to the account the source uses to access the data.
:::

**Viewer**

* A viewer of a source can view source configuration, including assigned agents.

### Syncs

Sync permissions are derived from the relevant source and output dataset.

* **Viewing a sync** requires View on the source and dataset.
* **Editing a sync** requires Edit on the source and dataset.
* **Deleting a sync** requires Edit on the source and dataset.
* **Running a sync** requires Edit on the dataset.

### Plugins and JDBC Drivers

**Owner**

* Inherits Editor permissions.

**Editor**

* Delete the plugin / driver (the plugin / driver must not be assigned to any agents to successfully delete it).
* Inherits Viewer permissions.

**Viewer**

* View the plugin / driver.
* Download the plugin / driver.
* Add the plugin to an agent (also requires Editor on the agent).

### Webhooks

A Webhook’s permissions are inherited entirely from the source with which it is associated.

* **Viewing a Webhook configuration** requires View on the source.
* **Creating a Webhook** requires Edit on the source.
* **Editing a Webhook configuration** requires Edit on the source.
* **Deleting a Webhook** requires Edit on the source.
* **Configuring an Action to use a Webhook** requires Edit on the source.
* **Executing a Webhook** requires Edit on the source. Note that executing a Webhook permission is not required when executing a Webhook through an Action.

By default, only the user who executes a Webhook may view the response using the history tab in the Data Connection application. The `webhooks:read-privileged-data` permission may be added to a custom or default [role](/docs/foundry/security/projects-and-roles/) to allow users with that role to view the full request and response history for all webhooks that they can access. The standard recommended setup is to add a new role called "Webhook Privileged Data Viewer" with this permission, and ensure that users who need to view full Webhook history have this role on the relevant sources.

### External connections from code

#### External transforms, pipelines, and compute modules

:::callout{theme="warning"}
When a source is imported into a code resource, users with edit access on the repository can write custom code using the connection details configured for that source, including accessing secret values.

This means that the ability to import sources into code and granting `Editor` access to the source should be carefully managed, with only trusted users given access to the source and repository.
:::

* Importing a source in a code resource ([transform](/docs/foundry/transforms-python/overview/), [pipeline](/docs/foundry/pipeline-builder/overview/) or [compute module](/docs/foundry/compute-modules/overview/)) requires `Editor` permission on the source.
* Triggering a build that imports a source requires `Editor` on the **code resource** (nothing on the source itself).
* Removing an imported source from a code resource requires `Editor` on the source **or** the code resource.

#### External functions

Refer to the documentation on [external functions permissions](/docs/foundry/functions/webhooks/#permissions) for detailed information regarding permission of using webhooks in a functions repository.

## Marking propagation

As noted above, resources can have [Organizations](/docs/foundry/security/orgs-and-spaces/#organizations) and [Markings](/docs/foundry/security/markings/) applied as an additional level of access control. Organizations and Markings are applied to the source will propagate to the datasets produced from syncs on that source. This means users will not be able to view data in any of the datasets produced from a source, unless they have access to all of the Organizations and Markings applied to that source.

:::callout{theme="warning" title="Foundry-to-Foundry sync exception"}
When syncing data between Foundry instances using the Foundry connector, Markings and column-based access control (CBAC) policies are not automatically propagated to the destination stack. While CBAC is respected on the source stack — users can only sync data they are permitted to view — these security configurations are not transferred during the sync. You must manually configure appropriate permissions and Markings on the destination stack after the data arrives.
:::

Since it is likely for sources to contain data of varying levels of sensitivity, we recommend that you mark the source with all of the Organizations and Markings that apply to the data available in that source, and then use transforms to clean and unmark the data using the `stop_propagating` and/or `stop_requiring` functionality. To learn more about unmarking, see the guides on [removing Markings](/docs/foundry/building-pipelines/remove-markings/) and [removing inherited Markings](/docs/foundry/building-pipelines/remove-inherited-markings/).

Note that applying Organizations and Markings to the data after it has been synced should not be considered sufficient; as access to the source is effectively access to the data, the source should be marked with the Organizations and Markings that apply to anything it contains.

## Best practices

As a quick reminder, the primary Data Connection resources are agents and sources. Plugins and drivers are deployed to agents to expand functionality.

### Agent best practices

There are two recommended permission setups for agents: all agents in a single Project per Organization, or each agent in its own Project. The diagram above illustrates the former option; the guidance below describes why you might choose each option.

**Option 1: Place all agents in a single Project per Organization.**

Placing all agents in a single Project is the cleanest approach, and is recommended if there is one group of users managing all agents. This allows you to control access to the agents at the Project level, and to permission sources and syncs separately, downstream from the agent.

Choose this option only if it is acceptable for every Agent Manager and every source editor to have access to all agents. Remember that to deploy a source on an agent, a user must have Editor permission on that agent.

**Option 2: Place each agent in its own Project.**

This approach allows for full granularity of agent permissions. It also guarantees that the structure will never drift from the “groupings” at any time during the evolution of the source management. For example, you can safely assign / unassign agents from a source without needing to grant users access to an entire group of agents, and there would be no need to restructure Projects to account for group permission changes in the future.

This approach is recommended if you have multiple groups managing agents, and you would like to permission their access to agents separately.

:::callout{theme="warning" title="Warning"}
Editors of the Project containing the agent will be able to create new sources and syncs that run on that agent. Make sure you do not grant Editor role on the Project to users who should not be able to do this.
:::

### Source best practices

Each source should be in its own Project in the [datasource](/docs/foundry/building-pipelines/recommended-project-structure/) layer. Each sync defined on a source should output to a [dataset](/docs/foundry/data-integration/datasets/) within the same Project as the source. If the source contains sensitive data such as PII, you can apply a [Marking](/docs/foundry/security/markings/) to the source which will propagate to the output datasets.

:::callout{theme="warning" title="Warning"}
Editors of the Project containing the source will be able to create new syncs and edit existing syncs for that source, as well as create Webhooks and configure them for use elsewhere in Foundry.

Keep in mind that syncs can change the source system if the source credentials allow it; for instance, deleting files from a Directory or S3 source, or dropping data from a database via arbitrary SQL.

**You should only grant Edit access to the source (or the Project containing it) to users whom you would also grant full access to the account the source uses to access the data.**
:::

### Plugins and JDBC drivers

There are two recommended permission setups for plugins and JDBC drivers: all resources in a single Project per Organization, or each JDBC / driver in a Project with one or more agents that require it.

**Option 1: Place all plugins and drivers in a single Project per Organization.**

This is recommended if there is one group of users managing all agents. This allows Agent Managers to have access to all plugins and drivers that have been uploaded. This approach should only be chosen if there should be equal access to plugins and drivers among all Agent Managers.

The recommended process for implementing this approach is:

1. Create one folder per agent.
2. Migrate the current plugin and driver to the appropriate agent folder.
3. Choose one copy of each plugin and driver to be the authoritative copy of each asset and move it to the Project root.
4. Migrate each agent to use the root copy of the required plugin and driver.
5. Deprecate the individual agent folders.

**Option 2: Place each plugin and driver type in its own Project.**

This approach allows for certain "sensitive" plugins or drivers to be permissioned separately from others. If this approach is taken, you must ensure to give the required agent owners adequate permissions on each project so they can use them on agents.
