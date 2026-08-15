-- `published_at` becomes a real instant.
--
-- 536 made PUBLISH_TIME resolution real — "To resolve the most recently
-- published version instead ... set `latestVersionResolution` to
-- `PUBLISH_TIME`" — and then a test caught that it could not tell two versions
-- apart. `function_versions.published_at` defaulted to `now()`, which is the
-- TRANSACTION's start time, so every version published in one transaction
-- carries the same instant and "most recently published" falls through to the
-- tiebreak, which is a row id and means nothing to a user.
--
-- This is the same trap 496 hit on the build ledger, and the same fix:
-- `clock_timestamp()` advances within a transaction, `now()` does not. A
-- publication time is a record of when something happened, so it takes the
-- clock that moves.
--
-- Only this column changes. `functions.created_at` and `job_specs.published_at`
-- have the same default and are left alone deliberately — nothing orders by
-- them, and a column whose exact instant no one reads is better left matching
-- the transaction it belongs to.
--
-- Existing rows are not rewritten. Their times are what they were, and
-- inventing sub-second spacing for versions published months ago would be
-- fabricating a history to make an ordering look better than it is.

ALTER TABLE public.function_versions
  ALTER COLUMN published_at SET DEFAULT clock_timestamp();

COMMENT ON COLUMN public.function_versions.published_at IS
  'When this version was published, on the wall clock rather than the transaction clock — PUBLISH_TIME resolution orders by it, so two versions published in one transaction must not share an instant.';

-- ── assertions, which run ───────────────────────────────────────────────────
DO $do$
DECLARE ont uuid; fid uuid; n int; sig jsonb := '{"parameters":[],"returns":"Integer"}'::jsonb;
BEGIN
  SELECT o.id INTO ont FROM public.ontologies o LIMIT 1;
  BEGIN
    INSERT INTO public.functions (ontology_id, api_name, display_name)
    VALUES (ont, 'probe537', 'Probe 537') RETURNING id INTO fid;
    -- Two publications, one transaction. Under `now()` these tie.
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature)
    VALUES (fid, 1, 0, 0, 'export default () => 1', sig);
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature)
    VALUES (fid, 1, 0, 1, 'export default () => 2', sig);

    SELECT count(DISTINCT published_at) INTO n
      FROM public.function_versions WHERE function_id = fid;
    IF n <> 2 THEN
      RAISE EXCEPTION 'two versions published in one transaction share an instant; PUBLISH_TIME cannot order them';
    END IF;

    -- And the mode now answers with the one published last.
    IF (SELECT public.function_version_string(major, minor, patch, prerelease)
          FROM public.function_versions
         WHERE id = public.function_latest_version(fid, 'PUBLISH_TIME')) <> '1.0.1' THEN
      RAISE EXCEPTION 'PUBLISH_TIME did not resolve the version published last';
    END IF;

    RAISE EXCEPTION 'probe-537-done' USING ERRCODE = 'ZZZZZ';
  EXCEPTION WHEN SQLSTATE 'ZZZZZ' THEN NULL;
  END;

  RAISE NOTICE '537: a publication time is when it happened, not when the transaction began';
END $do$;
