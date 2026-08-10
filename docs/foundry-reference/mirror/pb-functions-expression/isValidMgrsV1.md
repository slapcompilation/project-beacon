<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidMgrsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid MGRS

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid MGRS (military grid reference system) string.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** String following an MGRS (military grid reference system) format.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `mgrs`

| mgrs | **Output** |
| ----- | ----- |
| not an mgrs value | false |
| 4Q FJ | false |
| 1 6 | false |
| 4Q | false |
| 4Q FJ 1 | false |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `mgrs`

| mgrs | **Output** |
| ----- | ----- |
| 4Q FJ 1 6 | true |
| 4Q FJ 12345 67890 | true |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `mgrs`

| mgrs | **Output** |
| ----- | ----- |
| *null* | false |

***
