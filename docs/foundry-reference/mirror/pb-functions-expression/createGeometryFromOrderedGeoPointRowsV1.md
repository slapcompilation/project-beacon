<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createGeometryFromOrderedGeoPointRowsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create simple geometries from ordered rows of GeoPoints

> Supported in: Batch

Given a column of GeoPoints and an ordering, return either a polygon or a line string by connecting the GeoPoints in the specified order. This function assumes that the data is tabular, with a single row representing an individual GeoPoint in a line string or in the shell of a polygon, along with a column specifying the order of those points. For a polygon this ordering should identify the points as you move counter-clockwise around the shell. Given an ordering of these points and a partition (grouping), the function constructs the required geometry for that partition by joining the GeoPoints in ascending order of the order-by column.

**Expression categories:** Geospatial

## Declared arguments

* **GeoPoint:** A column of GeoPoints from which the geometry is constructed. Each row in the dataset should represent an individual GeoPoint. If there are null values, these rows are ignored.<br>*Expression\<GeoPoint>*
* **Order by (ascending):** A column of values by which the GeoPoints will be ordered to construct the line string or the shell of the desired polygon. The ordering is random if values are identical within a group. If there are null values, those rows are ignored.<br>*Expression\<Byte | Date | Decimal | Double | Float | Integer | Long | Short | Timestamp>*
* **Output geometry type:** Whether the output should be a polygon or a line-string.<br>*Enum\<LineString, Polygon>*

**Output type:** *Geometry*

## Examples

### Example 1: Base case

**Argument values:**

* **GeoPoint:** `geo_point`
* **Order by (ascending):** `order`
* **Output geometry type:** `LINE_STRING`

**Given input table:**

| geo\_point | order |
| ----- | ----- |
| {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | 0 |
| {<br> latitude -> 1.0,<br> longitude -> 0.0,<br>} | 1 |
| {<br> latitude -> 1.0,<br> longitude -> 1.0,<br>} | 2 |

**Outputs:** {"type":"LineString","coordinates": \[\[0.0,0.0],\[0.0, 1.0],\[1.0,1.0]]}

***

### Example 2: Base case

**Argument values:**

* **GeoPoint:** `geo_point`
* **Order by (ascending):** `order`
* **Output geometry type:** `POLYGON`

**Given input table:**

| geo\_point | order |
| ----- | ----- |
| {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | 0 |
| {<br> latitude -> 1.0,<br> longitude -> 0.0,<br>} | 3 |
| {<br> latitude -> 1.0,<br> longitude -> 1.0,<br>} | 2 |
| {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | 4 |
| {<br> latitude -> 0.0,<br> longitude -> 1.0,<br>} | 1 |

**Outputs:** {"type":"Polygon","coordinates": \[\[\[0.0, 0.0], \[1.0, 0.0], \[1.0, 1.0], \[0.0, 1.0], \[0.0, 0.0]]]}

***

### Example 3: Base case

**Argument values:**

* **GeoPoint:** `geo_point`
* **Order by (ascending):** `order`
* **Output geometry type:** `LINE_STRING`

**Given input table:**

| geo\_point | order |
| ----- | ----- |
| {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | 0.0 |
| *null* | 1.0 |
| *null* | 2.0 |
| {<br> latitude -> 0.0,<br> longitude -> 1.0,<br>} | 2.0 |

**Outputs:** {"type":"LineString","coordinates": \[\[0.0,0.0],\[1.0, 0.0]]}

***

### Example 4: Base case

**Argument values:**

* **GeoPoint:** `geo_point`
* **Order by (ascending):** `order`
* **Output geometry type:** `LINE_STRING`

**Given input table:**

| geo\_point | order |
| ----- | ----- |
| {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | 0.0 |

**Outputs:** *null*

***

### Example 5: Base case

**Argument values:**

* **GeoPoint:** `geo_point`
* **Order by (ascending):** `order`
* **Output geometry type:** `POLYGON`

**Given input table:**

| geo\_point | order |
| ----- | ----- |
| {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | 0 |
| {<br> latitude -> 1.0,<br> longitude -> 1.0,<br>} | 2 |
| {<br> latitude -> 1.0,<br> longitude -> 0.0,<br>} | 3 |
| {<br> latitude -> 0.0,<br> longitude -> 1.0,<br>} | 1 |

**Outputs:** {"type":"Polygon","coordinates": \[\[\[0.0, 0.0], \[1.0, 0.0], \[1.0, 1.0], \[0.0, 1.0], \[0.0, 0.0]]]}

***

### Example 6: Base case

**Argument values:**

* **GeoPoint:** `geo_point`
* **Order by (ascending):** `order`
* **Output geometry type:** `POLYGON`

**Given input table:**

| geo\_point | order |
| ----- | ----- |
| {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | 0 |
| {<br> latitude -> 1.0,<br> longitude -> 0.0,<br>} | 1 |

**Outputs:** *null*

***

### Example 7: Null case

**Argument values:**

* **GeoPoint:** `geo_point`
* **Order by (ascending):** `order`
* **Output geometry type:** `POLYGON`

**Given input table:**

| geo\_point | order |
| ----- | ----- |
| *null* | 0 |

**Outputs:** *null*

***

### Example 8: Null case

**Argument values:**

* **GeoPoint:** `geo_point`
* **Order by (ascending):** `order`
* **Output geometry type:** `LINE_STRING`

**Given input table:**

| geo\_point | order |
| ----- | ----- |
| {<br> latitude -> 0.0,<br> longitude -> 0.0,<br>} | 0 |
| {<br> latitude -> 1.0,<br> longitude -> 1.0,<br>} | *null* |
| {<br> latitude -> 1.0,<br> longitude -> 0.0,<br>} | 1 |

**Outputs:** {"type":"LineString","coordinates": \[\[0.0,0.0],\[0.0, 1.0]]}

***
