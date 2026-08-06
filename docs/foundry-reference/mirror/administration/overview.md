<!-- source: https://palantir.com/docs/foundry/administration/overview/ · mirrored 2026-08-06 from Palantir Foundry docs -->

![admin overview](./images/7-Admin.svg)

# Management and enablement

The Palantir platform provides a full suite of capabilities for governance and administration, accessible in a centralized interface known as **Control Panel**. The platform brings together security, resource management, use case lifecycle, and audit capabilities into a shared foundation that can be consistently applied across diverse implementations. Beyond core governance, this enables the scaled implementation of enterprise data architectures, including the “data mesh” and “data fabric” paradigms. Across both centralized and federated models, Palantir's approach to administration, management, and enablement can remove the traditional compromise between security and rich collaboration.

## Control Panel

All administrative workflows can be performed in [Control Panel](/docs/foundry/administration/control-panel/), Palantir's centralized interface for administering the platform. You can access Control Panel from the [Workspace sidebar](/docs/foundry/getting-started/orientation-and-nav/#workspace-navigation-sidebar) by selecting **Open other workspaces**.

## Configure and manage enrollments

Palantir enrollments are defined as one or several "[Organizations](/docs/foundry/security/orgs-and-spaces/#organizations)" that are managed by platform administrators. Each administrative function can be mapped to existing governance implementations (such as Active Directory), with granular mapping between preexisting groups and specific roles. The full range of administrative tasks can be defined, federated, and implemented through the Control Panel.

[Learn more about managing enrollments.](/docs/foundry/administration/enrollments-and-organizations/)

## Authentication

Access to the Palantir platform is managed through registered identity providers, which provide both user validation and the discretionary attributes required to drive [security controls](/docs/foundry/platform-security-management/manage-users/) throughout the platform. Palantir leverages the SAML 2.0 open standard and provides an intuitive mechanism for mapping metadata attributes to user attributes managed within the platform. As usage of the Palantir platform expands within an Organization and potentially grows to encompass external partner Organizations, additional identity providers can be onboarded and managed.

[Learn more about authentication.](/docs/foundry/authentication/overview/)

## Resource management

Palantir provides administrators with comprehensive resource management tools, allowing them to understand and manage the utilization of platform resources. This set of capabilities ensures that actionable, granular metrics can be tied back to semantically meaningful accounts, Projects, and even individual resources. Usage visibility workflows provide a rich lens into Project-oriented resource spend, while Resource Allocation workflows allow administrators to define how Projects consume shared resources - and if desired, place limits on that consumption.

[Learn more about resource management.](/docs/foundry/resource-management/overview/)

## Platform experience

Palantir provides a range of configuration options that are designed to enable organizational consistency and focus in user experience. This includes [configurable workspaces](/docs/foundry/carbon/overview/), which curate the total set of platform applications into a subset tailored to the needs of specific teams or user types. User landing pages, platform logos, and other assets can also be customized to ensure that the Palantir platform is natively integrated with the wider Organization’s look-and-feel and branding.

Learn more about customizing the platform experience:

* [Configure platform experience settings](/docs/foundry/administration/configure-platform-experience/)
* [Configure workspaces](/docs/foundry/administration/configure-workspaces/)
