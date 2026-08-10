<!-- source: https://palantir.com/docs/foundry/data-connection/agent-proxy/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Agent proxy configuration reference

This page describes the configuration options available when using an agent as a network proxy via [agent proxy egress policies](/docs/foundry/administration/configure-egress/#agent-proxy-egress-policies) on [Foundry worker](/docs/foundry/data-connection/core-concepts/#foundry-worker) connections and assumes you are already familiar with [data connection agents](/docs/foundry/data-connection/core-concepts/#agents) and their [generic configuration options](/docs/foundry/data-connection/agent-configuration-reference/).

Agents used as a proxy provide a network path for services in Foundry to access systems within a separate network that are not directly accessible over the Foundry network.
When Foundry is hosted in the cloud, a proxy is required to access systems which are not accessible over the Internet. When Foundry is hosted on a private network, a proxy is required to access systems in other networks, which may include the public Internet if otherwise not accessible.

Agent proxies allow applications in Foundry to operate as if they are connecting to a source directly over the Foundry network, and they can be configured with multiple agents to allow for alternating maintenance windows that prevent downtime. Follow the guide below to configure and manage an agent used as a proxy.

## Use an agent as a proxy with a Data Connection source

You must first [set up an agent](/docs/foundry/data-connection/set-up-agent/) before using it as a proxy. An existing agent already used for [agent worker](/docs/foundry/data-connection/agent-worker/) sources can be reused without additional configuration.

Once an agent has been set up, create an [agent proxy egress policy](/docs/foundry/administration/configure-egress/#agent-proxy-egress-policies) using that agent. You can then create a source and assign that policy to it.

## Security controls specific to agent proxy

To ensure that connections over the proxy only have access to required resources, a number of security controls are available.

Security controls are either *mandatory* and cannot be disabled, or *optional* and are not enabled by default.

The following security control configurations are available:

| Security control | Required? | Description |
| ---------------- | ------------ | ----------- |
| [Source configuration enforcement](#source-configuration-enforcement) | Yes | The agent proxy always restricts traffic to only the hostname(s) and port(s) configured on the assigned source. |
| [Agent allowlist (Foundry)](#agent-allowlist-foundry) | Optional | Configure an allowlist in Foundry to filter traffic before it reaches the agent. Only agent resource owners can modify this setting. |
| [Agent allowlist (local file)](#agent-allowlist-local-file) | Optional | Create an allowlist on the agent host for the local agent process to enforce within your network. Only users with SSH access to the agent host can modify this setting. |
| [Agent host firewall](#agent-host-firewall) | Optional | Set up host-level firewall controls to limit agents to communicating only with intended target systems (strongly recommended). These firewalls work independently of Foundry and add an extra security layer. |

### Source configuration enforcement

The hostname and port in the URL defined on the source restrict access to only that hostname and port when connecting to the agent proxy. Attempts to connect to any other hostname or port will result in an HTTP 403 (Unauthorized) response code from the proxy.

This prevents unauthorized connections when importing and using the connection in code.

If only this security control is used, ensure that users who are able to assign an agent to a particular source are also trusted to connect to any system that is reachable from the agent host.

### Agent allowlist (Foundry)

Configure an allowlist in Foundry to restrict connections to specific IP addresses or CIDR blocks for a specific agent, regardless of assigned sources.

To configure this, navigate to **Agent settings**, then toggle the **Advanced** option in the **Manage Configuration** section. In the YAML file, add a block for `agentProxyConfiguration` at the same indentation level as the `security` block.

List the CIDR blocks and ports where you want to allow agent connections. For example:

```yaml
agentProxyConfiguration:
  allowListedCidrs:
    - cidrBlock: '192.168.1.1/32'
      port: 7000
      endPort: 9000
    - cidrBlock: '192.168.2.2/24'
      port: 443
```

### Agent allowlist (local file)

The same configuration used for an [agent allowlist in Foundry](#agent-allowlist-foundry) can also be set in a file on the agent host itself, preventing users in Foundry from editing the configuration.

To configure an agent allowlist locally, follow the steps below:

1. SSH into the agent's host.
2. Create a folder named `agentProxyConfig` in the same directory that contains your `magritte-bootvisor-<version>` (the root folder).
3. In the newly-created `agentProxyConfig` folder, create a file named `agentProxyConfig.yml`.
4. The `agentProxyConfig.yml` file and `agentProxyConfig` folder *must* be created with the root user, and the file permissions must be set to prevent the agent from writing to this file or folder. The agent will *not* run the agent proxy feature if the `agentProxyConfig.yml` file exists and is writeable, or if one of the parent directories is writeable by the agent.
5. The content of this file is the same as the configuration available in the agent settings interface.

For example:

```yaml
allowListedCidrs:
  - cidrBlock: '192.168.1.1/32'
    port: 7000
    endPort: 9000
  - cidrBlock: '192.168.2.2/24'
    port: 443
```

### Agent host firewall

As for any agent, [we recommend setting a firewall on the host to restrict connectivity to only what is necessary](/docs/foundry/data-connection/set-up-agent/#secure-an-agent-host-with-firewall).

## Connection pool configuration

The agent proxy maintains a pool of connections for handling requests. You can configure the connection pool size to optimize performance based on your workload.

To configure the connection pool, navigate to **Agent settings**, then toggle the **Advanced** option in the **Manage Configuration** section. In the YAML file, add the connection pool settings within the `agentProxyConfiguration` block:

```yaml
agentProxyConfiguration:
  maxConnections: 250
  coreConnections: 100
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `maxConnections` | 300 | The maximum number of connections the agent proxy can open. |
| `coreConnections` | 20 | The minimum number of connections maintained in the pool. |

:::callout{theme="neutral"}
Some connectors, such as [Databricks](/docs/foundry/available-connectors/databricks/), may open a large number of connections at the same time. If you observe connection pool exhaustion errors on your agent when using agent proxy policies, consider increasing the `maxConnections` and `coreConnections` values.
:::
