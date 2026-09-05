<!-- source: https://palantir.com/docs/foundry/ontology-sdk/overview/ · mirrored 2026-09-04 from Palantir Foundry docs -->

![OSDK overview header image.](./images/osdk-overview-hero.png)

# Ontology SDK (OSDK)

The Ontology Software Development Kit (OSDK) allows you to access the full power of the Ontology directly from your development environment. The OSDK supports npm for TypeScript, pip or Conda for Python, Maven for Java, and OpenAPI spec for any other language.

By treating Foundry as your backend, you can leverage the Ontology's robust ability to perform high-scale queries and Foundry writeback alongside granular governance controls to accelerate the process of securely developing applications that can power your organization.

:::callout{theme="note"}
To create and manage OSDK applications, use [Developer Console](/docs/foundry/developer-console/overview/). This section covers SDK-specific reference documentation.
:::

:::callout{theme="note"}
If you define your Ontology in code rather than in the UI, consider creating a [SuperRepo](/docs/foundry/superrepo/overview/). A SuperRepo suits an Ontology and application that evolve together and that you want versioned and released as a single artifact. In a SuperRepo, your object types, links, and actions are declared with [Ontology-as-code](/docs/foundry/superrepo/core-concepts/#ontology-as-code) in the same repository as your [functions](/docs/foundry/functions/overview/) and frontend. The OSDK is generated locally and regenerated whenever those definitions change. This means you can extend the Ontology and consume the new types within a single edit-and-preview loop, without republishing an SDK version between each change.
:::

![The demo app setup page shows example code and documentation.](./images/osdk-demo-app.png)

## OSDK benefits

The OSDK was built to provide several primary benefits:

* **Accelerated development:** With the OSDK, you can quickly start developing applications backed by the Foundry Ontology. By enabling ergonomic access to Ontology APIs, the OSDK allows you to read and write back to the Ontology with minimal code.
* **Strong type-safety:** The functions and types generated for the OSDK are based on just the subset of the Ontology relevant to you. Types and functions are generated from your Ontology, allowing you to query and explore your Ontology directly in your editor.
* **Centralized maintenance:** As the Ontology is built and managed centrally in Foundry, you can focus on application building and decrease the typical maintenance burden required to build a data foundation.
* **Secure by design:** The OSDK uses a token that is scoped only to the ontological entities you want your application to access, in addition to the user's own permissions to the data.

:::callout{theme="warning" title="Read-time enforcement only"}
Row and column access controls (including [restricted views](/docs/foundry/security/restricted-views/), [object security policies](/docs/foundry/object-permissioning/object-security-policies/), and [property security policies](/docs/foundry/security/property-security-markings/)) filter what a user can read through the OSDK. Users can never read data they are not authorized to see. These controls do not extend to the OSDK response payload or to anything your application does with the data. To keep data protected as it flows downstream, pair these controls with a [marking](/docs/foundry/security/markings/) or [Classification-based Access Control](/docs/foundry/security/classification-based-access-controls/). For the full model, see [Access control propagation](/docs/foundry/security/access-control-propagation/).
:::

Additionally, TypeScript bindings for frontend development provide a convenient way for developers to quickly build React applications on top of Foundry.

![The Developer Console interface displays the Application SDK overview panel.](./images/osdk-overview.png)

The generated code uses metadata about your Ontology, including property names and descriptions. You can view this metadata directly in your editor.

## Getting started

To build an application with the OSDK:

1. [Create a new application](/docs/foundry/developer-console/create-application/) in Developer Console
2. Bootstrap your application using one of the language-specific guides:
   * [TypeScript](/docs/foundry/developer-console/how-to-bootstrapping-typescript/) (or [add OSDK to an existing TypeScript application](/docs/foundry/developer-console/how-to-add-to-existing-typescript/))
   * [Python](/docs/foundry/developer-console/how-to-bootstrapping-python/)
   * [Java](/docs/foundry/developer-console/how-to-bootstrapping-java/)
3. Optionally, [host your application on Foundry](/docs/foundry/developer-console/deploy-custom-application-on-foundry/)

If you have an existing application that was bootstrapped without an OSDK, refer to [Add an OSDK to a bootstrapped repository](/docs/foundry/ontology-sdk/add-osdk-to-bootstrapped-repository/) for integration instructions.

You can also use the OSDK within [compute modules](/docs/foundry/compute-modules/osdk-integration/) to interact with Foundry ontology objects from containerized applications.

## SDK references

This section contains language-specific API reference documentation:

* [Java OSDK](/docs/foundry/ontology-sdk/java-osdk/)
* [Python OSDK](/docs/foundry/ontology-sdk/python-osdk/)
* [Python OSDK migration guide](/docs/foundry/ontology-sdk/python-osdk-migration/)
* [TypeScript OSDK](/docs/foundry/ontology-sdk/typescript-osdk/)
* [TypeScript OSDK migration guide](/docs/foundry/ontology-sdk/typescript-osdk-migration/)
* [Unit testing TypeScript OSDK code](/docs/foundry/ontology-sdk/typescript-osdk-testing/)
* [Subscribe to Ontology changes with the TypeScript OSDK](/docs/foundry/ontology-sdk/typescript-subscriptions/)
* [Generate OSDK for other languages](/docs/foundry/ontology-sdk/generate-osdk-for-other-languages/)
* [Subscribe to Ontology changes via WebSocket](/docs/foundry/ontology-sdk/websocket-subscriptions/)

## Related documentation

* [Developer Console overview](/docs/foundry/developer-console/overview/): Create and manage OSDK applications
* [OSDK React applications](/docs/foundry/ontology-sdk-react-applications/overview/): Build React applications with OSDK
* [Development environment](/docs/foundry/ontology-sdk-react-applications/development/): Set up your development workflow
* [SuperRepo](/docs/foundry/superrepo/overview/): Define your Ontology, functions, and application in one pro-code repository, with the OSDK generated from your code definitions
* [Install a Developer Console application with Marketplace](/docs/foundry/developer-console/marketplace-installation/): Package and deploy OSDK applications across Foundry environments
* [Palantir MCP](/docs/foundry/palantir-mcp/overview/): Work with the Ontology SDK directly from your IDE using AI-assisted development tools
