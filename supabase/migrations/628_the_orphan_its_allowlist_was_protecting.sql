-- `time_series_properties` goes, and the interesting part is WHY it survived.
--
-- It was created in 276, before the teardown. 379 kept it, and said so plainly:
-- "Declared rather than deleted, on the same reasoning as link cardinality in
-- 355: the grammar of a property base type outlives the absence of any property
-- using it." The mechanism that carried that declaration was `shape_registry`,
-- which 379 wrote two rows into.
--
-- **`shape_registry` has since been deleted**, together with `check:shape` and
-- `check:vocabulary`, for a reason this repository stated in general terms:
-- they needed an allowlist to tell "deliberately ahead of its runtime" from
-- "dead", and wanting an allowlist is the signal to index instead. The
-- allowlist went. The thing it was excusing did not, and nobody noticed because
-- nothing was left that could notice.
--
-- MEASURED BEFORE DELETING, not assumed:
--
--   rows                                    0
--   foreign keys referencing it             0
--   functions reading it                    0
--   views reading it                        0
--   `Time series` among property_base_types no  (22 of them, and it is not one)
--   properties with a series base type      0
--
-- and its three appearances in the TypeScript are all comments calling it an
-- orphan: `authoring.ts` describes it as an orphan of the deleted product with
-- zero rows, no surface, and no datasource kind backing a series. So nothing
-- anywhere reads it, and no property could be a time series even if something
-- did.
--
-- IT IS ALSO NOT BUILT THE WAY FOUNDRY BUILDS IT, which is the test that
-- matters rather than whether Foundry has one. Ours registers a raw
-- `source_table` plus an `entity_column`, a `time_column` and a `value_column`
-- — a table name in a column, which is the generic-table shape this repository
-- has deleted three times. Foundry's is a product: `time-series/` is
-- **42 mirrored pages**, none of them read, covering syncs, derived series,
-- function-backed series, geospatial series and alerting. `base-types` gives
-- the property one line and links straight out to it.
--
-- So this is the half-built version the standing rule is about: it looks like a
-- foundation and is not one. Deleting it costs nothing — there is nothing to
-- lose but the shape — and reading those 42 pages is what building it means.
--
-- WHAT IS NOT DELETED, and the difference is the point. `proposal_reviewers`
-- came up in the same sweep with no SQL reader, but its siblings
-- `proposal_reviews` and `proposal_tasks` have two and four; it is an unreached
-- member of a LIVE feature built after the teardown (420), not a survivor of
-- the deleted one. Unreached is a question; unbuildable-and-unbuilt is an
-- answer. Recorded rather than dropped.

-- Refuse to run if any of the premises stopped being true. A DROP that finds
-- something is a DROP that should not happen.
DO $$
DECLARE v_rows int; v_fks int; v_fns int;
BEGIN
  IF to_regclass('public.time_series_properties') IS NULL THEN
    RAISE NOTICE 'already gone';
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.time_series_properties' INTO v_rows;
  SELECT count(*) INTO v_fks FROM pg_constraint
   WHERE confrelid = 'public.time_series_properties'::regclass;
  SELECT count(*) INTO v_fns FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ~ '\mtime_series_properties\M';

  IF v_rows <> 0 OR v_fks <> 0 OR v_fns <> 0 THEN
    RAISE EXCEPTION 'not an orphan any more: % row(s), % foreign key(s), % function(s) — 628 refuses to drop it',
      v_rows, v_fks, v_fns;
  END IF;

  -- And the allowlist that excused it really is gone; if it came back, this
  -- deletion wants re-arguing rather than repeating.
  IF to_regclass('public.shape_registry') IS NOT NULL THEN
    RAISE EXCEPTION 'shape_registry exists again — 628''s reasoning is stale';
  END IF;
END $$;

DROP TABLE IF EXISTS public.time_series_properties;

-- Gone, and gone completely: a table drop takes its policies and indexes, but
-- says nothing about a leftover type or grant, so ask rather than assume.
DO $$
DECLARE v_left int;
BEGIN
  IF to_regclass('public.time_series_properties') IS NOT NULL THEN
    RAISE EXCEPTION 'the table is still here';
  END IF;
  SELECT count(*) INTO v_left FROM pg_policies WHERE tablename = 'time_series_properties';
  IF v_left <> 0 THEN
    RAISE EXCEPTION '% policy(ies) survived the table', v_left;
  END IF;
  RAISE NOTICE 'time_series_properties dropped, with its two policies; 22 base types unchanged and none of them is a series';
END $$;

-- The one thing this must NOT have changed.
DO $$
DECLARE v_n int;
BEGIN
  SELECT array_length(public.property_base_types(), 1) INTO v_n;
  IF v_n <> 22 THEN
    RAISE EXCEPTION 'the base type vocabulary moved: % types, expected 22', v_n;
  END IF;
  RAISE NOTICE 'the twenty-two base types are untouched';
END $$;
