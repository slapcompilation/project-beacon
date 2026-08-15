<!-- source: https://palantir.com/docs/foundry/api/functions-v2-resources/queries/get-query/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Query

`GET /api/v2/functions/queries/{queryApiName}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets a specific query type with the given API name. By default, this returns the highest semantic
version of the query, excluding pre-release versions. To resolve the most recently published version
instead, including pre-release versions, set `latestVersionResolution` to `PUBLISH_TIME`.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:functions-read`.

Scopes: `api:functions-read`

## Path parameters

- `queryApiName` · string · required
  "The name of the Query in the API."

## Query parameters

- `version` · string
  "The version of the given Function, written `<major>.<minor>.<patch>-<tag>`, where `-<tag>` is optional. Examples: `1.2.3`, `1.2.3-rc1`."
- `latestVersionResolution` · enum
  one of `PUBLISH_TIME`, `SEMANTIC_VERSION`
  "Controls how latest version is resolved when `version` is omitted. Defaults to `SEMANTIC_VERSION`."
- `includePrerelease` · boolean
  "When resolving the latest version, whether prerelease versions are considered. Defaults to `false`, except when `latestVersionResolution` is `PUBLISH_TIME`. Not supported together with `version`."
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

- `QueryNotFound` (NOT_FOUND) — "The given Query could not be found."
