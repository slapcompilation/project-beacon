<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/textToEmbeddingsV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Text to embeddings

> Supported in: Batch

Converts text into embeddings.

**Expression categories:** String

## Declared arguments

* **Model:** The embedding model to use for the conversion.<br>*Model*
* **Text column:** Column containing text to convert to embeddings using the given model.<br>*Expression\<String>*
* *optional* **Output mode:** Choose to output as a simple output or output with errors.<br>*Enum\<Simple, With errors>*

**Output type:** *Embedded vector*

## Examples

### Example 1: Base case

**Description:** Example embeddings for the word 'palantir'.

**Argument values:**

* **Model:** <br>ada002Embedding(<br><br>)
* **Text column:** `text`
* **Output mode:** *null*

| text | **Output** |
| ----- | ----- |
| palantir | \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... |

***

### Example 2: Base case

**Description:** Example embeddings for the word 'palantir' with a non ADA model.

**Argument values:**

* **Model:** <br>instructorLargeEmbedding(<br><br>)
* **Text column:** `text`
* **Output mode:** *null*

| text | **Output** |
| ----- | ----- |
| palantir | \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... |

***

### Example 3: Null case

**Description:** Null input should have a null output.

**Argument values:**

* **Model:** <br>ada002Embedding(<br><br>)
* **Text column:** `text`
* **Output mode:** *null*

| text | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 4: Edge case

**Description:** Empty input string should have a null output.

**Argument values:**

* **Model:** <br>ada002Embedding(<br><br>)
* **Text column:** `text`
* **Output mode:** *null*

| text | **Output** |
| ----- | ----- |
| *empty string* | *null* |

***

### Example 5: Edge case

**Description:** Input string surpassing OpenAI Ada's token limit should have a null output.

**Argument values:**

* **Model:** <br>ada002Embedding(<br><br>)
* **Text column:** `text`
* **Output mode:** *null*

| text | **Output** |
| ----- | ----- |
| a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a ... | *null* |

***

### Example 6: Edge case

**Description:** Input string surpassing OpenAI Ada's token limit should have a null output.

**Argument values:**

* **Model:** <br>instructorLargeEmbedding(<br><br>)
* **Text column:** `text`
* **Output mode:** `SIMPLE`

| text | **Output** |
| ----- | ----- |
| a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a ... | {<br> **error**: Context limit exceeded.,<br> **ok**: *null*,<br>} |

***
