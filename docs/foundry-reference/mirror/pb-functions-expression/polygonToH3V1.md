<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/polygonToH3V1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Get H3 indices covering a geometry

> Supported in: Batch, Faster, Streaming

Convert geometry to H3 indices at a certain resolution. Resolution must be between 0 and 15, inclusive. For a polygon, three conversions are supported: a) H3 indices that fully cover the polygon, b) H3 indices that are fully contained by the polygon, c) H3 indices whose centroids are contained in the polygon. Returns null when the expected number of H3 indices exceed 7 million.

**Expression categories:** Geospatial

## Declared arguments

* **Cover type:** Specifies type of H3 cover for the polygon.<br>*Enum\<Centroid, Inner, Outer>*
* **Geometry:** GeoJSON of type polygon, line, or point.<br>*Expression\<Geometry>*
* **Resolution:** H3 grid resolution between 0 and 15 (inclusive).<br>*Expression\<Byte | Integer | Long | Short>*

**Output type:** *Array\<H3 Index>*

## Examples

### Example 1: Base case

**Argument values:**

* **Cover type:** `CENTROID`
* **Geometry:** `polygon`
* **Resolution:** 5

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866731],\[-121.862223289024,37.35392645... | \[ 85283473fffffff ] |
| *null* | *null* |
| {"type":"Polygon","coordinates":\[\[]]} | \[  ] |
| {"type":"Polygon","coordinates":\[]} | *null* |
| {"type":"MultiPolygon","coordinates":\[\[]]} | *null* |
| {"type":"MultiPolygon","coordinates":\[\[\[],\[]]]} | \[  ] |
| {"type":"MultiPolygon","coordinates":\[]} | \[  ] |

***

### Example 2: Base case

**Argument values:**

* **Cover type:** `CENTROID`
* **Geometry:** `polygon`
* **Resolution:** 6

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866731],\[-121.862223289024,37.35392645... | \[ 862834707ffffff, 86283470fffffff, 862834717ffffff, 86283471fffffff, 862834727ffffff, 86283472fffffff, 862834737ffffff ] |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866732],\[-121.862223289025,37.35392645... | \[ 862834707ffffff, 86283470fffffff, 862834717ffffff, 86283471fffffff, 862834727ffffff, 86283472fffffff, 862834737ffffff, 8628347a7ffffff ] |

***

### Example 3: Base case

**Argument values:**

* **Cover type:** `INNER`
* **Geometry:** `polygon`
* **Resolution:** 6

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866731],\[-121.862223289024,37.35392645... | \[ 862834707ffffff ] |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866732],\[-121.862223289025,37.35392645... | \[ 862834707ffffff, 862834717ffffff ] |

***

### Example 4: Base case

**Argument values:**

* **Cover type:** `OUTER`
* **Geometry:** `polygon`
* **Resolution:** 6

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866731],\[-121.862223289024,37.35392645... | \[ 86283408fffffff, 86283409fffffff, 8628340d7ffffff, 8628340dfffffff, 86283444fffffff, 86283446fffff... |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866732],\[-121.862223289025,37.35392645... | \[ 86283408fffffff, 86283409fffffff, 8628340d7ffffff, 8628340dfffffff, 86283444fffffff, 86283445fffff... |

***

### Example 5: Base case

**Argument values:**

* **Cover type:** `OUTER`
* **Geometry:** `polygon`
* **Resolution:** 2

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon", "coordinates":\[\[\[-112.943779561642,34.817254144594],\[-112.943779561642,33.0067953... | \[ 82264ffffffffff, 82265ffffffffff, 8226c7fffffffff, 8226cffffffffff, 8226d7fffffffff, 8226dffffffff... |

***

### Example 6: Base case

**Argument values:**

* **Cover type:** `INNER`
* **Geometry:** `polygon`
* **Resolution:** 5

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866731],\[-121.862223289024,37.35392645... | \[ 85283473fffffff ] |
| *null* | *null* |
| {"type":"Polygon","coordinates":\[\[]]} | \[  ] |
| {"type":"Polygon","coordinates":\[]} | *null* |
| {"type":"MultiPolygon","coordinates":\[\[]]} | *null* |
| {"type":"MultiPolygon","coordinates":\[\[\[],\[]]]} | \[  ] |
| {"type":"MultiPolygon","coordinates":\[]} | \[  ] |

***

### Example 7: Base case

**Argument values:**

* **Cover type:** `CENTROID`
* **Geometry:** `polygon`
* **Resolution:** 4

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866731],\[-121.862223289024,37.35392645... | \[  ] |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866732],\[-121.862223289025,37.35392645... | \[  ] |

***

### Example 8: Base case

**Argument values:**

* **Cover type:** `INNER`
* **Geometry:** `polygon`
* **Resolution:** 4

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866731],\[-121.862223289024,37.35392645... | \[  ] |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866732],\[-121.862223289025,37.35392645... | \[  ] |

***

### Example 9: Base case

**Argument values:**

* **Cover type:** `OUTER`
* **Geometry:** `polygon`
* **Resolution:** 4

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866731],\[-121.862223289024,37.35392645... | \[ 8428341ffffffff, 8428345ffffffff, 8428347ffffffff ] |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866732],\[-121.862223289025,37.35392645... | \[ 8428341ffffffff, 8428345ffffffff, 8428347ffffffff ] |

***

### Example 10: Base case

**Argument values:**

* **Cover type:** `OUTER`
* **Geometry:** `polygon`
* **Resolution:** 5

| polygon | **Output** |
| ----- | ----- |
| *null* | *null* |
| {"type":"Polygon","coordinates":\[\[]]} | \[  ] |
| {"type":"Polygon","coordinates":\[]} | *null* |
| {"type":"MultiPolygon","coordinates":\[\[]]} | *null* |
| {"type":"MultiPolygon","coordinates":\[\[\[],\[]]]} | \[  ] |
| {"type":"MultiPolygon","coordinates":\[]} | \[  ] |
| {"type":"Polygon","coordinates":\[\[\[-121.915080327056,37.271355866731],\[-121.862223289024,37.35392645... | \[ 8528340bfffffff, 8528340ffffffff, 85283447fffffff, 85283463fffffff, 85283473fffffff, 85283477fffffff, 8528347bfffffff ] |

***

### Example 11: Base case

**Argument values:**

* **Cover type:** `CENTROID`
* **Geometry:** `polygon`
* **Resolution:** 3

| polygon | **Output** |
| ----- | ----- |
| {"type":"MultiLineString","coordinates":\[\[\[0,0],\[15,15],\[30,-15],\[45,15],\[60,0]],\[\[15,30],\[-15,-15]]]} | \[ 833f80fffffffff, 833f82fffffffff, 833f85fffffffff, 833f91fffffffff, 833f93fffffffff, 833faefffffff... |

***

### Example 12: Base case

**Argument values:**

* **Cover type:** `CENTROID`
* **Geometry:** `polygon`
* **Resolution:** 4

| polygon | **Output** |
| ----- | ----- |
| {"type":"MultiPoint","coordinates":\[\[60,60],\[60,58],\[58,58],\[58,60]]} | \[ 8410c03ffffffff, 8410c47ffffffff, 8410ee7ffffffff, 8410eedffffffff ] |

***

### Example 13: Base case

**Argument values:**

* **Cover type:** `OUTER`
* **Geometry:** `polygon`
* **Resolution:** 10

| polygon | **Output** |
| ----- | ----- |
| {"type":"Polygon","coordinates":\[\[\[-122.02869363438222,37.26184847647239],\[-122.02805421389088,37.26... | \[ 8a283408b2c7fff, 8a283408b2cffff, 8a283408b2dffff, 8a283408b2effff, 8a28340d6597fff, 8a28340d65b7fff, 8a2834725967fff ] |

***

### Example 14: Base case

**Argument values:**

* **Cover type:** `CENTROID`
* **Geometry:** `polygon`
* **Resolution:** 4

| polygon | **Output** |
| ----- | ----- |
| {"coordinates":\[\[\[\[60,60],\[60,58],\[58,58],\[58,60],\[60,60]],\[\[59.5,59.7],\[59.8,58.1],\[58.1,58.2],\[58.2,59.4],\[59.5,59.7]]], \[\[\[55,56],\[55.5,55.7],\[55.7,55.7],\[55,57],\[55,56]]]],"type":"MultiPolygon"} | \[ 8410c01ffffffff, 8410c47ffffffff, 8410c57ffffffff, 8410e33ffffffff, 8410ee5ffffffff, 8410ee7ffffffff, 8410f23ffffffff ] |

***

### Example 15: Base case

**Argument values:**

* **Cover type:** `INNER`
* **Geometry:** `polygon`
* **Resolution:** 4

| polygon | **Output** |
| ----- | ----- |
| {"coordinates":\[\[\[\[60,60],\[60,58],\[58,58],\[58,60],\[60,60]],\[\[59.5,59.7],\[59.8,58.1],\[58.1,58.2],\[58.2,59.4],\[59.5,59.7]]], \[\[\[55,56],\[55.5,55.7],\[55.7,55.7],\[55,57],\[55,56]]]],"type":"MultiPolygon"} | \[  ] |

***

### Example 16: Base case

**Argument values:**

* **Cover type:** `OUTER`
* **Geometry:** `polygon`
* **Resolution:** 4

| polygon | **Output** |
| ----- | ----- |
| {"coordinates":\[\[\[\[60,60],\[60,58],\[58,58],\[58,60],\[60,60]],\[\[59.5,59.7],\[59.8,58.1],\[58.1,58.2],\[58.2,59.4],\[59.5,59.7]]], \[\[\[55,56],\[55.5,55.7],\[55.7,55.7],\[55,57],\[55,56]]]],"type":"MultiPolygon"} | \[ 8410c01ffffffff, 8410c03ffffffff, 8410c09ffffffff, 8410c0bffffffff, 8410c0dffffffff, 8410c1dffffff... |

***

### Example 17: Base case

**Argument values:**

* **Cover type:** `OUTER`
* **Geometry:** `polygon`
* **Resolution:** 3

| polygon | **Output** |
| ----- | ----- |
| {"coordinates":\[\[\[60.0,60.0],\[50.0,60.0],\[50.0,50.0],\[60.0,50.0],\[60.0,60.0]],\[\[57.0,57.0],\[55.0,52.0],\[52.0,52.0],\[50.0,57.0],\[57.0,57.0]]],"type":"Polygon"} | \[ 83100afffffffff, 831018fffffffff, 831019fffffffff, 83101afffffffff, 83101bfffffffff, 83101dfffffff... |

***

### Example 18: Base case

**Argument values:**

* **Cover type:** `CENTROID`
* **Geometry:** `polygon`
* **Resolution:** 4

| polygon | **Output** |
| ----- | ----- |
| {"type":"MultiLineString","coordinates":\[\[\[60,60],\[60,58],\[58,58],\[58,60]],\[\[59.8,58.1],\[58.1,58.2],\[58.2,59.4],\[59.5,59.7]],\[\[55,56],\[55.5,55.7],\[55.7,55.7],\[55,57]]]} | \[ 8410c01ffffffff, 8410c03ffffffff, 8410c09ffffffff, 8410c0bffffffff, 8410c0dffffffff, 8410c1dffffff... |

***

### Example 19: Base case

**Argument values:**

* **Cover type:** `OUTER`
* **Geometry:** `polygon`
* **Resolution:** 9

| polygon | **Output** |
| ----- | ----- |
| {"coordinates":\[\[\[-110, 38], \[-110,82],\[-170,82],\[-170,38],\[-110, 38]]],"type":"Polygon"} | *null* |

***
