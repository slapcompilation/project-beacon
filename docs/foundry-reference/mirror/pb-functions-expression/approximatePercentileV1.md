<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/approximatePercentileV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Approximate percentile

> Supported in: Batch

Returns the approximate percentile of the expression which is the smallest value in the ordered expression values (sorted from least to greatest) such that no more than percentage of expression values is less than the value or equal to that value.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** Input expression.<br>*Expression\<Numeric>*
* **Percentiles:** Percentiles to calculate, if a single value is given, the output will be a double, if more than one value is provided, the output will be an array of doubles representing each percentile. Must range between 0 and 1.<br>*List\<Literal\<Double>>*
* *optional* **Accuracy:** The accuracy parameter (default: 10000) is a positive integer which controls approximation accuracy at the cost of memory. Higher value of accuracy yields better accuracy, 1.0/accuracy is the relative error of the approximation.<br>*Literal\<Integer>*

**Output type:** *Array\<Numeric> | Byte | Decimal | Double | Float | Integer | Long | Short*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `values`
* **Percentiles:** \[0.5]
* **Accuracy:** *null*

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 3

***

### Example 2: Base case

**Argument values:**

* **Expression:** `values`
* **Percentiles:** \[0.33, 0.5, 0.66]
* **Accuracy:** *null*

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |
| 5 |
| 1 |

**Outputs:** \[ 2, 3, 4 ]

***

### Example 3: Null case

**Argument values:**

* **Expression:** `values`
* **Percentiles:** \[0.5]
* **Accuracy:** *null*

**Given input table:**

| values |
| ----- |
| *null* |
| *null* |
| *null* |

**Outputs:** *null*

***

### Example 4: Null case

**Argument values:**

* **Expression:** `values`
* **Percentiles:** \[0.5]
* **Accuracy:** *null*

**Given input table:**

| values |
| ----- |
| *null* |
| 1 |
| 3 |

**Outputs:** 1

***
