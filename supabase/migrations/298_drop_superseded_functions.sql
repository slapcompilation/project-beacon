-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 298 — delete what "superseded" was a polite word for.
--
-- 293 declared sixteen functions intentional_unreachable, and the reasons were
-- not all the same kind of thing. Seeds and migration helpers are genuinely
-- meant to have no caller. Six of them said "superseded", which is a euphemism:
-- an exemption that says "nothing should ever call this again" is describing
-- dead code, and declaring dead code is how it survives an audit.
--
--   get_cost_at              point-in-time cost; variant.unit_cost series (292)
--   get_node_set             pre-ontology graph reader; object sets replaced it
--   get_node_edges           pre-ontology graph reader; searchAround replaced it
--   simulate_scenario        the TypeScript sim in _shared/scenario-sim.ts runs
--   notify_restock_approved  no caller since the queue rework
--   get_eval_case_runs       the eval UI reads agent_eval_case_runs directly
--
-- Verified unreferenced before dropping, not assumed: no other function, no
-- trigger, no policy, no CHECK constraint, no cron command, and no .rpc() call
-- anywhere in apps/, packages/ or supabase/. The one near-miss was worth the
-- check — `simulate_scenario` appears three times in copilot-chat, all of them
-- the LLM TOOL of that name, which invokes the edge function rather than this.
--
-- install_ontology_package loses its exemption for the opposite reason: Phase A
-- gave it the Portability card, so it is reachable and no longer needs one. A
-- stale exemption is drift too, so 299 teaches the ratchet to catch that.
--
-- get_contract_price and update_learned_thresholds are deliberately KEPT and
-- still exempt. Both say "awaiting a consumer", which is a weaker position than
-- the six above and a stronger one than dead: they encode logic nobody has
-- rewritten. Left as a judgement for whoever picks up the contracts and
-- threshold arcs, and named here so the choice is visible rather than implied.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.get_cost_at(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.get_node_set(text, uuid[], uuid, text, text, text);
DROP FUNCTION IF EXISTS public.get_node_edges(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.simulate_scenario(text, numeric, uuid[]);
DROP FUNCTION IF EXISTS public.notify_restock_approved();
DROP FUNCTION IF EXISTS public.get_eval_case_runs(text, text);

DELETE FROM public.shape_registry
 WHERE object_kind = 'function'
   AND object_name IN ('get_cost_at','get_node_set','get_node_edges',
                       'simulate_scenario','notify_restock_approved','get_eval_case_runs',
                       -- reachable since Phase A wired the Portability card
                       'install_ontology_package');

-- ── Assert the deletions are total ──────────────────────────────────────────

DO $$
DECLARE alive text; stale text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO alive
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('get_cost_at','get_node_set','get_node_edges',
                      'simulate_scenario','notify_restock_approved','get_eval_case_runs');
  IF alive IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 298: still present after DROP: %', alive;
  END IF;

  -- An exemption for a function that no longer exists is the next kind of rot.
  SELECT string_agg(r.object_name, ', ') INTO stale
  FROM shape_registry r
  WHERE r.object_kind = 'function'
    AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname = r.object_name);
  IF stale IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 298: exemption(s) for functions that do not exist: %', stale;
  END IF;

  RAISE NOTICE 'Migration 298: 6 superseded functions dropped, % exemptions remain',
    (SELECT count(*) FROM shape_registry WHERE object_kind = 'function');
END $$;

COMMIT;
