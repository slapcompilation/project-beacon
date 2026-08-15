<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/groups/get-group/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Group

`GET /api/v2/admin/groups/{groupId}`

Get the Group with the specified id.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Response

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

- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
