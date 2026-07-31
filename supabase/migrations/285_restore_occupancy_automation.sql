-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 285 — occupancy ingestion has never worked. Restoring 064's half
-- that never landed.
--
-- Found by trying to fire one webhook at the source registered in 283. Both
-- ingest-occupancy and mews-webhook call ingest_occupancy_webhook(); the
-- function does not exist. Nor do three others the web app calls. All four are
-- declared in migration 064, which supabase_migrations.schema_migrations
-- RECORDS AS APPLIED, statements and all.
--
--   delete_booking_forecast    apps/web/.../eye/api
--   get_pms_health             apps/web/.../eye/api
--   ingest_occupancy_webhook   ingest-occupancy + mews-webhook
--   upsert_booking_forecast    apps/web/.../eye/api
--
-- The tables from 064 ARE here — booking_forecasts has 60 rows and modern
-- hotel_is_in_user_scope policies, so something later rebuilt them. The
-- functions were never rebuilt with them. A partial application nobody noticed
-- because a missing RPC is a STRING handed to PostgREST: invisible to the type
-- system, silent until somebody calls it.
--
-- @beacon/types already declares occupancy_logs.source_system and
-- .external_reference_id, so the types were ahead of the schema too. Restored
-- rather than diverged — the type is the source of truth per CLAUDE.md, and
-- changing it would ripple further than adding two columns.
--
-- NOT copied verbatim. 064 is 2024-era SQL and three things have moved since:
--   • policies now scope with hotel_is_in_user_scope, not hotel_id = auth_hotel_id()
--   • every function pins search_path (281 fixed the last one that did not)
--   • policies name their role (TO authenticated) instead of applying to PUBLIC
-- The bodies are otherwise 064's, because the callers were written against them
-- and the point here is to make existing calls work, not to redesign.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. The two columns the shared type already promises ──────────────────────

ALTER TABLE public.occupancy_logs
  ADD COLUMN IF NOT EXISTS source_system         text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_reference_id text;

COMMENT ON COLUMN public.occupancy_logs.external_reference_id IS
  'PMS event id, audit only. Not unique: webhook retries for one date collapse on (hotel_id, date).';

-- ── 2. pms_connections ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pms_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  source_system    text NOT NULL,
  last_received_at timestamptz,
  total_events     bigint NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, source_system)
);

CREATE INDEX IF NOT EXISTS idx_pms_conn_hotel ON public.pms_connections (hotel_id);

ALTER TABLE public.pms_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pms_conn_select" ON public.pms_connections;
CREATE POLICY "pms_conn_select" ON public.pms_connections
  FOR SELECT TO authenticated USING (hotel_is_in_user_scope(hotel_id));

COMMENT ON TABLE public.pms_connections IS
  'Last webhook receipt per PMS source per hotel. Written by ingest_occupancy_webhook, read by get_pms_health to surface "PMS disconnected".';

