<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/uncompactH3SetV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Uncompact a set of H3 indices

> Supported in: Batch, Faster, Streaming

Uncompact H3 indices to the specified resolution. All input indices must be at a resolution less than or equal to the requested resolution or this transform will return null. If any of the input indices are invalid this transform will return null. Output indices are sorted in ascending order.

**Expression categories:** Geospatial

## Declared arguments

* **H3 set:** Set of H3 cells.<br>*Expression\<Array\<H3 Index>>*
* **Resolution:** H3 grid resolution between 0 and 15 (inclusive).<br>*Expression\<Byte | Integer | Long | Short>*

**Output type:** *Array\<H3 Index>*

## Examples

### Example 1: Base case

**Argument values:**

* **H3 set:** `h3_set`
* **Resolution:** `resolution`

| h3\_set | resolution | **Output** |
| ----- | ----- | ----- |
| \[ 86754e64fffffff, 87754a914ffffff, 87754a916ffffff, 87754a930ffffff, 87754a932ffffff, 87754a933ffff... | 7 | \[ 87754a914ffffff, 87754a916ffffff, 87754a930ffffff, 87754a932ffffff, 87754a933ffffff, 87754a934ffff... |

***

### Example 2: Null case

**Argument values:**

* **H3 set:** `h3_set`
* **Resolution:** `resolution`

| h3\_set | resolution | **Output** |
| ----- | ----- | ----- |
| *null* | 7 | *null* |
| \[ 86754e64fffffff, 87754a914ffffff, 87754a916ffffff, 87754a930ffffff, 87754a932ffffff, 87754a933ffff... | *null* | *null* |
| *null* | *null* | *null* |

***

### Example 3: Edge case

**Argument values:**

* **H3 set:** `h3_set`
* **Resolution:** `resolution`

| h3\_set | resolution | **Output** |
| ----- | ----- | ----- |
| \[ 87754e648ffffff, 87754e648ffffff ] | 7 | \[ 87754e648ffffff ] |

***

### Example 4: Edge case

**Argument values:**

* **H3 set:** `h3_set`
* **Resolution:** `resolution`

| h3\_set | resolution | **Output** |
| ----- | ----- | ----- |
| \[ 87754e648ffffff ] | 7 | \[ 87754e648ffffff ] |

***

### Example 5: Edge case

**Argument values:**

* **H3 set:** `h3_set`
* **Resolution:** `resolution`

| h3\_set | resolution | **Output** |
| ----- | ----- | ----- |
| \[ 87754e648ffffff ] | 6 | *null* |

***

### Example 6: Edge case

**Argument values:**

* **H3 set:** `h3_set`
* **Resolution:** `resolution`

| h3\_set | resolution | **Output** |
| ----- | ----- | ----- |
| \[ Invalid h3 index ] | 7 | *null* |

***
