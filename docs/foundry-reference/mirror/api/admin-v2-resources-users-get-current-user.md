<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/users/get-current-user/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Current User

`GET /api/v2/admin/users/getCurrent`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Response

- `User` · object · required
  - `id` · string · required
    "A Foundry User ID."
  - `username` · string · required
    "The Foundry username of the User. This is unique within the realm."
  - `givenName` · string
    "The given name of the User."
  - `familyName` · string
    "The family name (last name) of the User."
  - `email` · string
    "The email at which to contact a User. Multiple users may have the same email address."
  - `realm` · string · required
    "Identifies which Realm a User or Group is a member of. The `palantir-internal-realm` is used for Users or Groups that are created in Foundry by administrators and not associated with any SSO provider."
  - `organization` · string
    "The RID of the user's primary Organization. This will be blank for third-party application service users."
  - `status` · enum · required
    one of `ACTIVE`, `DELETED`
    "The current status of the user."
  - `attributes` · map
    "A map of the User's attributes. Attributes prefixed with "multipass:" are reserved for internal use by Foundry and are subject to change. Additional attributes may be configured by Foundry administrators in Control Panel and populated by the User's SSO provider upon login."
    - `AttributeName` · string · required
    - `AttributeValues` · list · required
      - `AttributeValue` · string · required

## Errors

- `GetCurrentUserPermissionDenied` (PERMISSION_DENIED) — "Could not getCurrent the User."
