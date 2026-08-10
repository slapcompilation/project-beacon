-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 362 — the shipped-action collision list is empty, because nothing
-- ships.
--
-- `refuse_shipped_action_name()` refuses an authored action type that takes a
-- code-defined action's name. CLAUDE.md states the rule: "A shipped action
-- always wins a name. ADJUST_STOCK cannot be redefined by an organization; the
-- collision is refused at authoring time, not at dispatch."
--
-- The array in that trigger is a GENERATED COPY of actionDescriptors, and
-- `pnpm check:vocabulary` compares the two. actionDescriptors is now empty: the
-- BeaconAction union was forty-two inventory actions (ADJUST_STOCK,
-- REQUEST_RESTOCK, WRITE_OFF, CREATE_PO, UPDATE_MENU_ITEM…) and went with the
-- domain. The guard is right that the copy has drifted.
--
-- The TRIGGER STAYS. The rule it enforces is Foundry's own — an action type is
-- "a set of changes or edits to objects, property values, and links" defined
-- once — and the first action type that ships in code again regenerates this
-- array and is protected from the moment it exists. Dropping the trigger would
-- mean rediscovering the need for it later, which is how the collision bug
-- arrived the first time.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.refuse_shipped_action_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  -- GENERATED from actionDescriptors. Do not edit by hand — regenerate and let
  -- `pnpm check:vocabulary` confirm it. Empty since migration 362: no action
  -- type is defined in code, so no authored name can collide with one.
  shipped text[] := ARRAY[]::text[];
BEGIN
  IF NEW.api_name = ANY(shipped) THEN
    RAISE EXCEPTION 'UserActionTypes:ShippedNameCollision — "%" is a code-defined action and cannot be redefined', NEW.api_name
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $fn$;

DO $$
DECLARE src text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'refuse_shipped_action_name';
  IF src IS NULL THEN
    RAISE EXCEPTION 'Migration 362: the collision guard is missing';
  END IF;
  IF position('REQUEST_RESTOCK' IN src) > 0 THEN
    RAISE EXCEPTION 'Migration 362: the hospitality names survived';
  END IF;

  -- The trigger must still be attached, or the rule is gone rather than empty.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE p.proname = 'refuse_shipped_action_name' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Migration 362: the guard is no longer attached to a table';
  END IF;
END $$;

COMMIT;
