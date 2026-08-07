<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/constructGeotemporalSeriesReferenceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create geotemporal series reference

> Supported in: Batch, Streaming

Generate the required values for a geotemporal series reference object property type, which consists of a reference to a series of geotemporal observations and the RID to the geotemporal series integration that contains the series.

**Expression categories:** Geospatial, Other, String

## Declared arguments

* **Geotemporal series integration RID:** The RID of the geotemporal series integration to reference.<br>*ResourceIdentifier*
* **Series ID:** The column with the series ID values that correspond to series in the geotemporal integration.<br>*Expression\<String>*

**Output type:** *Geotemporal series reference*

## Examples

### Example 1: Base case

**Argument values:**

* **Geotemporal series integration RID:** ri.geotime-catalog..integration.05a40ec0-3a7d-406d-88d6-043ed2cb6af8
* **Series ID:** `seriesIdColumn`

| seriesIdColumn | **Output** |
| ----- | ----- |
| series1 | {"seriesId":"series1","geotimeSeriesIntegrationRid":"ri.geotime-catalog..integration.05a40ec0-3a7d-406d-88d6-043ed2cb6af8"} |

***

### Example 2: Null case

**Argument values:**

* **Geotemporal series integration RID:** ri.geotime-catalog..integration.05a40ec0-3a7d-406d-88d6-043ed2cb6af8
* **Series ID:** `seriesIdColumn`

| seriesIdColumn | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 3: Edge case

**Argument values:**

* **Geotemporal series integration RID:** ri.geotime-catalog..integration.05a40ec0-3a7d-406d-88d6-043ed2cb6af8
* **Series ID:** `seriesIdColumn`

| seriesIdColumn | **Output** |
| ----- | ----- |
| specialCharacters!! | {"seriesId":"specialCharacters!!","geotimeSeriesIntegrationRid":"ri.geotime-catalog..integration.05a40ec0-3a7d-406d-88d6-043ed2cb6af8"} |
| using spaces | {"seriesId":"using spaces","geotimeSeriesIntegrationRid":"ri.geotime-catalog..integration.05a40ec0-3a7d-406d-88d6-043ed2cb6af8"} |
| *empty string* | {"seriesId":"","geotimeSeriesIntegrationRid":"ri.geotime-catalog..integration.05a40ec0-3a7d-406d-88d6-043ed2cb6af8"} |

***
