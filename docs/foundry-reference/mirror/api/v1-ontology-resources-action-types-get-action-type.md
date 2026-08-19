<!-- source: https://palantir.com/docs/foundry/api/v1/ontology-resources/action-types/get-action-type/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Action Type

`GET /api/v1/ontologies/{ontologyRid}/actionTypes/{actionTypeApiName}`

Gets a specific action type with the given API name.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontologyRid` · string · required
  "The unique Resource Identifier (RID) of the Ontology that contains the action type."
- `actionTypeApiName` · string · required
  "The name of the action type in the API."

## Response

- `ActionType` · object · required
  "Success response."
  - `apiName` · string · required
    "The name of the action type in the API. To find the API name for your Action Type, use the `List action types` endpoint or check the **Ontology Manager**."
  - `description` · string
  - `displayName` · string
    "The display name of the entity."
  - `status` · enum · required
    one of `ACTIVE`, `ENDORSED`, `EXPERIMENTAL`, `DEPRECATED`
    "The release status of the entity."
  - `parameters` · map
    - `ParameterId` · string · required
      "The unique identifier of the parameter. Parameters are used as inputs when an action or query is applied. Parameters can be viewed and managed in the **Ontology Manager**."
    - `Parameter` · object · required
      "Details about a parameter of an action or query."
      - `description` · string
      - `baseType` · string · required
        "A string indicating the type of each data value. Note that these types can be nested, for example an array of structs. | Type                | JSON value                                                                                                        | |---------------------|-------------------------------------------------------------------------------------------------------------------| | Array               | `Array<T>`, where `T` is the type of the array elements, e.g. `Array<String>`.                                    | | Attachment          | `Attachment`                                                                                                      | | Boolean             | `Boolean`                                                                                                         | | Byte                | `Byte`                                                                                                            | | CipherText          | `CipherText`                                                                                                      | | Date                | `LocalDate`                                                                                                       | | Decimal             | `Decimal`                                                                                                         | | Double              | `Double`                                                                                                          | | Float               | `Float`                                                                                                           | | Integer             | `Integer`                                                                                                         | | Long                | `Long`                                                                                                            | | Marking             | `Marking`                                                                                                         | | OntologyObject      | `OntologyObject<T>` where `T` is the API name of the referenced object type.                                      | | Short               | `Short`                                                                                                           | | String              | `String`                                                                                                          | | Struct              | `Struct<T>` where `T` contains field name and type pairs, e.g. `Struct<{ firstName: String, lastName: string }>`  | | Timeseries          | `TimeSeries<T>` where `T` is either `String` for an enum series or `Double` for a numeric series.                 | | Timestamp           | `Timestamp`                                                                                                       |"
      - `dataType` · union
        "A union of all the primitive types used by Palantir's Ontology-based products."
        - `date` · object
        - `struct` · object
          - `fields` · list
            - `OntologyStructField` · object · required
              - `name` · string · required
                "The name of a field in a `Struct`."
              - `fieldType` · union · required
                "A union of all the primitive types used by Palantir's Ontology-based products."
              - `required` · boolean · required
        - `set` · object
          - `itemType` · union · required
            "A union of all the primitive types used by Palantir's Ontology-based products."
        - `string` · object
        - `byte` · object
        - `double` · object
        - `integer` · object
        - `float` · object
        - `any` · object
        - `long` · object
        - `boolean` · object
        - `cipherText` · object
          - `defaultCipherChannel` · string
            "An optional Cipher Channel RID which can be used for encryption updates to empty values."
        - `marking` · object
          - `markingType` · enum
            one of `CBAC`, `MANDATORY`
            "The kind of marking applied by a marking property type. - `CBAC`: Classification-based access control markings. - `MANDATORY`: Standard non-classification markings. Example - Organizations."
        - `unsupported` · object
          - `unsupportedType` · string · required
          - `params` · map
            - `UnsupportedTypeParamKey` · string · required
            - `UnsupportedTypeParamValue` · string · required
        - `mediaReference` · object
        - `array` · object
          - `itemType` · union · required
            "A union of all the primitive types used by Palantir's Ontology-based products."
        - `objectSet` · object
          - `objectApiName` · string
            "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
          - `objectTypeApiName` · string
            "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
        - `binary` · object
        - `short` · object
        - `decimal` · object
          - `precision` · integer
            "The total number of digits of the Decimal type. The maximum value is 38."
          - `scale` · integer
            "The number of digits to the right of the decimal point. The maximum value is 38."
        - `map` · object
          - `keyType` · union · required
            "A union of all the primitive types used by Palantir's Ontology-based products."
          - `valueType` · union · required
            "A union of all the primitive types used by Palantir's Ontology-based products."
        - `timestamp` · object
        - `object` · object
          - `objectApiName` · string · required
            "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
          - `objectTypeApiName` · string · required
            "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
      - `required` · boolean · required
  - `rid` · string · required
    "The unique resource identifier of an action type, useful for interacting with other Foundry APIs."
  - `operations` · list
    - `LogicRule` · union · required
      - `deleteInterfaceObject` · object
        - `interfaceTypeApiName` · string · required
          "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
      - `modifyInterfaceObject` · object
        - `interfaceTypeApiName` · string · required
          "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
      - `modifyObject` · object
        - `objectTypeApiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
      - `deleteObject` · object
        - `objectTypeApiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
      - `createInterfaceObject` · object
        - `interfaceTypeApiName` · string · required
          "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
      - `deleteLink` · object
        - `linkTypeApiNameAtoB` · string · required
          "The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application."
        - `linkTypeApiNameBtoA` · string · required
          "The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application."
        - `aSideObjectTypeApiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
        - `bSideObjectTypeApiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
      - `createObject` · object
        - `objectTypeApiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
      - `createLink` · object
        - `linkTypeApiNameAtoB` · string · required
          "The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application."
        - `linkTypeApiNameBtoA` · string · required
          "The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application."
        - `aSideObjectTypeApiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
        - `bSideObjectTypeApiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
      - `applyScenario` · object
        "An Action rule that applies the edits accumulated on a referenced Scenario onto the ontology data context where the Action is applied. If the Action is applied in the context of main ontology data, the edits are applied there. If the Action is applied in the context of another Scenario, the edits are applied in that other Scenario. The scenario is supplied through the parameter identified by `scenarioParameter` of type `scenarioReference`. The affected object types and link types are explicitly enumerated in the scope."
        - `scenarioParameter` · string · required
          "The unique identifier of the parameter. Parameters are used as inputs when an action or query is applied. Parameters can be viewed and managed in the **Ontology Manager**."
        - `objectTypeApiNames` · list
          - `ObjectTypeApiName` · string · required
            "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
        - `linkTypes` · list
          - `ObjectTypeLinkTypeApiNameMapping` · object · required
            "Groups link type API names by the object type they're scoped to. Link type API names are only unique within an object type, so this pairing is required to identify a link type unambiguously."
            - `objectTypeApiName` · string · required
              "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
            - `linkTypes` · list
              "The list of link type API names scoped by the object type."
              - `LinkTypeApiName` · string · required
                "The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application."
