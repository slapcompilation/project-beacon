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

-- ─────────────────────────────────────────────────────────────────────────────
-- Authored artifacts: the half with no compiler.
--
-- builtin_property_drift above checks code-owned types against their tables.
-- This checks the operator-authored side, where validateUserTool runs in the
-- COMPOSER and never again — so a property deleted after a tool was saved leaves
-- that tool answering zero with a basis line and a confidence score. An answer
-- that is wrong and looks right is the failure this whole audit kept finding.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE n int; detail text;
BEGIN
  SELECT count(*), string_agg(format('%s "%s" %s', artifact_kind, artifact_name, problem), '; ')
    INTO n, detail FROM authored_artifact_drift();
  IF n > 0 THEN
    RAISE EXCEPTION 'AUTHORED ARTIFACT DRIFT — % artifact(s) reference something that no longer exists: %', n, detail;
  END IF;
  RAISE NOTICE 'authored artifacts OK — every saved tool, cohort, automation and agent still resolves';
END $$;

-- Orphans are REPORTED, not failed on. They accumulate legitimately between
-- reaps — a document deleted today leaves its entities behind until someone
-- decides — so a red build would punish normal operation. What matters is that
-- nobody has to go looking.
DO $$
DECLARE n int; detail text;
BEGIN
  SELECT count(*), string_agg(DISTINCT kind, ', ') INTO n, detail FROM ontology_orphans();
  IF n > 0 THEN
    RAISE NOTICE 'lineage: % orphaned node(s) (%). Reap with select * from reap_ontology_orphans().', n, detail;
  ELSE
    RAISE NOTICE 'lineage OK — no derived node outlives its source';
  END IF;
END $$;

-- A package must contain no uuids. Every reference travels by API name, because
-- an id means nothing in the organization installing it — an export carrying one
-- installs as a dangling reference, which is the failure this arc is about.
-- Cheap to check and it catches the regression that matters: somebody adding a
-- field to the export that leaks a local id.
DO $$
DECLARE doc text; n int;
BEGIN
  SELECT export_ontology_package()::text INTO doc;
  SELECT count(*) INTO n FROM regexp_matches(
    doc, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'g');
  IF n > 0 THEN
    RAISE EXCEPTION 'ONTOLOGY PACKAGE NOT PORTABLE — the export contains % uuid(s); references must travel by api_name', n;
  END IF;
  RAISE NOTICE 'ontology package OK — portable, every reference by api_name';
END $$;

-- A link is a node too, tenancy-wise: it carries the organization its hotel
-- belongs to. 262's router wrote (hotel_id, source_id, target_id) and skipped
-- the org column entirely — 4,076 rows across four backings, invisible because
-- every policy on those tables happens to be hotel-scoped. It would have
-- surfaced eventually as "the chain-wide query returns nothing", which is a
-- much worse place to learn it. Checked generically so a new join table
-- inherits the check instead of needing to remember it.
DO $$
DECLARE t text; n int; bad text;
BEGIN
  FOR t IN SELECT DISTINCT backing_table FROM link_types
            WHERE backing_kind = 'join_table' AND backing_table IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I l JOIN hotels h ON h.id = l.hotel_id
        WHERE h.organization_id IS NOT NULL AND l.organization_id IS NULL', t) INTO n;
    IF n > 0 THEN bad := concat_ws('; ', bad, format('%s: %s rows', t, n)); END IF;
  END LOOP;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'LINK TENANCY DRIFT — join-backed links missing their organization: %', bad;
  END IF;
  RAISE NOTICE 'link tenancy OK — every join-backed link carries its hotel''s organization';
END $$;
