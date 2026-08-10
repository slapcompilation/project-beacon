-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 380 — object_type_impact goes, and 376 was wrong to restore it.
--
-- 376 brought it back on the claim that "Foundry does impact analysis on an
-- ontology resource". That claim was never checked. Grepping the mirror for
-- "impact analysis" returns exactly one page —
-- `building-pipelines/create-batch-pipeline-cr.md` — which is about change
-- requests on a PIPELINE, not about object types.
--
-- So it was ours: a pre-flight "what breaks if I delete this" built because we
-- wanted it, dressed in a citation after the fact. The rule this repo runs on is
-- that a plausible shape must not become structure, and a citation nobody reads
-- is how it does.
--
-- 373 had already dropped it correctly, for the wrong reason. This drops it for
-- the right one.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.object_type_impact(uuid, text[]) CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname='public' AND p.proname='object_type_impact') THEN
    RAISE EXCEPTION 'Migration 380: object_type_impact survived';
  END IF;
END $$;

COMMIT;
