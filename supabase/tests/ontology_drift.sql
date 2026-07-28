-- ─────────────────────────────────────────────────────────────────────────────
-- Ontology drift — the tripwire our architecture doesn't give us for free.
--
-- Foundry materialises objects into an index, so the ontology's property schema
-- IS the index's schema: a column change forces an unregister + reindex and
-- cannot be ignored. We read the backing table live through PostgREST, so we get
-- no downtime — and no failure either. A renamed column would silently render as
-- `undefined` in the generated Object View.
--
-- This asserts what Foundry gets structurally, and follows the same discipline
-- their pipeline guidance asks for: "explicitly cast the column types … this
-- will help catch breaking changes from the source system if a column type
-- changes."
--
-- Run:
--   supabase db execute -f supabase/tests/ontology_drift.sql --linked
--   -- or paste into the SQL editor / run via the Supabase MCP execute_sql
--
-- RAISES on any drift, naming every offending property.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  n int;
  detail text;
  registered int;
BEGIN
  SELECT count(*) INTO registered FROM public.object_types WHERE kind = 'builtin';
  IF registered = 0 THEN
    RAISE NOTICE 'ontology drift SKIPPED — no built-in type registrations in this environment';
    RETURN;
  END IF;

  SELECT count(*) INTO n FROM public.builtin_property_drift();
  IF n > 0 THEN
    SELECT string_agg(format('%s.%s: %s', api_name, property_key, problem), '; ')
      INTO detail FROM public.builtin_property_drift();
    RAISE EXCEPTION 'ONTOLOGY DRIFT — % registered propert(ies) no longer match their backing table: %', n, detail;
  END IF;

  -- A registration with no properties renders an EMPTY Object View, which looks
  -- like a broken page rather than a missing mapping. Catch it here instead.
  SELECT count(*) INTO n
  FROM public.object_types
  WHERE kind = 'builtin' AND source_table IS NOT NULL AND jsonb_array_length(properties) = 0;
  IF n > 0 THEN
    RAISE EXCEPTION 'ONTOLOGY DRIFT — % built-in type(s) have a backing table but no derived properties', n;
  END IF;

  RAISE NOTICE 'ontology drift OK — % built-in registrations match their backing tables', registered;
END $$;
