<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/group-membership-expiration-policies/get-group-membership-expiration-policy/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Group Membership Expiration Policy

`GET /api/v2/admin/groups/{groupId}/membershipExpirationPolicy`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the GroupMembershipExpirationPolicy.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `GroupMembershipExpirationPolicy` · object · required
  - `maximumValue` · string
    "Members in this group must be added with expiration times that occur before this value."
  - `maximumDuration` · string
    "Members in this group must be added with expirations that are less than this duration in seconds into the future from the time they are added."

## Errors

- `GroupMembershipExpirationPolicyNotFound` (NOT_FOUND) — "The given GroupMembershipExpirationPolicy could not be found."
- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
