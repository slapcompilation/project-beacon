-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 336 — drop get_node_context, whose only caller was dead code.
--
-- Found by two guards composing, which is worth recording because neither would
-- have caught it alone:
--
--   check:surfaces deleted 22 web files nothing could reach from main.tsx.
--   check:shape then reported get_node_context as reachable by nothing.
--
-- The RPC was only ever called from `useGraph.ts`, which was itself unreachable
-- — so it had looked "consumed" for as long as its consumer was dead. Removing
-- the dead UI exposed the orphan underneath it.
--
-- It walked relationship_edges outward from a node for N hops. Nothing needs
-- that today: `searchAround` in reality-graph does graph traversal in one
-- implementation shared by browser and edge functions, which is where traversal
-- belongs. Dropping rather than declaring it intentional — a declaration is for
-- something deliberately ahead of its runtime, and this is behind it.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.get_node_context(text, uuid, integer);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'get_node_context') THEN
    RAISE EXCEPTION 'Migration 336: get_node_context is still present';
  END IF;
END $$;

COMMIT;
