<!-- source: https://palantir.com/docs/foundry/api/ontologies-v2-resources/query-types/list-query-types/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Query Types

`GET /api/v2/ontologies/{ontology}/queryTypes`

Lists the query types for the given Ontology.

Each query type is returned at its latest version. The latest version is the one that was most recently
published, which may be a pre-release version.

Each page may be smaller than the requested page size. However, it is guaranteed that if there are more
results available, at least one result will be present in the response.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."

## Query parameters

- `branch` · string
  "The Foundry branch to list queries from. If not specified, the default branch will be used. Branches are an experimental feature and not all workflows are supported."
- `pageSize` · integer
  "The desired size of the page to be returned. Defaults to 100. See [page sizes](/docs/foundry/api/general/overview/paging/#page-sizes) for details."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListQueryTypesResponseV2` · object · required
  "Success response."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
  - `data` · list
    - `QueryTypeV2` · object · required
      "Represents a query type in the Ontology."
      - `apiName` · string · required
        "The name of the Query in the API."
      - `description` · string
      - `displayName` · string
        "The display name of the entity."
      - `parameters` · map
        - `ParameterId` · string · required
          "The unique identifier of the parameter. Parameters are used as inputs when an action or query is applied. Parameters can be viewed and managed in the **Ontology Manager**."
        - `QueryParameterV2` · object · required
          "Details about a parameter of a query."
          - `description` · string
          - `dataType` · union · required
            "A union of all the types supported by Ontology Query parameters or outputs."
            - `date` · object
            - `interfaceObject` · object
              - `interfaceTypeApiName` · string
                "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
            - `struct` · object
              - `fields` · list
                - `QueryStructField` · object · required
                  - `name` · string · required
                    "The name of a field in a `Struct`."
                  - `fieldType` · union · required
                    "A union of all the types supported by Ontology Query parameters or outputs."
            - `string` · object
            - `integer` · object
            - `threeDimensionalAggregation` · object
              - `keyType` · union · required
                "A union of all the types supported by query aggregation keys."
                - `date` · object
                - `boolean` · object
                - `string` · object
                - `double` · object
                - `range` · object
                  - `subType` · union · required
                    "A union of all the types supported by query aggregation ranges."
                    - `date` · object
                    - `double` · object
                    - `integer` · object
                    - `timestamp` · object
                - `integer` · object
                - `timestamp` · object
              - `valueType` · object · required
                - `keyType` · union · required
                  "A union of all the types supported by query aggregation keys."
                  - `date` · object
                  - `boolean` · object
                  - `string` · object
                  - `double` · object
                  - `range` · object
                    - `subType` · union · required
                      "A union of all the types supported by query aggregation ranges."
                      - `date` · object
                      - `double` · object
                      - `integer` · object
                      - `timestamp` · object
                  - `integer` · object
                  - `timestamp` · object
                - `valueType` · union · required
                  "A union of all the types supported by query aggregation keys."
                  - `date` · object
                  - `double` · object
                  - `timestamp` · object
            - `float` · object
            - `long` · object
            - `unsupported` · object
              - `unsupportedType` · string · required
              - `params` · map
                - `UnsupportedTypeParamKey` · string · required
                - `UnsupportedTypeParamValue` · string · required
            - `attachment` · object
            - `array` · object
              - `subType` · union · required
                "A union of all the types supported by Ontology Query parameters or outputs."
            - `objectSet` · object
              - `objectApiName` · string
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
              - `objectTypeApiName` · string
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
            - `twoDimensionalAggregation` · object
              - `keyType` · union · required
                "A union of all the types supported by query aggregation keys."
                - `date` · object
                - `boolean` · object
                - `string` · object
                - `double` · object
                - `range` · object
                  - `subType` · union · required
                    "A union of all the types supported by query aggregation ranges."
                    - `date` · object
                    - `double` · object
                    - `integer` · object
                    - `timestamp` · object
                - `integer` · object
                - `timestamp` · object
              - `valueType` · union · required
                "A union of all the types supported by query aggregation keys."
                - `date` · object
                - `double` · object
                - `timestamp` · object
            - `typeReference` · object
              "A reference to a type that is defined in the `typeReferences` map of the enclosing Query. This enables support for recursive type definitions where a type may reference itself."
              - `typeId` · string · required
                "The unique identifier of a type reference. This identifier is used to look up the type definition in the `typeReferences` map of the enclosing Query."
            - `timestamp` · object
            - `set` · object
              - `subType` · union · required
                "A union of all the types supported by Ontology Query parameters or outputs."
            - `void` · object
            - `entrySet` · object
              - `keyType` · union · required
                "A union of all the types supported by Ontology Query parameters or outputs."
              - `valueType` · union · required
                "A union of all the types supported by Ontology Query parameters or outputs."
            - `double` · object
            - `union` · object
              - `unionTypes` · list
                - `QueryDataType` · union · required
                  "A union of all the types supported by Ontology Query parameters or outputs."
            - `boolean` · object
            - `mediaReference` · object
            - `null` · object
            - `interfaceObjectSet` · object
              - `interfaceTypeApiName` · string · required
                "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
            - `object` · object
              - `objectApiName` · string · required
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
              - `objectTypeApiName` · string · required
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
          - `required` · boolean · required
      - `output` · union · required
        "A union of all the types supported by Ontology Query parameters or outputs."
        - `date` · object
        - `interfaceObject` · object
          - `interfaceTypeApiName` · string
            "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
        - `struct` · object
          - `fields` · list
            - `QueryStructField` · object · required
              - `name` · string · required
                "The name of a field in a `Struct`."
              - `fieldType` · union · required
                "A union of all the types supported by Ontology Query parameters or outputs."
        - `string` · object
        - `integer` · object
        - `threeDimensionalAggregation` · object
          - `keyType` · union · required
            "A union of all the types supported by query aggregation keys."
            - `date` · object
            - `boolean` · object
            - `string` · object
            - `double` · object
            - `range` · object
              - `subType` · union · required
                "A union of all the types supported by query aggregation ranges."
                - `date` · object
                - `double` · object
                - `integer` · object
                - `timestamp` · object
            - `integer` · object
            - `timestamp` · object
          - `valueType` · object · required
            - `keyType` · union · required
              "A union of all the types supported by query aggregation keys."
              - `date` · object
              - `boolean` · object
              - `string` · object
              - `double` · object
              - `range` · object
                - `subType` · union · required
                  "A union of all the types supported by query aggregation ranges."
                  - `date` · object
                  - `double` · object
                  - `integer` · object
                  - `timestamp` · object
              - `integer` · object
              - `timestamp` · object
            - `valueType` · union · required
              "A union of all the types supported by query aggregation keys."
              - `date` · object
              - `double` · object
              - `timestamp` · object
        - `float` · object
        - `long` · object
        - `unsupported` · object
          - `unsupportedType` · string · required
          - `params` · map
            - `UnsupportedTypeParamKey` · string · required
            - `UnsupportedTypeParamValue` · string · required
        - `attachment` · object
        - `array` · object
          - `subType` · union · required
            "A union of all the types supported by Ontology Query parameters or outputs."
        - `objectSet` · object
          - `objectApiName` · string
            "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
          - `objectTypeApiName` · string
            "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
        - `twoDimensionalAggregation` · object
          - `keyType` · union · required
            "A union of all the types supported by query aggregation keys."
            - `date` · object
            - `boolean` · object
            - `string` · object
            - `double` · object
            - `range` · object
              - `subType` · union · required
                "A union of all the types supported by query aggregation ranges."
                - `date` · object
                - `double` · object
                - `integer` · object
                - `timestamp` · object
            - `integer` · object
            - `timestamp` · object
          - `valueType` · union · required
            "A union of all the types supported by query aggregation keys."
            - `date` · object
            - `double` · object
            - `timestamp` · object
        - `typeReference` · object
          "A reference to a type that is defined in the `typeReferences` map of the enclosing Query. This enables support for recursive type definitions where a type may reference itself."
          - `typeId` · string · required
            "The unique identifier of a type reference. This identifier is used to look up the type definition in the `typeReferences` map of the enclosing Query."
        - `timestamp` · object
        - `set` · object
          - `subType` · union · required
            "A union of all the types supported by Ontology Query parameters or outputs."
        - `void` · object
        - `entrySet` · object
          - `keyType` · union · required
            "A union of all the types supported by Ontology Query parameters or outputs."
          - `valueType` · union · required
            "A union of all the types supported by Ontology Query parameters or outputs."
        - `double` · object
        - `union` · object
          - `unionTypes` · list
            - `QueryDataType` · union · required
              "A union of all the types supported by Ontology Query parameters or outputs."
        - `boolean` · object
        - `mediaReference` · object
        - `null` · object
        - `interfaceObjectSet` · object
          - `interfaceTypeApiName` · string · required
            "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
        - `object` · object
          - `objectApiName` · string · required
            "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
          - `objectTypeApiName` · string · required
            "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
      - `rid` · string · required
        "The unique resource identifier of a Function, useful for interacting with other Foundry APIs."
      - `version` · string · required
        "The version of the given Function, written `<major>.<minor>.<patch>-<tag>`, where `-<tag>` is optional. Examples: `1.2.3`, `1.2.3-rc1`."
      - `typeReferences` · map
        - `TypeReferenceIdentifier` · string · required
          "The unique identifier of a type reference. This identifier is used to look up the type definition in the `typeReferences` map of the enclosing Query."
        - `QueryDataType` · union · required
          "A union of all the types supported by Ontology Query parameters or outputs."
          - `date` · object
          - `interfaceObject` · object
            - `interfaceTypeApiName` · string
              "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
          - `struct` · object
            - `fields` · list
              - `QueryStructField` · object · required
                - `name` · string · required
                  "The name of a field in a `Struct`."
                - `fieldType` · union · required
                  "A union of all the types supported by Ontology Query parameters or outputs."
          - `string` · object
          - `integer` · object
          - `threeDimensionalAggregation` · object
            - `keyType` · union · required
              "A union of all the types supported by query aggregation keys."
              - `date` · object
              - `boolean` · object
              - `string` · object
              - `double` · object
              - `range` · object
                - `subType` · union · required
                  "A union of all the types supported by query aggregation ranges."
                  - `date` · object
                  - `double` · object
                  - `integer` · object
                  - `timestamp` · object
              - `integer` · object
              - `timestamp` · object
            - `valueType` · object · required
              - `keyType` · union · required
                "A union of all the types supported by query aggregation keys."
                - `date` · object
                - `boolean` · object
                - `string` · object
                - `double` · object
                - `range` · object
                  - `subType` · union · required
                    "A union of all the types supported by query aggregation ranges."
                    - `date` · object
                    - `double` · object
                    - `integer` · object
                    - `timestamp` · object
                - `integer` · object
                - `timestamp` · object
              - `valueType` · union · required
                "A union of all the types supported by query aggregation keys."
                - `date` · object
                - `double` · object
                - `timestamp` · object
          - `float` · object
          - `long` · object
          - `unsupported` · object
            - `unsupportedType` · string · required
            - `params` · map
              - `UnsupportedTypeParamKey` · string · required
              - `UnsupportedTypeParamValue` · string · required
          - `attachment` · object
          - `array` · object
            - `subType` · union · required
              "A union of all the types supported by Ontology Query parameters or outputs."
          - `objectSet` · object
            - `objectApiName` · string
              "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
            - `objectTypeApiName` · string
              "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
          - `twoDimensionalAggregation` · object
            - `keyType` · union · required
              "A union of all the types supported by query aggregation keys."
              - `date` · object
              - `boolean` · object
              - `string` · object
              - `double` · object
              - `range` · object
                - `subType` · union · required
                  "A union of all the types supported by query aggregation ranges."
                  - `date` · object
                  - `double` · object
                  - `integer` · object
                  - `timestamp` · object
              - `integer` · object
              - `timestamp` · object
            - `valueType` · union · required
              "A union of all the types supported by query aggregation keys."
              - `date` · object
              - `double` · object
              - `timestamp` · object
          - `typeReference` · object
            "A reference to a type that is defined in the `typeReferences` map of the enclosing Query. This enables support for recursive type definitions where a type may reference itself."
            - `typeId` · string · required
              "The unique identifier of a type reference. This identifier is used to look up the type definition in the `typeReferences` map of the enclosing Query."
          - `timestamp` · object
          - `set` · object
            - `subType` · union · required
              "A union of all the types supported by Ontology Query parameters or outputs."
          - `void` · object
          - `entrySet` · object
            - `keyType` · union · required
              "A union of all the types supported by Ontology Query parameters or outputs."
            - `valueType` · union · required
              "A union of all the types supported by Ontology Query parameters or outputs."
          - `double` · object
          - `union` · object
            - `unionTypes` · list
              - `QueryDataType` · union · required
                "A union of all the types supported by Ontology Query parameters or outputs."
          - `boolean` · object
          - `mediaReference` · object
          - `null` · object
          - `interfaceObjectSet` · object
            - `interfaceTypeApiName` · string · required
              "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
          - `object` · object
            - `objectApiName` · string · required
              "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
            - `objectTypeApiName` · string · required
              "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
