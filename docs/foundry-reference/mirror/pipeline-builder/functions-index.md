<!-- source: https://palantir.com/docs/foundry/pipeline-builder/functions-index/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Functions index

Pipeline Builder provides expressions that operate at different levels. They can generally be categorized as row level, aggregations or generators.

Row level functions operate on values from a single row. Most expressions fall in this category, for example `add`.

Aggregations aggregate multiple row values into one. For example the 'sum' expression.

Generators produce multiple values from a single row. For example the 'explode\_array' expression

Transforms are functions that operate on a whole table or multiple tables. For example the 'drop' transform.The following document will outline the available expressions and transforms.

## Row level expressions

***

### Absolute value

> Supported in: Batch, Faster, Streaming

Returns the absolute value.

**Expression categories:** Numeric

**Type variable bounds:** *T accepts Numeric*

**Output type:** *T*

#### Example

**Argument values:**

* **Expression:** `numeric_column`

| numeric\_column | **Output** |
| ----- | ----- |
| 0.0 | 0.0 |
| 1.1 | 1.1 |
| -1.1 | 1.1 |

[See details](/docs/foundry/pb-functions-expression/absV1/).

***

### Add numbers

> Supported in: Batch, Faster, Streaming

Calculates the sum of all input columns.

**Expression categories:** Numeric

**Output type:** *Numeric*

#### Example

**Argument values:**

* **Expressions:** \[`col_a`, `col_b`]

| col\_a | col\_b | **Output** |
| ----- | ----- | ----- |
| 0 | 1 | 1 |
| 3 | -2 | 1 |

[See details](/docs/foundry/pb-functions-expression/addV2/).

***

### Add or update map

> Supported in: Batch, Streaming

Updates a value by key in a map or adds new key value pair.

**Expression categories:** Map

**Type variable bounds:** *K accepts AnyType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

#### Example

**Argument values:**

* **Expression:** 4
* **Key:** k
* **Map:** `map_col`

| map\_col | **Output** |
| ----- | ----- |
| {<br> a -> 1,<br> b -> 2,<br> k -> 2,<br>} | {<br> a -> 1,<br> b -> 2,<br> k -> 4,<br>} |
| {<br> a -> 1,<br> b -> 2,<br>} | {<br> a -> 1,<br> b -> 2,<br> k -> 4,<br>} |

[See details](/docs/foundry/pb-functions-expression/addOrUpdateMapEntryV1/).

***

### Add or update struct field

> Supported in: Batch, Faster, Streaming

Updates a field of a struct or adds a new field.

**Expression categories:** Struct

**Output type:** *Struct*

#### Example

**Argument values:**

* **Expression:** `value`
* **Locator:** airline.id
* **Struct:** `struct`

| struct | value | **Output** |
| ----- | ----- | ----- |
| {<br> **airline**: {<br> **id**: NA,<br>},<br>} | 1 | {<br> **airline**: {<br> **id**: 1,<br>},<br>} |
| {<br> **airline**: {<br> **id**: FE,<br>},<br>} | 2 | {<br> **airline**: {<br> **id**: 2,<br>},<br>} |

[See details](/docs/foundry/pb-functions-expression/addOrUpdateStructFieldV1/).

***

### Add value to date

> Supported in: Batch, Faster, Streaming

Returns the date that is 'value' days/weeks/months/quarter/years after 'start'.

**Expression categories:** Datetime

**Output type:** *Date*

#### Example

**Argument values:**

* **Date:** 2022-02-01
* **Unit:** `DAYS`
* **Value:** 2

**Output:** 2022-02-03

[See details](/docs/foundry/pb-functions-expression/dateAddV2/).

***

### All array elements satisfy

> Supported in: Batch, Streaming

Return true if the expression is true for all elements in the array.

**Expression categories:** Array

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Array:** `miles`
* **Boolean condition:** <br>isNull(<br> expression: `element`,<br>)

| miles | **Output** |
| ----- | ----- |
| \[ 12300, *null* ] | false |
| \[ *null*, *null* ] | true |

[See details](/docs/foundry/pb-functions-expression/allArrayElementsSatisfyV1/).

***

### And

> Supported in: Batch, Faster, Streaming

Returns true if all of the specified conditions are true. Nulls are considered false.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Conditions:** \[`left_boolean`, `right_boolean`]

| left\_boolean | right\_boolean | **Output** |
| ----- | ----- | ----- |
| true | true | true |
| true | false | false |
| false | true | false |
| false | false | false |

[See details](/docs/foundry/pb-functions-expression/andV1/).

***

### Any array element satisfy

> Supported in: Batch, Streaming

Return true if the expression is true for any element in the array.

**Expression categories:** Array

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Array:** `miles`
* **Boolean condition:** <br>isNull(<br> expression: `element`,<br>)

| miles | **Output** |
| ----- | ----- |
| \[ 12300, *null* ] | true |
| \[ 12300, 12000 ] | false |

[See details](/docs/foundry/pb-functions-expression/anyArrayElementSatisfyV1/).

***

### Arccos

> Supported in: Batch, Faster, Streaming

Inverse cosine function.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Angle unit:** `radians`
* **Value:** 1.0

**Output:** 0.0

[See details](/docs/foundry/pb-functions-expression/arccosV1/).

***

### Arcsin

> Supported in: Batch, Faster, Streaming

Inverse sine function.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Angle unit:** `radians`
* **Value:** 0.0

**Output:** 0.0

[See details](/docs/foundry/pb-functions-expression/arcsinV1/).

***

### Arctan

> Supported in: Batch, Faster, Streaming

Inverse tangent function.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Angle unit:** `degrees`
* **Value:** `angle`

| angle | **Output** |
| ----- | ----- |
| -1.0 | -45.0 |
| 0.0 | 0.0 |
| 1.0 | 45.0 |

[See details](/docs/foundry/pb-functions-expression/arctanV1/).

***

### Arctan2

> Supported in: Batch, Faster, Streaming

Returns the angle θ between the ray from the origin to the point (x, y) and the positive x-axis, confined to −π<θ<=π.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Angle unit:** `degrees`
* **X:** `x`
* **Y:** `y`

| y | x | **Output** |
| ----- | ----- | ----- |
| 0.0 | 0.0 | 0.0 |
| 1.0 | 0.0 | 90.0 |
| 0.0 | -1.0 | 180.0 |
| -1.0 | 0.0 | -90.0 |

[See details](/docs/foundry/pb-functions-expression/arctan2V1/).

***

### Area

> Supported in: Batch, Streaming

Calculates area of a geometry in meters squared using a spherical approximation of the globe. For a line string or a point, this equals 0.

**Expression categories:** Geospatial

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/areaV1/).

***

### Array add

> Supported in: Batch, Faster, Streaming

Adds a value to the array at a specified index.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Array:** `numbers`
* **Index:** 1
* **Value:** 1

| numbers | **Output** |
| ----- | ----- |
| \[ 3, 5 ] | \[ 1, 3, 5 ] |
| \[ 2 ] | \[ 1, 2 ] |
| \[  ] | \[ 1 ] |

[See details](/docs/foundry/pb-functions-expression/arrayAddV1/).

***

### Array cartesian product

> Supported in: Batch, Streaming

Compute the cartesian product of arrays.

**Expression categories:** Array

**Output type:** *Array\<Struct>*

#### Example

**Argument values:**

* **Expression:** \[`first`, `second`]

| first | second | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2 ] | \[ 3, 4 ] | \[ {<br> **first**: 1,<br> **second**: 3,<br>}, {<br> **first**: 1,<br> \**second*... |

[See details](/docs/foundry/pb-functions-expression/arraysCartesianProductV1/).

***

### Array concat

> Supported in: Batch, Faster, Streaming

Concatenates the provided arrays into a single array, without de-duplication.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Expressions:** \[\[ 1, 2, 3 ], \[ 4, 5 ]]

**Output:** \[ 1, 2, 3, 4, 5 ]

[See details](/docs/foundry/pb-functions-expression/arrayConcatV1/).

***

### Array contains

> Supported in: Batch, Faster, Streaming

Returns true if the array contains the value.

**Expression categories:** Array, Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Array:** `part_ids`
* **Value:** BRR-123

| part\_ids | **Output** |
| ----- | ----- |
| \[ AWE-112, BRR-123 ] | true |
| \[ AWE-222, ABC-543 ] | false |

[See details](/docs/foundry/pb-functions-expression/arrayContainsV1/).

***

### Array contains null

> Supported in: Batch, Faster, Streaming

Returns true if the `array` contains null.

**Expression categories:** Array, Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| \[ AWE-112, BRR-123, *null* ] | true |
| \[ AWE-222, ABC-543 ] | false |

[See details](/docs/foundry/pb-functions-expression/arrayContainsNullV1/).

***

### Array difference

> Supported in: Batch, Faster, Streaming

Returns all unique elements in the `left` array that are not in the `right` array.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Left array:** \[ 1, 2, 3 ]
* **Right array:** \[ 2, 3, 4 ]

**Output:** \[ 1 ]

[See details](/docs/foundry/pb-functions-expression/arrayDifferenceV1/).

***

### Array distinct

> Supported in: Batch, Faster, Streaming

Removes duplicates and returns distinct values from the array.

**Expression categories:** Array

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Expression:** \[ 1, 1, 2, 3 ]

**Output:** \[ 1, 2, 3 ]

[See details](/docs/foundry/pb-functions-expression/arrayDistinctV1/).

***

### Array element

> Supported in: Batch, Faster, Streaming

Returns the element at a given position from the input array. Positions outside of the array will return `null`.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

#### Example

**Argument values:**

* **Array:** \[ 10, 11, 12 ]
* **Position:** 1

**Output:** 10

[See details](/docs/foundry/pb-functions-expression/arrayElementV1/).

***

### Array elements are distinct

> Supported in: Batch, Faster, Streaming

Returns true if the array's elements are distinct, false otherwise. If the array is null, the returned value is false.

**Expression categories:** Array, Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| \[ ABC-123, DCE-123, EFG-123 ] | true |
| \[ ABC-123, ABC-123, EFG-123 ] | false |

[See details](/docs/foundry/pb-functions-expression/isArrayUniqueV1/).

***

### Array flatten

> Supported in: Batch, Faster, Streaming

Creates a single array from an input nested array by unioning the elements within the first level of nesting.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[ \[ 1, 2, 3 ], \[ 4, 5, 6 ] ] | \[ 1, 2, 3, 4, 5, 6 ] |

[See details](/docs/foundry/pb-functions-expression/arrayFlattenV2/).

***

### Array intersect

> Supported in: Batch, Faster, Streaming

Removes duplicates and intersects a list of arrays.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Expressions:** \[\[ 1, 2, 3 ], \[ 3, 4 ]]

**Output:** \[ 3 ]

[See details](/docs/foundry/pb-functions-expression/arrayIntersectV1/).

***

### Array maximum

> Supported in: Batch, Faster, Streaming

Returns the maximum value of an array column.

**Expression categories:** Array

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *T*

#### Example

**Argument values:**

* **Expression:** \[ 1, 2, 3 ]

**Output:** 3

[See details](/docs/foundry/pb-functions-expression/arrayMaxV1/).

***

### Array minimum

> Supported in: Batch, Faster, Streaming

Returns the minimum value of an array column.

**Expression categories:** Array

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *T*

#### Example

**Argument values:**

* **Expression:** \[ 1, 2, 3 ]

**Output:** 1

[See details](/docs/foundry/pb-functions-expression/arrayMinV1/).

***

### Array position

> Supported in: Batch, Faster, Streaming

Returns a position/index of the first occurrence of the 'value' in a given array. Returns `null` when value is not found or when any of the arguments are `null`.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Long*

#### Example

**Argument values:**

* **Array:** \[ 10, 11, 12 ]
* **Value:** 10

**Output:** 1

[See details](/docs/foundry/pb-functions-expression/arrayPositionV1/).

***

### Array remove

> Supported in: Batch, Faster, Streaming

Returns an array after removing all provided 'value' from the given array.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Array:** \[ 1, 2, 3 ]
* **Value:** 1

**Output:** \[ 2, 3 ]

[See details](/docs/foundry/pb-functions-expression/arrayRemoveV1/).

***

### Array repeat

> Supported in: Batch, Faster, Streaming

Returns an array with the contents of `array` concatenated `value` times.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Array:** \[ 1, 2 ]
* **Value:** 2

**Output:** \[ 1, 2, 1, 2 ]

[See details](/docs/foundry/pb-functions-expression/arrayRepeatV1/).

***

### Array reverse

> Supported in: Batch, Faster, Streaming

Reverse the order of elements in 'array'.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Expression:** \[ 1, 2, 3 ]

**Output:** \[ 3, 2, 1 ]

[See details](/docs/foundry/pb-functions-expression/arrayReverseV1/).

***

### Array sort

> Supported in: Batch, Faster, Streaming

Returns a sorted array of the given input array. All null values are placed at the end of a descending array and at the front of an ascending array.

**Expression categories:** Array

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Direction:** `ASCENDING`
* **Expression:** \[ 5, 3, 6 ]

**Output:** \[ 3, 5, 6 ]

[See details](/docs/foundry/pb-functions-expression/arraySortV1/).

***

### Array sort by struct key

> Supported in: Batch, Streaming

Returns a sorted array of the given input array of structs sorted by the values of the given struct keys.

**Expression categories:** Array

**Output type:** *Array\<Struct>*

#### Example

**Argument values:**

* **Input array:** \[ {<br> **age**: 20,<br>}, {<br> **age**: 10,<br>}, {<br> **age**: 30,<br>} ]
* **Sort keys:** \[(age, `ASCENDING`)]

**Output:** \[ {<br> **age**: 10,<br>}, {<br> **age**: 20,<br>}, {<br> **age**: 30,<br>} ]

[See details](/docs/foundry/pb-functions-expression/arraySortByKeyV2/).

***

### Array union

> Supported in: Batch, Faster, Streaming

Removes duplicates and unions a list of arrays.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Expressions:** \[\[ 1, 2, 3 ], \[ 3, 4 ]]

**Output:** \[ 1, 2, 3, 4 ]

[See details](/docs/foundry/pb-functions-expression/arrayUnionV1/).

***

### Arrays have intersection

> Supported in: Batch, Faster, Streaming

Checks if given arrays have at least one shared element.

**Expression categories:** Array, Boolean

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expressions:** \[\[ 1, 2, 3 ], \[ 3, 4 ]]

**Output:** true

[See details](/docs/foundry/pb-functions-expression/arraysHaveIntersectionV1/).

***

### Arrays zip

> Supported in: Batch, Faster, Streaming

Zips a list of given arrays into a merged array of structs in which the n-th struct contains all n-th values of input arrays.

**Expression categories:** Array

**Output type:** *Array\<Struct>*

#### Example

**Argument values:**

* **Expressions:** \[`first_array`, `second_array`]

| first\_array | second\_array | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | \[ 4, 5, 6 ] | \[ {<br> **first\_array**: 1,<br> **second\_array**: 4,<br>}, {<br> **first\_array**: 2,<... |

[See details](/docs/foundry/pb-functions-expression/arraysZipV1/).

***

### Base 64 decode to string

> Supported in: Batch, Faster, Streaming

Base64 decode the given expression. Uses utf-8 encoding for binary.

**Expression categories:** Binary, Cast, String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `encoded`

| encoded | **Output** |
| ----- | ----- |
| Zm9v | foo |
| YmFy | bar |

[See details](/docs/foundry/pb-functions-expression/base64DecodeToStringV1/).

***

### Base64 decode

> Supported in: Batch, Faster, Streaming

Base64 decode the given expression.

**Expression categories:** Binary, Cast

**Output type:** *Binary*

#### Example

**Argument values:**

* **Expression:** `city_base64`

| city\_base64 | **Output** |
| ----- | ----- |
| TG9uZG9u | TG9uZG9u |
| Q29wZW5oYWdlbg== | Q29wZW5oYWdlbg== |
| TmV3IFlvcms= | TmV3IFlvcms= |

[See details](/docs/foundry/pb-functions-expression/base64DecodeV1/).

***

### Base64 encode

> Supported in: Batch, Faster, Streaming

Base64 encode the given expression.

**Expression categories:** Binary, Cast

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `city`

| city | **Output** |
| ----- | ----- |
| London | TG9uZG9u |
| Copenhagen | Q29wZW5oYWdlbg== |
| New York | TmV3IFlvcms= |

[See details](/docs/foundry/pb-functions-expression/base64EncodeV1/).

***

### Bit shift left

> Supported in: Batch, Streaming

Shift the given value a number of bits left.

**Expression categories:** Binary

**Type variable bounds:** *E accepts Byte | Integer | Long | Short*

**Output type:** *E*

#### Example

**Argument values:**

* **Expression:** 1
* **Number of bits:** 1

**Output:** 2

[See details](/docs/foundry/pb-functions-expression/bitShiftLeftV1/).

***

### Bit shift right

> Supported in: Batch, Streaming

Shift the given value a number of bits right.

**Expression categories:** Binary

**Type variable bounds:** *E accepts Byte | Integer | Long | Short*

**Output type:** *E*

#### Example

**Argument values:**

* **Expression:** 1
* **Number of bits:** 1

**Output:** 0

[See details](/docs/foundry/pb-functions-expression/bitShiftRightV1/).

***

### Buffer H3 indices

> Supported in: Batch, Faster, Streaming

Creates a buffer of distance k from an array of H3 indices.

**Expression categories:** Geospatial

**Output type:** *Array\<H3 Index>*

[See details](/docs/foundry/pb-functions-expression/h3BufferV1/).

***

### Calculate destination point

> Supported in: Batch, Faster, Streaming

Calculates the destination point along a specified path given a starting point, course, and distance.

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

#### Example

**Argument values:**

* **Course:** `course`
* **Distance:** `distance`
* **Starting point:** `point_a`
* **Calculation method:** `GREAT_CIRCLE`

| point\_a | course | distance | **Output** |
| ----- | ----- | ----- | ----- |
| {<br> **latitude**: 48.8567,<br> **longitude**: 2.3508,<br>} | 225.0 | 32000.0 | {<br> **latitude**: 48.65279552300661,<br> **longitude**: 2.0427666779658806,<br>} |

[See details](/docs/foundry/pb-functions-expression/inverseHaversineV1/).

***

### Calculate haversine distance

> Supported in: Batch, Faster, Streaming

Calculates the haversine distance between two latitude and longitude point pairs in meters.

**Expression categories:** Geospatial

**Output type:** *Double*

#### Example

**Argument values:**

* **Point a:** `point_a`
* **Point b:** `point_b`

| point\_a | point\_b | **Output** |
| ----- | ----- | ----- |
| {<br> **latitude**: 41.507483,<br> **longitude**: -99.436554,<br>} | {<br> **latitude**: 38.504048,<br> **longitude**: -98.315949,<br>} | 347328.82778977347 |
| {<br> **latitude**: 22.308919,<br> **longitude**: 113.914603,<br>} | {<br> **latitude**: -33.946111,<br> **longitude**: 151.177222,<br>} | 7393894.00134442 |

[See details](/docs/foundry/pb-functions-expression/haversineV1/).

***

### Case

> Supported in: Batch, Faster, Streaming

Choose between different branches based on conditions.

**Expression categories:** Popular

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

#### Example

**Argument values:**

* **Default:** Yes
* **Branches:** \[(<br>lessThan(<br> left: `miles`,<br> right: 15000,<br>), No)]

| miles | **Output** |
| ----- | ----- |
| 20053 | Yes |
| 10210 | No |
| 34120 | Yes |

[See details](/docs/foundry/pb-functions-expression/caseV2/).

***

### Cast

> Supported in: Batch, Faster, Streaming

Cast expression to given type.

**Expression categories:** Cast, Popular

**Type variable bounds:** *C accepts AnyType*

**Output type:** *C*

#### Example

**Description:** Casting long to string

**Argument values:**

* **Expression:** 1234
* **Type:** String

**Output:** 1234

[See details](/docs/foundry/pb-functions-expression/castV2/).

***

### Cast media schema

> Supported in:

Casts a media reference to a specific media schema and format. This is useful when the input media has a generic schema (multimodal) but the actual content is known to be a specific type (such as a png image). The cast narrows the type metadata to allow downstream operations that require specific schema types.

**Expression categories:** Media

**Output type:** *Media reference*

[See details](/docs/foundry/pb-functions-expression/castMediaSchemaV1/).

***

### Ceil

> Supported in: Batch, Faster, Streaming

Returns ceil of a given fractional value.

**Expression categories:** Numeric

**Output type:** *Decimal | Long*

#### Example

**Argument values:**

* **Expression:** 10.123

**Output:** 11

[See details](/docs/foundry/pb-functions-expression/ceilV1/).

***

### Change timestamp time zone

> Supported in: Batch, Faster

Changes the time zone of a timestamp.

**Expression categories:** Datetime

**Output type:** *Timestamp*

#### Example

**Argument values:**

* **Output time zone:** America/Chicago
* **Timestamp:** 2020-04-28T05:09:00Z
* **Input time zone:** US/Eastern

**Output:** 2020-04-28T04:09:00Z

[See details](/docs/foundry/pb-functions-expression/changeTimestampTimeZoneV1/).

***

### Character-wise translate string

> Supported in: Batch, Faster, Streaming

Replaces individual characters from the input column that are found in the matching with the corresponding character in the replacement string. If the matching string is longer than the replacement string, characters at the end of the matching string will be dropped.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** translate
* **Matching string:** rnlt
* **Replacement string:** 123

**Output:** 1a2s3ae

[See details](/docs/foundry/pb-functions-expression/translateStringV1/).

***

### Chunk string

> Supported in: Batch, Streaming

Chunk string into chunks of a specified size and on specified separators.

**Expression categories:** String

**Output type:** *Array\<String>*

#### Example

**Argument values:**

* **Expression:** `string`
* **Chunk overlap:** *null*
* **Chunk size:** 10
* **Keep separator:** *null*
* **Separators:** *null*

| string | **Output** |
| ----- | ----- |
| hello | \[ hello ] |
| hello world. the quick brown fox jumps over the fence. | \[ hello, world., the quick, brown fox, jumps, over the, fence. ] |
| hello world.<br>the quick brown fox<br>jumps over the fence. | \[ hello, world., the quick, brown fox, jumps, over the, fence. ] |
| hello world.<br>the quick brown fox<br>jumps over the fence. | \[ hello, world., the quick, brown fox, jumps, over the, fence. ] |

[See details](/docs/foundry/pb-functions-expression/chunkStringV1/).

***

### Cipher decrypt

> Supported in: Batch, Faster, Streaming

Decrypts expression with cipher.

**Expression categories:** Other

**Output type:** *String*

#### Example

**Argument values:**

* **Cipher license rid:** ri.bellaso.main.cipher-license.1-decrypt
* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| CIPHER::ri.bellaso.main.cipher-channel.1::OCRBIW3iHDltOGa6MEHwb7f/Dw==::CIPHER | bar |

[See details](/docs/foundry/pb-functions-expression/cipherDecryptV1/).

***

### Cipher encrypt

> Supported in: Batch, Faster, Streaming

Encrypts expression with cipher.

**Expression categories:** Other

**Output type:** *Cipher Text*

#### Example

**Argument values:**

* **Cipher license rid:** ri.bellaso.main.cipher-license.1-encrypt
* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| bar | CIPHER::ri.bellaso.main.cipher-channel.1::OCRBIW3iHDltOGa6MEHwb7f/Dw==::CIPHER |

[See details](/docs/foundry/pb-functions-expression/cipherEncryptV1/).

***

### Cipher hash

> Supported in: Batch, Faster, Streaming

Hashes expression with cipher.

**Expression categories:** Other

**Output type:** *Cipher Text*

#### Example

**Argument values:**

* **Cipher license rid:** ri.bellaso.main.cipher-license.1-hash
* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| bar | CIPHER::ri.bellaso.main.cipher-channel.1::c70a14f5cc57c940e3265045a5554d641bd549ee27a571a05cdbc75c77762eb86b1144c12f1bb7811a0bcec08b2f143989c44022e4664f615d6885ad640332cb::CIPHER |

[See details](/docs/foundry/pb-functions-expression/cipherHashV1/).

***

### Clean string

> Supported in: Batch, Faster, Streaming

Applies the set of clean actions on the expression.

**Expression categories:** Data preparation, String

**Output type:** *String*

#### Example

**Argument values:**

* **Clean actions:** {`trim`}
* **Expression:**   hello world

**Output:** hello world

[See details](/docs/foundry/pb-functions-expression/cleanStringV1/).

***

### Compact a set of H3 indices

> Supported in: Batch, Faster, Streaming

Compact H3 indices into a subset of mixed resolutions if possible. Running the inverse operation uncompact is guaranteed to yield the same set of indices that were compacted if the input indices were all the same resolution. If any of the input indices are invalid this transform will return null. Output indices are sorted in ascending order.

**Expression categories:** Geospatial

**Output type:** *Array\<H3 Index>*

#### Example

**Argument values:**

* **H3 indices:** `h3_set`

| h3\_set | **Output** |
| ----- | ----- |
| \[ 87754a914ffffff, 87754a916ffffff, 87754a930ffffff, 87754a932ffffff, 87754a933ffffff, 87754a934ffff... | \[ 86754e64fffffff, 87754a914ffffff, 87754a916ffffff, 87754a930ffffff, 87754a932ffffff, 87754a933ffff... |

[See details](/docs/foundry/pb-functions-expression/compactH3SetV1/).

***

### Concatenate strings

> Supported in: Batch, Faster, Streaming

Concatenates a list of strings with the specified separator.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expressions:** \[hello, world]
* **Null output if any input is null:** *null*
* **Separator:** \_

**Output:** hello\_world

[See details](/docs/foundry/pb-functions-expression/concatStringsV1/).

***

### Construct delegated media Gotham identifier (GID)

> Supported in: Batch, Streaming

Expression to construct a valid delegated media Gotham identifier (GID) from components. If result is more than 1024 characters, produces a null row.

**Expression categories:** Other

**Output type:** *Delegated media Gotham identifier (GID)*

#### Example

**Argument values:**

* **Media locator:** `locator`
* **Media type:** `mediaType`
* **Producer instance:** invalidUuid

| mediaType | locator | **Output** |
| ----- | ----- | ----- |
| testaudiotype | *empty string* | *null* |

[See details](/docs/foundry/pb-functions-expression/constructDelegatedMediaGidV1/).

***

### Convert DMS to GeoPoint

> Supported in: Batch, Streaming

Converts a geospatial coordinate string in degrees, minutes, seconds (DMS) format to a GeoPoint in accordance to user-provided formats. The default formats are `DDD*°MM*'SS*"H` and `DDD*MMSSssH`. The formats are run in order, and the first matching format will be returned. See formatting guide on how to write user-generated formats.

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

#### Example

**Argument values:**

* **Coordinates:** `coordinates`
* **Formats:** *null*

| coordinates | **Output** |
| ----- | ----- |
| 078261594N075220923E | {<br> **latitude**: 78.43776111111112,<br> **longitude**: 75.36923055555555,<br>} |
| 046115095S069524119W | {<br> **latitude**: -46.19748611111111,<br> **longitude**: -69.87810833333333,<br>} |
| 023°45'55"N 069°52'11"W | {<br> **latitude**: 23.76527777777777,<br> **longitude**: -69.86972222222222,<br>} |
| -123°55'55"N 069°53'00"W | {<br> **latitude**: -123.93194444444445,<br> **longitude**: -69.88333333333334,<br>} |
| 123456789N23456789E | {<br> **latitude**: 123.76885833333333,<br> **longitude**: 23.768858333333334,<br>} |

[See details](/docs/foundry/pb-functions-expression/dmsToGeoPointV1/).

***

### Convert GeoPoint to DMS

> Supported in: Batch, Faster, Streaming

Converts a GeoPoint to a geospatial coordinate string in degrees, minutes, seconds (DMS) format in accordance with a user-chosen format. Possible formats are `DDD°MM'SS"H` and `DDDMMSSssH`.

**Expression categories:** Geospatial

**Output type:** *String*

[See details](/docs/foundry/pb-functions-expression/geoPointToDmsV1/).

***

### Convert GeoPoint to Geohash

> Supported in: Batch, Faster, Streaming

Converts a GeoPoint to a base32-encoded Geohash with specified precision that contains the GeoPoint. For more information on Geohash, see: https://en.wikipedia.org/wiki/Geohash .

**Expression categories:** Geospatial

**Output type:** *Geohash*

[See details](/docs/foundry/pb-functions-expression/geoPointToGeohashV1/).

***

### Convert GeoPoint to MGRS

> Supported in: Batch, Faster, Streaming

Converts a GeoPoint following the WGS84 coordinate system (which is EPSG:4326) to a MGRS (military grid reference system) coordinate. The output MGRS will follow a space-delimited format with 5 digits of precision.

**Expression categories:** Geospatial

**Output type:** *MGRS*

#### Example

**Argument values:**

* **Expression:** `geoPoint`

| geoPoint | **Output** |
| ----- | ----- |
| {<br> latitude -> 88.99999659707431,<br> longitude -> 0.9996456505181999,<br>} | Z AF 01937 88990 |

[See details](/docs/foundry/pb-functions-expression/geoPointToMgrsV1/).

***

### Convert GeoPoint to geometry

> Supported in: Batch, Faster, Streaming

Convert GeoPoint to a GeoJSON of type point.

**Expression categories:** Geospatial

**Output type:** *Geometry*

[See details](/docs/foundry/pb-functions-expression/geoPointToGeometryV1/).

***

### Convert H3 index to GeoPoint

> Supported in: Batch, Faster, Streaming

Convert an H3 index into the GeoPoint representing the center of the corresponding H3 hexagon.

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

[See details](/docs/foundry/pb-functions-expression/h3ToGeoPointV1/).

***

### Convert MGRS to GeoPoint

> Supported in: Batch, Faster, Streaming

Converts a MGRS (military grid reference system) coordinate into a GeoPoint following the WGS84 coordinate system (which is EPSG:4326).

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

#### Example

**Argument values:**

* **Expression:** `mgrs`

| mgrs | **Output** |
| ----- | ----- |
| ZAF0193788990 | {<br> **latitude**: 88.99999659707431,<br> **longitude**: 0.9996456505181999,<br>} |

[See details](/docs/foundry/pb-functions-expression/mgrsToGeoPointV1/).

***

### Convert a string to date

> Supported in: Batch, Faster, Streaming

Returns the date given a formatted string in accordance to the Java DateTimeFormatter. The default formats are `yyyy-MM-dd` and `yyyy-MM-dd'T'HH:mm:ss.SSSXXX`. The formats are run in order, the first matching format will be returned.

**Expression categories:** Cast, Datetime

**Output type:** *Date*

#### Example

**Description:** Date formats are optional

**Argument values:**

* **String:** 2020-04-28
* **Formats:** *null*

**Output:** 2020-04-28

[See details](/docs/foundry/pb-functions-expression/stringToDateV2/).

***

### Convert a string to timestamp

> Supported in: Batch, Faster, Streaming

Returns the timestamp given a formatted string in accordance to the Java DateTimeFormatter. The default formats are `yyyy-MM-dd'T'HH:mm:ss.SSSXXX` and `yyyy-MM-dd`. The formats are run in order, the first matching format will be returned.

**Expression categories:** Cast, Datetime

**Output type:** *Timestamp*

#### Example

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[dd-yyyy-MM HH\:mm:ss, yyyy-MM-dd]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 28-2020-04 10:09:00 | 2020-04-28T10:09:00Z |
| 2020-04-28 | 2020-04-28T00:00:00Z |

[See details](/docs/foundry/pb-functions-expression/stringToTimestampV2/).

***

### Convert base

> Supported in: Batch, Streaming

Convert a number (or it string representation) from one base to another.

**Expression categories:** Binary, Cast, Numeric

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** 4A801
* **From base:** 16
* **To base:** 10

**Output:** 305153

[See details](/docs/foundry/pb-functions-expression/convertBaseV1/).

***

### Convert between angle units

> Supported in: Batch, Faster, Streaming

**Expression categories:** Geospatial, Numeric

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/convertAngleV1/).

***

### Convert between distance units

> Supported in: Batch, Faster, Streaming

**Expression categories:** Numeric

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/convertDistanceV1/).

***

### Convert between time units

> Supported in: Batch, Faster, Streaming

**Expression categories:** Datetime

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/convertTimeV1/).

***

### Convert between weight units

> Supported in: Batch, Faster, Streaming

**Expression categories:** Numeric

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/convertWeightV1/).

***

### Convert data to JSON

> Supported in: Batch, Faster, Streaming

Transforms input into json string.

**Expression categories:** File, String

**Output type:** *String*

#### Example

**Argument values:**

* **Input:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **id**: NA,<br>},<br>} | {"airline":{"id":"NA"}} |

