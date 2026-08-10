<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/rowCountV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Row count

> Supported in: Batch, Faster, Streaming

Counts the number of non null rows in a group.

**Expression categories:** Aggregate

## Declared arguments

* *optional* **Expression:** *no description*<br>*Expression\<AnyType>*

**Output type:** *Long*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 3

***

### Example 2: Null case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| *null* |
| 3 |

**Outputs:** 2

***
