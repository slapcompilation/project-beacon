<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/user-provider-infos/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# User Provider Info basics

A User's authentication provider sends information during the login process that allows Foundry to identify
the User. The exact information varies by provider, but it is typically a unique identifier for the user in the
provider's system. This information is stored in Foundry so that the User can be identified in subsequent logins.
