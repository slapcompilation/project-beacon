<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/groups/get-groups-batch/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Groups Batch

`POST /api/v2/admin/groups/getBatch`

Execute multiple get requests on Group.

The maximum batch size for this endpoint is 500.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Request

- `body` · list · required
  - `GetGroupsBatchRequestElement` · object · required
    - `groupId` · string · required
      "A Foundry Group ID."

## Response

- `GetGroupsBatchResponse` · object · required
  - `data` · map
    - `GroupId` · string · required
      "A Foundry Group ID."
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
