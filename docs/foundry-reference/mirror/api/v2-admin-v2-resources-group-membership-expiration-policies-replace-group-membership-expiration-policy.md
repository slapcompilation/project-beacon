<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/group-membership-expiration-policies/replace-group-membership-expiration-policy/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Replace Group Membership Expiration Policy

`PUT /api/v2/admin/groups/{groupId}/membershipExpirationPolicy`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Replace the GroupMembershipExpirationPolicy.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `ReplaceGroupMembershipExpirationPolicyRequest` · object · required
  - `maximumDuration` · string
    "Members in this group must be added with expirations that are less than this duration in seconds into the future from the time they are added."
  - `maximumValue` · string
    "Members in this group must be added with expiration times that occur before this value."

## Response

- `GroupMembershipExpirationPolicy` · object · required
  "The replaced GroupMembershipExpirationPolicy"
  - `maximumValue` · string
    "Members in this group must be added with expiration times that occur before this value."
  - `maximumDuration` · string
    "Members in this group must be added with expirations that are less than this duration in seconds into the future from the time they are added."

## Errors

- `ReplaceGroupMembershipExpirationPolicyPermissionDenied` (PERMISSION_DENIED) — "Could not replace the GroupMembershipExpirationPolicy."
- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
