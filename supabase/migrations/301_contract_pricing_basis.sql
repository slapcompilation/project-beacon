-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 301 — a contract does not have to name a price.
--
-- Four real supply agreements, and the table could represent one of them:
--
--   ΝΕ.ΔΗ.ΚΕ.Π Πρέβεζας 2013     itemised and fixed — 894.00, 464.00, +160
--                                installation, ΦΠΑ 23%, total 1.867,14   ✓
--   ΗΛΙΑΚΤΙΔΑ 2/2023             price grid blank, quantities explicitly
--                                non-binding, call-offs by phone          ✗
--   Supply Agreement (US)        "The price for the Goods shall be as
--                                specified in each purchase order"        ✗
--   Supply Agreement Rev.133C84E "$___ per unit for the number of units
--                                specified in each Purchase Order"        ✗
--
-- variant_id and contracted_price are both NOT NULL, so a framework agreement —
-- one that governs HOW orders happen rather than WHAT they cost — has no row
-- shape at all. And per the operator, framework is the NORMAL case in
-- hospitality: prices move per purchase order.
--
-- So the table modelled the minority case and mandated it. That is why
-- get_contract_terms answered "no contract covers this variant and supplier"
-- for a real fifteen-page agreement: not a lookup bug, a shape that could not
-- hold the thing.
--
-- WHAT CHANGES. A contract row can now be one of two things:
--
--   fixed_in_contract    a priced line: variant + price, as Πρέβεζα has
--   per_purchase_order   an agreement covering a supplier, price set per PO
--
-- and the CHECK enforces that a fixed line actually carries its price, so
-- "priced" cannot quietly mean "we forgot". Existing rows are fixed_in_contract
-- by default, which is what they were.
--
-- payment_terms_days comes along because three of the four samples state it
-- explicitly (90 days; "within ___ days from the date of each Purchase Order")
-- and it is the one governing term that is unambiguously a number. The rest —
-- penalties, delivery windows, replacement obligations — stay in the document
-- path until more samples show which of them generalise. See docs/CONTRACT-MODEL.md.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.supplier_contracts
  ADD COLUMN IF NOT EXISTS pricing_basis      text NOT NULL DEFAULT 'fixed_in_contract',
  ADD COLUMN IF NOT EXISTS payment_terms_days integer;

ALTER TABLE public.supplier_contracts
  ALTER COLUMN variant_id       DROP NOT NULL,
  ALTER COLUMN contracted_price DROP NOT NULL;

ALTER TABLE public.supplier_contracts
  DROP CONSTRAINT IF EXISTS supplier_contracts_pricing_basis_check;
ALTER TABLE public.supplier_contracts
  ADD CONSTRAINT supplier_contracts_pricing_basis_check
  CHECK (pricing_basis IN ('fixed_in_contract','per_purchase_order','quoted_on_request'));

-- A priced line must carry its price. Dropping NOT NULL to admit framework
-- agreements must not also admit a "fixed" row with no number in it.
ALTER TABLE public.supplier_contracts
  DROP CONSTRAINT IF EXISTS supplier_contracts_fixed_needs_price;
ALTER TABLE public.supplier_contracts
  ADD CONSTRAINT supplier_contracts_fixed_needs_price
  CHECK (pricing_basis <> 'fixed_in_contract'
         OR (variant_id IS NOT NULL AND contracted_price IS NOT NULL));

COMMENT ON COLUMN public.supplier_contracts.pricing_basis IS
  'fixed_in_contract = a priced line (variant + price). per_purchase_order = an agreement covering the supplier, price set on each PO — the normal case in hospitality. quoted_on_request = neither, ask the supplier.';
COMMENT ON COLUMN public.supplier_contracts.variant_id IS
  'The variant this line prices. NULL for a framework agreement, which covers the supplier rather than one product.';
COMMENT ON COLUMN public.supplier_contracts.payment_terms_days IS
  'Days to pay from invoice or PO. Stated explicitly in three of the four sample agreements; the one governing term that is unambiguously a number.';

-- ── The lookup has to find an agreement that names no variant ────────────────

-- DROP first: the return table gains pricing_basis and payment_terms_days, and
-- CREATE OR REPLACE cannot widen a RETURNS TABLE.
DROP FUNCTION IF EXISTS public.get_contract_terms(uuid, uuid);

