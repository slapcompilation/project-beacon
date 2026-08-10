<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/addOrUpdateStructFieldV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Add or update struct field

> Supported in: Batch, Faster, Streaming

Updates a field of a struct or adds a new field.

**Expression categories:** Struct

## Declared arguments

* **Expression:** Expression to update struct field with.<br>*Expression\<AnyType>*
* **Locator:** Locate inner elements with multiple entries like \['author', 'email'].<br>*StructLocator*
* **Struct:** The struct to update.<br>*Expression\<Struct>*

**Output type:** *Struct*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `value`
* **Locator:** flight
* **Struct:** `struct`

| struct | value | **Output** |
| ----- | ----- | ----- |
| {<br> **airline**: {<br> **id**: NA,<br>},<br>} | foo | {<br> **airline**: {<br> **id**: NA,<br>},<br> **flight**: foo,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `value`
* **Locator:** flight
* **Struct:** `struct`

| struct | value | **Output** |
| ----- | ----- | ----- |
| {<br> **airline**: {<br> **id**: FE,<br>},<br>} | {<br> **id**: 1,<br>} | {<br> **airline**: {<br> **id**: FE,<br>},<br> **flight**: {<br> **id**: 1,<br>},<br>} |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `value`
* **Locator:** airline.id
* **Struct:** `struct`

| struct | value | **Output** |
| ----- | ----- | ----- |
| {<br> **airline**: {<br> **id**: NA,<br>},<br>} | 1 | {<br> **airline**: {<br> **id**: 1,<br>},<br>} |
| {<br> **airline**: {<br> **id**: FE,<br>},<br>} | 2 | {<br> **airline**: {<br> **id**: 2,<br>},<br>} |

***

### Example 4: Null case

**Argument values:**

* **Expression:** `value`
* **Locator:** airline.id
* **Struct:** `struct`

| struct | value | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |
| *null* | 1 | *null* |
| {<br> **airline**: {<br> **id**: FE,<br>},<br>} | *null* | {<br> **airline**: {<br> **id**: *null*,<br>},<br>} |

***
