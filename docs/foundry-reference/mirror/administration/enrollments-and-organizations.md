<!-- source: https://palantir.com/docs/foundry/administration/enrollments-and-organizations/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Enrollments and Organizations

*Organizations* are access requirements applied to *Projects* that enforce strict silos between groups of users and resources. Every user is a member of only one Organization but can be a guest member of multiple Organizations. [Learn more about Organizations](/docs/foundry/security/orgs-and-spaces/#organizations).

An **enrollment** represents an instance of the Foundry platform and is made up of one or more Organizations. In most cases, a company will have a single Organization—with all its users—in its enrollment. Some enrollments have multiple Organizations to enforce strict silos between groups of users, such as when multiple companies collaborate in the same Foundry platform.

Most settings in Control Panel are administered at an Organization level to allow for granularity in configuration and delegation of administration, but some are global to the entire enrollment, like [Resource Management](/docs/foundry/resource-management/overview/).
