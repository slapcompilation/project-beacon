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
  SELECT count(*) INTO registered FROM public.object_types WHERE source_table IS NOT NULL;
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
  WHERE source_table IS NOT NULL AND jsonb_array_length(properties) = 0;
  IF n > 0 THEN
    RAISE EXCEPTION 'ONTOLOGY DRIFT — % built-in type(s) have a backing table but no derived properties', n;
  END IF;

  -- Foundry requires a title key on every object type — "the property that acts
  -- as a display name for objects of this type". Without one, every surface
  -- invents its own answer, which is how three different titles for the same
  -- record got shipped (migration 346).
  --
  -- Two exemptions, both structural rather than convenient:
  --   * authored types — object_records.title is NOT NULL, so the title is
  --     guaranteed by the storage model instead of chosen per type;
  --   * four relational line types whose columns are a parent id, a variant id
  --     and numbers. Nothing in the row names the row. They are enumerated here
  --     so the exemption cannot quietly grow — a fifth one fails this test.
  SELECT string_agg(api_name, ', ' ORDER BY api_name) INTO detail
  FROM public.object_types
  WHERE source_table IS NOT NULL AND title_key IS NULL
    AND api_name NOT IN ('menu_item_ingredient','pick_list_item','purchase_order_line','stocktake_line');
  IF detail IS NOT NULL THEN
    RAISE EXCEPTION 'ONTOLOGY DRIFT — object type(s) with a backing table and no title key: %. Foundry requires one; derive it if no column reads as a name.', detail;
  END IF;

  -- A title key naming a property that does not exist is a dangling display name.
  SELECT string_agg(o.api_name || '.' || o.title_key, ', ') INTO detail
  FROM public.object_types o
  WHERE o.title_key IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(o.properties) p WHERE p->>'key' = o.title_key);
  IF detail IS NOT NULL THEN
    RAISE EXCEPTION 'ONTOLOGY DRIFT — title key(s) naming no property: %', detail;
  END IF;

  RAISE NOTICE 'ontology drift OK — % built-in registrations match their backing tables, every one titled', registered;
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

-- relationship_edges is a view, and a view has no unique constraints — so
-- INSERT ... ON CONFLICT against it is not a slow degradation, it is 42P10 at
-- runtime. Five functions carried that clause from when it was a table, and
-- three were live: restock fulfilment, POS ingestion, stocktake commit. Dedup
-- belongs to the router now (282). The `\s*\(` is load-bearing —
-- relationship_edges is a prefix of relationship_edges_store, where the same
-- clause is correct.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO bad
  FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
  WHERE nsp.nspname = 'public' AND p.prokind = 'f'
    AND pg_get_functiondef(p.oid) ~* 'INSERT INTO\s+(public\.)?relationship_edges\s*\([^;]*ON CONFLICT';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'EDGE WRITE DRIFT — ON CONFLICT against the relationship_edges view throws 42P10: %', bad;
  END IF;
  RAISE NOTICE 'edge writes OK — nobody guards the view with a constraint it cannot have';
END $$;

-- A link registered and not projected is "a registration, not a relationship" —
-- the failure this whole arc kept finding. Since 295 the view is GENERATED from
-- link_types, so the two cannot drift by hand; this asserts it, and catches a
-- link whose backing is misconfigured badly enough to emit nothing.
-- Deliberate withholdings (link_types.projected = false) are excluded by the
-- function itself, so receipt_sourced_from stays quiet until its tenancy column
-- is settled.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(format('%s (%s): %s', edge_type, backing_kind, reason), '; ')
    INTO bad FROM unprojected_link_types();
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'LINK PROJECTION DRIFT — %', bad;
  END IF;
  RAISE NOTICE 'link projection OK — every projected link type surfaces in relationship_edges';
END $$;

-- A vocabulary name with a same-named foreign-key column behind it, and no
-- link_types row, is a relationship the schema already holds and the ontology
-- cannot traverse. That was rejected_by's state: approved_by was a first-class
-- link on the same table while rejected_by fell through to the generic store,
-- and nothing noticed because no request had ever been rejected.
-- Narrow by construction — it matches column NAMES, so belongs_to_session
-- (backed by session_id) slipped past it and needed an audit instead.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(format('%s <- %s', edge_type, backing), '; ') INTO bad
    FROM unbacked_vocabulary();
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'UNBACKED VOCABULARY — the column exists and the link does not: %', bad;
  END IF;
  RAISE NOTICE 'vocabulary OK — no edge type has a same-named column without a link';
END $$;
