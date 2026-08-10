-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 343 — the last untyped property bag on a built-in type.
--
-- `hotels.config` was a jsonb catch-all. Migration 342 moved lat/lng out of it
-- into a typed geopoint, and that emptied it: `{}` for every hotel in
-- production. Exactly one flag ever lived there besides the coordinates —
-- `require_removal_reason`, read by two components, written by one RPC.
--
-- Meanwhile `hotels` already carries typed columns for this exact class of
-- setting — auto_approve_threshold, auto_po_enabled, auto_invoice_tolerance_pct,
-- escalation_timeout_hours — and all of them are registered as properties on the
-- `hotel` object type. So there were two ways to store a hotel setting, and
-- Foundry settles which one is right:
--
--   "Objects are created and displayed in user applications by adding backing
--    datasources to an object type" (`mirror/object-link-types/object-types-overview.md`)
--
-- Properties map to columns of the backing datasource. There is no untyped bag
-- hanging off an object type — a value nobody typed cannot be a property, cannot
-- be searched, and cannot appear in an Object View.
--
-- The writer was doubly legacy: update_hotel_config scoped by
-- `SELECT hotel_id FROM users WHERE id = auth.uid()`, the single-home-hotel
-- lookup that migration 212 identified as predating the org model. A user with
-- two properties patched whichever one their profile happened to name.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS require_removal_reason boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hotels.require_removal_reason IS
  'Operators must pick a category when removing stock. Was config.require_removal_reason until migration 343.';

-- Carry across whatever was set, even though production reads {} — a migration
-- that only works on today's data is not a migration.
UPDATE public.hotels
   SET require_removal_reason = true
 WHERE (config ->> 'require_removal_reason') = 'true';

DO $$
DECLARE leftovers text;
BEGIN
  -- Anything else in the bag would be silently destroyed by the drop below.
  SELECT string_agg(DISTINCT k, ', ') INTO leftovers
  FROM hotels h, jsonb_object_keys(h.config) k
  WHERE k <> 'require_removal_reason';
  IF leftovers IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 343: hotels.config still holds unmigrated key(s): %', leftovers;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.update_hotel_config(text, jsonb);
ALTER TABLE public.hotels DROP COLUMN config;

-- Registered like every other hotel setting, so it is a property of the type
-- rather than a fact only the app knows.
UPDATE public.object_types
   SET properties = properties || jsonb_build_array(jsonb_build_object(
         'key', 'require_removal_reason', 'label', 'Require move reason',
         'type', 'boolean', 'required', false))
 WHERE kind = 'builtin' AND api_name = 'hotel'
   AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(properties) p WHERE p->>'key' = 'require_removal_reason');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM builtin_property_drift();
  IF n > 0 THEN RAISE EXCEPTION 'Migration 343: % drift row(s) after registering the setting', n; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='hotels' AND column_name='config') THEN
    RAISE EXCEPTION 'Migration 343: hotels.config survived the drop';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
              WHERE ns.nspname='public' AND p.proname='update_hotel_config') THEN
    RAISE EXCEPTION 'Migration 343: update_hotel_config survived the drop';
  END IF;

  SELECT count(*) INTO n FROM object_types o, jsonb_array_elements(o.properties) p
   WHERE o.api_name='hotel' AND p->>'key'='require_removal_reason' AND p->>'type'='boolean';
  IF n = 0 THEN RAISE EXCEPTION 'Migration 343: the setting is not a registered property'; END IF;
END $$;

COMMIT;
