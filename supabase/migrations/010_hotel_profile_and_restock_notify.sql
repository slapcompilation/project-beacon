-- ─── Hotel profile RPC ───────────────────────────────────────────────────────
-- SECURITY DEFINER because RLS on hotels only grants SELECT.
-- The function updates the caller's own hotel identified by auth_hotel_id().
-- Role check inside ensures only owner / admin can call it.

CREATE OR REPLACE FUNCTION update_hotel_profile(
  p_name     text,
  p_address  text,
  p_timezone text,
  p_currency text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role');

  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'insufficient_permissions';
  END IF;

  UPDATE hotels
  SET
    name      = p_name,
    address   = p_address,
    timezone  = p_timezone,
    currency  = p_currency
  WHERE id = auth_hotel_id();
END;
$$;

-- ─── Restock approval notification trigger ───────────────────────────────────
-- Fires after UPDATE on restock_requests.
-- When status changes to 'approved', inserts a notification for the requestor.

CREATE OR REPLACE FUNCTION notify_restock_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  -- Only fire when status transitions TO 'approved'
  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Build a human-readable label from the variant + product name
  SELECT COALESCE(pv.name || ' (' || p.name || ')', p.name)
    INTO v_label
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
   WHERE pv.id = NEW.variant_id;

  -- Guard: requestor must still have a profile (may have been GDPR-anonymised)
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.requestor_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (hotel_id, user_id, message, type)
  VALUES (
    NEW.hotel_id,
    NEW.requestor_id,
    'Your restock request for ' || COALESCE(v_label, 'a product') || ' has been approved.',
    'approval'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_restock_approved ON restock_requests;

CREATE TRIGGER trg_notify_restock_approved
  AFTER UPDATE OF status ON restock_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_restock_approved();
