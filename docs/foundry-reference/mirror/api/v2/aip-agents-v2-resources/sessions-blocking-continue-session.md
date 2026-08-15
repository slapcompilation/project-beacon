<!-- source: https://palantir.com/docs/foundry/api/v2/aip-agents-v2-resources/sessions/blocking-continue-session/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Blocking Continue Session

`POST /api/v2/aipAgents/agents/{agentRid}/sessions/{sessionRid}/blockingContinue`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Continue a conversation session with an Agent, or add the first exchange to a session after creation.
Adds a new exchange to the session with the provided inputs, and generates a response from the Agent.
Blocks on returning the result of the added exchange until the response is fully generated.
Streamed responses are also supported; see `streamingContinue` for details.
Concurrent requests to continue the same session are not supported.
Clients should wait to receive a response before sending the next message.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:aip-agents-write`.

Scopes: `api:aip-agents-write`

## Path parameters

- `agentRid` · string · required
  "An RID identifying an Agent created in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
- `sessionRid` · string · required
  "The Resource Identifier (RID) of the conversation session."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `BlockingContinueSessionRequest` · object · required
  - `userInput` · object · required
    "The user message for the Agent to respond to."
    - `text` · string · required
      "The user message text."
  - `parameterInputs` · map
    "Any supplied values for [application variables](/docs/foundry/chatbot-studio/application-state/) to pass to the Agent for the exchange."
    - `ParameterId` · string · required
      "The unique identifier for a variable configured in the application state of an Agent in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
    - `ParameterValue` · union · required
      "The value provided for a variable configured in the [application state](/docs/foundry/chatbot-studio/application-state/) of an Agent."
      - `string` · object
        "A value passed for `StringParameter` application variable types."
        - `value` · string · required
      - `objectSet` · object
        "A value passed for `ObjectSetParameter` application variable types."
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
        - `ontology` · string · required
          "The API name of the Ontology for the provided `ObjectSet`. To find the API name, use the `List ontologies` endpoint or check the [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
  - `contextsOverride` · list
    "If set, automatic [context retrieval](/docs/foundry/chatbot-studio/retrieval-context/) is skipped and the list of specified context is provided to the Agent instead. If omitted, relevant context for the user message is automatically retrieved and included in the prompt, based on data sources configured on the Agent for the session."
    - `InputContext` · union · required
      "Custom retrieved [context](/docs/foundry/chatbot-studio/retrieval-context/) to provide to an Agent for continuing a session."
      - `functionRetrievedContext` · object
        "Context retrieved from running a function to include as additional context in the prompt to the Agent."
        - `functionRid` · string · required
          "The unique resource identifier of a Function, useful for interacting with other Foundry APIs."
        - `functionVersion` · string · required
          "The version of the given Function, written `<major>.<minor>.<patch>-<tag>`, where `-<tag>` is optional. Examples: `1.2.3`, `1.2.3-rc1`."
        - `retrievedPrompt` · string · required
          "String content returned from a context retrieval function."
      - `objectContext` · object
        "Details of relevant retrieved object instances for a user's message to include as additional context in the prompt to the Agent."
        - `objectRids` · list
          "The RIDs of the relevant object instances to include in the prompt."
          - `ObjectRid` · string · required
            "The unique resource identifier of an object, useful for interacting with other Foundry APIs."
        - `propertyTypeRids` · list
          "The RIDs of the property types for the given objects to include in the prompt."
          - `PropertyTypeRid` · string · required
            "The unique resource identifier of a property."
  - `sessionTraceId` · string
    "The unique identifier to use for this continue session trace. By generating and passing this ID to the `blockingContinue` endpoint, clients can use this trace ID to separately load details of the trace used to generate a result, while the result is in progress. If omitted, it will be generated automatically. Clients can check the generated ID by inspecting the `sessionTraceId` in the `SessionExchangeResult`."

## Response

- `SessionExchangeResult` · object · required
  "The result of the added exchange for the session."
  - `agentMarkdownResponse` · string · required
    "The final text response generated by the Agent. Responses are formatted using markdown."
  - `parameterUpdates` · map
    "Any updates to application variable values which were generated by the Agent for this exchange. Updates can only be generated for application variables configured with `READ_WRITE` access on the Agent in AIP Chatbot Studio."
    - `ParameterId` · string · required
      "The unique identifier for a variable configured in the application state of an Agent in [AIP Chatbot Studio](/docs/foundry/chatbot-studio/overview/)."
    - `ParameterValueUpdate` · union · required
      "A value update for an [application variable](/docs/foundry/chatbot-studio/application-state/) generated by the Agent. For `StringParameter` types, this will be the updated string value. For `ObjectSetParameter` types, this will be a Resource Identifier (RID) for the updated object set."
      - `string` · object
        "A value passed for `StringParameter` application variable types."
        - `value` · string · required
      - `objectSet` · object
        - `value` · string · required
  - `totalTokensUsed` · integer
    "Total tokens used to compute the result. Omitted if token usage information is not supported by the model used for the session."
  - `interruptedOutput` · boolean · required
    "True if the exchange was canceled. In that case, the response (if any) was provided by the client as part of the cancellation request rather than by the Agent."
  - `sessionTraceId` · string · required
    "The unique identifier for the session trace. The session trace lists the sequence of steps that an Agent takes to arrive at an answer. For example, a trace may include steps such as context retrieval and tool calls."

## Errors

- `ContextSizeExceededLimit` (INVALID_ARGUMENT) — "Failed to generate a response for a session because the context size of the LLM has been exceeded.
Clients should either retry with a shorter message or create a new session and try re-sending the message."
- `AgentIterationsExceededLimit` (INVALID_ARGUMENT) — "The Agent was unable to produce an answer in the set number of maximum iterations.
This can happen if the Agent gets confused or stuck in a loop, or if the query is too complex.
Try a different query or review the Agent configuration in AIP Chatbot Studio."
- `SessionExecutionFailed` (INTERNAL) — "Failed to generate a response for a session due to an unexpected error."
- `RateLimitExceeded` (CUSTOM_CLIENT) — "Failed to generate a response as the model rate limits were exceeded. Clients should wait and retry."
- `RetryAttemptsExceeded` (CUSTOM_CLIENT) — "Failed to generate a response after retrying up to the configured number of retry attempts. Clients should wait and retry."
- `RetryDeadlineExceeded` (CUSTOM_CLIENT) — "Failed to generate a response after retrying up to the configured retry deadline. Clients should wait and retry."
- `InvalidParameter` (INVALID_ARGUMENT) — "The provided application variable is not valid for the Agent for this session.
Check the available application variables for the Agent under the `parameters` property, and version through the API with `getAgent`, or in AIP Chatbot Studio.
The Agent version used for the session can be checked through the API with `getSession`."
- `InvalidParameterType` (INVALID_ARGUMENT) — "The provided value does not match the expected type for the application variable configured on the Agent for this session.
Check the available application variables for the Agent under the `parameters` property, and version through the API with `getAgent`, or in AIP Chatbot Studio.
The Agent version used for the session can be checked through the API with `getSession`."
- `ObjectTypeIdsNotFound` (NOT_FOUND) — "Some object types are configured for use by the Agent but could not be found.
The object types either do not exist or the client token does not have access.
Object types can be checked by listing available object types through the API, or searching in [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
- `ObjectTypeRidsNotFound` (NOT_FOUND) — "Some object types are configured for use by the Agent but could not be found.
The object types either do not exist or the client token does not have access.
Object types can be checked by listing available object types through the API, or searching in [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
- `FunctionLocatorNotFound` (NOT_FOUND) — "The specified function locator is configured for use by the Agent but could not be found.
The function type or version may not exist or the client token does not have access."
- `SessionTraceIdAlreadyExists` (INVALID_ARGUMENT) — "The provided trace ID already exists for the session and cannot be reused."
- `OntologyEntitiesNotFound` (NOT_FOUND) — "Some ontology types are configured for use by the Agent but could not be found.
The types either do not exist or the client token does not have access.
Object types and their link types can be checked by listing available object/link types through the API, or searching in [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
- `UnsupportedLanguageModelRid` (INVALID_ARGUMENT) — "The Agent is configured with a language model that is not supported or could not be resolved.
This can surface at runtime if the model was deprecated or is not accessible to the calling token.
Update the Agent's language model in AIP Chatbot Studio."
- `ActionTypeNotFound` (INVALID_ARGUMENT) — "An action tool configured on the Agent references an action type that could not be found.
This can surface at runtime if the action type was deleted or is not accessible to the calling token.
Verify the action type exists and is accessible, then review the Agent's tools in AIP Chatbot Studio."
- `BlockingContinueSessionPermissionDenied` (PERMISSION_DENIED) — "Could not blockingContinue the Session."
- `SessionNotFound` (NOT_FOUND) — "The given Session could not be found."
- `AgentNotFound` (NOT_FOUND) — "The given Agent could not be found."
