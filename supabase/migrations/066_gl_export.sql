-- Migration 066: GL-Ready Export (Sprint 11a)
-- Layer: Mind — financial intelligence for accounting handoff
-- Scope: ONE-WAY export only. No Xero/QBO API calls.
--   Procurement expenses (restock_receives) + write-offs (stock_logs, constrained removal_category)
--   are mapped to GL account codes via hotel-owned account_mappings table.
--   Finance imports the CSV into their accounting system. Zero integration risk.
-- Deliberately excludes:
--   - 'Consumed' removal_category (operational, not a financial write-off)
--   - 'Returned to supplier' (credit, separate treatment in 11b)
--   - POS auto-decrements (source = 'pos') — handled via F&B COGS, not GL write-off

SET search_path = public;

-- ─── 1. gl_account_mappings ───────────────────────────────────────────────────
-- Hotel staff own this. No developer involvement required.
-- mapping_type:
--   'category'  → mapping_key = categories.id::text
--                 Used to route procurement expenses (restock_receives) by product category
--   'write_off' → mapping_key = removal_category string ('Breakage'|'Theft'|'Spoilage')
--                 Used to route write-off stock_log entries
--   'default'   → mapping_key = 'expense' | 'write_off'
--                 Catch-all fallback when no specific mapping exists

CREATE TABLE IF NOT EXISTS gl_account_mappings (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  mapping_type    text         NOT NULL
                    CHECK (mapping_type IN ('category', 'write_off', 'default')),
  mapping_key     text         NOT NULL,
  gl_account_code text         NOT NULL,
  gl_account_name text         NOT NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, mapping_type, mapping_key)
);

