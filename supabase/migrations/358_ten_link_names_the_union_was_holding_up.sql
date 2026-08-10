-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 358 — the edge vocabulary loses what only the TypeScript union kept.
--
-- `EdgeType` was a union of forty-three hospitality verbs restating this CHECK
-- in TypeScript. CLAUDE.md already called the database the authority and warned
-- the union "drifts if edited alone". It has now become `EdgeType = string`: the
-- api name of a link type, resolved against link_types at runtime, which is what
-- Foundry names too — a link type is "a relationship between object types"
-- defined in the ontology, not an enum in the platform
-- (`mirror/object-link-types/link-types-overview.md`).
--
-- Ten values were being kept alive by that union alone. With it gone they have
-- no code, no row, no policy and no function:
--
--   proposed_by, harmonized_to, applies_to, ingredient_of, line_of, line_orders,
--   discrepancy_of, item_of, categorised_as, allocated_to
--
-- The rest of the list stays for now, and honestly: values like approved_by and
-- rejected_by still have live writers (trg_restock_approval_edges,
-- auto_approve_eligible_restocks, and edgesForAction's provenance writes). They
-- go when those writers go — removing the name while something still inserts it
-- would turn a teardown into an outage.
--
-- The store is empty, so no row can contradict the narrower list.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  dead text[] := ARRAY['proposed_by','harmonized_to','applies_to','ingredient_of','line_of',
                       'line_orders','discrepancy_of','item_of','categorised_as','allocated_to'];
  v text;
  def text;
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.relationship_edges_store WHERE edge_type = ANY(dead);
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 358: % row(s) still hold one of the retired names', n;
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname = 'public' AND t.relname = 'relationship_edges_store'
     AND c.conname = 'relationship_edges_edge_type_check';
  IF def IS NULL THEN
    RAISE EXCEPTION 'Migration 358: the edge_type CHECK is not there to edit';
  END IF;

  -- Edit the definition just read rather than retyping forty names, and match
  -- the quoted form so `line_of` cannot also strike `line_orders`.
  FOREACH v IN ARRAY dead LOOP
    IF position('''' || v || '''::text' IN def) = 0 THEN
      RAISE EXCEPTION 'Migration 358: the CHECK does not list %', v;
    END IF;
    def := replace(def, '''' || v || '''::text, ', '');
    def := replace(def, ', ''' || v || '''::text', '');
  END LOOP;

  EXECUTE 'ALTER TABLE public.relationship_edges_store DROP CONSTRAINT relationship_edges_edge_type_check';
  EXECUTE 'ALTER TABLE public.relationship_edges_store ADD CONSTRAINT relationship_edges_edge_type_check ' || def;
END $$;

DO $$
DECLARE
  def text;
  survivors text[] := ARRAY['consumes','restocks','approved_by','rejected_by','sourced_from','line_fulfills_request'];
  v text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname = 'public' AND t.relname = 'relationship_edges_store'
     AND c.conname = 'relationship_edges_edge_type_check';

  IF def IS NULL THEN RAISE EXCEPTION 'Migration 358: the CHECK did not come back'; END IF;

  FOREACH v IN ARRAY ARRAY['proposed_by','harmonized_to','applies_to','ingredient_of','line_of',
                           'line_orders','discrepancy_of','item_of','categorised_as','allocated_to'] LOOP
    IF position('''' || v || '''::text' IN def) > 0 THEN
      RAISE EXCEPTION 'Migration 358: % survived the rewrite', v;
    END IF;
  END LOOP;

  -- A neighbour lost to a sloppy replace would otherwise be silent, and
  -- line_fulfills_request shares a prefix with line_of and line_orders.
  FOREACH v IN ARRAY survivors LOOP
    IF position('''' || v || '''::text' IN def) = 0 THEN
      RAISE EXCEPTION 'Migration 358: the rewrite took % with it', v;
    END IF;
  END LOOP;
END $$;

COMMIT;
