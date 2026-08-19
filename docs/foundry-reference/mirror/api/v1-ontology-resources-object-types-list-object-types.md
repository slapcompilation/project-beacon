<!-- source: https://palantir.com/docs/foundry/api/v1/ontology-resources/object-types/list-object-types/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Object Types

`GET /api/v1/ontologies/{ontologyRid}/objectTypes`

Lists the object types for the given Ontology.

Each page may be smaller or larger than the requested page size. However, it is guaranteed that if there are
more results available, at least one result will be present in the
response.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontologyRid` · string · required
  "The unique Resource Identifier (RID) of the Ontology that contains the object types. To look up your Ontology RID, please use the **List ontologies** endpoint or check the **Ontology Manager**."

## Query parameters

- `pageSize` · integer
  "The desired size of the page to be returned. Defaults to 500. See [page sizes](/docs/foundry/api/general/overview/paging/#page-sizes) for details."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListObjectTypesResponse` · object · required
  "Success response."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
  - `data` · list
    "The list of object types in the current page."
    - `ObjectType` · object · required
      "Represents an object type in the Ontology."
      - `apiName` · string · required
        "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
      - `legacyObjectTypeId` · string
        "The unique ID of an object type. This is a legacy identifier and is not recommended for use in new applications. To find the ID for your Object Type, check the **Ontology Manager**."
      - `displayName` · string
        "The display name of the entity."
      - `status` · enum · required
        one of `ACTIVE`, `ENDORSED`, `EXPERIMENTAL`, `DEPRECATED`
        "The release status of the entity."
      - `description` · string
        "The description of the object type."
      - `visibility` · enum
        one of `NORMAL`, `PROMINENT`, `HIDDEN`
        "The suggested visibility of the object type."
      - `primaryKey` · list
        "The primary key of the object. This is a list of properties that can be used to uniquely identify the object."
        - `PropertyApiName` · string · required
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
      - `properties` · map
        "A map of the properties of the object type."
        - `PropertyApiName` · string · required
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `Property` · object · required
          "Details about some property of an object."
          - `description` · string
          - `displayName` · string
            "The display name of the entity."
          - `baseType` · string · required
            "A string indicating the type of each data value. Note that these types can be nested, for example an array of structs. | Type                | JSON value                                                                                                        | |---------------------|-------------------------------------------------------------------------------------------------------------------| | Array               | `Array<T>`, where `T` is the type of the array elements, e.g. `Array<String>`.                                    | | Attachment          | `Attachment`                                                                                                      | | Boolean             | `Boolean`                                                                                                         | | Byte                | `Byte`                                                                                                            | | CipherText          | `CipherText`                                                                                                      | | Date                | `LocalDate`                                                                                                       | | Decimal             | `Decimal`                                                                                                         | | Double              | `Double`                                                                                                          | | Float               | `Float`                                                                                                           | | Integer             | `Integer`                                                                                                         | | Long                | `Long`                                                                                                            | | Marking             | `Marking`                                                                                                         | | OntologyObject      | `OntologyObject<T>` where `T` is the API name of the referenced object type.                                      | | Short               | `Short`                                                                                                           | | String              | `String`                                                                                                          | | Struct              | `Struct<T>` where `T` contains field name and type pairs, e.g. `Struct<{ firstName: String, lastName: string }>`  | | Timeseries          | `TimeSeries<T>` where `T` is either `String` for an enum series or `Double` for a numeric series.                 | | Timestamp           | `Timestamp`                                                                                                       |"
          - `legacyPropertyId` · string
            "The unique ID of a property. This is a legacy identifier and is not recommended for use in new applications. To find the ID for your property, check the **Ontology Manager**."
      - `rid` · string · required
        "The unique resource identifier of an object type, useful for interacting with other Foundry APIs."
