-- Kill RPC param-creep (corrections backlog #4).
--
-- adjust_stock and receive_restock each accreted prefix-nested overloads as new
-- params were added by successive migrations (adjust_stock: 3/4/6-arg;
-- receive_restock: 4/5/6/7-arg). Overloads with all-defaulted trailing params are
-- fragile — a call with an intermediate arg count can resolve ambiguously — and
-- the older bodies drift from the canonical one.
--
-- Verified before dropping (live):
--   • Every app call routes to the WIDEST overload via PostgREST's key-set match:
--       adjust_stock — all 3 call sites send 5–6 keys → 6-arg overload;
--       receive_restock — the one call site sends 7 keys → 7-arg overload.
--   • No DB routine calls either function (batch_stocktake only references
--     adjust_stock in a comment; it inlines its own logic).
-- So the narrower overloads are unreachable dead code carrying stale bodies.
-- Dropping them leaves one canonical signature each (trailing params defaulted),
-- which satisfies every shorter call and removes the ambiguity.

BEGIN;

DROP FUNCTION IF EXISTS public.adjust_stock(uuid, integer, text);
DROP FUNCTION IF EXISTS public.adjust_stock(uuid, integer, text, text);

DROP FUNCTION IF EXISTS public.receive_restock(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.receive_restock(uuid, integer, text, text, numeric);
DROP FUNCTION IF EXISTS public.receive_restock(uuid, integer, text, text, numeric, date);

COMMIT;
