-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 374 — the vocabulary the approximations were holding up.
--
-- Fourteen values, one stale declaration. Each lost its last consumer when the
-- layer above it went:
--
--   edge types      reverts, benchmarks, describes_entity, resolved_to — the
--                   last four names, written by the action layer and document
--                   ingestion. relationship_edges_edge_type_check is empty after
--                   this, which is what an empty link_types means.
--   triggered_by    ai_proposal_accepted, ai_auto_approved, automation_threshold,
--                   revert — the audit vocabulary of a gate that no longer runs.
--   cardinality     many_to_many. one_to_one and many_to_one stay DECLARED on
--                   create-link-type.md; many_to_many is documented there too,
--                   so it joins them rather than being dropped.
--
-- The data_sources declaration is stale in the other direction: 373 dropped the
-- table, so the CHECK it named is gone.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  specs jsonb := jsonb_build_object(
    'relationship_edges_edge_type_check',
      jsonb_build_object('tbl','relationship_edges_store','col','edge_type',
        'dead','["reverts","benchmarks","describes_entity","resolved_to"]'::jsonb),
    'relationship_edges_triggered_by_check',
      jsonb_build_object('tbl','relationship_edges_store','col','triggered_by',
        'dead','["ai_proposal_accepted","ai_auto_approved","automation_threshold","revert"]'::jsonb)
  );
  k text; spec jsonb; v text; def text; n bigint;
BEGIN
  FOR k IN SELECT jsonb_object_keys(specs) LOOP
    spec := specs -> k;
    SELECT pg_get_constraintdef(c.oid) INTO def
      FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = t.relnamespace
     WHERE ns.nspname='public' AND t.relname = (spec->>'tbl') AND c.conname = k;
    IF def IS NULL THEN RAISE EXCEPTION 'Migration 374: % is missing', k; END IF;

    FOR v IN SELECT jsonb_array_elements_text(spec->'dead') LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', spec->>'tbl', spec->>'col')
        INTO n USING v;
      IF n > 0 THEN RAISE EXCEPTION 'Migration 374: % row(s) hold %', n, v; END IF;
      def := replace(def, '''' || v || '''::text, ', '');
      def := replace(def, ', ''' || v || '''::text', '');
      def := replace(def, '''' || v || '''::text', '');
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', spec->>'tbl', k);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', spec->>'tbl', k, def);
  END LOOP;
END $$;

-- many_to_many is Foundry's, like the other two: "In a many-to-many cardinality,
-- select a datasource that includes all combinations of links" — create-link-type.md.
INSERT INTO public.shape_registry (object_kind, object_name, classification, reason)
VALUES ('vocabulary', 'link_types.many_to_many', 'intentional_unreachable',
        'Foundry link cardinality (create-link-type.md). Unconsumed only because the ontology is empty; the grammar outlives the content.')
ON CONFLICT (object_kind, object_name) DO UPDATE
  SET classification = EXCLUDED.classification, reason = EXCLUDED.reason;

DELETE FROM public.shape_registry
 WHERE object_kind = 'vocabulary' AND object_name LIKE 'data_sources.%';

DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname='relationship_edges_store' AND c.conname='relationship_edges_edge_type_check';
  IF def IS NULL THEN RAISE EXCEPTION 'Migration 374: the edge CHECK vanished'; END IF;
  IF position('''reverts''' IN def) > 0 THEN RAISE EXCEPTION 'Migration 374: reverts survived'; END IF;
END $$;

COMMIT;