[See details](/docs/foundry/pb-functions-expression/jsonStringV2/).

***

### Convert from Ontology GeoPoint

> Supported in: Batch, Faster, Streaming

Convert an Ontology GeoPoint into a regular GeoPoint. Ontology GeoPoints are strings of the format '{lat},{lon}', where -90 <= lat <= 90 and -180 <= lon <= 180. Regular GeoPoints are structures of the format {"longitude": {long},"latitude": {lat}}.

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

#### Example

**Argument values:**

* **Expression:** `geopoint`

| geopoint | **Output** |
| ----- | ----- |
| -20.0000000,80.0000000 | {<br> **latitude**: -20.0,<br> **longitude**: 80.0,<br>} |
| 38.9031000,-77.0599000 | {<br> **latitude**: 38.9031,<br> **longitude**: -77.0599,<br>} |
| 41.9876543,-99.1234568 | {<br> **latitude**: 41.9876543,<br> **longitude**: -99.1234568,<br>} |

[See details](/docs/foundry/pb-functions-expression/ontologyGeopointToGeopointV1/).

***

### Convert from hexadecimal

> Supported in: Batch, Faster

Inverse of hex. Interprets each pair of characters as a hexadecimal number and converts to the byte representation of the number.

**Expression categories:** Numeric, String

**Output type:** *Binary*

#### Example

**Argument values:**

* **Expression:** `string_hex`

| string\_hex | **Output** |
| ----- | ----- |
| 68656C6C6F | aGVsbG8= |
| 3039 | MDk= |
| FFFFFFFFFFFFCFC7 | ////////z8c= |
| 4C6F6E646F6E | TG9uZG9u |

[See details](/docs/foundry/pb-functions-expression/UnhexV1/).

***

### Convert from hexadecimal to string

> Supported in: Batch, Faster, Streaming

Inverse of hex, interprets each pair of characters as a hexadecimal number and converts to the utf-8 string of the byte representation of the number.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `string_hex`

| string\_hex | **Output** |
| ----- | ----- |
| 68656C6C6F | hello |
| 4C6F6E646F6E | London |

[See details](/docs/foundry/pb-functions-expression/UnhexToStringV1/).

***

### Convert geocentric coordinates to WGS 84 geodesic coordinates

> Supported in: Batch, Streaming

Converts geocentric cartesian coordinates (also known as Earth-centered, Earth-fixed or ECEF coordinates) to geodesic polar coordinates. Altitude is defined as height-above-ellipsoid. If any coordinates are null, the output will be null.

**Expression categories:** Geospatial

**Output type:** *GeoPoint with altitude*

#### Example

**Argument values:**

* **X coordinate:** `x_coordinate`
* **Y coordinate:** `y_coordinate`
* **Z coordinate:** `z_coordinate`

| x\_coordinate | y\_coordinate | z\_coordinate | **Output** |
| ----- | ----- | ----- | ----- |
| 0.0 | 6378137.0 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> 90.0,<br>},<br>} |
| 0.0 | -6378137.0 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> -90.0,<br>},<br>} |
| -6378137.0 | 0.0 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> 180.0,<br>},<br>} |
| -6378137.0 | -0.0 | 0.0 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 0.0,<br> longitude -> -180.0,<br>},<br>} |
| 0.0 | 0.0 | 6356752.314245179 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> 90.0,<br> longitude -> 0.0,<br>},<br>} |
| 0.0 | 0.0 | -6356752.314245179 | {<br> altitude -> 0.0,<br> geoPoint -> {<br> latitude -> -90.0,<br> longitude -> 0.0,<br>},<br>} |

[See details](/docs/foundry/pb-functions-expression/GeocentricToGeodesicV1/).

***

### Convert legacy OffsetDateTime

> Supported in: Batch

Converts a legacy OffsetDateTime column to a timestamp that can be used in all Foundry pipelines. The timestamp is returned in UTC.

**Expression categories:** Datetime

**Output type:** *Timestamp*

[See details](/docs/foundry/pb-functions-expression/convertLegacyOffsetDateTimeV1/).

***

### Convert linestring to polygon

> Supported in: Batch, Faster, Streaming

Convert a linestring geometry to a polygon geometry. This expression assumes the linestring geometry is closed. If not, the expression will return null.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Expression:** `polygon_points`

| polygon\_points | **Output** |
| ----- | ----- |
| {"type":"LineString","coordinates":\[\[-77.49,38.01],\[-77.47,38.15],\[-77.19,38.14],\[-77.49,38.01]]} | {"type":"Polygon","coordinates":\[\[\[-77.49,38.01],\[-77.47,38.15],\[-77.19,38.14],\[-77.49,38.01]]]} |

[See details](/docs/foundry/pb-functions-expression/linestringToPolygonV1/).

***

### Convert timestamp from UTC

> Supported in: Batch, Faster, Streaming

Converts a timestamp from UTC to a given time zone.

**Expression categories:** Datetime

**Output type:** *Timestamp*

#### Example

**Argument values:**

* **Time zone:** EST
* **Timestamp:** 2020-04-28T10:09:00Z

**Output:** 2020-04-28T05:09:00Z

[See details](/docs/foundry/pb-functions-expression/timestampFromUtcV1/).

***

### Convert timestamp to UTC

> Supported in: Batch, Faster, Streaming

Converts a timestamp to UTC based on a given time zone.

**Expression categories:** Datetime

**Output type:** *Timestamp*

#### Example

**Argument values:**

* **Time zone:** EST
* **Timestamp:** 2020-04-28T10:09:00Z

**Output:** 2020-04-28T15:09:00Z

[See details](/docs/foundry/pb-functions-expression/timestampToUtcV1/).

***

### Convert to Ontology GeoPoint

> Supported in: Batch, Faster, Streaming

Convert a GeoPoint into a string that the Ontology will accept for a geo-indexed column (a geohash type column). Ontology GeoPoints are strings of the format '{lat},{lon}', where -90 <= lat <= 90 and -180 <= lon <= 180.

**Expression categories:** Geospatial

**Output type:** *Ontology GeoPoint*

#### Example

**Argument values:**

* **Expression:** `point`

| point | **Output** |
| ----- | ----- |
| {<br> **latitude**: -20.0,<br> **longitude**: 80.0,<br>} | -20.0000000,80.0000000 |
| {<br> **latitude**: 38.9031,<br> **longitude**: -77.0599,<br>} | 38.9031000,-77.0599000 |
| {<br> **latitude**: 41.987654321,<br> **longitude**: -99.123456789,<br>} | 41.9876543,-99.1234568 |
| *null* | *null* |

[See details](/docs/foundry/pb-functions-expression/createOntologyGeopointV1/).

***

### Convert to hexadecimal

> Supported in: Batch, Faster, Streaming

Computes hex value of given expression.

**Expression categories:** Numeric, String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `city_hex`

| city\_hex | **Output** |
| ----- | ----- |
| TG9uZG9u | 4C6F6E646F6E |

[See details](/docs/foundry/pb-functions-expression/HexV1/).

***

### Convert to octal

> Supported in: Batch, Faster, Streaming

Computes octal value of given expression.

**Expression categories:** Numeric

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** 12345

**Output:** 30071

[See details](/docs/foundry/pb-functions-expression/octalV1/).

***

### Cosine

> Supported in: Batch, Faster, Streaming

Takes the cosine of an angle.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Angle unit:** `degrees`
* **Angle value:** `angle`

| angle | **Output** |
| ----- | ----- |
| 0.0 | 1.0 |
| 90.0 | 0.0 |
| 180.0 | -1.0 |

[See details](/docs/foundry/pb-functions-expression/cosineV1/).

***

### Create GeoPoint

> Supported in: Batch, Faster, Streaming

Creates a GeoPoint column from a latitude and longitude column. Validates that the latitude parameter is between -90 and 90, inclusive, and that the longitude parameter is between -180 and 180, inclusive; if not, returns a null value.

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

[See details](/docs/foundry/pb-functions-expression/constructGeoPointV1/).

***

### Create GeoPoint from coordinate system

> Supported in: Batch, Streaming

Takes a pair of coordinates from a source coordinate system and transforms them into WGS 84 latitude/longitude values. Coordinate systems (also know as coordinate reference systems or spatial reference systems) represent different systems for identifying the location of a point on the globe and are often identified by key in standardized databases such as EPSG. If the given projection is not supported or either coordinate is null, returns null. This expression is for advanced users. It is recommended to use the "Create GeoPoint" expression if you do not need to deal with coordinate systems.

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

#### Example

**Argument values:**

* **Source coordinate system:** EPSG:32618
* **X coordinate:** `x_coordinate`
* **Y coordinate:** `y_coordinate`

| x\_coordinate | y\_coordinate | **Output** |
| ----- | ----- | ----- |
| 322190.2233952965 | 4306505.703879281 | {<br> latitude -> 38.88944258,<br> longitude -> -77.05014581,<br>} |
| 323243.1361536059 | 4318298.06539618 | {<br> latitude -> 38.99585379643137,<br> longitude -> -77.04105678275415,<br>} |
| 407063.63465300016 | 4764873.719585404 | {<br> latitude -> 43.03086518778498,<br> longitude -> -76.14077251822197,<br>} |

[See details](/docs/foundry/pb-functions-expression/createGeoPointFromCoordinateSystemV1/).

***

### Create an empty array

> Supported in: Batch, Faster, Streaming

Returns an empty array of the given type.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Type:** String

**Output:** \[  ]

[See details](/docs/foundry/pb-functions-expression/createEmptyArrayV1/).

***

### Create array

> Supported in: Batch, Faster, Streaming

Creates an array from the columns provided.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Expressions:** \[1, 2, 3]

**Output:** \[ 1, 2, 3 ]

[See details](/docs/foundry/pb-functions-expression/createArrayV1/).

***

### Create ellipse geometry

> Supported in: Batch, Streaming

Approximates an ellipse as a polygon centered at the given geo coordinate. The distance between points is computed along the surface of the WGS84 ellipsoid approximating the surface of the earth.

**Expression categories:** Geospatial

**Output type:** *Geometry*

[See details](/docs/foundry/pb-functions-expression/createGeoEllipseGeometryV1/).

***

### Create geodesic line string

> Supported in: Batch, Streaming

Creates a geodesic line between two points.

**Expression categories:** Geospatial

**Output type:** *Geometry*

[See details](/docs/foundry/pb-functions-expression/createGeodesicLineStringV1/).

***

### Create geotemporal series reference

> Supported in: Batch, Streaming

Generate the required values for a geotemporal series reference object property type, which consists of a reference to a series of geotemporal observations and the RID to the geotemporal series integration that contains the series.

**Expression categories:** Geospatial, Other, String

**Output type:** *Geotemporal series reference*

[See details](/docs/foundry/pb-functions-expression/constructGeotemporalSeriesReferenceV1/).

***

### Create linestring geometry

> Supported in: Batch, Streaming

Creates a GeoJSON linestring geometry from the given points.

**Expression categories:** Geospatial

**Type variable bounds:** *T accepts Struct\<longitude:Double, latitude:Double>*

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Points:** `points`

| points | **Output** |
| ----- | ----- |
| \[ {<br> **latitude**: 10.0,<br> **longitude**: 0.0,<br>}, {<br> **latitude**: 10.0,<br> **longitude**: 10.0,<br>} ] | {"type":"LineString","coordinates":\[\[0.0,10.0],\[10.0,10.0]]} |
| \[ {<br> **latitude**: 10.0,<br> **longitude**: 10.0,<br>}, {<br> **latitude**: 20.0,<... | {"type":"LineString","coordinates":\[\[10.0,10.0],\[20.0,20.0],\[30.0,30.0]]} |
| \[ {<br> **latitude**: 0.0,<br> **longitude**: 179.0,<br>}, {<br> **latitude**: 0.0,<br> **longitude**: 181.0,<br>} ] | {"type":"MultiLineString","coordinates":\[\[\[179.0,0.0],\[180.0,0.0]],\[\[-180.0,0.0],\[-179.0,0.0]]]} |
| \[ {<br> **latitude**: 0.0,<br> **longitude**: -179.0,<br>}, {<br> **latitude**: 0.0,<br> **longitude**: -181.0,<br>} ] | {"type":"MultiLineString","coordinates":\[\[\[180.0,0.0],\[179.0,0.0]],\[\[-179.0,0.0],\[-180.0,0.0]]]} |

[See details](/docs/foundry/pb-functions-expression/createGeoLineStringV1/).

***

### Create map from arrays

> Supported in: Batch, Faster, Streaming

Returns a map using key-value pairs from the zipped arrays. Null values are not allowed as keys and will cause a runtime error.

**Expression categories:** Array, Map

**Type variable bounds:** *K accepts AnyType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

#### Example

**Argument values:**

* **Array of keys:** \[ 1, 2, 3 ]
* **Array of values:** \[ 4, 5, 6 ]

**Output:** {<br> 1 -> 4,<br> 2 -> 5,<br> 3 -> 6,<br>}

[See details](/docs/foundry/pb-functions-expression/mapFromArraysV1/).

***

### Create null value

> Supported in: Batch, Faster, Streaming

Returns a null value of the given type.

**Expression categories:** Data preparation

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

#### Example

**Argument values:**

* **Type:** String

**Output:** *null*

[See details](/docs/foundry/pb-functions-expression/createNullValueV1/).

***

### Create range fan geometry

> Supported in: Batch, Streaming

Approximates a range fan as a polygon, specifying the region of all points whose haversine distance to the origin point is between the minimum and maximum radii, and to which the bearing from the origin is contained with the angular range centered around the specified bearing parameter. The left and right sides of the range fan are drawn as geodesic lines computed along the surface of the WGS84 ellipsoid approximating the surface of the earth. Returns null if the range spans more than 180 degrees while also crossing the anti-meridian, or if the maximum radius spans more than half of the circumference of the earth.

**Expression categories:** Geospatial

**Output type:** *Geometry*

[See details](/docs/foundry/pb-functions-expression/createGeoRangeFanGeometryV1/).

***

### Create struct column

> Supported in: Batch, Faster, Streaming

Combines multiple columns into a single structured column.

**Expression categories:** Struct

**Output type:** *Struct*

#### Example

**Argument values:**

* **Struct elements:** \[`tail_number`, `id`]

| tail\_number | id | **Output** |
| ----- | ----- | ----- |
| MT-112 | 1 | {<br> **id**: 1,<br> **tail\_number**: MT-112,<br>} |
| XB-123 | 2 | {<br> **id**: 2,<br> **tail\_number**: XB-123,<br>} |
| PA-654 | 3 | {<br> **id**: 3,<br> **tail\_number**: PA-654,<br>} |

[See details](/docs/foundry/pb-functions-expression/createStructV2/).

***

### Create time series reference values

> Supported in: Batch, Streaming

Creates time series reference values.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Series identifier:** `seriesId`
* **Time series sync RID:** ri.time-series-catalog.main.sync.11111111

| seriesId | **Output** |
| ----- | ----- |
| seriesOne | {"seriesId":"seriesOne","syncRid":"ri.time-series-catalog.main.sync.11111111"} |

[See details](/docs/foundry/pb-functions-expression/createQualifiedTimeSeriesIdV1/).

***

### Current date

> Supported in: Batch, Faster, Streaming

Returns the current date of when computation started.

**Expression categories:** Datetime

**Output type:** *Date*

[See details](/docs/foundry/pb-functions-expression/currentDateV1/).

***

### Current timestamp

> Supported in: Batch, Faster, Streaming

Returns the current timestamp when computation started.

**Expression categories:** Datetime

**Output type:** *Timestamp*

[See details](/docs/foundry/pb-functions-expression/currentTimestampV2/).

***

### Date sequence

> Supported in: Batch, Faster

Creates an array with dates in range from start to end.

**Expression categories:** Datetime

**Output type:** *Array\<Date>*

#### Example

**Argument values:**

* **End date:** `last_planned_flight`
* **Start date:** `first_planned_flight`
* **Step unit:** `DAYS`
* **Step size:** *null*

| first\_planned\_flight | last\_planned\_flight | **Output** |
| ----- | ----- | ----- |
| 2023-01-01 | 2023-01-03 | \[ 2023-01-01, 2023-01-02, 2023-01-03 ] |
| 2023-01-31 | 2023-02-02 | \[ 2023-01-31, 2023-02-01, 2023-02-02 ] |
| 2023-02-28 | 2023-03-01 | \[ 2023-02-28, 2023-03-01 ] |

[See details](/docs/foundry/pb-functions-expression/dateSequenceV1/).

***

### Decode

> Supported in: Batch, Faster, Streaming

Decode the given expression using the specified charset.

**Expression categories:** Binary, Cast

**Output type:** *String*

#### Example

**Argument values:**

* **Charset:** `UTF_16`
* **Expression:** `city`

| city | **Output** |
| ----- | ----- |
| /v8ATABvAG4AZABvAG4= | London |
| /v8AQwBvAHAAZQBuAGgAYQBnAGUAbg== | Copenhagen |
| /v8ATgBlAHcAIABZAG8AcgBr | New York |

[See details](/docs/foundry/pb-functions-expression/decodeV1/).

***

### Decode Geobuf as GeoJSON

> Supported in: Batch, Streaming

Decode Geobuf geometry as GeoJSON.

**Expression categories:** Geospatial

**Output type:** *Geometry*

[See details](/docs/foundry/pb-functions-expression/geobufToGeometryExpressionV1/).

***

### Divide numbers

> Supported in: Batch, Faster, Streaming

Divide one number by another number.

**Expression categories:** Numeric

**Output type:** *Decimal | Double*

#### Example

**Argument values:**

* **Left:** `col_a`
* **Right:** `col_b`

| col\_a | col\_b | **Output** |
| ----- | ----- | ----- |
| 4 | 2 | 2.0 |
| 11 | 2 | 5.5 |

[See details](/docs/foundry/pb-functions-expression/divideV1/).

***

### Edit distance

> Supported in: Batch, Faster, Streaming

Compute the edit distance between two strings. Supports Levenshtein, indel, and Damerau-Levenshtein distance.

**Expression categories:** Distance measurement, String

**Output type:** *Double | Integer*

#### Example

**Description:** String edit distance calculated using Levenshtein distance

**Argument values:**

* **Distance function:** `levenshtein`
* **Ignore case:** false
* **Left:** `left`
* **Right:** `right`
* **Normalize distance:** false

| left | right | **Output** |
| ----- | ----- | ----- |
| hello | hello | 0 |
| hallo | hello | 1 |
| hlelo | hello | 2 |
| hello | hEllO | 2 |
| hello | hello, world! | 8 |
| hello | farewell | 6 |

[See details](/docs/foundry/pb-functions-expression/levenshteinDistanceV2/).

***

### Encode GeoJSON as Geobuf

> Supported in: Batch, Faster, Streaming

Encodes GeoJSON geometry as Geobuf.

**Expression categories:** Geospatial

**Output type:** *Geobuf*

[See details](/docs/foundry/pb-functions-expression/geometryToGeobufExpressionV1/).

***

### Ends with

> Supported in: Batch, Faster, Streaming

**Expression categories:** Boolean, String

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** Hello World
* **Ignore case:** true
* **Value:** world

**Output:** true

[See details](/docs/foundry/pb-functions-expression/endsWithV1/).

***

### Epoch milliseconds to date

> Supported in: Batch, Faster, Streaming

Converts from epoch milliseconds to date, UTC.

**Expression categories:** Cast, Datetime

**Output type:** *Date*

#### Example

**Description:** You can convert epoch timestamps in milliseconds to the date type

**Argument values:**

* **Expression:** 1673964111000

**Output:** 2023-01-17

[See details](/docs/foundry/pb-functions-expression/epochMillisToDateV1/).

***

### Epoch milliseconds to timestamp

> Supported in: Batch, Faster, Streaming

Converts from epoch milliseconds to timestamp in UTC.

**Expression categories:** Cast, Datetime

**Output type:** *Timestamp*

#### Example

**Description:** You can convert epoch timestamps in milliseconds to the timestamp type

**Argument values:**

* **Expression:** 1673964111000

**Output:** 2023-01-17T14:01:51Z

[See details](/docs/foundry/pb-functions-expression/epochMillisToTimestampV1/).

***

### Epoch seconds to date

> Supported in: Batch, Faster, Streaming

Converts from epoch seconds to date in UTC.

**Expression categories:** Cast, Datetime

**Output type:** *Date*

#### Example

**Description:** You can convert epoch timestamps to the date type

**Argument values:**

* **Expression:** 1673964111

**Output:** 2023-01-17

[See details](/docs/foundry/pb-functions-expression/epochSecondsToDateV1/).

***

### Epoch seconds to timestamp

> Supported in: Batch, Faster, Streaming

Converts from epoch seconds to timestamp in UTC.

**Expression categories:** Cast, Datetime

**Output type:** *Timestamp*

#### Example

**Description:** You can convert epoch timestamps to the timestamp type

**Argument values:**

* **Expression:** 1673964111

**Output:** 2023-01-17T14:01:51Z

[See details](/docs/foundry/pb-functions-expression/epochSecondsToTimestampV1/).

***

### Equals

> Supported in: Batch, Faster, Streaming

Returns true if left and right are equal.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Left:** `a`
* **Right:** `b`

| a | b | **Output** |
| ----- | ----- | ----- |
| 1 | 1 | true |
| 1 | 0 | false |

[See details](/docs/foundry/pb-functions-expression/equalsV1/).

***

### Exponential

> Supported in: Batch, Faster, Streaming

Calculates the exponential, e^x, of a column.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Expression:** 2.0

**Output:** 7.38905609893

[See details](/docs/foundry/pb-functions-expression/exponentialV1/).

***

### Extract all regex matches

> Supported in: Batch, Faster, Streaming

Extract all instances of a regex match into an array.

**Expression categories:** Regex, String

**Output type:** *Array\<String>*

#### Example

**Description:** Extract the first two initials from each code.

**Argument values:**

* **Expression:** MT-112, XB-967
* **Group:** 1
* **Pattern:** (\w\w)(-)

**Output:** \[ MT, XB ]

[See details](/docs/foundry/pb-functions-expression/regexExtractAllV1/).

***

### Extract audio metadata

> Supported in: Batch

Extracts metadata fields from an audio file.

**Expression categories:** Media

**Output type:** *Struct*

#### Example

**Argument values:**

* **Media reference:** `Media Reference`
* **Metadata to include:** \[`Format`, `Specification`, `Bytes`]

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"audio","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | {<br> **bytes**: 156700,<br> **format**: audio,<br> **specification**: {<br> \*\*b... |

[See details](/docs/foundry/pb-functions-expression/getAudioMetadataV1/).

***

### Extract content from spreadsheets in JSON

> Supported in: Batch

Extract content from all sheets a spreadsheet in JSON format.

**Expression categories:** Media

**Output type:** *Map\<String, Struct>*

[See details](/docs/foundry/pb-functions-expression/spreadsheetJsonExtractionV1/).

***

### Extract date part

> Supported in: Batch, Faster, Streaming

Extracts a part of a date like year or day of week.

**Expression categories:** Datetime

**Output type:** *Integer*

[See details](/docs/foundry/pb-functions-expression/datePartV1/).

***

### Extract document metadata

> Supported in: Batch, Faster

Extracts metadata fields from a document.

**Expression categories:** Media

**Output type:** *Struct*

#### Example

**Argument values:**

* **Media reference:** `Media Reference`
* **Metadata to include:** \[`Document Author`, `Page Count`, `Document Title`]

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | {<br> **author**: Jane Doe,<br> **page\_count**: 23,<br> **title**: Document Title,<br>} |

[See details](/docs/foundry/pb-functions-expression/getDocumentMetadataV1/).

***

### Extract email body

> Supported in: Batch

Extracts the email body from an email media item as either plain text or html.

**Expression categories:** Media

**Output type:** *String*

[See details](/docs/foundry/pb-functions-expression/extractEmailBodyV1/).

***

### Extract imagery metadata

> Supported in: Batch, Streaming

Extracts metadata fields from an image.

**Expression categories:** Media

**Output type:** *Struct*

#### Example

**Argument values:**

* **Media reference:** `Media Reference`
* **Metadata to include:** \[`Attributes`, `Bands`, `Bytes`, `Dimensions`, `Format`, `Geographic Metadata`, `ICC Profile`, `EXIF Image Location`]

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"image/tiff","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | {<br> **attributes**: {<br> outer\_key1 -> {<br> inner\_key1 -> inner\_value1,<br>},<br>... |

[See details](/docs/foundry/pb-functions-expression/getImageryMetadataV1/).

***

### Extract layout-aware content from PDF

> Supported in: Batch, Faster

Extracts content from the specified document, while preserving the document's layout.

**Expression categories:** Media

**Output type:** *Array\<Array\<Struct\<block\_index:Integer, block\_id:String, page:Integer, block\_type:String, content:String, bounding\_box:String, languages:Array\<String>, confidence:Double>>> | Array\<String>*

[See details](/docs/foundry/pb-functions-expression/pdfLayoutAwareContentExtractionV1/).

***

### Extract layout-aware content from images

> Supported in: Batch, Faster

Extracts content from images, while preserving the original layout.

**Expression categories:** Media

**Output type:** *Array\<Struct\<block\_index:Integer, block\_id:String, block\_type:String, content:String, bounding\_box:String, languages:Array\<String>, confidence:Double>> | String*

[See details](/docs/foundry/pb-functions-expression/imageLayoutAwareContentExtractionV1/).

***

### Extract map keys

> Supported in: Batch, Faster, Streaming

Return map keys as an array. Note the order of array elements is not deterministic.

**Expression categories:** Map

**Type variable bounds:** *K accepts AnyType*

**Output type:** *Array\<K>*

#### Example

**Argument values:**

* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> MT-111 -> 2,<br> XB-134 -> 1,<br>} | \[ XB-134, MT-111 ] |

[See details](/docs/foundry/pb-functions-expression/extractMapKeysV1/).

***

### Extract map values

> Supported in: Batch, Faster, Streaming

Return map values as an array. Note the order of array elements is not deterministic.

**Expression categories:** Map

**Type variable bounds:** *V accepts AnyType*

**Output type:** *Array\<V>*

#### Example

**Argument values:**

* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> MT-111 -> 2,<br> XB-134 -> 1,<br>} | \[ 1, 2 ] |

[See details](/docs/foundry/pb-functions-expression/extractMapValuesV1/).

***

### Extract offset from legacy OffsetDateTime

> Supported in: Batch

Extracts the offset from a legacy OffsetDateTime column. This is the offset in seconds of the origin timezone of the timestamp from UTC timezone.

