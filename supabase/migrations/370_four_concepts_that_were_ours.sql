-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 370 — Principle, ApprovedAnswer, Case and Constraint.
--
-- CLAUDE.md called these "AIP-native", which put them on the keep side of every
-- cut so far. Grepping the mirror rather than trusting that label:
--
--   "approved answer"  0 pages
--   Principle          no page carries it as a title
--   Case               the only hits are "Use case development" and
--                      quiver/card-to-lower-case
--   Constraint         exists, but as value-type constraints on a property and
--                      project constraints in platform security — neither is a
--                      natural-language rule that gates an action submission
--
-- So all four are ours. The rule for ours is a consumer today, and their web
-- surfaces went with the audit: approvedAnswers, principles, constraints,
-- cases, and the copilot that read them (copilot appears in 0 mirror pages,
-- and its edge function had no caller left).
--
-- proposal_outcomes and proposal_dismissals-style tables already went. Proposals
-- themselves STAY: an agent proposing a typed action for review is the AIP
-- pattern the whole system is built to serve, and the review path is what
-- decideAutoExecution gates.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  doomed text[] := ARRAY['approved_answers','principles','cases','constraints',
                         'link_influenced_by_principle','copilot_conversations',
                         'copilot_messages','copilot_feedback','copilot_tool_configs'];
  t text; fn record; n int;
BEGIN
  FOREACH t IN ARRAY doomed LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TABLE public.%I CASCADE', t);
    END IF;
  END LOOP;

  -- Same lesson as 364: a function body is not dependency-tracked. Match on a
  -- quoted or qualified reference so a comment mentioning "cases" is not enough.
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
  IF n > 0 THEN RAISE EXCEPTION 'Migration 370: % table(s) survived', n; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='proposals') THEN
    RAISE EXCEPTION 'Migration 370: CASCADE took proposals, which stay';
  END IF;
END $$;

COMMIT;
