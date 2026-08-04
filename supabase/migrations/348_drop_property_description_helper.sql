-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 348 — remove the helper 347 used, which nothing calls.
--
-- `set_property_description` was scaffolding: it let 347 rewrite one property's
-- description without disturbing the rest of the jsonb array. Once the
-- descriptions were written it had no caller, and `pnpm check:shape` said so —
-- "function set_property_description is reachable by nothing — give it a
-- consumer, delete it, or declare it intentional_unreachable."
--
-- Deleting is the right one of the three. A future migration that needs the
-- same rewrite can define it again in its own transaction; leaving it behind
-- would be a public SECURITY INVOKER function with no owner, which is how a
-- surface area grows without anyone deciding to grow it.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.set_property_description(text, text, text);

DO $$
DECLARE n int;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
              WHERE ns.nspname = 'public' AND p.proname = 'set_property_description') THEN
    RAISE EXCEPTION 'Migration 348: the helper survived';
  END IF;

  -- What it wrote must outlive it.
  SELECT count(*) INTO n FROM object_types o, jsonb_array_elements(o.properties) p
   WHERE p ? 'description' AND btrim(p->>'description') <> '';
  IF n <> 21 THEN RAISE EXCEPTION 'Migration 348: expected 21 described properties, found %', n; END IF;
END $$;

COMMIT;
