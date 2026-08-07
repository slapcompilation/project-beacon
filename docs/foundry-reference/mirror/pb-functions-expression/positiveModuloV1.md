<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/positiveModuloV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Positive modulo

> Supported in: Batch, Faster

Returns positive modulus of an expression.

**Expression categories:** Numeric

## Declared arguments

* **Denominator:** The divisor.<br>*Expression\<T2>*
* **Numerator:** The dividend.<br>*Expression\<T1>*

**Type variable bounds:** *T1 accepts Byte | Integer | Long | Short\*\*T2 accepts Byte | Integer | Long | Short*

**Output type:** *T1*

## Examples

### Example 1: Base case

**Argument values:**

* **Denominator:** 3
* **Numerator:** 10

**Output:** 1

***

### Example 2: Base case

**Argument values:**

* **Denominator:** -3
* **Numerator:** -10

**Output:** -1

***

### Example 3: Base case

**Argument values:**

* **Denominator:** -3
* **Numerator:** 10

**Output:** 1

***

### Example 4: Base case

**Argument values:**

* **Denominator:** 3
* **Numerator:** -10

**Output:** 2

***

### Example 5: Null case

**Argument values:**

* **Denominator:** *null*
* **Numerator:** 10

**Output:** *null*

***

### Example 6: Null case

**Argument values:**

* **Denominator:** 3
* **Numerator:** *null*

**Output:** *null*

***

### Example 7: Edge case

**Argument values:**

* **Denominator:** 0
* **Numerator:** 10

**Output:** *null*

***

### Example 8: Edge case

**Argument values:**

* **Denominator:** 3
* **Numerator:** 0

**Output:** 0

***