CREATE FUNCTION public.get_contract_terms(p_variant_id uuid, p_supplier_id uuid)
RETURNS TABLE (
  contracted_price   numeric,
  min_order_qty      integer,
  valid_from         date,
  valid_until        date,
  in_force           boolean,
  pricing_basis      text,
  payment_terms_days integer,
  basis              text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT sc.contracted_price,
         sc.min_order_qty,
         sc.contract_start,
         sc.contract_end,
         (sc.is_active
          AND (sc.contract_start IS NULL OR sc.contract_start <= current_date)
          AND (sc.contract_end   IS NULL OR sc.contract_end   >= current_date)),
         sc.pricing_basis,
         sc.payment_terms_days,
         CASE
           WHEN NOT sc.is_active THEN 'contract marked inactive'
           WHEN sc.contract_end IS NOT NULL AND sc.contract_end < current_date
             THEN 'contract expired ' || sc.contract_end::text
           WHEN sc.contract_start IS NOT NULL AND sc.contract_start > current_date
             THEN 'contract starts ' || sc.contract_start::text
           WHEN sc.pricing_basis = 'per_purchase_order'
             THEN 'agreement in force; price is set on each purchase order'
           WHEN sc.pricing_basis = 'quoted_on_request'
             THEN 'agreement in force; price quoted on request'
           ELSE 'contracted price, in force'
         END
  FROM supplier_contracts sc
  WHERE sc.supplier_id = p_supplier_id
    -- A line for this variant, or a framework agreement that names none.
    AND (sc.variant_id = p_variant_id OR sc.variant_id IS NULL)
    AND hotel_is_in_user_scope(sc.hotel_id)
  -- A variant-specific price beats a framework agreement; newest beats oldest.
  ORDER BY (sc.variant_id IS NOT NULL) DESC,
           sc.contract_start DESC NULLS LAST, sc.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_contract_terms(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contract_terms(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_contract_terms(uuid, uuid) IS
  'The agreed terms for a variant from a supplier. Finds a priced line for that variant OR a framework agreement covering the supplier, preferring the specific one. Reports pricing_basis so a caller can say "there is an agreement and the price is set per PO" instead of "no contract".';

-- ── Both archetypes must round-trip ─────────────────────────────────────────

DO $$
DECLARE v_hotel uuid; v_sup uuid; v_var uuid; n int;
BEGIN
  SELECT h.id INTO v_hotel FROM hotels h LIMIT 1;
  SELECT s.id INTO v_sup FROM suppliers s WHERE s.hotel_id = v_hotel LIMIT 1;
  SELECT pv.id INTO v_var FROM product_variants pv
    JOIN products p ON p.id = pv.product_id WHERE p.hotel_id = v_hotel LIMIT 1;
  IF v_sup IS NULL OR v_var IS NULL THEN
    RAISE NOTICE 'Migration 301: no supplier/variant to probe with; skipped';
    RETURN;
  END IF;

  BEGIN
    -- The Πρέβεζα shape: an itemised, priced line.
    INSERT INTO supplier_contracts
      (hotel_id, supplier_id, supplier_name, variant_id, contracted_price,
       pricing_basis, contract_start, contract_end, is_active)
    VALUES (v_hotel, v_sup, 'probe-fixed', v_var, 894.00,
            'fixed_in_contract', current_date - 10, current_date + 10, true);

    -- The framework shape: no variant, no price, price set per PO.
    INSERT INTO supplier_contracts
      (hotel_id, supplier_id, supplier_name, variant_id, contracted_price,
       pricing_basis, payment_terms_days, contract_start, contract_end, is_active)
    VALUES (v_hotel, v_sup, 'probe-framework', NULL, NULL,
            'per_purchase_order', 90, current_date - 10, current_date + 10, true);

    -- And a "fixed" row with no price must be refused.
    BEGIN
      INSERT INTO supplier_contracts
        (hotel_id, supplier_id, supplier_name, variant_id, contracted_price,
         pricing_basis, contract_start, is_active)
      VALUES (v_hotel, v_sup, 'probe-bad', NULL, NULL, 'fixed_in_contract', current_date, true);
      RAISE EXCEPTION 'Migration 301: a fixed_in_contract row with no price was accepted';
    EXCEPTION WHEN check_violation THEN
      NULL;  -- expected
    END;

    SELECT count(*) INTO n FROM supplier_contracts
     WHERE supplier_name IN ('probe-fixed','probe-framework');
    IF n <> 2 THEN
      RAISE EXCEPTION 'Migration 301: expected both archetypes to insert, got %', n;
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
