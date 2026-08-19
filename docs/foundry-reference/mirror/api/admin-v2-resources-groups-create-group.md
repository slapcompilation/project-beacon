<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/groups/create-group/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Group

`POST /api/v2/admin/groups`

Creates a new Group.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Request

- `CreateGroupRequest` · object · required
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
  "The created Group"
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
- `CreateGroupPermissionDenied` (PERMISSION_DENIED) — "Could not create the Group."
- `OrganizationNotFound` (NOT_FOUND) — "The given Organization could not be found."
