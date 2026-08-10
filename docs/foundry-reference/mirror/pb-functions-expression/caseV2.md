<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/caseV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Case

> Supported in: Batch, Faster, Streaming

Choose between different branches based on conditions.

**Expression categories:** Popular

## Declared arguments

* **Default:** This value is chosen if all branches evaluate to false.<br>*Expression\<T>*
* *optional* **Branches:** Branches to evaluate before returning default value.<br>*List\<Tuple\<Expression\<Boolean>, Expression\<T>>>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Default:** Yes
* **Branches:** \[(<br>lessThan(<br> left: `miles`,<br> right: 15000,<br>), No)]

| miles | **Output** |
| ----- | ----- |
| 20053 | Yes |
| 10210 | No |
| 34120 | Yes |

***

### Example 2: Edge case

**Description:** When multiple branches output decimals of differing types, we widen the type to fit all.

**Argument values:**

* **Default:** `decimalThree`
* **Branches:** \[(<br>equals(<br> left: `value`,<br> right: 1,<br>), `decimalOne`), (<br>equals(<br> left: `value`,<br> right: 2,<br>), `decimalTwo`)]

| value | decimalOne | decimalTwo | decimalThree | **Output** |
| ----- | ----- | ----- | ----- | ----- |
| 1 | 111.11 | 2.2222 | 3333333.333 | 111.1100 |
| 2 | 111.11 | 2.2222 | 3333333.333 | 2.2222 |
| 3 | 111.11 | 2.2222 | 3333333.333 | 3333333.3330 |

***

### Example 3: Edge case

**Description:** When the wider type is too large, we truncate the type and overflows become null.

**Argument values:**

* **Default:** `decimalThree`
* **Branches:** \[(<br>equals(<br> left: `value`,<br> right: 1,<br>), `decimalOne`), (<br>equals(<br> left: `value`,<br> right: 2,<br>), `decimalTwo`)]

| value | decimalOne | decimalTwo | decimalThree | **Output** |
| ----- | ----- | ----- | ----- | ----- |
| 1 | 111111111111111111111111111111111111.11 | 2222222222222222222222222222.2222222222 | 333333333333333333.33333333333333333333 | *null* |
| 2 | 111111111111111111111111111111111111.11 | 2222222222222222222222222222.2222222222 | 333333333333333333.33333333333333333333 | *null* |
| 3 | 111111111111111111111111111111111111.11 | 2222222222222222222222222222.2222222222 | 333333333333333333.33333333333333333333 | 333333333333333333.33333333333333333333 |
| 3 | 111111111111111111111111111111111111.11 | 2222222222222222222222222222.2222222222 | 100.33333333333333333333 | 100.33333333333333333333 |
| 1 | 111.11 | 2222222222222222222222222222.2222222222 | 333333333333333333.33333333333333333333 | 111.11000000000000000000 |

***
