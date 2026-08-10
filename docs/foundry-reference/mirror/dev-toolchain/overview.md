<!-- source: https://palantir.com/docs/foundry/dev-toolchain/overview/ · mirrored 2026-08-07 from Palantir Foundry docs -->

![developer toolchain overview](./images/3-Ontology.svg)

# Developer toolchain

The Palantir platform comes with a set of developer tools that enable you to build on top of the Ontology and unlock value with new workflows, applications, and functionality. With Palantir's developer toolchain, you can access the full power of the Ontology directly from your development environment.

In addition to the data connection and application building tools described elsewhere, the Palantir developer toolchain provides:

* [Core APIs and SDKs](#core-apis-and-sdks) that open up the Ontology to your applications.
* [Development environments](#developer-environments-and-functionality) and [developer-centric functionality](#developer-environments-and-functionality) to accelerate your workflows.
* [Palantir MCP](#palantir-mcp) to enable AI IDEs and AI agents to use Palantir context and take action throughout Foundry.
* [Ontology MCP](#ontology-mcp) to expose ontology resources as MCP tools for external AI agents.
* [Compute modules](#compute-modules) to containerize your code and scale your deployments.

## Core APIs and SDKs

Central to Palantir's developer offerings are the APIs and SDKs that open up the platform and allow you to build applications that integrate directly with the Palantir platform and your Ontology data.

### Ontology SDK (OSDK)

The [**Ontology SDK (OSDK)**](/docs/foundry/ontology-sdk/overview/) enables developers to generate SDKs from their ontologies in Python, Java, and TypeScript. OSDK lets you access object types, apply actions to update data in the Ontology, call functions, and run AIP Logic functions for [AIP-enabled](/docs/foundry/aip/enable-aip-features/) enrollments. The in-platform Developer Console includes Ontology-specific documentation for the entities chosen for your application. Applications use the OAuth flow as a public or confidential client to access the data.

### APIs

Palantir's APIs support users building on the Palantir platform by enabling programmatic management of platform access and the data backing your Ontology. API references are also available in-platform via the Developer Console.

Available Palantir APIs include:

* [Datasets](/docs/foundry/api/datasets-v2-resources/datasets/get-dataset/) — Read, write, and manage datasets, including branches, transactions, files, and views.
* [Filesystem](/docs/foundry/api/filesystem-v2-resources/projects/get-project/) — Manage spaces, projects, folders, and resource roles.
* [Administration](/docs/foundry/api/admin-v2-resources/users/get-user/) — Manage users, groups, organizations, hosts, and markings.
* [Orchestration](/docs/foundry/api/orchestration-v2-resources/builds/get-build/) — Trigger builds, inspect jobs, and configure schedules.
* [Connectivity](/docs/foundry/api/connectivity-v2-resources/connections/get-connection/) — Manage connections, virtual tables, and file or table imports from external sources.
* [SQL Queries](/docs/foundry/api/v2/sql-queries-v2-resources/sql-queries/execute-sql-query/) — Execute SQL against datasets.
* [Media Sets](/docs/foundry/api/media-sets-v2-resources/media-sets/get-media-item-info/) \[Beta] — Upload, retrieve, and manage media sets and their items.

See the full [API documentation](/docs/foundry/api/general/overview/introduction/) for the complete list of endpoints, including models, audit logs, data health checks, streams, checkpoints, and Notepad.

### Platform SDKs

Palantir's platform SDKs are publicly available for [Python ↗](https://github.com/palantir/foundry-platform-python) and [TypeScript ↗](https://github.com/palantir/foundry-platform-typescript), and are expanded as new APIs become available. These SDKs are usable alongside Ontology SDKs with the same Palantir platform clients.

## Developer environments and functionality

In addition to development tools focused on data connection such as [Pipeline Builder](/docs/foundry/pipeline-builder/overview/) and [Code Repositories](/docs/foundry/code-repositories/overview/), [Code Workspaces](/docs/foundry/code-workspaces/overview/) allows you to use familiar IDEs like VS Code while building on top of the Palantir platform. [VS Code workspaces](/docs/foundry/vs-code/overview/) are integrated with Developer Console, allowing you to rapidly [build React applications](/docs/foundry/ontology-sdk-react-applications/overview/). You can create a VS Code workspace from the in-platform Developer Console.

Palantir's developer-focused functionality aims to accelerate the process of building on the platform. Features like [Global Branching](/docs/foundry/global-branching/overview/) help create a safe, streamlined environment for development of end-to-end workflows.

## Palantir MCP

[Palantir MCP](/docs/foundry/palantir-mcp/overview/) is an implementation of the [Model Context Protocol ↗](https://modelcontextprotocol.io/introduction) that allows AI IDEs and AI agents to autonomously build end-to-end applications in the Palantir platform - from data integration through ontology configuration and application development. In addition, you can use Palantir MCP to allow external AI systems to query documentation, metadata, and data, as well as perform high-level tasks on the platform. Developers can use Palantir MCP to automate auxiliary tasks while they stay focused on the system they are building.

## Ontology MCP

[Ontology MCP (OMCP)](/docs/foundry/ontology-mcp/overview/) is a Developer Console feature that exposes your application's ontology resources as Model Context Protocol (MCP) tools, enabling external AI agents to interact with your ontology. While Palantir MCP is designed for ontology builders and development workflows, Ontology MCP is designed for ontology consumers: external AI agents that need to safely read and write data to production ontology data.

Ontology MCP exposes object types, action types, and query functions as MCP tools, and integrates with desktop agents and headless agent frameworks.

## Compute Modules

The Compute Modules feature enables you to deploy interactive containers on the Palantir platform, allowing you to bring in your existing code base (regardless of language) and run it inside the platform. With Compute Modules, for example, you could bring a third-party machine learning model into the platform and integrate it into your workflow.

For more information about Compute Modules, you can watch this official [Build with AIP: Compute Modules ↗](https://www.youtube.com/watch?v=ILZQyan3gh0) video and reference the [documentation](/docs/foundry/compute-modules/overview/).

## Custom endpoints

[Custom endpoints](/docs/foundry/custom-endpoints/overview/) enable developers to configure and deploy user-defined API endpoints with their own URL patterns, request and response shapes, and specifications, while leveraging Foundry's back-end capabilities. These endpoints are backed by the ontology through actions and functions.
