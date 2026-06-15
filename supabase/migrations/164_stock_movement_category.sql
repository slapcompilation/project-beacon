-- Phase Q (ontology consume) — typed movement_category on stock additions.
--
-- Q1–Q5 detect untyped patterns; Q3 made approved removal_category consumable in
-- write-offs. This does the same for stock ADDITIONS: a `movement_category`
-- column on stock_logs, written at insert by adjust_stock (immutable — never
-- updated after). The manual positive-adjustment path can now stamp an approved
-- movement category (e.g. 'receipt'); the high-volume receive_restock path is a
-- separate, larger function and is left for a focused follow-up.
--
-- adjust_stock: the app calls the 5-param overload (…p_removal_category). We drop
-- that exact overload and recreate it with a trailing p_movement_category default
-- null, faithfully reproducing the body + writing the new column. The 3/4-param
-- overloads stay; a 5-named-arg call now resolves unambiguously to this 6-param one.

BEGIN;

ALTER TABLE stock_logs ADD COLUMN IF NOT EXISTS movement_category text;

DROP FUNCTION IF EXISTS public.adjust_stock(uuid, integer, text, text, text);

CREATE FUNCTION public.adjust_stock(
  p_variant_id        uuid,
  p_delta             integer,
  p_reason            text,
  p_photo_url         text DEFAULT NULL,
  p_removal_category  text DEFAULT NULL,
  p_movement_category text DEFAULT NULL
)
RETURNS TABLE(log_id uuid, new_balance integer)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_hotel_id    uuid;
  v_new_balance integer;
  v_log_id      uuid;
BEGIN
  SELECT p.hotel_id INTO v_hotel_id
  FROM   product_variants pv
  JOIN   products p ON p.id = pv.product_id
  WHERE  pv.id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant % not found', p_variant_id;
  END IF;

  UPDATE product_variants
  SET    current_stock = current_stock + p_delta
  WHERE  id = p_variant_id
  RETURNING current_stock INTO v_new_balance;

  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason,
    photo_url, removal_category, movement_category
  )
  VALUES (
    v_hotel_id, p_variant_id, auth.uid(),
    p_delta, v_new_balance, p_reason,
    p_photo_url, p_removal_category, p_movement_category
  )
  RETURNING id INTO v_log_id;

  RETURN QUERY SELECT v_log_id, v_new_balance;
END;
$function$;

COMMIT;
