<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/query-types/get-query-type/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Get Query Type

`GET /api/v2/ontologies/{ontology}/queryTypes/{queryApiName}`

Gets a specific query type with the given API name.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."
- `queryApiName` · string · required
  "The API name of the query type. To find the API name, use the **List query types** endpoint or check the **Ontology Manager**."

## Query parameters

- `version` · string
  "The version of the Query to get. If not specified, the latest version is used. The latest version is the one that was most recently published, including pre-release versions."
- `sdkPackageRid` · string
  "The package rid of the generated SDK."
- `sdkVersion` · string
  "The version of the generated SDK."

## Response

- `QueryTypeV2` · object · required
  "Success response."
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