**Expression categories:** Datetime

**Output type:** *Integer*

#### Example

**Argument values:**

* **Expression:** `col_a`

| col\_a | **Output** |
| ----- | ----- |
| {<br> **offset**: 0,<br> **timestamp**: 2024-09-09T09:00:00.001Z,<br>} | 0 |
| {<br> **offset**: 19800,<br> **timestamp**: 2024-09-09T09:00:00.001Z,<br>} | 19800 |
| {<br> **offset**: -3600,<br> **timestamp**: 2024-09-09T09:00:00.001Z,<br>} | -3600 |

[See details](/docs/foundry/pb-functions-expression/extractOffsetFromLegacyOffsetDateTimeV1/).

***

### Extract table of contents from PDF

> Supported in: Batch, Faster

Produces a table of contents from a PDF based on the headings used within the document.

**Expression categories:** Media

**Output type:** *Array\<Struct\<level:Integer, title:String, page:Integer>>*

#### Example

**Argument values:**

* **Media reference:** `Media Reference`

| Media Reference | **Output** |
| ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | \[ {<br> **level**: 0,<br> **page**: 2,<br> **title**: Chapter 1,<br>}, {<br> \*\*l... |

[See details](/docs/foundry/pb-functions-expression/pdfTableOfContentsV1/).

***

### Extract text from PDF

> Supported in: Batch, Faster

Extracts raw text from the pages in a PDF.

**Expression categories:** Media

**Output type:** *Array\<String>*

#### Example

**Argument values:**

* **Media reference:** `Media Reference`
* **End page:** `End Page`
* **Error handling:** *null*
* **Start page:** `Start Page`

| Media Reference | Start Page | End Page | **Output** |
| ----- | ----- | ----- | ----- |
| {"mimeType":"application/pdf","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.test.media-set.1","mediaItemRid":"ri.mio.test.media-item.1"}}} | 1 | 2 | \[ first page, second page ] |

[See details](/docs/foundry/pb-functions-expression/pdfTextExtractionV1/).

***

### Extract text from PDF (using OCR)

> Supported in: Batch, Faster

Extracts text from the pages in a PDF file using optical character recognition (OCR).

**Expression categories:** Media

**Output type:** *Array\<String>*

[See details](/docs/foundry/pb-functions-expression/pdfOcrV1/).

***

### Extract text from images (using OCR)

> Supported in: Batch, Faster

Extracts text from an image using optical character recognition (OCR).

**Expression categories:** Media

**Output type:** *String*

[See details](/docs/foundry/pb-functions-expression/imageOcrV1/).

***

### Extract timestamp part

> Supported in: Batch, Faster, Streaming

Extracts a part of a timestamp like year or day of week.

**Expression categories:** Datetime

**Output type:** *Integer*

[See details](/docs/foundry/pb-functions-expression/timestampPartV1/).

***

### Filter array elements

> Supported in: Batch, Streaming

Filters an array based on the filter expression. Note, array index starts at 1.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Array:** `array`
* **Expression to filter:** <br>isNotNull(<br> expression: `element`,<br>)

| array | **Output** |
| ----- | ----- |
| \[ 2, 5, *null*, 11 ] | \[ 2, 5, 11 ] |

[See details](/docs/foundry/pb-functions-expression/filterArrayElementV1/).

***

### Filter by geometry type

> Supported in: Batch, Faster, Streaming

Nulls any values in the geometry column that are not of the provided geometry types.

**Expression categories:** Geospatial

**Output type:** *Geometry*

[See details](/docs/foundry/pb-functions-expression/geometryFilterV1/).

***

### First non null value (coalesce)

> Supported in: Batch, Faster, Streaming

Picks first non null value of the inputs. Known as coalesce in sql.

**Expression categories:** Data preparation

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

#### Example

**Argument values:**

* **Expressions:** \[`tail_number`, `airline`]
* **Treat empty strings as null:** *null*

| tail\_number | airline | **Output** |
| ----- | ----- | ----- |
| XB-123 | *null* | XB-123 |
| *null* | MT | MT |

[See details](/docs/foundry/pb-functions-expression/firstNonNullV1/).

***

### Floor

> Supported in: Batch, Faster, Streaming

Returns floor of a given fractional value.

**Expression categories:** Numeric

**Output type:** *Decimal | Long*

#### Example

**Argument values:**

* **Expression:** 10.123

**Output:** 10

[See details](/docs/foundry/pb-functions-expression/floorV1/).

***

### Format date as string

> Supported in: Batch, Faster, Streaming

Returns the date as formatted string in accordance to the Java DateTimeFormatter. The default format is ISO8601.

**Expression categories:** Cast, String

**Output type:** *String*

#### Example

**Argument values:**

* **Date:** 2022-12-20
* **Format:** yy-MM-dd

**Output:** 22-12-20

[See details](/docs/foundry/pb-functions-expression/dateToStringV2/).

***

### Format number

> Supported in: Batch, Faster, Streaming

Formats a number to a specific number of decimal places.

**Expression categories:** Cast, Numeric, String

**Output type:** *String*

#### Example

**Description:** Formats a number to 2 decimal places.

**Argument values:**

* **Decimal places:** 2
* **Number:** 1234.5678

**Output:** 1,234.57

[See details](/docs/foundry/pb-functions-expression/formatNumberV1/).

***

### Format string

> Supported in: Batch, Streaming

Formats string printf style.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Format arguments:** \[`argument1`, `argument2`]
* **Format string:** Hello %s, my name is %s

| argument1 | argument2 | **Output** |
| ----- | ----- | ----- |
| Alice | Bob | Hello Alice, my name is Bob |
| Jane | John | Hello Jane, my name is John |

[See details](/docs/foundry/pb-functions-expression/formatStringV1/).

***

### Format timestamp as string

> Supported in: Batch, Faster, Streaming

Returns the timestamp as a formatted string (ISO8601 by default).

**Expression categories:** Cast, Datetime, String

**Output type:** *String*

#### Example

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z
* **Format:** yyyy-MM-dd
* **Time zone:** *null*

**Output:** 2022-10-01

[See details](/docs/foundry/pb-functions-expression/timestampToStringV2/).

***

### Geometries have intersection

> Supported in: Batch, Faster, Streaming

Determines if two geometries intersect.

**Expression categories:** Geospatial

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"coordinates":\[\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323], \[... | {"coordinates":\[\[\[-103.78627755867336,33.162750522563925],\[-103.78627755867336,28.29724741894266],\[-... | true |
| {"coordinates":\[\[\[0.3651446504365481,15.159518507965103],\[0.3651446504365481,13.427462911044273],\[3.... | {"coordinates":\[\[\[5.656394524666183,13.405417496831944],\[5.656394524666183,11.29869961209053],\[8.551... | false |

[See details](/docs/foundry/pb-functions-expression/geometryIntersectsV1/).

***

### Geometry 3d affine transformation

> Supported in: Batch, Faster, Streaming

Applies a three dimensional affine transformation to the input geometry. This transformation occurs in the user-provided projected coordinate system, and the result is projected back to WGS84. Two dimensional geometries will have their z-coordinates set to 0 before the affine transformation is applied. The returned geometry is three dimensional and for each coordinate \[x,y,z] represents the matrix multiplication \[\[x0, x1, x2, x-offset], \[y0, y1, y2, y-offset], \[z0, z1, z2, z-offset], \[0, 0, 0, 1]] \*  \[x, y, z, 1], where the first three ordinates of the result are returned.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 0.0
* **X0:** 0.0
* **X1:** -1.0
* **X2:** 0.0
* **Y offset:** 0.0
* **Y0:** 1.0
* **Y1:** 0.0
* **Y2:** 0.0
* **Z offset:** 0.0
* **Z0:** 0.0
* **Z1:** 0.0
* **Z2:** 0.0

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0],\[1.0, 0.0],\[1.0, 1.0],\[0.0, 1.0],\[0.0, 0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0, 0.0, 0.0],\[0.0, 1.0, 0.0],\[-1.0, 1.0, 0.0],\[-1.0, 0.0, 0.0],\[0.0, 0.0, 0.0]]]} |

[See details](/docs/foundry/pb-functions-expression/geometry3dAffineTransformationV1/).

***

### Geometry array (unary) union

> Supported in: Batch, Faster, Streaming

Given an array of geometries, combine these into a single geometry, merging without overlap.

**Expression categories:** Geospatial

**Type variable bounds:** *T accepts Geometry*

**Output type:** *T*

#### Example

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]}, {"type":"Polygon","coordinates":\[\[\[0.5,0.0],\[1.5,0.0],\[1.5,1.0],\[0.5,1.0],\[0.5,0.0]]]} ] | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[0.5,1.0],\[1.0,1.0],\[1.5,1.0],\[1.5,0.0],\[1.0,0.0],\[0.5,0.0],\[0.0,0.0]]]} |
| \[  ] | *null* |
| *null* | *null* |

[See details](/docs/foundry/pb-functions-expression/geometryArrayUnionV1/).

***

### Geometry array line dissolve

> Supported in: Batch, Faster, Streaming

Given an array of geometries, combine these into a linear geometry. Dissolve simplifies an input set of line-strings by removing unnecessary nodes and concatenating line-strings that can be combined. Z-coordinates will be ignored for the purpose of the dissolve operation, but the vertices in the resultant geometry will have the same z-coordinate as the corresponding points in the input.

**Expression categories:** Geospatial

**Type variable bounds:** *T accepts Geometry*

**Output type:** *T*

#### Example

**Argument values:**

* **Expression:** `geometries`

| geometries | **Output** |
| ----- | ----- |
| \[ {"type":"LineString","coordinates":\[\[0,0],\[0,1],\[1,1]]}, {"type":"LineString","coordinates":\[\[1,1]... | {"type":"MultiLineString","coordinates":\[\[\[5.0, 5.0],\[4.0, 4.0],\[3.0, 3.0],\[2.0, 2.0],\[1.0, 1.0],\[0.0, 1.0],\[0.0, 0.0]],\[\[7.0, 7.0], \[6.0, 7.0], \[6.0, 6.0]]]} |
| \[ {"type":"LineString","coordinates":\[\[0,0,1],\[0,1,1],\[1,1,1]]}, {"type":"LineString","coordinates":\[\[1,1,1],\[2,2,2]]}, {"type":"LineString","coordinates":\[\[1,1,2],\[2,2,2],\[3,3,3]]} ] | {"type":"LineString","coordinates":\[\[0.0, 0.0, 1.0],\[0.0, 1.0, 1.0],\[1.0, 1.0, 1.0],\[2.0, 2.0, 2.0],\[3.0, 3.0, 3.0]]} |

[See details](/docs/foundry/pb-functions-expression/geometryArrayLineDissolveV1/).

***

### Geometry buffer

> Supported in: Batch, Streaming

Computes the buffer of a geometry for both positive and negative buffer distances. Returns an approximate representation of all points within a given distance of the this geometric object (or for negative buffers, all points minus those within the buffer distance of the boundary). Buffer drops any z coordinates, and zero/negative distance buffers of lines and points will return null.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Buffer distance:** `distance`
* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:32618
* **Buffer cap style:** `ROUND`
* **Buffer join style:** `ROUND`
* **Line segments per quadrant:** 8
* **Single or double sided:** `DOUBLE_SIDED`

| geometry | distance | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318]} | 10.0 | {"type":"Polygon","coordinates":\[\[\[-77.07356558299462, 38.83041048767274],\[-77.07356728534256, 38.83... |
| {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318, 1],\[-77.0725293738795,38.83042888342659, 1]]} | 10.0 | {"type":"Polygon","coordinates":\[\[\[-77.07253198637027, 38.83051894052714],\[-77.07250947453703, 38.83... |
| {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318, 1],\[-77.0725293738795,38.83... | 10.0 | {"type":"Polygon","coordinates":\[\[\[-77.07379585155829, 38.83040639848026],\[-77.07382199292853, 38.83... |

[See details](/docs/foundry/pb-functions-expression/geometryBufferV1/).

***

### Geometry centroid

> Supported in: Batch, Streaming

Return the centroid, or "center of mass", of the geometry using a spherical approximation of the globe. If the geometry is a collection of mixed dimensions, only the elements of the highest dimension will contribute to the centroid (e.g. in a collection of points, lines and polygons, points and lines are ignored). This operation will round to 32-bit floating point precision for coordinates in the geometry.

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

[See details](/docs/foundry/pb-functions-expression/geometryCentroidV1/).

***

### Geometry contains

> Supported in: Batch, Faster, Streaming

Determines if geometry a contains geometry b. Points or lines lying on the boundary of a polygon are not contained within another geometry.

**Expression categories:** Geospatial

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"coordinates":\[\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323], \[... | {"type":"Point","coordinates":\[-100.0,32.0]} | true |
| {"coordinates":\[\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323], \[... | {"type":"LineString","coordinates":\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323]]} | false |
| {"type":"LineString","coordinates":\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323]]} | {"type":"Point","coordinates":\[-112.94377956164206,34.81725414459382]} | false |
| {"type":"Point","coordinates":\[-112.94377956164206,34.81725414459382]} | {"type":"Point","coordinates":\[-112.94377956164206,34.81725414459382]} | true |
| {"coordinates":\[\[\[-112.94377956164206,34.81725414459382],\[-112.94377956164206,30.006795384733323], \[... | {"coordinates":\[\[\[-111.94377956164206,33.81725414459382],\[-111.94377956164206,31.006795384733323], \[... | true |

[See details](/docs/foundry/pb-functions-expression/geometryContainsV1/).

***

### Geometry difference

> Supported in: Batch, Faster, Streaming

Calculates the portion of geometry a that is not intersecting geometry b.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.25,0.25],\[0.5,0.25],\[0.5,0.5],\[0.25,0.5],\[0.25,0.25]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]],\[\[0.25,0.25],\[0.5,0.25],\[0.5,0.5],\[0.25,0.5],\[0.25,0.25]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.5,0.0],\[0.5,1.0],\[0.0,1.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.5,1.0],\[1.0,1.0],\[1.0,0.0],\[0.5,0.0],\[0.5,1.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"LineString","coordinates":\[\[0.0,0.0],\[0.0,1.0]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |

[See details](/docs/foundry/pb-functions-expression/geometryDifferenceV1/).

***

### Geometry explode to array

> Supported in: Batch, Faster, Streaming

Converts a geometry to an array of its constituent simple geometries.

**Expression categories:** Geospatial

**Output type:** *Array\<Geometry>*

#### Example

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} ] |
| {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]],\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]]} | \[ {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]}, {"type":"Polygon","coordinates":\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]} ] |

[See details](/docs/foundry/pb-functions-expression/geometryExplodeToArrayV1/).

***

### Geometry intersection

> Supported in: Batch, Faster, Streaming

Calculates the portion of geometry a that is intersecting geometry b.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.5,0.0],\[1.5,0.0],\[1.5,1.0],\[0.5,1.0],\[0.5,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.5,1.0],\[1.0,1.0],\[1.0,0.0],\[0.5,0.0],\[0.5,1.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]} | {"type":"Polygon","coordinates":\[\[]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} | {"type":"LineString","coordinates":\[\[1.0,1.0],\[1.0,0.0]]} |
| {"type":"Point","coordinates":\[0.0,0.0]} | {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} | {"type":"Point","coordinates":\[0.0,0.0]} |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} | {"type":"Polygon","coordinates":\[\[\[2.0,0.0],\[2.0,1.0],\[3.0,1.0],\[3.0,0.0],\[2.0,0.0]]]} | {"type":"LineString","coordinates":\[]} |

[See details](/docs/foundry/pb-functions-expression/geometryIntersectionV1/).

***

### Geometry length

> Supported in: Batch, Streaming

Get the length of the line strings and multi line strings in the geometry in meters. Uses a spherical approximation of the globe. Non-linear geometries (polygons and points) count as 0.

**Expression categories:** Geospatial

**Output type:** *Double*

#### Example

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"LineString","coordinates":\[\[-73.778128,40.641195],\[-118.408535,33.941563]]} | 3974344.7433354934 |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0],\[1.0,1.0],\[1.0,2.0]]} | 333585.2407005987 |
| {"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[1.0,1.0]], \[\[1.0,2.0],\[2.0,2.0]]]} | 333517.50194413937 |

[See details](/docs/foundry/pb-functions-expression/geometryLengthV1/).

***

### Geometry rotate 2d

> Supported in: Streaming

Applies a two dimensional clockwise rotation centered at the provided GeoPoint to the supplied geometry. This rotation occurs in the provided coordinate reference system and is then projected back to WGS84.

**Expression categories:** Geospatial

**Output type:** *Geometry*

[See details](/docs/foundry/pb-functions-expression/geometryRotate2dV1/).

***

### Geometry set z-coordinate

> Supported in: Batch, Faster, Streaming

Sets the z-coordinate of a geometry. If the geometry has an existing z-coordinate it will be overwritten.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Geometry:** `geometry`
* **Z coordinate:** `zCoordinate`

| geometry | zCoordinate | **Output** |
| ----- | ----- | ----- |
| {"type":"Point","coordinates":\[1.0, 2.0]} | 1.0 | {"type":"Point","coordinates":\[1.0, 2.0, 1.0]} |
| {"type":"Point","coordinates":\[1.0, 2.0, 3.0]} | 1.0 | {"type":"Point","coordinates":\[1.0, 2.0, 1.0]} |

[See details](/docs/foundry/pb-functions-expression/geometrySetZCoordinateV1/).

***

### Geometry shortest distance

> Supported in: Batch, Streaming

Given two valid geometries, calculates the shortest (great circle) distance in meters between them. Uses a spherical approximation of the globe. Overlapping geometries have a distance of zero.

**Expression categories:** Geospatial

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/geometryShortestDistanceV1/).

***

### Geometry standardize

> Supported in: Batch, Streaming

Given a valid geometry, standardizes it by enforcing the right-hand rule on the input, which is the convention for GeoJSON. This enables equality comparisons between equivalent geometries. This expression may reverse linestrings.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[32.26868,-26.53253],\[32.26465,-26.45873],\[32.25262,-26.38563],\[32.26868,-26.53253]]]} | {"type":"Polygon","coordinates":\[\[\[32.25262, -26.38563],\[32.26868, -26.53253],\[32.26465, -26.45873],\[32.25262, -26.38563]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0]],\[\[0.25,0.25],\[0.5,0.25],\[0.25,0.5]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]], \[\[0.25,0.25],\[0.25,0.5],\[0.5,0.25],\[0.25,0.25]]]} |
| {"coordinates": \[\[\[20.0, 10.0], \[27.0, 10.0], \[27.0, 17.0], \[20.0, 17.0], \[20.0, 10.0]]], "type": "Polygon"} | {"coordinates": \[\[\[20.0, 10.0], \[27.0, 10.0], \[27.0, 17.0], \[20.0, 17.0], \[20.0, 10.0]]], "type": "Polygon"} |
| {"coordinates": \[\[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]], \[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]]], "type":"MultiPolygon"} | {"coordinates": \[\[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} |
| {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | {"coordinates": \[\[5.0, 5.0],\[-1.0, -1.0]], "type":"LineString"} |
| {"coordinates": \[\[\[0.0, 0.0, 0.0], \[10.0, 0.0, 0.0], \[10.0, 10.0, 0.0], \[10.0, 10.0, 10.0], \[0.0, 10.0, 10.0], \[0.0, 0.0, 10.0], \[0.0, 0.0, 0.0]]], "type": "Polygon"} | {"coordinates": \[\[\[0.0, 0.0, 0.0], \[10.0, 0.0, 0.0], \[10.0, 10.0, 0.0], \[10.0, 10.0, 10.0], \[0.0, 10.0, 10.0], \[0.0, 0.0, 10.0], \[0.0, 0.0, 0.0]]], "type": "Polygon"} |

[See details](/docs/foundry/pb-functions-expression/geometryStandardizeV1/).

***

### Geometry symmetric difference

> Supported in: Batch, Faster, Streaming

Calculates the portion that is in either geometry, but not in their intersection.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[2.0,1.0],\[2.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[3.0,1.0],\[3.0,0.0],\[1.0,0.0]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]],\[\[\[2.0,0.0],\[2.0,1.0],\[3.0,1.0],\[3.0,0.0],\[2.0,0.0]]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.5,0.0],\[0.5,1.0],\[0.0,1.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.5,1.0],\[1.0,1.0],\[1.0,0.0],\[0.5,0.0],\[0.5,1.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.25,0.25],\[0.5,0.25],\[0.5,0.5],\[0.25,0.5],\[0.25,0.25]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]],\[\[0.25,0.25],\[0.5,0.25],\[0.5,0.5],\[0.25,0.5],\[0.25,0.25]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]],\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]]} |
| {"type":"Point","coordinates":\[0.0,0.0]} | {"type":"Point","coordinates":\[1.0,1.0]} | {"type":"MultiPoint","coordinates":\[\[0.0,0.0],\[1.0,1.0]]} |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[2.0,0.0]]} | {"type":"LineString","coordinates":\[\[1.0,0.0],\[3.0,0.0]]} | {"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[1.0,0.0]],\[\[2.0,0.0],\[3.0,0.0]]]} |

[See details](/docs/foundry/pb-functions-expression/geometrySymmetricDifferenceV1/).

***

### Geometry translate expression

> Supported in: Batch, Faster, Streaming

Applies a translation to a geometry. Two dimensional geometries are only converted to three dimensional geometries if a z offset is supplied.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Geometry column:** `geometry`
* **Projected coordinate system:** EPSG:4326
* **X offset:** 1.0
* **Y offset:** -1.0
* **Z offset:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[0.0, 0.0]} | {"type":"Point","coordinates":\[1.0, -1.0]} |
| {"type":"LineString","coordinates":\[\[0.0, 0.0], \[1.0, 1.0]]} | {"type":"LineString","coordinates":\[\[1.0, -1.0], \[2.0, 0.0]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0, 0.0],\[1.0, 0.0],\[1.0, 1.0],\[0.0, 1.0], \[0.0, 0.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0, -1.0],\[2.0, -1.0],\[2.0, 0.0],\[1.0, 0.0],\[1.0, -1.0]]]} |

[See details](/docs/foundry/pb-functions-expression/geometryTranslateV1/).

***

### Geometry union

> Supported in: Batch, Faster, Streaming

Combines the two geometries to create a single geometry.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Geometry a:** `geometry_a`
* **Geometry b:** `geometry_b`

| geometry\_a | geometry\_b | **Output** |
| ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.5,0.0],\[1.5,0.0],\[1.5,1.0],\[0.5,1.0],\[0.5,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[0.5,1.0],\[1.0,1.0],\[1.5,1.0],\[1.5,0.0],\[1.0,0.0],\[0.5,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]],\[\[\[5.0,5.0],\[5.0,6.0],\[6.0,6.0],\[6.0,5.0],\[5.0,5.0]]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]],\[\[0.25,0.25],\[0.5,0.25],\[0.5,0.5],\[0.25,0.5],\[0.25,0.25]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} | {"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]} | {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]},{"type":"Polygon","coordinates":\[\[\[1.0,0.0],\[1.0,1.0],\[2.0,1.0],\[2.0,0.0],\[1.0,0.0]]]}]} |

[See details](/docs/foundry/pb-functions-expression/geometryUnionV1/).

***

### Get H3 index

> Supported in: Batch, Faster, Streaming

Convert GeoPoint to H3 index at given resolution. Returns null for resolution <0 or >15.

**Expression categories:** Geospatial

**Output type:** *H3 Index*

[See details](/docs/foundry/pb-functions-expression/h3IndexExpressionV1/).

***

### Get H3 indices covering a geometry

> Supported in: Batch, Faster, Streaming

Convert geometry to H3 indices at a certain resolution. Resolution must be between 0 and 15, inclusive. For a polygon, three conversions are supported: a) H3 indices that fully cover the polygon, b) H3 indices that are fully contained by the polygon, c) H3 indices whose centroids are contained in the polygon. Returns null when the expected number of H3 indices exceed 7 million.

**Expression categories:** Geospatial

**Output type:** *Array\<H3 Index>*

[See details](/docs/foundry/pb-functions-expression/polygonToH3V1/).

***

### Get MIME type

> Supported in:

Returns the IANA MIME type of a media reference.

**Expression categories:** Media

**Output type:** *String*

[See details](/docs/foundry/pb-functions-expression/getMimeTypeV1/).

***

### Get PDF page dimensions

> Supported in: Batch, Faster

Get the dimensions in points of each page of the PDF.

**Expression categories:** Media

**Output type:** *Array\<Struct\<height:Double, width:Double>>*

[See details](/docs/foundry/pb-functions-expression/getPdfPageDimensionsV1/).

***

### Get XZ curve index of an envelope

> Supported in: Batch, Streaming

Encodes the envelope in an XZ curve.

**Expression categories:** Geospatial

**Output type:** *Long*

#### Example

**Argument values:**

* **Curve preset:** `LON_LAT_10KM`
* **Envelope:** `envelope`

| envelope | **Output** |
| ----- | ----- |
| {<br> maxLat -> 2.0,<br> maxLon -> 3.0,<br> minLat -> 0.0,<br> minLon -> 1.0,<br>} | 16777222 |
| {<br> maxLat -> 2.0,<br> maxLon -> 3.0,<br> minLat -> *null*,<br> minLon -> 1.0,<br>} | *null* |

[See details](/docs/foundry/pb-functions-expression/xzCurveEncodeV1/).

***

### Get bearing from start point to end point

> Supported in: Batch, Faster, Streaming

Calculates the absolute true bearing (clockwise angle relative to geographical north) from the first point to the second point in degrees using a spherical approximation of the earth.

**Expression categories:** Geospatial

**Output type:** *Double*

#### Example

**Argument values:**

* **Ending point:** `end_point`
* **Starting point:** `start_point`

| start\_point | end\_point | **Output** |
| ----- | ----- | ----- |
| {<br> **latitude**: 40.69325025929194,<br> **longitude**: -74.00522662934995,<br>} | {<br> **latitude**: 51.4988509390695,<br> **longitude**: -0.1238396067697046,<br>} | 51.20964213763489 |

[See details](/docs/foundry/pb-functions-expression/getBearingV1/).

***

### Get geometry envelope

> Supported in: Batch, Streaming

Given a valid geometry or array of geometries, return a geometry representing the envelope of the input. The envelope is the smallest axis-aligned rectangular region containing the minimum and maximum x and y values of the geometry.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |

[See details](/docs/foundry/pb-functions-expression/geometryEnvelopeV1/).

***

### Get lat/long bounding box struct

> Supported in: Batch, Faster, Streaming

Given a valid geometry or array of geometries, return a struct containing the bounds of the geometry or geometries.

**Expression categories:** Geospatial

**Output type:** *LatLonBoundingBox*

#### Example

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0]]]} | {<br> maxLat -> 1.0,<br> maxLon -> 1.0,<br> minLat -> 0.0,<br> minLon -> 0.0,<br>} |

[See details](/docs/foundry/pb-functions-expression/latLonBoundingBoxV1/).

***

### Get neighbors of an H3 index

> Supported in: Batch, Faster, Streaming

Get all neighbors of an H3 index.

**Expression categories:** Geospatial

**Output type:** *Array\<H3 Index>*

[See details](/docs/foundry/pb-functions-expression/h3NeighborsV1/).

***

### Get struct field

> Supported in: Batch, Faster, Streaming

Extracts a field from a struct.

**Expression categories:** Struct

**Output type:** *AnyType*

#### Example

**Argument values:**

* **Locator:** airline.id
* **Struct:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **id**: NA,<br>},<br>} | NA |
| {<br> **airline**: {<br> **id**: FE,<br>},<br>} | FE |

[See details](/docs/foundry/pb-functions-expression/getStructFieldV2/).

***

### Get the convex hull of a geometry

> Supported in: Batch, Faster, Streaming

Given a valid GeoJSON input string, return a GeoJSON string that is the convex hull for the geometry. The convex hull is the smallest convex polygon containing the geometry.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Expression:** `geometry`

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[2.0,0.0],\[2.0,1.0],\[1.0,1.0],\[1.0,2.0],\[0.0,2.0],\[0.0,0.0]]]} | {"type":"Polygon", "coordinates":\[\[\[0.0, 0.0], \[0.0, 2.0], \[1.0, 2.0], \[2.0, 1.0], \[2.0, 0.0], \[0.0, 0.0]]]} |
| *null* | *null* |

[See details](/docs/foundry/pb-functions-expression/geometryConvexHullV1/).

***

### Get timestamps for scene frames

> Supported in: Batch

Get the timestamps and scene scores for detected scene frame transitions in the video.

**Expression categories:** Media

**Output type:** *Array\<Struct\<timestamp:String, scene\_score:String>>*

[See details](/docs/foundry/pb-functions-expression/getTimestampsForSceneFramesV1/).

***

### Greater than

> Supported in: Batch, Faster, Streaming

Returns true if left is greater than right.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Left:** `a`
* **Right:** `b`

| a | b | **Output** |
| ----- | ----- | ----- |
| 1 | 0 | true |
| 1 | 1 | false |
| 0 | 1 | false |

[See details](/docs/foundry/pb-functions-expression/greaterThanV2/).

***

### Greater than or equals

> Supported in: Batch, Faster, Streaming

Returns true if left is greater than or equal to right.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Left:** `a`
* **Right:** `b`

| a | b | **Output** |
| ----- | ----- | ----- |
| 1 | 0 | true |
| 1 | 1 | true |
| 0 | 1 | false |

[See details](/docs/foundry/pb-functions-expression/greaterThanOrEqualsV2/).

***

### Greatest

> Supported in: Batch, Faster, Streaming

