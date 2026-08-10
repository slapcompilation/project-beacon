-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 361 — the edge functions went, and two link names went with them.
--
-- `similar_to` was written by compute-similar-variants: a hospitality job that
-- found substitute stock items. `influenced_by_principle` was written by the
-- deleted cycle, recording that an operator principle shaped a proposal.
--
-- Neither has a row in link_types (the ontology is empty since 353), neither has
-- a row in the store, and now neither has code. That is all three of the
-- guard's tests failing at once, which is the definition it uses.
--
-- The learning loop that `influenced_by_principle` served is real and is
-- described in CLAUDE.md, but it is OURS rather than Foundry's, and the rule for
-- ours is that it needs a consumer today. When it is rebuilt it registers a link
-- type properly and the vocabulary follows from that row — which is the whole
-- point of link_types being the authority.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  dead text[] := ARRAY['similar_to','influenced_by_principle'];
  v text; def text; n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.relationship_edges_store WHERE edge_type = ANY(dead);
  IF n > 0 THEN RAISE EXCEPTION 'Migration 361: % row(s) still hold a retired name', n; END IF;

  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname='public' AND t.relname='relationship_edges_store'
     AND c.conname='relationship_edges_edge_type_check';
  IF def IS NULL THEN RAISE EXCEPTION 'Migration 361: the edge_type CHECK is missing'; END IF;

  FOREACH v IN ARRAY dead LOOP
    IF position('''' || v || '''::text' IN def) = 0 THEN
      RAISE EXCEPTION 'Migration 361: the CHECK does not list %', v;
    END IF;
    def := replace(def, '''' || v || '''::text, ', '');
    def := replace(def, ', ''' || v || '''::text', '');
  END LOOP;

  EXECUTE 'ALTER TABLE public.relationship_edges_store DROP CONSTRAINT relationship_edges_edge_type_check';
  EXECUTE 'ALTER TABLE public.relationship_edges_store ADD CONSTRAINT relationship_edges_edge_type_check ' || def;
END $$;

DO $$
DECLARE def text; v text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname='public' AND t.relname='relationship_edges_store'
     AND c.conname='relationship_edges_edge_type_check';
  IF def IS NULL THEN RAISE EXCEPTION 'Migration 361: the CHECK did not come back'; END IF;

  FOREACH v IN ARRAY ARRAY['similar_to','influenced_by_principle'] LOOP
    IF position('''' || v || '''::text' IN def) > 0 THEN
      RAISE EXCEPTION 'Migration 361: % survived', v;
    END IF;
  END LOOP;
  IF position('''sourced_from''::text' IN def) = 0 THEN
    RAISE EXCEPTION 'Migration 361: the rewrite took sourced_from with it';
  END IF;
END $$;

COMMIT;
