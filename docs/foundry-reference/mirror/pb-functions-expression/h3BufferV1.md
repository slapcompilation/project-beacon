<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/h3BufferV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Buffer H3 indices

> Supported in: Batch, Faster, Streaming

Creates a buffer of distance k from an array of H3 indices.

**Expression categories:** Geospatial

## Declared arguments

* **Array of H3 indices:** Array from which a buffer of distance k is created.<br>*Expression\<Array\<H3 Index>>*
* **Distance k:** Distance k implies a buffer of k H3 cells. Value of k must be >=0.<br>*Expression\<Integer>*

**Output type:** *Array\<H3 Index>*

## Examples

### Example 1: Base case

**Argument values:**

* **Array of H3 indices:** `h3Array`
* **Distance k:** 0

| h3Array | **Output** |
| ----- | ----- |
| \[ 8528340bfffffff ] | \[ 8528340bfffffff ] |
| \[  ] | \[  ] |

***

### Example 2: Base case

**Argument values:**

* **Array of H3 indices:** `h3Array`
* **Distance k:** 2

| h3Array | **Output** |
| ----- | ----- |
| \[ 8528340bfffffff ] | \[ 85283403fffffff, 85283407fffffff, 8528340bfffffff, 8528340ffffffff, 85283413fffffff, 85283417fffff... |
| \[ 85283403fffffff, 85283407fffffff, 8528341bfffffff, 852834cffffffff ] | \[ 85283403fffffff, 85283407fffffff, 8528340bfffffff, 8528340ffffffff, 85283413fffffff, 85283417fffff... |
| \[ 85283403fffffff, 85283407fffffff ] | \[ 85283403fffffff, 85283407fffffff, 8528340bfffffff, 8528340ffffffff, 85283413fffffff, 85283417fffff... |
| \[ 85283403fffffff, 852834cffffffff ] | \[ 85283403fffffff, 85283407fffffff, 8528340bfffffff, 8528340ffffffff, 85283413fffffff, 85283417fffff... |
| \[ 852835cffffffff, 8529a937fffffff ] | \[ 85283427fffffff, 85283437fffffff, 85283453fffffff, 8528345bfffffff, 852834c3fffffff, 852834cbfffff... |

***

### Example 3: Null case

**Argument values:**

* **Array of H3 indices:** `h3Array`
* **Distance k:** 1

| h3Array | **Output** |
| ----- | ----- |
| *null* | *null* |
| \[ Invalid H3 ] | *null* |

***
