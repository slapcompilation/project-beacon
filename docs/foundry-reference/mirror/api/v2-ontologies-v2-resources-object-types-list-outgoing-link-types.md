<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/object-types/list-outgoing-link-types/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Outgoing Link Types

`GET /api/v2/ontologies/{ontology}/objectTypes/{objectType}/outgoingLinkTypes`

List the outgoing links for an object type.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager** application."

## Query parameters

- `branch` · string
  "The Foundry branch to load the outgoing link types from. If not specified, the default branch will be used. Branches are an experimental feature and not all workflows are supported."
- `pageSize` · integer
  "The desired size of the page to be returned."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListOutgoingLinkTypesResponseV2` · object · required
  "Success response."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
  - `data` · list
    "The list of link type sides in the current page."
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
