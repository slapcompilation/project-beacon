<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/filterArrayElementV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Filter array elements

> Supported in: Batch, Streaming

Filters an array based on the filter expression. Note, array index starts at 1.

**Expression categories:** Array

## Declared arguments

* **Array:** Array to be filtered.<br>*Expression\<Array\<T>>*
* **Expression to filter:** If the expression evaluates to true for a given element, the element will be kept, if false the element will be removed.<br>*Expression\<Boolean>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** `array`
* **Expression to filter:** <br>isNotNull(<br> expression: `element`,<br>)

| array | **Output** |
| ----- | ----- |
| \[ 2, 5, *null*, 11 ] | \[ 2, 5, 11 ] |

***

### Example 2: Base case

**Argument values:**

* **Array:** `array`
* **Expression to filter:** <br>lessThanOrEquals(<br> left: `element`,<br> right: 10,<br>)

| array | **Output** |
| ----- | ----- |
| \[ 2, 5, *null*, 11 ] | \[ 2, 5 ] |

***

### Example 3: Base case

**Argument values:**

* **Array:** `array`
* **Expression to filter:** <br>lessThanOrEquals(<br> left: `element`,<br> right: 10,<br>)

| array | **Output** |
| ----- | ----- |
| \[ 2, 5, 7, 11, 12, 15 ] | \[ 2, 5, 7 ] |

***

### Example 4: Base case

**Description:** Note that array index starts at 1.

**Argument values:**

* **Array:** `array`
* **Expression to filter:** <br>equals(<br> left: `element`,<br> right: `elementIndex`,<br>)

| array | **Output** |
| ----- | ----- |
| \[ 1, -1, -2, 4, -5 ] | \[ 1, 4 ] |

***

### Example 5: Base case

**Argument values:**

* **Array:** `array`
* **Expression to filter:** <br>stringContains(<br> expression: `element`,<br> ignoreCase: false,<br> value: hello,<br>)

| array | **Output** |
| ----- | ----- |
| \[ hello world, hello, world ] | \[ hello world, hello ] |

***

### Example 6: Base case

**Argument values:**

* **Array:** `array`
* **Expression to filter:** <br>lessThanOrEquals(<br> left: <br>add(<br> expressions: \[`element`, 4],<br>),<br> right: 10,<br>)

| array | **Output** |
| ----- | ----- |
| \[ 2, 5, 7, 11, 12, 15 ] | \[ 2, 5 ] |

***

### Example 7: Null case

**Argument values:**

* **Array:** `array`
* **Expression to filter:** <br>lessThanOrEquals(<br> left: `element`,<br> right: 10,<br>)

| array | **Output** |
| ----- | ----- |
| *null* | *null* |

***
