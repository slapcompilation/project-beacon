<!-- source: https://palantir.com/docs/foundry/api/ontology-resources/object-types/get-outgoing-link-type/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Outgoing Link Type

`GET /api/v1/ontologies/{ontologyRid}/objectTypes/{objectType}/outgoingLinkTypes/{linkType}`

Get an outgoing link for an object type.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontologyRid` · string · required
  "The unique Resource Identifier (RID) of the Ontology that contains the object type. To look up your Ontology RID, please use the **List ontologies** endpoint or check the **Ontology Manager** application."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager** application."
- `linkType` · string · required
  "The API name of the outgoing link. To find the API name for your link type, check the **Ontology Manager**."

## Response

- `LinkTypeSide` · object · required
  "Success response."
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
