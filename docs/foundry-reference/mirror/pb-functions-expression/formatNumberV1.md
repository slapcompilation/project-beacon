<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/formatNumberV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Format number

> Supported in: Batch, Faster, Streaming

Formats a number to a specific number of decimal places.

**Expression categories:** Cast, Numeric, String

## Declared arguments

* **Decimal places:** The number of decimal places.<br>*Literal\<Integer>*
* **Number:** The number to format.<br>*Expression\<Numeric>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Description:** Formats a number to 2 decimal places.

**Argument values:**

* **Decimal places:** 2
* **Number:** 1234.5678

**Output:** 1,234.57

***

### Example 2: Base case

**Description:** Formats a byte number to 1 decimal place.

**Argument values:**

* **Decimal places:** 1
* **Number:** 42

**Output:** 42.0

***

### Example 3: Base case

**Description:** Formats a float number to 1 decimal place.

**Argument values:**

* **Decimal places:** 1
* **Number:** 1234.56

**Output:** 1,234.6

***

### Example 4: Base case

**Description:** Formats an integer number with no decimal places.

**Argument values:**

* **Decimal places:** 2
* **Number:** 1234

**Output:** 1,234.00

***

### Example 5: Base case

**Description:** Formats a large number to 2 decimal places.

**Argument values:**

* **Decimal places:** 2
* **Number:** 123456789.123456789

**Output:** 123,456,789.12

***

### Example 6: Base case

**Description:** Formats a long number to 1 decimal place.

**Argument values:**

* **Decimal places:** 1
* **Number:** 4242424242424242

**Output:** 4,242,424,242,424,242.0

***

### Example 7: Base case

**Description:** Formats a number with no decimal places.

**Argument values:**

* **Decimal places:** 0
* **Number:** 1234.5678

**Output:** 1,235

***

### Example 8: Base case

**Description:** Formats a short number to 1 decimal place.

**Argument values:**

* **Decimal places:** 1
* **Number:** 42

**Output:** 42.0

***

### Example 9: Base case

**Description:** Formats a large number to 2 decimal places.

**Argument values:**

* **Decimal places:** 2
* **Number:** 123456789123456789123456.0

**Output:** 123,456,789,123,456,789,123,456.00

***

### Example 10: Null case

**Description:** Handles null input.

**Argument values:**

* **Decimal places:** 2
* **Number:** `number`

| number | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 11: Edge case

**Description:** Formats a number to 50 decimal places.

**Argument values:**

* **Decimal places:** 50
* **Number:** 1234.0

**Output:** 1,234.00000000000000000000000000000000000000000000000000

***
