<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/groups/replace-group/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Replace Group

`PUT /api/v2/admin/groups/{groupId}`

When replacing groups, you must send all attributes that begin with `multipass:` exactly as they appear when calling the Get Group endpoint.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Request

- `ReplaceGroupRequest` · object · required
  - `name` · string · required
    "The name of the Group."
  - `organizations` · list
    "The RIDs of the Organizations whose members can see this group. At least one Organization RID must be listed."
    - `OrganizationRid` · string · required
  - `description` · string
    "A description of the Group."
  - `attributes` · map
    "A map of the Group's attributes. Attributes prefixed with "multipass:" are reserved for internal use by Foundry and are subject to change."
    - `AttributeName` · string · required
    - `AttributeValues` · list · required
      - `AttributeValue` · string · required

## Response

- `Group` · object · required
  "The replaced Group"
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

- `InvalidGroupOrganizations` (INVALID_ARGUMENT) — "At least one Organization RID must be provided for a group"
- `GroupNameAlreadyExists` (INVALID_ARGUMENT) — "A group with this name already exists"
- `AttributesNotEditable` (INVALID_ARGUMENT) — "One or more attributes are not editable. Attributes prefixed with "multipass:" are reserved for internal use by Foundry and are not editable."
- `ReplaceGroupPermissionDenied` (PERMISSION_DENIED) — "Could not replace the Group."
- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
