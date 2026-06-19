-- Tier-2 of the #3 vocabulary reconciliation: physically merge stock_logs'
-- two sign-dependent category columns (removal_category + movement_category)
-- into ONE sign-agnostic column, `category`. A stock_log has exactly one sign,
-- so only ever one of the two columns could be populated — the split was
-- redundant. The typed BeaconAction already collapsed to a single `category`
-- field (#3); this finishes the job at the storage layer.
--
-- Verified before applying: both columns 100% NULL across all 2069 rows
-- (no backfill), only on stock_logs, no views/CHECKs/policies, the only hard
-- dependency is the partial index (follows the rename), and movement_category
-- is write-only (nothing READS it).
--
-- The two ontology vocabulary BUCKETS stay distinct (ontology_proposals
-- .target_field 'removal_category' vs 'movement_category') — they're logical
-- removal-vs-addition vocab over the one column; flattening them would mix
-- 'Spoilage' with 'Receipt' in the operator's category dropdowns. So the
-- receipt auto-typer keeps its 'movement_category' bucket check.
--
-- 19 of the 23 functions that referenced these columns only do so as plain
-- column refs → recreated mechanically from their live definitions. The 4 with
-- a non-mechanical change are hand-written: adjust_stock (two cat params → one),
-- get_recent_activity + get_variant_timeline (rename a RETURNS column, which
-- CREATE OR REPLACE forbids), tg_autotype_receipt_movement (keep its bucket
-- string, only the column assignment changes).

-- 1. The receipt auto-typer's WHEN clause depends on movement_category; drop it
--    before we can drop the column (recreated against `category` at the end).
DROP TRIGGER IF EXISTS trg_stock_log_autotype_receipt ON public.stock_logs;

-- 2. Merge the physical columns. The theft trigger's WHEN clause and the partial
--    index reference removal_category by attnum, so they follow the rename.
ALTER TABLE public.stock_logs RENAME COLUMN removal_category TO category;

-- 3. Recreate the 19 mechanical functions by transforming their LIVE definitions
--    (every token there is a real column ref). adjust_stock + the two
--    RETURNS-renaming readers + the auto-typer are excluded (hand-written below).
DO $mig$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND (pg_get_functiondef(p.oid) ~ 'removal_category'
           OR pg_get_functiondef(p.oid) ~ 'movement_category')
      AND p.proname NOT IN (
        'adjust_stock', 'get_recent_activity',
        'get_variant_timeline', 'tg_autotype_receipt_movement'
      )
  LOOP
    EXECUTE replace(
      replace(pg_get_functiondef(r.oid), 'movement_category', 'category'),
      'removal_category', 'category'
    );
  END LOOP;
END $mig$;

-- 4. adjust_stock: collapse the two sign-dependent category params into one.
DROP FUNCTION IF EXISTS public.adjust_stock(uuid, integer, text, text, text, text);
CREATE FUNCTION public.adjust_stock(
  p_variant_id uuid,
  p_delta integer,
  p_reason text,
  p_photo_url text DEFAULT NULL::text,
  p_category text DEFAULT NULL::text
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
    photo_url, category
  )
  VALUES (
    v_hotel_id, p_variant_id, auth.uid(),
    p_delta, v_new_balance, p_reason,
    p_photo_url, p_category
  )
  RETURNING id INTO v_log_id;

  RETURN QUERY SELECT v_log_id, v_new_balance;
END;
$function$;

-- 5. Receipt auto-typer: keep the 'movement_category' vocab bucket check; only
--    the column it stamps changes.
CREATE OR REPLACE FUNCTION public.tg_autotype_receipt_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ontology_proposals
    WHERE hotel_id     = NEW.hotel_id
      AND target_field = 'movement_category'
      AND lower(proposed) = 'receipt'
      AND status       = 'approved'
  ) THEN
    NEW.category := 'Receipt';
  END IF;
  RETURN NEW;
END;
$function$;

-- 6. get_recent_activity: RETURNS column removal_category -> category.
DROP FUNCTION IF EXISTS public.get_recent_activity(integer);
CREATE FUNCTION public.get_recent_activity(p_limit integer DEFAULT 100)
 RETURNS TABLE(log_id uuid, happened_at timestamp with time zone, actor_email text, variant_id uuid, variant_name text, product_name text, sku text, quantity_change integer, balance_after integer, reason text, category text, is_revert boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    sl.id                                    AS log_id,
    sl.timestamp                             AS happened_at,
    COALESCE(u.email, 'system')              AS actor_email,
    sl.variant_id,
    pv.name                                  AS variant_name,
    p.name                                   AS product_name,
    pv.sku,
    sl.quantity_change,
    sl.balance_after,
    sl.reason,
    sl.category::text,
    sl.is_revert
  FROM  stock_logs       sl
  JOIN  product_variants pv ON pv.id = sl.variant_id
  JOIN  products         p  ON p.id  = pv.product_id
  LEFT JOIN auth.users   u  ON u.id  = sl.user_id
  WHERE sl.hotel_id = auth_hotel_id()
  ORDER BY sl.timestamp DESC
  LIMIT p_limit;
$function$;

-- 7. get_variant_timeline: RETURNS column removal_category -> category.
DROP FUNCTION IF EXISTS public.get_variant_timeline(uuid, integer);
CREATE FUNCTION public.get_variant_timeline(p_variant_id uuid, p_days integer DEFAULT 90)
 RETURNS TABLE(log_id uuid, happened_at timestamp with time zone, actor_email text, actor_id uuid, variant_name text, product_name text, sku text, unit_cost numeric, par_level integer, quantity_change integer, balance_after integer, reason text, category text, is_revert boolean, revert_of uuid, was_offline boolean, photo_url text, cost_impact numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    sl.id,
    sl.timestamp,
    u.email::TEXT,
    sl.user_id,
    pv.name,
    p.name,
    pv.sku,
    COALESCE(pv.cost, 0)::NUMERIC,
    COALESCE(pv.low_stock_threshold, 0)::INT,
    sl.quantity_change,
    sl.balance_after,
    sl.reason,
    sl.category::TEXT,
    sl.is_revert,
    sl.revert_of,
    sl.was_offline,
    sl.photo_url,
    (sl.quantity_change * COALESCE(pv.cost, 0))::NUMERIC
  FROM   stock_logs        sl
  JOIN   product_variants  pv ON pv.id = sl.variant_id
  JOIN   products          p  ON p.id  = pv.product_id
  LEFT JOIN auth.users     u  ON u.id  = sl.user_id
  WHERE  sl.variant_id = p_variant_id
    AND  p.hotel_id = (
           SELECT (raw_app_meta_data->>'hotel_id')::UUID
           FROM   auth.users
           WHERE  id = auth.uid()
         )
    AND  sl.timestamp >= NOW() - (p_days || ' days')::INTERVAL
  ORDER  BY sl.timestamp ASC;
$function$;

-- 8. Drop the now-unreferenced dead column.
ALTER TABLE public.stock_logs DROP COLUMN movement_category;

-- 9. Recreate the receipt auto-typer trigger against the merged column.
CREATE TRIGGER trg_stock_log_autotype_receipt
  BEFORE INSERT ON public.stock_logs
  FOR EACH ROW
  WHEN (
    NEW.category IS NULL
    AND NEW.quantity_change > 0
    AND NEW.reason = 'Received against restock request'::text
  )
  EXECUTE FUNCTION tg_autotype_receipt_movement();

-- 10. Tidy the partial index name (it already follows the renamed column).
ALTER INDEX IF EXISTS idx_stock_logs_removal_cat RENAME TO idx_stock_logs_category;
