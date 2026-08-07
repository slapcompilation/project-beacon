-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 342 — hotel coordinates become a typed location.
--
-- The one demand-gated base type with consumers already in the tree. Both hotels
-- carry lat/lng in `hotels.config` jsonb; `get_portfolio_signals` digs them out
-- with `(config ->> 'lat')::numeric`; PortfolioMap reads them back with
-- `h.lat as number` in four places; BriefingPage casts the jsonb itself.
-- Coordinates that every layer casts are coordinates nothing has typed.
--
-- Foundry's Geopoint, format copied exactly (`properties-overview`):
--
--   "Geopoint values are stored as a comma-separated string in the format
--    `latitude,longitude` (for example, `57.64911,10.40744`)."
--
-- Geopoint is one of the advanced types that IS valid as a title key, unlike
-- media reference and vector — so 339's trigger correctly leaves it alone.
--
-- ONE SOURCE AT THE END, NOT TWO. Adding `location` while `config.lat/lng`
-- stayed would be the "two similar functionalities" trap inside a single
-- migration: two places to write a coordinate, drifting the first time somebody
-- edits one. So the jsonb keys are REMOVED, and both readers move over.
-- get_portfolio_signals keeps its exact return shape — the map needs no change.
--
-- Two live defects found while checking, fixed here because this migration
-- touches the same function:
--   * builtin_property_drift lost its search_path pin (251) when 340 replaced
--     it — CREATE OR REPLACE resets a function's SET clauses.
--   * ...and has been EXECUTE-able by anon since 228, which revoked from `anon`
--     but not from PUBLIC, so the default grant carried it. It lists object
--     types and column names; that is not an anonymous read.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS location text
    CHECK (location IS NULL OR location ~ '^-?[0-9]+(\.[0-9]+)?,-?[0-9]+(\.[0-9]+)?$');

COMMENT ON COLUMN public.hotels.location IS
  'Foundry Geopoint: latitude,longitude as a comma-separated string. The only coordinate source — config.lat/lng was removed in migration 342.';

UPDATE public.hotels
   SET location = (config ->> 'lat') || ',' || (config ->> 'lng')
 WHERE location IS NULL
   AND config ? 'lat' AND config ? 'lng'
   AND (config ->> 'lat') ~ '^-?[0-9]+(\.[0-9]+)?$'
   AND (config ->> 'lng') ~ '^-?[0-9]+(\.[0-9]+)?$';

-- The old source goes, so there is nothing left to drift against.
UPDATE public.hotels SET config = config - 'lat' - 'lng' WHERE config ?| array['lat', 'lng'];

-- Body reproduced from the live definition; ONLY the two coordinate expressions
-- change. Same columns, same role gate, same ordering.
CREATE OR REPLACE FUNCTION public.get_portfolio_signals()
RETURNS TABLE (
  hotel_id uuid, hotel_name text, queue_pending integer, approvals_pending integer,
  entity_links_pending integer, cases_open integer, last_cycle_at timestamptz,
  last_cycle_auto integer, last_cycle_queued integer, lat numeric, lng numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := auth_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH latest_cycle AS (
    SELECT
      (h ->> 'hotelId')::uuid AS hotel_id,
      coalesce((h ->> 'autoExecuted')::int, 0) AS auto,
      coalesce((h ->> 'queued')::int, 0)       AS queued,
      e.created_at                              AS ran_at,
      row_number() OVER (PARTITION BY (h ->> 'hotelId')::uuid ORDER BY e.created_at DESC) AS rn
    FROM system_health_events e
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(e.details -> 'hotels', '[]'::jsonb)) AS h
    WHERE e.event_type = 'intelligence_cycle_agent_run'
  )
  SELECT
    ht.id   AS hotel_id,
    ht.name AS hotel_name,
    coalesce((SELECT count(*)::int FROM proposals p
              WHERE p.hotel_id = ht.id AND p.status = 'pending'), 0)                 AS queue_pending,
    coalesce((SELECT count(*)::int FROM pending_action_approvals pa
              WHERE pa.hotel_id = ht.id AND pa.status = 'pending'), 0)               AS approvals_pending,
    coalesce((SELECT count(*)::int FROM entity_link_suggestions els
              WHERE els.hotel_id = ht.id AND els.status = 'pending'), 0)             AS entity_links_pending,
    coalesce((SELECT count(*)::int FROM cases c
              WHERE c.hotel_id = ht.id AND c.status IN ('open','in_review')), 0)     AS cases_open,
    lc.ran_at  AS last_cycle_at,
    coalesce(lc.auto, 0)    AS last_cycle_auto,
    coalesce(lc.queued, 0)  AS last_cycle_queued,
    -- Geopoint: one column, split at read. Was a cast out of the config jsonb.
    nullif(split_part(ht.location, ',', 1), '')::numeric AS lat,
    nullif(split_part(ht.location, ',', 2), '')::numeric AS lng
  FROM hotels ht
  LEFT JOIN latest_cycle lc ON lc.hotel_id = ht.id AND lc.rn = 1
  WHERE ht.organization_id IS NOT DISTINCT FROM auth_org_id()
  ORDER BY ht.name;
