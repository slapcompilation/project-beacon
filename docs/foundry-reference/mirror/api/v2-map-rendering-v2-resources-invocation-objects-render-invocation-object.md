<!-- source: https://palantir.com/docs/foundry/api/v2/map-rendering-v2-resources/invocation-objects/render-invocation-object/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Render Invocation Object

`PUT /api/v2/mapRendering/invocationObject/render`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:map-read`.

Scopes: `api:map-read`

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `RenderInvocationObjectRequest` · object · required
  - `capabilities` · object · required
    "The render capability of the client. Renderables will be returned in the best possible format that's supported by the client."
    - `supportedRenderableContent` · list
      - `RenderableContentType` · enum · required
        one of `GEOMETRY`, `RASTER_TILES_WEB_MERCATOR`
        "Available renderable content types: - `GEOMETRY`: Base geometry type. Corresponds to [GeometryRenderableContent](#/components/schemas/GeometryRenderableContent). - `RASTER_TILES_WEB_MERCATOR`: Web Mercator (EPSG:3857) projection raster tiles. Corresponds to [RasterTilesRenderableContent](#/components/schemas/RasterTilesRenderableContent)."
  - `invocations` · list
    - `Invocation` · object · required
      "Represents a request to render a set of Foundry objects. This includes information on how the objects should be rendered."
      - `id` · string · required
        "Client supplied session-unique identifier for a specific invocation of a render function."
      - `sourcingOnly` · boolean
      - `objects` · union · required
        "Reference to a set of Foundry objects."
        - `objectSet` · object
          "Reference to a Foundry object set. Versioned object sets are currently not supported."
          - `objectSetRid` · string · required
            "The RID of a Foundry object set."
      - `renderer` · union · required
        "Reference that can be resolved into a renderer object. The renderer object includes configuration settings for rendering the objects."
        - `standard` · object
          "The standard built in renderer. Renders the objects with service defined default styling derived from the object type icon set in ontology manager."
          - `get` · any

## Response

- `RenderObjectsResponse` · object · required
  - `renderables` · list
    - `Renderable` · object · required
      "A set of RenderableContent that represents a property of a Foundry object (i.e. the sourcing) for an invocation."
      - `id` · string · required
        "Globally unique ID for a renderable within a session. The ID is opaque and not meant to be parsed in any way."
      - `invocation` · string · required
        "Client supplied session-unique identifier for a specific invocation of a render function."
      - `sourcing` · string · required
        "Globally unique ID for the sourcing within a session. The ID is opaque and not meant to be parsed in any way."
      - `content` · map
        - `RenderablePartId` · string · required
          "Locally unique identifier for a part of a renderable."
        - `RenderableContent` · union · required
          "Represents a set of geopositioned geometries and their corresponding style to be rendered on to a map."
          - `geometry` · object
            "Renderable content represented with GeoJson geometry."
            - `geometry` · union · required
              "GeoJSON object The coordinate reference system for all GeoJSON coordinates is a geographic coordinate reference system, using the World Geodetic System 1984 (WGS 84) datum, with longitude and latitude units of decimal degrees. This is equivalent to the coordinate reference system identified by the Open Geospatial Consortium (OGC) URN An OPTIONAL third-position element SHALL be the height in meters above or below the WGS 84 reference ellipsoid. In the absence of elevation values, applications sensitive to height or depth SHOULD interpret positions as being at local ground or sea level."
              - `MultiPoint` · object
                - `coordinates` · list
                  - `Position` · list · required
                    "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                    - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `GeometryCollection` · object
                "GeoJSON geometry collection GeometryCollections composed of a single part or a number of parts of a single type SHOULD be avoided when that single part or a single object of multipart type (MultiPoint, MultiLineString, or MultiPolygon) could be used instead."
                - `geometries` · list
                  - `Geometry` · union · required
                    "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                    - `MultiPoint` · object
                      - `coordinates` · list
                        - `Position` · list · required
                          "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                          - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `GeometryCollection` · object
                      "GeoJSON geometry collection GeometryCollections composed of a single part or a number of parts of a single type SHOULD be avoided when that single part or a single object of multipart type (MultiPoint, MultiLineString, or MultiPolygon) could be used instead."
                    - `MultiLineString` · object
                      - `coordinates` · list
                        - `LineStringCoordinates` · list · required
                          "GeoJSON fundamental geometry construct, array of two or more positions."
                          - `Position` · list · required
                            "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                            - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `LineString` · object
                      - `coordinates` · list
                        "GeoJSON fundamental geometry construct, array of two or more positions."
                        - `Position` · list · required
                          "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                          - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `MultiPolygon` · object
                      - `coordinates` · list
                        - `array` · list · required
                          - `LinearRing` · list · required
                            "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                            - `Position` · list · required
                              "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                              - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `Point` · object
                      - `coordinates` · list
                        "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                        - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `Polygon` · object
                      - `coordinates` · list
                        - `LinearRing` · list · required
                          "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                          - `Position` · list · required
                            "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                            - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `MultiLineString` · object
                - `coordinates` · list
                  - `LineStringCoordinates` · list · required
                    "GeoJSON fundamental geometry construct, array of two or more positions."
                    - `Position` · list · required
                      "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                      - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `FeatureCollection` · object
                "GeoJSON 'FeatureCollection' object"
                - `features` · list
                  - `FeatureCollectionTypes` · union · required
                    - `Feature` · object
                      - `geometry` · union
                        "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                        - `MultiPoint` · object
                          - `coordinates` · list
                            - `Position` · list · required
                              "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                              - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `GeometryCollection` · object
                          "GeoJSON geometry collection GeometryCollections composed of a single part or a number of parts of a single type SHOULD be avoided when that single part or a single object of multipart type (MultiPoint, MultiLineString, or MultiPolygon) could be used instead."
                          - `geometries` · list
                            - `Geometry` · union · required
                              "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `MultiLineString` · object
                          - `coordinates` · list
                            - `LineStringCoordinates` · list · required
                              "GeoJSON fundamental geometry construct, array of two or more positions."
                              - `Position` · list · required
                                "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                                - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `LineString` · object
                          - `coordinates` · list
                            "GeoJSON fundamental geometry construct, array of two or more positions."
                            - `Position` · list · required
                              "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                              - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `MultiPolygon` · object
                          - `coordinates` · list
                            - `array` · list · required
                              - `LinearRing` · list · required
                                "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                                - `Position` · list · required
                                  "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                                  - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `Point` · object
                          - `coordinates` · list
                            "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                            - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `Polygon` · object
                          - `coordinates` · list
                            - `LinearRing` · list · required
                              "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                              - `Position` · list · required
                                "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                                - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                      - `properties` · map
                        "A `Feature` object has a member with the name "properties".  The value of the properties member is an object (any JSON object or a JSON null value)."
                        - `FeaturePropertyKey` · string · required
                      - `id` · any
                        "If a `Feature` has a commonly used identifier, that identifier SHOULD be included as a member of the Feature object with the name "id", and the value of this member is either a JSON string or number."
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `LineString` · object
                - `coordinates` · list
                  "GeoJSON fundamental geometry construct, array of two or more positions."
                  - `Position` · list · required
                    "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                    - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `MultiPolygon` · object
                - `coordinates` · list
                  - `array` · list · required
                    - `LinearRing` · list · required
                      "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                      - `Position` · list · required
                        "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                        - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `Point` · object
                - `coordinates` · list
                  "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                  - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `Polygon` · object
                - `coordinates` · list
                  - `LinearRing` · list · required
                    "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                    - `Position` · list · required
                      "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                      - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `Feature` · object
                - `geometry` · union
                  "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                  - `MultiPoint` · object
                    - `coordinates` · list
                      - `Position` · list · required
                        "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                        - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `GeometryCollection` · object
                    "GeoJSON geometry collection GeometryCollections composed of a single part or a number of parts of a single type SHOULD be avoided when that single part or a single object of multipart type (MultiPoint, MultiLineString, or MultiPolygon) could be used instead."
                    - `geometries` · list
                      - `Geometry` · union · required
                        "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `MultiLineString` · object
                    - `coordinates` · list
                      - `LineStringCoordinates` · list · required
                        "GeoJSON fundamental geometry construct, array of two or more positions."
                        - `Position` · list · required
                          "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                          - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `LineString` · object
                    - `coordinates` · list
                      "GeoJSON fundamental geometry construct, array of two or more positions."
                      - `Position` · list · required
                        "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                        - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `MultiPolygon` · object
                    - `coordinates` · list
                      - `array` · list · required
                        - `LinearRing` · list · required
                          "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                          - `Position` · list · required
                            "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                            - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `Point` · object
                    - `coordinates` · list
                      "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                      - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `Polygon` · object
                    - `coordinates` · list
                      - `LinearRing` · list · required
                        "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                        - `Position` · list · required
                          "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                          - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                - `properties` · map
                  "A `Feature` object has a member with the name "properties".  The value of the properties member is an object (any JSON object or a JSON null value)."
                  - `FeaturePropertyKey` · string · required
                - `id` · any
                  "If a `Feature` has a commonly used identifier, that identifier SHOULD be included as a member of the Feature object with the name "id", and the value of this member is either a JSON string or number."
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
            - `style` · object · required
              "Styling information for GeoJson geometry objects."
              - `symbolStyle` · object
                "Symbol to be rendered as part of the renderable content."
                - `symbol` · union · required
                  "Information used load the symbol from the Symbol loading apis."
                  - `solid` · object
                    "Object for RGB value to use as union"
                    - `rgb` · string · required
                      "RGB values of the color encoded in hex as '#RRGGBB'"
                  - `sdf` · object
                    - `id` · string · required
                      "Unique identifier for a SDF symbol that can be used to fetch the SDF as a PNG."
                    - `color` · object · required
                      "Color to be applied to some component of a renderable."
                      - `rgb` · string · required
                        "RGB values of the color encoded in hex as '#RRGGBB'"
                      - `alpha` · integer · required
                        "Alpha value of the color in the [0, 255] range."
                  - `generic` · object
                    "Base generic symbol. Clients should always support rendering this symbol type."
                    - `id` · string · required
                      "Unique identifier for a symbol that can be used to fetch the symbol as a PNG using loadGenericSymbol endpoint. The ID is opaque and not meant to be parsed in any way."
                - `size` · number · required
                  "Size in virtual pixels, accounting for high DPI displays. For browser applications these are CSS pixels or devicePixelRatio."
                - `opacity` · integer · required
                  "Alpha value of the color in the [0, 255] range."
              - `strokeStyle` · object
                "Color to be applied to some component of a renderable."
                - `color` · object · required
                  "This property is deprecated as reading it no longer encapsulates the full picture of a style. Opt to use pattern and opacity instead when possible."
                  - `rgb` · string · required
                    "RGB values of the color encoded in hex as '#RRGGBB'"
                  - `alpha` · integer · required
                    "Alpha value of the color in the [0, 255] range."
                - `width` · number · required
                  "Size in virtual pixels, accounting for high DPI displays. For browser applications these are CSS pixels or devicePixelRatio."
                - `pattern` · union · required
                  "Information used load the symbol from the Symbol loading apis."
                  - `solid` · object
                    "Object for RGB value to use as union"
                    - `rgb` · string · required
                      "RGB values of the color encoded in hex as '#RRGGBB'"
                  - `sdf` · object
                    - `id` · string · required
                      "Unique identifier for a SDF symbol that can be used to fetch the SDF as a PNG."
                    - `color` · object · required
                      "Color to be applied to some component of a renderable."
                      - `rgb` · string · required
                        "RGB values of the color encoded in hex as '#RRGGBB'"
                      - `alpha` · integer · required
                        "Alpha value of the color in the [0, 255] range."
                  - `generic` · object
                    "Base generic symbol. Clients should always support rendering this symbol type."
                    - `id` · string · required
                      "Unique identifier for a symbol that can be used to fetch the symbol as a PNG using loadGenericSymbol endpoint. The ID is opaque and not meant to be parsed in any way."
                - `opacity` · integer · required
                  "Alpha value of the color in the [0, 255] range."
              - `fillStyle` · object
                "Fill to be applied to some component of a renderable."
                - `color` · object · required
                  "This property is deprecated as reading it no longer encapsulates the full picture of a style. Opt to use pattern and opacity instead when possible."
                  - `rgb` · string · required
                    "RGB values of the color encoded in hex as '#RRGGBB'"
                  - `alpha` · integer · required
                    "Alpha value of the color in the [0, 255] range."
                - `pattern` · union · required
                  "Information used load the symbol from the Symbol loading apis."
                  - `solid` · object
                    "Object for RGB value to use as union"
                    - `rgb` · string · required
                      "RGB values of the color encoded in hex as '#RRGGBB'"
                  - `sdf` · object
                    - `id` · string · required
                      "Unique identifier for a SDF symbol that can be used to fetch the SDF as a PNG."
                    - `color` · object · required
                      "Color to be applied to some component of a renderable."
                      - `rgb` · string · required
                        "RGB values of the color encoded in hex as '#RRGGBB'"
                      - `alpha` · integer · required
                        "Alpha value of the color in the [0, 255] range."
                  - `generic` · object
                    "Base generic symbol. Clients should always support rendering this symbol type."
                    - `id` · string · required
                      "Unique identifier for a symbol that can be used to fetch the symbol as a PNG using loadGenericSymbol endpoint. The ID is opaque and not meant to be parsed in any way."
                - `opacity` · integer · required
                  "Alpha value of the color in the [0, 255] range."
              - `labelStyle` · object
                "Text to be rendered as part of the renderable content."
                - `color` · object · required
                  "Color to be applied to some component of a renderable."
                  - `rgb` · string · required
                    "RGB values of the color encoded in hex as '#RRGGBB'"
                  - `alpha` · integer · required
                    "Alpha value of the color in the [0, 255] range."
                - `text` · string · required
                - `size` · number · required
                  "Size in virtual pixels, accounting for high DPI displays. For browser applications these are CSS pixels or devicePixelRatio."
          - `rasterTilesWebMercator` · object
            "Renderable content represented with raster tiles in the Web Mercator (EPSG:3857) projection, laid out with the single root tile, (z=0, x=0, y=0), covering the whole world. Construct the url using the url template supplied to load the raster tile. See https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames."
            - `url` · string · required
            - `tileDisplayResolution` · number · required
              "Size in virtual pixels, accounting for high DPI displays. For browser applications these are CSS pixels or devicePixelRatio."
            - `coveringGeometry` · union · required
              "GeoJSON object The coordinate reference system for all GeoJSON coordinates is a geographic coordinate reference system, using the World Geodetic System 1984 (WGS 84) datum, with longitude and latitude units of decimal degrees. This is equivalent to the coordinate reference system identified by the Open Geospatial Consortium (OGC) URN An OPTIONAL third-position element SHALL be the height in meters above or below the WGS 84 reference ellipsoid. In the absence of elevation values, applications sensitive to height or depth SHOULD interpret positions as being at local ground or sea level."
              - `MultiPoint` · object
                - `coordinates` · list
                  - `Position` · list · required
                    "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                    - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `GeometryCollection` · object
                "GeoJSON geometry collection GeometryCollections composed of a single part or a number of parts of a single type SHOULD be avoided when that single part or a single object of multipart type (MultiPoint, MultiLineString, or MultiPolygon) could be used instead."
                - `geometries` · list
                  - `Geometry` · union · required
                    "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                    - `MultiPoint` · object
                      - `coordinates` · list
                        - `Position` · list · required
                          "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                          - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `GeometryCollection` · object
                      "GeoJSON geometry collection GeometryCollections composed of a single part or a number of parts of a single type SHOULD be avoided when that single part or a single object of multipart type (MultiPoint, MultiLineString, or MultiPolygon) could be used instead."
                    - `MultiLineString` · object
                      - `coordinates` · list
                        - `LineStringCoordinates` · list · required
                          "GeoJSON fundamental geometry construct, array of two or more positions."
                          - `Position` · list · required
                            "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                            - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `LineString` · object
                      - `coordinates` · list
                        "GeoJSON fundamental geometry construct, array of two or more positions."
                        - `Position` · list · required
                          "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                          - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `MultiPolygon` · object
                      - `coordinates` · list
                        - `array` · list · required
                          - `LinearRing` · list · required
                            "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                            - `Position` · list · required
                              "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                              - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `Point` · object
                      - `coordinates` · list
                        "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                        - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                    - `Polygon` · object
                      - `coordinates` · list
                        - `LinearRing` · list · required
                          "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                          - `Position` · list · required
                            "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                            - `Coordinate` · number · required
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `MultiLineString` · object
                - `coordinates` · list
                  - `LineStringCoordinates` · list · required
                    "GeoJSON fundamental geometry construct, array of two or more positions."
                    - `Position` · list · required
                      "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                      - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `FeatureCollection` · object
                "GeoJSON 'FeatureCollection' object"
                - `features` · list
                  - `FeatureCollectionTypes` · union · required
                    - `Feature` · object
                      - `geometry` · union
                        "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                        - `MultiPoint` · object
                          - `coordinates` · list
                            - `Position` · list · required
                              "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                              - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `GeometryCollection` · object
                          "GeoJSON geometry collection GeometryCollections composed of a single part or a number of parts of a single type SHOULD be avoided when that single part or a single object of multipart type (MultiPoint, MultiLineString, or MultiPolygon) could be used instead."
                          - `geometries` · list
                            - `Geometry` · union · required
                              "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `MultiLineString` · object
                          - `coordinates` · list
                            - `LineStringCoordinates` · list · required
                              "GeoJSON fundamental geometry construct, array of two or more positions."
                              - `Position` · list · required
                                "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                                - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `LineString` · object
                          - `coordinates` · list
                            "GeoJSON fundamental geometry construct, array of two or more positions."
                            - `Position` · list · required
                              "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                              - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `MultiPolygon` · object
                          - `coordinates` · list
                            - `array` · list · required
                              - `LinearRing` · list · required
                                "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                                - `Position` · list · required
                                  "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                                  - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `Point` · object
                          - `coordinates` · list
                            "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                            - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                        - `Polygon` · object
                          - `coordinates` · list
                            - `LinearRing` · list · required
                              "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                              - `Position` · list · required
                                "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                                - `Coordinate` · number · required
                          - `bbox` · list
                            "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                            - `Coordinate` · number · required
                      - `properties` · map
                        "A `Feature` object has a member with the name "properties".  The value of the properties member is an object (any JSON object or a JSON null value)."
                        - `FeaturePropertyKey` · string · required
                      - `id` · any
                        "If a `Feature` has a commonly used identifier, that identifier SHOULD be included as a member of the Feature object with the name "id", and the value of this member is either a JSON string or number."
                      - `bbox` · list
                        "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                        - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `LineString` · object
                - `coordinates` · list
                  "GeoJSON fundamental geometry construct, array of two or more positions."
                  - `Position` · list · required
                    "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                    - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `MultiPolygon` · object
                - `coordinates` · list
                  - `array` · list · required
                    - `LinearRing` · list · required
                      "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                      - `Position` · list · required
                        "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                        - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `Point` · object
                - `coordinates` · list
                  "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                  - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `Polygon` · object
                - `coordinates` · list
                  - `LinearRing` · list · required
                    "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                    - `Position` · list · required
                      "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                      - `Coordinate` · number · required
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
              - `Feature` · object
                - `geometry` · union
                  "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                  - `MultiPoint` · object
                    - `coordinates` · list
                      - `Position` · list · required
                        "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                        - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `GeometryCollection` · object
                    "GeoJSON geometry collection GeometryCollections composed of a single part or a number of parts of a single type SHOULD be avoided when that single part or a single object of multipart type (MultiPoint, MultiLineString, or MultiPolygon) could be used instead."
                    - `geometries` · list
                      - `Geometry` · union · required
                        "Abstract type for all GeoJSON object except Feature and FeatureCollection"
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `MultiLineString` · object
                    - `coordinates` · list
                      - `LineStringCoordinates` · list · required
                        "GeoJSON fundamental geometry construct, array of two or more positions."
                        - `Position` · list · required
                          "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                          - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `LineString` · object
                    - `coordinates` · list
                      "GeoJSON fundamental geometry construct, array of two or more positions."
                      - `Position` · list · required
                        "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                        - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `MultiPolygon` · object
                    - `coordinates` · list
                      - `array` · list · required
                        - `LinearRing` · list · required
                          "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                          - `Position` · list · required
                            "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                            - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `Point` · object
                    - `coordinates` · list
                      "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                      - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                  - `Polygon` · object
                    - `coordinates` · list
                      - `LinearRing` · list · required
                        "A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise."
                        - `Position` · list · required
                          "GeoJSON fundamental geometry construct. A position is an array of numbers. There MUST be two or more elements. The first two elements are longitude and latitude, precisely in that order and using decimal numbers. Altitude or elevation MAY be included as an optional third element. Implementations SHOULD NOT extend positions beyond three elements because the semantics of extra elements are unspecified and ambiguous. Historically, some implementations have used a fourth element to carry a linear referencing measure (sometimes denoted as "M") or a numerical timestamp, but in most situations a parser will not be able to properly interpret these values. The interpretation and meaning of additional elements is beyond the scope of this specification, and additional elements MAY be ignored by parsers."
                          - `Coordinate` · number · required
                    - `bbox` · list
                      "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                      - `Coordinate` · number · required
                - `properties` · map
                  "A `Feature` object has a member with the name "properties".  The value of the properties member is an object (any JSON object or a JSON null value)."
                  - `FeaturePropertyKey` · string · required
                - `id` · any
                  "If a `Feature` has a commonly used identifier, that identifier SHOULD be included as a member of the Feature object with the name "id", and the value of this member is either a JSON string or number."
                - `bbox` · list
                  "A GeoJSON object MAY have a member named "bbox" to include information on the coordinate range for its Geometries, Features, or FeatureCollections. The value of the bbox member MUST be an array of length 2*n where n is the number of dimensions represented in the contained geometries, with all axes of the most southwesterly point followed by all axes of the more northeasterly point. The axes order of a bbox follows the axes order of geometries."
                  - `Coordinate` · number · required
            - `style` · object · required
              "Styling information for raster tiles."
              - `opacity` · integer · required
                "Alpha value of the color in the [0, 255] range."
  - `sourcings` · list
    - `Sourcing` · object · required
      "A reference to an individual unit of data Renderables were derived from."
      - `id` · string · required
        "Globally unique ID for the sourcing within a session. The ID is opaque and not meant to be parsed in any way."
      - `content` · union · required
        "Information used to locate the Sourcing and its metadata."
        - `object` · object
          "Information that could be used to identify an unique Foundry object."
          - `objectType` · string · required
            "A unique identifier of a Foundry object type."
          - `primaryKey` · map
            - `FoundryObjectPropertyTypeRid` · string · required
              "A unique identifier of a Foundry object property."
            - `FoundryObjectPropertyValueUntyped` · any · required
              "The value of a Foundry object's property. The type of the property value is not preserved."
        - `objectV2` · object
          - `objectType` · string · required
            "A unique identifier of a Foundry object type."
          - `objectRid` · string · required
            "A unique identifier of an object."
      - `title` · string · required

## Errors

- `RenderInvocationObjectPermissionDenied` (PERMISSION_DENIED) — "Could not render the InvocationObject."
