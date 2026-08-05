-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 371 — two more concepts the mirror does not carry.
--
--   "action chain"  0 pages
--   "entity link"   0 pages
--
-- Entity EXTRACTION is Foundry's — `mirror/pipeline-builder/pipeline-builder-llm.md`
-- covers it, and the `entities` table stays. What went is the SUGGESTION REVIEW
-- workflow we built on top: a queue of proposed entity→object links for an
-- operator to approve. That is ours.
--
-- Proposals stay, and the check that settled it is worth recording because the
-- word is common: `mirror/logic/aip-logic-integration-automate.md` — "you can
-- see an overview of Agent proposals that were generated and require a review
-- by navigating to the Proposals tab". proposal_outcomes goes with it though:
-- it fed the calibration report, and calibration has no page either.
--
-- document-ingest no longer calls entity-extract; ingestion settles at the
-- embedded stage and the edge function is deleted.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  doomed text[] := ARRAY['action_chains','entity_link_suggestions','proposal_outcomes'];
  t text; fn record; n int;
BEGIN
  FOREACH t IN ARRAY doomed LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TABLE public.%I CASCADE', t);
    END IF;
  END LOOP;

  FOR fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.prokind = 'f'
       AND EXISTS (
         SELECT 1 FROM unnest(doomed) d
          WHERE p.prosrc ~ ('(FROM|JOIN|INTO|UPDATE|TABLE)\s+(public\.)?' || d || '\M')
       )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.sig);
  END LOOP;

  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema='public' AND table_name = ANY(doomed);
  IF n > 0 THEN RAISE EXCEPTION 'Migration 371: % table(s) survived', n; END IF;

  FOREACH t IN ARRAY ARRAY['entities','documents','document_chunks','proposals'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name=t) THEN
      RAISE EXCEPTION 'Migration 371: CASCADE took %, which stays', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
