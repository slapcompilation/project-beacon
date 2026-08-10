-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 355 — many_to_one is Foundry's word, waiting for a link type.
--
-- `pnpm check:vocabulary` is right that nothing consumes it: migration 353
-- emptied the ontology, so the only evidence this value ever had — rows in
-- link_types — went with it. A value whose only proof is data disappears when
-- the data does.
--
-- It is not ours to delete, though. `mirror/object-link-types/create-link-type.md`:
--
--   "Object type foreign keys: Supports 'one-to-one' and 'many-to-one'
--    cardinality link types."
--
--   "In a many-to-many cardinality, select a datasource that includes all
--    combinations of links between the primary key of the first object type and
--    the second."
--
-- Cardinality is part of the link-type grammar, not domain content. Removing it
-- from the CHECK would mean the first link type anyone creates could not declare
-- the commonest shape there is.
--
-- Declared rather than consumed, using the guard's own third option. The other
-- three values survive because code still references them; this one is the
-- casualty of an empty ontology and returns to being consumed the moment a link
-- type exists.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason)
VALUES ('vocabulary', 'link_types.many_to_one', 'intentional_unreachable',
        'Foundry link cardinality (create-link-type.md). Unconsumed only because migration 353 emptied the ontology; the grammar outlives the content.')
ON CONFLICT (object_kind, object_name) DO UPDATE
  SET classification = EXCLUDED.classification, reason = EXCLUDED.reason;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shape_registry
                  WHERE object_kind='vocabulary' AND object_name='link_types.many_to_one') THEN
    RAISE EXCEPTION 'Migration 355: the declaration did not land';
  END IF;
END $$;

COMMIT;
