<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/dmsToGeoPointV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert DMS to GeoPoint

> Supported in: Batch, Streaming

Converts a geospatial coordinate string in degrees, minutes, seconds (DMS) format to a GeoPoint in accordance to user-provided formats. The default formats are `DDD*°MM*'SS*"H` and `DDD*MMSSssH`. The formats are run in order, and the first matching format will be returned. See formatting guide on how to write user-generated formats.

**Expression categories:** Geospatial

## Declared arguments

* **Coordinates:** DMS coordinates to convert to a GeoPoint.<br>*Expression\<String>*
* *optional* **Formats:** Formats default to `DDD*°MM*'SS*"H` and `DDD*MMSSssH`.<br>*List\<Literal\<String>>*

**Output type:** *GeoPoint*

## Examples

### Example 1: Base case

**Argument values:**

* **Coordinates:** `coordinates`
* **Formats:** *null*

| coordinates | **Output** |
| ----- | ----- |
| 078261594N075220923E | {<br> **latitude**: 78.43776111111112,<br> **longitude**: 75.36923055555555,<br>} |
| 046115095S069524119W | {<br> **latitude**: -46.19748611111111,<br> **longitude**: -69.87810833333333,<br>} |
| 023°45'55"N 069°52'11"W | {<br> **latitude**: 23.76527777777777,<br> **longitude**: -69.86972222222222,<br>} |
| -123°55'55"N 069°53'00"W | {<br> **latitude**: -123.93194444444445,<br> **longitude**: -69.88333333333334,<br>} |
| 123456789N23456789E | {<br> **latitude**: 123.76885833333333,<br> **longitude**: 23.768858333333334,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Coordinates:** `coordinates`
* **Formats:** \[H\[orth]\[est]\[ast]\[outh] DDD\* `degrees,` MM\* `minutes, and` SS\*.sss\* `seconds`]

| coordinates | **Output** |
| ----- | ----- |
| North 75 degrees, 3 minutes, and 0.33 seconds; East 123 degrees, 22 minutes, and 17.2 seconds | {<br> **latitude**: 75.05009166666666,<br> **longitude**: 123.37144444444444,<br>} |
| South 75 degrees, 3 minutes, and 0.33 seconds; West 123 degrees, 22 minutes, and 17.2 seconds | {<br> **latitude**: -75.05009166666666,<br> **longitude**: -123.37144444444444,<br>} |

***

### Example 3: Base case

**Argument values:**

* **Coordinates:** `coordinates`
* **Formats:** *null*

| coordinates | **Output** |
| ----- | ----- |
| hSllo, World! | *null* |
| 02345N123456789E | *null* |
| 023456784R123456789E | *null* |
| 023456784N123456789 | *null* |
| 023456784R123456789 | *null* |
| 078261594N075220923E075220923N | *null* |
| 078261594N | *null* |
| 23°°45'55"N 069°52'11"W | *null* |
| 23° 45' 55"N 069° 52' 11"W | *null* |
| 23°55"N 069°52'11"W | *null* |
| 23°452233'55"N 069°52'11"W | *null* |

***

### Example 4: Base case

**Argument values:**

* **Coordinates:** `coordinates`
* **Formats:** \[DDD` ``minutes:`` `MM` ``seconds:`` `SS]

| coordinates | **Output** |
| ----- | ----- |
| `degrees:` 123 `minutes:` 45 `seconds:` 67, `degrees:` 087 `minutes:` 54 `seconds:` 32 | {<br> **latitude**: 123.76861111111111,<br> **longitude**: 87.9088888888889,<br>} |

***

### Example 5: Edge case

**Argument values:**

* **Coordinates:** `coordinates`
* **Formats:** \[SSSSSSSSS\*.sssssss\*H]

| coordinates | **Output** |
| ----- | ----- |
| 123452.4222N 98544.333E | {<br> **latitude**: 34.2923395,<br> **longitude**: 27.373425833333332,<br>} |

***

### Example 6: Edge case

**Argument values:**

* **Coordinates:** `coordinates`
* **Formats:** \[DDD\*:MM:SSsss\*H]

| coordinates | **Output** |
| ----- | ----- |
| 123:45:24222N 98:54:4333E | {<br> **latitude**: 123.75672833333333,<br> **longitude**: 98.91203611111112,<br>} |
| 078261594N075220923E | *null* |
| -123°55'55"N 069°53'00"W | *null* |

***
