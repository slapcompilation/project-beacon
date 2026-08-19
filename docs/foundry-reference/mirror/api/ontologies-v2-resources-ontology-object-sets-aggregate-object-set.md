<!-- source: https://palantir.com/docs/foundry/api/ontologies-v2-resources/ontology-object-sets/aggregate-object-set/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Aggregate Object Set

`POST /api/v2/ontologies/{ontology}/objectSets/aggregate`

Aggregates the ontology objects present in the `ObjectSet` from the provided object set definition.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."

## Query parameters

- `sdkPackageRid` · string
  "The package rid of the generated SDK."
- `sdkVersion` · string
  "The package version of the generated SDK."
- `branch` · string
  "The Foundry branch to aggregate the objects from. If not specified, the default branch is used. Branches are an experimental feature and not all workflows are supported."
- `transactionId` · string
  "The ID of an Ontology transaction to read from. Transactions are an experimental feature and all workflows may not be supported."
- `scenarioRid` · string
  "The resource identifier of an ontology scenario to aggregate the objects on."
- `executeInMemoryOnly` · boolean
  "If true, the request fails with an error when it cannot be computed in-memory. Use this to opt into fast failure on requests that would otherwise require heavier computation. Defaults to false."

## Request

- `AggregateObjectSetRequestV2` · object · required
  - `aggregation` · list
    - `AggregationV2` · union · required
      "Specifies an aggregation function."
      - `approximateDistinct` · object
        "Computes an approximate number of distinct values for the provided field. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `name` · string
          "A user-specified alias for an aggregation metric name."
        - `direction` · enum
          one of `ASC`, `DESC`
      - `min` · object
        "Computes the minimum value for the provided field. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `name` · string
          "A user-specified alias for an aggregation metric name."
        - `direction` · enum
          one of `ASC`, `DESC`
      - `avg` · object
        "Computes the average value for the provided field. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `name` · string
          "A user-specified alias for an aggregation metric name."
        - `direction` · enum
          one of `ASC`, `DESC`
      - `max` · object
        "Computes the maximum value for the provided field. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `name` · string
          "A user-specified alias for an aggregation metric name."
        - `direction` · enum
          one of `ASC`, `DESC`
      - `approximatePercentile` · object
        "Computes the approximate percentile value for the provided field. Requires Object Storage V2. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `name` · string
          "A user-specified alias for an aggregation metric name."
        - `approximatePercentile` · number · required
        - `direction` · enum
          one of `ASC`, `DESC`
      - `count` · object
        "Computes the total count of objects."
        - `name` · string
          "A user-specified alias for an aggregation metric name."
        - `direction` · enum
          one of `ASC`, `DESC`
      - `sum` · object
        "Computes the sum of values for the provided field. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `name` · string
          "A user-specified alias for an aggregation metric name."
        - `direction` · enum
          one of `ASC`, `DESC`
      - `exactDistinct` · object
        "Computes an exact number of distinct values for the provided field. May be slower than an approximate distinct aggregation. Requires Object Storage V2. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `name` · string
          "A user-specified alias for an aggregation metric name."
        - `direction` · enum
          one of `ASC`, `DESC`
  - `objectSet` · union · required
    "Represents the definition of an `ObjectSet` in the `Ontology`."
    - `searchAround` · object
      - `objectSet` · union · required
        "Represents the definition of an `ObjectSet` in the `Ontology`."
      - `link` · string · required
        "The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application."
    - `static` · object
      - `objects` · list
        - `ObjectRid` · string · required
          "The unique resource identifier of an object, useful for interacting with other Foundry APIs."
    - `intersect` · object
      - `objectSets` · list
        - `ObjectSet` · union · required
          "Represents the definition of an `ObjectSet` in the `Ontology`."
    - `withProperties` · object
      "ObjectSet which returns objects with additional derived properties. This feature is experimental and not yet generally available."
      - `objectSet` · union · required
        "Represents the definition of an `ObjectSet` in the `Ontology`."
      - `derivedProperties` · map
        "Map of the name of the derived property to return and its definition"
        - `DerivedPropertyApiName` · string · required
          "The name of the derived property that will be returned."
        - `DerivedPropertyDefinition` · union · required
          "Definition of a derived property."
          - `add` · object
            "Adds two or more numeric values."
            - `properties` · list
              - `DerivedPropertyDefinition` · union · required
                "Definition of a derived property."
          - `absoluteValue` · object
            "Calculates absolute value of a numeric value."
            - `property` · union · required
              "Definition of a derived property."
          - `extract` · object
            "Extracts the specified date part from a date or timestamp."
            - `property` · union · required
              "Definition of a derived property."
            - `part` · enum · required
              one of `DAYS`, `MONTHS`, `QUARTERS`, `YEARS`
          - `selection` · object
            "Definition for a selected property over a MethodObjectSet."
            - `objectSet` · union · required
            - `operation` · union · required
              "Operation on a selected property, can be an aggregation function or retrieval of a single selected property"
              - `approximateDistinct` · object
                "Computes an approximate number of distinct values for the provided field."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `min` · object
                "Computes the minimum value for the provided field."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `avg` · object
                "Computes the average value for the provided field."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `max` · object
                "Computes the maximum value for the provided field."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `approximatePercentile` · object
                "Computes the approximate percentile value for the provided field."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                - `approximatePercentile` · number · required
              - `get` · object
                "Gets a single value of a property. Throws if the target object set is on the MANY side of the link and could explode the cardinality. Use collectList or collectSet which will return a list of values in that case."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `count` · object
                "Computes the total count of objects."
              - `sum` · object
                "Computes the sum of values for the provided field."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `collectList` · object
                "Lists all values of a property up to the specified limit. The maximum supported limit is 100, by default. NOTE: A separate count aggregation should be used to determine the total count of values, to account for a possible truncation of the returned list. Ignores objects for which a property is absent, so the returned list will contain non-null values only. Returns an empty list when none of the objects have values for a provided property."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                - `limit` · integer · required
                  "Maximum number of values to collect. The maximum supported limit is 100."
              - `exactDistinct` · object
                "Computes an exact number of distinct values for the provided field. May be slower than an approximate distinct aggregation."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `collectSet` · object
                "Lists all distinct values of a property up to the specified limit. The maximum supported limit is 100. NOTE: A separate cardinality / exactCardinality aggregation should be used to determine the total count of values, to account for a possible truncation of the returned set. Ignores objects for which a property is absent, so the returned list will contain non-null values only. Returns an empty list when none of the objects have values for a provided property."
                - `selectedPropertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                - `limit` · integer · required
                  "Maximum number of values to collect. The maximum supported limit is 100."
          - `negate` · object
            "Negates a numeric value."
            - `property` · union · required
              "Definition of a derived property."
          - `subtract` · object
            "Subtracts the right numeric value from the left numeric value."
            - `left` · union · required
              "Definition of a derived property."
            - `right` · union · required
              "Definition of a derived property."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `least` · object
            "Finds least of two or more numeric, date or timestamp values."
            - `properties` · list
              - `DerivedPropertyDefinition` · union · required
                "Definition of a derived property."
          - `divide` · object
            "Divides the left numeric value by the right numeric value."
            - `left` · union · required
              "Definition of a derived property."
            - `right` · union · required
              "Definition of a derived property."
          - `multiply` · object
            "Multiplies two or more numeric values."
            - `properties` · list
              - `DerivedPropertyDefinition` · union · required
                "Definition of a derived property."
          - `greatest` · object
            "Finds greatest of two or more numeric, date or timestamp values."
            - `properties` · list
              - `DerivedPropertyDefinition` · union · required
                "Definition of a derived property."
    - `interfaceLinkSearchAround` · object
      - `objectSet` · union · required
        "Represents the definition of an `ObjectSet` in the `Ontology`."
      - `interfaceLink` · string · required
        "The name of the interface link type in the API. To find the API name for your Interface Link Type, check the [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
    - `subtract` · object
      - `objectSets` · list
        - `ObjectSet` · union · required
          "Represents the definition of an `ObjectSet` in the `Ontology`."
    - `nearestNeighbors` · object
      "ObjectSet containing the top `numNeighbors` objects with `propertyIdentifier` nearest to the input vector or text. This can only be performed on a property with type vector that has been configured to be searched with approximate nearest neighbors using a similarity function configured in the Ontology. A non-zero score for each resulting object is returned when the `orderType` in the `orderBy` field is set to `relevance`. Note that: - Scores will not be returned if a nearestNeighbors object set is composed through union, subtraction or intersection with non-nearestNeighbors object sets. - If results have scores, the order of the scores will be decreasing (duplicate scores are possible)."
      - `objectSet` · union · required
        "Represents the definition of an `ObjectSet` in the `Ontology`."
      - `propertyIdentifier` · union · required
        "An identifier used to select properties or struct fields."
        - `property` · object
          "A property api name that references properties to query on."
          - `apiName` · string · required
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `structField` · object
          "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
          - `propertyApiName` · string · required
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structFieldApiName` · string · required
            "The name of a struct field in the Ontology."
        - `propertyWithLoadLevel` · object
          "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
          - `propertyIdentifier` · union · required
            "An identifier used to select properties or struct fields."
          - `loadLevel` · union · required
            "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
            - `applyReducersAndExtractMainValue` · object
              "Performs both apply reducers and extract main value to return the reduced main value."
            - `applyReducers` · object
              "Returns a single value of an array as configured in the ontology."
            - `extractMainValue` · object
              "Returns the main value of a struct as configured in the ontology."
            - `noLoadLevel` · object
              "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
        - `titleProperty` · object
          "Specifies the title property of an object type which is present on all object types."
        - `primaryKeyProperty` · object
          "Specifies the primary key property of an object type which is present on all object types."
      - `numNeighbors` · integer · required
        "The number of objects to return. If the number of documents in the objectType is less than the provided value, all objects will be returned. This value is limited to 1 &lt;= numNeighbors &lt;= 500."
      - `similarityThreshold` · number
        "The similarity threshold results must be above to be included in the returned in the object set. 0 &lt;= Threshold &lt;= 1. Where 1 is identical and 0 is least similar."
      - `query` · union · required
        "Queries support either a vector matching the embedding model defined on the property, or text that is automatically embedded."
        - `vector` · object
          "The vector to search with. The vector must be of the same dimension as the vectors stored in the provided propertyIdentifier."
          - `value` · list
        - `text` · object
          "Automatically embed the text in a vector using the embedding model configured for the given propertyIdentifier."
          - `value` · string · required
    - `union` · object
      - `objectSets` · list
        - `ObjectSet` · union · required
          "Represents the definition of an `ObjectSet` in the `Ontology`."
    - `asType` · object
      "Casts an object set to a specified object type or interface type API name. Any object whose object type does not match the object type provided or implement the interface type provided will be dropped from the resulting object set."
      - `entityType` · string · required
        "An object type or interface type API name."
      - `objectSet` · union · required
        "Represents the definition of an `ObjectSet` in the `Ontology`."
    - `methodInput` · object
      "ObjectSet which is the root of a MethodObjectSet definition. This feature is experimental and not yet generally available."
    - `reference` · object
      - `reference` · string · required
    - `filter` · object
      - `objectSet` · union · required
        "Represents the definition of an `ObjectSet` in the `Ontology`."
      - `where` · union · required
        - `lt` · object
          "Returns objects where the specified field is less than a value. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · any · required
            "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
        - `doesNotIntersectBoundingBox` · object
          "Returns objects where the specified field does not intersect the bounding box provided. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · object · required
            "The top left and bottom right coordinate points that make up the bounding box."
            - `topLeft` · union · required
              - `Point` · object
                - `coordinates` · list
                  "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                  - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
            - `bottomRight` · union · required
              - `Point` · object
                - `coordinates` · list
                  "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                  - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
        - `relativeDateRange` · object
          "Returns objects where the specified date or timestamp property falls within a relative date range. The bounds are calculated relative to query execution time and rounded to midnight in the specified timezone."
          - `field` · string
            "The property API name to filter on (either field or propertyIdentifier must be provided)."
          - `propertyIdentifier` · union
            "The property identifier to filter on (either field or propertyIdentifier must be provided)."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `relativeStartTime` · union
            "The lower bound relative to query time (inclusive). Negative values go into the past. For example, { value: -7, timeUnit: DAY } means 7 days ago."
            - `relativePoint` · object
              "A point in time specified relative to query execution time."
              - `value` · integer · required
                "The numeric value of the time offset. Negative values indicate the past, positive values the future."
              - `timeUnit` · enum · required
                one of `DAY`, `WEEK`, `MONTH`, `YEAR`
                "The unit of time for the value."
          - `relativeEndTime` · union
            "The upper bound relative to query time (exclusive). Negative values go into the past. For example, { value: 1, timeUnit: MONTH } means the start of next month."
            - `relativePoint` · object
              "A point in time specified relative to query execution time."
              - `value` · integer · required
                "The numeric value of the time offset. Negative values indicate the past, positive values the future."
              - `timeUnit` · enum · required
                one of `DAY`, `WEEK`, `MONTH`, `YEAR`
                "The unit of time for the value."
          - `timeZoneId` · string · required
            "Time zone ID for midnight calculation (e.g., "America/New_York", "Europe/London", "Etc/UTC"). See https://en.wikipedia.org/wiki/List_of_tz_database_time_zones for valid values."
        - `wildcard` · object
          "Returns objects where the specified field matches the wildcard pattern provided. Either `field` or `propertyIdentifier` can be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · string · required
        - `withinDistanceOf` · object
          "Returns objects where the specified field contains a point within the distance provided of the center point. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · object · required
            "The coordinate point to use as the center of the distance query."
            - `center` · union · required
              - `Point` · object
                - `coordinates` · list
                  "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                  - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
            - `distance` · object · required
              "A measurement of distance."
              - `value` · number · required
              - `unit` · enum · required
                one of `MILLIMETERS`, `CENTIMETERS`, `METERS`, `KILOMETERS`, `INCHES`, `FEET`, `YARDS`, `MILES`, `NAUTICAL_MILES`
        - `withinBoundingBox` · object
          "Returns objects where the specified field contains a point within the bounding box provided. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · object · required
            "The top left and bottom right coordinate points that make up the bounding box."
            - `topLeft` · union · required
              - `Point` · object
                - `coordinates` · list
                  "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                  - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
            - `bottomRight` · union · required
              - `Point` · object
                - `coordinates` · list
                  "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                  - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
        - `not` · object
          "Returns objects where the query is not satisfied."
          - `value` · union · required
        - `intersectsBoundingBox` · object
          "Returns objects where the specified field intersects the bounding box provided. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · object · required
            "The top left and bottom right coordinate points that make up the bounding box."
            - `topLeft` · union · required
              - `Point` · object
                - `coordinates` · list
                  "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                  - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
            - `bottomRight` · union · required
              - `Point` · object
                - `coordinates` · list
                  "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                  - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
        - `and` · object
          "Returns objects where every query is satisfied."
          - `value` · list
            - `SearchJsonQueryV2` · union · required
        - `containsAllTermsInOrderPrefixLastTerm` · object
          "Returns objects where the specified field contains all of the terms in the order provided, but they do have to be adjacent to each other. The last term can be a partial prefix match. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` can be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · string · required
        - `gte` · object
          "Returns objects where the specified field is greater than or equal to a value. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · any · required
            "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
        - `containsAllTermsInOrder` · object
          "Returns objects where the specified field contains all of the terms in the order provided, but they do have to be adjacent to each other. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · string · required
        - `withinPolygon` · object
          "Returns objects where the specified field contains a point within the polygon provided. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · union · required
            - `Polygon` · object
              - `coordinates` · list
                - `LinearRing` · list · required
                  "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                  - `Position` · list · required
                    "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                    - `Coordinate` · number · required
              - `bbox` · list
                "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                - `Coordinate` · number · required
        - `intersectsPolygon` · object
          "Returns objects where the specified field intersects the polygon provided. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · union · required
            - `Polygon` · object
              - `coordinates` · list
                - `LinearRing` · list · required
                  "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                  - `Position` · list · required
                    "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                    - `Coordinate` · number · required
              - `bbox` · list
                "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                - `Coordinate` · number · required
        - `lte` · object
          "Returns objects where the specified field is less than or equal to a value. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · any · required
            "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
        - `or` · object
          "Returns objects where at least 1 query is satisfied."
          - `value` · list
            - `SearchJsonQueryV2` · union · required
        - `in` · object
          "Returns objects where the specified field equals any of the provided values. Allows you to specify a property to query on by a variety of means. If an empty array is provided as the value, then the filter will match all objects in the object set. Either `field` or `propertyIdentifier` must be supplied, but not both. For string properties, full term matching only works when **Selectable** is enabled for the property in Ontology Manager."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · list
            - `PropertyValue` · any · required
              "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
        - `doesNotIntersectPolygon` · object
          "Returns objects where the specified field does not intersect the polygon provided. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · union · required
            - `Polygon` · object
              - `coordinates` · list
                - `LinearRing` · list · required
                  "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                  - `Position` · list · required
                    "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                    - `Coordinate` · number · required
              - `bbox` · list
                "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                - `Coordinate` · number · required
        - `eq` · object
          "Returns objects where the specified field is equal to a value. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both. For string properties, full term matching only works when **Selectable** is enabled for the property in Ontology Manager."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · any · required
            "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
        - `containsAllTerms` · object
          "Returns objects where the specified field contains all of the whitespace separated words in any order in the provided value. This query supports fuzzy matching. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · string · required
          - `fuzzy` · boolean
            "Setting fuzzy to `true` allows approximate matching in search queries that support it."
        - `gt` · object
          "Returns objects where the specified field is greater than a value. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · any · required
            "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
        - `contains` · object
          "Returns objects where the specified array contains a value. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · any · required
            "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
        - `regex` · object
          "Returns objects where the specified field matches the regex pattern provided. This applies to the non-analyzed form of text fields. Supported operators: - `.` matches any character. - `?` repeats the previous character 0 or 1 times. - `+` repeats the previous character 1 or more times. - `*` repeats the previous character 0 or more times. - `{}` defines the minimum and maximum number of times the preceding character can repeat. `{2}` means the previous character must repeat only twice, `{2,}` means the previous character must repeat at least twice, and `{2,4}` means the previous character must repeat between 2-4 times. - `|` is the OR operator. - `()` forms a group within an expression such that the group can be treated as a single character. - `[]` matches a single one of the characters contained inside the brackets, meaning [abc] matches `a`, `b` or `c`. Unless `-` is the first character or escaped with `\` (in which case it is treated as a normal character), `-` can be used inside the bracket to create a range of characters, meaning [a-c] matches `a`, `b`, or `c`. If the character sequence inside the brackets begins with `^`, the set of characters is negated, meaning [^abc] does not match `a`, `b`, or `c`. Otherwise, `^` is treated as a normal character. - `"` creates groups of string literals. - `\` is used as an escape character. However, \d and \D match digit and non-digit characters respectively, \s and \S match whitespace and non whitespace characters respectively, and \w and \W match word and non word characters respectively. Either `field` or `propertyIdentifier` can be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · string · required
        - `isNull` · object
          "Returns objects based on the existence of the specified field. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · boolean · required
        - `containsAnyTerm` · object
          "Returns objects where the specified field contains any of the whitespace separated words in any order in the provided value. This query supports fuzzy matching. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · string · required
          - `fuzzy` · boolean
            "Setting fuzzy to `true` allows approximate matching in search queries that support it."
        - `interval` · object
          "Returns objects where the specified field matches the sub-rule provided. This applies to the analyzed form of text fields. Either `field` or `propertyIdentifier` can be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `rule` · union · required
            "Sub-rule used for evaluating an IntervalQuery"
            - `allOf` · object
              "Matches intervals satisfying all the rules in the query"
              - `rules` · list
                - `IntervalQueryRule` · union · required
                  "Sub-rule used for evaluating an IntervalQuery"
              - `maxGaps` · integer
                "The maximum gaps between the intervals produced by the sub-rules. If not set, then gaps are not considered."
              - `ordered` · boolean · required
                "If true, the matched intervals must occur in order."
            - `match` · object
              "Matches intervals containing the terms in the query"
              - `query` · string · required
              - `maxGaps` · integer
                "The maximum gaps between matched terms in the interval. For example, in the text "quick brown fox", the terms "quick" and "fox" have a gap of one. If not set, then gaps are not considered."
              - `ordered` · boolean · required
                "If true, the matched terms must occur in order."
            - `anyOf` · object
              "Matches intervals satisfying any of the rules in the query"
              - `rules` · list
                - `IntervalQueryRule` · union · required
                  "Sub-rule used for evaluating an IntervalQuery"
            - `prefixOnLastToken` · object
              "Matches intervals containing all the terms, using exact match for all but the last term, and prefix match for the last term. Ordering of the terms in the query is preserved."
              - `query` · string · required
            - `fuzzy` · object
              "Matches intervals containing terms that are similar to the provided term, within an edit distance defined by fuzziness. An edit is a single character change needed to make a term match, including character insertion, deletion, substitution, or transposition of two adjacent characters."
              - `term` · string · required
                "The term to match."
              - `fuzziness` · integer
                "Maximum edit distance allowed for matching. Valid values are 0, 1, or 2. Defaults to 2."
        - `geoShapeV2` · object
          "Returns objects where the specified field satisfies the provided geometry query with the given spatial operator. Supports both envelope (bounding box) and GeoJSON geometries for filtering geopoint or geoshape properties. Either `field` or `propertyIdentifier` can be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `geometry` · union · required
            "Geometry specification for a GeoShapeV2Query. Supports bounding box envelopes and arbitrary GeoJSON geometries."
            - `envelope` · object
              "The top left and bottom right coordinate points that make up the bounding box."
              - `topLeft` · union · required
                - `Point` · object
                  - `coordinates` · list
                    "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                    - `Coordinate` · number · required
                  - `bbox` · list
                    "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                    - `Coordinate` · number · required
              - `bottomRight` · union · required
                - `Point` · object
                  - `coordinates` · list
                    "GeoJSon fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                    - `Coordinate` · number · required
                  - `bbox` · list
                    "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                    - `Coordinate` · number · required
            - `geoJson` · object
              "A GeoJSON geometry specification."
              - `geoJson` · string · required
                "A GeoJSON geometry string. Supported geometry types include Point, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon, and GeometryCollection."
          - `spatialFilterMode` · enum · required
            one of `INTERSECTS`, `DISJOINT`, `WITHIN`, `CONTAINS`
            "The spatial relation operator for a GeoShapeV2Query. INTERSECTS matches objects that intersect the provided geometry, DISJOINT matches objects that do not intersect the provided geometry, WITHIN matches objects that lie within the provided geometry, and CONTAINS matches objects that contain the provided geometry."
        - `startsWith` · object
          "Deprecated alias for `containsAllTermsInOrderPrefixLastTerm`, which is preferred because the name `startsWith` is misleading. Returns objects where the specified field starts with the provided value. Allows you to specify a property to query on by a variety of means. Either `field` or `propertyIdentifier` must be supplied, but not both."
          - `field` · string
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertyIdentifier` · union
            "An identifier used to select properties or struct fields."
            - `property` · object
              "A property api name that references properties to query on."
              - `apiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structField` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `structFieldApiName` · string · required
                "The name of a struct field in the Ontology."
            - `propertyWithLoadLevel` · object
              "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
              - `propertyIdentifier` · union · required
                "An identifier used to select properties or struct fields."
              - `loadLevel` · union · required
                "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
                - `applyReducersAndExtractMainValue` · object
                  "Performs both apply reducers and extract main value to return the reduced main value."
                - `applyReducers` · object
                  "Returns a single value of an array as configured in the ontology."
                - `extractMainValue` · object
                  "Returns the main value of a struct as configured in the ontology."
                - `noLoadLevel` · object
                  "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
            - `titleProperty` · object
              "Specifies the title property of an object type which is present on all object types."
            - `primaryKeyProperty` · object
              "Specifies the primary key property of an object type which is present on all object types."
          - `value` · string · required
    - `interfaceBase` · object
      - `interfaceType` · string · required
        "An object set with objects that implement the interface with the given interface API name. The objects in the object set will only have properties that implement properties of the given interface, unless you set the includeAllBaseObjectProperties flag."
      - `includeAllBaseObjectProperties` · boolean
        "A flag that will return all of the underlying object properties for the objects that implement the interface. This includes properties that don't explicitly implement an SPT on the interface."
    - `asBaseObjectTypes` · object
      "Casts the objects in the object set to their base type and thus ensures objects are returned with all of their properties in the resulting object set, not just the properties that implement interface properties."
      - `objectSet` · union · required
        "Represents the definition of an `ObjectSet` in the `Ontology`."
    - `base` · object
      - `objectType` · string · required
        "The API name of the object type."
  - `groupBy` · list
    - `AggregationGroupByV2` · union · required
      "Specifies a grouping for aggregation results."
      - `duration` · object
        "Divides objects into groups according to an interval. Note that this grouping applies only on date and timestamp types. When grouping by `YEARS`, `QUARTERS`, `MONTHS`, or `WEEKS`, the `value` must be set to `1`. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `value` · integer · required
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`, `QUARTERS`
      - `fixedWidth` · object
        "Divides objects into groups with the specified width. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `fixedWidth` · integer · required
      - `ranges` · object
        "Divides objects into groups according to specified ranges. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `ranges` · list
          - `AggregationRangeV2` · object · required
            "Specifies a range from an inclusive start value to an exclusive end value."
            - `startValue` · any · required
              "Inclusive start."
            - `endValue` · any · required
              "Exclusive end."
      - `exact` · object
        "Divides objects into groups according to an exact value. Either `field` or `propertyIdentifier` must be supplied, but not both."
        - `field` · string
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `propertyIdentifier` · union
          "An identifier used to select properties or struct fields."
          - `property` · object
            "A property api name that references properties to query on."
            - `apiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `structField` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
            - `structFieldApiName` · string · required
              "The name of a struct field in the Ontology."
          - `propertyWithLoadLevel` · object
            "A combination of a property identifier and the load level to apply to the property. You can select a reduced value for arrays and the main value for structs. If the provided load level cannot be applied to the property type, then it will be ignored. This selector is experimental and may not work in filters or sorts."
            - `propertyIdentifier` · union · required
              "An identifier used to select properties or struct fields."
            - `loadLevel` · union · required
              "The load level of the property: - APPLY_REDUCERS: Returns a single value of an array as configured in the ontology. - EXTRACT_MAIN_VALUE: Returns the main value of a struct as configured in the ontology. - APPLY_REDUCERS_AND_EXTRACT_MAIN_VALUE: Performs both to return the reduced main value. - NO_LOAD_LEVEL: Returns the property as-is, without applying reducers or extracting a struct main value."
              - `applyReducersAndExtractMainValue` · object
                "Performs both apply reducers and extract main value to return the reduced main value."
              - `applyReducers` · object
                "Returns a single value of an array as configured in the ontology."
              - `extractMainValue` · object
                "Returns the main value of a struct as configured in the ontology."
              - `noLoadLevel` · object
                "Returns the property as-is, without applying reducers or extracting a struct main value. Useful as an explicit per-property load level (via `PropertyWithLoadLevelSelector`) to opt a property out of a `defaultLoadLevel`."
          - `titleProperty` · object
            "Specifies the title property of an object type which is present on all object types."
          - `primaryKeyProperty` · object
            "Specifies the primary key property of an object type which is present on all object types."
        - `maxGroupCount` · integer
          "The maximum number of groups to return. If omitted, defaults to 10,000. The server allocates resources based on the specified `maxGroupCount`. When the number of distinct values in your data is within this limit, results are accurate and the top N values are returned correctly. When distinct values exceed what the allocated resources can handle, results may become approximate. If you need accurate results with high-cardinality properties, set `maxGroupCount` high enough to cover your distinct values. Items exceeding the limit are excluded from results and counted in `excludedItems`. The response `accuracy` field indicates whether the results are `ACCURATE` or `APPROXIMATE`."
        - `defaultValue` · string
          "Includes a group with the specified default value that includes all objects where the specified field's value is null. Cannot be used with includeNullValues."
        - `includeNullValues` · boolean
          "Includes a group with a null value that includes all objects where the specified field's value is null. Cannot be used with defaultValue or orderBy clauses on the aggregation."
  - `accuracy` · enum
    one of `REQUIRE_ACCURATE`, `ALLOW_APPROXIMATE`
    "Specifies the accuracy requirement for aggregation results. - `REQUIRE_ACCURATE`: Only return results if they are guaranteed to be accurate. If accuracy cannot be guaranteed (e.g., due to a low `maxGroupCount` relative to distinct values), the request will fail with an `AggregationAccuracyNotSupported` error. - `ALLOW_APPROXIMATE`: Allow approximate results when exact computation is not feasible. This is the default behavior if not specified."
  - `includeComputeUsage` · boolean
    "Indicates whether the response should include compute usage details for the request. This feature is currently only available for OSDK applications. Note: Enabling this flag may slow down query performance and is not recommended for use in production."

## Response

- `AggregateObjectsResponseV2` · object · required
  "Success response."
  - `excludedItems` · integer
  - `accuracy` · enum · required
    one of `ACCURATE`, `APPROXIMATE`
  - `data` · list
    - `AggregateObjectsResponseItemV2` · object · required
      - `group` · map
        - `AggregationGroupKeyV2` · string · required
        - `AggregationGroupValueV2` · any · required
      - `metrics` · list
        - `AggregationMetricResultV2` · object · required
          - `name` · string · required
          - `value` · any
            "The value of the metric. This will be a double in the case of a numeric metric, or a date string in the case of a date metric."
  - `computeUsage` · number
    "A measurement of compute usage expressed in [compute-seconds](/docs/foundry/resource-management/usage-types#compute-second). For more information, please refer to the [Usage types](/docs/foundry/resource-management/usage-types) documentation."
