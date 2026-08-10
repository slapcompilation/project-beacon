<!-- source: https://palantir.com/docs/foundry/security/users-and-groups/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Users and groups

## Users

Access to Foundry is managed via one or more *identity providers*, which give Foundry the ability to validate users as they log in. Identity providers also supply information on users, their attributes, and groups. Foundry can integrate seamlessly with your existing identity provider, allowing full end-to-end access administration and management through your existing system. See [Authentication and Organization Assignment](/docs/foundry/authentication/overview/) to learn more about configuring authentication via Control Panel.

A **user** is an authenticated individual with access to Foundry. A user is typically defined by an external identity provider (e.g. an Active Directory system). A user has **attributes** which is public, structured information about the user.

![User profile](/docs/resources/foundry/security/user-profile.png)

Learn more about [managing users](/docs/foundry/platform-security-management/manage-users/).

## Groups

A **group** is a set of [users](/docs/foundry/security/users-and-groups/#users). Groups make it easier to manage security groups and customize the Foundry user experience for multiple users at a time. Access to Projects and resources are usually granted to groups rather than individual users. The [Securing a data foundation](/docs/foundry/security/securing-a-data-foundation/) documentation highlights how groups are used to manage permissions.

A group is typically defined by an external identity provider (for example, a customer Active Directory system) and applied throughout the Foundry platform.

Learn more about [managing groups](/docs/foundry/platform-security-management/manage-groups/).
