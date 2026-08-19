<!-- source: https://palantir.com/docs/foundry/api/ontologies-v2-resources/ontologies/get-ontology-full-metadata/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Ontology Full Metadata

`GET /api/v2/ontologies/{ontology}/fullMetadata`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the full Ontology metadata. This includes the objects, links, actions, queries, and interfaces.
This endpoint is designed to return as much metadata as possible in a single request to support OSDK workflows.
It may omit certain entities rather than fail the request.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."

## Query parameters

- `branch` · string
  "The Foundry branch to load metadata from. If not specified, the default branch will be used. Branches are an experimental feature and not all workflows are supported."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Response

- `OntologyFullMetadata` · object · required
  "Success response."
  - `ontology` · object · required
    "Metadata about an Ontology."
    - `apiName` · string · required
    - `displayName` · string · required
      "The display name of the entity."
    - `description` · string · required
    - `rid` · string · required
      "The unique Resource Identifier (RID) of the Ontology. To look up your Ontology RID, please use the `List ontologies` endpoint or check the **Ontology Manager**."
  - `objectTypes` · map
    - `ObjectTypeApiName` · string · required
      "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
    - `ObjectTypeFullMetadata` · object · required
      - `objectType` · object · required
        "Represents an object type in the Ontology."
        - `apiName` · string · required
          "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
        - `displayName` · string · required
          "The display name of the entity."
        - `status` · enum · required
          one of `ACTIVE`, `ENDORSED`, `EXPERIMENTAL`, `DEPRECATED`
          "The release status of the entity."
        - `description` · string
          "The description of the object type."
        - `pluralDisplayName` · string · required
          "The plural display name of the object type."
        - `icon` · union · required
          "A union currently only consisting of the BlueprintIcon (more icon types may be added in the future)."
          - `blueprint` · object
            - `color` · string · required
              "A hexadecimal color code."
            - `name` · string · required
              "The [name](https://blueprintjs.com/docs/#icons/icons-list) of the Blueprint icon. Used to specify the Blueprint icon to represent the object type in a React app."
        - `primaryKey` · string · required
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `properties` · map
          "A map of the properties of the object type."
          - `PropertyApiName` · string · required
            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `PropertyV2` · object · required
            "Details about some property of an object."
            - `description` · string
            - `displayName` · string
              "The display name of the entity."
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
            - `rid` · string · required
              "The unique resource identifier of a property."
            - `status` · union
              "The status to indicate whether the PropertyType is either Experimental, Active, Deprecated, or Example."
              - `deprecated` · object
                "This status indicates that the PropertyType is reaching the end of its life and will be removed as per the deadline specified."
                - `message` · string · required
                - `deadline` · string · required
                - `replacedBy` · string
                  "The unique resource identifier of a property."
              - `active` · object
                "This status indicates that the PropertyType will not change on short notice and should thus be safe to use in user facing workflows."
              - `experimental` · object
                "This status indicates that the PropertyType is in development."
              - `example` · object
                "This status indicates that the PropertyType is an example. It is backed by notional data that should not be used for actual workflows, but can be used to test those workflows."
            - `visibility` · enum
              one of `NORMAL`, `PROMINENT`, `HIDDEN`
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
            - `typeClasses` · list
              - `TypeClass` · object · required
                "Additional metadata that can be interpreted by user applications that interact with the Ontology"
                - `kind` · string · required
                  "A namespace for the type class."
                - `name` · string · required
                  "The value of the type class."
        - `rid` · string · required
          "The unique resource identifier of an object type, useful for interacting with other Foundry APIs."
        - `titleProperty` · string · required
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
        - `visibility` · enum
          one of `NORMAL`, `PROMINENT`, `HIDDEN`
          "The suggested visibility of the object type."
        - `aliases` · list
          "Alternative names (synonyms) for the object type, usable as search terms. This field is only populated on the get-by-RID read paths (e.g. `getObjectTypeV2`); it is always empty on the `listObjectTypesV2` endpoint."
        - `datasources` · list
          "The datasources backing this object type which the user has access to see. Only populated when the request specifies `includeDatasources=true`. This list may be empty if the user doesn't have access to any datasources."
          - `ObjectTypeDatasource` · object · required
            "A datasource that supplies property values for an object type. Each object type can have one or more datasources; together they back all of the object type's properties. The `definition` carries the RID of the backing Foundry resource (for example, the dataset RID for a dataset-backed object type), enabling callers to navigate from an object type to its backing data."
            - `rid` · string · required
              "Randomly generated identifier for an object type's datasource."
            - `definition` · union · required
              "The definition of an object type datasource, identifying the kind of Foundry resource that backs the object type."
              - `timeSeries` · object
                "An object type datasource backed by a time series sync, providing values for time-dependent properties."
                - `timeSeriesSyncRid` · string · required
                  "The RID identifying a time series sync."
                - `properties` · list
                  "The set of properties that are bound to the time series."
                  - `PropertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `unsupported` · object
                "A datasource of a kind not yet exposed in the public API. The `unsupportedType` discriminator supplies the underlying OMS variant so callers can recognize known but unmodelled cases (e.g., derived properties). Variants the adapter does not recognise at all are returned with an `"unknown"` discriminator. The `properties` list enumerates the property API names this datasource backs. The `properties` will be empty for `"unknown"` datasources."
                - `unsupportedType` · string · required
                  "A short, stable discriminator naming the underlying OMS variant. E.g., `"derivedProperties"` for derived-properties datasources or `"unknown"` for variants the adapter does not recognize."
                - `properties` · list
                  "The property API names that this datasource backs."
                  - `PropertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `restrictedView` · object
                "An object type datasource backed by a Foundry restricted view."
                - `restrictedViewRid` · string · required
                  "The RID of a Foundry restricted view."
                - `propertyMapping` · map
                  "A mapping from property API name to a description of how that property is bound to the restricted view. Properties whose mapping info cannot be modeled are omitted."
                  - `PropertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                  - `PropertyTypeMappingInfo` · union · required
                    "Describes how a single object type property is bound to its backing tabular datasource. A property may be backed by a single column, by a struct (with nested field mappings), or be edit-only (no backing column even though it is permissioned to the tabular datasource)."
                    - `struct` · object
                      "A mapping from the backing column struct field names to a struct property's fields."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                      - `fields` · map
                        - `StructFieldName` · string · required
                          "The name of a field in a `Struct`."
                        - `StructFieldPropertyMapping` · object · required
                          "A single struct field's mapping where `apiName` is the name of a struct field."
                          - `apiName` · string · required
                            "The name of a struct field in the Ontology."
                    - `column` · object
                      "A property bound to a single column in the backing datasource."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                    - `editOnly` · object
                      "A property on an object type that is permissioned to a tabular datasource, but the contents are only populated through Actions."
              - `stream` · object
                "An object type datasource backed by a Foundry stream."
                - `streamRid` · string · required
                  "The RID of a Foundry stream."
                - `branch` · string
                  "The id of a datasource branch. Branch ids are user supplied strings, not RIDs."
                - `propertyMapping` · map
                  "A mapping from property API name to a description of how that property is bound to the stream. Properties whose mapping info cannot be modeled are omitted."
                  - `PropertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                  - `PropertyTypeMappingInfo` · union · required
                    "Describes how a single object type property is bound to its backing tabular datasource. A property may be backed by a single column, by a struct (with nested field mappings), or be edit-only (no backing column even though it is permissioned to the tabular datasource)."
                    - `struct` · object
                      "A mapping from the backing column struct field names to a struct property's fields."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                      - `fields` · map
                        - `StructFieldName` · string · required
                          "The name of a field in a `Struct`."
                        - `StructFieldPropertyMapping` · object · required
                          "A single struct field's mapping where `apiName` is the name of a struct field."
                          - `apiName` · string · required
                            "The name of a struct field in the Ontology."
                    - `column` · object
                      "A property bound to a single column in the backing datasource."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                    - `editOnly` · object
                      "A property on an object type that is permissioned to a tabular datasource, but the contents are only populated through Actions."
              - `mediaSetView` · object
                "An object type datasource backed by a Foundry media set view, providing media for media reference properties."
                - `mediaSetRid` · string · required
                  "The Resource Identifier (RID) of a Media Set in Foundry."
                - `mediaSetViewRid` · string · required
                  "The Resource Identifier (RID) of a single View of a Media Set. A Media Set View is an independent collection of Media Items."
                - `properties` · list
                  "The set of properties that are bound to the media view."
                  - `PropertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `direct` · object
                "An object type datasource backed by a direct-write source. Property values are written directly to the datasource rather than being read from a separate Foundry resource. Unlike an edits-only datasource, a direct datasource has a backing source that values are written to by some writer. An edits-only datasource has no backing source at all and its properties are populated solely via Actions."
                - `directSourceRid` · string · required
                  "The RID of a direct-write source backing an object type."
                - `propertyMapping` · map
                  "A mapping from property API name to a description of how that property is bound to the direct datasource. Properties whose mapping info cannot be modeled are omitted."
                  - `PropertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                  - `PropertyTypeMappingInfo` · union · required
                    "Describes how a single object type property is bound to its backing tabular datasource. A property may be backed by a single column, by a struct (with nested field mappings), or be edit-only (no backing column even though it is permissioned to the tabular datasource)."
                    - `struct` · object
                      "A mapping from the backing column struct field names to a struct property's fields."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                      - `fields` · map
                        - `StructFieldName` · string · required
                          "The name of a field in a `Struct`."
                        - `StructFieldPropertyMapping` · object · required
                          "A single struct field's mapping where `apiName` is the name of a struct field."
                          - `apiName` · string · required
                            "The name of a struct field in the Ontology."
                    - `column` · object
                      "A property bound to a single column in the backing datasource."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                    - `editOnly` · object
                      "A property on an object type that is permissioned to a tabular datasource, but the contents are only populated through Actions."
              - `geotimeSeries` · object
                "An object type datasource backed by a Geotime series integration, providing values for Geotime series reference properties."
                - `geotimeSeriesIntegrationRid` · string · required
                  "The unique resource identifier of a geotime integration."
                - `properties` · list
                  "The set of properties that are bound to the Geotime series."
                  - `PropertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `editsOnly` · object
                "An object type datasource that is not backed by any external Foundry resource. All properties on the object type can only be populated via Actions. Other datasources have edit only *properties*, which are permissioned to the backing tabular datasource. This datasource has no backing tabular datasource and is a true edit only object type. Note that this datasource type is incompatible with any other datasource and all the properties on the object type are backed by it."
              - `dataset` · object
                "An object type datasource backed by a Foundry dataset."
                - `datasetRid` · string · required
                  "The Resource Identifier (RID) of a Dataset."
                - `branch` · string
                  "The id of a datasource branch. Branch ids are user supplied strings, not RIDs."
                - `propertyMapping` · map
                  "A mapping from property API name to a description of how that property is bound to the dataset. Properties whose mapping info cannot be modeled are omitted."
                  - `PropertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                  - `PropertyTypeMappingInfo` · union · required
                    "Describes how a single object type property is bound to its backing tabular datasource. A property may be backed by a single column, by a struct (with nested field mappings), or be edit-only (no backing column even though it is permissioned to the tabular datasource)."
                    - `struct` · object
                      "A mapping from the backing column struct field names to a struct property's fields."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                      - `fields` · map
                        - `StructFieldName` · string · required
                          "The name of a field in a `Struct`."
                        - `StructFieldPropertyMapping` · object · required
                          "A single struct field's mapping where `apiName` is the name of a struct field."
                          - `apiName` · string · required
                            "The name of a struct field in the Ontology."
                    - `column` · object
                      "A property bound to a single column in the backing datasource."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                    - `editOnly` · object
                      "A property on an object type that is permissioned to a tabular datasource, but the contents are only populated through Actions."
              - `table` · object
                "An object type datasource backed by a Foundry table."
                - `tableRid` · string · required
                  "The RID of a Foundry table."
                - `branch` · string
                  "The id of a datasource branch. Branch ids are user supplied strings, not RIDs."
                - `propertyMapping` · map
                  "A mapping from property API name to a description of how that property is bound to the table. Properties whose mapping info cannot be modeled are omitted."
                  - `PropertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                  - `PropertyTypeMappingInfo` · union · required
                    "Describes how a single object type property is bound to its backing tabular datasource. A property may be backed by a single column, by a struct (with nested field mappings), or be edit-only (no backing column even though it is permissioned to the tabular datasource)."
                    - `struct` · object
                      "A mapping from the backing column struct field names to a struct property's fields."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                      - `fields` · map
                        - `StructFieldName` · string · required
                          "The name of a field in a `Struct`."
                        - `StructFieldPropertyMapping` · object · required
                          "A single struct field's mapping where `apiName` is the name of a struct field."
                          - `apiName` · string · required
                            "The name of a struct field in the Ontology."
                    - `column` · object
                      "A property bound to a single column in the backing datasource."
                      - `column` · string · required
                        "The name of a column in a tabular datasource."
                    - `editOnly` · object
                      "A property on an object type that is permissioned to a tabular datasource, but the contents are only populated through Actions."
      - `linkTypes` · list
        - `LinkTypeSideV2` · object · required
          "`foreignKeyPropertyApiName` is the API name of the foreign key on this object type. If absent, the link is either a m2m link or the linked object has the foreign key and this object type has the primary key."
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
          - `linkTypeRid` · string · required
      - `implementsInterfaces` · list
        "A list of interfaces that this object type implements."
        - `InterfaceTypeApiName` · string · required
          "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
      - `implementsInterfaces2` · map
        "A list of interfaces that this object type implements and how it implements them."
        - `InterfaceTypeApiName` · string · required
          "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
        - `ObjectTypeInterfaceImplementation` · object · required
          - `apiName` · string
            "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
          - `rid` · string
            "The unique resource identifier of an interface, useful for interacting with other Foundry APIs."
          - `properties` · map
            - `SharedPropertyTypeApiName` · string · required
              "The name of the shared property type in the API in lowerCamelCase format. To find the API name for your shared property type, use the `List shared property types` endpoint or check the **Ontology Manager**."
            - `PropertyApiName` · string · required
              "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `propertiesV2` · map
            - `InterfacePropertyApiName` · string · required
              "The name of the interface property type in the API in lowerCamelCase format. To find the API name for your interface property type, use the `List interface types` endpoint and check the `allPropertiesV2` field or check the **Ontology Manager**."
            - `InterfacePropertyTypeImplementation` · union · required
              "Describes how an object type implements an interface property."
              - `structFieldImplementation` · object
                "An implementation of an interface property via the field of a local struct property."
                - `structFieldOfProperty` · object · required
                  - `propertyApiName` · string · required
                    "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                  - `structFieldApiName` · string · required
                    "The name of a struct field in the Ontology."
              - `structImplementation` · object
                "An implementation of a struct interface property via a local struct property. Specifies a mapping of interface struct fields to local struct fields or properties."
                - `mapping` · map
                  "An implementation of a struct interface property via a local struct property. Specifies a mapping of interface struct fields to local struct fields or properties."
                  - `StructFieldApiName` · string · required
                    "The name of a struct field in the Ontology."
                  - `PropertyOrStructFieldOfPropertyImplementation` · union · required
                    - `structFieldOfProperty` · object
                      - `propertyApiName` · string · required
                        "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                      - `structFieldApiName` · string · required
                        "The name of a struct field in the Ontology."
                    - `property` · object
                      - `propertyApiName` · string · required
                        "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `localPropertyImplementation` · object
                "An implementation of an interface property via a local property."
                - `propertyApiName` · string · required
                  "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `reducedPropertyImplementation` · object
                "An implementation of an interface property via applying reducers on the nested implementation."
                - `implementation` · union · required
                  "Describes how an object type implements an interface property when a reducer is applied to it. Is missing a reduced property implementation to prevent arbitrarily nested implementations."
                  - `structFieldImplementation` · object
                    "An implementation of an interface property via the field of a local struct property."
                    - `structFieldOfProperty` · object · required
                      - `propertyApiName` · string · required
                        "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                      - `structFieldApiName` · string · required
                        "The name of a struct field in the Ontology."
                  - `structImplementation` · object
                    "An implementation of a struct interface property via a local struct property. Specifies a mapping of interface struct fields to local struct fields or properties."
                    - `mapping` · map
                      "An implementation of a struct interface property via a local struct property. Specifies a mapping of interface struct fields to local struct fields or properties."
                      - `StructFieldApiName` · string · required
                        "The name of a struct field in the Ontology."
                      - `PropertyOrStructFieldOfPropertyImplementation` · union · required
                        - `structFieldOfProperty` · object
                          - `propertyApiName` · string · required
                            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                          - `structFieldApiName` · string · required
                            "The name of a struct field in the Ontology."
                        - `property` · object
                          - `propertyApiName` · string · required
                            "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
                  - `localPropertyImplementation` · object
                    "An implementation of an interface property via a local property."
                    - `propertyApiName` · string · required
                      "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
          - `links` · map
            - `InterfaceLinkTypeApiName` · string · required
              "The name of the interface link type in the API. To find the API name for your Interface Link Type, check the [Ontology Manager](/docs/foundry/ontology-manager/overview/)."
            - `array` · list · required
              - `LinkTypeApiName` · string · required
                "The name of the link type in the API. To find the API name for your Link Type, check the **Ontology Manager** application."
          - `actionTypes` · map
            "A map from interface action type constraint API name to the API name of the concrete action type on this object type that implements it. Action types the caller is not authorized to access are omitted, so this map may not cover every action type constraint declared on the interface."
            - `InterfaceActionTypeConstraintApiName` · string · required
              "The name in the API of an action defined on an interface that implementing object types provide a concrete action type for."
            - `ActionTypeApiName` · string · required
              "The name of the action type in the API. To find the API name for your Action Type, use the `List action types` endpoint or check the **Ontology Manager**."
      - `sharedPropertyTypeMapping` · map
        "A map from shared property type API name to backing local property API name for the shared property types present on this object type."
        - `SharedPropertyTypeApiName` · string · required
          "The name of the shared property type in the API in lowerCamelCase format. To find the API name for your shared property type, use the `List shared property types` endpoint or check the **Ontology Manager**."
        - `PropertyApiName` · string · required
          "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
  - `actionTypes` · map
    - `ActionTypeApiName` · string · required
      "The name of the action type in the API. To find the API name for your Action Type, use the `List action types` endpoint or check the **Ontology Manager**."
    - `ActionTypeV2` · object · required
      "Represents an action type in the Ontology."
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
        - `ActionParameterV2` · object · required
          "Details about a parameter of an action."
          - `displayName` · string · required
            "The display name of the entity."
          - `description` · string
          - `dataType` · union · required
            "A union of all the types supported by Ontology Action parameters."
            - `date` · object
            - `interfaceObject` · object
              - `interfaceTypeApiName` · string
                "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
            - `struct` · object
              - `fields` · list
                - `OntologyStructField` · object · required
                  - `name` · string · required
                    "The name of a field in a `Struct`."
                  - `fieldType` · union · required
                    "A union of all the primitive types used by Palantir's Ontology-based products."
                    - `date` · object
                    - `struct` · object
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
            - `string` · object
            - `double` · object
            - `integer` · object
            - `geoshape` · object
            - `long` · object
            - `objectType` · object
            - `boolean` · object
            - `marking` · object
              - `markingType` · enum
                one of `CBAC`, `MANDATORY`
                "The kind of marking applied by a marking property type. - `CBAC`: Classification-based access control markings. - `MANDATORY`: Standard non-classification markings. Example - Organizations."
            - `scenarioReference` · object
            - `attachment` · object
            - `mediaReference` · object
            - `array` · object
              - `subType` · union · required
                "A union of all the types supported by Ontology Action parameters."
            - `objectSet` · object
              - `objectApiName` · string
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
              - `objectTypeApiName` · string
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
            - `geohash` · object
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
            - `object` · object
              - `objectApiName` · string · required
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
              - `objectTypeApiName` · string · required
                "The name of the object type in the API in camelCase format. To find the API name for your Object Type, use the `List object types` endpoint or check the **Ontology Manager**."
            - `timestamp` · object
          - `required` · boolean · required
          - `typeClasses` · list
            - `TypeClass` · object · required
              "Additional metadata that can be interpreted by user applications that interact with the Ontology"
              - `kind` · string · required
                "A namespace for the type class."
              - `name` · string · required
                "The value of the type class."
          - `validation` · object
            "Validation metadata surfaced for a parameter."
            - `defaultValidation` · object · required
              "Validation constraints for a parameter."
              - `allowedValues` · union
                "The allowed-values constraint configured on an action parameter."
                - `oneOf` · object
                  "The parameter value must be one of a fixed set of labelled options."
                  - `options` · list
                    "The predefined set of options."
                    - `ParameterAllowedValueOption` · object · required
                      "A possible value for the parameter."
                      - `displayName` · string · required
                        "The display name of the entity."
                      - `value` · any · required
                        "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
                  - `otherValuesAllowed` · boolean · required
                    "Whether values outside `options` are allowed."
                - `datetime` · object
                  "The parameter value must fall within the specified date or timestamp range."
                  - `gt` · union
                    "A datetime bound value."
                    - `now` · object
                      "The current evaluation time itself. Carries no fields."
                    - `fixed` · object
                      "An absolute datetime bound (ISO 8601 timestamp or date string)."
                      - `value` · union · required
                        "The source of a constraint bound value."
                        - `static` · object
                          "A literal constraint value."
                          - `value` · any · required
                            "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
                    - `relative` · object
                      "A datetime expressed as an offset from the current time."
                      - `duration` · string · required
                        "The magnitude of a relative datetime offset."
                      - `unit` · enum · required
                        one of `SECOND`, `MINUTE`, `HOUR`, `DAY`, `WEEK`
                        "Time unit for relative datetime offsets."
                      - `tense` · enum · required
                        one of `FUTURE`, `PAST`
                        "Direction of a relative datetime offset."
                  - `gte` · union
                    "A datetime bound value."
                    - `now` · object
                      "The current evaluation time itself. Carries no fields."
                    - `fixed` · object
                      "An absolute datetime bound (ISO 8601 timestamp or date string)."
                      - `value` · union · required
                        "The source of a constraint bound value."
                        - `static` · object
                          "A literal constraint value."
                          - `value` · any · required
                            "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
                    - `relative` · object
                      "A datetime expressed as an offset from the current time."
                      - `duration` · string · required
                        "The magnitude of a relative datetime offset."
                      - `unit` · enum · required
                        one of `SECOND`, `MINUTE`, `HOUR`, `DAY`, `WEEK`
                        "Time unit for relative datetime offsets."
                      - `tense` · enum · required
                        one of `FUTURE`, `PAST`
                        "Direction of a relative datetime offset."
                  - `lt` · union
                    "A datetime bound value."
                    - `now` · object
                      "The current evaluation time itself. Carries no fields."
                    - `fixed` · object
                      "An absolute datetime bound (ISO 8601 timestamp or date string)."
                      - `value` · union · required
                        "The source of a constraint bound value."
                        - `static` · object
                          "A literal constraint value."
                          - `value` · any · required
                            "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
                    - `relative` · object
                      "A datetime expressed as an offset from the current time."
                      - `duration` · string · required
                        "The magnitude of a relative datetime offset."
                      - `unit` · enum · required
                        one of `SECOND`, `MINUTE`, `HOUR`, `DAY`, `WEEK`
                        "Time unit for relative datetime offsets."
                      - `tense` · enum · required
                        one of `FUTURE`, `PAST`
                        "Direction of a relative datetime offset."
                  - `lte` · union
                    "A datetime bound value."
                    - `now` · object
                      "The current evaluation time itself. Carries no fields."
                    - `fixed` · object
                      "An absolute datetime bound (ISO 8601 timestamp or date string)."
                      - `value` · union · required
                        "The source of a constraint bound value."
                        - `static` · object
                          "A literal constraint value."
                          - `value` · any · required
                            "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
                    - `relative` · object
                      "A datetime expressed as an offset from the current time."
                      - `duration` · string · required
                        "The magnitude of a relative datetime offset."
                      - `unit` · enum · required
                        one of `SECOND`, `MINUTE`, `HOUR`, `DAY`, `WEEK`
                        "Time unit for relative datetime offsets."
                      - `tense` · enum · required
                        one of `FUTURE`, `PAST`
                        "Direction of a relative datetime offset."
                - `attachment` · object
                  "The parameter value (an attachment rid) must reference an attachment within the configured size limit."
                  - `maxSizeBytes` · string
                    "The size of the file or attachment in bytes."
                - `valueType` · object
                  "The parameter value must conform to the referenced value type."
                  - `apiName` · string · required
                    "The name of the value type in the API in camelCase format."
                  - `rid` · string · required
                  - `versionId` · string · required
                - `markdown` · object
                  "The parameter value (a markdown-formatted string) must satisfy the configured length bounds."
                  - `gte` · integer
                    "Character length greater than or equal."
                  - `lte` · integer
                    "Character length less than or equal."
                - `range` · object
                  "The parameter value must fall within the specified numeric range."
                  - `gt` · union
                    "The source of a constraint bound value."
                    - `static` · object
                      "A literal constraint value."
                      - `value` · any · required
                        "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
                  - `gte` · union
                    "The source of a constraint bound value."
                    - `static` · object
                      "A literal constraint value."
                      - `value` · any · required
                        "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
                  - `lt` · union
                    "The source of a constraint bound value."
                    - `static` · object
                      "A literal constraint value."
                      - `value` · any · required
                        "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
                  - `lte` · union
                    "The source of a constraint bound value."
                    - `static` · object
                      "A literal constraint value."
                      - `value` · any · required
                        "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
                - `mustBeEmpty` · object
                  "The parameter must be omitted or empty."
                - `text` · object
                  "The parameter value (a string) must satisfy the configured length bounds and/or regex pattern."
                  - `gte` · integer
                    "Character length greater than or equal."
                  - `lte` · integer
                    "Character length less than or equal."
                  - `regex` · string
                    "The regular expression. Format and supported syntax match Elasticsearch regex semantics."
                  - `configuredFailureMessage` · string
                    "Message returned when the value does not match the pattern."
              - `arraySize` · object
                "Bounds on the size of an array-typed parameter."
                - `gte` · integer
                  "Greater than or equal."
                - `lte` · integer
                  "Less than or equal."
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
      - `toolDescription` · string
        "Optional description intended for tool use contexts, such as AI agents."
  - `queryTypes` · map
    - `VersionedQueryTypeApiName` · string · required
      "The name of the Query in the API and an optional version identifier separated by a colon. If the API name contains a colon, then a version identifier of either "latest" or a semantic version must be included. If the API does not contain a colon, then either the version identifier must be excluded or a version identifier of a semantic version must be included. Examples: 'myGroup:myFunction:latest', 'myGroup:myFunction:1.0.0', 'myFunction', 'myFunction:2.0.0'"
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
  - `interfaceTypes` · map
    - `InterfaceTypeApiName` · string · required
      "The name of the interface type in the API in UpperCamelCase format. To find the API name for your interface type, use the `List interface types` endpoint or check the **Ontology Manager**."
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
  - `sharedPropertyTypes` · map
    - `SharedPropertyTypeApiName` · string · required
      "The name of the shared property type in the API in lowerCamelCase format. To find the API name for your shared property type, use the `List shared property types` endpoint or check the **Ontology Manager**."
    - `SharedPropertyType` · object · required
      "A property type that can be shared across object types."
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
      - `typeClasses` · list
        - `TypeClass` · object · required
          "Additional metadata that can be interpreted by user applications that interact with the Ontology"
          - `kind` · string · required
            "A namespace for the type class."
          - `name` · string · required
            "The value of the type class."
  - `branch` · object
    "Metadata about a Foundry branch."
    - `rid` · string · required
      "The Foundry branch identifier, specifically its rid. Different identifier types may be used in the future as values."
  - `valueTypes` · map
    - `ValueTypeApiName` · string · required
      "The name of the value type in the API in camelCase format."
    - `OntologyValueType` · object · required
      - `apiName` · string · required
        "The name of the value type in the API in camelCase format."
      - `displayName` · string · required
        "The display name of the entity."
      - `description` · string
      - `rid` · string · required
      - `status` · enum
        one of `ACTIVE`, `DEPRECATED`
      - `fieldType` · union · required
        - `date` · object
        - `struct` · object
          - `fields` · list
            - `ValueTypeStructField` · object · required
              - `name` · string
                "The name of a field in a `Struct`."
              - `fieldType` · union
        - `string` · object
        - `byte` · object
        - `double` · object
        - `optional` · object
          - `wrappedType` · union
        - `integer` · object
        - `union` · object
          - `memberTypes` · list
            - `ValueTypeFieldType` · union · required
        - `float` · object
        - `long` · object
        - `reference` · object
        - `boolean` · object
        - `array` · object
          - `subType` · union
        - `binary` · object
        - `short` · object
        - `decimal` · object
        - `map` · object
          - `keyType` · union
          - `valueType` · union
        - `timestamp` · object
      - `version` · string · required
      - `constraints` · list
        - `ValueTypeConstraint` · union · required
          - `struct` · object
            - `properties` · map
              "A map of the properties of the struct type to the value type applied to that property."
              - `PropertyApiName` · string · required
                "The name of the property in the API. To find the API name for your property, use the `Get object type` endpoint or check the **Ontology Manager**."
              - `ValueTypeApiName` · string · required
                "The name of the value type in the API in camelCase format."
          - `regex` · object
            - `pattern` · string · required
            - `partialMatch` · boolean · required
          - `unsupported` · object
            - `unsupportedType` · string · required
            - `params` · map
              - `UnsupportedTypeParamKey` · string · required
              - `UnsupportedTypeParamValue` · string · required
          - `array` · object
            - `minimumSize` · integer
            - `maximumSize` · integer
            - `uniqueValues` · boolean · required
            - `valueConstraint` · union
          - `length` · object
            - `minimumLength` · number
            - `maximumLength` · number
          - `range` · object
            - `minimumValue` · any
              "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
            - `maximumValue` · any
              "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
          - `rid` · object
            "The string must be a valid RID (Resource Identifier)."
          - `uuid` · object
            "The string must be a valid UUID (Universally Unique Identifier)."
          - `enum` · object
            - `options` · list
              - `PropertyValue` · any · required
                "Represents the value of a property in the following format. | Type                                                                                                                      | JSON encoding                                               | Example                                                                                            | |---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------| | Array                                                                                                                     | array                                                       | `["alpha", "bravo", "charlie"]`                                                                    | | [Attachment](/docs/foundry/api/v2/ontologies-v2-resources/attachment-properties/attachment-property-basics/)              | JSON encoded `AttachmentProperty` object                    | `{"rid":"ri.blobster.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"}`                       | | Boolean                                                                                                                   | boolean                                                     | `true`                                                                                             | | Byte                                                                                                                      | number                                                      | `31`                                                                                               | | CipherText                                                                                                                | string                                                      | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"`                                                                                                                                                                                        | | Date                                                                                                                      | ISO 8601 extended local date string                         | `"2021-05-01"`                                                                                     | | Decimal                                                                                                                   | string                                                      | `"2.718281828"`                                                                                    | | Double                                                                                                                    | number                                                      | `3.14159265`                                                                                       | | Float                                                                                                                     | number                                                      | `3.14159265`                                                                                       | | GeoPoint                                                                                                                  | geojson                                                     | `{"type":"Point","coordinates":[102.0,0.5]}`                                                       | | GeoShape                                                                                                                  | geojson                                                     | `{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]}`            | | Integer                                                                                                                   | number                                                      | `238940`                                                                                           | | Long                                                                                                                      | string                                                      | `"58319870951433"`                                                                                 | | [MediaReference](/docs/foundry/api/v2/ontologies-v2-resources/media-reference-properties/media-reference-property-basics/)| JSON encoded `MediaReference` object                        | `{"mimeType":"application/pdf","reference":{"type":"mediaSetViewItem","mediaSetViewItem":{"mediaSetRid":"ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642","mediaSetViewRid":"ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b","mediaItemRid":"ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225"}}}`                       | | Secured Property Value                                                                                                    | JSON encoded `SecuredPropertyValue` object                  | `{"value": 10, "propertySecurityIndex" : 5}`                                                       | | Short                                                                                                                     | number                                                      | `8739`                                                                                             | | String                                                                                                                    | string                                                      | `"Call me Ishmael"`                                                                                | | Struct                                                                                                                    | JSON object of struct field API name -> value               | {"firstName": "Alex", "lastName": "Karp"}                                                          | | Timestamp                                                                                                                 | ISO 8601 extended offset date-time string in UTC zone       | `"2021-01-04T05:00:00Z"`                                                                           | | [Timeseries](/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/time-series-property-basics/)            | JSON encoded `TimeseriesProperty` object or seriesId string | `{"seriesId": "wellPressureSeriesId", "syncRid": ri.time-series-catalog.main.sync.04f5ac1f-91bf-44f9-a51f-4f34e06e42df"}` or `{"templateRid": "ri.codex-emu.main.template.367cac64-e53b-4653-b111-f61856a63df9", "templateVersion": "0.0.0"}` or `"wellPressureSeriesId"`|                                                                           | | Vector                                                                                                                    | array                                                       | `[0.1, 0.3, 0.02, 0.05 , 0.8, 0.4]`                                                                | Note that for backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as JSON strings."
