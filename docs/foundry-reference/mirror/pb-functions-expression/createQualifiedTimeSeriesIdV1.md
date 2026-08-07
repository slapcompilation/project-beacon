<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createQualifiedTimeSeriesIdV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create time series reference values

> Supported in: Batch, Streaming

Creates time series reference values.

**Expression categories:** String

## Declared arguments

* **Series identifier:** The series identifiers contained in the time series sync.<br>*Expression\<String>*
* **Time series sync RID:** The resource identifier (RID) of the time series sync containing the series identifiers.<br>*Expression\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Series identifier:** `seriesId`
* **Time series sync RID:** ri.time-series-catalog.main.sync.11111111

| seriesId | **Output** |
| ----- | ----- |
| seriesOne | {"seriesId":"seriesOne","syncRid":"ri.time-series-catalog.main.sync.11111111"} |

***

### Example 2: Base case

**Argument values:**

* **Series identifier:** `seriesId`
* **Time series sync RID:** `syncRid`

| seriesId | syncRid | **Output** |
| ----- | ----- | ----- |
| seriesOne | ri.time-series-catalog.main.sync.11111111 | {"seriesId":"seriesOne","syncRid":"ri.time-series-catalog.main.sync.11111111"} |
| seriesTwo | ri.time-series-catalog.main.sync.22222222 | {"seriesId":"seriesTwo","syncRid":"ri.time-series-catalog.main.sync.22222222"} |

***

### Example 3: Null case

**Argument values:**

* **Series identifier:** `seriesId`
* **Time series sync RID:** ri.time-series-catalog.main.sync.11111111

| seriesId | **Output** |
| ----- | ----- |
| *null* | {"seriesId":"null","syncRid":"ri.time-series-catalog.main.sync.11111111"} |

***

### Example 4: Null case

**Argument values:**

* **Series identifier:** `seriesId`
* **Time series sync RID:** *null*

| seriesId | **Output** |
| ----- | ----- |
| seriesOne | {"seriesId":"seriesOne","syncRid":"null"} |

***
