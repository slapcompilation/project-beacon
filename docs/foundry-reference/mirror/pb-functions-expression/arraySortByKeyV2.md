<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arraySortByKeyV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array sort by struct key

> Supported in: Batch, Streaming

Returns a sorted array of the given input array of structs sorted by the values of the given struct keys.

**Expression categories:** Array

## Declared arguments

* **Input array:** Input array of structs to be sorted.<br>*Expression\<Array\<Struct>>*
* **Sort keys:** Struct keys to sort array by in order of sort priority. Sort nested struct elements with multiple entries like \['author', 'age'].<br>*List\<Tuple\<StructLocator, Enum\<Ascending, Descending>>>*

**Output type:** *Array\<Struct>*

## Examples

### Example 1: Base case

**Argument values:**

* **Input array:** \[ {<br> **age**: 20,<br>}, {<br> **age**: 10,<br>}, {<br> **age**: 30,<br>} ]
* **Sort keys:** \[(age, `ASCENDING`)]

**Output:** \[ {<br> **age**: 10,<br>}, {<br> **age**: 20,<br>}, {<br> **age**: 30,<br>} ]

***

### Example 2: Base case

**Argument values:**

* **Input array:** \[ {<br> **age**: 20,<br>}, {<br> **age**: 10,<br>}, {<br> **age**: 30,<br>} ]
* **Sort keys:** \[(age, `DESCENDING`)]

**Output:** \[ {<br> **age**: 30,<br>}, {<br> **age**: 20,<br>}, {<br> **age**: 10,<br>} ]

***

### Example 3: Base case

**Argument values:**

* **Input array:** \[ {<br> **age**: 20,<br> **height**: 77,<br>}, {<br> **age**: 20,<br> **height**...
* **Sort keys:** \[(age, `ASCENDING`), (height, `DESCENDING`)]

**Output:** \[ {<br> **age**: 10,<br> **height**: 80,<br>}, {<br> **age**: 10,<br> **height**...

***

### Example 4: Base case

**Argument values:**

* **Input array:** \[ {<br> **age**: 20,<br> **height**: 77,<br>}, {<br> **age**: 20,<br> **height**...
* **Sort keys:** \[(age, `ASCENDING`), (height, `ASCENDING`)]

**Output:** \[ {<br> **age**: 10,<br> **height**: 65,<br>}, {<br> **age**: 10,<br> **height**...

***

### Example 5: Base case

**Argument values:**

* **Input array:** \[ {<br> **subStructKey**: {<br> **age**: 20,<br>},<br>}, {<br> **subStructKey**: {<br> **age**: 10,<br>},<br>}, {<br> **subStructKey**: {<br> **age**: 30,<br>},<br>} ]
* **Sort keys:** \[(subStructKey.age, `ASCENDING`)]

**Output:** \[ {<br> **subStructKey**: {<br> **age**: 10,<br>},<br>}, {<br> **subStructKey**: {<br> **age**: 20,<br>},<br>}, {<br> **subStructKey**: {<br> **age**: 30,<br>},<br>} ]

***

### Example 6: Null case

**Argument values:**

* **Input array:** \[ {<br> **age**: *null*,<br> **height**: 77,<br>}, {<br> **age**: *null*,<br> \*\*...
* **Sort keys:** \[(age, `ASCENDING`)]

**Output:** \[ {<br> **age**: *null*,<br> **height**: 77,<br>}, {<br> **age**: *null*,<br> \*\*...

***

### Example 7: Null case

**Argument values:**

* **Input array:** \[ {<br> **age**: 10,<br>}, {<br> **age**: *null*,<br>}, {<br> **age**: 30,<br>} ]
* **Sort keys:** \[(age, `ASCENDING`)]

**Output:** \[ {<br> **age**: *null*,<br>}, {<br> **age**: 10,<br>}, {<br> **age**: 30,<br>} ]

***

### Example 8: Null case

**Argument values:**

* **Input array:** \[ {<br> **age**: 10,<br>}, {<br> **age**: *null*,<br>}, {<br> **age**: 30,<br>} ]
* **Sort keys:** \[(age, `DESCENDING`)]

**Output:** \[ {<br> **age**: 30,<br>}, {<br> **age**: 10,<br>}, {<br> **age**: *null*,<br>} ]

***
