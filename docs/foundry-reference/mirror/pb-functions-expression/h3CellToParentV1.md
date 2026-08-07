<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/h3CellToParentV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# H3 cell to parent

> Supported in: Batch, Faster, Streaming

Get parent of an H3 index at given resolution specifying parent coarseness. Returns null for resolution <0 or >15 or resolution higher than given index.

**Expression categories:** Geospatial

## Declared arguments

* **H3 index:** A valid H3 index.<br>*Expression\<H3 Index>*
* **Parent resolution:** H3 grid parent resolution between 0 and 15 (inclusive).<br>*Expression\<Byte | Integer | Long | Short>*

**Output type:** *H3 Index*

## Examples

### Example 1: Base case

**Argument values:**

* **H3 index:** `h3Index`
* **Parent resolution:** `parentResolution`

| h3Index | parentResolution | **Output** |
| ----- | ----- | ----- |
| 881f1d4887fffff | 7 | 871f1d488ffffff |
| 860800017ffffff | 3 | 830800fffffffff |

***

### Example 2: Null case

**Argument values:**

* **H3 index:** `h3Index`
* **Parent resolution:** `parentResolution`

| h3Index | parentResolution | **Output** |
| ----- | ----- | ----- |
| 87283472bgggggg | 9 | *null* |
| 860800017ffffff | -1 | *null* |
| 860800017ffffff | 16 | *null* |
| *null* | 6 | *null* |
| 860800017ffffff | *null* | *null* |

***

### Example 3: Edge case

**Argument values:**

* **H3 index:** `h3Index`
* **Parent resolution:** 15

| h3Index | **Output** |
| ----- | ----- |
| 8f2000000000000 | 8f2000000000000 |

***

### Example 4: Edge case

**Argument values:**

* **H3 index:** `h3Index`
* **Parent resolution:** 0

| h3Index | **Output** |
| ----- | ----- |
| 860800017ffffff | 8009fffffffffff |

***
