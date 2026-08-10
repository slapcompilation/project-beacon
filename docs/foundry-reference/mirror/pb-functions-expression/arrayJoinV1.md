<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayJoinV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Join array

> Supported in: Batch, Faster, Streaming

Joins array with specified separator.

**Expression categories:** Array

## Declared arguments

* **Array to join:** Array to join on.<br>*Expression\<Array\<String>>*
* **Separator:** Separator to join array with.<br>*Expression\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Array to join:** \[ hello, world ]
* **Separator:** -

**Output:** hello-world

***

### Example 2: Base case

**Argument values:**

* **Array to join:** \[ hello, world ]
* **Separator:** <br>

**Output:** hello<br>world

***

### Example 3: Null case

**Argument values:**

* **Array to join:** `array`
* **Separator:** `separator`

| array | separator | **Output** |
| ----- | ----- | ----- |
| \[ hello, world ] | *null* | helloworld |
| *null* | - | *null* |
| *null* | *null* | *null* |

***

### Example 4: Edge case

**Argument values:**

* **Array to join:** \[  ]
* **Separator:** -

**Output:** *empty string*

***
