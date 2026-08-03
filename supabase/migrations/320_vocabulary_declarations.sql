-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 320 — declare the CHECK values that are deliberately ahead of their
-- runtime, so the rest can be found.
--
-- The database owns the vocabulary here: widget types, effect types, edge types,
-- lifecycle states and thirty other lists are CHECK constraints rather than
-- conventions. Putting the whole vocabulary in the constraint ahead of the
-- runtime is a decision this arc has been repaid for three times — W1's variable
-- kinds let W3, #478 and the Tabs work land with no schema change at all.
--
-- It has a cost audit-shape cannot see. That ratchet polices TABLES and
-- FUNCTIONS: database objects. A value inside a CHECK is not an object, so a
-- vocabulary entry nothing consumes sits there indefinitely looking official.
-- Three were found by hand, each of which read as a working feature:
--
--   object_set_filter        a variable type the builder OFFERED, nothing read
--   recompute modes          stored, typed, documented, never honoured
--   object_set_aggregation   in the CHECK since W1 with no runtime
--
-- scripts/check-vocabulary.mjs closes that gap. It swept 356 allowed values
-- across 78 constraints and found five with no consumer. This declares the four
-- that are genuinely ahead of their runtime, with the reason each is there.
--
-- A NOTE ON THE METHOD, because the first draft got it wrong: a value can be
-- consumed by DATA rather than code. `one_to_many` appears in no TypeScript and
-- is the stored cardinality of four link types; `many_to_one` of thirty-one.
-- Flagging those would have been a false positive on the first run, and a guard
-- that cries wolf gets switched off. The check counts code, data and declaration.
--
-- The fifth value, shape_registry's `dev`, is not declared here — it was made to
-- MEAN something instead. See the audit-shape change in this commit: a table
-- classified `dev` now fails the ratchet, because a scratch table has no
-- business in a shipped schema. The same commit makes `intentional_unreachable`
-- real: it exempted a function regardless of classification, so the word the
-- error message asks for was decorative.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.shape_registry DROP CONSTRAINT IF EXISTS shape_registry_object_kind_check;
ALTER TABLE public.shape_registry ADD CONSTRAINT shape_registry_object_kind_check
  CHECK (object_kind IN ('table', 'function', 'meta', 'vocabulary'));

COMMENT ON TABLE public.shape_registry IS
  'Where the platform/domain boundary is declared, plus the exemptions that keep the two ratchets honest: functions nothing reaches, and CHECK values nothing consumes.';

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('vocabulary', 'relationship_edges_store.evidenced_by', 'intentional_unreachable',
   'Edge from a typed row back to the document that evidences it. The contract-ingestion arc that writes it is paused on a real contract; the edge type is modelled and the writer is not built.'),

  ('vocabulary', 'link_types.one_to_one', 'intentional_unreachable',
   'The one cardinality with no instance yet — the other three are carried by 39 link types. Foundry models all four, and a cardinality vocabulary missing one is a gap an author would hit while modelling, not while coding.'),

  ('vocabulary', 'data_sources.cdc', 'intentional_unreachable',
   'Change-data-capture ingestion. Modelled with the other source kinds; only webhook and manual ingest are built. See docs/DATA-INTEGRATION-PARITY.'),

  ('vocabulary', 'data_sources.pull', 'intentional_unreachable',
   'Scheduled pull ingestion. Modelled with the other source kinds; only webhook and manual ingest are built.')
ON CONFLICT (object_kind, object_name) DO UPDATE SET reason = EXCLUDED.reason;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM shape_registry WHERE object_kind = 'vocabulary';
  IF n <> 4 THEN
    RAISE EXCEPTION 'Migration 320: expected 4 vocabulary declarations, found %', n;
  END IF;

  -- Every declaration must name a real table, or it is a claim about a schema
  -- that no longer exists.
  IF EXISTS (
    SELECT 1 FROM shape_registry r
    WHERE r.object_kind = 'vocabulary'
      AND split_part(r.object_name, '.', 1) NOT IN (
        SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname = 'public' AND c.relkind = 'r')
  ) THEN
    RAISE EXCEPTION 'Migration 320: a vocabulary declaration names a table that does not exist';
  END IF;

  -- And `dev` must NOT be declared: it was given a meaning instead.
  IF EXISTS (SELECT 1 FROM shape_registry
             WHERE object_kind = 'vocabulary' AND object_name = 'shape_registry.dev') THEN
    RAISE EXCEPTION 'Migration 320: dev was meant to be enforced, not exempted';
  END IF;
END $$;

COMMIT;
