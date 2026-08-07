<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/jsonStringV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert data to JSON

> Supported in: Batch, Faster, Streaming

Transforms input into json string.

**Expression categories:** File, String

## Declared arguments

* **Input:** Input to be transformed.<br>*Expression\<Array\<AnyType> | Map\<AnyType, AnyType> | Struct>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Input:** `array`

| array | **Output** |
| ----- | ----- |
| \[ hello, world ] | \["hello","world"] |

***

### Example 2: Base case

**Argument values:**

* **Input:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **id**: NA,<br>},<br>} | {"airline":{"id":"NA"}} |

***

### Example 3: Base case

**Argument values:**

* **Input:** `struct_0`

| struct\_0 | **Output** |
| ----- | ----- |
| {<br> **date**: 2021-01-01,<br> **dec32**: 1.12,<br> **dec33**: 0.120,<br> \*\*dec... | {"dec32":1.12,"dec33":0.120,"dec64":10.0000,"timestamp":"2021-01-01T01:01:01.000Z","date":"2021-01-01","struct\_1":{"airline":{"id":"NA"}}} |

***

### Example 4: Base case

**Argument values:**

* **Input:** `array`

| array | **Output** |
| ----- | ----- |
| \[ 1.00, 2.10, 36.00 ] | \[1.00,2.10,36.00] |

***

### Example 5: Base case

**Argument values:**

* **Input:** `map`

| map | **Output** |
| ----- | ----- |
| {<br> a -> 1,<br> b -> 2,<br>} | {"a":"1","b":"2"} |

***

### Example 6: Base case

**Argument values:**

* **Input:** `array`

| array | **Output** |
| ----- | ----- |
| \[ {<br> **airline**: {<br> **id**: NA,<br>},<br>}, *null* ] | \[{"airline":{"id":"NA"}},null] |

***

### Example 7: Base case

**Argument values:**

* **Input:** `map`

| map | **Output** |
| ----- | ----- |
| {<br> a -> {<br> **airline**: {<br> **id**: NA,<br>},<br>},<br>} | {"a":{"airline":{"id":"NA"}}} |

***

### Example 8: Base case

**Argument values:**

* **Input:** `struct_0`

| struct\_0 | **Output** |
| ----- | ----- |
| {<br> **array\_1**: \[ *null*, *null*, *null* ],<br> **struct\_1**: {<br> **double**: *null*,<br> **string**: *null*,<br>},<br>} | {"struct\_1":{"string":null,"double":null},"array\_1":\[null,null,null]} |
| {<br> **array\_1**: *null*,<br> **struct\_1**: *null*,<br>} | {"struct\_1":null,"array\_1":null} |

***
