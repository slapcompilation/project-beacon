<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/decodeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Decode

> Supported in: Batch, Faster, Streaming

Decode the given expression using the specified charset.

**Expression categories:** Binary, Cast

## Declared arguments

* **Charset:** Charset used for decoding.<br>*Enum\<ISO\_8859\_1, US\_ASCII, UTF\_16, UTF\_16BE, UTF\_16LE, UTF\_8, Windows-31J>*
* **Expression:** Expression to decode.<br>*Expression\<Binary>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Charset:** `UTF_16`
* **Expression:** `city`

| city | **Output** |
| ----- | ----- |
| /v8ATABvAG4AZABvAG4= | London |
| /v8AQwBvAHAAZQBuAGgAYQBnAGUAbg== | Copenhagen |
| /v8ATgBlAHcAIABZAG8AcgBr | New York |

***

### Example 2: Base case

**Argument values:**

* **Charset:** `UTF_8`
* **Expression:** `city`

| city | **Output** |
| ----- | ----- |
| TG9uZG9u | London |
| Q29wZW5oYWdlbg== | Copenhagen |
| TmV3IFlvcms= | New York |

***

### Example 3: Null case

**Argument values:**

* **Charset:** `UTF_8`
* **Expression:** `city`

| city | **Output** |
| ----- | ----- |
| *null* | *null* |

***
