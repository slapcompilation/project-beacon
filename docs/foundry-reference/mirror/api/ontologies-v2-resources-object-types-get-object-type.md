<!-- source: https://palantir.com/docs/foundry/api/ontologies-v2-resources/object-types/get-object-type/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Object Type

`GET /api/v2/ontologies/{ontology}/objectTypes/{objectType}`

Gets a specific object type with the given API name.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontology` · string · required
  "The API name or RID of the Ontology. To find the API name or RID, use the **List Ontologies** endpoint or check the **Ontology Manager**."
- `objectType` · string · required
  "The API name of the object type. To find the API name, use the **List object types** endpoint or check the **Ontology Manager**."

## Query parameters

- `branch` · string
  "The Foundry branch to load the object type definition from. If not specified, the default branch will be used. Branches are an experimental feature and not all workflows are supported."
- `includeDatasources` · boolean
  "When set to `true`, the `datasources` field on the returned object type is populated with the datasources backing it. Defaults to `false`."

## Response

- `ObjectTypeV2` · object · required
  "Success response."
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
