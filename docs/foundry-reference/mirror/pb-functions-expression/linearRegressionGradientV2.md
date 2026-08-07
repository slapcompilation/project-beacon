<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/linearRegressionGradientV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Linear regression gradient

> Supported in: Batch

Returns the slope of the linear regression line for non-null pairs in a group. Returns null if there are insufficient non-null pairs or if the variance of the independent variable is zero.

**Expression categories:** Aggregate

## Declared arguments

* **Left:** The independent variable.<br>*Expression\<Numeric>*
* **Right:** The dependent variable.<br>*Expression\<Numeric>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Left:** `left`
* **Right:** `right`

**Given input table:**

| left | right |
| ----- | ----- |
| 1 | 5 |
| 2 | 4 |
| 3 | 3 |
| 4 | 2 |
| 5 | 1 |

**Outputs:** -1.0

***

### Example 2: Base case

**Argument values:**

* **Left:** `left`
* **Right:** `right`

**Given input table:**

| left | right |
| ----- | ----- |
| 9.0 | 2.0 |
| 27.0 | 2.0 |
| 34.0 | 2.0 |
| 14.0 | 2.0 |
| 51.0 | 2.0 |

**Outputs:** 0.0

***

### Example 3: Base case

**Argument values:**

* **Left:** `left`
* **Right:** `right`

**Given input table:**

| left | right |
| ----- | ----- |
| 9.0 | 8.0 |
| 9.0 | 2.0 |
| 9.0 | 1.0 |
| 9.0 | 3.0 |
| 9.0 | 2.0 |

**Outputs:** *null*

***

### Example 4: Null case

**Argument values:**

* **Left:** `left`
* **Right:** `right`

**Given input table:**

| left | right |
| ----- | ----- |
| 1.0 | 2.0 |
| *null* | *null* |
| *null* | 1.0 |
| 1.0 | *null* |
| 2.0 | 1.0 |

**Outputs:** -1.0

***
