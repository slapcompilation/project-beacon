<!-- source: https://palantir.com/docs/foundry/api/v2/ontologies-v2-resources/ontology-interfaces/list-interface-types/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# List Interface Types

`GET /api/v2/ontologies/{ontology}/interfaceTypes`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Lists the interface types for the given Ontology.

Each page may be smaller than the requested page size. However, it is guaranteed that if there are more
results available, at least one result will be present in the response.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."

## Query parameters

- `branch` · string
  "The Foundry branch to list the interface types from. If not specified, the default branch will be used. Branches are an experimental feature and not all workflows are supported."
- `pageSize` · integer
  "The desired size of the page to be returned. Defaults to 500. See [page sizes](/docs/foundry/api/general/overview/paging/#page-sizes) for details."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Response

- `ListInterfaceTypesResponse` · object · required
  "Success response."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
  - `data` · list
    - `InterfaceType` · object · required
      "Represents an interface type in the Ontology."
      - `rid` · string · required
        "The unique resource identifier of an interface, useful for interacting with other Foundry APIs."
      - `apiName` · string · required
        "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
      - `displayName` · string · required
        "The display name of the entity."
      - `description` · string
        "The description of the interface."
      - `properties` · map
        "A map from a shared property type API name to the corresponding shared property type. The map describes the set of properties the interface has. A shared property type must be unique across all of the properties. This field only includes properties on the interface that are backed by shared property types."
        - `SharedPropertyTypeApiName` · string · required
          "The name of the shared property type in the API in lowerCamelCase format. To find the API name for your shared property type, use the `List shared property types` endpoint or check the **Ontology Manager**."
        - `InterfaceSharedPropertyType` · object · required
          "A shared property type with an additional field to indicate whether the property must be included on every object type that implements the interface, or whether it is optional."
          - `rid` · string · required
            "The unique resource identifier of an shared property type, useful for interacting with other Foundry APIs."
          - `apiName` · string · required
            "The name of the shared property type in the API in lowerCamelCase format. To find the API name for your shared property type, use the `List shared property types` endpoint or check the **Ontology Manager**."
          - `displayName` · string · required
            "The display name of the entity."
          - `description` · string
            "A short text that describes the SharedPropertyType."
          - `dataType` · union · required
            "A union of all the types supported by Ontology Object properties."
            - `date` · object
            - `struct` · object
              - `structFieldTypes` · list
                - `StructFieldType` · object · required
                  - `apiName` · string · required
                    "The name of a struct field in the Ontology."
                  - `rid` · string · required
                    "The unique resource identifier of a struct field, useful for interacting with other Foundry APIs."
                  - `dataType` · union · required
                    "A union of all the types supported by Ontology Object properties."
                  - `typeClasses` · list
                    - `TypeClass` · object · required
                      "Additional metadata that can be interpreted by user applications that interact with the Ontology"
                      - `kind` · string · required
                        "A namespace for the type class."
                      - `name` · string · required
                        "The value of the type class."
              - `mainValue` · object
                - `mainValueType` · union · required
                  "A union of all the types supported by Ontology Object properties."
                - `fields` · list
                  "The fields which comprise the main value of the struct."
                  - `StructFieldApiName` · string · required
                    "The name of a struct field in the Ontology."
            - `string` · object
            - `byte` · object
            - `double` · object
            - `geopoint` · object
            - `geotimeSeriesReference` · object
            - `integer` · object
            - `float` · object
            - `geoshape` · object
            - `long` · object
            - `boolean` · object
            - `cipherText` · object
              - `defaultCipherChannel` · string
                "An optional Cipher Channel RID which can be used for encryption updates to empty values."
            - `marking` · object
              - `markingType` · enum
                one of `CBAC`, `MANDATORY`
                "The kind of marking applied by a marking property type. - `CBAC`: Classification-based access control markings. - `MANDATORY`: Standard non-classification markings. Example - Organizations."
            - `attachment` · object
            - `mediaReference` · object
            - `timeseries` · object
              - `itemType` · union · required
                "A union of the types supported by time series properties."
                - `string` · object
                - `double` · object
                - `numericOrNonNumeric` · object
                  "The time series property can either contain either numeric or non-numeric data. This enables mixed sensor types where some sensor time series are numeric and others are categorical. A boolean property reference can be used to determine if the series is numeric or non-numeric. Without this property, the series type can be either numeric or non-numeric and must be inferred from the result of a time series query."
                  - `isNonNumericPropertyTypeId` · string
                    "The boolean property type ID specifying whether the series is numeric or non-numeric. If the value is true, the series is non-numeric."
            - `array` · object
              - `subType` · union · required
                "A union of all the types supported by Ontology Object properties."
              - `reducers` · list
                "If non-empty, this property can be reduced to a single value of the subtype. The reducers are applied in order to determine a winning value. The array can be loaded as a reduced value or as the full array in an object set."
                - `OntologyObjectArrayTypeReducer` · object · required
                  - `direction` · enum · required
                    one of `ASCENDING_NULLS_LAST`, `DESCENDING_NULLS_LAST`
                  - `field` · string
                    "The name of a struct field in the Ontology."
            - `short` · object
            - `vector` · object
              "Represents a fixed size vector of floats. These can be used for vector similarity searches."
              - `dimension` · integer · required
                "The dimension of the vector."
              - `supportsSearchWith` · list
                - `VectorSimilarityFunction` · object · required
                  "The vector similarity function to support approximate nearest neighbors search. Will result in an index specific for the function."
                  - `value` · enum
                    one of `COSINE_SIMILARITY`, `DOT_PRODUCT`, `EUCLIDEAN_DISTANCE`
              - `embeddingModel` · union
                - `lms` · object
                  "A model provided by Language Model Service."
                  - `value` · enum · required
                    one of `OPENAI_TEXT_EMBEDDING_ADA_002`, `TEXT_EMBEDDING_3_LARGE`, `TEXT_EMBEDDING_3_SMALL`, `SNOWFLAKE_ARCTIC_EMBED_M`, `INSTRUCTOR_LARGE`, `BGE_BASE_EN_V1_5`
                - `foundryLiveDeployment` · object
                  - `rid` · string
                    "The live deployment identifier. This rid is of the format 'ri.foundry-ml-live.main.live-deployment.<uuid>'."
                  - `inputParamName` · string
                    "The name of the input parameter to the model which should contain the query string."
                  - `outputParamName` · string
                    "The name of the output parameter to the model which should contain the computed embedding."
            - `decimal` · object
              - `precision` · integer
                "The total number of digits of the Decimal type. The maximum value is 38."
              - `scale` · integer
                "The number of digits to the right of the decimal point. The maximum value is 38."
            - `timestamp` · object
          - `valueTypeApiName` · string
            "The name of the value type in the API in camelCase format."
          - `valueFormatting` · union
            "This feature is experimental and may change in a future release. Comprehensive formatting configuration for displaying property values in user interfaces. Supports different value types including numbers, dates, timestamps, booleans, and known Foundry types. Each formatter type provides specific options tailored to that data type: - Numbers: Support for percentages, currencies, units, scaling, and custom formatting - Dates/Timestamps: Localized and custom formatting patterns - Booleans: Custom true/false display text - Known types: Special formatting for Foundry-specific identifiers"
            - `date` · object
              "Formatting configuration for date property values."
              - `format` · union · required
                - `stringFormat` · object
                  "A strictly specified date format pattern."
                  - `pattern` · string · required
                    "A valid format string composed of date/time patterns."
                - `localizedFormat` · object
                  "Predefined localized formatting options."
                  - `format` · enum · required
                    one of `DATE_FORMAT_RELATIVE_TO_NOW`, `DATE_FORMAT_DATE`, `DATE_FORMAT_YEAR_AND_MONTH`, `DATE_FORMAT_DATE_TIME`, `DATE_FORMAT_DATE_TIME_SHORT`, `DATE_FORMAT_TIME`, `DATE_FORMAT_ISO_INSTANT`
                    "Localized date/time format types."
            - `number` · object
              "Wrapper for numeric formatting options."
              - `numberType` · union · required
                - `standard` · object
                  "Standard number formatting with configurable options. This provides basic number formatting without any special units, scaling, or transformations."
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                - `duration` · object
                  "Format numeric values representing time durations. - Human readable: 3661 seconds displays as "1h 1m 1s" - Timecode: 3661 seconds displays as "01:01:01""
                  - `formatStyle` · union · required
                    - `humanReadable` · object
                      "Formats the duration as a human-readable written string."
                      - `showFullUnits` · boolean
                        "Whether to show full or abbreviated time units."
                    - `timecode` · object
                      "Formats the duration in a timecode format."
                  - `precision` · enum
                    one of `DAYS`, `HOURS`, `MINUTES`, `SECONDS`, `AUTO`
                    "Specifies the maximum precision to apply when formatting a duration."
                  - `baseValue` · enum · required
                    one of `SECONDS`, `MILLISECONDS`
                    "Specifies the unit of the input duration value."
                - `fixedValues` · object
                  "Map integer values to custom human-readable strings. Example: {1: "First", 2: "Second", 3: "Third"} would display 2 as "Second"."
                  - `values` · map
                    - `FixedValuesMapKey` · integer · required
                      "Integer key for fixed value mapping."
                - `affix` · object
                  "Attach arbitrary text before and/or after the formatted number. Example: prefix "USD " and postfix " total" displays as "USD 1,234.56 total""
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `affix` · object · required
                    - `prefix` · union
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                    - `postfix` · union
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                - `scale` · object
                  "Scale the numeric value by dividing by the specified factor and append an appropriate suffix. - THOUSANDS: 1500 displays as "1.5K" - MILLIONS: 2500000 displays as "2.5M" - BILLIONS: 3200000000 displays as "3.2B""
                  - `scaleType` · enum · required
                    one of `THOUSANDS`, `MILLIONS`, `BILLIONS`
                    "Scale factor options for large numbers: - THOUSANDS: Divide by 1,000 and add "K" suffix - MILLIONS: Divide by 1,000,000 and add "M" suffix - BILLIONS: Divide by 1,000,000,000 and add "B" suffix"
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                - `currency` · object
                  "Format numbers as currency values with proper symbols and styling. Example: 1234.56 with currency "USD" displays as "USD 1,234.56" (standard) or "USD 1.2K" (compact)"
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `style` · enum · required
                    one of `STANDARD`, `COMPACT`
                    "Currency rendering style options: - STANDARD: Full currency formatting (e.g., "USD 1,234.56") - COMPACT: Abbreviated currency formatting (e.g., "USD 1.2K")"
                  - `currencyCode` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `standardUnit` · object
                  "Format numbers with standard units supported by Intl.NumberFormat. Examples: "meter", "kilogram", "celsius", "percent" Input: 25 with unit "celsius" displays as "25 degrees C""
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `unit` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `customUnit` · object
                  "Format numbers with custom units not supported by standard formatting. Use this for domain-specific units like "requests/sec", "widgets", etc. Example: 1500 with unit "widgets" displays as "1,500 widgets""
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `unit` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `ratio` · object
                  "Display the value as a ratio with different scaling factors and suffixes: - PERCENTAGE: Multiply by 100 and add "%" suffix (0.15 → "15%") - PER_MILLE: Multiply by 1000 and add "‰" suffix (0.015 → "15‰") - BASIS_POINTS: Multiply by 10000 and add "bps" suffix (0.0015 → "15bps")"
                  - `ratioType` · enum · required
                    one of `PERCENTAGE`, `PER_MILLE`, `BASIS_POINTS`
                    "Ratio format options for displaying proportional values: - PERCENTAGE: Multiply by 100 and add "%" suffix - PER_MILLE: Multiply by 1000 and add "‰" suffix - BASIS_POINTS: Multiply by 10000 and add "bps" suffix"
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
            - `boolean` · object
              "Formatting configuration for boolean property values."
              - `valueIfTrue` · string · required
                "Value to display if this boolean is true"
              - `valueIfFalse` · string · required
                "Value to display if this boolean is false"
            - `knownType` · object
              "Formatting configuration for known Foundry types."
              - `knownType` · enum · required
                one of `USER_OR_GROUP_ID`, `RESOURCE_RID`, `ARTIFACT_GID`
                "Known Foundry types for specialized formatting: - userOrGroupRid: Format as user or group - resourceRid: Format as resource - artifactGid: Format as artifact"
            - `timestamp` · object
              "Formatting configuration for timestamp property values."
              - `format` · union · required
                - `stringFormat` · object
                  "A strictly specified date format pattern."
                  - `pattern` · string · required
                    "A valid format string composed of date/time patterns."
                - `localizedFormat` · object
                  "Predefined localized formatting options."
                  - `format` · enum · required
                    one of `DATE_FORMAT_RELATIVE_TO_NOW`, `DATE_FORMAT_DATE`, `DATE_FORMAT_YEAR_AND_MONTH`, `DATE_FORMAT_DATE_TIME`, `DATE_FORMAT_DATE_TIME_SHORT`, `DATE_FORMAT_TIME`, `DATE_FORMAT_ISO_INSTANT`
                    "Localized date/time format types."
              - `displayTimezone` · union · required
                - `static` · object
                  - `zoneId` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `user` · object
                  "The user's local timezone."
          - `required` · boolean · required
            "Whether each implementing object type must declare an implementation for this property."
          - `typeClasses` · list
            - `TypeClass` · object · required
              "Additional metadata that can be interpreted by user applications that interact with the Ontology"
              - `kind` · string · required
                "A namespace for the type class."
              - `name` · string · required
                "The value of the type class."
      - `allProperties` · map
        "A map from a shared property type API name to the corresponding shared property type. The map describes the set of properties the interface has, including properties from all directly and indirectly extended interfaces. This field only includes properties on the interface that are backed by shared property types."
        - `SharedPropertyTypeApiName` · string · required
          "The name of the shared property type in the API in lowerCamelCase format. To find the API name for your shared property type, use the `List shared property types` endpoint or check the **Ontology Manager**."
        - `InterfaceSharedPropertyType` · object · required
          "A shared property type with an additional field to indicate whether the property must be included on every object type that implements the interface, or whether it is optional."
          - `rid` · string · required
            "The unique resource identifier of an shared property type, useful for interacting with other Foundry APIs."
          - `apiName` · string · required
            "The name of the shared property type in the API in lowerCamelCase format. To find the API name for your shared property type, use the `List shared property types` endpoint or check the **Ontology Manager**."
          - `displayName` · string · required
            "The display name of the entity."
          - `description` · string
            "A short text that describes the SharedPropertyType."
          - `dataType` · union · required
            "A union of all the types supported by Ontology Object properties."
            - `date` · object
            - `struct` · object
              - `structFieldTypes` · list
                - `StructFieldType` · object · required
                  - `apiName` · string · required
                    "The name of a struct field in the Ontology."
                  - `rid` · string · required
                    "The unique resource identifier of a struct field, useful for interacting with other Foundry APIs."
                  - `dataType` · union · required
                    "A union of all the types supported by Ontology Object properties."
                  - `typeClasses` · list
                    - `TypeClass` · object · required
                      "Additional metadata that can be interpreted by user applications that interact with the Ontology"
                      - `kind` · string · required
                        "A namespace for the type class."
                      - `name` · string · required
                        "The value of the type class."
              - `mainValue` · object
                - `mainValueType` · union · required
                  "A union of all the types supported by Ontology Object properties."
                - `fields` · list
                  "The fields which comprise the main value of the struct."
                  - `StructFieldApiName` · string · required
                    "The name of a struct field in the Ontology."
            - `string` · object
            - `byte` · object
            - `double` · object
            - `geopoint` · object
            - `geotimeSeriesReference` · object
            - `integer` · object
            - `float` · object
            - `geoshape` · object
            - `long` · object
            - `boolean` · object
            - `cipherText` · object
              - `defaultCipherChannel` · string
                "An optional Cipher Channel RID which can be used for encryption updates to empty values."
            - `marking` · object
              - `markingType` · enum
                one of `CBAC`, `MANDATORY`
                "The kind of marking applied by a marking property type. - `CBAC`: Classification-based access control markings. - `MANDATORY`: Standard non-classification markings. Example - Organizations."
            - `attachment` · object
            - `mediaReference` · object
            - `timeseries` · object
              - `itemType` · union · required
                "A union of the types supported by time series properties."
                - `string` · object
                - `double` · object
                - `numericOrNonNumeric` · object
                  "The time series property can either contain either numeric or non-numeric data. This enables mixed sensor types where some sensor time series are numeric and others are categorical. A boolean property reference can be used to determine if the series is numeric or non-numeric. Without this property, the series type can be either numeric or non-numeric and must be inferred from the result of a time series query."
                  - `isNonNumericPropertyTypeId` · string
                    "The boolean property type ID specifying whether the series is numeric or non-numeric. If the value is true, the series is non-numeric."
            - `array` · object
              - `subType` · union · required
                "A union of all the types supported by Ontology Object properties."
              - `reducers` · list
                "If non-empty, this property can be reduced to a single value of the subtype. The reducers are applied in order to determine a winning value. The array can be loaded as a reduced value or as the full array in an object set."
                - `OntologyObjectArrayTypeReducer` · object · required
                  - `direction` · enum · required
                    one of `ASCENDING_NULLS_LAST`, `DESCENDING_NULLS_LAST`
                  - `field` · string
                    "The name of a struct field in the Ontology."
            - `short` · object
            - `vector` · object
              "Represents a fixed size vector of floats. These can be used for vector similarity searches."
              - `dimension` · integer · required
                "The dimension of the vector."
              - `supportsSearchWith` · list
                - `VectorSimilarityFunction` · object · required
                  "The vector similarity function to support approximate nearest neighbors search. Will result in an index specific for the function."
                  - `value` · enum
                    one of `COSINE_SIMILARITY`, `DOT_PRODUCT`, `EUCLIDEAN_DISTANCE`
              - `embeddingModel` · union
                - `lms` · object
                  "A model provided by Language Model Service."
                  - `value` · enum · required
                    one of `OPENAI_TEXT_EMBEDDING_ADA_002`, `TEXT_EMBEDDING_3_LARGE`, `TEXT_EMBEDDING_3_SMALL`, `SNOWFLAKE_ARCTIC_EMBED_M`, `INSTRUCTOR_LARGE`, `BGE_BASE_EN_V1_5`
                - `foundryLiveDeployment` · object
                  - `rid` · string
                    "The live deployment identifier. This rid is of the format 'ri.foundry-ml-live.main.live-deployment.<uuid>'."
                  - `inputParamName` · string
                    "The name of the input parameter to the model which should contain the query string."
                  - `outputParamName` · string
                    "The name of the output parameter to the model which should contain the computed embedding."
            - `decimal` · object
              - `precision` · integer
                "The total number of digits of the Decimal type. The maximum value is 38."
              - `scale` · integer
                "The number of digits to the right of the decimal point. The maximum value is 38."
            - `timestamp` · object
          - `valueTypeApiName` · string
            "The name of the value type in the API in camelCase format."
          - `valueFormatting` · union
            "This feature is experimental and may change in a future release. Comprehensive formatting configuration for displaying property values in user interfaces. Supports different value types including numbers, dates, timestamps, booleans, and known Foundry types. Each formatter type provides specific options tailored to that data type: - Numbers: Support for percentages, currencies, units, scaling, and custom formatting - Dates/Timestamps: Localized and custom formatting patterns - Booleans: Custom true/false display text - Known types: Special formatting for Foundry-specific identifiers"
            - `date` · object
              "Formatting configuration for date property values."
              - `format` · union · required
                - `stringFormat` · object
                  "A strictly specified date format pattern."
                  - `pattern` · string · required
                    "A valid format string composed of date/time patterns."
                - `localizedFormat` · object
                  "Predefined localized formatting options."
                  - `format` · enum · required
                    one of `DATE_FORMAT_RELATIVE_TO_NOW`, `DATE_FORMAT_DATE`, `DATE_FORMAT_YEAR_AND_MONTH`, `DATE_FORMAT_DATE_TIME`, `DATE_FORMAT_DATE_TIME_SHORT`, `DATE_FORMAT_TIME`, `DATE_FORMAT_ISO_INSTANT`
                    "Localized date/time format types."
            - `number` · object
              "Wrapper for numeric formatting options."
              - `numberType` · union · required
                - `standard` · object
                  "Standard number formatting with configurable options. This provides basic number formatting without any special units, scaling, or transformations."
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                - `duration` · object
                  "Format numeric values representing time durations. - Human readable: 3661 seconds displays as "1h 1m 1s" - Timecode: 3661 seconds displays as "01:01:01""
                  - `formatStyle` · union · required
                    - `humanReadable` · object
                      "Formats the duration as a human-readable written string."
                      - `showFullUnits` · boolean
                        "Whether to show full or abbreviated time units."
                    - `timecode` · object
                      "Formats the duration in a timecode format."
                  - `precision` · enum
                    one of `DAYS`, `HOURS`, `MINUTES`, `SECONDS`, `AUTO`
                    "Specifies the maximum precision to apply when formatting a duration."
                  - `baseValue` · enum · required
                    one of `SECONDS`, `MILLISECONDS`
                    "Specifies the unit of the input duration value."
                - `fixedValues` · object
                  "Map integer values to custom human-readable strings. Example: {1: "First", 2: "Second", 3: "Third"} would display 2 as "Second"."
                  - `values` · map
                    - `FixedValuesMapKey` · integer · required
                      "Integer key for fixed value mapping."
                - `affix` · object
                  "Attach arbitrary text before and/or after the formatted number. Example: prefix "USD " and postfix " total" displays as "USD 1,234.56 total""
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `affix` · object · required
                    - `prefix` · union
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                    - `postfix` · union
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                - `scale` · object
                  "Scale the numeric value by dividing by the specified factor and append an appropriate suffix. - THOUSANDS: 1500 displays as "1.5K" - MILLIONS: 2500000 displays as "2.5M" - BILLIONS: 3200000000 displays as "3.2B""
                  - `scaleType` · enum · required
                    one of `THOUSANDS`, `MILLIONS`, `BILLIONS`
                    "Scale factor options for large numbers: - THOUSANDS: Divide by 1,000 and add "K" suffix - MILLIONS: Divide by 1,000,000 and add "M" suffix - BILLIONS: Divide by 1,000,000,000 and add "B" suffix"
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                - `currency` · object
                  "Format numbers as currency values with proper symbols and styling. Example: 1234.56 with currency "USD" displays as "USD 1,234.56" (standard) or "USD 1.2K" (compact)"
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `style` · enum · required
                    one of `STANDARD`, `COMPACT`
                    "Currency rendering style options: - STANDARD: Full currency formatting (e.g., "USD 1,234.56") - COMPACT: Abbreviated currency formatting (e.g., "USD 1.2K")"
                  - `currencyCode` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `standardUnit` · object
                  "Format numbers with standard units supported by Intl.NumberFormat. Examples: "meter", "kilogram", "celsius", "percent" Input: 25 with unit "celsius" displays as "25 degrees C""
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `unit` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `customUnit` · object
                  "Format numbers with custom units not supported by standard formatting. Use this for domain-specific units like "requests/sec", "widgets", etc. Example: 1500 with unit "widgets" displays as "1,500 widgets""
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `unit` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `ratio` · object
                  "Display the value as a ratio with different scaling factors and suffixes: - PERCENTAGE: Multiply by 100 and add "%" suffix (0.15 → "15%") - PER_MILLE: Multiply by 1000 and add "‰" suffix (0.015 → "15‰") - BASIS_POINTS: Multiply by 10000 and add "bps" suffix (0.0015 → "15bps")"
                  - `ratioType` · enum · required
                    one of `PERCENTAGE`, `PER_MILLE`, `BASIS_POINTS`
                    "Ratio format options for displaying proportional values: - PERCENTAGE: Multiply by 100 and add "%" suffix - PER_MILLE: Multiply by 1000 and add "‰" suffix - BASIS_POINTS: Multiply by 10000 and add "bps" suffix"
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
            - `boolean` · object
              "Formatting configuration for boolean property values."
              - `valueIfTrue` · string · required
                "Value to display if this boolean is true"
              - `valueIfFalse` · string · required
                "Value to display if this boolean is false"
            - `knownType` · object
              "Formatting configuration for known Foundry types."
              - `knownType` · enum · required
                one of `USER_OR_GROUP_ID`, `RESOURCE_RID`, `ARTIFACT_GID`
                "Known Foundry types for specialized formatting: - userOrGroupRid: Format as user or group - resourceRid: Format as resource - artifactGid: Format as artifact"
            - `timestamp` · object
              "Formatting configuration for timestamp property values."
              - `format` · union · required
                - `stringFormat` · object
                  "A strictly specified date format pattern."
                  - `pattern` · string · required
                    "A valid format string composed of date/time patterns."
                - `localizedFormat` · object
                  "Predefined localized formatting options."
                  - `format` · enum · required
                    one of `DATE_FORMAT_RELATIVE_TO_NOW`, `DATE_FORMAT_DATE`, `DATE_FORMAT_YEAR_AND_MONTH`, `DATE_FORMAT_DATE_TIME`, `DATE_FORMAT_DATE_TIME_SHORT`, `DATE_FORMAT_TIME`, `DATE_FORMAT_ISO_INSTANT`
                    "Localized date/time format types."
              - `displayTimezone` · union · required
                - `static` · object
                  - `zoneId` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `user` · object
                  "The user's local timezone."
          - `required` · boolean · required
            "Whether each implementing object type must declare an implementation for this property."
          - `typeClasses` · list
            - `TypeClass` · object · required
              "Additional metadata that can be interpreted by user applications that interact with the Ontology"
              - `kind` · string · required
                "A namespace for the type class."
              - `name` · string · required
                "The value of the type class."
      - `propertiesV2` · map
        "A map from a interface property type API name to the corresponding interface property type. The map describes the set of properties the interface has. An interface property can either be backed by a shared property or it can be defined directly on the interface."
        - `InterfacePropertyApiName` · string · required
          "The name of the interface property type in the API in lowerCamelCase format. To find the API name for your interface property type, use the `List interface types` endpoint and check the `allPropertiesV2` field or check the **Ontology Manager**."
        - `InterfacePropertyType` · union · required
          "The definition of an interface property type on an interface. An interface property can either be backed by a shared property type or defined on the interface directly."
          - `interfaceDefinedPropertyType` · object
            "An interface property type with an additional field to indicate constraints that need to be satisfied by implementing object property types."
            - `rid` · string · required
              "The unique resource identifier of an interface property type, useful for interacting with other Foundry APIs."
            - `apiName` · string · required
              "The name of the interface property type in the API in lowerCamelCase format. To find the API name for your interface property type, use the `List interface types` endpoint and check the `allPropertiesV2` field or check the **Ontology Manager**."
            - `displayName` · string · required
              "The display name of the entity."
            - `description` · string
              "The description of the interface property type."
            - `dataType` · union · required
              "A union of all the types supported by Ontology Object properties."
              - `date` · object
              - `struct` · object
                - `structFieldTypes` · list
                  - `StructFieldType` · object · required
                    - `apiName` · string · required
                      "The name of a struct field in the Ontology."
                    - `rid` · string · required
                      "The unique resource identifier of a struct field, useful for interacting with other Foundry APIs."
                    - `dataType` · union · required
                      "A union of all the types supported by Ontology Object properties."
                    - `typeClasses` · list
                      - `TypeClass` · object · required
                        "Additional metadata that can be interpreted by user applications that interact with the Ontology"
                        - `kind` · string · required
                          "A namespace for the type class."
                        - `name` · string · required
                          "The value of the type class."
                - `mainValue` · object
                  - `mainValueType` · union · required
                    "A union of all the types supported by Ontology Object properties."
                  - `fields` · list
                    "The fields which comprise the main value of the struct."
                    - `StructFieldApiName` · string · required
                      "The name of a struct field in the Ontology."
              - `string` · object
              - `byte` · object
              - `double` · object
              - `geopoint` · object
              - `geotimeSeriesReference` · object
              - `integer` · object
              - `float` · object
              - `geoshape` · object
              - `long` · object
              - `boolean` · object
              - `cipherText` · object
                - `defaultCipherChannel` · string
                  "An optional Cipher Channel RID which can be used for encryption updates to empty values."
              - `marking` · object
                - `markingType` · enum
                  one of `CBAC`, `MANDATORY`
                  "The kind of marking applied by a marking property type. - `CBAC`: Classification-based access control markings. - `MANDATORY`: Standard non-classification markings. Example - Organizations."
              - `attachment` · object
              - `mediaReference` · object
              - `timeseries` · object
                - `itemType` · union · required
                  "A union of the types supported by time series properties."
                  - `string` · object
                  - `double` · object
                  - `numericOrNonNumeric` · object
                    "The time series property can either contain either numeric or non-numeric data. This enables mixed sensor types where some sensor time series are numeric and others are categorical. A boolean property reference can be used to determine if the series is numeric or non-numeric. Without this property, the series type can be either numeric or non-numeric and must be inferred from the result of a time series query."
                    - `isNonNumericPropertyTypeId` · string
                      "The boolean property type ID specifying whether the series is numeric or non-numeric. If the value is true, the series is non-numeric."
              - `array` · object
                - `subType` · union · required
                  "A union of all the types supported by Ontology Object properties."
                - `reducers` · list
                  "If non-empty, this property can be reduced to a single value of the subtype. The reducers are applied in order to determine a winning value. The array can be loaded as a reduced value or as the full array in an object set."
                  - `OntologyObjectArrayTypeReducer` · object · required
                    - `direction` · enum · required
                      one of `ASCENDING_NULLS_LAST`, `DESCENDING_NULLS_LAST`
                    - `field` · string
                      "The name of a struct field in the Ontology."
              - `short` · object
              - `vector` · object
                "Represents a fixed size vector of floats. These can be used for vector similarity searches."
                - `dimension` · integer · required
                  "The dimension of the vector."
                - `supportsSearchWith` · list
                  - `VectorSimilarityFunction` · object · required
                    "The vector similarity function to support approximate nearest neighbors search. Will result in an index specific for the function."
                    - `value` · enum
                      one of `COSINE_SIMILARITY`, `DOT_PRODUCT`, `EUCLIDEAN_DISTANCE`
                - `embeddingModel` · union
                  - `lms` · object
                    "A model provided by Language Model Service."
                    - `value` · enum · required
                      one of `OPENAI_TEXT_EMBEDDING_ADA_002`, `TEXT_EMBEDDING_3_LARGE`, `TEXT_EMBEDDING_3_SMALL`, `SNOWFLAKE_ARCTIC_EMBED_M`, `INSTRUCTOR_LARGE`, `BGE_BASE_EN_V1_5`
                  - `foundryLiveDeployment` · object
                    - `rid` · string
                      "The live deployment identifier. This rid is of the format 'ri.foundry-ml-live.main.live-deployment.<uuid>'."
                    - `inputParamName` · string
                      "The name of the input parameter to the model which should contain the query string."
                    - `outputParamName` · string
                      "The name of the output parameter to the model which should contain the computed embedding."
              - `decimal` · object
                - `precision` · integer
                  "The total number of digits of the Decimal type. The maximum value is 38."
                - `scale` · integer
                  "The number of digits to the right of the decimal point. The maximum value is 38."
              - `timestamp` · object
            - `valueTypeApiName` · string
              "The name of the value type in the API in camelCase format."
            - `requireImplementation` · boolean · required
              "Whether each implementing object type must declare an implementation for this property."
            - `typeClasses` · list
              - `TypeClass` · object · required
                "Additional metadata that can be interpreted by user applications that interact with the Ontology"
                - `kind` · string · required
                  "A namespace for the type class."
                - `name` · string · required
                  "The value of the type class."
          - `interfaceSharedPropertyType` · object
            "A shared property type with an additional field to indicate whether the property must be included on every object type that implements the interface, or whether it is optional."
            - `rid` · string · required
              "The unique resource identifier of an shared property type, useful for interacting with other Foundry APIs."
            - `apiName` · string · required
              "The name of the shared property type in the API in lowerCamelCase format. To find the API name for your shared property type, use the `List shared property types` endpoint or check the **Ontology Manager**."
            - `displayName` · string · required
              "The display name of the entity."
            - `description` · string
              "A short text that describes the SharedPropertyType."
            - `dataType` · union · required
              "A union of all the types supported by Ontology Object properties."
              - `date` · object
              - `struct` · object
                - `structFieldTypes` · list
                  - `StructFieldType` · object · required
                    - `apiName` · string · required
                      "The name of a struct field in the Ontology."
                    - `rid` · string · required
                      "The unique resource identifier of a struct field, useful for interacting with other Foundry APIs."
                    - `dataType` · union · required
                      "A union of all the types supported by Ontology Object properties."
                    - `typeClasses` · list
                      - `TypeClass` · object · required
                        "Additional metadata that can be interpreted by user applications that interact with the Ontology"
                        - `kind` · string · required
                          "A namespace for the type class."
                        - `name` · string · required
                          "The value of the type class."
                - `mainValue` · object
                  - `mainValueType` · union · required
                    "A union of all the types supported by Ontology Object properties."
                  - `fields` · list
                    "The fields which comprise the main value of the struct."
                    - `StructFieldApiName` · string · required
                      "The name of a struct field in the Ontology."
              - `string` · object
              - `byte` · object
              - `double` · object
              - `geopoint` · object
              - `geotimeSeriesReference` · object
              - `integer` · object
              - `float` · object
              - `geoshape` · object
              - `long` · object
              - `boolean` · object
              - `cipherText` · object
                - `defaultCipherChannel` · string
                  "An optional Cipher Channel RID which can be used for encryption updates to empty values."
              - `marking` · object
                - `markingType` · enum
                  one of `CBAC`, `MANDATORY`
                  "The kind of marking applied by a marking property type. - `CBAC`: Classification-based access control markings. - `MANDATORY`: Standard non-classification markings. Example - Organizations."
              - `attachment` · object
              - `mediaReference` · object
              - `timeseries` · object
                - `itemType` · union · required
                  "A union of the types supported by time series properties."
                  - `string` · object
                  - `double` · object
                  - `numericOrNonNumeric` · object
                    "The time series property can either contain either numeric or non-numeric data. This enables mixed sensor types where some sensor time series are numeric and others are categorical. A boolean property reference can be used to determine if the series is numeric or non-numeric. Without this property, the series type can be either numeric or non-numeric and must be inferred from the result of a time series query."
                    - `isNonNumericPropertyTypeId` · string
                      "The boolean property type ID specifying whether the series is numeric or non-numeric. If the value is true, the series is non-numeric."
              - `array` · object
                - `subType` · union · required
                  "A union of all the types supported by Ontology Object properties."
                - `reducers` · list
                  "If non-empty, this property can be reduced to a single value of the subtype. The reducers are applied in order to determine a winning value. The array can be loaded as a reduced value or as the full array in an object set."
                  - `OntologyObjectArrayTypeReducer` · object · required
                    - `direction` · enum · required
                      one of `ASCENDING_NULLS_LAST`, `DESCENDING_NULLS_LAST`
                    - `field` · string
                      "The name of a struct field in the Ontology."
              - `short` · object
              - `vector` · object
                "Represents a fixed size vector of floats. These can be used for vector similarity searches."
                - `dimension` · integer · required
                  "The dimension of the vector."
                - `supportsSearchWith` · list
                  - `VectorSimilarityFunction` · object · required
                    "The vector similarity function to support approximate nearest neighbors search. Will result in an index specific for the function."
                    - `value` · enum
                      one of `COSINE_SIMILARITY`, `DOT_PRODUCT`, `EUCLIDEAN_DISTANCE`
                - `embeddingModel` · union
                  - `lms` · object
                    "A model provided by Language Model Service."
                    - `value` · enum · required
                      one of `OPENAI_TEXT_EMBEDDING_ADA_002`, `TEXT_EMBEDDING_3_LARGE`, `TEXT_EMBEDDING_3_SMALL`, `SNOWFLAKE_ARCTIC_EMBED_M`, `INSTRUCTOR_LARGE`, `BGE_BASE_EN_V1_5`
                  - `foundryLiveDeployment` · object
                    - `rid` · string
                      "The live deployment identifier. This rid is of the format 'ri.foundry-ml-live.main.live-deployment.<uuid>'."
                    - `inputParamName` · string
                      "The name of the input parameter to the model which should contain the query string."
                    - `outputParamName` · string
                      "The name of the output parameter to the model which should contain the computed embedding."
              - `decimal` · object
                - `precision` · integer
                  "The total number of digits of the Decimal type. The maximum value is 38."
                - `scale` · integer
                  "The number of digits to the right of the decimal point. The maximum value is 38."
              - `timestamp` · object
            - `valueTypeApiName` · string
              "The name of the value type in the API in camelCase format."
            - `valueFormatting` · union
              "This feature is experimental and may change in a future release. Comprehensive formatting configuration for displaying property values in user interfaces. Supports different value types including numbers, dates, timestamps, booleans, and known Foundry types. Each formatter type provides specific options tailored to that data type: - Numbers: Support for percentages, currencies, units, scaling, and custom formatting - Dates/Timestamps: Localized and custom formatting patterns - Booleans: Custom true/false display text - Known types: Special formatting for Foundry-specific identifiers"
              - `date` · object
                "Formatting configuration for date property values."
                - `format` · union · required
                  - `stringFormat` · object
                    "A strictly specified date format pattern."
                    - `pattern` · string · required
                      "A valid format string composed of date/time patterns."
                  - `localizedFormat` · object
                    "Predefined localized formatting options."
                    - `format` · enum · required
                      one of `DATE_FORMAT_RELATIVE_TO_NOW`, `DATE_FORMAT_DATE`, `DATE_FORMAT_YEAR_AND_MONTH`, `DATE_FORMAT_DATE_TIME`, `DATE_FORMAT_DATE_TIME_SHORT`, `DATE_FORMAT_TIME`, `DATE_FORMAT_ISO_INSTANT`
                      "Localized date/time format types."
              - `number` · object
                "Wrapper for numeric formatting options."
                - `numberType` · union · required
                  - `standard` · object
                    "Standard number formatting with configurable options. This provides basic number formatting without any special units, scaling, or transformations."
                    - `baseFormatOptions` · object · required
                      "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                      - `useGrouping` · boolean
                        "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                      - `convertNegativeToParenthesis` · boolean
                        "If true, wrap negative numbers in parentheses instead of a minus sign."
                      - `minimumIntegerDigits` · integer
                      - `minimumFractionDigits` · integer
                      - `maximumFractionDigits` · integer
                      - `minimumSignificantDigits` · integer
                      - `maximumSignificantDigits` · integer
                      - `notation` · enum
                        one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                        "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                      - `roundingMode` · enum
                        one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                        "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `duration` · object
                    "Format numeric values representing time durations. - Human readable: 3661 seconds displays as "1h 1m 1s" - Timecode: 3661 seconds displays as "01:01:01""
                    - `formatStyle` · union · required
                      - `humanReadable` · object
                        "Formats the duration as a human-readable written string."
                        - `showFullUnits` · boolean
                          "Whether to show full or abbreviated time units."
                      - `timecode` · object
                        "Formats the duration in a timecode format."
                    - `precision` · enum
                      one of `DAYS`, `HOURS`, `MINUTES`, `SECONDS`, `AUTO`
                      "Specifies the maximum precision to apply when formatting a duration."
                    - `baseValue` · enum · required
                      one of `SECONDS`, `MILLISECONDS`
                      "Specifies the unit of the input duration value."
                  - `fixedValues` · object
                    "Map integer values to custom human-readable strings. Example: {1: "First", 2: "Second", 3: "Third"} would display 2 as "Second"."
                    - `values` · map
                      - `FixedValuesMapKey` · integer · required
                        "Integer key for fixed value mapping."
                  - `affix` · object
                    "Attach arbitrary text before and/or after the formatted number. Example: prefix "USD " and postfix " total" displays as "USD 1,234.56 total""
                    - `baseFormatOptions` · object · required
                      "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                      - `useGrouping` · boolean
                        "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                      - `convertNegativeToParenthesis` · boolean
                        "If true, wrap negative numbers in parentheses instead of a minus sign."
                      - `minimumIntegerDigits` · integer
                      - `minimumFractionDigits` · integer
                      - `maximumFractionDigits` · integer
                      - `minimumSignificantDigits` · integer
                      - `maximumSignificantDigits` · integer
                      - `notation` · enum
                        one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                        "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                      - `roundingMode` · enum
                        one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                        "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                    - `affix` · object · required
                      - `prefix` · union
                        - `constant` · object
                          - `value` · string · required
                        - `propertyType` · object
                          - `propertyApiName` · string · required
                            "The API name of the PropertyType"
                      - `postfix` · union
                        - `constant` · object
                          - `value` · string · required
                        - `propertyType` · object
                          - `propertyApiName` · string · required
                            "The API name of the PropertyType"
                  - `scale` · object
                    "Scale the numeric value by dividing by the specified factor and append an appropriate suffix. - THOUSANDS: 1500 displays as "1.5K" - MILLIONS: 2500000 displays as "2.5M" - BILLIONS: 3200000000 displays as "3.2B""
                    - `scaleType` · enum · required
                      one of `THOUSANDS`, `MILLIONS`, `BILLIONS`
                      "Scale factor options for large numbers: - THOUSANDS: Divide by 1,000 and add "K" suffix - MILLIONS: Divide by 1,000,000 and add "M" suffix - BILLIONS: Divide by 1,000,000,000 and add "B" suffix"
                    - `baseFormatOptions` · object · required
                      "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                      - `useGrouping` · boolean
                        "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                      - `convertNegativeToParenthesis` · boolean
                        "If true, wrap negative numbers in parentheses instead of a minus sign."
                      - `minimumIntegerDigits` · integer
                      - `minimumFractionDigits` · integer
                      - `maximumFractionDigits` · integer
                      - `minimumSignificantDigits` · integer
                      - `maximumSignificantDigits` · integer
                      - `notation` · enum
                        one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                        "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                      - `roundingMode` · enum
                        one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                        "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `currency` · object
                    "Format numbers as currency values with proper symbols and styling. Example: 1234.56 with currency "USD" displays as "USD 1,234.56" (standard) or "USD 1.2K" (compact)"
                    - `baseFormatOptions` · object · required
                      "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                      - `useGrouping` · boolean
                        "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                      - `convertNegativeToParenthesis` · boolean
                        "If true, wrap negative numbers in parentheses instead of a minus sign."
                      - `minimumIntegerDigits` · integer
                      - `minimumFractionDigits` · integer
                      - `maximumFractionDigits` · integer
                      - `minimumSignificantDigits` · integer
                      - `maximumSignificantDigits` · integer
                      - `notation` · enum
                        one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                        "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                      - `roundingMode` · enum
                        one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                        "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                    - `style` · enum · required
                      one of `STANDARD`, `COMPACT`
                      "Currency rendering style options: - STANDARD: Full currency formatting (e.g., "USD 1,234.56") - COMPACT: Abbreviated currency formatting (e.g., "USD 1.2K")"
                    - `currencyCode` · union · required
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                  - `standardUnit` · object
                    "Format numbers with standard units supported by Intl.NumberFormat. Examples: "meter", "kilogram", "celsius", "percent" Input: 25 with unit "celsius" displays as "25 degrees C""
                    - `baseFormatOptions` · object · required
                      "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                      - `useGrouping` · boolean
                        "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                      - `convertNegativeToParenthesis` · boolean
                        "If true, wrap negative numbers in parentheses instead of a minus sign."
                      - `minimumIntegerDigits` · integer
                      - `minimumFractionDigits` · integer
                      - `maximumFractionDigits` · integer
                      - `minimumSignificantDigits` · integer
                      - `maximumSignificantDigits` · integer
                      - `notation` · enum
                        one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                        "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                      - `roundingMode` · enum
                        one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                        "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                    - `unit` · union · required
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                  - `customUnit` · object
                    "Format numbers with custom units not supported by standard formatting. Use this for domain-specific units like "requests/sec", "widgets", etc. Example: 1500 with unit "widgets" displays as "1,500 widgets""
                    - `baseFormatOptions` · object · required
                      "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                      - `useGrouping` · boolean
                        "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                      - `convertNegativeToParenthesis` · boolean
                        "If true, wrap negative numbers in parentheses instead of a minus sign."
                      - `minimumIntegerDigits` · integer
                      - `minimumFractionDigits` · integer
                      - `maximumFractionDigits` · integer
                      - `minimumSignificantDigits` · integer
                      - `maximumSignificantDigits` · integer
                      - `notation` · enum
                        one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                        "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                      - `roundingMode` · enum
                        one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                        "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                    - `unit` · union · required
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                  - `ratio` · object
                    "Display the value as a ratio with different scaling factors and suffixes: - PERCENTAGE: Multiply by 100 and add "%" suffix (0.15 → "15%") - PER_MILLE: Multiply by 1000 and add "‰" suffix (0.015 → "15‰") - BASIS_POINTS: Multiply by 10000 and add "bps" suffix (0.0015 → "15bps")"
                    - `ratioType` · enum · required
                      one of `PERCENTAGE`, `PER_MILLE`, `BASIS_POINTS`
                      "Ratio format options for displaying proportional values: - PERCENTAGE: Multiply by 100 and add "%" suffix - PER_MILLE: Multiply by 1000 and add "‰" suffix - BASIS_POINTS: Multiply by 10000 and add "bps" suffix"
                    - `baseFormatOptions` · object · required
                      "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                      - `useGrouping` · boolean
                        "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                      - `convertNegativeToParenthesis` · boolean
                        "If true, wrap negative numbers in parentheses instead of a minus sign."
                      - `minimumIntegerDigits` · integer
                      - `minimumFractionDigits` · integer
                      - `maximumFractionDigits` · integer
                      - `minimumSignificantDigits` · integer
                      - `maximumSignificantDigits` · integer
                      - `notation` · enum
                        one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                        "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                      - `roundingMode` · enum
                        one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                        "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
              - `boolean` · object
                "Formatting configuration for boolean property values."
                - `valueIfTrue` · string · required
                  "Value to display if this boolean is true"
                - `valueIfFalse` · string · required
                  "Value to display if this boolean is false"
              - `knownType` · object
                "Formatting configuration for known Foundry types."
                - `knownType` · enum · required
                  one of `USER_OR_GROUP_ID`, `RESOURCE_RID`, `ARTIFACT_GID`
                  "Known Foundry types for specialized formatting: - userOrGroupRid: Format as user or group - resourceRid: Format as resource - artifactGid: Format as artifact"
              - `timestamp` · object
                "Formatting configuration for timestamp property values."
                - `format` · union · required
                  - `stringFormat` · object
                    "A strictly specified date format pattern."
                    - `pattern` · string · required
                      "A valid format string composed of date/time patterns."
                  - `localizedFormat` · object
                    "Predefined localized formatting options."
                    - `format` · enum · required
                      one of `DATE_FORMAT_RELATIVE_TO_NOW`, `DATE_FORMAT_DATE`, `DATE_FORMAT_YEAR_AND_MONTH`, `DATE_FORMAT_DATE_TIME`, `DATE_FORMAT_DATE_TIME_SHORT`, `DATE_FORMAT_TIME`, `DATE_FORMAT_ISO_INSTANT`
                      "Localized date/time format types."
                - `displayTimezone` · union · required
                  - `static` · object
                    - `zoneId` · union · required
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                  - `user` · object
                    "The user's local timezone."
            - `required` · boolean · required
              "Whether each implementing object type must declare an implementation for this property."
            - `typeClasses` · list
              - `TypeClass` · object · required
                "Additional metadata that can be interpreted by user applications that interact with the Ontology"
                - `kind` · string · required
                  "A namespace for the type class."
                - `name` · string · required
                  "The value of the type class."
      - `allPropertiesV2` · map
        "A map from a interface property type API name to the corresponding interface property type. The map describes the set of properties the interface has, including properties from all directly and indirectly extended interfaces."
        - `InterfacePropertyApiName` · string · required
          "The name of the interface property type in the API in lowerCamelCase format. To find the API name for your interface property type, use the `List interface types` endpoint and check the `allPropertiesV2` field or check the **Ontology Manager**."
        - `ResolvedInterfacePropertyType` · object · required
          "An interface property type with additional fields to indicate constraints that need to be satisfied by implementing object property types."
          - `rid` · string · required
            "The unique resource identifier of an interface property type, useful for interacting with other Foundry APIs."
          - `apiName` · string · required
            "The name of the interface property type in the API in lowerCamelCase format. To find the API name for your interface property type, use the `List interface types` endpoint and check the `allPropertiesV2` field or check the **Ontology Manager**."
          - `displayName` · string · required
            "The display name of the entity."
          - `description` · string
            "A short text that describes the InterfacePropertyType."
          - `dataType` · union · required
            "A union of all the types supported by Ontology Object properties."
            - `date` · object
            - `struct` · object
              - `structFieldTypes` · list
                - `StructFieldType` · object · required
                  - `apiName` · string · required
                    "The name of a struct field in the Ontology."
                  - `rid` · string · required
                    "The unique resource identifier of a struct field, useful for interacting with other Foundry APIs."
                  - `dataType` · union · required
                    "A union of all the types supported by Ontology Object properties."
                  - `typeClasses` · list
                    - `TypeClass` · object · required
                      "Additional metadata that can be interpreted by user applications that interact with the Ontology"
                      - `kind` · string · required
                        "A namespace for the type class."
                      - `name` · string · required
                        "The value of the type class."
              - `mainValue` · object
                - `mainValueType` · union · required
                  "A union of all the types supported by Ontology Object properties."
                - `fields` · list
                  "The fields which comprise the main value of the struct."
                  - `StructFieldApiName` · string · required
                    "The name of a struct field in the Ontology."
            - `string` · object
            - `byte` · object
            - `double` · object
            - `geopoint` · object
            - `geotimeSeriesReference` · object
            - `integer` · object
            - `float` · object
            - `geoshape` · object
            - `long` · object
            - `boolean` · object
            - `cipherText` · object
              - `defaultCipherChannel` · string
                "An optional Cipher Channel RID which can be used for encryption updates to empty values."
            - `marking` · object
              - `markingType` · enum
                one of `CBAC`, `MANDATORY`
                "The kind of marking applied by a marking property type. - `CBAC`: Classification-based access control markings. - `MANDATORY`: Standard non-classification markings. Example - Organizations."
            - `attachment` · object
            - `mediaReference` · object
            - `timeseries` · object
              - `itemType` · union · required
                "A union of the types supported by time series properties."
                - `string` · object
                - `double` · object
                - `numericOrNonNumeric` · object
                  "The time series property can either contain either numeric or non-numeric data. This enables mixed sensor types where some sensor time series are numeric and others are categorical. A boolean property reference can be used to determine if the series is numeric or non-numeric. Without this property, the series type can be either numeric or non-numeric and must be inferred from the result of a time series query."
                  - `isNonNumericPropertyTypeId` · string
                    "The boolean property type ID specifying whether the series is numeric or non-numeric. If the value is true, the series is non-numeric."
            - `array` · object
              - `subType` · union · required
                "A union of all the types supported by Ontology Object properties."
              - `reducers` · list
                "If non-empty, this property can be reduced to a single value of the subtype. The reducers are applied in order to determine a winning value. The array can be loaded as a reduced value or as the full array in an object set."
                - `OntologyObjectArrayTypeReducer` · object · required
                  - `direction` · enum · required
                    one of `ASCENDING_NULLS_LAST`, `DESCENDING_NULLS_LAST`
                  - `field` · string
                    "The name of a struct field in the Ontology."
            - `short` · object
            - `vector` · object
              "Represents a fixed size vector of floats. These can be used for vector similarity searches."
              - `dimension` · integer · required
                "The dimension of the vector."
              - `supportsSearchWith` · list
                - `VectorSimilarityFunction` · object · required
                  "The vector similarity function to support approximate nearest neighbors search. Will result in an index specific for the function."
                  - `value` · enum
                    one of `COSINE_SIMILARITY`, `DOT_PRODUCT`, `EUCLIDEAN_DISTANCE`
              - `embeddingModel` · union
                - `lms` · object
                  "A model provided by Language Model Service."
                  - `value` · enum · required
                    one of `OPENAI_TEXT_EMBEDDING_ADA_002`, `TEXT_EMBEDDING_3_LARGE`, `TEXT_EMBEDDING_3_SMALL`, `SNOWFLAKE_ARCTIC_EMBED_M`, `INSTRUCTOR_LARGE`, `BGE_BASE_EN_V1_5`
                - `foundryLiveDeployment` · object
                  - `rid` · string
                    "The live deployment identifier. This rid is of the format 'ri.foundry-ml-live.main.live-deployment.<uuid>'."
                  - `inputParamName` · string
                    "The name of the input parameter to the model which should contain the query string."
                  - `outputParamName` · string
                    "The name of the output parameter to the model which should contain the computed embedding."
            - `decimal` · object
              - `precision` · integer
                "The total number of digits of the Decimal type. The maximum value is 38."
              - `scale` · integer
                "The number of digits to the right of the decimal point. The maximum value is 38."
            - `timestamp` · object
          - `valueTypeApiName` · string
            "The name of the value type in the API in camelCase format."
          - `valueFormatting` · union
            "This feature is experimental and may change in a future release. Comprehensive formatting configuration for displaying property values in user interfaces. Supports different value types including numbers, dates, timestamps, booleans, and known Foundry types. Each formatter type provides specific options tailored to that data type: - Numbers: Support for percentages, currencies, units, scaling, and custom formatting - Dates/Timestamps: Localized and custom formatting patterns - Booleans: Custom true/false display text - Known types: Special formatting for Foundry-specific identifiers"
            - `date` · object
              "Formatting configuration for date property values."
              - `format` · union · required
                - `stringFormat` · object
                  "A strictly specified date format pattern."
                  - `pattern` · string · required
                    "A valid format string composed of date/time patterns."
                - `localizedFormat` · object
                  "Predefined localized formatting options."
                  - `format` · enum · required
                    one of `DATE_FORMAT_RELATIVE_TO_NOW`, `DATE_FORMAT_DATE`, `DATE_FORMAT_YEAR_AND_MONTH`, `DATE_FORMAT_DATE_TIME`, `DATE_FORMAT_DATE_TIME_SHORT`, `DATE_FORMAT_TIME`, `DATE_FORMAT_ISO_INSTANT`
                    "Localized date/time format types."
            - `number` · object
              "Wrapper for numeric formatting options."
              - `numberType` · union · required
                - `standard` · object
                  "Standard number formatting with configurable options. This provides basic number formatting without any special units, scaling, or transformations."
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                - `duration` · object
                  "Format numeric values representing time durations. - Human readable: 3661 seconds displays as "1h 1m 1s" - Timecode: 3661 seconds displays as "01:01:01""
                  - `formatStyle` · union · required
                    - `humanReadable` · object
                      "Formats the duration as a human-readable written string."
                      - `showFullUnits` · boolean
                        "Whether to show full or abbreviated time units."
                    - `timecode` · object
                      "Formats the duration in a timecode format."
                  - `precision` · enum
                    one of `DAYS`, `HOURS`, `MINUTES`, `SECONDS`, `AUTO`
                    "Specifies the maximum precision to apply when formatting a duration."
                  - `baseValue` · enum · required
                    one of `SECONDS`, `MILLISECONDS`
                    "Specifies the unit of the input duration value."
                - `fixedValues` · object
                  "Map integer values to custom human-readable strings. Example: {1: "First", 2: "Second", 3: "Third"} would display 2 as "Second"."
                  - `values` · map
                    - `FixedValuesMapKey` · integer · required
                      "Integer key for fixed value mapping."
                - `affix` · object
                  "Attach arbitrary text before and/or after the formatted number. Example: prefix "USD " and postfix " total" displays as "USD 1,234.56 total""
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `affix` · object · required
                    - `prefix` · union
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                    - `postfix` · union
                      - `constant` · object
                        - `value` · string · required
                      - `propertyType` · object
                        - `propertyApiName` · string · required
                          "The API name of the PropertyType"
                - `scale` · object
                  "Scale the numeric value by dividing by the specified factor and append an appropriate suffix. - THOUSANDS: 1500 displays as "1.5K" - MILLIONS: 2500000 displays as "2.5M" - BILLIONS: 3200000000 displays as "3.2B""
                  - `scaleType` · enum · required
                    one of `THOUSANDS`, `MILLIONS`, `BILLIONS`
                    "Scale factor options for large numbers: - THOUSANDS: Divide by 1,000 and add "K" suffix - MILLIONS: Divide by 1,000,000 and add "M" suffix - BILLIONS: Divide by 1,000,000,000 and add "B" suffix"
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                - `currency` · object
                  "Format numbers as currency values with proper symbols and styling. Example: 1234.56 with currency "USD" displays as "USD 1,234.56" (standard) or "USD 1.2K" (compact)"
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `style` · enum · required
                    one of `STANDARD`, `COMPACT`
                    "Currency rendering style options: - STANDARD: Full currency formatting (e.g., "USD 1,234.56") - COMPACT: Abbreviated currency formatting (e.g., "USD 1.2K")"
                  - `currencyCode` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `standardUnit` · object
                  "Format numbers with standard units supported by Intl.NumberFormat. Examples: "meter", "kilogram", "celsius", "percent" Input: 25 with unit "celsius" displays as "25 degrees C""
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `unit` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `customUnit` · object
                  "Format numbers with custom units not supported by standard formatting. Use this for domain-specific units like "requests/sec", "widgets", etc. Example: 1500 with unit "widgets" displays as "1,500 widgets""
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
                  - `unit` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `ratio` · object
                  "Display the value as a ratio with different scaling factors and suffixes: - PERCENTAGE: Multiply by 100 and add "%" suffix (0.15 → "15%") - PER_MILLE: Multiply by 1000 and add "‰" suffix (0.015 → "15‰") - BASIS_POINTS: Multiply by 10000 and add "bps" suffix (0.0015 → "15bps")"
                  - `ratioType` · enum · required
                    one of `PERCENTAGE`, `PER_MILLE`, `BASIS_POINTS`
                    "Ratio format options for displaying proportional values: - PERCENTAGE: Multiply by 100 and add "%" suffix - PER_MILLE: Multiply by 1000 and add "‰" suffix - BASIS_POINTS: Multiply by 10000 and add "bps" suffix"
                  - `baseFormatOptions` · object · required
                    "Base number formatting options that can be applied to all number formatters. Controls precision, grouping, rounding, and notation. Consistent with JavaScript's Intl.NumberFormat. Examples: - useGrouping: true makes 1234567 display as "1,234,567" - maximumFractionDigits: 2 makes 3.14159 display as "3.14" - notation: SCIENTIFIC makes 1234 display as "1.234E3""
                    - `useGrouping` · boolean
                      "If true, show a locale-appropriate number grouping (e.g. thousands for en)."
                    - `convertNegativeToParenthesis` · boolean
                      "If true, wrap negative numbers in parentheses instead of a minus sign."
                    - `minimumIntegerDigits` · integer
                    - `minimumFractionDigits` · integer
                    - `maximumFractionDigits` · integer
                    - `minimumSignificantDigits` · integer
                    - `maximumSignificantDigits` · integer
                    - `notation` · enum
                      one of `STANDARD`, `SCIENTIFIC`, `ENGINEERING`, `COMPACT`
                      "Number notation style options: - STANDARD: Regular number display ("1,234") - SCIENTIFIC: Scientific notation ("1.234E3") - ENGINEERING: Engineering notation ("1.234E3") - COMPACT: Compact notation ("1.2K")"
                    - `roundingMode` · enum
                      one of `CEIL`, `FLOOR`, `ROUND_CLOSEST`
                      "Number rounding behavior: - CEIL: Always round up (3.1 becomes 4) - FLOOR: Always round down (3.9 becomes 3) - ROUND_CLOSEST: Round to nearest (3.4 becomes 3, 3.6 becomes 4)"
            - `boolean` · object
              "Formatting configuration for boolean property values."
              - `valueIfTrue` · string · required
                "Value to display if this boolean is true"
              - `valueIfFalse` · string · required
                "Value to display if this boolean is false"
            - `knownType` · object
              "Formatting configuration for known Foundry types."
              - `knownType` · enum · required
                one of `USER_OR_GROUP_ID`, `RESOURCE_RID`, `ARTIFACT_GID`
                "Known Foundry types for specialized formatting: - userOrGroupRid: Format as user or group - resourceRid: Format as resource - artifactGid: Format as artifact"
            - `timestamp` · object
              "Formatting configuration for timestamp property values."
              - `format` · union · required
                - `stringFormat` · object
                  "A strictly specified date format pattern."
                  - `pattern` · string · required
                    "A valid format string composed of date/time patterns."
                - `localizedFormat` · object
                  "Predefined localized formatting options."
                  - `format` · enum · required
                    one of `DATE_FORMAT_RELATIVE_TO_NOW`, `DATE_FORMAT_DATE`, `DATE_FORMAT_YEAR_AND_MONTH`, `DATE_FORMAT_DATE_TIME`, `DATE_FORMAT_DATE_TIME_SHORT`, `DATE_FORMAT_TIME`, `DATE_FORMAT_ISO_INSTANT`
                    "Localized date/time format types."
              - `displayTimezone` · union · required
                - `static` · object
                  - `zoneId` · union · required
                    - `constant` · object
                      - `value` · string · required
                    - `propertyType` · object
                      - `propertyApiName` · string · required
                        "The API name of the PropertyType"
                - `user` · object
                  "The user's local timezone."
          - `requireImplementation` · boolean · required
            "Whether each implementing object type must declare an implementation for this property."
      - `extendsInterfaces` · list
        "A list of interface API names that this interface extends. An interface can extend other interfaces to inherit their properties."
        - `InterfaceTypeApiName` · string · required
          "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
      - `allExtendsInterfaces` · list
        "A list of interface API names that this interface extends, both directly and indirectly."
        - `InterfaceTypeApiName` · string · required
          "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
      - `implementedByObjectTypes` · list
        "A list of object API names that implement this interface."
        - `ObjectTypeApiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
      - `links` · map
        "A map from an interface link type API name to the corresponding interface link type. The map describes the set of link types the interface has."
        - `InterfaceLinkTypeApiName` · string · required
          "The name of the interface link type in the API. To find the API name for your Interface Link Type, check the [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
        - `InterfaceLinkType` · object · required
          "A link type constraint defined at the interface level where the implementation of the links is provided by the implementing object types."
          - `rid` · string · required
            "The unique resource identifier of an interface link type, useful for interacting with other Foundry APIs."
          - `apiName` · string · required
            "The name of the interface link type in the API. To find the API name for your Interface Link Type, check the [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
          - `displayName` · string · required
            "The display name of the entity."
          - `description` · string
            "The description of the interface link type."
          - `linkedEntityApiName` · union · required
            "A reference to the linked entity. This can either be an object or an interface type."
            - `objectTypeApiName` · object
              "A reference to the linked object type."
              - `apiName` · string · required
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
            - `interfaceTypeApiName` · object
              "A reference to the linked interface type."
              - `apiName` · string · required
                "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
          - `cardinality` · enum · required
            one of `ONE`, `MANY`
            "The cardinality of the link in the given direction. Cardinality can be "ONE", meaning an object can link to zero or one other objects, or "MANY", meaning an object can link to any number of other objects."
          - `required` · boolean · required
            "Whether each implementing object type must declare at least one implementation of this link."
      - `allLinks` · map
        "A map from an interface link type API name to the corresponding interface link type. The map describes the set of link types the interface has, including links from all directly and indirectly extended interfaces."
        - `InterfaceLinkTypeApiName` · string · required
          "The name of the interface link type in the API. To find the API name for your Interface Link Type, check the [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
        - `InterfaceLinkType` · object · required
          "A link type constraint defined at the interface level where the implementation of the links is provided by the implementing object types."
          - `rid` · string · required
            "The unique resource identifier of an interface link type, useful for interacting with other Foundry APIs."
          - `apiName` · string · required
            "The name of the interface link type in the API. To find the API name for your Interface Link Type, check the [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
          - `displayName` · string · required
            "The display name of the entity."
          - `description` · string
            "The description of the interface link type."
          - `linkedEntityApiName` · union · required
            "A reference to the linked entity. This can either be an object or an interface type."
            - `objectTypeApiName` · object
              "A reference to the linked object type."
              - `apiName` · string · required
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
            - `interfaceTypeApiName` · object
              "A reference to the linked interface type."
              - `apiName` · string · required
                "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
          - `cardinality` · enum · required
            one of `ONE`, `MANY`
            "The cardinality of the link in the given direction. Cardinality can be "ONE", meaning an object can link to zero or one other objects, or "MANY", meaning an object can link to any number of other objects."
          - `required` · boolean · required
            "Whether each implementing object type must declare at least one implementation of this link."
