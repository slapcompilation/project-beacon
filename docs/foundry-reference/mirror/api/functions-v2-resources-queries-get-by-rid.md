<!-- source: https://palantir.com/docs/foundry/api/functions-v2-resources/queries/get-by-rid/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get By Rid

`GET /api/v2/functions/queries/getByRid`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets a specific query type with the given RID. By default, this gets the latest version of the query.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:functions-read`.

Scopes: `api:functions-read`

## Query parameters

- `rid` · string · required
  "The unique resource identifier of a Function, useful for interacting with other Foundry APIs."
- `version` · string
  "The version of the given Function, written `<major>.<minor>.<patch>-<tag>`, where `-<tag>` is optional. Examples: `1.2.3`, `1.2.3-rc1`."
- `includePrerelease` · boolean
  "When no version is specified and this flag is set to true, the latest version resolution will consider prerelease versions (e.g., 1.2.3-beta could be returned as the latest). When false, only stable versions are considered when determining the latest version. Defaults to false."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `Query` · object · required
  - `apiName` · string · required
    "The name of the Query in the API."
  - `description` · string
  - `displayName` · string
    "The display name of the entity."
  - `parameters` · map
    - `ParameterId` · string · required
      "The unique identifier of the parameter. Parameters are used as inputs when an action or query is applied. Parameters can be viewed and managed in the **Ontology Manager**."
    - `Parameter` · object · required
      "Details about a parameter of a query."
      - `description` · string
      - `dataType` · union · required
        "A union of all the types supported by Query parameters or outputs."
        - `date` · object
        - `struct` · object
          - `fields` · list
            - `QueryStructField` · object · required
              - `name` · string · required
                "The name of a field in a `Struct`."
              - `fieldType` · union · required
                "A union of all the types supported by Query parameters or outputs."
        - `set` · object
          - `subType` · union · required
            "A union of all the types supported by Query parameters or outputs."
        - `void` · object
        - `string` · object
        - `double` · object
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
        - `union` · object
          - `unionTypes` · list
            - `QueryDataType` · union · required
              "A union of all the types supported by Query parameters or outputs."
        - `float` · object
        - `long` · object
        - `boolean` · object
        - `unsupported` · object
          - `unsupportedType` · string · required
          - `params` · map
            - `UnsupportedTypeParamKey` · string · required
            - `UnsupportedTypeParamValue` · string · required
        - `attachment` · object
        - `mediaReference` · object
        - `null` · object
        - `array` · object
          - `subType` · union · required
            "A union of all the types supported by Query parameters or outputs."
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
        - `valueTypeReference` · object
          "A reference to a value type that has been registered in the Ontology."
          - `rid` · string · required
            "The RID of a value type that has been registered in the Ontology."
          - `versionId` · string · required
            "The version ID of a value type that has been registered in the Ontology."
        - `typeReference` · object
          "A reference to a type that is defined in the `typeReferences` map of the enclosing Query. This enables support for recursive type definitions where a type may reference itself."
          - `typeId` · string · required
            "The unique identifier of a type reference. This identifier is used to look up the type definition in the `typeReferences` map of the enclosing Query."
        - `timestamp` · object
      - `required` · boolean · required
  - `output` · union · required
    "A union of all the types supported by Query parameters or outputs."
    - `date` · object
    - `struct` · object
      - `fields` · list
        - `QueryStructField` · object · required
          - `name` · string · required
            "The name of a field in a `Struct`."
          - `fieldType` · union · required
            "A union of all the types supported by Query parameters or outputs."
    - `set` · object
      - `subType` · union · required
        "A union of all the types supported by Query parameters or outputs."
    - `void` · object
    - `string` · object
    - `double` · object
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
    - `union` · object
      - `unionTypes` · list
        - `QueryDataType` · union · required
          "A union of all the types supported by Query parameters or outputs."
    - `float` · object
    - `long` · object
    - `boolean` · object
    - `unsupported` · object
      - `unsupportedType` · string · required
      - `params` · map
        - `UnsupportedTypeParamKey` · string · required
        - `UnsupportedTypeParamValue` · string · required
    - `attachment` · object
    - `mediaReference` · object
    - `null` · object
    - `array` · object
      - `subType` · union · required
        "A union of all the types supported by Query parameters or outputs."
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
    - `valueTypeReference` · object
      "A reference to a value type that has been registered in the Ontology."
      - `rid` · string · required
        "The RID of a value type that has been registered in the Ontology."
      - `versionId` · string · required
        "The version ID of a value type that has been registered in the Ontology."
    - `typeReference` · object
      "A reference to a type that is defined in the `typeReferences` map of the enclosing Query. This enables support for recursive type definitions where a type may reference itself."
      - `typeId` · string · required
        "The unique identifier of a type reference. This identifier is used to look up the type definition in the `typeReferences` map of the enclosing Query."
    - `timestamp` · object
  - `rid` · string · required
    "The unique resource identifier of a Function, useful for interacting with other Foundry APIs."
  - `version` · string · required
    "The version of the given Function, written `<major>.<minor>.<patch>-<tag>`, where `-<tag>` is optional. Examples: `1.2.3`, `1.2.3-rc1`."
  - `typeReferences` · map
    - `TypeReferenceIdentifier` · string · required
      "The unique identifier of a type reference. This identifier is used to look up the type definition in the `typeReferences` map of the enclosing Query."
    - `QueryDataType` · union · required
      "A union of all the types supported by Query parameters or outputs."
      - `date` · object
      - `struct` · object
        - `fields` · list
          - `QueryStructField` · object · required
            - `name` · string · required
              "The name of a field in a `Struct`."
            - `fieldType` · union · required
              "A union of all the types supported by Query parameters or outputs."
      - `set` · object
        - `subType` · union · required
          "A union of all the types supported by Query parameters or outputs."
      - `void` · object
      - `string` · object
      - `double` · object
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
      - `union` · object
        - `unionTypes` · list
          - `QueryDataType` · union · required
            "A union of all the types supported by Query parameters or outputs."
      - `float` · object
      - `long` · object
      - `boolean` · object
      - `unsupported` · object
        - `unsupportedType` · string · required
        - `params` · map
          - `UnsupportedTypeParamKey` · string · required
          - `UnsupportedTypeParamValue` · string · required
      - `attachment` · object
      - `mediaReference` · object
      - `null` · object
      - `array` · object
        - `subType` · union · required
          "A union of all the types supported by Query parameters or outputs."
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
      - `valueTypeReference` · object
        "A reference to a value type that has been registered in the Ontology."
        - `rid` · string · required
          "The RID of a value type that has been registered in the Ontology."
        - `versionId` · string · required
          "The version ID of a value type that has been registered in the Ontology."
      - `typeReference` · object
        "A reference to a type that is defined in the `typeReferences` map of the enclosing Query. This enables support for recursive type definitions where a type may reference itself."
        - `typeId` · string · required
          "The unique identifier of a type reference. This identifier is used to look up the type definition in the `typeReferences` map of the enclosing Query."
      - `timestamp` · object

## Errors

- `GetByRidPermissionDenied` (PERMISSION_DENIED) — "Could not getByRid the Query."
