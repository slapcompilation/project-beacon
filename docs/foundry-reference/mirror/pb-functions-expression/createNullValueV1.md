<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createNullValueV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create null value

> Supported in: Batch, Faster, Streaming

Returns a null value of the given type.

**Expression categories:** Data preparation

## Declared arguments

* **Type:** The type of the null value to create.<br>*Type\<T>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Type:** Array\<String>

**Output:** *null*

***

### Example 2: Base case

**Argument values:**

* **Type:** Map\<String, String>

**Output:** *null*

***

### Example 3: Base case

**Argument values:**

* **Type:** String

**Output:** *null*

***

### Example 4: Base case

**Argument values:**

* **Type:** Struct\<string:String, array:Array\<String>>

**Output:** *null*

***
