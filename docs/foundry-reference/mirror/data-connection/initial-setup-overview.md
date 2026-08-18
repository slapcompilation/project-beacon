<!-- source: https://palantir.com/docs/foundry/data-connection/initial-setup-overview/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Initial setup overview

This guide will walk you through the process of connecting your organization's data to Foundry.

Before starting, it is important to recognize that this first step towards connecting your organizational data to Foundry is fundamentally a **networking concept**. The initial setup is best done by someone familiar with network engineering and aware of the organization's network topology and configurations, such as firewall rules.

## Conceptual overview

Connecting data to Foundry requires that three components are configured in the following order:

### 1. Configure networking connectivity

You must first ensure that there is a valid networking path between Foundry and the external system.

For external systems hosted on the same network from Foundry's network (for cloud-hosted Foundry instances, this is typically systems accessible over the Internet), define [direct connection egress policies](/docs/foundry/administration/configure-egress/#direct-connection-egress-policies) to route the traffic. Make sure that the external system allows inbound connections from Foundry.

For external systems hosted on a separate network from Foundry's network (for cloud-hosted Foundry instances, this is typically on-premise systems), an [agent](/docs/foundry/data-connection/core-concepts/#agents) is required. An agent is Palantir software that runs within your organization’s network and functions as a secure intermediary between your organization’s data sources and your Foundry instance. Make sure the external system allows inbound connections from the agent and that the agent can establish outbound connections to the external system as well as to Foundry.

The agent can then be used to define [agent proxy egress policies](/docs/foundry/administration/configure-egress/#agent-proxy-egress-policies) to route traffic through the agent when using a [Foundry worker](/docs/foundry/data-connection/core-concepts/#foundry-worker).

Agents can also be used as a legacy [agent worker](/docs/foundry/data-connection/core-concepts/#agent-worker) where capabilities execute on the agent host. New sources should use Foundry worker; see [Foundry worker vs. agent worker](/docs/foundry/data-connection/foundry-worker-vs-agent-worker/).

Agents can be shared by agent worker sources and sources using agent proxy egress policies, though we recommend always having multiple agents assigned to a given source to [maximize availability](#high-availability).

Learn more about various [architecture patterns](/docs/foundry/data-connection/architecture/).

### 2. Source configuration

You must [configure a source](/docs/foundry/data-connection/set-up-source/), or connection, to connect your external system to Foundry before executing any [capability](/docs/foundry/data-connection/core-concepts/#capabilities). An external system could be, for example, a Postgres database, an S3 bucket, a filesystem on a Linux server, an SAP instance, or a REST API accessible over the Internet.

### 3. Capability configuration

Once a source is configured to connect to the external system, you must configure the [capability](/docs/foundry/data-connection/core-concepts/#capabilities) to execute on that source. Capabilities include batch syncs of data, streaming syncs, webhooks, exports, and more.

A [batch sync](/docs/foundry/data-connection/set-up-sync/), for example, reads specific data from an external system and ingests it into Foundry. If you have a PostgreSQL database that contains multiple tables, you might configure a sync to ingest one specific table into Foundry. Once a sync has successfully run, the result in Foundry will be a [dataset](/docs/foundry/data-integration/datasets/) to use across all of Foundry's data pipelining, model development, and analytical tools.

## Roles and workflows

Most Foundry users will never need to set up a new agent themselves. Agent setup requires an IT-focused skill set, though the same agent can be reused to support multiple sources and syncs. Some organizations can operate long-term with agents set up during the first week of a Foundry deployment. New agents are only needed to access data that your existing agents cannot access (due to network segmentation or data scale, for example) or to set up an additional agent to allow for [high availability](#high-availability).

The table below summarizes the configuration frequency and skill set required for maintaining the resources required for connecting to data:

| Resource | Frequency of configuration | Typical user role | Knowledge required  |
| -------- | -------------------------- | ----------------- | ------------------- |
| Agent    | Rare       | IT / Network Engineer         | Network and firewall policies; Linux VMs; SSH
| Source   | Occasional | IT / Network Engineer; Data Engineer    | Debugging network access; credential management
| Sync     | Frequent   | Data Engineer; Data Scientist | Writing SQL queries; managing files

## High availability

We recommend setting up redundant hardware to establish a high availability (HA) architecture. High availability increases resiliency and allows no-downtime maintenance during operating hours.

Foundry offers HA at the source level, meaning that if a source is assigned to multiple agents, Foundry will dispatch ingestions to one of the healthy agents. We strongly recommend configuring agents in a high availability setup at the start of source creation; adding extra agents to a created source requires re-entering the credentials for that source.

The following best practices are recommended when setting up high availability:

* Always install agents by pairs, on similar hardware.
* Give each agent in a pair similar names, such as `agent-1` and `agent-2`.
* Systematically assign both agents in a pair to every source.
* Configure non-overlapping upgrade windows on both agents in a pair. Upgrade windows should be during business days and provide sufficient soaking time. Doing so ensures that any unexpected issues with an update will be contained to a single agent and can be detected by operators or administrators.

## Next steps

To get started, move on to [setting up a source](/docs/foundry/data-connection/set-up-source/).
