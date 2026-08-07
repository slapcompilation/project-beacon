<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/parseJsonAsSchemaV3/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Parse JSON string

> Supported in: Batch, Faster, Streaming

Parses JSON string following the given schema definition, ignoring any fields not in the schema.

**Expression categories:** Data preparation, Popular, String, Struct

## Declared arguments

* **JSON:** JSON to be parsed using the schema.<br>*Expression\<String>*
* **Schema:** Schema definition used when parsing the JSON strings.<br>*Type\<Array\<AnyType> | Map\<String, String> | Struct>*
* *optional* **Output mode:** The 'simple' output mode will treat fields that fail to parse as null. The 'with errors' output mode will return a parsable struct with any errors found during parsing in an 'error' field and a valid parsed json in the 'ok' field.<br>*Enum\<Simple, With errors>*

**Output type:** *Array\<AnyType> | Map\<String, String> | Struct*

## Examples

### Example 1: Base case

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Integer>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "miles": 2000<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **id**: JFK,<br> **miles**: 2000,<br>},<br>} |

***

### Example 2: Base case

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Integer>>
* **Output mode:** `WITH_ERRORS`

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "miles": 2000<br> }<br>} | {<br> **error**: *null*,<br> **ok**: {<br> **airline**: XB-112,<br> **airport**: {<br> **id**: JFK,<br> **miles**: 2000,<br>},<br>},<br>} |

***

### Example 3: Null case

**Description:** When a requested field is missing in the input JSON the field becomes null.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Integer>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK"<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **id**: JFK,<br> **miles**: *null*,<br>},<br>} |

***

### Example 4: Null case

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Integer>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 5: Null case

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Integer>>
* **Output mode:** `WITH_ERRORS`

| json | **Output** |
| ----- | ----- |
| *null* | {<br> **error**: JSON input is null or empty,<br> **ok**: *null*,<br>} |

***

### Example 6: Null case

**Description:** When a requested field is null in the input JSON the field becomes null.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Integer>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "miles": null<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **id**: JFK,<br> **miles**: *null*,<br>},<br>} |

***

### Example 7: Null case

**Description:** Test field of struct being an array.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, countries:Array\<String>>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "countries": \["USA", "Canada"]<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **countries**: \[ USA, Canada ],<br> **id**: JFK,<br>},<br>} |

***

### Example 8: Null case

**Description:** Test field of struct being empty string.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, countries:Array\<String>>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "",<br>     "countries": \["USA", "Canada"]<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **countries**: \[ USA, Canada ],<br> **id**: *empty string*,<br>},<br>} |

***

### Example 9: Null case

**Description:** Test field of struct being an array with null element.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, countries:Array\<String>>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "countries": \["USA", null]<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **countries**: \[ USA, *null* ],<br> **id**: JFK,<br>},<br>} |

***

### Example 10: Null case

**Description:** Test field of struct being a null string.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, countries:Array\<String>>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": null,<br>     "countries": \["USA", "Canada"]<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **countries**: \[ USA, Canada ],<br> **id**: *null*,<br>},<br>} |

***

### Example 11: Null case

**Description:** Test struct with one field being a map.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, countries:Map\<String, Integer>>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "countries": {"USA": 4}<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **countries**: {<br> USA -> 4,<br>},<br> **id**: JFK,<br>},<br>} |

***

### Example 12: Null case

**Description:** Parse struct with double field.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Double>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "miles": 4.2<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **id**: JFK,<br> **miles**: 4.2,<br>},<br>} |

***

### Example 13: Null case

**Description:** Ints parsed as doubles should return doubles.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Double>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "miles": 4<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **id**: JFK,<br> **miles**: 4.0,<br>},<br>} |

***

### Example 14: Null case

**Description:** When a map has a null value, the resultant struct will have a null value.

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, countries:Map\<String, Integer>>>
* **Output mode:** *null*

| json | **Output** |
| ----- | ----- |
| {<br> "airline": "XB-112",<br> "airport": {<br>     "id": "JFK",<br>     "countries": {"USA": null}<br> }<br>} | {<br> **airline**: XB-112,<br> **airport**: {<br> **countries**: {<br> USA -> *null*,<br>},<br> **id**: JFK,<br>},<br>} |

***

### Example 15: Edge case

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Integer>>
* **Output mode:** `WITH_ERRORS`

| json | **Output** |
| ----- | ----- |
| invalid | {<br> **error**: The JSON content is invalid or malformed,<br> **ok**: *null*,<br>} |

***

### Example 16: Edge case

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<boolVal:Boolean, byteVal:Byte, shortVal:Short, intVal:Integer, longVal:Long, doubleVal:Double, floatVal:Float, dateVal:Date, timestampVal:Timestamp, decimalVal:Decimal(9, 4), myMap:Map\<String, Integer>, myArray:Array\<Integer>>
* **Output mode:** `WITH_ERRORS`

| json | **Output** |
| ----- | ----- |
| {<br> "timestampVal": "This is a string."<br>} | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"boolVal": 5}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"byteVal": "This is not a byte."}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"shortVal": "This is not a short."}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"longVal": "This is not a long."}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"intVal": 5.2}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"doubleVal": "This is not a double."}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"floatVal": "This is not a float."}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"dateVal": "32/13/2020"}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"decimalVal": "This is not a decimal."}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"myMap": {"a": "str"}}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |
| {"myArray": \["a", "b"]}<br> | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |

***

### Example 17: Edge case

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airport:Struct\<id:String, miles:Integer>, boolVal:Boolean>
* **Output mode:** `WITH_ERRORS`

| json | **Output** |
| ----- | ----- |
| {<br> "boolVal": true<br>} | {<br> **error**: *null*,<br> **ok**: {<br> **airport**: *null*,<br> **boolVal**: true,<br>},<br>} |
| {<br> "boolVal": "This is a string."<br>} | {<br> **error**: The JSON content does not match the expected type,<br> **ok**: *null*,<br>} |

***

### Example 18: Edge case

**Argument values:**

* **JSON:** `json`
* **Schema:** Struct\<airline:String, airport:Struct\<id:String, miles:Integer>>
* **Output mode:** `WITH_ERRORS`

| json | **Output** |
| ----- | ----- |
| {<br> "arrival\_time":<br> | {<br> **error**: There was an unexpected EOF while parsing the JSON,<br> **ok**: *null*,<br>} |

***