END;
$function$;

-- builtin_property_drift learns geopoint the same way it learned the other two:
-- a refinement over the column that can hold it, and nothing else.
CREATE OR REPLACE FUNCTION public.builtin_property_drift()
RETURNS TABLE (api_name text, property_key text, problem text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT t.api_name, p->>'key',
         CASE WHEN c.column_name IS NULL THEN 'column no longer exists'
              ELSE 'column type changed to ' || c.data_type END
  FROM public.object_types t
  CROSS JOIN LATERAL jsonb_array_elements(t.properties) p
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = t.source_table AND c.column_name = p->>'key'
  WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL
    AND (
      c.column_name IS NULL
      OR NOT (
        -- The default mapping: a column type implies a base type.
        (p->>'type') = CASE
           WHEN c.data_type IN ('integer','bigint','smallint','numeric','real','double precision') THEN 'number'
           WHEN c.data_type = 'boolean' THEN 'boolean'
           WHEN c.data_type LIKE 'timestamp%' OR c.data_type = 'date' THEN 'date'
           ELSE 'text' END
        -- Foundry's advanced types, each valid over exactly the column that can
        -- hold it. A refinement, never a free choice.
        OR (p->>'type' = 'media_reference' AND c.data_type = 'text')
        OR (p->>'type' = 'vector'          AND c.udt_name  = 'vector')
        OR (p->>'type' = 'geopoint'        AND c.data_type = 'text')
      )
    )
  UNION ALL
  SELECT t.api_name, t.title_key, 'title_key is not a property of this type'
  FROM public.object_types t
  WHERE t.kind = 'builtin' AND t.title_key IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(t.properties) p WHERE p->>'key' = t.title_key
    );
$$;

COMMENT ON FUNCTION public.builtin_property_drift() IS
  'Rows = drift between a built-in registration and its backing table. A column type implies a base type; media_reference, vector and geopoint are permitted refinements over text, pgvector and text respectively, per Foundry''s rule that a base type must match the underlying column.';

-- 228 revoked from anon but left PUBLIC's default grant in place.
REVOKE EXECUTE ON FUNCTION public.builtin_property_drift() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.builtin_property_drift() TO authenticated;

-- The hotel type gains the property, so the ontology can see where a hotel is.
UPDATE public.object_types
   SET properties = properties || jsonb_build_array(jsonb_build_object(
         'key', 'location', 'label', 'Location', 'type', 'geopoint', 'required', false))
 WHERE kind = 'builtin' AND api_name = 'hotel'
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(properties) p WHERE p->>'key' = 'location');

DO $$
DECLARE n int; located int; def text;
BEGIN
  SELECT count(*) INTO n FROM builtin_property_drift();
  IF n > 0 THEN RAISE EXCEPTION 'Migration 342: % drift row(s) after registering geopoint', n; END IF;

  SELECT count(*) INTO located FROM hotels WHERE location IS NOT NULL;
  IF located = 0 THEN RAISE EXCEPTION 'Migration 342: no hotel kept its coordinates through the move'; END IF;

  SELECT count(*) INTO n FROM hotels WHERE config ?| array['lat', 'lng'];
  IF n > 0 THEN RAISE EXCEPTION 'Migration 342: % hotel(s) still carry coordinates in config', n; END IF;

  -- The RPC is role-gated and there is no JWT here, so its OUTPUT cannot be
  -- asserted from a migration. Its SOURCE can: it must read the column, and
  -- must no longer read the jsonb.
  SELECT pg_get_functiondef(oid) INTO def FROM pg_proc
   WHERE proname = 'get_portfolio_signals' AND pronamespace = 'public'::regnamespace;
  IF def NOT LIKE '%split_part(ht.location%' THEN
    RAISE EXCEPTION 'Migration 342: get_portfolio_signals does not read hotels.location';
  END IF;
  IF def LIKE '%config ->> ''lat''%' THEN
    RAISE EXCEPTION 'Migration 342: get_portfolio_signals still reads config->>lat';
  END IF;

  -- Round-trip the stored format through the same split the RPC uses.
  SELECT count(*) INTO n FROM hotels
   WHERE location IS NOT NULL
     AND split_part(location, ',', 1)::numeric BETWEEN -90 AND 90
     AND split_part(location, ',', 2)::numeric BETWEEN -180 AND 180;
  IF n <> located THEN
    RAISE EXCEPTION 'Migration 342: % of % locations are not a valid lat,lng', located - n, located;
  END IF;

  IF (SELECT p->>'type' FROM object_types o, jsonb_array_elements(o.properties) p
       WHERE o.api_name = 'hotel' AND p->>'key' = 'location' LIMIT 1) IS DISTINCT FROM 'geopoint' THEN
    RAISE EXCEPTION 'Migration 342: hotel.location is not registered as a geopoint';
  END IF;

  IF has_function_privilege('anon', 'public.builtin_property_drift()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 342: anon can still execute builtin_property_drift';
  END IF;
END $$;

COMMIT;
