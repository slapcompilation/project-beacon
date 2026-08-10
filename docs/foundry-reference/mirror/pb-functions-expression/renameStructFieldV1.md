<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/renameStructFieldV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Rename struct field

> Supported in: Batch, Faster, Streaming

Rename fields within a struct.

**Expression categories:** Data preparation, Struct

## Declared arguments

* **Expression:** *no description*<br>*Expression\<Struct>*
* **Renames:** *no description*<br>*List\<Tuple\<StructLocator, Literal\<String>>>*

**Output type:** *Struct*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `struct`
* **Renames:** \[(airline.id, identifier)]

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **id**: NA,<br>},<br>} | {<br> **airline**: {<br> **identifier**: NA,<br>},<br>} |
| {<br> **airline**: {<br> **id**: FE,<br>},<br>} | {<br> **airline**: {<br> **identifier**: FE,<br>},<br>} |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `struct`
* **Renames:** \[(airline.id, identifier)]

| struct | **Output** |
| ----- | ----- |
| *null* | *null* |

***
