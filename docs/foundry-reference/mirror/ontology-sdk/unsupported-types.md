<!-- source: https://palantir.com/docs/foundry/ontology-sdk/unsupported-types/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Unsupported types in OSDK

The OSDK generates client-side code for TypeScript, Python, and Java packages; this code represents object types, action types, and functions from the Ontology. Not all data types are currently available in the OSDK; this page lists data types that are not yet supported.

## Object types: Unsupported property types

If you use an object type with a property of a type which is listed below, the code generator will skip that property and log the error.

### Typescript SDK

The following Typescript SDK property types are unsupported:

* `Cipher`
* `Marking`
* `Vectors`

### Python SDK

The following Python SDK property types are unsupported:

* `Cipher`
* `Marking`
* `Media`
* `Struct`
* `Vector`

### Java SDK

The following Java SDK property types are unsupported:

* `TimeSeries`
* `Cipher`
* `Vector`

## Action types: Unsupported parameter types

If you use an action type with a parameter of a type mentioned below, the code generator will be unable to create your package. To resolve this, you must remove that action type from the SDK application until support is added for that type.

### Python SDK

The following Python SDK parameter types are unsupported:

* `ObjectSet`
* `Marking`
* `MarkingList`

## Action types: Unsupported webhook types

Action types with [webhooks that use OAuth 2.0 for authentication](/docs/foundry/data-connection/webhooks-reference/#oauth-20-with-webhooks) are not supported. This is because users would be unable to use these action types through the SDK application without first authorizing the outbound application through Foundry (for instance, by first calling the action in a Workshop application).

## Functions: Unsupported input parameter types and output types

If you use a function with an input or an output of a type which is listed below, the code generator will fail to generate your package. To resolve this, you must remove that function from the SDK application until such support is added.

### Typescript SDK

#### Function output types

The following Typescript SDK function output types are unsupported:

* `Principal`
* `User`
* `Notification`
* `OntologyEdit`
* `ClassificationMarking`

### Python SDK

#### Function input parameter types

The following Python SDK function input types are unsupported:

* `ObjectSet`
* `AnonymousCustomType`
* `ClassificationMarking`
* `CustomType`
* `GeoShape`
* `Group`
* `MandatoryControl`
* `ModelGraph`
* `Notification`
* `OntologyEdit`
* `Principal`
* `Range`
* `StringFunctionDateType_ThreeDimensionalAggregation`
* `TimeSeries`
* `TwoDimensionalAggregation`
* `User`

#### Function output types

The following Python SDK function output types are unsupported:

* `ObjectSet`
* `AnonymousCustomType`
* `ClassificationMarking`
* `CustomType`
* `GeoShape`
* `Group`
* `MandatoryControl`
* `ModelGraph`
* `Notification`
* `OntologyEdit`
* `Principal`
* `Range`
* `StringFunctionDateType_ThreeDimensionalAggregation`
* `TimeSeries`
* `TwoDimensionalAggregation`
* `User`

### Java SDK

#### Function input parameter types

The following Java SDK function input types are unsupported:

* `AnonymousCustomType`
* `ClassificationMarking`
* `CustomType`
* `GeoShape`
* `Group`
* `MandatoryControl`
* `ModelGraph`
* `Notification`
* `OntologyEdit`
* `Principal`
* `Range`
* `StringFunctionDateType_ThreeDimensionalAggregation`
* `TimeSeries`
* `TwoDimensionalAggregation`
* `User`

#### Function output types

The following Java SDK function output types are unsupported:

* `AnonymousCustomType`
* `ClassificationMarking`
* `CustomType`
* `GeoShape`
* `Group`
* `MandatoryControl`
* `ModelGraph`
* `Notification`
* `OntologyEdit`
* `Principal`
* `Range`
* `StringFunctionDateType_ThreeDimensionalAggregation`
* `TimeSeries`
* `TwoDimensionalAggregation`
* `User`

## OpenAPI Specification

You can [export an OpenAPI specification from Developer Console](/docs/foundry/ontology-sdk/generate-osdk-for-other-languages/). OpenAPI supports the `any` type, so you can still use the specification even if some types are unsupported. However, you will need to define the format for those parameters manually.

The following types do not have first-class support in the OpenAPI specification and will be rendered as `any`:

* `Struct`
* `Vector`