Computes the greatest value amongst all input columns, skipping null values.

**Expression categories:** Numeric

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *T*

#### Example

**Argument values:**

* **Expressions:** \[`a`, `b`, `c`]

| a | b | c | **Output** |
| ----- | ----- | ----- | ----- |
| 1 | 2 | 3 | 3 |
| 1 | 3 | 2 | 3 |
| 3 | 2 | 1 | 3 |

[See details](/docs/foundry/pb-functions-expression/greatestV1/).

***

### Gzip decompress

> Supported in: Batch, Faster, Streaming

Decompresses gzip-compressed binary into a string.

**Expression categories:** File

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `gzip`

| gzip | **Output** |
| ----- | ----- |
| H4sIAAAAAAAA//NIzcnJ11Eozy/KSVEEAObG5usNAAAA | Hello, world! |

[See details](/docs/foundry/pb-functions-expression/gzipDecompressV1/).

***

### H3 cell to children

> Supported in: Batch, Faster, Streaming

Get children of an H3 index at given resolution specifying children coarseness. Returns null for resolution <0 or >15 or for children resolution lower than given H3 index's resolution.

**Expression categories:** Geospatial

**Output type:** *Array\<H3 Index>*

[See details](/docs/foundry/pb-functions-expression/h3CellToChildrenV1/).

***

### H3 cell to parent

> Supported in: Batch, Faster, Streaming

Get parent of an H3 index at given resolution specifying parent coarseness. Returns null for resolution <0 or >15 or resolution higher than given index.

**Expression categories:** Geospatial

**Output type:** *H3 Index*

[See details](/docs/foundry/pb-functions-expression/h3CellToParentV1/).

***

### H3 to geometry

> Supported in: Batch, Faster, Streaming

Convert H3 index to polygon.

**Expression categories:** Geospatial

**Output type:** *Geometry*

[See details](/docs/foundry/pb-functions-expression/h3ToGeometryV1/).

***

### Has media schema

> Supported in: Batch

Checks if a media reference has a specific schema type and format. This expression can be used as a filter condition to filter media sets by media type and allow downstream schema-specific transformations.

**Expression categories:** Media

**Output type:** *Boolean*

[See details](/docs/foundry/pb-functions-expression/hasMediaSchemaV1/).

***

### Hash sha256

> Supported in: Batch, Faster, Streaming

Hashes the input using sha256 hashing algorithm.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** Hello World!

**Output:** 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069

[See details](/docs/foundry/pb-functions-expression/sha256V1/).

***

### IPv6 to canonical format

> Supported in: Batch

Converts an IPv6 address into a canonical IPv6 address. RFC 5952 describes canonical representations for IPv6.

**Expression categories:** Cyber

**Output type:** *IPv6*

#### Example

**Argument values:**

* **Expression:** `ip`

| ip | **Output** |
| ----- | ----- |
| 001:0db8:85a3:0000:0000:8a2e:0370:7334 | 1\:db8:85a3::8a2e:370:7334 |
| ::1 | ::1 |
| 2001\:db8:0:1:1:1:1:1 | 2001\:db8:0:1:1:1:1:1 |
| 2001:1:0:0:10:0:10:10 | 2001:1::10:0:10:10 |
| 2001:0:0:1:0:0:0:1 | 2001:0:0:1::1 |
| 2001\:db8:0:0:1:0:0:1 | 2001\:db8::1:0:0:1 |
| 2001\:DB8\:AAAA\:BBBB\:CCCC\:DDDD\:EEEE:FFFF | 2001\:db8\:aaaa\:bbbb\:cccc\:dddd\:eeee:ffff |
| 0:0:0:0:0:0:0:0 | :: |
| :: | :: |
| 0:0:0:1:2:3:4:5 | ::1:2:3:4:5 |
| 1:2:3:4:5:0:0:0 | 1:2:3:4:5:: |
| 1:2:3:4:5:6:7:8 | 1:2:3:4:5:6:7:8 |
| *null* | *null* |

[See details](/docs/foundry/pb-functions-expression/ipV6ToCanonicalIpV6V1/).

***

### Image to embeddings

> Supported in: Batch

Converts images into embeddings using the provided model.

**Expression categories:** Media

**Output type:** *Embedded vector*

#### Example

**Description:** Example embeddings for an image.

**Argument values:**

* **Media reference:** `mediaRef`
* **Model:** <br>googleSiglip2Embedding(<br><br>)
* **Output mode:** *null*

| mediaRef | **Output** |
| ----- | ----- |
| {<br>  "mimeType": "image/jpeg",<br>  "reference": {<br> "type": "mediaSetViewItem",<br> "... | embeddings-result |

[See details](/docs/foundry/pb-functions-expression/imageToEmbeddingsV1/).

***

### Interpolate geo point along linestring

> Supported in: Batch, Streaming

Returns a point interpolated along a line. Implementation interprets lines as the shortest path, using a spherical approximation of the globe.

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

#### Example

**Argument values:**

* **Fraction:** `fraction`
* **Linestring:** `linestring`

| linestring | fraction | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[0.0,2.0],\[30.0,0.0]]} | 0.5 | {<br> **latitude**: 1.0352686301676643,<br> **longitude**: 15.004677545504547,<br>} |
| {"type":"LineString","coordinates":\[\[30.0,2.0],\[50.0,3.0]]} | 0.8 | {<br> **latitude**: 2.8256098405656185,<br> **longitude**: 45.99752305664789,<br>} |
| {"type":"LineString","coordinates":\[\[45.0,9.0],\[90.0,4.0]]} | 0.2 | {<br> **latitude**: 8.363732883448177,<br> **longitude**: 54.073497456494955,<br>} |

[See details](/docs/foundry/pb-functions-expression/interpolateGeoPointAlongLinestringV1/).

***

### Is NaN

> Supported in: Batch, Faster, Streaming

Returns true if the input is nan, false otherwise.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** NaN

**Output:** true

[See details](/docs/foundry/pb-functions-expression/isNaNV1/).

***

### Is empty struct

> Supported in: Batch, Streaming

Returns true if the input is an empty struct, with recursive checking of inner arrays and structs.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **id**: *null*,<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | true |
| {<br> **airline**: {<br> **id**: NA,<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | false |

[See details](/docs/foundry/pb-functions-expression/isEmptyStructV1/).

***

### Is in

> Supported in: Batch, Faster, Streaming

Returns true if the list contains the value.

**Expression categories:** Boolean

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *Boolean*

#### Example

**Description:** You can check if the list contains the value.

**Argument values:**

* **Contains:** \[AWE-112, BRR-123]
* **Value:** `value`

| value | **Output** |
| ----- | ----- |
| BRR-123 | true |
| ABC-543 | false |

[See details](/docs/foundry/pb-functions-expression/isInV1/).

***

### Is not null

> Supported in: Batch, Faster, Streaming

Returns true if the input is not null, can optionally treat empty strings as null.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** hello
* **Treat empty strings as null:** *null*

**Output:** true

[See details](/docs/foundry/pb-functions-expression/isNotNullV1/).

***

### Is null

> Supported in: Batch, Faster, Streaming

Returns true if the input is null, can optionally treat empty strings as null.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** *null*
* **Treat empty strings as null:** *null*

**Output:** true

[See details](/docs/foundry/pb-functions-expression/isNullV1/).

***

### Is valid GeoJSON

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid GeoJSON input string. Not all GeoJSON strings are indexable by the ontology; use the "prepare geometry" expression to prepare geometry prior to Ontology use.

**Expression categories:** Geospatial

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `geoJson`

| geoJson | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[3.0, 5.0, 2.0]} | true |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} | true |
| {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} | true |
| not a GeoJSON string | false |

[See details](/docs/foundry/pb-functions-expression/isValidGeoJsonV1/).

***

### Is valid Geohash

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid Geohash input string.

**Expression categories:** Geospatial

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `geohash`

| geohash | **Output** |
| ----- | ----- |
| sk4d | true |
| dt9zy9cg36j7 | true |
| not a Geohash string | false |
| *null* | false |

[See details](/docs/foundry/pb-functions-expression/isValidGeohashV1/).

***

### Is valid H3 index

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid H3 index string.

**Expression categories:** Geospatial

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `h3`

| h3 | **Output** |
| ----- | ----- |
| 862a1072fffffff | true |
| not an h3 value | false |

[See details](/docs/foundry/pb-functions-expression/isValidH3IndexV1/).

***

### Is valid IPv4

> Supported in: Batch

Returns true if the input is a valid IPv4 address.

**Expression categories:** Cyber

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `ip`

| ip | **Output** |
| ----- | ----- |
| 192.168.1.1 | true |
| 10.0.0.1 | true |
| 172.16.0.1 | true |
| 255.255.255.255 | true |
| 0.0.0.0 | true |
| 127.0.0.1 | true |
| 1.2.3.4 | true |
| 256.1.1.1 | false |
| 192.168.1.256 | false |
| 192.168.1 | false |
| 192.168.1.1.1 | false |
| abc.def.ghi.jkl | false |
| 192.168.1.a | false |
| -1.2.3.4 | false |
| *empty string* | false |
|     | false |
| 192.168.1.0/24 | false |
| 10.0.0.0/8 | false |
| 192 | false |
| a.b.c.d/255.0.0.0 | false |
| ::1 | false |
| 2001\:db8::1 | false |
| *null* | false |

[See details](/docs/foundry/pb-functions-expression/isValidIpV4V1/).

***

### Is valid IPv6

> Supported in: Batch

Returns true if the input is a valid IPv6 address.

**Expression categories:** Cyber

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `ip`

| ip | **Output** |
| ----- | ----- |
| 001:0db8:85a3:0000:0000:8a2e:0370:7334 | true |
| 2001\:db8:85a3:0:0:8A2E:0370:7334 | true |
| 2001\:db8:85a3::8a2e:370:7334 | true |
| ::1 | true |
| fe80:: | true |
| :: | true |
| 0:0:0:0:0:0:0:1 | true |
| 2001\:db8:: | true |
| ::ffff:192.0.2.128 | true |
| 2001\:db8:0:0:1:0:0:1 | true |
| 1234:5678:9abc\:def0:1234:5678:9abc:def0 | true |
| abcd\:ef01:2345:6789\:abcd\:ef01:2345:6789 | true |
| 2001\:db8:1234:0000:0000:0000:0000:0001 | true |
| 2001\:db8:1234::1 | true |
| 2001\:db8:85a3::8a2e:37023:7334 | false |
| 2001\:db8:85a3::8a2e::7334 | false |
| 2001\:db8:85a3:0:0:8A2E:0370:7334:1234 | false |
| 2001\:db8:85a3 | false |
| 2001\:db8:85a3::8a2e:370g:7334 | false |
| ::ffff:192.0.2.999 | false |
| 2001\:db8:85a3:0:0:8A2E:0370:7334: | false |
| :2001\:db8:85a3:0:0:8A2E:0370:7334 | false |
| 2001\:db8:85a3:0:0:8A2E:0370:7334:: | false |
| GGGG\:db8:85a3:0:0:8A2E:0370:7334 | false |
| 2001-db8-85a3-0-0-8A2E-0370-7334 | false |
| 2001\:db8:85a3:0:0:8A2E:0370:7334/64 | false |
| 2001\:db8::/32 | false |
| *empty string* | false |
|     | false |
| 192.168.1.1 | false |
| *null* | false |

[See details](/docs/foundry/pb-functions-expression/isValidIpV6V1/).

***

### Is valid MGRS

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid MGRS (military grid reference system) string.

**Expression categories:** Geospatial

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `mgrs`

| mgrs | **Output** |
| ----- | ----- |
| 4Q FJ 1 6 | true |
| 4Q FJ 12345 67890 | true |

[See details](/docs/foundry/pb-functions-expression/isValidMgrsV1/).

***

### Is valid MIME type

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid MIME type.

**Expression categories:** Boolean, Other

**Output type:** *Boolean*

[See details](/docs/foundry/pb-functions-expression/isValidMimeTypeV1/).

***

### Is valid Ontology GeoPoint

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid Ontology GeoPoint. Ontology GeoPoints are strings of the format '{lat},{lon}', where -90 <= lat <= 90 and -180 <= lon <= 180.

**Expression categories:** Geospatial

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `geopoint`

| geopoint | **Output** |
| ----- | ----- |
| -35.307428203,149.122686883 | true |
| 149.122686883,-35.307428203 | false |
| 10.0, 20.0 | true |
|    10.0,    20.0    | true |
| not a GeoPoint | false |
| *null* | false |
| (10.0,20.0) | false |

[See details](/docs/foundry/pb-functions-expression/isValidOntologyGeopointV1/).

***

### Is valid delegated media gid

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid gotham delegated media gid. Check gotham's delegated media rtfm for more details.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** ri.gotham-delegated-media.12345678-1234-1234-1234-123456789012.testaudiotype.testlocator

**Output:** true

[See details](/docs/foundry/pb-functions-expression/isValidDelegatedMediaGidV1/).

***

### Is valid media reference

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid Foundry media reference.

**Expression categories:** Boolean

**Output type:** *Boolean*

[See details](/docs/foundry/pb-functions-expression/isValidMediaReferenceV1/).

***

### Is valid rid

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid Foundry resource identifier.

**Expression categories:** Boolean

**Output type:** *Boolean*

[See details](/docs/foundry/pb-functions-expression/isValidRidV1/).

***

### Is valid uuid

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid uuid.

**Expression categories:** Boolean

**Output type:** *Boolean*

[See details](/docs/foundry/pb-functions-expression/isValidUuidV1/).

***

### Join array

> Supported in: Batch, Faster, Streaming

Joins array with specified separator.

**Expression categories:** Array

**Output type:** *String*

#### Example

**Argument values:**

* **Array to join:** \[ hello, world ]
* **Separator:** -

**Output:** hello-world

[See details](/docs/foundry/pb-functions-expression/arrayJoinV1/).

***

### Last day of the week/month/quarter/year

> Supported in: Batch, Faster

Returns the last day of the week/month/quarter/year.

**Expression categories:** Datetime

**Output type:** *Date*

[See details](/docs/foundry/pb-functions-expression/lastDayV1/).

***

### Least

> Supported in: Batch, Faster, Streaming

Computes the least value amongst all input columns, skipping null values.

**Expression categories:** Boolean, Numeric

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *T*

#### Example

**Argument values:**

* **Expressions:** \[`a`, `b`, `c`]

| a | b | c | **Output** |
| ----- | ----- | ----- | ----- |
| 1 | 2 | 3 | 1 |
| 1 | 3 | 2 | 1 |
| 3 | 2 | 1 | 1 |

[See details](/docs/foundry/pb-functions-expression/leastV1/).

***

### Left of string

> Supported in: Batch, Faster, Streaming

Extract left hand side of a string based on index.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** Hello world!
* **Length:** 5

**Output:** Hello

[See details](/docs/foundry/pb-functions-expression/leftStringV1/).

***

### Left pad string

> Supported in: Batch, Faster, Streaming

Left-pad the string column to width of length with pad.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** Hello world!
* **Length:** 15
* **Pad:** \*

**Output:** \*\*\*Hello world!

[See details](/docs/foundry/pb-functions-expression/leftPadV1/).

***

### Length

> Supported in: Batch, Faster, Streaming

Returns the length of each value in a string column or an array column.

**Expression categories:** Array, Numeric

**Output type:** *Integer*

#### Example

**Argument values:**

* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| hello | 5 |
| bye | 3 |

[See details](/docs/foundry/pb-functions-expression/lengthV1/).

***

### Less than

> Supported in: Batch, Faster, Streaming

Returns true if left is less than right.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Left:** `left`
* **Right:** `right`

| left | right | **Output** |
| ----- | ----- | ----- |
| 1.0 | 10 | true |
| 10.0 | 1 | false |

[See details](/docs/foundry/pb-functions-expression/lessThanV2/).

***

### Less than or equals

> Supported in: Batch, Faster, Streaming

Returns true if left is less than or equal to right.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Left:** `left`
* **Right:** `right`

| left | right | **Output** |
| ----- | ----- | ----- |
| 1.0 | 10 | true |
| 10.0 | 1 | false |

[See details](/docs/foundry/pb-functions-expression/lessThanOrEqualsV2/).

***

### Logarithm

> Supported in: Batch, Faster, Streaming

Calculates the natural logarithm, ln(x), of a column.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Expression:** 10.123

**Output:** 2.3148100626166146

[See details](/docs/foundry/pb-functions-expression/logV1/).

***

### Logarithm with base

> Supported in: Batch, Faster, Streaming

Calculates logarithm with a given base.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Base:** 2.0
* **Expression:** 8

**Output:** 3.0

[See details](/docs/foundry/pb-functions-expression/logNV1/).

***

### Logical type cast

> Supported in: Batch, Faster, Streaming

Cast expression to given logical type. Unlike the regular cast expression, this expression will not change the underlying base representation of the data, but rather enforce the constraints associated with the specified logical type, so that the output can be used as the input to downstream expressions which specifically demand an instance of that logical type.

**Expression categories:** Cast

**Type variable bounds:** *C accepts AnyType*

**Output type:** *C*

#### Example

**Description:** Successful cast to natural number

**Argument values:**

* **Expression:** 1234
* **Logical type:** Natural number
* **Default value:** *null*

**Output:** 1234

[See details](/docs/foundry/pb-functions-expression/logicalTypeCastV1/).

***

### Lowercase

> Supported in: Batch, Faster, Streaming

Converts all characters in string to lowercase.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** Hello World

**Output:** hello world

[See details](/docs/foundry/pb-functions-expression/lowercaseV1/).

***

### Map values

> Supported in: Batch, Faster, Streaming

Changes the values of the input column to new values based on a map of key-value pairs. If the input value is not found in the map, the default value is used.

**Expression categories:** Data preparation

**Type variable bounds:** *T1 accepts ComparableType\*\*T2 accepts AnyType*

**Output type:** *T2*

#### Example

**Argument values:**

* **Column to replace values in:** `country`
* **Default value:** <br>cast(<br> expression: *null*,<br> type: String,<br>)
* **Values map:** {<br> Denmark -> DNK,<br> United Kingdom -> UK,<br>}

| country | **Output** |
| ----- | ----- |
| United Kingdom | UK |
| Denmark | DNK |
| United States of America | *null* |

[See details](/docs/foundry/pb-functions-expression/mapValuesV2/).

***

### Modulo

> Supported in: Batch, Faster, Streaming

Returns modulus of an expression.

**Expression categories:** Numeric

**Output type:** *DefiniteNumeric*

#### Example

**Argument values:**

* **Denominator:** 4
* **Numerator:** 10.123

**Output:** 2.123

[See details](/docs/foundry/pb-functions-expression/moduloV1/).

***

### Multiply numbers

> Supported in: Batch, Faster, Streaming

Calculates the product of all input columns.

**Expression categories:** Numeric

**Output type:** *Numeric*

#### Example

**Argument values:**

* **Expressions:** \[`col_a`, `col_b`, `col_c`]

| col\_a | col\_b | col\_c | **Output** |
| ----- | ----- | ----- | ----- |
| 10 | 2 | 3 | 60 |

[See details](/docs/foundry/pb-functions-expression/multiplyV2/).

***

### Natural random number

> Supported in: Batch, Faster, Streaming

Returns a random natural number. This is not deterministic and will not produce the same result on repeated builds, even when using a seed.

**Expression categories:** Numeric

**Output type:** *Long*

#### Example

**Description:** The only natural number between 10 (inclusive) and 11 (exclusive) is 10.

**Argument values:**

* **Max value:** 11
* **Min value:** 10
* **Seed:** *null*

**Output:** 10

[See details](/docs/foundry/pb-functions-expression/naturalRandomV1/).

***

### Negate

> Supported in: Batch, Faster, Streaming

**Expression categories:** Numeric

**Output type:** *Numeric*

[See details](/docs/foundry/pb-functions-expression/negateV1/).

***

### Next day

> Supported in: Batch

Returns the first date which is later than the value of the date column based on the day of week argument.

**Expression categories:** Datetime

**Output type:** *Date*

#### Example

**Description:** Next Monday after Wednesday January 10, 2024

**Argument values:**

* **Date:** 2024-01-10
* **Day of the week:** `MONDAY`

**Output:** 2024-01-15

[See details](/docs/foundry/pb-functions-expression/nextDayV1/).

***

### Normal random number

> Supported in: Batch, Faster, Streaming

Returns a column of normally distributed random numbers with zero mean and unit variance. This is not deterministic and will not produce the same result on repeated builds, even when using a seed.

**Expression categories:** Numeric

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/normalRandomV1/).

***

### Not

> Supported in: Batch, Faster, Streaming

Returns the negated boolean value of a boolean expression.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `boolean`

| boolean | **Output** |
| ----- | ----- |
| true | false |
| false | true |

[See details](/docs/foundry/pb-functions-expression/notV1/).

***

### Not any

> Supported in: Batch, Streaming

Returns true only if all of the specified conditions are false. Nulls are considered false.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Conditions:** \[`left_boolean`, `right_boolean`]

| left\_boolean | right\_boolean | **Output** |
| ----- | ----- | ----- |
| true | true | false |
| true | false | false |
| false | true | false |
| false | false | true |

[See details](/docs/foundry/pb-functions-expression/notAnyV1/).

***

### Nth chain in polygon

> Supported in: Batch, Faster, Streaming

Returns the nth ring in a single polygon in the geometry. Indexing is 1-based, and an index of 0 is out-of-bounds. An index equal to 1 returns an external ring. An index greater than 1 returns an internal ring. Returns null for any of the following conditions: geometry isn't a single polygon, a feature collection or geometry collection is provided, index is out-of-bounds, or at least one argument is null.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **N:** `n`
* **Polygon:** `polygon`

| polygon | n | **Output** |
| ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 1 | {"coordinates": \[\[0.0, 0.0], \[0.0, 10.0], \[10.0, 10.0], \[10.0, 0.0], \[0.0, 0.0]], "type": "LineString"} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 2 | *null* |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.0],\[52.0,52.0],\[50.0,57.0],\[57.0,57.0]]],"type":"Polygon"} | 1 | {"coordinates": \[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]], "type": "LineString"} |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.0],\[52.0,52.0],\[50.0,57.0],\[57.0,57.0]]],"type":"Polygon"} | 2 | {"coordinates": \[\[57.0,57.0],\[55.0,52.0],\[52.0,52.0],\[50.0,57.0],\[57.0,57.0]], "type": "LineString"} |

[See details](/docs/foundry/pb-functions-expression/getNthChainFromPolygonV1/).

***

### Nth point in linestring

> Supported in: Batch, Faster, Streaming

Returns the nth point in a single linestring in the geometry. Indexing is 1-based, and an index of 0 is out-of-bounds. A negative index is counted backwards from the end of the linestring, so that -1 is the last point. Returns null for any of the following conditions: geometry isn't a single linestring, a feature collection or geometry collection is provided, index is out-of-bounds, or at least one argument is null.

**Expression categories:** Geospatial

**Output type:** *GeoPoint*

#### Example

**Argument values:**

* **Linestring:** `linestring`
* **N:** `n`

| linestring | n | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[30.0,2.0],\[35.0,0.0],\[50.0,3.0]]} | 1 | {<br> **latitude**: 2.0,<br> **longitude**: 30.0,<br>} |
| {"type":"LineString","coordinates":\[\[30.0,2.0],\[35.0,0.0],\[50.0,3.0]]} | 3 | {<br> **latitude**: 3.0,<br> **longitude**: 50.0,<br>} |
| {"type":"LineString","coordinates":\[\[45.0,9.0],\[90.0,4.0],\[40.0,0.0]]} | -1 | {<br> **latitude**: 0.0,<br> **longitude**: 40.0,<br>} |

[See details](/docs/foundry/pb-functions-expression/linestringPointNV1/).

***

### Nullify empty string

> Supported in: Batch, Faster, Streaming

Convert empty strings to null.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** *empty string*

**Output:** *null*

[See details](/docs/foundry/pb-functions-expression/nullifyEmptyStringV1/).

***

### Or

> Supported in: Batch, Faster, Streaming

Returns true if any of the specified conditions are true. Nulls are considered false.

**Expression categories:** Boolean

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Conditions:** \[`left_boolean`, `right_boolean`]

| left\_boolean | right\_boolean | **Output** |
| ----- | ----- | ----- |
| true | true | true |
| true | false | true |
| false | true | true |
| false | false | false |

[See details](/docs/foundry/pb-functions-expression/orV1/).

***

### Parse GeoJSON from a non-WGS 84 coordinate system

> Supported in: Batch, Faster, Streaming

Convert GeoJSON string from a non-WGS 84 coordinate system to WGS 84 geometry. For GeoJSON already in WGS 84 (longitude, latitude), the "logical type cast" expression can convert directly with less overhead. Returns null for strings that fail during parsing or conversion.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **GeoJSON string:** `geojson_string`
* **Source coordinate system:** EPSG:32618

| geojson\_string | **Output** |
| ----- | ----- |
| {"type":"Point","coordinates":\[320000.0,4300000.0]} | {"type":"Point","coordinates":\[-77.07368071728229,38.83040844313318]} |
| {"type":"LineString","coordinates":\[\[320000.0,4300000.0],\[320100.0,4300000.0]]} | {"type":"LineString","coordinates":\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659]]} |
| {"type":"Polygon","coordinates":\[\[\[320000.0,4300000.0],\[320100.0,4300000.0],\[320000.0,4300100.0],\[320000.0,4300000.0]]]} | {"type":"Polygon","coordinates":\[\[\[-77.07368071728229,38.83040844313318],\[-77.0725293738795,38.83042888342659],\[-77.07370685720375,38.83130901341597],\[-77.07368071728229,38.83040844313318]]]} |

[See details](/docs/foundry/pb-functions-expression/parseGeoJsonAsGeometryV1/).

***

### Parse JSON string

> Supported in: Batch, Faster, Streaming

Parses JSON string following the given schema definition, ignoring any fields not in the schema.

**Expression categories:** Data preparation, Popular, String, Struct

**Output type:** *Array\<AnyType> | Map\<String, String> | Struct*

#### Example

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Integer>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "miles": 2000<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **id**: JFK,<br> **miles**: 2000,<br>},<br>} |

[See details](/docs/foundry/pb-functions-expression/parseJsonAsSchemaV3/).

***

### Parse KML string as geometry

> Supported in: Batch, Streaming

Parses KML geometry definitions as a GeoJSON. Ignores all attributes. This expression operates on already extracted text; please extract files to text before using this expression.

**Expression categories:** Geospatial

**Output type:** *String | Struct\<ok:Geometry, error:String>*

#### Example

**Description:** Basic polygons.

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** *null*
* **Prepare geometry after parse:** *null*

