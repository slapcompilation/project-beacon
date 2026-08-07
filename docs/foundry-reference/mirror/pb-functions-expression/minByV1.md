<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/minByV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Min by

> Supported in: Streaming

This expression computes a min row according to the min column expression after applying the provided filter specification. If there is no minimum row, null will be returned.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** Column expression on which the min is computed. Null values are treated as if they have the largest value.<br>*Expression\<ComparableType>*
* **Output projection expression:** Defines the projection expression that is applied on the minimum row before it is returned.<br>*Expression\<AnyType>*
* *optional* **Filter condition:** This parameter defines the filter specification that is applied on the rows contained within the window. The output of this expression will only reference rows which are not filtered by this parameter (i.e., where the condition evaluates to true). If no rows exist in state at the time of a trigger, null will be emitted.<br>*Expression\<Boolean>*

**Output type:** *AnyType*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `salary`
* **Output projection expression:** `salary`
* **Filter condition:** <br>greaterThan(<br> left: `salary`,<br> right: 0,<br>)

**Given input table:**

| dep\_name | salary |
| ----- | ----- |
| develop | -999 |
| develop | 4000 |
| develop | 3000 |

**Outputs:** 3000

***

### Example 2: Base case

**Argument values:**

* **Expression:** `salary`
* **Output projection expression:** `salary`
* **Filter condition:** *null*

**Given input table:**

| dep\_name | salary |
| ----- | ----- |
| develop | 4000 |
| develop | *null* |
| develop | 1000 |

**Outputs:** 1000

***
