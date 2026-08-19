<!-- source: https://palantir.com/docs/foundry/api/ontology-resources/object-types/list-outgoing-link-types/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Outgoing Link Types

`GET /api/v1/ontologies/{ontologyRid}/objectTypes/{objectType}/outgoingLinkTypes`

List the outgoing links for an object type.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontologyRid` · string · required
  "The unique Resource Identifier (RID) of the Ontology that contains the object type. To look up your Ontology RID, please use the **List ontologies** endpoint or check the **Ontology Manager** application."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager** application."

## Query parameters

- `pageSize` · integer
  "The desired size of the page to be returned."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListOutgoingLinkTypesResponse` · object · required
  "Success response."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
  - `data` · list
    "The list of link type sides in the current page."
    - `LinkTypeSide` · object · required
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