| col | **Output** |
| ----- | ----- |
| \<LineString><br> \<coordinates><br>-71.1663,42.2614<br>-71.1667,42.2616<br>\</coordinates><br>\</LineString> | {"type":"LineString","coordinates":\[\[-71.1663,42.2614],\[-71.1667,42.2616]]} |
| \<Polygon><br>\<extrude>1\</extrude><br>\<altitudeMode>relativeToGround\</altitudeMode><br>\<ou... | {"type":"Polygon","coordinates":\[\[\[-122.0848938459612,37.42257124044786,17.0],\[-122.0847882750515,37... |
| \<Polygon><br>\<extrude>1\</extrude><br>\<altitudeMode>relativeToGround\</altitudeMode><br>\<ou... | {"type":"Polygon","coordinates":\[\[\[-77.05465973756702,38.87291016281703,100.0],\[-77.0531553685479,38... |
| \<Point><br>\<coordinates><br>-71.1663,42.2614<br>\</coordinates><br>\</Point> | {"type":"Point","coordinates":\[-71.1663,42.2614]} |
| \<MultiGeometry><br>\<Polygon><br>\<outerBoundaryIs><br>\<coordinates> -71.1663,42.2614<br>-71.1... | {"type":"MultiPolygon","coordinates":\[\[\[\[-81.1679,32.2614],\[-81.1679,32.28],\[-81.1663,32.28],\[-81.16... |

[See details](/docs/foundry/pb-functions-expression/parseKmlAsGeometryV1/).

***

### Parse KML string as geometry list

> Supported in: Batch, Streaming

Parses KML string as a list of GeoJSONs, ignoring all KML attributes.

**Expression categories:** Geospatial

**Output type:** *Array\<Geometry> | Struct\<ok:Array\<Struct\<ok:Geometry, error:String>>, error:String>*

#### Example

**Argument values:**

* **KML string to parse:** `col`
* **Output mode:** `simple`
* **Prepare geometry after parse:** true

| col | **Output** |
| ----- | ----- |
| \<?xml version="1.0" encoding="utf-8"?><br>\<kml xmlns="http://www.opengis.net/kml/2.2"><br>  \<Do... | \[ {"coordinates":\[\[-122.43193945401, 37.801983684521], \[-122.431564131101, 37.8020327731402], \[-122.43... ] |

[See details](/docs/foundry/pb-functions-expression/parseKmlAsGeometryListV1/).

***

### Parse XML as schema

> Supported in: Batch, Streaming

Parses xml strings following the given schema definition, ignoring any fields not in the schema.

**Expression categories:** File, Struct

**Output type:** *Struct*

#### Example

**Argument values:**

* **Input schema:** Struct\<id:String, airport:Struct\<id:String, miles:Integer>>
* **Xml:** `xml`
* **Attribute prefix:** *null*
* **Ignore namespace:** *null*
* **Output mode:** `SIMPLE`
* **Value tag:** *null*

| xml | **Output** |
| ----- | ----- |
| \<airline><br> \<id>XB-112\</id><br> \<airport><br>   \<id>JFK\</id><br>   \<miles>2000\</miles><br> \</airport><br>\</airline> | {<br> **airport**: {<br> **id**: JFK,<br> **miles**: 2000,<br>},<br> **id**: XB-112,<br>} |

[See details](/docs/foundry/pb-functions-expression/parseXmlAsSchemaV2/).

***

### Parse classification string

> Supported in: Batch, Streaming

Returns the markings parsed from a given classification string. This output is formatted as a struct, where the first element of the struct is an array comprising the classification markings that represent the input. This list is null if the classification string is invalid, or if there are other errors that occur while parsing the markings. The second element of the struct is the string of error message(s). If there are no errors, the error field will be null. This expression is called asynchronously for performance.

**Expression categories:** Other

**Output type:** *Struct\<markingIds:Array\<Classification>, errors:String>*

[See details](/docs/foundry/pb-functions-expression/cbacStringToGroupNamesV3/).

***

### Parse duration

> Supported in: Batch

Parses an ISO8601 string duration and start time to its length in a specific time unit.

**Expression categories:** Datetime, String

**Output type:** *Long*

#### Example

**Argument values:**

* **Duration:** PT1M30.5S
* **Start time:** 2022-10-01T09:00:00Z
* **Unit:** `SECONDS`

**Output:** 90

[See details](/docs/foundry/pb-functions-expression/parseDurationV1/).

***

### Parse phone number

> Supported in: Batch, Streaming

Normalizes phone numbers to a common format, parsing them from various regions and formats. Phone numbers containing the + sign followed by the region code will be parsed correctly even if the region is not set. All other number formats require a region to be selected from the options provided in order for them to be correctly parsed. Phone numbers that cannot be parsed will result in nulls.

**Expression categories:** String

**Output type:** *Phone Number*

#### Example

**Description:** Return formatted US phone number

**Argument values:**

* **Expression:** `phoneNumber`
* **Format:** `E164`
* **Region:** `US`

| phoneNumber | **Output** |
| ----- | ----- |
| (234) 235-5678 | +12342355678 |
| +1 415 5552671 | +14155552671 |
| (415) 5552671 | +14155552671 |
| Whatsapp@14155552671 | +14155552671 |

[See details](/docs/foundry/pb-functions-expression/parsePhoneNumberV2/).

***

### Parse semantic version

> Supported in: Batch, Streaming

Parses a semantic version string into a logical type. Supports both release versions (e.g., "0.987.0") and versions with prerelease metadata (e.g., "0.987.0-16-gb3fb285"). Returns null for strings that do not match the expected format.

**Expression categories:** String

**Output type:** *Semantic Version*

#### Example

**Argument values:**

* **Version string:** `version`

| version | **Output** |
| ----- | ----- |
| 0.987.0-16-gb3fb285 | {<br> major -> 0,<br> minor -> 987,<br> patch -> 0,<br> prerelease -> \[ 16-gb3fb285 ],<br>} |
| 1.0.0-0-g0000000 | {<br> major -> 1,<br> minor -> 0,<br> patch -> 0,<br> prerelease -> \[ 0-g0000000 ],<br>} |
| 2.5.3-42-gabc1234 | {<br> major -> 2,<br> minor -> 5,<br> patch -> 3,<br> prerelease -> \[ 42-gabc1234 ],<br>} |
| 0.987.0-SNAPSHOT | {<br> major -> 0,<br> minor -> 987,<br> patch -> 0,<br> prerelease -> \[ SNAPSHOT ],<br>} |

[See details](/docs/foundry/pb-functions-expression/parseSemanticVersionV1/).

***

### Parse well known binary as geometry

> Supported in: Batch, Faster, Streaming

Converts well-known binary (WKB) to geometry logical type. Invalid WKB input will be returned as null. Optionally supply a source coordinate system identifier to convert from the source coordinate system to WGS 84 if the WKB is not in WGS 84 already.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Expression:** `wkb`
* **Source coordinate system:** *null*

| wkb | **Output** |
| ----- | ----- |
| AAAAAAFACAAAAAAAAEAUAAAAAAAA | {"type":"Point","coordinates":\[3.0, 5.0]} |
| AIAAAAFACAAAAAAAAEAUAAAAAAAAQAAAAAAAAAA= | {"type":"Point","coordinates":\[3.0, 5.0, 2.0]} |
| AAAAAAMAAAABAAAABAAAAAAAAAAAAAAAAAAAAAA/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} |
| AAAAAAIAAAACAAAAAAAAAAAAAAAAAAAAAD/wAAAAAAAAAAAAAAAAAAA= | {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} |

[See details](/docs/foundry/pb-functions-expression/parseWellKnownBinaryAsGeometryV1/).

***

### Parse well known text as geometry

> Supported in: Batch, Faster, Streaming

Converts well-known text (WKT) string to geometry logical type. Invalid WKT input will be returned as null. Optionally supply a source coordinate system identifier to convert from the source coordinate system to WGS 84 if the WKT is not in WGS 84 already.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Expression:** `wkt`
* **Source coordinate system:** *null*

| wkt | **Output** |
| ----- | ----- |
| POINT (3.0 5.0 2.0) | {"type":"Point","coordinates":\[3.0, 5.0, 2.0]} |
| POLYGON ((0.0 0.0, 1.0 0.0, 0.0 1.0, 0.0 0.0)) | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0],\[0.0,1.0],\[0.0,0.0]]]} |
| LINESTRING (0.0 0.0, 1.0 0.0) | {"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]} |

[See details](/docs/foundry/pb-functions-expression/parseWellKnownTextAsGeometryV1/).

***

### Perimeter

> Supported in: Batch, Streaming

Calculates perimeter of a geometry in meters using a spherical approximation of the globe. For a line string or a point, this equals 0.

**Expression categories:** Geospatial

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/perimeterV1/).

***

### Positive modulo

> Supported in: Batch, Faster

Returns positive modulus of an expression.

**Expression categories:** Numeric

**Type variable bounds:** *T1 accepts Byte | Integer | Long | Short\*\*T2 accepts Byte | Integer | Long | Short*

**Output type:** *T1*

#### Example

**Argument values:**

* **Denominator:** 3
* **Numerator:** 10

**Output:** 1

[See details](/docs/foundry/pb-functions-expression/positiveModuloV1/).

***

### Power of

> Supported in: Batch, Faster, Streaming

Calculates power of expression to exponent. If any of the values is null, returns null.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Exponent:** 3
* **Expression:** 10

**Output:** 1000.0

[See details](/docs/foundry/pb-functions-expression/powerOfV1/).

***

### Prepare geometry

> Supported in: Batch, Streaming

Prepares a geometry for downstream use, for example indexing to the ontology, by converting a geometry string into valid GeoJSON. Polygons will be closed and deduplicated. Geometries which cross the anti-meridian (as indicated by width > 180 degrees) will be split into multiple features on each side of the anti-meridian. By default, this operation will return the converted geometry, or null if the string cannot be converted. Alternatively, in the "show errors" output mode, this operation will instead output a struct containing either the successfully parsed output or a descriptive error message.

**Expression categories:** Geospatial

**Output type:** *Geometry | Struct\<ok:Geometry, error:String>*

#### Example

**Argument values:**

* **Geometry string:** `geometry`
* **Output mode:** *null*

| geometry | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[10.0,0.0],\[10.0,10.0],\[0.0,10.0],\[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0,1.0],\[1.0,0.0,1.0],\[0.0,1.0,1.0],\[0.0,0.0,1.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0,1.0],\[0.0,1.0,1.0],\[1.0,0.0,1.0],\[0.0,0.0,1.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0], \[0.0,1.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[1.0,0.0], \[1.0,0.0], \[0.0,1.0], \[0.0,0.0]]]} | {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[179.0,-30.0],\[-179.0,-30.0],\[-179.0,30.0],\[179.0,30.0],\[179.0,-30]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[-180.0,-30.0],\[-180.0,30.0],\[-179.0,30.0],\[-179.0,-30.0],\[-180.0,-30.0]]],\[\[\[180.0,30.0],\[180.0,-30.0],\[179.0,-30.0],\[179.0,30.0],\[180.0,30.0]]]]} |
| {"type":"LineString","coordinates":\[\[179.0,30.0],\[-179.0,30.0]]} | {"type":"MultiLineString","coordinates":\[\[\[179.0,30.0],\[180.0,30.0]],\[\[-180.0,30.0],\[-179.0,30.0]]]} |
| {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[40.0,10.0],\[0.0,1.0]... | {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[40.0,10.0],\[0.0,1.0]... |
| {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[1.0,0.0]},{"type":"LineString","coordinates":\[\[179.0,30.0],\[-179.0,30.0]]}]} | {"type":"GeometryCollection","geometries":\[{"type":"Point","coordinates":\[1.0,0.0]},{"type":"MultiLineString","coordinates":\[\[\[179.0,30.0],\[180.0,30.0]],\[\[-180.0,30.0],\[-179.0,30.0]]]}]} |
| {"type":"GeometryCollection","geometries":\[{"type":"LineString","coordinates":\[\[0.0,0.0],\[1.0,0.0]]}... | {"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[1.0,0.0]],\[\[1.0,1.0],\[2.0,1.0]]]} |
| {"type":"GeometryCollection","geometries":\[{"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[1.0,0.0]],\[],\[\[1.0,1.0],\[2.0,1.0]]]},{"type":"MultiPoint","coordinates":\[\[0.0,0.0],\[1.0,1.0]]}]} | {"geometries":\[{"coordinates":\[\[\[0.0,0.0],\[1.0,0.0]],\[\[1.0,1.0],\[2.0,1.0]]],"type":"MultiLineString"},{"coordinates":\[\[0.0,0.0],\[1.0,1.0]],"type":"MultiPoint"}],"type":"GeometryCollection"} |
| {"type":"MultiPolygon","coordinates":\[\[\[\[1.0,1.0],\[2.0,1.0],\[2.0,2.0],\[1.0,2.0],\[1.0,1.0]]],\[\[]],\[\[\[10.0,10.0],\[20.0,10.0],\[20.0,20.0],\[10.0,20.0],\[10.0,10.0]]]]} | {"type":"MultiPolygon","coordinates":\[\[\[\[1.0,2.0],\[2.0,2.0],\[2.0,1.0],\[1.0,1.0],\[1.0,2.0]]],\[\[\[10.0,20.0],\[20.0,20.0],\[20.0,10.0],\[10.0,10.0],\[10.0,20.0]]]]} |

[See details](/docs/foundry/pb-functions-expression/normalizeGeometryV4/).

***

### Reduce array elements

> Supported in: Batch, Streaming

Reduces array elements using an expression.

**Expression categories:** Array

**Type variable bounds:** *T accepts Array\<Boolean | Byte | Date | Double | Float | Integer | Long | Map\<AnyType, AnyType> | Short | String | Timestamp> | Boolean | Byte | Date | Double | Float | Integer | Long | Map\<AnyType, AnyType> | Short | String | Timestamp*

**Output type:** *T*

#### Example

**Argument values:**

* **Array:** `miles`
* **Expression to reduce:** <br>add(<br> expressions: \[`accumulator`, `element`],<br>)
* **Initial value:** 0

| miles | **Output** |
| ----- | ----- |
| \[ 12300, 12342 ] | 24642 |

[See details](/docs/foundry/pb-functions-expression/reduceArrayElementsV1/).

***

### Regex extract

> Supported in: Batch, Faster, Streaming

Extracts the specified group from a regex. Returns empty string when no match is found.

**Expression categories:** Regex, String

**Output type:** *String*

#### Example

**Description:** Extract the first two initials from the first match.

**Argument values:**

* **Expression:** MT-112, XB-967
* **Group:** 1
* **Pattern:** (\w\w)(-)

**Output:** MT

[See details](/docs/foundry/pb-functions-expression/regexExtractV1/).

***

### Regex find

> Supported in: Batch, Faster, Streaming

Matches an expression against a regular expression. Regular expression can match any part of the string.

**Expression categories:** Regex, String

**Output type:** *Boolean*

#### Example

**Description:** You can find regex patterns.

**Argument values:**

* **Expression:** abcdefg
* **Regex:** abc?d

**Output:** true

[See details](/docs/foundry/pb-functions-expression/regexFindV1/).

***

### Regex index

> Supported in: Batch, Faster, Streaming

Returns an array of indices (counted as Unicode code points) at which the regular expression pattern is found in the given expression.

**Expression categories:** Regex, String

**Output type:** *Array\<Integer>*

#### Example

**Description:** You can find regex patterns and their indices.

**Argument values:**

* **Expression:** ababab
* **Regex:** ab

**Output:** \[ 0, 2, 4 ]

[See details](/docs/foundry/pb-functions-expression/regexIndexV2/).

***

### Regex match

> Supported in: Batch, Faster, Streaming

Matches an expression against a regular expression. Regular expression must match the whole string.

**Expression categories:** Regex, String

**Output type:** *Boolean*

#### Example

**Description:** You can match regex patterns

**Argument values:**

* **Expression:** abcdefg
* **Regex:** abc?d.+

**Output:** true

[See details](/docs/foundry/pb-functions-expression/regexMatchV2/).

***

### Regex replace

> Supported in: Batch, Faster, Streaming

Replace a string using a regex pattern.

**Expression categories:** Regex, String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `tail_number`
* **Pattern:** (\w\w)(-)
* **Replace:** \*\*-

| tail\_number | **Output** |
| ----- | ----- |
| MT-123 | \*\*-123 |
| XB-434 | \*\*-434 |
| MT-123, XB-434 | \*\*-123, \*\*-434 |

[See details](/docs/foundry/pb-functions-expression/regexReplaceV1/).

***

### Remove map entry by key

> Supported in: Batch, Streaming

Removes a map entry by the given key.

**Expression categories:** Map

**Type variable bounds:** *K accepts AnyType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

#### Example

**Argument values:**

* **Key:** k
* **Map:** `map_col`

| map\_col | **Output** |
| ----- | ----- |
| {<br> a -> 1,<br> k -> 2,<br>} | {<br> a -> 1,<br>} |

[See details](/docs/foundry/pb-functions-expression/removeMapEntryByKeyV1/).

***

### Rename struct field

> Supported in: Batch, Faster, Streaming

Rename fields within a struct.

**Expression categories:** Data preparation, Struct

**Output type:** *Struct*

#### Example

**Argument values:**

* **Expression:** `struct`
* **Renames:** \[(airline.id, identifier)]

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **id**: NA,<br>},<br>} | {<br> **airline**: {<br> **identifier**: NA,<br>},<br>} |
| {<br> **airline**: {<br> **id**: FE,<br>},<br>} | {<br> **airline**: {<br> **identifier**: FE,<br>},<br>} |

[See details](/docs/foundry/pb-functions-expression/renameStructFieldV1/).

***

### Right of string

> Supported in: Batch, Faster, Streaming

Extract right hand side of a string based on index.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** Hello world!
* **Length:** 6

**Output:** world!

[See details](/docs/foundry/pb-functions-expression/rightStringV1/).

***

### Right pad string

> Supported in: Batch, Faster, Streaming

Right-pad the string column to width of length with pad. If the length of the string is greater than the length provided, it will be trimmed.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** Hello world!
* **Length:** 15
* **Pad:** \*

**Output:** Hello world!\*\*\*

[See details](/docs/foundry/pb-functions-expression/rightPadV1/).

***

### Round number

> Supported in: Batch, Faster, Streaming

Round number to 'scale' decimal places.

**Expression categories:** Numeric

**Output type:** *Decimal | Double | Float*

#### Example

**Argument values:**

* **Column:** 10.123
* **Scale:** 2

**Output:** 10.12

[See details](/docs/foundry/pb-functions-expression/roundV1/).

***

### Secant

> Supported in: Batch, Faster, Streaming

Takes the secant of an angle.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Angle unit:** `degrees`
* **Angle value:** `angle`

| angle | **Output** |
| ----- | ----- |
| 0.0 | 1.0 |
| 90.0 | 1.633123935319537E16 |
| 180.0 | -1.0 |

[See details](/docs/foundry/pb-functions-expression/secantV1/).

***

### Sentence case

> Supported in: Batch, Faster, Streaming

Converts the first character of the first word to be uppercase.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** hello world

**Output:** Hello world

[See details](/docs/foundry/pb-functions-expression/sentenceCaseV1/).

***

### Sequence

> Supported in: Batch, Faster, Streaming

Creates an array with numbers in range from start to end.

**Expression categories:** Array

**Type variable bounds:** *T accepts Byte | Integer | Long | Short*

**Output type:** *Array\<T>*

#### Example

**Description:** Sequences increase by 1 unless otherwise specified.

**Argument values:**

* **End:** 10
* **Start:** 0
* **Step size:** *null*

**Output:** \[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]

[See details](/docs/foundry/pb-functions-expression/sequenceV2/).

***

### Similarity score

> Supported in: Batch

Returns the similarity score of two embedding vectors.

**Expression categories:** Distance measurement, Numeric

**Type variable bounds:** *T accepts Array\<Float>*

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/similarityScoreV1/).

***

### Simplify geometry

> Supported in: Batch, Faster, Streaming

This expression simplifies GeoJSON geometry by removing points within the given tolerance distance using a spherical model of the globe. Loops smaller than the tolerance may be removed entirely.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Geometry:** `Geometry`
* **Tolerance:** `Tolerance`
* **Coordinate precision:** *null*

| Geometry | Tolerance | **Output** |
| ----- | ----- | ----- |
| {"type":"LineString","coordinates":\[\[30.0,0.0],\[35.0,0.0],\[40.0,0.0]]} | 1000 | {"type":"LineString","coordinates":\[\[30.0,0.0],\[40.0,0.0]]} |
| {"type":"Polygon","coordinates":\[\[\[-1.0,-1.0],\[1.0,-1.0],\[1.0,1.0],\[0.0,1.0],\[-1.0,1.0],\[-1.0,-1.0]]]} | 12000 | {"type":"Polygon","coordinates":\[\[\[-1.0,1.0],\[1.0,1.0],\[1.0,-1.0],\[-1.0,-1.0],\[-1.0,1.0]]]} |
| {"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[5.0,0.1],\[10.0,0.0]], \[\[0.0,-5.0],\[5.0,0.1],\[10.0,5.0]]]} | 12000 | {"type":"MultiLineString","coordinates":\[\[\[0.0,0.0],\[10.0,0.0]],\[\[0.0,-5.0],\[10.0,5.0]]]} |
| {"type":"MultiPolygon","coordinates":\[\[\[\[-2.0,-2.0],\[2.0,-2.0],\[2.0,2.0],\[0.0,2.1],\[-2.0,2.0],\[-2.0,... | 12000 | {"type":"MultiPolygon","coordinates":\[\[\[\[-2.0,2.0],\[2.0,2.0],\[2.0,-2.0],\[-2.0,-2.0],\[-2.0,2.0]], \[\[1... |

[See details](/docs/foundry/pb-functions-expression/simplifyGeometryV1/).

***

### Sine

> Supported in: Batch, Faster, Streaming

Takes the sine of an angle.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Angle unit:** `degrees`
* **Angle value:** `angle`

| angle | **Output** |
| ----- | ----- |
| 0.0 | 0.0 |
| 90.0 | 1.0 |
| 180.0 | 0.0 |

[See details](/docs/foundry/pb-functions-expression/sineV1/).

***

### Skip bytes

> Supported in: Batch, Faster, Streaming

Skip a given number of bytes in a binary column.

**Expression categories:** Binary

**Output type:** *Binary*

#### Example

**Argument values:**

* **Bytes:** aGk=
* **Number of bytes to skip:** 1

**Output:** aQ==

[See details](/docs/foundry/pb-functions-expression/skipBytesV1/).

***

### Slice array

> Supported in: Batch, Faster, Streaming

Returns the array sliced from the first position to the second position. First position must be 1 or higher. If second position is longer than the array, the entire rest of the array will be returned.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

[See details](/docs/foundry/pb-functions-expression/arraySliceV1/).

***

### Soundex

> Supported in: Batch, Faster

Compute the soundex encoding (a phonetic representation) for a word.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `input_string`

| input\_string | **Output** |
| ----- | ----- |
| cat | C300 |
| caat | C300 |
| two | T000 |
| too | T000 |
| to | T000 |
| four | F600 |
| for | F600 |
| fore | F600 |
| fur | F600 |
| meow | M000 |
| me ow | M000 |

[See details](/docs/foundry/pb-functions-expression/soundexV1/).

***

### Split string

> Supported in: Batch, Faster, Streaming

Split string on specified regex pattern.

**Expression categories:** String

**Output type:** *Array\<String>*

#### Example

**Argument values:**

* **Expression:** `string`
* **Pattern:**
* **Limit:** 2

| string | **Output** |
| ----- | ----- |
| hello | \[ hello ] |
| hello world | \[ hello, world ] |
| hello there world | \[ hello, there world ] |

[See details](/docs/foundry/pb-functions-expression/splitStringV2/).

***

### Square root

> Supported in: Batch, Faster, Streaming

Calculates the square root of a column.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Expression:** 9.0

**Output:** 3.0

[See details](/docs/foundry/pb-functions-expression/sqrtV1/).

***

### Starts with

> Supported in: Batch, Faster, Streaming

**Expression categories:** Boolean, String

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** Hello world
* **Ignore case:** true
* **Value:** hello

**Output:** true

[See details](/docs/foundry/pb-functions-expression/startsWithV1/).

***

### String after delimiter

> Supported in: Batch, Faster, Streaming

Extract the string after the first delimiter. Return full string if no matches are found.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Delimiter:** hello
* **Expression:** ... Hello world
* **Ignore case:** true

**Output:** world

[See details](/docs/foundry/pb-functions-expression/stringAfterDelimiterV1/).

***

### String before delimiter

> Supported in: Batch, Faster, Streaming

Extract the string before the first delimiter. Return the full string if no matches are found.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Delimiter:** hello
* **Expression:** ... Hello world
* **Ignore case:** true

**Output:** ...

[See details](/docs/foundry/pb-functions-expression/stringBeforeDelimiterV1/).

***

### String contains

> Supported in: Batch, Faster, Streaming

**Expression categories:** Boolean, String

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** ... Hello world
* **Ignore case:** true
* **Value:** hello

**Output:** true

[See details](/docs/foundry/pb-functions-expression/stringContainsV1/).

***

### Substring

> Supported in: Batch, Faster, Streaming

Extract substring.

**Expression categories:** Numeric

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `string`
* **Start:** `start`
* **Length:** `length`

| string | start | length | **Output** |
| ----- | ----- | ----- | ----- |
| hello, world | 1 | 5 | hello |
| hello, world | 8 | 5 | world |
| hello, world | -5 | 5 | world |

[See details](/docs/foundry/pb-functions-expression/substringV1/).

***

### Subtract multiple expressions

> Supported in: Batch, Faster, Streaming

Calculates the difference between a number and all input columns.

**Expression categories:** Numeric

**Output type:** *Numeric*

#### Example

**Argument values:**

* **Expressions list:** \[`col_b`, `col_c`]
* **Value to be subtracted:** `col_a`

| col\_a | col\_b | col\_c | **Output** |
| ----- | ----- | ----- | ----- |
| 5 | 3 | 2 | 0 |
| 2 | 4 | 0 | -2 |
| -2 | -4 | -2 | 4 |

[See details](/docs/foundry/pb-functions-expression/subtractManyV1/).

***

### Subtract numbers

> Supported in: Batch, Faster, Streaming

Subtract one number from another number.

**Expression categories:** Numeric

**Output type:** *Numeric*

#### Example

**Argument values:**

* **Left:** `col_a`
* **Right:** `col_b`

| col\_a | col\_b | **Output** |
| ----- | ----- | ----- |
| 32 | 4 | 28 |
| -5 | -3 | -2 |

[See details](/docs/foundry/pb-functions-expression/subtractV1/).

***

### Subtract value from date

> Supported in: Batch, Faster, Streaming

Returns the date that is 'value' days/weeks/months/quarter/years before 'start'.

**Expression categories:** Datetime

**Output type:** *Date*

#### Example

**Argument values:**

* **Date:** 2022-04-05
* **Unit:** `DAYS`
* **Value:** 2

**Output:** 2022-04-03

[See details](/docs/foundry/pb-functions-expression/dateSubV2/).

***

### Sum of array elements

> Supported in: Batch, Faster, Streaming

Sums the elements contained within the array.

**Expression categories:** Array

**Type variable bounds:** *T accepts DefiniteNumeric*

**Output type:** *T*

#### Example

**Argument values:**

* **Expression:** \[ 1, 2, 3 ]
* **Treat null as zero:** true

**Output:** 6

[See details](/docs/foundry/pb-functions-expression/arraySumV1/).

***

### Tangent

> Supported in: Batch, Faster, Streaming

Takes the tangent of an angle.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Angle unit:** `degrees`
* **Angle value:** `angle`

| angle | **Output** |
| ----- | ----- |
| 0.0 | 0.0 |
| 90.0 | 1.633123935319537E16 |
| 180.0 | 0.0 |

[See details](/docs/foundry/pb-functions-expression/tangentV1/).

***

### Text segmentation

> Supported in: Batch, Faster, Streaming

Extract a series of text segments using sliding window segmentation.

**Expression categories:** String

**Output type:** *Array\<String>*

[See details](/docs/foundry/pb-functions-expression/textSegmentationV1/).

***

### Text to embeddings

> Supported in: Batch

Converts text into embeddings.

**Expression categories:** String

**Output type:** *Embedded vector*

#### Example

**Description:** Example embeddings for the word 'palantir'.

**Argument values:**

* **Model:** <br>ada002Embedding(<br><br>)
* **Text column:** `text`
* **Output mode:** *null*

| text | **Output** |
| ----- | ----- |
| palantir | \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... |

[See details](/docs/foundry/pb-functions-expression/textToEmbeddingsV2/).

***

### Timestamp add

> Supported in: Batch, Faster, Streaming

Add value to timestamp in specified unit.

**Expression categories:** Datetime

**Output type:** *Timestamp*

#### Example

**Argument values:**

* **Timestamp:** 2022-02-01T00:00:00Z
* **Unit:** `MILLISECONDS`
* **Value to add:** 2

**Output:** 2022-02-01T00:00:00.002Z

[See details](/docs/foundry/pb-functions-expression/timestampAddV1/).

***

### Timestamp difference

> Supported in: Batch, Faster, Streaming

Returns the difference between two timestamps in the given time unit.

**Expression categories:** Datetime

**Output type:** *Long*

#### Example

**Argument values:**

* **End:** 2022-10-01T10:00:00Z
* **Start:** 2022-10-01T09:00:00Z
* **Unit:** `HOURS`

**Output:** 1

[See details](/docs/foundry/pb-functions-expression/timestampDiffV1/).

***

### Timestamp sequence

> Supported in: Batch, Faster

Creates an array with timestamps in range from start to end.

**Expression categories:** Datetime

**Output type:** *Array\<Timestamp>*

#### Example

**Argument values:**

* **End time:** `end_time`
* **Start time:** `start_time`
* **Step unit:** `DAYS`
* **Step size:** 1.0

| start\_time | end\_time | **Output** |
| ----- | ----- | ----- |
| 2023-01-01T00:00:00Z | 2023-01-03T00:00:00Z | \[ 2023-01-01T00:00:00Z, 2023-01-02T00:00:00Z, 2023-01-03T00:00:00Z ] |
| 2023-01-01T01:50:00Z | 2023-01-03T00:00:00Z | \[ 2023-01-01T01:50:00Z, 2023-01-02T01:50:00Z ] |

[See details](/docs/foundry/pb-functions-expression/timestampSequenceV1/).

***

### Timestamp subtract

> Supported in: Batch, Faster, Streaming

Subtract value from timestamp in specified unit.

**Expression categories:** Datetime

**Output type:** *Timestamp*

#### Example

**Argument values:**

* **Timestamp:** 2022-02-02T00:00:00Z
* **Unit:** `MILLISECONDS`
* **Value to subtract:** 2

**Output:** 2022-02-01T23:59:59.998Z

[See details](/docs/foundry/pb-functions-expression/timestampSubtractV1/).

***

### Timestamp to epoch millis

> Supported in: Batch, Faster, Streaming

Converts from timestamp in UTC to epoch milliseconds.

**Expression categories:** Cast, Datetime

**Output type:** *Long*

#### Example

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z

**Output:** 1664614800000

[See details](/docs/foundry/pb-functions-expression/timestampToEpochMillisV1/).

***

### Timestamp to epoch seconds

> Supported in: Batch, Faster, Streaming

Converts from timestamp in UTC to epoch seconds.

**Expression categories:** Cast, Datetime

**Output type:** *Long*

#### Example

**Argument values:**

* **Timestamp:** 2022-10-01T09:01:13.47Z

**Output:** 1664614873

[See details](/docs/foundry/pb-functions-expression/timestampToEpochSecondsV1/).

***

### Title case

> Supported in: Batch, Faster, Streaming

Converts the first character of each word to be uppercase and the rest lowercase.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** hello world

**Output:** Hello World

[See details](/docs/foundry/pb-functions-expression/titleCaseV1/).

***

### Token set ratio

> Supported in: Batch, Streaming

Compute the token set ratio between two strings. Token set ratio is a metric describing how similar two strings are, and will return a value between 0 and 1, where 0 means that there are no similarities between the two strings and 1 means that they are the same (or one is a substring of the other).

**Expression categories:** Distance measurement, String

**Output type:** *Double*

#### Example

**Argument values:**

* **Ignore case:** false
* **Left:** `left`
* **Right:** `right`

| left | right | **Output** |
| ----- | ----- | ----- |
| hello world | world hello | 1.0 |
| Hello | hello world | 0.5 |
| hello hello WorlD | hello world | 0.8181818181818181 |
| hello | farewell | 0.46153846153846156 |
| *empty string* | *empty string* | 1.0 |

[See details](/docs/foundry/pb-functions-expression/tokenSetRatioV1/).

***

### Transcribe audio into JSON using CPU

> Supported in: Batch

Transcribe audio files into JSON using CPU.

**Expression categories:** Media

**Output type:** *String*

[See details](/docs/foundry/pb-functions-expression/cpuJsonAudioTranscriptionV1/).

***

### Transcribe audio into JSON using GPU

> Supported in: Batch

Transcribe audio files into JSON using GPU.

**Expression categories:** Media

**Output type:** *String*

[See details](/docs/foundry/pb-functions-expression/gpuJsonAudioTranscriptionV1/).

***

### Transcribe audio into text

> Supported in: Batch, Faster

Transcribes an audio file into text.

**Expression categories:** Media

**Output type:** *String | Struct\<ok:String, error:String>*

[See details](/docs/foundry/pb-functions-expression/audioTranscriptionV1/).

***

### Transform array element

> Supported in: Batch, Streaming

Maps each element of an array using an expression. Note, array index starts at 1.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Array:** `flight_number`
* **Expression to apply:** <br>stringBeforeDelimiter(<br> delimiter: -,<br> expression: `element`,<br> ignoreCase: false,<br>)

| flight\_number | **Output** |
| ----- | ----- |
| \[ XB-134, MT-111 ] | \[ XB, MT ] |

[See details](/docs/foundry/pb-functions-expression/transformArrayElementV1/).

***

### Transform map keys

> Supported in: Batch, Streaming

Transforms keys of a map by applying an expression to every key-value pair.

**Expression categories:** Map

**Type variable bounds:** *K accepts AnyType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

#### Example

**Argument values:**

* **Expression to apply:** <br>stringBeforeDelimiter(<br> delimiter: -,<br> expression: `key`,<br> ignoreCase: false,<br>)
* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> MT-111 -> 2,<br> XB-134 -> 1,<br>} | {<br> MT -> 2,<br> XB -> 1,<br>} |

[See details](/docs/foundry/pb-functions-expression/transformMapKeysV1/).

***

### Transform map values

> Supported in: Batch

Transforms values of a map by applying an expression to every key-value pair.

**Expression categories:** Map

**Type variable bounds:** *K accepts AnyType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

#### Example

**Argument values:**

* **Expression to apply:** <br>stringBeforeDelimiter(<br> delimiter: -,<br> expression: `value`,<br> ignoreCase: false,<br>)
* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> 1 -> XB-134,<br> 2 -> MT-111,<br>} | {<br> 1 -> XB,<br> 2 -> MT,<br>} |

[See details](/docs/foundry/pb-functions-expression/transformMapValuesV1/).

***

### Trim whitespace

> Supported in: Batch, Faster, Streaming

Trims whitespace at beginning and end of string. Whitespace is defined as characters in any of: 1) Unicode's \p{whitespace} set, 2) Java's String#trim() method, or 3) Java's Character#isWhitespace() method.

**Expression categories:** Data preparation, String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:**    hello world

**Output:** hello world

[See details](/docs/foundry/pb-functions-expression/trimV1/).

***

### Truncate date

> Supported in: Batch, Faster

Returns the date rounded down to the nearest day/week/month/quarter/year.

**Expression categories:** Datetime

**Output type:** *Date*

[See details](/docs/foundry/pb-functions-expression/dateTruncateV1/).

***

### Truncate timestamp

> Supported in: Batch, Faster

Returns the timestamp truncated to the specified unit.

**Expression categories:** Datetime

**Output type:** *Timestamp*

#### Example

**Argument values:**

* **Start:** 2022-02-01T10:10:10.0022Z
* **Unit:** `MILLISECONDS`

**Output:** 2022-02-01T10:10:10.002Z

[See details](/docs/foundry/pb-functions-expression/timestampTruncateV1/).

***

### UUID V5

> Supported in: Batch, Streaming

Generates a deterministic UUID v5 from a namespace UUID and a name string using SHA-1 hashing (RFC 4122). The same namespace and name will always produce the same UUID. Returns null if the namespace is not a valid UUID.

**Expression categories:** String

**Output type:** *String*

#### Example

**Description:** Generate a deterministic UUID v5 from a namespace UUID and name string.

**Argument values:**

* **Name:** `name`
* **Namespace UUID:** `namespace`

| namespace | name | **Output** |
| ----- | ----- | ----- |
| 6ba7b810-9dad-11d1-80b4-00c04fd430c8 | hello | 9342d47a-1bab-5709-9869-c840b2eac501 |
| 6ba7b811-9dad-11d1-80b4-00c04fd430c8 | https://example.com | 4fd35a71-71ef-5a55-a9d9-aa75c889a6d0 |

[See details](/docs/foundry/pb-functions-expression/uuidV5V1/).

***

### Uncompact a set of H3 indices

> Supported in: Batch, Faster, Streaming

Uncompact H3 indices to the specified resolution. All input indices must be at a resolution less than or equal to the requested resolution or this transform will return null. If any of the input indices are invalid this transform will return null. Output indices are sorted in ascending order.

**Expression categories:** Geospatial

**Output type:** *Array\<H3 Index>*

[See details](/docs/foundry/pb-functions-expression/uncompactH3SetV1/).

***

### Unicode normalize

> Supported in: Batch, Faster, Streaming

Perform unicode normalization as per Unicode Standard Annex #15.

**Expression categories:** Data preparation, String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `string`
* **Normalization form:** `nfkc`

| string | **Output** |
| ----- | ----- |
| １２３ | 123 |
| イナゴ | イナゴ |

[See details](/docs/foundry/pb-functions-expression/unicodeNormalizeV1/).

***

### Uniform random number

> Supported in: Batch, Faster, Streaming

Returns a column of uniform random numbers drawn between 0 and 1. This is not deterministic and will not produce the same result on repeated builds, even when using a seed.

**Expression categories:** Numeric

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/uniformRandomV1/).

***

### Universally unique identifier (uuid) (unstable)

> Supported in: Batch, Faster, Streaming

Returns a column of UUID. This is not deterministic and will not produce the same result on repeated builds. This is not the preferred way to build an id column and users should look into SHA-256 or others that are deterministic, for example UUID v5.

**Expression categories:** String

**Output type:** *String*

[See details](/docs/foundry/pb-functions-expression/uuidV1/).

***

### Uppercase

> Supported in: Batch, Faster, Streaming

Converts all characters in string to uppercase.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** hello World

**Output:** HELLO WORLD

[See details](/docs/foundry/pb-functions-expression/uppercaseV1/).

***

### Url decode

> Supported in: Batch, Faster, Streaming

Decodes a percent-encoded string to plain text.

**Expression categories:** Cast, String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| raw\_string\_with\_no\_special\_characters | raw\_string\_with\_no\_special\_characters |
| test%2Fapi%3Fstring%3D3 | test/api?string=3 |

[See details](/docs/foundry/pb-functions-expression/urlDecodeV1/).

***

### Url encode

> Supported in: Batch, Faster, Streaming

Percent-encodes a string to be sent in a url.

**Expression categories:** String

**Output type:** *String*

#### Example

**Argument values:**

* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| raw\_string\_with\_no\_special\_characters | raw\_string\_with\_no\_special\_characters |
| test/api?string=3 | test%2Fapi%3Fstring%3D3 |

[See details](/docs/foundry/pb-functions-expression/urlEncodeV1/).

***

### Use LLM

> Supported in: Batch, Faster

Call an LLM with a configurable prompt.

**Expression categories:** String

**Output type:** *Array\<AnyType> | Boolean | Date | Decimal | Double | Float | Integer | Long | Short | String | Struct | Struct\<ok:Array\<AnyType> | Boolean | Date | Decimal | Double | Float | Integer | Long | Short | String | Struct | Timestamp, error:String> | Timestamp*

#### Example

**Argument values:**

* **Model:** <br>gpt4ChatModel(<br> temperature: 0.0,<br>)
* **Prompt:** `prompt`
* **System prompt:** \[In the context of a food delivery app, your job is to rate reviews given in the following user promp...]
* **Output mode:** *null*
* **Output type:** *null*

| prompt | **Output** |
| ----- | ----- |
| The food was great! | 5 |

[See details](/docs/foundry/pb-functions-expression/useLlmV3/).

***

### Value from map

> Supported in: Batch, Faster, Streaming

Get a value from a map using a key.

**Expression categories:** Map

**Type variable bounds:** *K accepts ComparableType\*\*V accepts AnyType*

**Output type:** *V*

#### Example

**Argument values:**

* **Key:** Foo
* **Map:** {<br> Bar -> World,<br> Foo -> Hello,<br>}

**Output:** Hello

[See details](/docs/foundry/pb-functions-expression/valueFromMapV1/).

***

## Aggregate expressions

***

### All of

> Supported in: Batch, Faster

Calculate the boolean 'and' of an aggregate, using SQL standard semantics for null values.

**Expression categories:** Aggregate

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| true |
| false |
| true |

**Outputs:** false

[See details](/docs/foundry/pb-functions-expression/allOfV2/).

***

### Any of

> Supported in: Batch, Faster

Calculate the boolean 'or' of an aggregate. Nulls are considered false.

**Expression categories:** Aggregate

**Output type:** *Boolean*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| true |
| false |
| true |

**Outputs:** true

[See details](/docs/foundry/pb-functions-expression/anyOfV1/).

***

### Approximate median

> Supported in: Batch

Computes approximate median of values in the column.

**Expression categories:** Aggregate

**Output type:** *Numeric*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 3

[See details](/docs/foundry/pb-functions-expression/approxMedianV1/).

***

### Approximate percentile

> Supported in: Batch

Returns the approximate percentile of the expression which is the smallest value in the ordered expression values (sorted from least to greatest) such that no more than percentage of expression values is less than the value or equal to that value.

**Expression categories:** Aggregate

**Output type:** *Array\<Numeric> | Byte | Decimal | Double | Float | Integer | Long | Short*

#### Example

**Argument values:**

* **Expression:** `values`
* **Percentiles:** \[0.5]
* **Accuracy:** *null*

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 3

[See details](/docs/foundry/pb-functions-expression/approximatePercentileV1/).

***

### Collect array

> Supported in: Batch, Faster, Streaming

Collects an array of values within each group. Null values are ignored.

**Expression categories:** Aggregate

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Expression:** `factor`

**Given input table:**

| factor |
| ----- |
| 2 |
| 2 |
| 3 |

**Outputs:** \[ 2, 2, 3 ]

[See details](/docs/foundry/pb-functions-expression/collectArrayV1/).

***

### Collect distinct array

> Supported in: Batch, Faster, Streaming

Collects an array of deduplicated values within each group. Null values are ignored.

**Expression categories:** Aggregate

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *Array\<T>*

#### Example

**Argument values:**

* **Expression:** `factor`

**Given input table:**

| factor |
| ----- |
| 2 |
| 2 |
| 3 |

**Outputs:** \[ 2, 3 ]

[See details](/docs/foundry/pb-functions-expression/collectDistinctArrayV1/).

***

### Covariance

> Supported in: Batch, Streaming

Calculate the population covariance of values in two columns.

**Expression categories:** Aggregate

**Output type:** *Double*

#### Example

**Argument values:**

* **Left:** `left`
* **Right:** `right`

**Given input table:**

| left | right |
| ----- | ----- |
| 1 | 5 |
| 2 | 4 |
| 3 | 3 |
| 4 | 2 |
| 5 | 1 |

**Outputs:** -2.0

[See details](/docs/foundry/pb-functions-expression/covarianceV1/).

***

### Create simple geometries from ordered rows of GeoPoints

> Supported in: Batch

Given a column of GeoPoints and an ordering, return either a polygon or a line string by connecting the GeoPoints in the specified order. This function assumes that the data is tabular, with a single row representing an individual GeoPoint in a line string or in the shell of a polygon, along with a column specifying the order of those points. For a polygon this ordering should identify the points as you move counter-clockwise around the shell. Given an ordering of these points and a partition (grouping), the function constructs the required geometry for that partition by joining the GeoPoints in ascending order of the order-by column.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **GeoPoint:** `geo_point`
* **Order by (ascending):** `order`
* **Output geometry type:** `LINE_STRING`

**Given input table:**

| geo\_point | order |
| ----- | ----- |
| {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | 0 |
| {<br> latitude -> 1.0,<br> longitude -> 0.0,<br>} | 1 |
| {<br> latitude -> 1.0,<br> longitude -> 1.0,<br>} | 2 |

**Outputs:** {"type":"LineString","coordinates": \[\[0.0,0.0],\[0.0, 1.0],\[1.0,1.0]]}

[See details](/docs/foundry/pb-functions-expression/createGeometryFromOrderedGeoPointRowsV1/).

***

### Dense rank

> Supported in: Batch, Faster

Returns the rank of rows within a window partition, without any gaps. In case of ties the rows get same rank. The difference between rank and dense\_rank is that dense\_rank leaves no gaps in ranking sequence when there are ties.

**Expression categories:** Aggregate

**Output type:** *Integer*

[See details](/docs/foundry/pb-functions-expression/denseRankV1/).

***

### Distinct count

> Supported in: Batch, Faster, Streaming

Calculate distinct number of values in column.

**Expression categories:** Aggregate

**Output type:** *Long*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 3

[See details](/docs/foundry/pb-functions-expression/distinctCountV1/).

***

### First

> Supported in: Batch, Faster, Streaming

First item in the group. Note, if used within an aggregate or unordered window, the row selected will be non-deterministic.

**Expression categories:** Aggregate

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

#### Example

**Argument values:**

* **Expression:** `values`
* **Ignore nulls:** false

**Given input table:**

| values |
| ----- |
| *null* |
| 2 |
| 4 |
| 3 |

**Outputs:** *null*

[See details](/docs/foundry/pb-functions-expression/firstV1/).

***

### Grouped geometry envelope

> Supported in: Batch, Faster

Returns the envelope of all valid geometries in the given column. Invalid geometries are treated as null and ignored.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Expression:** `geometry`

**Given input table:**

| geometry |
| ----- |
| {"type":"LineString","coordinates":\[\[1,0],\[0,8.4]]} |
| {"type":"Point","coordinates":\[125.6, -92.3]} |
| {"type":"Polygon","coordinates":\[\[\[0,0],\[1,6.3],\[-6,1],\[0,0]]]} |

**Outputs:** {"type":"Polygon","coordinates":\[\[\[-6.0,-92.3],\[-6.0,8.4],\[125.6,8.4],\[125.6,-92.3],\[-6.0,-92.3]]]}

[See details](/docs/foundry/pb-functions-expression/groupedGeometryEnvelopeV1/).

***

### Grouped geometry union

> Supported in: Batch

Combines the grouped geometries to create a single geometry.

**Expression categories:** Geospatial

**Output type:** *Geometry*

#### Example

**Argument values:**

* **Expression:** `geometry`

**Given input table:**

| geometry |
| ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[1.0,1.0],\[1.0,0.0],\[0.0,0.0]]]} |
| {"type":"Polygon","coordinates":\[\[\[0.5,0.0],\[1.5,0.0],\[1.5,1.0],\[0.5,1.0],\[0.5,0.0]]]} |

**Outputs:** {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,1.0],\[0.5,1.0],\[1.0,1.0],\[1.5,1.0],\[1.5,0.0],\[1.0,0.0],\[0.5,0.0],\[0.0,0.0]]]}

[See details](/docs/foundry/pb-functions-expression/groupedGeometryUnionV1/).

***

### Grouped latitude/longitude bounding box

> Supported in: Batch

Returns a struct containing the entire bounding box of all valid geometries in the given column. Invalid geometries are treated as null and ignored.

**Expression categories:** Geospatial

**Output type:** *LatLonBoundingBox*

#### Example

**Argument values:**

* **Expression:** `geometry`

**Given input table:**

| geometry |
| ----- |
| {"type":"LineString","coordinates":\[\[1,0],\[0,8.4]]} |
| {"type":"Point","coordinates":\[125.6, -92.3]} |
| {"type":"Polygon","coordinates":\[\[\[0,0],\[1,6.3],\[-6,1],\[0,0]]]} |

**Outputs:** {<br> maxLat -> 8.4,<br> maxLon -> 125.6,<br> minLat -> -92.3,<br> minLon -> -6.0,<br>}

[See details](/docs/foundry/pb-functions-expression/groupedLatLonBoundingBoxV1/).

***

### Lag

> Supported in: Batch, Faster

Returns the value of the input at 'lag' before the current row in the window.

**Expression categories:** Aggregate

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

[See details](/docs/foundry/pb-functions-expression/lagV1/).

***

### Last

> Supported in: Batch, Faster, Streaming

Last item in the group. Note, if used within an aggregate or unordered window, the row selected will be non-deterministic.

**Expression categories:** Aggregate

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

#### Example

**Argument values:**

* **Expression:** `values`
* **Ignore nulls:** false

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |
| *null* |

**Outputs:** *null*

[See details](/docs/foundry/pb-functions-expression/lastV1/).

***

### Lead

> Supported in: Batch, Faster

Returns the value of the input at 'lead' after the current row in the window.

**Expression categories:** Aggregate

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

[See details](/docs/foundry/pb-functions-expression/leadV1/).

***

### Linear regression gradient

> Supported in: Batch

Returns the slope of the linear regression line for non-null pairs in a group. Returns null if there are insufficient non-null pairs or if the variance of the independent variable is zero.

**Expression categories:** Aggregate

**Output type:** *Double*

#### Example

**Argument values:**

* **Left:** `left`
* **Right:** `right`

**Given input table:**

| left | right |
| ----- | ----- |
| 1 | 5 |
| 2 | 4 |
| 3 | 3 |
| 4 | 2 |
| 5 | 1 |

**Outputs:** -1.0

[See details](/docs/foundry/pb-functions-expression/linearRegressionGradientV2/).

***

### Max

> Supported in: Batch, Faster, Streaming

Calculate maximum value in column.

**Expression categories:** Numeric

**Output type:** *ComparableType*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 4

[See details](/docs/foundry/pb-functions-expression/maxV1/).

***

### Max by

> Supported in: Streaming

This expression computes a max row according to the max column expression after applying the provided filter specification. If there is no maximum row, null will be returned.

**Expression categories:** Aggregate

**Output type:** *AnyType*

#### Example

**Argument values:**

* **Expression:** `salary`
* **Output projection expression:** `salary`
* **Filter condition:** <br>lessThan(<br> left: `salary`,<br> right: 5000,<br>)

**Given input table:**

| dep\_name | salary |
| ----- | ----- |
| develop | 9900 |
| develop | 4000 |
| develop | 3000 |

**Outputs:** 4000

[See details](/docs/foundry/pb-functions-expression/maxByV1/).

***

### Mean

> Supported in: Batch, Faster, Streaming

Calculate mean of values in column.

**Expression categories:** Numeric

**Output type:** *Decimal | Double*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 3.0

[See details](/docs/foundry/pb-functions-expression/meanV1/).

***

### Median

> Supported in: Batch, Faster

Calculate median of values in column.

**Expression categories:** Numeric

**Output type:** *Decimal | Double*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 3.0

[See details](/docs/foundry/pb-functions-expression/medianV1/).

***

### Min

> Supported in: Batch, Faster, Streaming

Calculate minimum value in column.

**Expression categories:** Numeric

**Output type:** *ComparableType*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 2

[See details](/docs/foundry/pb-functions-expression/minV1/).

***

### Min by

> Supported in: Streaming

This expression computes a min row according to the min column expression after applying the provided filter specification. If there is no minimum row, null will be returned.

**Expression categories:** Aggregate

**Output type:** *AnyType*

#### Example

**Argument values:**

* **Expression:** `salary`
* **Output projection expression:** `salary`
* **Filter condition:** <br>greaterThan(<br> left: `salary`,<br> right: 0,<br>)

**Given input table:**

| dep\_name | salary |
| ----- | ----- |
| develop | -999 |
| develop | 4000 |
| develop | 3000 |

**Outputs:** 3000

[See details](/docs/foundry/pb-functions-expression/minByV1/).

***

### Mode

> Supported in: Batch, Faster

Calculate mode of values in column.

**Expression categories:** Aggregate

**Type variable bounds:** *Any accepts Binary | Boolean | Byte | Date | Decimal | Double | Float | Integer | Long | Short | String | Timestamp*

**Output type:** *Any*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| a |
| b |
| b |
| b |
| c |
| c |
| d |

**Outputs:** b

[See details](/docs/foundry/pb-functions-expression/modeV1/).

***

### Percent rank

> Supported in: Batch, Faster

Returns the percentile of rows within a window partition. A draw is assigned the same percent.

**Expression categories:** Aggregate

**Output type:** *Double*

[See details](/docs/foundry/pb-functions-expression/percentRankV1/).

***

### Pivot

> Supported in: Streaming

Apply an aggregate expression in a pivot context. The aggregation will run as a set of separate aggregations scoped to each distinct value of the pivot expression. The output is a map from pivot value to aggregate expression value.

**Expression categories:** Aggregate

**Type variable bounds:** *K accepts ComparableType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

#### Example

**Argument values:**

* **Aggregate expression:** <br>sum(<br> expression: `value`,<br>)
* **Pivot expression:** `pivot`

**Given input table:**

| pivot | value |
| ----- | ----- |
| a | 1 |
| b | 2 |
| a | 3 |

**Outputs:** {<br> a -> 4,<br> b -> 2,<br>}

[See details](/docs/foundry/pb-functions-expression/pivotExpressionV1/).

***

### Product

> Supported in: Batch

Calculates the product of all input columns.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Expression:** `factor`

**Given input table:**

| factor |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 24.0

[See details](/docs/foundry/pb-functions-expression/productV1/).

***

### Rank

> Supported in: Batch, Faster

Returns the rank of rows within a window partition. In case of ties the rows get same rank. The difference between rank and dense\_rank is that rank leaves gaps in ranking sequence when there are ties.

**Expression categories:** Aggregate

**Output type:** *Integer*

[See details](/docs/foundry/pb-functions-expression/rankV1/).

***

### Row count

> Supported in: Batch, Faster, Streaming

Counts the number of non null rows in a group.

**Expression categories:** Aggregate

**Output type:** *Long*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 3

[See details](/docs/foundry/pb-functions-expression/rowCountV1/).

***

### Row number

> Supported in: Batch, Faster, Streaming

Returns a sequential number starting at 1 inside each partition.

**Expression categories:** Aggregate

**Output type:** *Integer*

[See details](/docs/foundry/pb-functions-expression/rowNumberV1/).

***

### Sample covariance

> Supported in: Batch, Streaming

Calculate the sample covariance of values in two columns.

**Expression categories:** Aggregate

**Output type:** *Double*

#### Example

**Argument values:**

* **Left:** `left`
* **Right:** `right`

**Given input table:**

| left | right |
| ----- | ----- |
| 1 | 5 |
| 2 | 4 |
| 3 | 3 |
| 4 | 2 |
| 5 | 1 |

**Outputs:** -2.5

[See details](/docs/foundry/pb-functions-expression/sampleCovarianceV1/).

***

### Sample variance

> Supported in: Batch, Streaming

Calculate the sample variance of values in column.

**Expression categories:** Aggregate

**Output type:** *Double*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 2 |
| 3 |

**Outputs:** 0.33333333333

[See details](/docs/foundry/pb-functions-expression/sampleVarianceV1/).

***

### Standard deviation

> Supported in: Batch, Faster

Calculate standard deviation of the values in column.

**Expression categories:** Numeric

**Output type:** *Double*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 0.81649658092773

[See details](/docs/foundry/pb-functions-expression/standardDeviationV1/).

***

### Sum

> Supported in: Batch, Faster, Streaming

Sums the specified expression.

**Expression categories:** Numeric

**Output type:** *Decimal | Double | Long*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 9

[See details](/docs/foundry/pb-functions-expression/sumV1/).

***

### Variance

> Supported in: Batch, Streaming

Calculate population variance of values in column.

**Expression categories:** Aggregate

**Output type:** *Double*

#### Example

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 0.66666666667

[See details](/docs/foundry/pb-functions-expression/varianceV1/).

***

## Generator expressions

***

### Explode array

> Supported in: Batch, Faster, Streaming

Explode array into a row per value.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

[See details](/docs/foundry/pb-functions-expression/explodeArrayV1/).

***

### Explode array with position

> Supported in: Batch, Streaming

Explode array into a row per value as a struct containing the element's relative position in the array and the element itself.

**Expression categories:** Array

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Struct\<Optional\[position]:Integer, Optional\[element]:T>*

#### Example

**Argument values:**

* **Array:** `array`
* **Keep empty / null arrays:** *null*

**Given input table:**

| array |
| ----- |
| \[ one, two, three ] |
| \[ four, five ] |

**Expected output table:** | array |
| ----- |
| {<br> element -> one,<br> position -> 1,<br>} |
| {<br> element -> two,<br> position -> 2,<br>} |
| {<br> element -> three,<br> position -> 3,<br>} |
| {<br> element -> four,<br> position -> 1,<br>} |
| {<br> element -> five,<br> position -> 2,<br>} |

[See details](/docs/foundry/pb-functions-expression/explodeArrayWithPositionV2/).

***

### Explode map

> Supported in: Batch, Streaming

Explode map into a row per key, value pair.

**Expression categories:** Map

**Type variable bounds:** *TKey accepts AnyType\*\*TValue accepts AnyType*

**Output type:** *Struct\<Optional\[key]:TKey, Optional\[value]:TValue>*

#### Example

**Argument values:**

* **Expression:** `map`

**Given input table:**

| map |
| ----- |
| {<br> 1 -> val1,<br> 2 -> val2,<br>} |
| {<br> 3 -> val3,<br> 4 -> val4,<br>} |

**Expected output table:** | map |
| ----- |
| {<br> key -> 1,<br> value -> val1,<br>} |
| {<br> key -> 2,<br> value -> val2,<br>} |
| {<br> key -> 3,<br> value -> val3,<br>} |
| {<br> key -> 4,<br> value -> val4,<br>} |

[See details](/docs/foundry/pb-functions-expression/explodeMapV1/).

***

## Transforms

***

### Aggregate

> Supported in: Batch, Faster

Performs the specified aggregations on the input dataset grouped by a set of columns.

**Transform categories**: Aggregate, Popular

#### Example

**Argument values:**

* **Aggregations:** \[<br>alias(<br> alias: factor,<br> expression: <br>sum(<br> expression: `factor`,<br>),<br>)]
* **Dataset:** ri.foundry.main.dataset.aggregate
* **Group by columns:** \[`tail_number`]

**Input:**

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| XB-123 | foundry airline | 1134 | 3 |

**Output:**

| tail\_number | factor |
| ----- | ----- |
| XB-123 | 10 |
| MT-222 | 9 |
| KK-452 | 1 |

[See details](/docs/foundry/pb-functions-transform/aggregateV1/).

***

### Aggregate on condition

> Supported in: Batch, Faster

Aggregate expressions based on a condition statement.

**Transform categories**: Aggregate, Popular

[See details](/docs/foundry/pb-functions-transform/aggregateOnConditionV1/).

***

### Aggregate over window

> Supported in: Streaming

Performs the specified aggregations on the data within a window, emitting outputs as specified by the provided trigger.

**Transform categories**: Aggregate

[See details](/docs/foundry/pb-functions-transform/aggregateOverWindowV2/).

***

### Anti join

> Supported in: Batch, Faster

Anti joins left and right dataset inputs, removing all rows from the left relation that match the provided condition.

**Transform categories**: Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[tail\_number, airline],<br>)
* **Join condition:** <br>equals(<br> left: `tail_number`,<br> right: `tail_number`,<br>)
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right

**Inputs:**

ri.foundry.main.dataset.left

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| PA-452 | new air | 212 | 2 |
| XB-123 | foundry airline | 1134 | 2 |

ri.foundry.main.dataset.right

| tail\_number | home\_airport |
| ----- | ----- |
| XB-123 | LHR |
| MT-222 | CPH |
| KK-452 | JFK |
| JR-201 | IAD |

**Output:**

| tail\_number | airline |
| ----- | ----- |
| PA-452 | new air |

[See details](/docs/foundry/pb-functions-transform/complexAntiJoinV1/).

***

### Apply expression

> Supported in: Batch, Faster, Streaming

Transforms input dataset by applying a single expression.

**Transform categories**: Popular

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.a
* **Expression:** <br>alias(<br> alias: kilometers,<br> expression: <br>convertDistance(<br> amount: `miles`,<br> currentUnit: `mile`,<br> targetUnit: `kilometer`,<br>),<br>)

**Input:**

| airline | miles |
| ----- | ----- |
| foundry airways | 2500 |
| new air | 3000 |

**Output:**

| kilometers | airline | miles |
| ----- | ----- | ----- |
| 4023.36 | foundry airways | 2500 |
| 4828.03 | new air | 3000 |

[See details](/docs/foundry/pb-functions-transform/applyExpressionV1/).

***

### Apply multiple expressions

> Supported in: Batch, Faster, Streaming

Transforms input dataset either by selecting columns or applying functions to columns.

**Transform categories**: Popular

#### Example

**Argument values:**

* **Columns:** \[<br>alias(<br> alias: airline,<br> expression: `airline`,<br>)]
* **Dataset:** ri.foundry.main.dataset.a
* **Keep remaining columns:** false

**Input:**

| airline | miles |
| ----- | ----- |
| foundry airways | 2500 |
| new air | 3000 |

**Output:**

| airline |
| ----- |
| foundry airways |
| new air |

[See details](/docs/foundry/pb-functions-transform/projectV1/).

***

### Apply to multiple columns

> Supported in: Batch, Faster, Streaming

Transforms input dataset either by selecting columns or applying functions to columns.

**Transform categories**: Popular

[See details](/docs/foundry/pb-functions-transform/projectOnConditionV1/).

***

### Array elements to columns

> Supported in: Batch, Faster

Extracts elements from an array into columns.

**Transform categories**: Array

#### Example

**Argument values:**

* **Array:** `stats`
* **Columns to extract:** \[miles, id]
* **Dataset:** ri.foundry.main.dataset.a

**Input:**

| stats |
| ----- |
| \[ 1000, 2 ] |

**Output:**

| miles | id | stats |
| ----- | ----- | ----- |
| 1000 | 2 | \[ 1000, 2 ] |

[See details](/docs/foundry/pb-functions-transform/arrayToColumnsV1/).

***

### Assign timestamps and watermarks

> Supported in: Streaming

Assigns timestamps and watermarks to the input, filtering out records where the timestamp is null.

**Transform categories**: Other

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.a
* **Timestamp expression:** `timestamp`
* **Emit watermark on every record:** *null*
* **Idleness timeout unit:** *null*
* **Idleness timeout value:** *null*

**Input:**

| timestamp | temperature | sensor\_id |
| ----- | ----- | ----- |
| 1969-12-31T23:59:50Z | 28 | sensor\_1 |
| 1969-12-31T23:59:40Z | 30 | sensor\_2 |
| 1969-12-31T23:59:35Z | 29 | sensor\_1 |

**Output:**

| timestamp | temperature | sensor\_id |
| ----- | ----- | ----- |
| 1969-12-31T23:59:50Z | 28 | sensor\_1 |
| 1969-12-31T23:59:40Z | 30 | sensor\_2 |
| 1969-12-31T23:59:35Z | 29 | sensor\_1 |

[See details](/docs/foundry/pb-functions-transform/assignTimestampsAndWatermarksV1/).

***

### Coalesce data

> Supported in: Batch, Faster

Operation to reduce the number of partitions. If you have 1000 partitions and you coalesce to 100 there will not be a shuffle, instead each of the 100 new partitions will claim 10 of the current partitions. If a larger number of partitions is requested, it will stay at the current number of partitions.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/coalesceV1/).

***

### Compute if expression absent

> Supported in: Batch

Computes the expression for new rows, the value for a given key will only ever be computed once, even across builds.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/computeExpressionIfAbsentV1/).

***

### Convert media set to table rows

> Supported in: Batch

Produces a dataset containing media references and basic metadata for media items in a media set.

**Transform categories**: File, Media

[See details](/docs/foundry/pb-functions-transform/loadMediaSetReferencesV2/).

***

### Cross join

> Supported in: Batch, Faster

Cross joins left and right dataset inputs together, matching all rows from each side against all rows from the other. The output is the cartesian product of the two datasets.

**Transform categories**: Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[tail\_number, airline],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[home\_airport],<br>)
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| PA-452 | new air | 212 | 2 |

ri.foundry.main.dataset.right

| tail\_number | home\_airport |
| ----- | ----- |
| XB-123 | LHR |
| MT-222 | CPH |
| KK-452 | JFK |
| JR-201 | IAD |

**Output:**

| tail\_number | airline | home\_airport |
| ----- | ----- | ----- |
| XB-123 | foundry air | LHR |
| XB-123 | foundry air | CPH |
| XB-123 | foundry air | JFK |
| XB-123 | foundry air | IAD |
| MT-222 | new airline | LHR |
| MT-222 | new airline | CPH |
| MT-222 | new airline | JFK |
| MT-222 | new airline | IAD |
| PA-452 | new air | LHR |
| PA-452 | new air | CPH |
| PA-452 | new air | JFK |
| PA-452 | new air | IAD |

[See details](/docs/foundry/pb-functions-transform/complexCrossJoinV1/).

***

### Date distribution

> Supported in: Batch

Computes the distribution of dates/timestamps in a specified column.

**Transform categories**: Datetime

[See details](/docs/foundry/pb-functions-transform/dateDistributionV1/).

***

### Decompress gzip files

> Supported in: Batch

Decompress each file in a dataset of gzipped files. Note that users must have editor permission to be able to preview the unarchive file transform and all downstream nodes.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/ungzipFilesV1/).

***

### Decompress tar files

> Supported in: Batch

Decompress each file in a dataset of tar files. Note that users must have editor permission to be able to preview the untared file transform and all downstream nodes.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/untarFilesV1/).

***

### Drop columns

> Supported in: Batch, Faster, Streaming

Transforms input dataset by dropping the specified columns.

**Transform categories**: Popular

#### Example

**Argument values:**

* **Columns to drop:** {`miles`}
* **Dataset:** ri.foundry.main.dataset.a

**Input:**

| airline | miles | airports |
| ----- | ----- | ----- |
| foundry airways | 3000 | \[ JFK, SFO ] |

**Output:**

| airline | airports |
| ----- | ----- |
| foundry airways | \[ JFK, SFO ] |

[See details](/docs/foundry/pb-functions-transform/dropV1/).

***

### Drop duplicates

> Supported in: Batch, Faster

Drops duplicate rows from the input.

**Transform categories**: Other

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.aggregate
* **Column subset:** {`tail_number`}

**Input:**

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| XB-123 | foundry airline | 1134 | 3 |

**Output:**

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| KK-452 | new air | 222 | 1 |

[See details](/docs/foundry/pb-functions-transform/dropDuplicatesV1/).

***

### Empty file

> Supported in: Batch

Creates an empty file.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/emptyFileV1/).

***

### Empty media set file

> Supported in: Batch, Streaming

Creates an empty media set file with the given schema and snapshot read mode.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/emptyMediaSetFileV1/).

***

### Empty table

> Supported in: Batch, Faster, Streaming

Creates an empty table with the given schema and read mode.

**Transform categories**: Other

#### Example

**Argument values:**

* **Schema:** Struct\<flight\_code:Integer, flight\_number:String, airline:String>
* **Read mode:** *null*

**Inputs:**

**Output:**

| flight\_code | flight\_number | airline |
| ----- | ----- | ----- |

[See details](/docs/foundry/pb-functions-transform/emptyTableV1/).

***

### Extract file metadata from dataset as rows

> Supported in: Batch

Reads file metadata as rows from a dataset of files.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/extractFileMetadataAsRowsV1/).

***

### Extract many struct fields

> Supported in: Batch, Faster

Extracts many fields from a struct. Original struct will be dropped.

**Transform categories**: Struct

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.a
* **Locators:** \[(airline.name, airline), (tail\_no, tail\_number)]
* **Struct:** `raw`

**Input:**

| raw |
| ----- |
| {<br> **airline**: {<br> **id**: NA,<br> **name**: new air,<br>},<br> **tail\_no**: NA-123,<br>} |
| {<br> **airline**: {<br> **id**: FA,<br> **name**: foundry airways,<br>},<br> **tail\_no**: FA-123,<br>} |

**Output:**

| airline | tail\_number |
| ----- | ----- |
| new air | NA-123 |
| foundry airways | FA-123 |

[See details](/docs/foundry/pb-functions-transform/getManyStructFieldsV1/).

***

### Extract rows from a CSV file

> Supported in: Batch

Reads a dataset of files and parses each CSV file into rows.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/parseCsvV1/).

***

### Extract rows from a GeoJSON file

> Supported in: Batch

Reads a dataset of files and parses each GeoJSON file into rows. The output dataset will have a geometry column, and a column for each property listed by the user, apart from the \_error and \_file columns. If the user provides no properties to extract, the entire properties struct will be extracted into a properties column as a string. All GeoJSONs in the files must either be:
a) multiline FeatureCollection: an entire file with one GeoJSON of type FeatureCollection
b) single-line Feature: a file where every line is a fully valid GeoJSON of type Feature.

