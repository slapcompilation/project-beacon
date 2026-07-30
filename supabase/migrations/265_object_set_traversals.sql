-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 265 — a cohort may search around.
--
-- Foundry object sets are "initialized from either an entire object type or
-- another object set variable and then may be optionally filtered ... or
-- optionally pivoted to linked objects via a Search Around"
-- (workshop/concepts-variables). The pivot is part of the SET DEFINITION, not a
-- separate query, so it is stored with the set.
--
-- Depth is capped at 3 in the grammar as well as in code — Foundry's limit fails
-- at runtime, and a set that cannot be answered should not be storable.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.object_sets
  ADD COLUMN IF NOT EXISTS traversals jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.object_set_traversals_valid(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(p) = 'array'
     AND jsonb_array_length(p) <= 3
     AND coalesce(bool_and(
           jsonb_typeof(e) = 'object'
           AND coalesce(e->>'edgeType','') <> ''
           AND coalesce(e->>'direction','') IN ('forward','reverse')
           AND (e->'filters' IS NULL OR jsonb_typeof(e->'filters') = 'array')
         ), true)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END) e;
$$;

COMMENT ON FUNCTION public.object_set_traversals_valid(jsonb) IS
  'Grammar for object_sets.traversals — every element is {edgeType, direction: forward|reverse, filters?}, at most 3 hops (Foundry caps Search Around depth at 3).';

ALTER TABLE public.object_sets DROP CONSTRAINT IF EXISTS object_sets_traversals_shape;
ALTER TABLE public.object_sets
  ADD CONSTRAINT object_sets_traversals_shape CHECK (public.object_set_traversals_valid(traversals));

COMMENT ON COLUMN public.object_sets.traversals IS
  'Search Around chain. The set''s members are of the LAST hop''s type, not the subject type — traversal changes the type of the set.';
