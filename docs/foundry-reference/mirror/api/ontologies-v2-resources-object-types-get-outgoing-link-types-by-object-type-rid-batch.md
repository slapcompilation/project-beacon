<!-- source: https://palantir.com/docs/foundry/api/ontologies-v2-resources/object-types/get-outgoing-link-types-by-object-type-rid-batch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Outgoing Link Types By Object Type Rid Batch

`POST /api/v2/ontologies/{ontology}/outgoingLinkTypes/getByRidBatch`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets outgoing link types for a batch of object types, identified by their RIDs.

For each requested object type, returns the list of outgoing link types visible to the
requesting token. Optionally, results can be filtered to only include specific link type RIDs.

Object types that don't exist or that the requesting token lacks permissions for are
silently omitted from the response.

The maximum batch size for this endpoint is 100.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."

## Query parameters

- `branch` · string
  "The Foundry branch to load the outgoing link type definitions from. If not specified, the default branch will be used. Branches are an experimental feature and not all workflows are supported."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Request

- `GetOutgoingLinkTypesByObjectTypeRidBatchRequest` · object · required
  - `requests` · list
    - `GetOutgoingLinkTypesByObjectTypeRidBatchRequestElement` · object · required
      - `objectTypeRid` · string · required
        "The unique resource identifier of an object type, useful for interacting with other Foundry APIs."
  - `filterLinkTypeRids` · list
    "If provided, only return outgoing link types with RIDs in this list. If omitted, all outgoing link types for each requested object type are returned."
    - `LinkTypeRid` · string · required

## Response

- `GetOutgoingLinkTypesByObjectTypeRidBatchResponse` · object · required
  "Success response."
  - `data` · map
    - `ObjectTypeRid` · string · required
      "The unique resource identifier of an object type, useful for interacting with other Foundry APIs."
    - `array` · list · required
      - `LinkTypeSideV2` · object · required
        "`foreignKeyPropertyApiName` is the API name of the foreign key on this object type. If absent, the link is either a m2m link or the linked object has the foreign key and this object type has the primary key."
        - `apiName` · string · required
          "The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application."
        - `displayName` · string · required
          "The display name of the entity."
        - `status` · enum · required
          one of `ACTIVE`, `ENDORSED`, `EXPERIMENTAL`, `DEPRECATED`
          "The release status of the entity."
        - `objectTypeApiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
        - `cardinality` · enum · required
          one of `ONE`, `MANY`
        - `foreignKeyPropertyApiName` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `linkTypeRid` · string · required
