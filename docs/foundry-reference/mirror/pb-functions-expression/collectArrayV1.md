<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/collectArrayV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Collect array

> Supported in: Batch, Faster, Streaming

Collects an array of values within each group. Null values are ignored.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** The column of values to collect into an array.<br>*Expression\<T>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `factor`

**Given input table:**

| factor |
| ----- |
| 2 |
| 2 |
| 3 |

**Outputs:** \[ 2, 2, 3 ]

***

### Example 2: Null case

**Argument values:**

* **Expression:** `factor`

**Given input table:**

| factor |
| ----- |
| 2 |
| *null* |
| 3 |

**Outputs:** \[ 2, 3 ]

***
