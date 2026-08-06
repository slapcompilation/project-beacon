<!-- source: https://palantir.com/docs/foundry/administration/secure-tunnels/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Configure secure tunnels

:::callout{theme="neutral" title="Beta"}
Secure tunnels are in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and a replacement for [agent proxies](/docs/foundry/data-connection/agent-proxy/). Functionality and configuration options may change during active development, and the feature may not be available on all enrollments. Contact your Palantir representative or Palantir Support before adopting secure tunnels for production workloads.
:::

**Secure tunnels** provide a network path for services in the Palantir platform to reach systems on a separate, privately-hosted network, without exposing those systems to inbound connections. They serve the same purpose as an [agent proxy](/docs/foundry/data-connection/agent-proxy/); applications connect to a source as if it were directly reachable over the platform network, while all traffic is brokered through a component that runs inside your network.

Unlike an agent, which is a single downloadable program, secure tunnels are built from a set of managed components. The secure tunnels **initiator** is the only component that runs inside your network. This page explains its role and how to install and configure it within your network.

## How secure tunnels work

A secure tunnel is established by three components:

| Component | Location | Role |
| --------- | -------- | ---- |
| Initiator | Your network | Runs inside your network and makes only **outbound** connections to the platform. It initiates outbound connections to the control plane, establishes tunnels to the responder, and forwards brokered traffic to destination systems in your network. |
| Control plane | Palantir platform | Authenticates the secure tunnels initiator, issues and refreshes its access token, and serves as its network configuration. |
| Responder | Palantir platform | Accepts the tunnels opened by the secure tunnels initiator. Platform services route egress traffic to the responder, which carries it back through the tunnel. |

Because the secure tunnels initiator only makes outbound connections, you do not need to open any inbound ports or expose any endpoint in your network to the platform. The secure tunnels initiator opens **tunnels** to the responder; it establishes the connections outbound, and the platform then sends request traffic back over the open connections. When a platform service connects to a source that uses a secure tunnel, traffic flows as follows:

![A secure tunnel is initiated from your network, and outbound traffic from the Palantir network uses the established tunnel.](./images/secure-tunnels-network-flow.png)

All connections between your network and the platform are encrypted with TLS and mutually authenticated.

## Secure tunnels initiator

The secure tunnels initiator is the only secure tunnels component that runs inside your network. It is a single-purpose [Envoy ↗](https://www.envoyproxy.io/) proxy that connects to the platform using Envoy's [reverse tunnel ↗](https://www.envoyproxy.io/docs/envoy/latest/configuration/other_features/reverse_tunnel) capability. The secure tunnels initiator establishes every connection outbound while the platform sends request traffic back. It has the following characteristics:

* **Outbound only:** The secure tunnels initiator never accepts inbound connections from the platform. It requires network egress to the platform but no inbound firewall rules.
* **Token authentication:** The secure tunnels initiator authenticates to the platform with a short-lived access token. The token is issued and rotated automatically by the control plane, so no long-lived credentials are stored in your network.
* **Deny-by-default egress:** The secure tunnels initiator can only reach destination systems [that you explicitly allow](#configure-the-egress-allowlist).

## Deployment model

The secure tunnels initiator is deployed and managed by Palantir into an environment within your network. You are not required to download, install, or upgrade any software manually. Instead, token issuance, token rotation, TLS certificate provisioning, configuration delivery, and version upgrades are all handled for you once the initiator is deployed.

An infrastructure or platform administrator is responsible for the following:

1. Provide an environment in your network where the secure tunnels initiator can run.
2. Allow [network egress](#network-egress-requirements) from that environment to the platform.
3. Define the [egress allowlist](#configure-the-egress-allowlist) that determines which destination systems the secure tunnels initiator may reach.

The secure tunnels initiator supports the following installation methods:

| Method | Availability |
| ------ | ------------ |
| [Helm chart managed by Apollo](#helm-chart-managed-by-apollo) | Available |

:::callout{theme="neutral"}
Deploying a Helm chart through Apollo is currently the only available installation method for the secure tunnels initiator. Additional methods will be added in future releases.
:::

### Prerequisites

Before installing the secure tunnels initiator, confirm the following:

* You have an environment in your network, managed together with Palantir, where the secure tunnels initiator can run.
* The environment can make outbound network connections to your Palantir platform instance. See [Network egress requirements](#network-egress-requirements) for more information.
* You know the set of destination systems (IP ranges and ports) that Palantir platform workloads require to reach through the tunnel.

### Network egress requirements

The environment that runs the secure tunnels initiator must be able to make outbound connections to the platform. No inbound connectivity to your network is required.

Allow outbound (egress) network access from that environment to your Palantir platform instance. If your network denies egress by default, you may need to open a firewall or configure a proxy to permit these outbound connections.

### Helm chart managed by Apollo

The secure tunnels initiator is deployed as a Helm chart managed through [Apollo](../../apollo/core/introduction.md), Palantir's continuous deployment system. Apollo deploys the chart into the prepared environment and configures it with the following:

* The address of the control plane to which it connects.
* A trust bundle used to validate the platform's TLS certificates.
* An initial access token used to bootstrap authentication. The secure tunnels initiator then rotates its own token automatically.

Once the secure tunnels initiator is running, it establishes tunnels to the responder and reports its health to Apollo. No further action is required to keep the secure tunnels initiator authenticated or updated.

## Configure the egress allowlist

The secure tunnels initiator enforces a **deny-by-default** egress allowlist. A destination system is only reachable through the tunnel if it matches an entry in the allowlist. With an empty allowlist, all egress is blocked.

The allowlist is a list of CIDR blocks with an associated port or port range. Each entry has the following fields:

| Field | Required? | Description |
| ----- | --------- | ----------- |
| `cidrBlock` | Yes | The IP range to allow, in CIDR notation. Use a `/32` suffix to allow a single IPv4 address. |
| `port` | Yes | The destination port to allow. |
| `endPort` | No | The end of an inclusive port range that begins at `port`. If omitted, only `port` is allowed. |

For example, the following allowlist permits connections to a single host on ports `7000` through `9000`, and to a subnet on port `443`:

```yaml
allowListedCidrs:
  - cidrBlock: '192.168.1.1/32'
    port: 7000
    endPort: 9000
  - cidrBlock: '192.168.2.2/24'
    port: 443
```

To allow all egress, allow every address on every port:

```yaml
allowListedCidrs:
  - cidrBlock: '0.0.0.0/0'
    port: 1
    endPort: 65535
```

Connections to a destination that does not match any allowlist entry are rejected by the secure tunnels initiator.

### Always-denied destinations

Regardless of the allowlist, the secure tunnels initiator always denies egress to link-local address ranges, including the cloud instance metadata service (for example, `169.254.169.254`). These destinations remain blocked even when the allowlist permits all egress, which prevents tunneled traffic from reaching sensitive infrastructure endpoints in the environment where the secure tunnels initiator runs.

## Next steps

Once the secure tunnels initiator is running and its egress allowlist is configured, create a [secure tunnel egress policy](/docs/foundry/administration/configure-egress/#secure-tunnel-egress-policies) in Control Panel and assign it to a [source](/docs/foundry/data-connection/set-up-source/) in Data Connection to route the source's traffic through the tunnel.
