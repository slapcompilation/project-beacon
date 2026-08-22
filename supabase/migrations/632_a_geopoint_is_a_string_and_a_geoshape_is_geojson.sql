-- Geopoint and Geoshape get the shape the documentation prints, and the column
-- type it prints them in.
--
-- DELIVERABLE-MAP described these as property base types BEYOND the 22, each
-- waiting for something that stores one. Both halves are wrong, checked rather
-- than assumed:
--
--   `property_base_types()` returns 22 and geoshape, attachment, time_series,
--   geotemporal_series and media_reference are all IN it — not beyond it.
--
--   `property_column_type()` returns a SQL type for every one of the 22, so
--   every one of them stores. Nothing was waiting.
--
-- What they actually lacked is a SHAPE. Of the eleven jsonb-backed base types
-- only `media_reference` had a validator (582); the rest accept any jsonb at
-- all, so a geopoint property would take `{"nonsense": true}`.
--
-- ── AND THE COLUMN TYPE WAS WRONG ───────────────────────────────────────────
--   "The contents of a `geopoint` property should be a string of either:"
--   — geospatial/ontology.md
--
--   "The contents of a `geoshape` property must be a GeoJSON Geometry string"
--   — geospatial/ontology.md
--
-- Both are STRINGS. Ours mapped both to `jsonb`, which is the same class of
-- error 585 recorded when the corpus falsified a shape we had inferred. This is
-- free to correct: zero properties use either type, and `property_column_type`
-- is read by exactly one function, `index_object_type`.
--
-- This section of `geospatial/` was mirrored TODAY. The gap was unreadable
-- before that — `base-types` gives each of these one line and links straight
-- out to a page we did not have.
--
-- ── WHAT A GEOPOINT MAY BE, ENUMERATED ──────────────────────────────────────
--   "`latitude,longitude`: For example, `57.64911,10.40744`. Coordinates must
--   use the WGS 84 CRS (standard latitude and longitude)."
--   — geospatial/ontology.md
--
--   "A Geohash: For example, `u4pruydqqvj`."
--   — geospatial/ontology.md
--
-- Two forms and no third. Latitude is bounded at ±90 and longitude at ±180 by
-- WGS 84 itself; the geohash alphabet is base32 without a, i, l or o, which is
-- the standard the page links to rather than something inferred here.
--
-- ── WHAT A GEOSHAPE MAY BE, AND THE MUST/SHOULD SPLIT ───────────────────────
--   "Must be a GeoJSON LineString, Polygon, MultiLineString, MultiPolygon,
--   MultiPoint, or Point."
--   — geospatial/ontology.md
--
--   "Must not be a Feature, FeatureCollection, or GeometryCollection."
--   — geospatial/ontology.md
--
-- Six allowed, three forbidden, both enumerated. The interesting line is the
-- one in between:
--
--   "However, Point geometries should not use the `geoshape` property type"
--
-- **should**, against a list that says Point **must** be allowed. So a Point
-- geoshape is legal and discouraged, and this file does NOT refuse it — where
-- a page says should, we do not refuse. It is advice about which property type
-- to pick rather than a fact about the value, so it does not become a warning
-- arm either; `ontology_warnings()` reads definitions, and this is about a row.
--
-- ── WHAT IS DELIBERATELY NOT CHECKED ────────────────────────────────────────
--   "Polygons and MultiPolygons must be closed, use a
--   right-hand/counterclockwise winding order for exterior rings, and have no
--   self-intersection."
--   — geospatial/ontology.md
--
-- Winding order and self-intersection are real geometry, and doing them by hand
-- in plpgsql would be inventing a geometry library. PostGIS would answer them
-- and adopting it is a substrate decision, not a property-shape one. Recorded
-- as a divergence we are LESS strict on, which is the safe direction, rather
-- than half-implemented.

