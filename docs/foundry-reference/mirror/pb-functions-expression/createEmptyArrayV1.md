<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createEmptyArrayV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create an empty array

> Supported in: Batch, Faster, Streaming

Returns an empty array of the given type.

**Expression categories:** Array

## Declared arguments

* **Type:** The element type of the array to create.<br>*Type\<T>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Type:** Array\<String>

**Output:** \[  ]

***

### Example 2: Base case

**Argument values:**

* **Type:** Map\<String, String>

**Output:** \[  ]

***

### Example 3: Base case

**Argument values:**

* **Type:** String

**Output:** \[  ]

***

### Example 4: Base case

**Argument values:**

* **Type:** Struct\<string:String, array:Array\<String>>

**Output:** \[  ]

***
