<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/firstNonNullV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# First non null value (coalesce)

> Supported in: Batch, Faster, Streaming

Picks first non null value of the inputs. Known as coalesce in sql.

**Expression categories:** Data preparation

## Declared arguments

* **Expressions:** The first non null values of these expressions will be returned.<br>*List\<Expression\<T>>*
* *optional* **Treat empty strings as null:** Treat all empty strings as null values.<br>*Literal\<Boolean>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Expressions:** \[`tail_number`, `airline`]
* **Treat empty strings as null:** *null*

| tail\_number | airline | **Output** |
| ----- | ----- | ----- |
| XB-123 | *null* | XB-123 |
| *null* | MT | MT |

***

### Example 2: Base case

**Argument values:**

* **Expressions:** \[`tail_number`, `airline`]
* **Treat empty strings as null:** true

| tail\_number | airline | **Output** |
| ----- | ----- | ----- |
| XB-123 | *null* | XB-123 |
| *empty string* | MT | MT |

***

### Example 3: Null case

**Argument values:**

* **Expressions:** \[`tail_number`, `airline`]
* **Treat empty strings as null:** *null*

| tail\_number | airline | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |

***