**Transform categories**: File, Geospatial

[See details](/docs/foundry/pb-functions-transform/parseGeoJsonV1/).

***

### Extract rows from a JSON file

> Supported in: Batch

Reads a dataset of files and parses each JSON file into rows.

**Transform categories**: File, String, Struct

[See details](/docs/foundry/pb-functions-transform/parseJsonV1/).

***

### Extract rows from a dataset of email files

> Supported in: Batch

Reads a dataset of email files and parses each file into a row. Supported file extensions: .eml, .emltpl, and .msg.

**Transform categories**: File, Media

[See details](/docs/foundry/pb-functions-transform/extractEmailDataAsRowsV1/).

***

### Extract rows from a dataset of text files

> Supported in: Batch

Reads a dataset of text files and parses each file into a row.

**Transform categories**: File, String

[See details](/docs/foundry/pb-functions-transform/parseTextFileV1/).

***

### Extract rows from an Excel file

> Supported in: Batch

Reads a dataset of Microsoft Excel files and parses each file into rows. Supported file formats: .xls, .xlt, .xltm, .xltx, .xlsx, .xlsm.

The processing of individual Excel files is not distributed across multiple Spark executors, so we recommend enabling the usage of local Spark in build settings if the input dataset is expected to have exactly one file.

Particularly large Excel files can require a lot of memory to process, so if you observe builds failing with out-of-memory errors, consider using custom build settings with increased executor memory (or increased driver memory in the case of local Spark). For such large files, it may not be possible to preview the output, but deployment can still succeed given appropriate build settings.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/parseExcelV2/).

