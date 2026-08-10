<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/similarityScoreV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Similarity score

> Supported in: Batch

Returns the similarity score of two embedding vectors.

**Expression categories:** Distance measurement, Numeric

## Declared arguments

* **Left embedded vector:** The left embedded vector.<br>*Expression\<T>*
* **Right embedded vector:** The right embedded vector.<br>*Expression\<T>*
* **Similarity metric:** The similarity metric for comparing the left and right embeddings.<br>*Enum\<Cosine Distance, Cosine Similarity, Dot Product, Euclidean Distance>*

**Type variable bounds:** *T accepts Array\<Float>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Description:** Cosine similarity of the Ada embeddings for the word 'palantir' and 'foundry'.

**Argument values:**

* **Left embedded vector:** `leftEmbeddedVector`
* **Right embedded vector:** `rightEmbeddedVector`
* **Similarity metric:** `COSINE_SIMILARITY`

| leftEmbeddedVector | rightEmbeddedVector | **Output** |
| ----- | ----- | ----- |
| \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... | \[ -0.0046147984, -0.014344796, -0.022795992, -0.035806388, -0.028467191, 0.026243191, -0.028161392, ... | 0.7814455755180517 |

***

### Example 2: Base case

**Description:** Cosine similarity between the Ada embeddings for the word 'palantir'.

**Argument values:**

* **Left embedded vector:** `leftEmbeddedVector`
* **Right embedded vector:** `rightEmbeddedVector`
* **Similarity metric:** `COSINE_SIMILARITY`

| leftEmbeddedVector | rightEmbeddedVector | **Output** |
| ----- | ----- | ----- |
| \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... | \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... | 1.0 |

***

### Example 3: Base case

**Description:** Dot product of the Ada embeddings for the word 'palantir' and 'foundry'.

**Argument values:**

* **Left embedded vector:** `leftEmbeddedVector`
* **Right embedded vector:** `rightEmbeddedVector`
* **Similarity metric:** `DOT_PRODUCT`

| leftEmbeddedVector | rightEmbeddedVector | **Output** |
| ----- | ----- | ----- |
| \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... | \[ -0.0046147984, -0.014344796, -0.022795992, -0.035806388, -0.028467191, 0.026243191, -0.028161392, ... | 0.7814455030932973 |

***

### Example 4: Base case

**Description:** Dot product of the Ada embeddings for the word 'palantir'.

**Argument values:**

* **Left embedded vector:** `leftEmbeddedVector`
* **Right embedded vector:** `rightEmbeddedVector`
* **Similarity metric:** `DOT_PRODUCT`

| leftEmbeddedVector | rightEmbeddedVector | **Output** |
| ----- | ----- | ----- |
| \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... | \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... | 1.0 |

***

### Example 5: Base case

**Description:** Euclidean distance between the Ada embeddings for the word 'palantir' and 'foundry'.

**Argument values:**

* **Left embedded vector:** `leftEmbeddedVector`
* **Right embedded vector:** `rightEmbeddedVector`
* **Similarity metric:** `EUCLIDEAN_DISTANCE`

| leftEmbeddedVector | rightEmbeddedVector | **Output** |
| ----- | ----- | ----- |
| \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... | \[ -0.0046147984, -0.014344796, -0.022795992, -0.035806388, -0.028467191, 0.026243191, -0.028161392, ... | 0.6611420486192364 |

***

### Example 6: Base case

**Description:** Euclidean distance between the Ada embeddings for the word 'palantir'.

**Argument values:**

* **Left embedded vector:** `leftEmbeddedVector`
* **Right embedded vector:** `rightEmbeddedVector`
* **Similarity metric:** `EUCLIDEAN_DISTANCE`

| leftEmbeddedVector | rightEmbeddedVector | **Output** |
| ----- | ----- | ----- |
| \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... | \[ -0.019182289, -0.02127992, 0.009529043, -0.008066221, -0.0014429842, 0.019154688, -0.023556953, -0... | 0.0 |

***

### Example 7: Null case

**Description:** Null inputs should have a null output

**Argument values:**

* **Left embedded vector:** `leftEmbeddedVector`
* **Right embedded vector:** `rightEmbeddedVector`
* **Similarity metric:** `COSINE_SIMILARITY`

| leftEmbeddedVector | rightEmbeddedVector | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |

***

### Example 8: Null case

**Description:** Null inputs should have a null output

**Argument values:**

* **Left embedded vector:** `leftEmbeddedVector`
* **Right embedded vector:** `rightEmbeddedVector`
* **Similarity metric:** `DOT_PRODUCT`

| leftEmbeddedVector | rightEmbeddedVector | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |

***

### Example 9: Null case

**Description:** Null inputs should have a null output

**Argument values:**

* **Left embedded vector:** `leftEmbeddedVector`
* **Right embedded vector:** `rightEmbeddedVector`
* **Similarity metric:** `EUCLIDEAN_DISTANCE`

| leftEmbeddedVector | rightEmbeddedVector | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |

***

### Example 10: Edge case

**Description:** Regular arrays become null when arrays have different length

**Argument values:**

* **Left embedded vector:** `leftArray`
* **Right embedded vector:** `rightArray`
* **Similarity metric:** `DOT_PRODUCT`

| leftArray | rightArray | **Output** |
| ----- | ----- | ----- |
| \[ 1.0, 2.0 ] | \[ 1.0, 3.0 ] | 7.0 |
| \[ 1.0, 2.0, 3.0 ] | \[ 1.0, 3.0 ] | *null* |
| \[ 1.0, 2.0 ] | \[ 1.0, 2.0, 3.0 ] | *null* |
| \[ 1.0, 2.0 ] | *null* | *null* |
| *null* | \[ 1.0, 2.0 ] | *null* |

***
