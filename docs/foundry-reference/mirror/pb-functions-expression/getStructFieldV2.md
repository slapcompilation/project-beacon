<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/getStructFieldV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Get struct field

> Supported in: Batch, Faster, Streaming

Extracts a field from a struct.

**Expression categories:** Struct

## Declared arguments

* **Locator:** Extract inner elements with multiple entries like \['author', 'email'].<br>*StructLocator*
* **Struct:** *no description*<br>*Expression\<Struct>*

**Output type:** *AnyType*

## Examples

### Example 1: Base case

**Argument values:**

* **Locator:** airline.id
* **Struct:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **id**: NA,<br>},<br>} | NA |
| {<br> **airline**: {<br> **id**: FE,<br>},<br>} | FE |

***

### Example 2: Base case

**Argument values:**

* **Locator:** airline.id
* **Struct:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: *null*,<br>} | *null* |
| {<br> **airline**: {<br> **id**: *null*,<br>},<br>} | *null* |
| *null* | *null* |

***