***

### Extract rows from an XML file

> Supported in: Batch

Reads a dataset of files and parses each XML file into rows.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/xmlTagExtractV1/).

***

### Extract rows from shapefile

> Supported in: Batch

Reads a dataset of files and parses each shapefile into rows. All files except .shp, .shx and .dbf files will be ignored. This shapefile parser only supports point, polyline, polygon and multipoint geometry types. The output dataset will have a geometry column, and a column for each property listed by the user, apart from the \_error and \_file columns. If the user provides no properties to extract, the entire properties struct will be extracted into a properties column as a string. UTF-8 is the only supported encoding for property names and values (even if a .cpg file that specifies an alternative coding exists, it will be ignored).

**Transform categories**: File, Geospatial

[See details](/docs/foundry/pb-functions-transform/parseShapefileV1/).

***

### Filter

> Supported in: Batch, Faster, Streaming

Filters the input dataset based on the specified filter condition.

**Transform categories**: Data preparation, Popular

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.a
* **Filter condition:** `recently_serviced`

**Input:**

| recently\_serviced | tail\_number |
| ----- | ----- |
| true | KK-150 |
| false | XB-120 |
| true | MT-190 |

**Output:**

| recently\_serviced | tail\_number |
| ----- | ----- |
| true | KK-150 |
| true | MT-190 |

[See details](/docs/foundry/pb-functions-transform/filterV1/).

***

### Filter files

> Supported in: Batch

Filters a dataset of files.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/filterFilesV1/).

***

### First union by name

> Supported in: Batch, Faster

Unions a set of datasets together on columns from the first dataset, adding nulls when columns are missing. Columns that are not present in the first dataset are removed.

**Transform categories**: Join

#### Example

**Argument values:**

* **Datasets to union:** \[ri.foundry.main.dataset.a, ri.foundry.main.dataset.b]

**Inputs:**

ri.foundry.main.dataset.a

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |

ri.foundry.main.dataset.b

| recently\_serviced | tail\_number | home\_country |
| ----- | ----- | ----- |
| true | AA-200 | US |
| true | BN-435 | UK |
| true | BN-111 | UK |

**Output:**

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |
| true | AA-200 | *null* |
| true | BN-435 | *null* |
| true | BN-111 | *null* |

[See details](/docs/foundry/pb-functions-transform/firstUnionByNameV1/).

***

### Flatten struct

> Supported in: Batch, Faster, Streaming

Take all fields in a struct and turn them into columns in the output dataset.

**Transform categories**: Struct

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.a
* **Expression:** `raw`
* **Max depth:** 2
* **Column prefix:** new\_
* **Separator:** *null*

**Input:**

| raw |
| ----- |
| {<br> **airline**: {<br> **id**: NA,<br> **name**: new air,<br>},<br> **tail\_no**: NA-123,<br>} |
| {<br> **airline**: {<br> **id**: FA,<br> **name**: foundry airways,<br>},<br> **tail\_no**: FA-123,<br>} |

**Output:**

| new\_airline\_name | new\_airline\_id | new\_tail\_no | raw |
| ----- | ----- | ----- | ----- |
| new air | NA | NA-123 | {<br> **airline**: {<br> **id**: NA,<br> **name**: new air,<br>},<br> **tail\_no**: NA-123,<br>} |
| foundry airways | FA | FA-123 | {<br> **airline**: {<br> **id**: FA,<br> **name**: foundry airways,<br>},<br> **tail\_no**: FA-123,<br>} |

[See details](/docs/foundry/pb-functions-transform/flattenStructV1/).

***

### Frequent pattern growth

> Supported in: Batch

Frequent pattern (fp) growth finds frequent patterns in your dataset.

**Transform categories**: Aggregate, Other

#### Example

**Argument values:**

* **Input dataset:** ri.foundry.main.dataset.a
* **Items column:** `customer_attributes`
* **Minimum support:** 0.6

**Input:**

| customer\_attributes |
| ----- |
| \[ age\_group: 20-30, country: Germany, gender: Female ] |
| \[ age\_group: 20-30, country: Germany, gender: Male ] |

**Output:**

| pattern | pattern\_occurrence | total\_count |
| ----- | ----- | ----- |
| \[ country: Germany, age\_group: 20-30 ] | 2 | 2 |
| \[ age\_group: 20-30 ] | 2 | 2 |
| \[ country: Germany ] | 2 | 2 |

[See details](/docs/foundry/pb-functions-transform/fpGrowthV1/).

***

### Geo distance inner join

> Supported in: Batch

Inner joins left and right datasets together based on the distance between input geometries. Internally converts geometries into the given projected coordinate reference system prior to the join and back to WGS84.

**Transform categories**: Geospatial, Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[geometryColLhs, lhs-1],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[geometryCol, arrayCol],<br>)
* **Distance:** 10.0
* **Join key:** (`geometryColLhs`, `geometryCol`)
* **Left dataset:** ri.foundry.main.dataset.left
* **Projected coordinate system:** EPSG:4326
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** rhs\_

**Inputs:**

ri.foundry.main.dataset.left

| geometryColLhs | lhs-1 |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 |
| {"coordinates": \[55.0, 5.0], "type":"Point"} | 43.0 |
| {"coordinates": \[\[25.0, 0.0], \[0.0, 25.0]], "type":"LineString"} | 44.0 |

ri.foundry.main.dataset.right

| geometryCol | col1 | arrayCol |
| ----- | ----- | ----- |
| {"coordinates": \[\[\[20.0, 10.0], \[27.0, 10.0], \[27.0, 17.0], \[20.0, 17.0], \[20.0, 10.0]]], "type": "Polygon"} | rhsVal1 | \[ 0.0, 1.0 ] |
| {"coordinates": \[\[\[21.0, 21.0], \[27.0, 21.0], \[27.0, 27.0], \[21.0, 27.0], \[21.0, 21.0]]], "type": "Polygon"} | rhsVal2 | \[ 0.0, 1.0 ] |

**Output:**

| geometryColLhs | lhs-1 | rhs\_geometryCol | rhs\_arrayCol |
| ----- | ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[\[20.0, 10.0], \[27.0, 10.0], \[27.0, 17.0], \[20.0, 17.0], \[20.0, 10.0]]], "type": "Polygon"} | \[ 0.0, 1.0 ] |
| {"coordinates": \[\[25.0, 0.0], \[0.0, 25.0]], "type":"LineString"} | 44.0 | {"coordinates": \[\[\[20.0, 10.0], \[27.0, 10.0], \[27.0, 17.0], \[20.0, 17.0], \[20.0, 10.0]]], "type": "Polygon"} | \[ 0.0, 1.0 ] |

[See details](/docs/foundry/pb-functions-transform/geoDistanceInnerJoinV1/).

***

### Geo distance left join

> Supported in: Batch

Left joins datasets together if the distance between input geometries is less than or equal to the specified distance. Internally converts geometries into the given projected coordinate reference system prior to the join and back to WGS84.

**Transform categories**: Geospatial, Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[geometryColLhs, lhs-1],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[geometryColRhs, rhs-1],<br>)
* **Distance:** 1640.42
* **Join key:** (`geometryColLhs`, `geometryColRhs`)
* **Left dataset:** ri.foundry.main.dataset.left
* **Projected coordinate system:** epsg:2868
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| geometryColLhs | lhs-1 |
| ----- | ----- |
| {"coordinates": \[-112.14843750000001,33.440609443703586], "type":"Point"} | 42.0 |
| *null* | 43.0 |

ri.foundry.main.dataset.right

| geometryColRhs | rhs-1 |
| ----- | ----- |
| {"coordinates": \[-112.14560508728029,33.44082430962016], "type":"Point"} | rhsVal1 |
| {"coordinates": \[-112.11796760559083,33.440895931474124], "type":"Point"} | rhsVal2 |

**Output:**

| geometryColLhs | lhs-1 | geometryColRhs | rhs-1 |
| ----- | ----- | ----- | ----- |
| {"coordinates": \[-112.14843750000001,33.440609443703586], "type":"Point"} | 42.0 | {"coordinates": \[-112.14560508728029,33.44082430962016], "type":"Point"} | rhsVal1 |
| *null* | 43.0 | *null* | *null* |

[See details](/docs/foundry/pb-functions-transform/geoDistanceLeftJoinV1/).

***

### Geo intersection inner join

> Supported in: Batch, Streaming

Inner joins left and right datasets together based on whether input geometries overlap. Includes just touching geometries in the results.

**Transform categories**: Geospatial, Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>allColumns(<br><br>)
* **Condition for columns to select on the right:** <br>allColumns(<br><br>)
* **Join key:** (`geometryColLhs`, `geometryColRhs`)
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| geometryColLhs | col1Lhs |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 |

ri.foundry.main.dataset.right