-- ── 3. The four functions ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_pms_health()
RETURNS TABLE (source_system text, last_received_at timestamptz,
               hours_since_last numeric, status text, total_events bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT c.source_system, c.last_received_at,
         CASE WHEN c.last_received_at IS NULL THEN NULL
              ELSE round(extract(epoch FROM (now() - c.last_received_at))/3600.0, 1) END,
         CASE WHEN c.last_received_at IS NULL                        THEN 'never_connected'
              WHEN now() - c.last_received_at < interval '2 hours'   THEN 'connected'
              WHEN now() - c.last_received_at < interval '24 hours'  THEN 'warning'
              ELSE 'disconnected' END,
         c.total_events
  FROM pms_connections c
  WHERE c.hotel_id = auth_hotel_id()
  ORDER BY c.source_system;
$$;

REVOKE ALL ON FUNCTION public.get_pms_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pms_health() TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_booking_forecast(
  p_date date, p_expected_occupancy numeric, p_horizon_source text DEFAULT 'manual')
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO booking_forecasts
    (hotel_id, date, expected_occupancy_pct, horizon_source, created_by, updated_at)
  VALUES (auth_hotel_id(), p_date, p_expected_occupancy, p_horizon_source, auth.uid(), now())
  ON CONFLICT (hotel_id, date) DO UPDATE
    SET expected_occupancy_pct = EXCLUDED.expected_occupancy_pct,
        horizon_source         = EXCLUDED.horizon_source,
        created_by             = EXCLUDED.created_by,
        updated_at             = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.upsert_booking_forecast(date, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_booking_forecast(date, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_booking_forecast(p_date date)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM booking_forecasts WHERE hotel_id = auth_hotel_id() AND date = p_date;
END $$;

REVOKE ALL ON FUNCTION public.delete_booking_forecast(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_booking_forecast(date) TO authenticated;

-- SECURITY DEFINER because the webhook arrives with no user: verifySharedSecret
-- hands the edge function a service-role client, and this writes rows RLS would
-- otherwise scope to a session that does not exist.
CREATE OR REPLACE FUNCTION public.ingest_occupancy_webhook(
  p_hotel_id uuid, p_source_system text, p_date date, p_occupancy_pct numeric,
  p_occupied_rooms integer DEFAULT NULL, p_total_rooms integer DEFAULT NULL,
  p_external_reference_id text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO occupancy_logs
    (hotel_id, date, occupancy_pct, occupied_rooms, total_rooms,
     source, source_system, external_reference_id)
  VALUES (p_hotel_id, p_date, p_occupancy_pct, p_occupied_rooms, p_total_rooms,
          p_source_system, p_source_system, p_external_reference_id)
  ON CONFLICT (hotel_id, date) DO UPDATE
    SET occupancy_pct         = EXCLUDED.occupancy_pct,
        occupied_rooms        = coalesce(EXCLUDED.occupied_rooms, occupancy_logs.occupied_rooms),
        total_rooms           = coalesce(EXCLUDED.total_rooms,   occupancy_logs.total_rooms),
        source                = EXCLUDED.source,
        source_system         = EXCLUDED.source_system,
        external_reference_id = coalesce(EXCLUDED.external_reference_id, occupancy_logs.external_reference_id)
  RETURNING id INTO v_id;

  INSERT INTO pms_connections (hotel_id, source_system, last_received_at, total_events)
  VALUES (p_hotel_id, p_source_system, now(), 1)
  ON CONFLICT (hotel_id, source_system) DO UPDATE
    SET last_received_at = now(),
        total_events     = pms_connections.total_events + 1;

  RETURN v_id;
END $$;

-- Only the service role. A SECURITY DEFINER function that writes any hotel's
-- occupancy must not be reachable by a logged-in user.
REVOKE ALL ON FUNCTION public.ingest_occupancy_webhook(uuid, text, date, numeric, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_occupancy_webhook(uuid, text, date, numeric, integer, integer, text)
  TO service_role;

-- ── 4. Prove the callers can now resolve ─────────────────────────────────────

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(n, ', ') INTO missing
  FROM unnest(ARRAY['get_pms_health','upsert_booking_forecast','delete_booking_forecast',
                    'ingest_occupancy_webhook']) n
  WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
                    WHERE ns.nspname='public' AND p.proname = n);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 285: still missing after restore: %', missing;
  END IF;
END $$;

-- And that the webhook actually lands a row plus a health bump. Rolled back —
-- the point is that it runs, not that today's occupancy changes.
DO $$
DECLARE v_hotel uuid; v_id uuid; n_conn int;
BEGIN
  SELECT id INTO v_hotel FROM hotels LIMIT 1;
  BEGIN
    v_id := ingest_occupancy_webhook(v_hotel, 'probe', current_date, 61, 61, 100, 'probe-285');
    SELECT count(*) INTO n_conn FROM pms_connections
     WHERE hotel_id = v_hotel AND source_system = 'probe' AND last_received_at IS NOT NULL;
    IF v_id IS NULL OR n_conn <> 1 THEN
      RAISE EXCEPTION 'Migration 285: webhook ran but wrote id=% conn_rows=%', v_id, n_conn;
    END IF;
    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN
      RAISE EXCEPTION 'Migration 285: occupancy webhook still fails: %', SQLERRM;
    END IF;
  END;
END $$;

COMMIT;
