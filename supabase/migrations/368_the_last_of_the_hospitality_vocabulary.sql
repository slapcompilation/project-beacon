-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 368 — twenty-four values whose last reader was the domain.
--
-- Three CHECK constraints, one treatment each:
--
--   relationship_edges_store — thirteen link names left. Every one was written
--     by a dropped trigger or a deleted tool: approved_by and rejected_by by
--     trg_restock_approval_edges, sourced_from by the projection's hard-coded
--     product_variants branch, the rest by the action layer. This empties the
--     edge vocabulary. That is correct rather than drastic: link_types has been
--     the authority since migration 256 and it has no rows, so no edge type is
--     valid until one is registered. C25 still holds — the CHECK exists and
--     refuses anything.
--
--   notifications — three alert kinds about depletion, occupancy and theft.
--
--   proposal_outcomes — eight outcomes describing restock quality
--     (approved_fulfilled, dismissed_wrong_supplier…). The TABLE stays because
--     proposals are AIP-native, but these particular verdicts were inventory's.
--
-- An empty vocabulary is a real state and the guard is right to have driven us
-- to it. What it means: the first link type someone registers must extend this
-- CHECK, which is the hard-coding that migration 260 already flagged and no
-- migration has yet fixed. That is now the loudest remaining debt.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  specs text[][] := ARRAY[
    ARRAY['relationship_edges_store','relationship_edges_edge_type_check'],
    ARRAY['notifications','notifications_type_check'],
    ARRAY['proposal_outcomes','proposal_outcomes_outcome_check']
  ];
  dead jsonb := jsonb_build_object(
    'relationship_edges_edge_type_check',
      '["causes","belongs_to_session","triggered_alert","approved_by","rejected_by","fulfills","sourced_from","batch_of","discarded_via","linked_to_po","invoiced_by","influenced_by_occupancy","derived_from"]'::jsonb,
    'notifications_type_check',
      '["accelerated_depletion","occupancy_spike","theft_alert"]'::jsonb,
    'proposal_outcomes_outcome_check',
      '["approved_fulfilled","approved_excess_waste","dismissed_not_needed","dismissed_wrong_qty","dismissed_wrong_timing","dismissed_wrong_supplier","dismissed_other","auto_approved"]'::jsonb
  );
  i int; v text; def text; n bigint; col text;
BEGIN
  FOR i IN 1 .. array_length(specs, 1) LOOP
    SELECT pg_get_constraintdef(c.oid) INTO def
      FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = t.relnamespace
     WHERE ns.nspname='public' AND t.relname = specs[i][1] AND c.conname = specs[i][2];
    IF def IS NULL THEN
      RAISE EXCEPTION 'Migration 368: % is not there to edit', specs[i][2];
    END IF;

    FOR v IN SELECT jsonb_array_elements_text(dead -> specs[i][2]) LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %s = $1', specs[i][1],
                     CASE WHEN specs[i][1] = 'relationship_edges_store' THEN 'edge_type'
                          WHEN specs[i][1] = 'notifications' THEN 'type'
                          ELSE 'outcome' END)
        INTO n USING v;
      IF n > 0 THEN
        RAISE EXCEPTION 'Migration 368: % row(s) still hold %', n, v;
      END IF;
      def := replace(def, '''' || v || '''::text, ', '');
      def := replace(def, ', ''' || v || '''::text', '');
      def := replace(def, '''' || v || '''::text', '');
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', specs[i][1], specs[i][2]);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', specs[i][1], specs[i][2], def);
  END LOOP;
END $$;

-- C25 asserts the database REFUSES an unknown edge type. With an empty list it
-- refuses every one, which is what an empty link_types means.
DO $$
DECLARE raised boolean := false;
BEGIN
  BEGIN
    INSERT INTO relationship_edges_store (hotel_id, edge_type, source_type, source_id, target_type, target_id)
    VALUES (gen_random_uuid(), 'anything_at_all', 'x', gen_random_uuid(), 'y', gen_random_uuid());
  EXCEPTION WHEN others THEN raised := true;
  END;
  IF NOT raised THEN
    DELETE FROM relationship_edges_store WHERE edge_type = 'anything_at_all';
    RAISE EXCEPTION 'Migration 368: the edge CHECK stopped refusing unknown types';
  END IF;
END $$;

COMMIT;
