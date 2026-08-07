-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 353 — the ontology ships empty, because Foundry's does.
--
-- CITATION, since this is the largest deletion in the project's history and it
-- should rest on a sentence rather than a preference.
--
-- `mirror/object-link-types/object-types-overview.md`:
--   "Rather than being an abstract data model, the Foundry Ontology maps each
--    ontological concept to AN ORGANIZATION'S ACTUAL DATA... To create objects
--    of type `Employee`, AN ORGANIZATION WILL ADD backing datasources to the
--    `Employee` object type and connect their employee directory... into the
--    Ontology."
--
-- `mirror/object-link-types/create-object-type.md` opens from "Create your first
-- object type" on the Ontology Manager homepage — the platform starts with none.
--
-- `mirror/ontology/ontology-best-practices.md`, principle 1:
--   "The Ontology models the real world, not the source data. Objects should
--    represent semantically meaningful real-world concepts."
--
-- Foundry ships no `Aircraft`. Fresh Air's ontology has one because Fresh Air
-- built it, and it arrives as an installable Marketplace product rather than as
-- part of the platform (`marketplace-ontology-types.md`). Our 43 registrations
-- were hospitality content shipped inside the platform, which is the one place
-- Foundry never puts a domain.
--
-- Packaging them for reinstallation is the documented path and is deliberately
-- NOT taken here: that belongs after the framework works end to end and there is
-- a proven install workflow. Until then a packaged copy would be an unverified
-- artifact pretending to be a migration path.
--
-- WHAT CASCADES, checked against pg_constraint rather than assumed. Deleting an
-- object type takes with it: link_types on either end, object_records,
-- object_sets, object_type_interfaces, object_type_revisions,
-- time_series_properties, user_action_types and user_tools. data_sources keeps
-- its row with a null type. The single RESTRICT — link_types.backing_object_
-- type_id, for object-backed links — has no rows, so nothing blocks.
--
-- The framework itself is untouched: the tables, the grammar, the guards, the
-- status and promotion machinery, the projection, and every RLS contract remain.
-- What goes is the content that was sitting inside them.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  v_types int; v_links int; v_sets int; v_tools int; v_actions int; v_records int;
BEGIN
  SELECT count(*) INTO v_types   FROM object_types;
  SELECT count(*) INTO v_links   FROM link_types;
  SELECT count(*) INTO v_sets    FROM object_sets;
  SELECT count(*) INTO v_tools   FROM user_tools;
  SELECT count(*) INTO v_actions FROM user_action_types;
  SELECT count(*) INTO v_records FROM object_records;
  RAISE NOTICE 'Migration 353 — before: % object types, % link types, % cohorts, % tools, % action types, % records',
    v_types, v_links, v_sets, v_tools, v_actions, v_records;
END $$;

DELETE FROM public.object_types;

-- The projection is generated from link_types, which the cascade just emptied.
SELECT public.rebuild_relationship_edges_view();

DO $$
DECLARE n int; leftover text;
BEGIN
  SELECT count(*) INTO n FROM object_types;
  IF n <> 0 THEN RAISE EXCEPTION 'Migration 353: % object type(s) survived', n; END IF;

  SELECT count(*) INTO n FROM link_types;
  IF n <> 0 THEN RAISE EXCEPTION 'Migration 353: % link type(s) survived the cascade', n; END IF;

  -- The FRAMEWORK must still be standing. An empty ontology is the goal; a
  -- missing one is a broken migration.
  SELECT string_agg(t, ', ') INTO leftover FROM unnest(ARRAY[
    'object_types','link_types','object_records','object_sets','ontology_interfaces',
    'user_action_types','user_tools','shared_properties','resource_status',
    'object_type_revisions','relationship_edges_store'
  ]) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public' AND c.relname = t);
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 353: framework table(s) missing: %', leftover;
  END IF;

  -- The grammar and its guards outlive the content.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
                  WHERE ns.nspname='public' AND p.proname='builtin_property_drift') THEN
    RAISE EXCEPTION 'Migration 353: the drift guard went with the content';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_status_guard'
                   AND tgrelid = 'public.object_types'::regclass) THEN
    RAISE EXCEPTION 'Migration 353: the status guard went with the content';
  END IF;

  -- The projection must exist and be empty rather than broken.
  SELECT count(*) INTO n FROM relationship_edges;
  RAISE NOTICE 'Migration 353 — after: ontology empty, projection returns % row(s)', n;
END $$;

COMMIT;