| geometryColRhs | col1Rhs |
| ----- | ----- |
| {"coordinates": \[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], "type": "Polygon"} | rhsVal1 |
| {"coordinates": \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]], "type": "Polygon"} | rhsVal2 |
| {"coordinates": \[0.0, 0.0], "type":"Point"} | rhsVal3 |
| {"coordinates": \[15.0, 15.0], "type":"Point"} | rhsVal4 |
| {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal5 |
| {"coordinates": \[\[20.0, 20.0], \[21.0, 23.0]], "type":"LineString"} | rhsVal6 |
| {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal7 |
| {"coordinates": \[\[20.0, 20.0], \[21.0, 23.0]], "type":"LineString"} | rhsVal8 |
| {"coordinates": \[\[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | rhsVal9 |
| {"coordinates": \[\[\[\[170.0, 170.0], \[190.0, 170.0], \[190.0, 190.0], \[170.0, 190.0], \[170.0, 170.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | rhsVal10 |

**Output:**

| geometryColLhs | col1Lhs | geometryColRhs | col1Rhs |
| ----- | ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], "type": "Polygon"} | rhsVal1 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[0.0, 0.0], "type":"Point"} | rhsVal3 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal5 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal7 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | rhsVal9 |

[See details](/docs/foundry/pb-functions-transform/geoIntersectionInnerJoinV1/).

***

### Geo intersection left anti join

> Supported in: Streaming

Anti joins input datasets based on whether input geometries overlap. Returns only rows from the left dataset where the geometry does not intersect with any geometry in the right dataset. Rows with null or invalid join keys are considered non-intersecting.

**Transform categories**: Geospatial, Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>allColumns(<br><br>)
* **Condition for columns to select on the right:** <br>allColumns(<br><br>)
* **Join key:** (`geometryColLhs`, `geometryColRhs`)
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| geometryColLhs | col1Lhs |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 |
| {"coordinates": \[55.0, 5.0], "type":"Point"} | 43.0 |

ri.foundry.main.dataset.right

| geometryColRhs | col1Rhs |
| ----- | ----- |
| {"coordinates": \[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], "type": "Polygon"} | rhsVal1 |
| {"coordinates": \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]], "type": "Polygon"} | rhsVal2 |
| {"coordinates": \[0.0, 0.0], "type":"Point"} | rhsVal3 |
| {"coordinates": \[15.0, 15.0], "type":"Point"} | rhsVal4 |

**Output:**

| geometryColLhs | col1Lhs |
| ----- | ----- |
| {"coordinates": \[55.0, 5.0], "type":"Point"} | 43.0 |

[See details](/docs/foundry/pb-functions-transform/geoIntersectionAntiJoinV1/).

***

### Geo intersection left join

> Supported in: Batch, Streaming

Left joins input datasets based on whether input geometries overlap. Includes just touching geometries in the results. Null or invalid geometries will not return matches.

**Transform categories**: Geospatial, Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>allColumns(<br><br>)
* **Condition for columns to select on the right:** <br>allColumns(<br><br>)
* **Join key:** (`geometryColLhs`, `geometryColRhs`)
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| geometryColLhs | col1Lhs |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 |
| {"coordinates": \[55.0, 5.0], "type":"Point"} | 43.0 |

ri.foundry.main.dataset.right

| geometryColRhs | col1Rhs |
| ----- | ----- |
| {"coordinates": \[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], "type": "Polygon"} | rhsVal1 |
| {"coordinates": \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]], "type": "Polygon"} | rhsVal2 |
| {"coordinates": \[0.0, 0.0], "type":"Point"} | rhsVal3 |
| {"coordinates": \[15.0, 15.0], "type":"Point"} | rhsVal4 |
| {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal5 |
| {"coordinates": \[\[20.0, 20.0], \[21.0, 23.0]], "type":"LineString"} | rhsVal6 |
| {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal7 |
| {"coordinates": \[\[20.0, 20.0], \[21.0, 23.0]], "type":"LineString"} | rhsVal8 |
| {"coordinates": \[\[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | rhsVal9 |
| {"coordinates": \[\[\[\[170.0, 170.0], \[190.0, 170.0], \[190.0, 190.0], \[170.0, 190.0], \[170.0, 170.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | rhsVal10 |

**Output:**

| geometryColLhs | col1Lhs | geometryColRhs | col1Rhs |
| ----- | ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], "type": "Polygon"} | rhsVal1 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[0.0, 0.0], "type":"Point"} | rhsVal3 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal5 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal7 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | rhsVal9 |
| {"coordinates": \[55.0, 5.0], "type":"Point"} | 43.0 | *null* | *null* |

[See details](/docs/foundry/pb-functions-transform/geoIntersectionLeftJoinV1/).

***

### GeoPoint-to-GeoPoint 3d distance inner join

> Supported in: Batch

Inner joins left and right datasets together based on the distance between point geometries. The geometries must represent points, and may optionally include a z-coordinate. Internally converts geometries into the given projected coordinate reference system prior to the join and back to WGS84. Non-point geometries are ignored, and the  entire right dataset must be able to  fit into driver and executor memory. A 3 gb executor should be able to handle up to 4 million points in the neighbors dataset.

**Transform categories**: Geospatial, Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[geometryColLhs, lhs-1],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[geometryCol, arrayCol],<br>)
* **Distance:** 2.5
* **Join key:** (`geometryColLhs`, `geometryCol`)
* **Left dataset:** ri.foundry.main.dataset.left
* **Projected coordinate system:** EPSG:4326
* **Right dataset:** ri.foundry.main.dataset.right
* **Use z-coordinate:** false
* **Prefix for columns from right:** rhs\_

**Inputs:**

ri.foundry.main.dataset.left

| geometryColLhs | lhs-1 |
| ----- | ----- |
| {"coordinates": \[0.0, 0.0, 0.0], "type":"Point"} | 42.0 |
| {"coordinates": \[0.0, 0.0, 5.0], "type":"Point"} | 43.0 |
| {"coordinates": \[0.0, 0.0], "type":"Point"} | 44.0 |

ri.foundry.main.dataset.right

| geometryCol | col1 | arrayCol |
| ----- | ----- | ----- |
| {"coordinates": \[0.0, 0.0, 2.0], "type":"Point"} | rhsVal1 | \[ 0.0, 1.0 ] |
| {"coordinates": \[0.0, 1.0], "type":"Point"} | rhsVal2 | \[ 0.0, 1.0 ] |

**Output:**

| geometryColLhs | lhs-1 | rhs\_geometryCol | rhs\_arrayCol |
| ----- | ----- | ----- | ----- |
| {"coordinates": \[0.0, 0.0, 0.0], "type":"Point"} | 42.0 | {"coordinates": \[0.0, 0.0, 2.0], "type":"Point"} | \[ 0.0, 1.0 ] |
| {"coordinates": \[0.0, 0.0, 0.0], "type":"Point"} | 42.0 | {"coordinates": \[0.0, 1.0], "type":"Point"} | \[ 0.0, 1.0 ] |
| {"coordinates": \[0.0, 0.0, 5.0], "type":"Point"} | 43.0 | {"coordinates": \[0.0, 0.0, 2.0], "type":"Point"} | \[ 0.0, 1.0 ] |
| {"coordinates": \[0.0, 0.0, 5.0], "type":"Point"} | 43.0 | {"coordinates": \[0.0, 1.0], "type":"Point"} | \[ 0.0, 1.0 ] |
| {"coordinates": \[0.0, 0.0], "type":"Point"} | 44.0 | {"coordinates": \[0.0, 0.0, 2.0], "type":"Point"} | \[ 0.0, 1.0 ] |
| {"coordinates": \[0.0, 0.0], "type":"Point"} | 44.0 | {"coordinates": \[0.0, 1.0], "type":"Point"} | \[ 0.0, 1.0 ] |

[See details](/docs/foundry/pb-functions-transform/geoPointToPoint3dDistanceInnerJoinV1/).

***

### Geometry intersection join

> Supported in: Batch

Inner joins left and right datasets together based on whether input geometries overlap. Returns a row containing all of the columns from both datasets if the join key column pair has geometries which intersect. Currently does not support joining on multiple join keys. Silently filters null join key geometry values. Left and right datasets must not have the same column names. Silently nullifies invalid GeoJSON in join columns.

**Transform categories**: Geospatial, Join

#### Example

**Argument values:**

* **Join key:** \[(`geometryColLhs`, `geometryColRhs`)]
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right

**Inputs:**

ri.foundry.main.dataset.left

| geometryColLhs | lhs-1 |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 |

ri.foundry.main.dataset.right

| geometryColRhs | rhs-1 |
| ----- | ----- |
| {"coordinates": \[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], "type": "Polygon"} | rhsVal1 |
| {"coordinates": \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]], "type": "Polygon"} | rhsVal2 |
| {"coordinates": \[0.0, 0.0], "type":"Point"} | rhsVal3 |
| {"coordinates": \[15.0, 15.0], "type":"Point"} | rhsVal4 |
| {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal5 |
| {"coordinates": \[\[20.0, 20.0], \[21.0, 23.0]], "type":"LineString"} | rhsVal6 |
| {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal7 |
| {"coordinates": \[\[20.0, 20.0], \[21.0, 23.0]], "type":"LineString"} | rhsVal8 |
| {"coordinates": \[\[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | rhsVal9 |
| {"coordinates": \[\[\[\[170.0, 170.0], \[190.0, 170.0], \[190.0, 190.0], \[170.0, 190.0], \[170.0, 170.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | rhsVal10 |

**Output:**

| geometryColLhs | lhs-1 | geometryColRhs | rhs-1 |
| ----- | ----- | ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], "type": "Polygon"} | rhsVal1 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[0.0, 0.0], "type":"Point"} | rhsVal3 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal5 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[-1.0, -1.0], \[5.0, 5.0]], "type":"LineString"} | rhsVal7 |
| {"type":"Polygon","coordinates":\[\[\[0.0,0.0],\[0.0,10.0],\[10.0,10.0],\[10.0,0.0],\[0.0,0.0]]]} | 42.0 | {"coordinates": \[\[\[\[2.0, 2.0], \[7.0, 2.0], \[7.0, 7.0], \[2.0, 7.0], \[2.0, 2.0]]], \[\[\[12.0, 12.0], \[17.0, 12.0], \[17.0, 17.0], \[12.0, 17.0], \[12.0, 12.0]]]], "type":"MultiPolygon"} | rhsVal9 |

[See details](/docs/foundry/pb-functions-transform/geoIntersectionJoinV1/).

***

### Geometry knn inner join

> Supported in: Batch

Selects the k closest points from the neighbors dataset for each valid input geometry from the base dataset. Internally converts the input datasets to the given coordinate reference system, and back to WGS84. The entire neighbors dataset must be able to fit into driver and executor memory. A 3 gb executor should be able to handle up to 1 million points in the neighbors dataset.

**Transform categories**: Geospatial, Join

#### Example

**Argument values:**

* **Base dataset:** ri.foundry.main.dataset.left
* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[geometryCol, lhsCol],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[geometryCol, col],<br>)
* **Join key:** (`geometryCol`, `geometryCol`)
* **K:** 2
* **Neighbors dataset:** ri.foundry.main.dataset.right
* **Projected coordinate system:** epsg:2868
* **Prefix for columns from right:** rhs\_

**Inputs:**

ri.foundry.main.dataset.left

| geometryCol | lhsCol |
| ----- | ----- |
| {"coordinates": \[-112.14843750000001,33.440609443703586], "type":"Point"} | 42.0 |

ri.foundry.main.dataset.right

| geometryCol | col |
| ----- | ----- |
| {<br> **latitude**: 33.440609443703586,<br> **longitude**: -112.14843750000001,<br>} | rhsVal1 |
| {<br> **latitude**: 33.44082430962016,<br> **longitude**: -112.14560508728029,<br>} | rhsVal2 |
| {<br> **latitude**: 33.440895931474124,<br> **longitude**: -112.11796760559083,<br>} | rhsVal3 |

**Output:**

| geometryCol | lhsCol | rhs\_geometryCol | rhs\_col |
| ----- | ----- | ----- | ----- |
| {"coordinates": \[-112.14843750000001,33.440609443703586], "type":"Point"} | 42.0 | {<br> **latitude**: 33.440609443703586,<br> **longitude**: -112.14843750000001,<br>} | rhsVal1 |
| {"coordinates": \[-112.14843750000001,33.440609443703586], "type":"Point"} | 42.0 | {<br> **latitude**: 33.44082430962016,<br> **longitude**: -112.14560508728029,<br>} | rhsVal2 |

[See details](/docs/foundry/pb-functions-transform/geoKnnInnerJoinV1/).

***

### Geometry knn left join

> Supported in: Batch

Selects the k closest points from the neighbors dataset for each valid input geometry from the base dataset. Internally converts the input datasets to the given coordinate reference system, and back to WGS84. The entire neighbors dataset must be able to fit into driver and executor memory. A 3 gb executor should be able to handle up to 1 million points in the neighbors dataset.

**Transform categories**: Geospatial, Join

#### Example

**Argument values:**

* **Base dataset:** ri.foundry.main.dataset.left
* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[geometryCol, lhsCol],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[geometryCol, col],<br>)
* **Join key:** (`geometryCol`, `geometryCol`)
* **K:** 2
* **Neighbors dataset:** ri.foundry.main.dataset.right
* **Projected coordinate system:** epsg:2868
* **Prefix for columns from right:** rhs\_

**Inputs:**

ri.foundry.main.dataset.left

| geometryCol | lhsCol |
| ----- | ----- |
| {"coordinates": \[-112.14843750000001,33.440609443703586], "type":"Point"} | 42.0 |

ri.foundry.main.dataset.right

| geometryCol | col |
| ----- | ----- |
| {<br> **latitude**: 33.440609443703586,<br> **longitude**: -112.14843750000001,<br>} | rhsVal1 |
| {<br> **latitude**: 33.44082430962016,<br> **longitude**: -112.14560508728029,<br>} | rhsVal2 |
| {<br> **latitude**: 33.440895931474124,<br> **longitude**: -112.11796760559083,<br>} | rhsVal3 |

**Output:**

| geometryCol | lhsCol | rhs\_geometryCol | rhs\_col |
| ----- | ----- | ----- | ----- |
| {"coordinates": \[-112.14843750000001,33.440609443703586], "type":"Point"} | 42.0 | {<br> **latitude**: 33.440609443703586,<br> **longitude**: -112.14843750000001,<br>} | rhsVal1 |
| {"coordinates": \[-112.14843750000001,33.440609443703586], "type":"Point"} | 42.0 | {<br> **latitude**: 33.44082430962016,<br> **longitude**: -112.14560508728029,<br>} | rhsVal2 |

[See details](/docs/foundry/pb-functions-transform/geoKnnLeftJoinV1/).

***

### Get media references (datasets)

> Supported in: Batch

Produces a dataset containing media references and basic metadata for files in a dataset.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/loadMediaReferencesV1/).

***

### Heartbeat detection

> Supported in: Streaming

Detects when a record hasn't been seen for a configurable amount of time for a set of keys.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/heartbeatDetectionV2/).

***

### Inner join

> Supported in: Batch, Faster

Joins two datasets together, keeping only rows that satisfy the provided condition from each table.

**Transform categories**: Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[tail\_number, airline],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[home\_airport],<br>)
* **Join condition:** <br>equals(<br> left: `tail_number`,<br> right: `tail_number`,<br>)
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| PA-452 | new air | 212 | 2 |
| XB-123 | foundry airline | 1134 | 2 |

ri.foundry.main.dataset.right

| tail\_number | home\_airport |
| ----- | ----- |
| XB-123 | LHR |
| MT-222 | CPH |
| KK-452 | JFK |
| JR-201 | IAD |

**Output:**

| tail\_number | airline | home\_airport |
| ----- | ----- | ----- |
| XB-123 | foundry air | LHR |
| MT-222 | new airline | CPH |
| XB-123 | foundry airline | LHR |
| MT-222 | new air | CPH |
| KK-452 | new air | JFK |
| XB-123 | foundry airline | LHR |

[See details](/docs/foundry/pb-functions-transform/complexInnerJoinV1/).

***

### Join

> Supported in: Batch, Faster, Streaming

Joins left and right dataset inputs together.

**Transform categories**: Join

[See details](/docs/foundry/pb-functions-transform/joinV2/).

***

### K-means clustering

> Supported in: Batch

K-means clustering is an unsupervised machine learning algorithm. It groups dataset vectors into k clusters. The k value is determined by computing the best silhouette score of the specified range between minimum k and maximum k. Number of k values defines how many k values should be tried within this range, inclusive of the boundaries.

**Transform categories**: Other

#### Example

**Argument values:**

* **Input dataset:** ri.foundry.main.dataset.a
* **Maximum k:** 12
* **Minimum k:** 3
* **Number of k values:** 4
* **Vector column:** `feature_column`

**Input:**

| feature\_column |
| ----- |
| \[ 0.05, 3.1, 2.3 ] |
| \[ 1.0, 3.1, 2.3 ] |
| \[ 1.0, 3.5, 2.3 ] |
| \[ 19.0, 12.3, -1.4 ] |

**Output:**

| feature\_column | cluster\_id |
| ----- | ----- |
| \[ 1.0, 3.1, 2.3 ] | 0 |
| \[ 1.0, 3.5, 2.3 ] | 0 |
| \[ 19.0, 12.3, -1.4 ] | 1 |
| \[ 0.05, 3.1, 2.3 ] | 2 |

[See details](/docs/foundry/pb-functions-transform/kmeansV1/).

***

### KNN join

> Supported in: Batch

Return the 'k' nearest rows from the right dataset for each row in the left dataset, based on the distance measure.

**Transform categories**: Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[tail\_number, airline],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[fuzzy\_airline, home\_airport],<br>)
* **Distance measure expression:** <br>alias(<br> alias: distance,<br> expression: <br>levenshteinDistance(<br> ignoreCase: true,<br> left: `airline`,<br> right: `fuzzy_airline`,<br>),<br>)
* **K nearest:** 2
* **Left dataset:** ri.foundry.main.dataset.left
* **Rank column name:** rank
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| PA-452 | new air | 212 | 2 |

ri.foundry.main.dataset.right

| fuzzy\_airline | home\_airport |
| ----- | ----- |
| air | LHR |
| new airline | CPH |
| new plane | JFK |
| old air | IAD |

**Output:**

| rank | distance | tail\_number | airline | fuzzy\_airline | home\_airport |
| ----- | ----- | ----- | ----- | ----- | ----- |
| 1 | 3 | PA-452 | new air | old air | IAD |
| 2 | 4 | PA-452 | new air | air | LHR |
| 2 | 4 | PA-452 | new air | new airline | CPH |
| 2 | 4 | PA-452 | new air | new plane | JFK |
| 1 | 0 | MT-222 | new airline | new airline | CPH |
| 2 | 4 | MT-222 | new airline | new plane | JFK |
| 1 | 5 | XB-123 | foundry air | old air | IAD |
| 2 | 8 | XB-123 | foundry air | air | LHR |

[See details](/docs/foundry/pb-functions-transform/complexKnnJoinV1/).

***

### Keeps duplicates

> Supported in: Batch, Faster

Keep duplicate rows from the input.

**Transform categories**: Other

#### Example

**Argument values:**

* **Column subset:** {`tail_number`}
* **Dataset:** ri.foundry.main.dataset.aggregate

**Input:**

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| XB-123 | foundry airline | 1134 | 3 |

**Output:**

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| XB-123 | foundry airline | 1134 | 3 |

[See details](/docs/foundry/pb-functions-transform/keepDuplicatesV1/).

***

### Key by

> Supported in: Streaming

Keys the input by the provided key by columns. Note that this does not re-sort the data and only maintains per key ordering from the point the keys are set. Re-keying data may be unsafe in that if the newly keyed data was depending on any specific ordering then we can't guarantee that ordering if it wasn't already maintained by the previous keying. Additionally sets the primary key if cdc (change data capture) mode is enabled. Primary key defines columns that indicate which rows are updates, deletes, and the ordering of when read as a current view.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/keyByV3/).

***

### Left join

> Supported in: Batch, Faster

Joins two datasets together, keeping all rows from the left table and only rows which satisfy the provided condition from the right table.

**Transform categories**: Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[tail\_number, airline],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[home\_airport],<br>)
* **Join condition:** <br>equals(<br> left: `tail_number`,<br> right: `tail_number`,<br>)
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| PA-452 | new air | 212 | 2 |
| XB-123 | foundry airline | 1134 | 2 |

ri.foundry.main.dataset.right

| tail\_number | home\_airport |
| ----- | ----- |
| XB-123 | LHR |
| MT-222 | CPH |
| KK-452 | JFK |
| JR-201 | IAD |

**Output:**

| tail\_number | airline | home\_airport |
| ----- | ----- | ----- |
| XB-123 | foundry air | LHR |
| MT-222 | new airline | CPH |
| XB-123 | foundry airline | LHR |
| MT-222 | new air | CPH |
| KK-452 | new air | JFK |
| PA-452 | new air | *null* |
| XB-123 | foundry airline | LHR |

[See details](/docs/foundry/pb-functions-transform/complexLeftJoinV1/).

***

### Left lookup join

> Supported in: Streaming

Joins two datasets together, keeping all rows from the left table and only matching rows from the right dataset.

**Transform categories**: Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[tail\_number, airline],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[home\_airport],<br>)
* **Join condition:** \[(`tail_number`, `tail_number`)]
* **Left dataset:** ri.foundry.main.dataset.left
* **Max rows to join with a single row:** 10
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| PA-452 | new air | 212 | 2 |
| XB-123 | foundry airline | 1134 | 2 |

ri.foundry.main.dataset.right

| tail\_number | home\_airport |
| ----- | ----- |
| XB-123 | LHR |
| MT-222 | CPH |
| KK-452 | JFK |
| JR-201 | IAD |

**Output:**

| tail\_number | airline | home\_airport |
| ----- | ----- | ----- |
| XB-123 | foundry air | LHR |
| MT-222 | new airline | CPH |
| XB-123 | foundry airline | LHR |
| MT-222 | new air | CPH |
| KK-452 | new air | JFK |
| PA-452 | new air | *null* |
| XB-123 | foundry airline | LHR |

[See details](/docs/foundry/pb-functions-transform/leftLookupJoinV2/).

***

### Manually entered table

> Supported in: Batch, Faster, Streaming

Uses manually entered table data to create an output.

**Transform categories**: Other

#### Example

**Argument values:**

* **Rows:** \[{<br> **airline**: foundry airlines,<br> **flight\_code**: 112,<br> **flight\_number**: XB-123,<br>}, {<br> **airline**: foundry airlines,<br> **flight\_code**: 533,<br> **flight\_number**: MT-444,<br>}, {<br> **airline**: new air,<br> **flight\_code**: 934,<br> **flight\_number**: KK-123,<br>}]
* **Schema:** Struct\<flight\_code:Integer, flight\_number:String, airline:String>

**Inputs:**

**Output:**

| flight\_code | flight\_number | airline |
| ----- | ----- | ----- |
| 112 | XB-123 | foundry airlines |
| 533 | MT-444 | foundry airlines |
| 934 | KK-123 | new air |

[See details](/docs/foundry/pb-functions-transform/manuallyEnteredTableV1/).

***

### Mapping join

> Supported in: Batch, Faster

Replaces values from the target columns in the source dataset with values in the mapping dataset.

**Transform categories**: Join

**Type variable bounds:** *T1 accepts AnyType\*\*T2 accepts AnyType*

#### Example

**Argument values:**

* **Input dataset:** ri.foundry.main.dataset.input
* **Key column for mapping values:** `flight_code`
* **Mapping dataset:** ri.foundry.main.dataset.mapping
* **Target columns:** \[`flight_no`, `next_flight`]
* **Values to use for mapping:** `flight_number`
* **Assume unique mappings:** *null*
* **Default value:** unknown

**Inputs:**

ri.foundry.main.dataset.input

| flight\_no | next\_flight | departure\_time |
| ----- | ----- | ----- |
| 533 | 112 | 2022-01-20T10:45:00Z |
| 934 | 533 | 2022-01-20T11:20:00Z |
| 222 | 934 | 2022-01-20T11:20:00Z |

ri.foundry.main.dataset.mapping

| flight\_code | flight\_number | airline |
| ----- | ----- | ----- |
| 112 | XB-123 | foundry airlines |
| 533 | MT-444 | foundry airlines |
| 934 | KK-123 | new air |

**Output:**

| flight\_no | next\_flight | departure\_time |
| ----- | ----- | ----- |
| MT-444 | XB-123 | 2022-01-20T10:45:00Z |
| KK-123 | MT-444 | 2022-01-20T11:20:00Z |
| unknown | KK-123 | 2022-01-20T11:20:00Z |

[See details](/docs/foundry/pb-functions-transform/mappingJoinV1/).

***

### Narrow union by name

> Supported in: Batch, Faster

Unions a set of datasets together on the intersection of their column names, columns that are not present in all input datasets are removed.

**Transform categories**: Join

#### Example

**Argument values:**

* **Datasets to union:** \[ri.foundry.main.dataset.a, ri.foundry.main.dataset.b]

**Inputs:**

ri.foundry.main.dataset.a

| recently\_serviced | tail\_number |
| ----- | ----- |
| true | KK-150 |
| false | XB-120 |
| true | MT-190 |

ri.foundry.main.dataset.b

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | AA-200 | AA |
| true | BN-435 | BN |
| true | BN-111 | BN |

**Output:**

| recently\_serviced | tail\_number |
| ----- | ----- |
| true | KK-150 |
| false | XB-120 |
| true | MT-190 |
| true | AA-200 |
| true | BN-435 |
| true | BN-111 |

[See details](/docs/foundry/pb-functions-transform/narrowUnionByNameV1/).

***

### New operator chain

> Supported in: Streaming

Advanced flink feature, starts new operator chain here.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/newOperatorChainV1/).

***

### Normalize column names

> Supported in: Batch, Faster, Streaming

Normalizes column names to use lower\_snake\_case.

**Transform categories**: Data preparation

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.a
* **Remove special characters:** *null*

**Input:**

| recentlyServiced | tailNumber | \_airlineCode |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |

**Output:**

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |

[See details](/docs/foundry/pb-functions-transform/normalizeColumnNamesV1/).

***

### Numeric distribution

> Supported in: Batch, Faster

Computes the distribution of numeric values in a specified column.

**Transform categories**: Numeric

[See details](/docs/foundry/pb-functions-transform/numericDistributionV2/).

***

### Outer caching join

> Supported in: Streaming

Rows from the left & right inputs which meet all of the match conditions and are within the caching window, along with unmatched rows from both inputs.

**Transform categories**: Join

[See details](/docs/foundry/pb-functions-transform/frontendOuterCachingJoinV3/).

***

### Outer caching join

> Supported in: Streaming

Joins left and right dataset inputs together, caching the record with the highest event time from each side for use in subsequent joins. Processing time of a record is used as a tiebreaker. In the case of a time results are optimistically emitted if there's no value to join against.

**Transform categories**: Join

[See details](/docs/foundry/pb-functions-transform/outerCachingJoinV3/).

***

### Outer join

> Supported in: Batch, Faster

Outer joins the provided dataset inputs together, keeping all rows from both datasets. Columns have nulls when there is no row satisfying the provided condition.

**Transform categories**: Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>columnNameIsIn(<br> columnNames: \[tail\_number, airline],<br>)
* **Condition for columns to select on the right:** <br>columnNameIsIn(<br> columnNames: \[home\_airport],<br>)
* **Join condition:** <br>equals(<br> left: `tail_number`,<br> right: `tail_number`,<br>)
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right
* **Prefix for columns from right:** *null*

**Inputs:**

ri.foundry.main.dataset.left

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| PA-452 | new air | 212 | 2 |
| XB-123 | foundry airline | 1134 | 2 |

ri.foundry.main.dataset.right

| tail\_number | home\_airport |
| ----- | ----- |
| XB-123 | LHR |
| MT-222 | CPH |
| KK-452 | JFK |
| JR-201 | IAD |

**Output:**

| tail\_number | airline | home\_airport |
| ----- | ----- | ----- |
| XB-123 | foundry air | LHR |
| MT-222 | new airline | CPH |
| XB-123 | foundry airline | LHR |
| MT-222 | new air | CPH |
| KK-452 | new air | JFK |
| PA-452 | new air | *null* |
| XB-123 | foundry airline | LHR |
| JR-201 | *null* | IAD |

[See details](/docs/foundry/pb-functions-transform/complexOuterJoinV1/).

***

### Parse KML files into geometry lists

> Supported in: Batch

Parses each raw KML file into a list of typed geometries.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/parseKmlFilesV1/).

***

### Pivot

> Supported in: Batch, Faster

Performs the specified aggregations on the input dataset grouped by a set of columns. Unique values to pivot on must be provided such that the output schema is known ahead of runtime. This improves runtime stability over time.

**Transform categories**: Aggregate, Popular

**Type variable bounds:** *T accepts Boolean | Byte | Integer | Long | Short | String*

#### Example

**Argument values:**

* **Aggregations:** \[<br>alias(<br> alias: miles,<br> expression: <br>mean(<br> expression: `miles`,<br>),<br>)]
* **Dataset:** ri.foundry.main.dataset.a
* **Group by columns:** \[`airline`]
* **Pivot by column:** `airport`
* **Pivot by values:** \[(JFK, new\_york), (LHR, london)]
* **Prefix or suffix alias:** *null*

**Input:**

| airline | airport | miles |
| ----- | ----- | ----- |
| foundry airways | JFK | 1002345 |
| foundry airways | LHR | 2221324 |
| new air | SFO | 21356673 |
| new air | JFK | 12323456 |
| foundry airways | LHR | 12542352 |
| new air | JFK | 12232355 |

**Output:**

| airline | new\_york\_miles | london\_miles |
| ----- | ----- | ----- |
| foundry airways | 1002345.0 | 7381838.0 |
| new air | 1.22779055E7 | *null* |

[See details](/docs/foundry/pb-functions-transform/pivotV1/).

***

### Project over window

> Supported in: Batch, Faster, Streaming

Performs the specified aggregations on the data within the window. Emits one row each time a new row is received.

**Transform categories**: Aggregate

[See details](/docs/foundry/pb-functions-transform/windowedProjectV1/).

***

### Rename columns

> Supported in: Batch, Faster, Streaming

Renames a set of columns.

**Transform categories**: Data preparation, Popular

#### Example

**Argument values:**

* **Input dataset:** ri.foundry.main.dataset.a
* **Renames:** \[(`recently_serviced`, does\_not\_require\_service)]

**Input:**

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |

**Output:**

| does\_not\_require\_service | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |

[See details](/docs/foundry/pb-functions-transform/renameColumnsV1/).

***

### Repartition data

> Supported in: Batch, Faster

Forces a shuffle of the data based on optionally provided partitioning columns and a resulting number of partitions. If these are not provided, the partitioning will be determined automatically.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/repartitionV1/).

***

### Rollup

> Supported in: Batch, Faster

Performs the specified aggregations on the input dataset at different levels of granularity, providing both intermediate and super aggregates.

**Transform categories**: Aggregate

#### Example

**Argument values:**

* **Aggregations:** \[<br>alias(<br> alias: mean\_price,<br> expression: <br>mean(<br> expression: `price`,<br>),<br>)]
* **Dataset:** ri.foundry.main.dataset.rollupBaseCase
* **Rollup columns:** \[`city`, `model`]

**Input:**

| city | model | price | store |
| ----- | ----- | ----- | ----- |
| London | new phone | 900.0 | MegaMart |
| London | new phone | 850.75 | AA |
| London | new phone | 870.75 | ABC Zone |
| San Francisco | new phone | 1000.0 | Prescos |
| San Francisco | new phone | 950.25 | XZY Force |
| San Francisco | new phone | 1105.7 | Phone Mart |
| London | forestX 20 | 750.1 | MegaMart |
| London | forestX 20 | 690.0 | AA |
| London | forestX 20 | 730.0 | ABC Zone |
| San Francisco | forestX 20 | 890.4 | Prescos |
| San Francisco | forestX 20 | 900.1 | XZY Force |
| San Francisco | forestX 20 | 1050.75 | Phone Mart |

**Output:**

| city | model | mean\_price |
| ----- | ----- | ----- |
| London | new phone | 873.8333333333334 |
| London | forestX 20 | 723.3666666666667 |
| London | *null* | 798.6 |
| San Francisco | new phone | 1018.65 |
| San Francisco | forestX 20 | 947.0833333333334 |
| San Francisco | *null* | 982.8666666666667 |
| *null* | *null* | 890.7333333333335 |

[See details](/docs/foundry/pb-functions-transform/rollUpV1/).

***

### Row size

> Supported in: Batch

Estimates the size of a single row in the JVM.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/rowSizeV1/).

***

### Select columns

> Supported in: Batch, Faster, Streaming

Selects a set of columns from the input dataset.

**Transform categories**: Popular

[See details](/docs/foundry/pb-functions-transform/selectV1/).

***

### Semi join

> Supported in: Batch, Faster

Semi joins left and right dataset inputs together. This removes all rows that don't match the join condition.

**Transform categories**: Join

#### Example

**Argument values:**

* **Condition for columns to select on the left:** <br>allColumns(<br><br>)
* **Join condition:** <br>equals(<br> left: `tail_number`,<br> right: `tail_number`,<br>)
* **Left dataset:** ri.foundry.main.dataset.left
* **Right dataset:** ri.foundry.main.dataset.right

**Inputs:**

ri.foundry.main.dataset.left

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| PA-452 | new air | 212 | 2 |
| XB-123 | foundry airline | 1134 | 2 |

ri.foundry.main.dataset.right

| tail\_number | home\_airport |
| ----- | ----- |
| XB-123 | LHR |
| MT-222 | CPH |
| KK-452 | JFK |
| JR-201 | IAD |

**Output:**

| tail\_number | airline | miles | factor |
| ----- | ----- | ----- | ----- |
| XB-123 | foundry air | 124 | 2 |
| MT-222 | new airline | 1123 | 5 |
| XB-123 | foundry airline | 335 | 5 |
| MT-222 | new air | 565 | 4 |
| KK-452 | new air | 222 | 1 |
| XB-123 | foundry airline | 1134 | 2 |

[See details](/docs/foundry/pb-functions-transform/complexSemiJoinV1/).

***

### Sort

> Supported in: Batch, Faster

Transforms input dataset either by selecting columns or applying functions to columns.

**Transform categories**: Other

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.a
* **Sort specification:** \[(`b`, `DESCENDING`)]

**Input:**

| a | b |
| ----- | ----- |
| 1 | 2 |
| 3 | 4 |
| 5 | 6 |

**Output:**

| a | b |
| ----- | ----- |
| 5 | 6 |
| 3 | 4 |
| 1 | 2 |

[See details](/docs/foundry/pb-functions-transform/sortV2/).

***

### Split on condition

> Supported in: Batch, Faster

Split an input into two outputs based on chosen condition.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/splitOnConditionV1/).

***

### Text block

> Supported in: Batch, Faster, Streaming

Insert a text description between your transformations. This does not transform the input data in any way.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/textBlockV1/).

***

### Time bounded drop duplicates

> Supported in: Streaming

Drops duplicate rows from the input for given column subset, rows seen will expire after configured amount of event time. Row that arrive late by an amount greater than the configured amount of event time will always be dropped. Partitions by keys specified. Each drop duplicates will be computed separately for distinct key column values.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/timeBoundedDropDuplicatesV3/).

***

### Time bounded drop out of order

> Supported in: Streaming

Drops rows with the same values for all key columns that are out of order. A row is out of order if it would have come before an already received row with the same key values based on sort columns and directions. Two rows are compared by evaluating the first sort column and direction first, and then moving on to the next sort column and direction if and only if there was a tie, and so on until order is determined or all sort columns are tied in which case the rows are equal. The current maximum for each key is stored until no new rows have been seen for that key for an event time greater than or equal to the expiry. After a key has received no new rows for greater or equal to the expiry time, any new row for that key will be never be dropped, and will always be stored as the new current maximum.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/timeBoundedDropOutOfOrderTransformV1/).

***

### Time bounded event time sort

> Supported in: Streaming

Emits rows by key in ascending event time order, allowing for late arriving records up until at least the allowed lateness. Records arriving after the allowed lateness plus some small buffer interval will be dropped.

**Transform categories**: Other

[See details](/docs/foundry/pb-functions-transform/timeBoundedEventTimeSortV1/).

***

### Top rows

> Supported in: Batch, Faster

Picks the top rows in each sorted partition.

**Transform categories**: Aggregate

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.a
* **Partition by columns:** {`airline`}
* **Sort specification:** \[(`airport`, `DESCENDING`), (`miles`, `ASCENDING`)]
* **Number of rows:** *null*

**Input:**

| airline | airport | miles |
| ----- | ----- | ----- |
| foundry airways | JFK | 1002345 |
| foundry airways | LHR | 2221324 |
| new air | SFO | 21356673 |
| new air | JFK | 12323456 |
| foundry airways | LHR | 12542352 |
| new air | JFK | 12232355 |

**Output:**

| airline | airport | miles |
| ----- | ----- | ----- |
| foundry airways | LHR | 2221324 |
| new air | SFO | 21356673 |

[See details](/docs/foundry/pb-functions-transform/topRowV2/).

***

### Union by name

> Supported in: Batch, Faster, Streaming

Unions a set of datasets together on matching column names.

**Transform categories**: Join

#### Example

**Argument values:**

* **Datasets to union:** \[ri.foundry.main.dataset.a, ri.foundry.main.dataset.b]

**Inputs:**

ri.foundry.main.dataset.a

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |

ri.foundry.main.dataset.b

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | AA-200 | AA |
| true | BN-435 | BN |
| true | BN-111 | BN |

**Output:**

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |
| true | AA-200 | AA |
| true | BN-435 | BN |
| true | BN-111 | BN |

[See details](/docs/foundry/pb-functions-transform/unionByNameV1/).

***

### Union files

> Supported in: Batch

Union datasets of files.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/unionFilesV1/).

***

### Unpivot

> Supported in: Batch, Faster, Streaming

Unpivot is the opposite operation of pivot. This converts multiple columns into rows, transforming data from a wide format to a long format. To do so it creates two new columns: one containing the original column names as values, and another containing the corresponding data values. All other columns that are not unpivoted are kept as is.

**Transform categories**: Aggregate, Popular

**Type variable bounds:** *T accepts AnyType*

#### Example

**Argument values:**

* **Columns to unpivot:** \[`new_york_miles`, `london_miles`]
* **Dataset:** ri.foundry.main.dataset.a
* **Name column:** city
* **Value column:** miles

**Input:**

| airline | new\_york\_miles | london\_miles |
| ----- | ----- | ----- |
| foundry airways | 1000 | 6000 |
| new air | *null* | 8000 |

**Output:**

| city | miles | airline |
| ----- | ----- | ----- |
| new\_york\_miles | 1000 | foundry airways |
| london\_miles | 6000 | foundry airways |
| new\_york\_miles | *null* | new air |
| london\_miles | 8000 | new air |

[See details](/docs/foundry/pb-functions-transform/unpivotV1/).

***

### Unzip files

> Supported in: Batch

Unzips each file in a dataset of zipped files. Any non-zip files are ignored. Note that users must have editor permission to be able to preview the unzip file transform and all downstream nodes.

**Transform categories**: File

[See details](/docs/foundry/pb-functions-transform/unzipFilesV1/).

***

### Uppercase column names

> Supported in: Batch, Faster, Streaming

Uppercases all column names in the dataset.

**Transform categories**: Data preparation

#### Example

**Argument values:**

* **Dataset:** ri.foundry.main.dataset.a

**Input:**

| recentlyServiced | tailNumber | airlineCode |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |

**Output:**

| RECENTLYSERVICED | TAILNUMBER | AIRLINECODE |
| ----- | ----- | ----- |
| true | KK-150 | KK |
| false | XB-120 | XB |
| true | MT-190 | MT |

[See details](/docs/foundry/pb-functions-transform/uppercaseColumnNamesV1/).

***

### Wide union by name

> Supported in: Batch, Faster, Streaming

Unions a set of datasets together on the superset of their column names, adding nulls when columns are missing.

**Transform categories**: Join

#### Example

**Argument values:**

* **Datasets to union:** \[ri.foundry.main.dataset.a, ri.foundry.main.dataset.b]

**Inputs:**

ri.foundry.main.dataset.a

| recently\_serviced | tail\_number |
| ----- | ----- |
| true | KK-150 |
| false | XB-120 |
| true | MT-190 |

ri.foundry.main.dataset.b

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | AA-200 | AA |
| true | BN-435 | BN |
| true | BN-111 | BN |

**Output:**

| recently\_serviced | tail\_number | airline\_code |
| ----- | ----- | ----- |
| true | KK-150 | *null* |
| false | XB-120 | *null* |
| true | MT-190 | *null* |
| true | AA-200 | AA |
| true | BN-435 | BN |
| true | BN-111 | BN |

[See details](/docs/foundry/pb-functions-transform/wideUnionByNameV1/).

***

### Window

> Supported in: Batch, Faster

Performs the specified aggregations on the input dataset grouped by a set of columns.

**Transform categories**: Aggregate, Popular

[See details](/docs/foundry/pb-functions-transform/windowV1/).

***
