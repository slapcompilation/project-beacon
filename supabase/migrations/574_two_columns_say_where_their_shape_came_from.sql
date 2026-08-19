-- Two columns whose shape is ours, and neither of them says so.
--
-- Both surfaced in the 2026-08-19 gap run. Neither is a defect in behaviour —
-- they are defects in *provenance*, which is the thing this repo is most
-- careful about, because an unmarked invention is indistinguishable from a
-- documented one six months later.
--
-- Applied migrations are immutable, so 265 and 276 cannot be annotated in
-- place. The catalog can: a column comment is where the next reader looks, and
-- it travels with the schema instead of with a file nobody opens.
--
-- ── 1. object_sets.traversals — the per-hop shape is inferred ──────────────
-- The comment says what a traversal MEANS and not where the JSON came from.
-- `{"edgeType":…,"direction":"forward|reverse","filters":…}` appears in no
-- mirrored page: Foundry expresses direction implicitly, through a distinct
-- generated method per link (`searchAroundPassengers()`), not a field.
--
-- The tell is a sibling. `object_set_filters_valid`, in the SAME validator
-- family, marks its own invention plainly — 475's header calls MUST_NOT_HAVE
-- "our name for the" negated match — while 265's traversal grammar is marked
-- nowhere. One of the two was honest and the other was silent, for no reason
-- beyond who wrote it and when.
--
-- ── 2. time_series_properties.negate — and a near-miss worth recording ─────
-- 276 invented `negate` to avoid an injection surface, and never claimed a
-- citation. The gap run proposed backfilling one, on the grounds that
-- `metadata-typeclasses` publishes a converging field:
--
--   "timeseries_is_value_inverted | When set to true, this boolean property
--    will automatically invert the y-axis values of a timeseries in Quiver,
--    such that values ascend going down."
--
-- **They are not the same thing, and attaching that citation would have been
-- the exact failure this repo was rebuilt around.** Foundry's field is a RENDER
-- HINT: it flips an axis in a charting tool and the stored values are untouched.
-- Ours is a DATA TRANSFORM: `CASE WHEN s.negate THEN '-' END` prepends a minus
-- to the value column inside the generated SQL, so every caller — chart or not —
-- receives negated numbers.
--
-- A citation that is nearly right is worse than none, because it stops the next
-- person looking. So the comment records the convergence AND the difference, and
-- `negate` stays marked as ours.

BEGIN;

COMMENT ON COLUMN public.object_sets.traversals IS
  'Search Around chain. The set''s members are of the LAST hop''s type, not the subject type — traversal changes the type of the set. INFERENCE: the per-hop shape (edgeType, direction forward|reverse, filters) is ours and appears in no mirrored page — Foundry expresses direction implicitly through a distinct generated method per link, not a field. Marked because the sibling invention in the same validator family (MUST_NOT_HAVE, 475) is marked and this one was not.';

COMMENT ON COLUMN public.time_series_properties.negate IS
  'OURS, not Foundry''s: negates the value inside the generated SQL, so every reader gets negated numbers. Foundry''s nearest field, the timeseries_is_value_inverted type class, is a RENDER HINT that inverts a chart''s y-axis and leaves the data alone — converging in name, different in kind. Recorded so the citation is not backfilled onto it.';

-- ── assertions: the comments exist, and say which is which ─────────────────
DO $do$
DECLARE c text;
BEGIN
  SELECT col_description(k.oid, a.attnum) INTO c
    FROM pg_class k JOIN pg_attribute a ON a.attrelid = k.oid
    JOIN pg_namespace n ON n.oid = k.relnamespace
   WHERE n.nspname = 'public' AND k.relname = 'object_sets' AND a.attname = 'traversals';
  IF c IS NULL OR c NOT LIKE '%INFERENCE%' THEN
    RAISE EXCEPTION 'the traversal shape is still unmarked';
  END IF;
  -- The meaning the old comment carried must survive the rewrite.
  IF c NOT LIKE '%LAST hop%' THEN
    RAISE EXCEPTION 'the rewrite dropped what a traversal means';
  END IF;

  SELECT col_description(k.oid, a.attnum) INTO c
    FROM pg_class k JOIN pg_attribute a ON a.attrelid = k.oid
    JOIN pg_namespace n ON n.oid = k.relnamespace
   WHERE n.nspname = 'public' AND k.relname = 'time_series_properties' AND a.attname = 'negate';
  IF c IS NULL OR c NOT LIKE '%OURS%' OR c NOT LIKE '%RENDER HINT%' THEN
    RAISE EXCEPTION 'negate does not record both that it is ours and why the near-match is not it';
  END IF;

  RAISE NOTICE '574: two columns say where their shape came from';
END $do$;

COMMIT;
