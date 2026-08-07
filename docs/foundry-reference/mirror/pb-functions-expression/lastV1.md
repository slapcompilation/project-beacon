<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/lastV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Last

> Supported in: Batch, Faster, Streaming

Last item in the group. Note, if used within an aggregate or unordered window, the row selected will be non-deterministic.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** Expression to aggregate.<br>*Expression\<T>*
* **Ignore nulls:** If true, null values will be ignored.<br>*Literal\<Boolean>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `values`
* **Ignore nulls:** false

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |
| *null* |

**Outputs:** *null*

***

### Example 2: Base case

**Argument values:**

* **Expression:** `values`
* **Ignore nulls:** true

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |
| *null* |

**Outputs:** 3

***
