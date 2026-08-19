<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/organizations/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Organization basics

Organizations are a special category of Markings that are used to control access to resources. Every user
has one primary Organization, but can be a guest of multiple Organizations.

Organizations are distinct from other Markings in the following ways:
  * They can only be applied at the Project level. You cannot mark individual resources with an Organization.
  * They are independent of each other. If a Project is marked with multiple Organizations, a user only needs to be a member
    of one of those Organizations to view the resource.

To manage the guest members of an Organization, you should use the Marking Member APIs with the Organization's
Marking ID.

For more information see the [user documentation](/docs/foundry/security/orgs-and-spaces#organizations).
