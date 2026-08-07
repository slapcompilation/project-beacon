<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/medianV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Median

> Supported in: Batch, Faster

Calculate median of values in column.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** The column of on which median is computed.<br>*Expression\<Numeric>*

**Output type:** *Decimal | Double*

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

**Outputs:** 3.0

***

### Example 2: Base case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 5 |
| 5 |
| 5 |
| 10 |
| 10 |

**Outputs:** 5.0

***

### Example 3: Base case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 1 |
| 2 |
| 3 |
| 4 |

**Outputs:** 2.5

***

### Example 4: Null case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| *null* |
| *null* |
| *null* |

**Outputs:** *null*

***

### Example 5: Null case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| *null* |
| 3 |

**Outputs:** 2.5

***

### Example 6: Edge case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 10 |
| 5 |
| 5 |
| 10 |
| 10 |

**Outputs:** 10.0

***

### Example 7: Edge case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |

**Outputs:** *null*

***

### Example 8: Edge case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 42 |

**Outputs:** 42.0

***
