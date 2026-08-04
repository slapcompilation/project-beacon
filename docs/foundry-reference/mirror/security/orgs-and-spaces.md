<!-- source: https://palantir.com/docs/foundry/security/orgs-and-spaces/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Organizations and spaces

Organizations are strict access requirements that strongly protect your organization’s data and work inside the Palantir platform. Spaces are the primary way in which organizations are applied to exert control over your Foundry instance. Together, organizations and spaces allow both strict segregation of work, but also flexible collaboration with third parties when needed.

## Organizations

Organization permissions should be managed via [Control Panel](/docs/foundry/administration/enrollments-and-organizations/).

Organizations are access requirements applied to Projects that enforce strict silos between groups of users and resources. Every user is a member of only one organization, but can be a guest member of multiple organizations. To meet access requirements, users must be a member or guest member of at least one organization applied to a Project. Organizations are inherited via the file hierarchy and direct dependencies.

Like markings, organizations are a mandatory access control. However, organizations differ from markings in a few key ways:

* The scope of information protected by organizations includes spaces, ontologies, projects, users, groups, tag categories, and collections. However, individual resources cannot be tied to an organization. In comparison, markings can only be applied to projects and resources.
* Information protected by organizations abides by cross-organization discoverability rules. Platform administrators can allow or disallow the ability of users to see the names, users, and groups of organizations outside their own.
* Users are required to be members of a single organization. There is no requirement for users to have access to markings.

Review the [management documentation](/docs/foundry/platform-security-management/manage-orgs-and-spaces/) on how to configure organizations.

### Creating new organizations

Within a single organization, governance of project and data access can be accomplished through groups. However, if you want to collaborate and share data with Foundry users who are not part of your organization (for instance, users from another company) while restricting their ability to see your organization's users and groups, you should create a new organization. The terms of data-sharing (collaboration) are defined by enrollment administrators and managed in Control Panel.

See the [cross-organization collaboration documentation](/docs/foundry/security/cross-organization-collaboration/) for information on how to create a new organization in Control Panel.

## Spaces

:::callout{theme="neutral"}
**Spaces** have been rebranded from their previous name, **namespaces**.
:::

A space is a high-level container of projects, with one common ontology, for work with a common purpose that is shared between a set of organizations. Spaces are restricted by an organization (or set of organizations), and that restriction will apply to the projects in the space as well as the associated ontology. Most organizations will only need a single space, inside which all projects will be created. These projects can be permissioned additionally using markings and roles.

The file path of a Foundry resource, which can be found in the **Details** panel, indicates the space as the first element of the path: for example, `space/project/sub-folder/my-file`.

Review the [management documentation](/docs/foundry/platform-security-management/manage-orgs-and-spaces/) on how to configure spaces.

## Multi-organization spaces

When setting up a collaboration with an external organization, you likely want to set up a dedicated space with multiple organizations.

In the case of a space with multiple organizations, projects inside that space can have any subset of the organizations. For example, if there is a shared space with both the Sky Industries and Sunrise Airline organizations applied, projects inside that space can be created with just Sky Industries or just Sunrise Airline, restricting those projects to only the corresponding organization, or *both* organizations, allowing that project to be accessed by both organizations.

![Multi-organization spaces.](/docs/resources/foundry/security/namespace-org-projects-diagram.png)

For more details on setting up a collaboration with an external organization, see [Workflow: Cross-organization collaboration](/docs/foundry/security/cross-organization-collaboration/).

Review the [management documentation](/docs/foundry/platform-security-management/manage-orgs-and-spaces/) on how to configure spaces.
