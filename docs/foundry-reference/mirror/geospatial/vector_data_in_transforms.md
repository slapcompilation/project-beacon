<!-- source: https://palantir.com/docs/foundry/geospatial/vector_data_in_transforms/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Use vector data in transforms \[Legacy]

:::callout{theme="warning"}
The `geospatial-tools` library is no longer actively developed; instead, use Pipeline Builder to load, transform, and wield geospatial data. The functionality for manipulating geospatial data types described on this page has been superseded by Pipeline Builder's geospatial capabilities. [Learn more about Pipeline Builder's geospatial features.](/docs/foundry/pipeline-builder/transforms-geospatial/)
:::

Geospatial Tools is a Python library hosting reusable logic for performing common transformations on vector geospatial data pipelines in Foundry. The functions provided in this library are intended to be used in Python transforms to streamline the integration of these common operations with the rest of your pipeline logic.

Note that this functionality has been superseded by [Pipeline Builder's geospatial capabilities](/docs/foundry/pipeline-builder/transforms-geospatial/). You should use Pipeline Builder instead of the `geospatial-tools` library as the `geospatial-tools` library is no longer maintained and may not function as expected.

The documentation on this page will remain available as a reference until official deprecation of the `geospatial-tools` library.

The library currently includes helper functions for:

* [Cleaning geospatial data](#cleaning-geospatial-data)
* [Spatial functions](#spatial-functions)
* [Spatial joins](#spatial-joins)

## Installation

:::callout{theme="warning"}
The `geospatial-tools` library is no longer actively developed; use [Pipeline Builder](/docs/foundry/pipeline-builder/transforms-geospatial/) instead.
:::

[Import](/docs/foundry/transforms-python/use-python-libraries/) `geospatial-tools` and the [Spark profile](/docs/foundry/optimizing-pipelines/apply-spark-profiles/) `GEOSPARK` into your Python repository. Contact your Palantir representative if you need assistance with installation.

Toggle hidden files and folders, and add the following block at the very bottom of `/transforms-python/build.gradle`:

```
dependencies {
    condaJars "org.apache.sedona:sedona-spark-shaded-3.5_2.13:1.7.1"
    condaJars "org.datasyslab:geotools-wrapper:1.7.0-28.5"
}
```

## Usage

All transforms that use the `geospatial-tools` library need to use the `@geospatial()` decorator (above any other decorators, such as `@transform_df()` and `@configure()`). This enables Apache Sedona within your Spark environment, and adds bindings for doing spatial joins on PySpark DataFrames.

```python
from transforms.api import transform_df, configure, Input, Output
from geospatial_tools import geospatial

@geospatial()
@configure(...)
@transform_df(...)
def compute(input_df):
    ...
```

### Cleaning geospatial data

Clean geospatial data in Foundry is:

1. Tabular, so the data can be used in Spark transforms
2. Formatted as either a valid [GeoJSON ↗](https://en.wikipedia.org/wiki/GeoJSON) or geohash, so the data can be used in the Foundry Ontology
3. Projected using the [EPSG:4326 ↗](https://epsg.io/4326) CRS, so that both sides of spatial joins use the same projection and Foundry maps will render features correctly.

Learn more about CRS and data alignment in [Coordinate reference systems and projections](/docs/foundry/geospatial/coordinate-reference-systems-and-projections/).

The `geospatial-tools` library provides `clean_geometry()` and `lat_long_to_geometry()` to perform steps (2) and (3). If your raw data is a GeoJSON, Shapefile, GDB, KML, or KMZ, you can use [built-in parsing helper functions](#parsing-helper-functions) to perform step (1).

#### clean\_geometry()

`clean_geometry(geometry, input_crs, geometry_format='geojson', lat_long=False, output_format='geojson')`

Cleans a geospatial geometry column by making it valid and normalizing the CRS to EPSG:4326.

* Parameters
  * `geometry` (`str`): The input geometry column name.
  * `input_crs` (`str`): The input geometry CRS.
  * `geometry_format` (`str`, optional): The input geometry format. Supported formats are `geojson`, `geohash` (string containing `latitude,longitude`), `wkt`, and `wkb`. Defaults to `geojson`.
  * `lat_long` (`bool`, optional): `True` if input geometry coordinates are ordered `latitude,longitude`, which will likely be the case for a `geohash` input, but not for `geojson` or `wkt`. Defaults to `False`.
  * `output_format` (`str`, optional): The output geometry format (`geojson` or `geohash`). Defaults to `geojson`.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import clean_geometry

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      raw_df=Input('/my/input/dataset'),
  )
  def compute(raw_df):
      clean_df = raw_df.withColumn('geometry', clean_geometry('geometry', 'EPSG:26910'))
      return clean_df
  ```

#### lat\_long\_to\_geometry()

`lat_long_to_geometry(lat, long, input_crs, output_format='geojson')`

Converts a lat and long column to a cleaned geometry column.

* Parameters
  * `lat` (`str`): The input latitude column name.
  * `long` (`str`): The input longitude column name.
  * `input_crs` (`str`): The input geometry CRS.
  * `output_format` (`str`, optional): The output geometry format (`geojson` or `geohash`). Defaults to `geojson`.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import lat_long_to_geometry

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      raw_df=Input('/my/input/dataset'),
  )
  def compute(raw_df):
      clean_df = raw_df.withColumn('geohash', lat_long_to_geometry('latitude', 'longitude', 'EPSG:26910', output_format='geohash'))
      return clean_df.drop('latitude', 'longitude')
  ```

### Parsing helper functions

#### geojson\_to\_dataframe()

`geojson_to_dataframe(dataset, properties=None, glob='*.geojson', batch_size=100000)`

Converts GeoJSON files to a dataframe. Uses stream processing to process very large files without running out of driver memory.

* Parameters
  * `dataset` (`transforms.api.Input`): The input dataset containing GeoJSON files.
  * `properties` (`list[str]`, optional): The list of properties to create columns for. If not provided, all properties will be included in a JSON "properties" column.
  * `glob` (`str`, optional): The glob pattern used to identify GeoJSON files in the dataset. Defaults to `*.geojson`.
  * `batch_size` (`int`, optional): The number of records processed per batch. If the driver is running out of memory, the batch size should be decreased. Default is 100000.
* Example
  ```python
  from transforms.api import transform, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.parsers import geojson_to_dataframe

  @geospatial()
  @transform(
      output=Output('/my/output/dataset'),
      raw=Input('/my/input/dataset'),
  )
  def compute(raw, output):
      return output.write_dataframe(
          geojson_to_dataframe(raw)
      )
  ```

#### shapefile\_to\_dataframe()

`shapefile_to_dataframe(dataset, glob='*.shp')`

Converts shapefiles to a dataframe.

* Parameters
  * `dataset` (`transforms.api.Input`): The input dataset containing shapefiles.
  * `glob` (`str`, optional): The glob pattern used to identify .shp files in the dataset. Expects other relevant files to be present as well, e.g. .shp, .shx, .dbf. Default is `*.shp`.
* Example
  ```python
  from transforms.api import transform, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.parsers import shapefile_to_dataframe

  @geospatial()
  @transform(
      output=Output('/my/output/dataset'),
      raw=Input('/my/input/dataset'),
  )
  def compute(raw, output):
      return output.write_dataframe(
          shapefile_to_dataframe(raw)
      )
  ```

#### gdb\_to\_dataframe()

`gdb_to_dataframe(dataset, glob='*.gdb.zip', layer=None)`

Converts a GeoDatabase file to a dataframe.

* Parameters
  * `dataset` (`transforms.api.Input`): The input dataset containing zipped GDB files.
  * `glob` (`str`, optional): The glob pattern used to identify GDB files in the dataset. Default is `*.gdb.zip`.
  * `layer` (`str`, optional): The specific layer to read.
* Example
  ```python
  from transforms.api import transform, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.parsers import gdb_to_dataframe

  @geospatial()
  @transform(
      output=Output('/my/output/dataset'),
      raw=Input('/my/input/dataset'),
  )
  def compute(raw, output):
      return output.write_dataframe(
          gdb_to_dataframe(raw)
      )
  ```

#### kml\_to\_dataframe()

`kml_to_dataframe(dataset, glob='*.kml')`

Converts KML files to a dataframe.

* Parameters
  * `dataset` (`transforms.api.Input`): The input dataset containing KML files.
  * `glob` (`str`, optional): The glob pattern used to identify KML files in the dataset. Default is `*.kml`.
  * `drop_invalid_layers` (`bool`, optional): Defaults to `false`. Silently drops empty/unparsable layers in the KML file if set to `true`. Otherwise, it raises an error.
* Example
  ```python
  from transforms.api import transform, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.parsers import kml_to_dataframe

  @geospatial()
  @transform(
      output=Output('/my/output/dataset'),
      raw=Input('/my/input/dataset'),
  )
  def compute(raw, output):
      return output.write_dataframe(
          kml_to_dataframe(raw)
      )
  ```

#### kmz\_to\_dataframe()

`kmz_to_dataframe(dataset, glob='*.kmz')`

Converts KMZ files to a dataframe.

* Parameters
  * `dataset` (`transforms.api.Input`): The input dataset containing KMZ files.
  * `glob` (`str`, optional): The glob pattern used to identify KMZ files in the dataset. Default is `*.kmz`.
* Example
  ```python
  from transforms.api import transform, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.parsers import kmz_to_dataframe

  @geospatial()
  @transform(
      output=Output('/my/output/dataset'),
      raw=Input('/my/input/dataset'),
  )
  def compute(raw, output):
      return output.write_dataframe(
          kmz_to_dataframe(raw)
      )
  ```

### Spatial functions

#### geohash\_to\_geojson()

`geohash_to_geojson(geometry)`

Converts a geohash (`lat,long`) column to GeoJSON.

* Parameters
  * `geometry` (`str`): The geohash column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import geohash_to_geojson

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('geometry', geohash_to_geojson('geohash'))
  ```

#### geojson\_to\_geohash()

`geojson_to_geohash(geometry)`

Converts a point GeoJSON column to geohash (`lat,long`).

* Parameters
  * `geometry` (`str`): The point GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import geojson_to_geohash

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('geohash', geojson_to_geohash('geometry'))
  ```

#### buffer()

`buffer(geometry, meters, metric_crs='EPSG:3395')`

Buffers a GeoJSON by a given distance.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
  * `meters` (`double`): The buffer in meters.
  * `metric_crs` (`str`, optional): The metric CRS used to convert and buffer (*note: this projection is used in an intermediate step. The output will maintain the same projection as the input*). Should be centered near the target area for minimal distortion. Defaults to `EPSG:3395`.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import buffer

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('geometry', buffer('geometry', meters=10))
  ```

#### convex\_hull()

`convex_hull(geometry)`

Returns the convex hull of a GeoJSON column.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import convex_hull

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('convex_hull', convex_hull('geometry'))
  ```

#### bounding\_box()

`bounding_box(geometry)`

Returns the bounding box of a GeoJSON column.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import bounding_box

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('bounding_box', bounding_box('geometry'))
  ```

#### bounding\_circle()

`bounding_circle(geometry, segments=100)`

Returns the bounding circle of a GeoJSON column.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
  * `segments` (`int`, optional): The number of line segments to make up the circle. Defaults to `100`.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import bounding_circle

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('bounding_circle', bounding_circle('geometry'))
  ```

#### simplify()

`simplify(geometry, tolerance, metric_crs='EPSG:3395')`

Reduces the number of vertices in a GeoJSON shape.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
  * `tolerance` (`double`): The maximum distance (in meters) new vertices can be from the original shape.
  * `metric_crs` (`str`, optional): The metric CRS used to calculate the tolerance (*note: this projection is used in an intermediate step. The output will maintain the same projection as the input*). Should be centered near the target area for minimal distortion. Defaults to `EPSG:3395`.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import simplify

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('geometry', simplify('geometry', tolerance='10'))
  ```

#### start\_point()

`start_point(geometry)`

Returns the first point of a GeoJSON LineString column.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import start_point

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('start_point', start_point('geometry'))
  ```

#### end\_point()

`end_point(geometry)`

Returns the last point of a GeoJSON LineString column.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import end_point

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('end_point', end_point('geometry'))
  ```

#### centroid()

`centroid(geometry)`

Returns the centroid of a GeoJSON column.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import centroid

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('centroid', centroid('geometry'))
  ```

#### intersection()

`intersection(geometry1, geometry2)`

Returns the shape intersecting two GeoJSONs.

* Parameters
  * `geometry1` (`str`): The first GeoJSON geometry column name.
  * `geometry2` (`str`): The second GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import intersection

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('intersection', intersection('geometry1', 'geometry2'))
  ```

#### difference()

`difference(geometry1, geometry2)`

Returns the portion of `geometry1` that is not intersecting `geometry2`.

* Parameters
  * `geometry1` (`str`): The first GeoJSON geometry column name.
  * `geometry2` (`str`): The second GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import difference

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('difference', difference('geometry1', 'geometry2'))
  ```

#### symmetric\_difference()

`symmetric_difference(geometry1, geometry2)`

Returns a shape containing the portions of `geometry1` and `geometry2` that do not overlap.

* Parameters
  * `geometry1` (`str`): The first GeoJSON geometry column name.
  * `geometry2` (`str`): The second GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import symmetric_difference

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('symmetric_difference', symmetric_difference('geometry1', 'geometry2'))
  ```

#### union()

`union(geometry1, geometry2)`

Returns the union of two shapes.

* Parameters
  * `geometry1` (`str`): The first GeoJSON geometry column name.
  * `geometry2` (`str`): The second GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import union

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('union', union('geometry1', 'geometry2'))
  ```

#### distance()

`distance(geometry1, geometry2, metric_crs='EPSG:3395')`

Returns the Euclidean distance in meters between two GeoJSON geometries.

* Parameters
  * `geometry1` (`str`): The first GeoJSON geometry column name.
  * `geometry2` (`str`): The second GeoJSON geometry column name.
  * `metric_crs` (`str`, optional): The metric CRS used to calculate distance. Should be centered near the target area for minimal distortion. Defaults to `EPSG:3395`.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import distance

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('distance', distance('geometry1', 'geometry2'))
  ```

#### length()

`length(geometry, metric_crs='EPSG:3395')`

Returns the length/perimeter in meters of a GeoJSON shape.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
  * `metric_crs` (`str`, optional): The metric CRS used to calculate length. Should be centered near the target area for minimal distortion. Defaults to `EPSG:3395`.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import length

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('perimeter', length('geometry'))
  ```

#### area()

`area(geometry, metric_crs='EPSG:3395')`

Returns the area in square meters of a GeoJSON polygon.

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
  * `metric_crs` (`str`, optional): The metric CRS used to calculate the area. Should be centered near the target area for minimal distortion. Defaults to `EPSG:3395`.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import area

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('area', area('geometry'))
  ```

#### contains()

`contains(geometry1, geometry2)`

Returns `True` if `geometry1` fully contains `geometry2`.

* Parameters
  * `geometry1` (`str`): The GeoJSON column that defines the predicate.
  * `geometry2` (`str`): The GeoJSON column to be tested against `geometry1`.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import contains

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('geometry1_contains_geometry2', contains('geometry1', 'geometry2'))
  ```

#### intersects()

`intersects(geometry1, geometry2)`

Returns `True` if `geometry1` intersects with `geometry2`.

* Parameters
  * `geometry1` (`str`): The first GeoJSON geometry column name.
  * `geometry2` (`str`): The second GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import intersects

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.withColumn('geometry1_intersecting_geometry2', intersects('geometry1', 'geometry2'))
  ```

#### agg\_union()

`agg_union(geometry)`

Returns the shape created by unioning all geometries in a group (the aggregate union).

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import agg_union

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.groupBy('country').agg(agg_union('geometry').alias('geometry'))
  ```

#### agg\_intersection()

`agg_intersection(geometry)`

Returns the shape created by the intersection of all geometries in a group (the aggregate intersection).

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import agg_intersection

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.groupBy('country').agg(agg_intersection('geometry').alias('geometry'))
  ```

#### agg\_bounding\_box()

`agg_bounding_box(geometry)`

Returns the bounding box for all geometries in a group (the aggregate bounding box).

* Parameters
  * `geometry` (`str`): The GeoJSON geometry column name.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import agg_bounding_box

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return df.groupBy('country').agg(agg_bounding_box('geometry').alias('geometry'))
  ```

#### subdivide\_explode()

`subdivide_explode(df, geometry, max_vertices)`

Divides a GeoJSON shape into smaller components, returning a row for each component. Useful for optimizing spatial joins on a column containing very complex shapes.

* Parameters
  * `df` (`PySpark DataFrame`): The input dataframe.
  * `geometry` (`str`): The GeoJSON geometry column name.
  * `max_vertices` (`int`): The maximum number of vertices per component.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial
  from geospatial_tools.functions import subdivide_explode

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df=Input('/my/input/dataset'),
  )
  def compute(df):
      return subdivide_explode(df, 'geometry', max_vertices=1000)
  ```

### Spatial Joins

#### DataFrame.spatial\_join()

`DataFrame.spatial_join(right_df, on, how='inner', **kwargs)`

Joins two dataframes using a spatial intersection.

* Parameters
  * `right_df` (`PySpark DataFrame`): The right side of the join.
  * `on` (`tuple<str, str>`): The tuple of `(left_geometry_column_name, right_geometry_column_name)`.
  * `how` (`str`, optional): The join type (supports the same join types as regular PySpark joins). Defaults to `inner`.
  * `library` (`str`, optional): Either `h3` or `sedona`, depending on which library you want to use to do the join. Defaults to `h3`.
  * `resolution` (`int`, optional): The H3 resolution to use for the join (note: this does not affect the result, only optimization). Raises exception if included when `library='sedona'`. If not included, a best guess resolution will be inferred.
  * `left_partitions` (`int`, optional): Optional override of the default repartitioning scheme of the left dataframe when using `library=sedona`. Raises exception if included when H3.
  * `right_partitions` (`int`, optional): Optional override of the default repartitioning scheme of the right dataframe when using `library=sedona`. Raises exception if included when using H3.
  * `left_pk` (`str`, optional): The primary key column of the left side of join. If not set, a PK will be automatically generated.
  * `right_pk` (`str`, optional): The primary key column of the right side of join. If not set, a PK will be automatically generated.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df1=Input('/my/input/dataset1'),
      df2=Input('/my/input/dataset2'),
  )
  def compute(df1, df2):
      return df.spatial_join(df2, ('df1_geometry', 'df2_geometry'), 'left')
  ```

#### DataFrame.distance\_join()

`DataFrame.distance_join(right_df, on, distance_meters, how='inner', metric_crs='EPSG:3395', **kwargs)`

Performs a distance join on two dataframes.

* Parameters
  * `right_df` (`PySpark DataFrame`): The right side of the join.
  * `on` (`tuple<str, str>`): The tuple of `(left_geometry_column_name, right_geometry_column_name)`.
  * `distance_meters` (`double`): The distance to join at in meters.
  * `how` (`str`, optional): The join type (supports the same join types as regular PySpark joins). Defaults to `inner`.
  * `metric_crs` (`str`, optional): The metric CRS used to calculate distances. Should be centered near the target area for minimal distortion. Defaults to `EPSG:3395`.
  * `left_pk` (`str`, optional): The primary key column of the left side of join. If not set, a PK will be automatically generated.
  * `right_pk` (`str`, optional): The primary key column of the right side of join. If not set, a PK will be automatically generated.
  * `library` (`str`, optional): Either `h3` or `sedona`, depending on which library you want to use to do the join. Defaults to `h3`.
  * `resolution` (`int`, optional): The H3 resolution to use for the join (note: this does not affect the result, only optimization). Raises exception if included when `library='sedona'`. If not included, a best guess resolution will be inferred.
  * `left_partitions` (`int`, optional): Optional override of the default repartitioning scheme of the left dataframe when using `library=sedona`. Raises exception if included when H3.
  * `right_partitions` (`int`, optional): Optional override of the default repartitioning scheme of the right dataframe when using `library=sedona`. Raises exception if included when using H3.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df1=Input('/my/input/dataset1'),
      df2=Input('/my/input/dataset2'),
  )
  def compute(df1, df2):
      return df.distance_join(df2, ('df1_geometry', 'df2_geometry'), 10, 'left')
  ```

#### DataFrame.knn\_join()

`DataFrame.knn_join(right_df, on, k, metric_crs='EPSG:3395', **kwargs)`

Performs a left join of the k-nearest-neighbors in the right dataframe.

* Parameters
  * `right_df` (`PySpark DataFrame`): The right side of the join.
  * `on` (`tuple<str, str>`): The tuple of `(left_geometry_column_name, right_geometry_column_name)`.
  * `k` (`int`): The number of records from the right dataframe that should be matched for each record in the left dataframe.
  * `metric_crs` (`str`, optional): The metric CRS used to calculate distances. Should be centered near the target area for minimal distortion. Defaults to `EPSG:3395`.
  * `resolution` (`int`, optional): The H3 resolution to use for the join (note: this does not affect the result, only optimization). If not included, a best guess resolution will be inferred.
  * `left_pk` (`str`, optional): The primary key column of the left side of join. If not set, a PK will be automatically generated.
  * `right_pk` (`str`, optional): The primary key column of the right side of join. If not set, a PK will be automatically generated.
* Example
  ```python
  from transforms.api import transform_df, Input, Output
  from geospatial_tools import geospatial

  @geospatial()
  @transform_df(
      Output('/my/output/dataset'),
      df1=Input('/my/input/dataset1'),
      df2=Input('/my/input/dataset2'),
  )
  def compute(df1, df2):
      return df.knn_join(df2, ('df1_geometry', 'df2_geometry'), k=1)
  ```

#### geopandas\_spatial\_join()

`geopandas_spatial_join(df_left, df_right, geometry_left, geometry_right, how='inner', op='intersects')`

Computes a spatial join of two Geopandas dataframes. Implements the Geopandas 'sjoin' method. Expects both dataframes to contain a GeoJSON geometry column, whose names are passed as the `geometry_left` and `geometry_right` arguments.

* For large data scales, use the `DataFrame.spatial_join` function documented above.
* Parameters
  * `df_left` ([`pandas.DataFrame` ↗](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html)): The left input dataframe.
  * `df_right` ([`pandas.DataFrame` ↗](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html)): The right input dataframe.
  * `geometry_left` (`str`): The name of the geometry column of the left dataframe.
  * `geometry_right` (`str`): The name of the geometry column of the right dataframe.
  * `how` (`str`, optional): The type of join, one of {`left`, `right`, `inner`}. Defaults to `inner`.
  * `op` (`str`, optional): The join condition, one of {`intersects`, `contains`, `within`}. Defaults to `intersects`.
* Example
  ```python
  from transforms.api import transform, Input, Output
  from geospatial_tools.spatial_joins import geopandas_spatial_join

  @transform(
      output=Output('/my/output/dataset'),
      input_df_left=Input('/my/input/dataset/left'),
      input_df_right=Input('/my/input/dataset/right'),
  )
  def join(ctx, output, input_df_left, input_df_right):
    df_left = input_df_left.dataframe().toPandas()
    df_right = input_df_right.dataframe().toPandas()
    geometry_left = 'geometry'
    geometry_right = 'geometry'

    joined = geopandas_spatial_join(
          df_left,
          df_right,
          geometry_left,
          geometry_right,
          how='inner',
          op='intersects'
      )
      joined = ctx.spark_session.createDataFrame(joined)
      output.write_dataframe(joined)
  ```

## Help and contributions

Contact your Palantir representative to report any issues or feedback.
