<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/parseSemanticVersionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Parse semantic version

> Supported in: Batch, Streaming

Parses a semantic version string into a logical type. Supports both release versions (e.g., "0.987.0") and versions with prerelease metadata (e.g., "0.987.0-16-gb3fb285"). Returns null for strings that do not match the expected format.

**Expression categories:** String

## Declared arguments

* **Version string:** Semantic version string. Supports both release versions (major.minor.patch) and versions with prerelease metadata (major.minor.patch-prerelease).<br>*Expression\<String>*

**Output type:** *Semantic Version*

## Examples

### Example 1: Base case

**Argument values:**

* **Version string:** `version`

| version | **Output** |
| ----- | ----- |
| 0.987.0-16-gb3fb285 | {<br> major -> 0,<br> minor -> 987,<br> patch -> 0,<br> prerelease -> \[ 16-gb3fb285 ],<br>} |
| 1.0.0-0-g0000000 | {<br> major -> 1,<br> minor -> 0,<br> patch -> 0,<br> prerelease -> \[ 0-g0000000 ],<br>} |
| 2.5.3-42-gabc1234 | {<br> major -> 2,<br> minor -> 5,<br> patch -> 3,<br> prerelease -> \[ 42-gabc1234 ],<br>} |
| 0.987.0-SNAPSHOT | {<br> major -> 0,<br> minor -> 987,<br> patch -> 0,<br> prerelease -> \[ SNAPSHOT ],<br>} |

***

### Example 2: Base case

**Argument values:**

* **Version string:** `version`

| version | **Output** |
| ----- | ----- |
| 0.987.0 | {<br> major -> 0,<br> minor -> 987,<br> patch -> 0,<br> prerelease -> \[  ],<br>} |
| 1.0.0 | {<br> major -> 1,<br> minor -> 0,<br> patch -> 0,<br> prerelease -> \[  ],<br>} |
| 2.5.3 | {<br> major -> 2,<br> minor -> 5,<br> patch -> 3,<br> prerelease -> \[  ],<br>} |

***

### Example 3: Null case

**Argument values:**

* **Version string:** `version`

| version | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 4: Edge case

**Argument values:**

* **Version string:** `version`

| version | **Output** |
| ----- | ----- |
| invalid version string | *null* |
| not-a-version | *null* |
| 1.0 | *null* |

***
