<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/groups/list-current-groups/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Current Groups

`GET /api/v2/admin/groups/listCurrent`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Returns all Groups which contain the current user as a direct or transitive member. For example if the current user is a member of Group A and Group A is a member of Group B, this endpoint will return Group A and Group B.

Unlike the list Group Memberships endpoint which requires the `api:admin-read` scope, this endpoint
does not require any particular scopes and can be used by any authenticated user to retrieve their own
group memberships.

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListCurrentGroupsResponse` · object · required
  - `data` · list
    - `Group` · object · required
      - `id` · string · required
        "A Foundry Group ID."
      - `name` · string · required
        "The name of the Group."
      - `description` · string
        "A description of the Group."
      - `realm` · string · required
        "Identifies which Realm a User or Group is a member of. The `palantir-internal-realm` is used for Users or Groups that are created in Foundry by administrators and not associated with any SSO provider."
      - `organizations` · list
        "The RIDs of the Organizations whose members can see this group. At least one Organization RID must be listed."
        - `OrganizationRid` · string · required
      - `attributes` · map
        "A map of the Group's attributes. Attributes prefixed with "multipass:" are reserved for internal use by Foundry and are subject to change."
        - `AttributeName` · string · required
        - `AttributeValues` · list · required
          - `AttributeValue` · string · required

## Errors

- `ListCurrentGroupsPermissionDenied` (PERMISSION_DENIED) — "Could not listCurrent the Group."
