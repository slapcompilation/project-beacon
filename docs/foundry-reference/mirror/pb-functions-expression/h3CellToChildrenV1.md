<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/h3CellToChildrenV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# H3 cell to children

> Supported in: Batch, Faster, Streaming

Get children of an H3 index at given resolution specifying children coarseness. Returns null for resolution <0 or >15 or for children resolution lower than given H3 index's resolution.

**Expression categories:** Geospatial

## Declared arguments

* **Children resolution:** H3 grid children resolution between 0 and 15 (inclusive).<br>*Expression\<Byte | Integer | Long | Short>*
* **H3 index:** A valid H3 index.<br>*Expression\<H3 Index>*

**Output type:** *Array\<H3 Index>*

## Examples

### Example 1: Base case

**Argument values:**

* **Children resolution:** `childrenResolution`
* **H3 index:** `h3Index`

| h3Index | childrenResolution | **Output** |
| ----- | ----- | ----- |
| 85283473fffffff | 6 | \[ 862834707ffffff, 86283470fffffff, 862834717ffffff, 86283471fffffff, 862834727ffffff, 86283472fffffff, 862834737ffffff ] |
| 881F1D4887FFFFF | 9 | \[ 891f1d48863ffff, 891f1d48867ffff, 891f1d4886bffff, 891f1d4886fffff, 891f1d48873ffff, 891f1d48877ffff, 891f1d4887bffff ] |
| 86be8d12fffffff | 8 | \[ 88be8d1281fffff, 88be8d1283fffff, 88be8d1285fffff, 88be8d1287fffff, 88be8d1289fffff, 88be8d128bfff... |

***

### Example 2: Null case

**Argument values:**

* **Children resolution:** `childrenResolution`
* **H3 index:** `h3Index`

| h3Index | childrenResolution | **Output** |
| ----- | ----- | ----- |
| 85283473fffffff | 4 | *null* |

***

### Example 3: Null case

**Argument values:**

* **Children resolution:** `childrenResolution`
* **H3 index:** `h3Index`

| h3Index | childrenResolution | **Output** |
| ----- | ----- | ----- |
| 87283472bgggggg | 9 | *null* |
| 860800017ffffff | -1 | *null* |
| 860800017ffffff | 16 | *null* |
| *null* | 6 | *null* |
| 860800017ffffff | *null* | *null* |

***

### Example 4: Edge case

**Argument values:**

* **Children resolution:** `childrenResolution`
* **H3 index:** `h3Index`

| h3Index | childrenResolution | **Output** |
| ----- | ----- | ----- |
| 8e1fb46741ae99f | 15 | \[ 8f1fb46741ae998, 8f1fb46741ae999, 8f1fb46741ae99a, 8f1fb46741ae99b, 8f1fb46741ae99c, 8f1fb46741ae99d, 8f1fb46741ae99e ] |

***

### Example 5: Edge case

**Argument values:**

* **Children resolution:** `childrenResolution`
* **H3 index:** `h3Index`

| h3Index | childrenResolution | **Output** |
| ----- | ----- | ----- |
| 8029fffffffffff | 0 | \[ 8029fffffffffff ] |

***

### Example 6: Edge case

**Argument values:**

* **Children resolution:** `childrenResolution`
* **H3 index:** `h3Index`

| h3Index | childrenResolution | **Output** |
| ----- | ----- | ----- |
| 8928308280fffff | 9 | \[ 8928308280fffff ] |

***