ALTER TABLE gl_account_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "glm_all" ON gl_account_mappings FOR ALL
  USING  (hotel_id = auth_hotel_id())
  WITH CHECK (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_glm_hotel ON gl_account_mappings (hotel_id, mapping_type);

COMMENT ON TABLE gl_account_mappings IS
  'Hotel-owned GL account mapping table. Maps product categories and write-off types '
  'to GL account codes. Finance staff update this — no developer required.';

-- ─── 2. upsert_gl_mapping() ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_gl_mapping(
  p_mapping_type    text,
  p_mapping_key     text,
  p_gl_account_code text,
  p_gl_account_name text
)
RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO gl_account_mappings (hotel_id, mapping_type, mapping_key, gl_account_code, gl_account_name)
  VALUES (auth_hotel_id(), p_mapping_type, p_mapping_key, p_gl_account_code, p_gl_account_name)
  ON CONFLICT (hotel_id, mapping_type, mapping_key) DO UPDATE
    SET gl_account_code = EXCLUDED.gl_account_code,
        gl_account_name = EXCLUDED.gl_account_name,
        updated_at      = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_gl_mapping(text, text, text, text) TO authenticated;

-- ─── 3. delete_gl_mapping() ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_gl_mapping(p_mapping_type text, p_mapping_key text)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM gl_account_mappings
  WHERE hotel_id    = auth_hotel_id()
    AND mapping_type = p_mapping_type
    AND mapping_key  = p_mapping_key;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_gl_mapping(text, text) TO authenticated;

-- ─── 4. get_gl_export(p_from, p_to, p_include_write_offs) ────────────────────
-- Returns transaction-level GL export rows. Finance imports this as CSV.
-- is_mapped = false signals a row that needs a GL code before posting.
-- Ordered by date ASC, type ASC for clean journal ordering.
--
-- Procurement expense lines:
--   Source: restock_receives → restock_requests → product_variants → products → categories
--   Amount: quantity_received * COALESCE(unit_cost, variant.cost, 0)
--   GL account: gl_account_mappings WHERE mapping_type = 'category'
--             → fallback: mapping_type = 'default' AND mapping_key = 'expense'
--
-- Write-off lines (opt-in, default true):
--   Source: stock_logs WHERE removal_category IN ('Breakage','Theft','Spoilage')
--           AND is_revert = false AND source IS DISTINCT FROM 'pos'
--   Amount: ABS(quantity_change) * variant.cost
--   GL account: gl_account_mappings WHERE mapping_type = 'write_off'
--             → fallback: mapping_type = 'default' AND mapping_key = 'write_off'

CREATE OR REPLACE FUNCTION get_gl_export(
  p_from              date,
  p_to                date,
  p_include_write_offs boolean DEFAULT true
)
RETURNS TABLE (
  transaction_date  date,
  transaction_type  text,   -- 'procurement_expense' | 'write_off'
  reference_id      uuid,
  reference_label   text,
  description       text,
  category_name     text,
  gl_account_code   text,
  gl_account_name   text,
  amount            numeric,
  currency          text,
  is_mapped         boolean
)
LANGUAGE sql STABLE AS $$
  WITH hotel AS (
    SELECT id, currency FROM hotels WHERE id = auth_hotel_id()
  ),
  -- Default fallback mappings for this hotel
  defaults AS (
    SELECT mapping_key, gl_account_code, gl_account_name
    FROM   gl_account_mappings
    WHERE  hotel_id    = auth_hotel_id()
      AND  mapping_type = 'default'
  ),
  -- ── Procurement expenses ────────────────────────────────────────────────────
  procurement AS (
    SELECT
      rr.received_at::date                                                    AS transaction_date,
      'procurement_expense'::text                                             AS transaction_type,
      rr.id                                                                   AS reference_id,
      'RCV-' || SUBSTR(rr.id::text, 1, 8)                                    AS reference_label,
      p.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END
        || ' × ' || rr.quantity_received::text                                AS description,
      COALESCE(cat.name, '(Uncategorised)')                                   AS category_name,
      cat.id::text                                                            AS category_key,
      rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0)              AS amount
    FROM   restock_receives rr
    JOIN   restock_requests req ON req.id    = rr.request_id
    JOIN   product_variants pv  ON pv.id     = req.variant_id
    JOIN   products p           ON p.id      = pv.product_id
    LEFT JOIN categories cat    ON cat.id    = p.category_id
    WHERE  rr.hotel_id     = auth_hotel_id()
      AND  rr.received_at::date BETWEEN p_from AND p_to
  ),
  procurement_mapped AS (
    SELECT
      proc.*,
      COALESCE(
        (SELECT gl_account_code FROM gl_account_mappings
         WHERE hotel_id = auth_hotel_id() AND mapping_type = 'category' AND mapping_key = proc.category_key
         LIMIT 1),
        (SELECT gl_account_code FROM defaults WHERE mapping_key = 'expense' LIMIT 1)
      )                                                                        AS gl_code,
      COALESCE(
        (SELECT gl_account_name FROM gl_account_mappings
         WHERE hotel_id = auth_hotel_id() AND mapping_type = 'category' AND mapping_key = proc.category_key
         LIMIT 1),
        (SELECT gl_account_name FROM defaults WHERE mapping_key = 'expense' LIMIT 1)
      )                                                                        AS gl_name
    FROM procurement proc
  ),
  -- ── Write-off lines ─────────────────────────────────────────────────────────
  write_offs AS (
    SELECT
      sl.timestamp::date                                                       AS transaction_date,
      'write_off'::text                                                        AS transaction_type,
      sl.id                                                                    AS reference_id,
      'WO-' || SUBSTR(sl.id::text, 1, 8)                                      AS reference_label,
      COALESCE(sl.removal_category, 'Write-off') || ': '
        || p.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END
        || ' × ' || ABS(sl.quantity_change)::text                             AS description,
      COALESCE(cat.name, '(Uncategorised)')                                   AS category_name,
      sl.removal_category                                                      AS removal_cat,
      ABS(sl.quantity_change) * pv.cost                                       AS amount
    FROM   stock_logs sl
    JOIN   product_variants pv  ON pv.id     = sl.variant_id
    JOIN   products p           ON p.id      = pv.product_id
    LEFT JOIN categories cat    ON cat.id    = p.category_id
    WHERE  sl.hotel_id          = auth_hotel_id()
      AND  sl.timestamp::date  BETWEEN p_from AND p_to
      AND  sl.removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND  sl.is_revert         = false
      AND  sl.source            IS DISTINCT FROM 'pos'
  ),
  write_offs_mapped AS (
    SELECT
      wo.*,
      COALESCE(
        (SELECT gl_account_code FROM gl_account_mappings
         WHERE hotel_id = auth_hotel_id() AND mapping_type = 'write_off' AND mapping_key = wo.removal_cat
         LIMIT 1),
        (SELECT gl_account_code FROM defaults WHERE mapping_key = 'write_off' LIMIT 1)
      )                                                                        AS gl_code,
      COALESCE(
        (SELECT gl_account_name FROM gl_account_mappings
         WHERE hotel_id = auth_hotel_id() AND mapping_type = 'write_off' AND mapping_key = wo.removal_cat
         LIMIT 1),
        (SELECT gl_account_name FROM defaults WHERE mapping_key = 'write_off' LIMIT 1)
      )                                                                        AS gl_name
    FROM write_offs wo
  )
  -- ── Union and annotate ──────────────────────────────────────────────────────
  SELECT
    transaction_date,
    transaction_type,
    reference_id,
    reference_label,
    description,
    category_name,
    COALESCE(gl_code, '')                                                      AS gl_account_code,
    COALESCE(gl_name, '')                                                      AS gl_account_name,
    ROUND(amount, 2)                                                           AS amount,
    (SELECT currency FROM hotel)                                               AS currency,
    gl_code IS NOT NULL                                                        AS is_mapped
  FROM procurement_mapped

  UNION ALL

  SELECT
    transaction_date,
    transaction_type,
    reference_id,
    reference_label,
    description,
    category_name,
    COALESCE(gl_code, ''),
    COALESCE(gl_name, ''),
    ROUND(amount, 2),
    (SELECT currency FROM hotel),
    gl_code IS NOT NULL
  FROM write_offs_mapped
  WHERE p_include_write_offs

  ORDER BY transaction_date ASC, transaction_type ASC
$$;

GRANT EXECUTE ON FUNCTION get_gl_export(date, date, boolean) TO authenticated;

-- ─── 5. get_gl_export_summary(p_from, p_to) ──────────────────────────────────
-- Quick summary for the page header — avoids loading all rows just for KPIs.

CREATE OR REPLACE FUNCTION get_gl_export_summary(
  p_from date,
  p_to   date
)
RETURNS TABLE (
  procurement_count    bigint,
  procurement_total    numeric,
  write_off_count      bigint,
  write_off_total      numeric,
  unmapped_count       bigint
)
LANGUAGE sql STABLE AS $$
  WITH rows AS (
    SELECT transaction_type, amount, is_mapped
    FROM   get_gl_export(p_from, p_to, true)
  )
  SELECT
    COUNT(*) FILTER (WHERE transaction_type = 'procurement_expense')  AS procurement_count,
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'procurement_expense'), 0) AS procurement_total,
    COUNT(*) FILTER (WHERE transaction_type = 'write_off')            AS write_off_count,
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'write_off'), 0)           AS write_off_total,
    COUNT(*) FILTER (WHERE NOT is_mapped)                             AS unmapped_count
  FROM rows;
$$;

GRANT EXECUTE ON FUNCTION get_gl_export_summary(date, date) TO authenticated;