CREATE OR REPLACE FUNCTION public.geopoint_valid(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE lat numeric; lon numeric;
BEGIN
  IF p IS NULL THEN RETURN true; END IF;   -- absent is not malformed
  IF btrim(p) = '' THEN RETURN false; END IF;

  -- "latitude,longitude" — WGS 84 bounds the pair.
  IF p ~ '^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$' THEN
    lat := split_part(btrim(p), ',', 1)::numeric;
    lon := split_part(btrim(p), ',', 2)::numeric;
    RETURN lat BETWEEN -90 AND 90 AND lon BETWEEN -180 AND 180;
  END IF;

  -- or a Geohash: base32 without a, i, l, o.
  RETURN p ~ '^[0-9bcdefghjkmnpqrstuvwxyz]+$';
END $$;

COMMENT ON FUNCTION public.geopoint_valid(text) IS
  'A geopoint is "a string of either latitude,longitude ... or a Geohash" (geospatial/ontology). WGS 84 bounds the pair; the geohash alphabet is base32 without a, i, l, o.';

CREATE OR REPLACE FUNCTION public.geoshape_valid(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE g jsonb; t text;
BEGIN
  IF p IS NULL THEN RETURN true; END IF;
  BEGIN g := p::jsonb; EXCEPTION WHEN OTHERS THEN RETURN false; END;
  IF jsonb_typeof(g) <> 'object' THEN RETURN false; END IF;

  t := g->>'type';
  -- The six the page says it must be. Point is among them and is discouraged
  -- rather than refused, because the page says "should".
  IF t IS NULL OR t NOT IN ('LineString', 'Polygon', 'MultiLineString',
                            'MultiPolygon', 'MultiPoint', 'Point') THEN
    RETURN false;
  END IF;
  -- A GeoJSON Geometry has coordinates; Feature and the collections are
  -- excluded by the list above and carry other keys anyway.
  RETURN jsonb_typeof(g->'coordinates') = 'array';
END $$;

COMMENT ON FUNCTION public.geoshape_valid(text) IS
  'A geoshape is "a GeoJSON Geometry string" of one of six types, and must not be a Feature, FeatureCollection or GeometryCollection (geospatial/ontology). Winding order and self-intersection are NOT checked — see 632.';

-- The CHECK a generated index column carries, if its base type has one. Kept
-- beside property_column_type because they answer the same question about the
-- same column and would otherwise drift apart.
CREATE OR REPLACE FUNCTION public.property_column_check(p_base_type text, p_column text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_base_type
    WHEN 'geopoint' THEN format(' CHECK (public.geopoint_valid(%I))', p_column)
    WHEN 'geoshape' THEN format(' CHECK (public.geoshape_valid(%I))', p_column)
    ELSE ''
  END
$$;

COMMENT ON FUNCTION public.property_column_check(text, text) IS
  'The CHECK clause an indexed column carries for its base type, or empty. A fact about one row that is always true, which is the first rung of the ladder.';

-- Both geo types become text, which is what the page says they contain. Every
-- other mapping is unchanged, and the ELSE still catches the jsonb-shaped ones.
CREATE OR REPLACE FUNCTION public.property_column_type(p_base_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE p_base_type
    WHEN 'string'    THEN 'text'
    WHEN 'boolean'   THEN 'boolean'
    WHEN 'byte'      THEN 'smallint'
    WHEN 'short'     THEN 'smallint'
    WHEN 'integer'   THEN 'integer'
    WHEN 'long'      THEN 'bigint'
    WHEN 'float'     THEN 'real'
    WHEN 'double'    THEN 'double precision'
    WHEN 'decimal'   THEN 'numeric'
    WHEN 'date'      THEN 'date'
    WHEN 'timestamp' THEN 'timestamptz'
    -- "The contents of a geopoint property should be a string"; a geoshape is
    -- "a GeoJSON Geometry string". Both were jsonb until 632.
    WHEN 'geopoint'  THEN 'text'
    WHEN 'geoshape'  THEN 'text'
    ELSE 'jsonb'
  END
$function$;

-- index_object_type builds the column list; the CHECK rides along with the
-- type. Patched from the live definition at one anchor, which raises if it
-- moved rather than half-applying.
DO $$
DECLARE d text; p text;
BEGIN
  d := pg_get_functiondef('public.index_object_type(uuid,uuid)'::regprocedure);
  IF position('property_column_check' in d) > 0 THEN
    RAISE NOTICE 'index_object_type already carries the base-type CHECKs';
    RETURN;
  END IF;

  p := replace(d,
    'SELECT string_agg(format(''%I %s'', p.property_id, public.property_column_type(p.base_type)),',
    'SELECT string_agg(format(''%I %s%s'', p.property_id, public.property_column_type(p.base_type),' ||
    ' public.property_column_check(p.base_type, p.property_id)),');

  IF p = d THEN
    RAISE EXCEPTION '632: the column-list builder is not where it was';
  END IF;
  EXECUTE p;
  RAISE NOTICE 'index_object_type now gives a geo column its shape CHECK';
END $$;

-- Proved by RUNNING the emitted SQL, not by reading it. The clause
-- property_column_check returns is used to build a real table, and a malformed
-- value is refused by that table — which is the only way to know the string is
-- valid SQL that actually refuses.
DO $$
DECLARE v_err text; v_clause text;
BEGIN
  BEGIN
    -- (1) the two validators, both directions, over the forms the page names
    IF NOT public.geopoint_valid('57.64911,10.40744') THEN
      RAISE EXCEPTION 'the page''s own latitude,longitude example was refused';
    END IF;
    IF NOT public.geopoint_valid('u4pruydqqvj') THEN
      RAISE EXCEPTION 'the page''s own geohash example was refused';
    END IF;
    IF public.geopoint_valid('91,0') THEN
      RAISE EXCEPTION 'a latitude past 90 was accepted; WGS 84 bounds it';
    END IF;
    IF public.geopoint_valid('0,181') THEN
      RAISE EXCEPTION 'a longitude past 180 was accepted';
    END IF;
    IF public.geopoint_valid('u4pruydqqvi') THEN
      RAISE EXCEPTION 'a geohash containing i was accepted; the alphabet excludes a, i, l, o';
    END IF;
    IF public.geopoint_valid('{"lat":1}') THEN
      RAISE EXCEPTION 'jsonb was accepted for a geopoint, which is a string';
    END IF;

    IF NOT public.geoshape_valid('{ "type": "LineString", "coordinates": [ [100.0, 0.0], [101.0, 1.0] ] }') THEN
      RAISE EXCEPTION 'the page''s own valid GeoJSON example was refused';
    END IF;
    -- Point is on the must-list and is NOT refused, however discouraged.
    IF NOT public.geoshape_valid('{"type":"Point","coordinates":[1,2]}') THEN
      RAISE EXCEPTION 'a Point geoshape was refused; the page says SHOULD not, not must not';
    END IF;
    -- the three the page says it must NOT be
    IF public.geoshape_valid('{"type":"Feature","geometry":{}}')
       OR public.geoshape_valid('{"type":"FeatureCollection","features":[]}')
       OR public.geoshape_valid('{"type":"GeometryCollection","geometries":[]}') THEN
      RAISE EXCEPTION 'a Feature, FeatureCollection or GeometryCollection was accepted';
    END IF;
    IF public.geoshape_valid('not json') THEN
      RAISE EXCEPTION 'a non-JSON string was accepted as a geoshape';
    END IF;

    -- (2) the column type the page prints
    IF public.property_column_type('geopoint') <> 'text'
       OR public.property_column_type('geoshape') <> 'text' THEN
      RAISE EXCEPTION 'the geo types are not stored as the strings the page describes';
    END IF;
    IF public.property_column_type('string') <> 'text'
       OR public.property_column_type('struct') <> 'jsonb' THEN
      RAISE EXCEPTION 'the other mappings moved';
    END IF;

    -- (3) the emitted CHECK is real SQL that refuses. Built into a table and
    -- exercised, because a string that looks like a constraint is not one.
    v_clause := public.property_column_check('geopoint', 'g');
    IF v_clause = '' THEN RAISE EXCEPTION 'geopoint emitted no CHECK'; END IF;
    EXECUTE format('CREATE TEMP TABLE probe632 (g text%s)', v_clause);

    INSERT INTO probe632 VALUES ('57.64911,10.40744');   -- accepted
    v_err := NULL;
    BEGIN
      INSERT INTO probe632 VALUES ('{"nonsense": true}');
    EXCEPTION WHEN check_violation THEN v_err := SQLERRM;
    END;
    IF v_err IS NULL THEN
      RAISE EXCEPTION 'the emitted CHECK accepted a malformed geopoint';
    END IF;
    DROP TABLE probe632;

    -- and a base type with no shape emits nothing at all
    IF public.property_column_check('string', 'x') <> '' THEN
      RAISE EXCEPTION 'a base type with no published shape emitted a CHECK';
    END IF;

    -- (4) the indexer reaches it
    IF position('property_column_check' in
        pg_get_functiondef('public.index_object_type(uuid,uuid)'::regprocedure)) = 0 THEN
      RAISE EXCEPTION 'index_object_type does not emit the CHECK';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '632 proved: both examples accepted, bounds and alphabet refused, Point allowed, the three collections refused, and the emitted CHECK refuses a real INSERT';
  END;
END $$;
