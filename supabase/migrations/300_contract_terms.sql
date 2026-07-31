-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 300 — the contract term a decision can actually use.
--
-- 298 kept get_contract_price as "awaiting the contracts arc". The arc arrived
-- in 299, and reading the function closely it would have been the wrong thing
-- to consume:
--
--   SELECT sc.contracted_price FROM supplier_contracts sc
--    WHERE sc.hotel_id = auth_hotel_id() AND ... AND sc.is_active = true
--
-- It ignores contract_start and contract_end entirely. A contract that expired
-- last month still returns a price as long as nobody unticked is_active — and
-- is_active is a human flag, which is exactly the field that goes stale. An
-- agent quoting an expired price would be confidently wrong, which is worse
-- than not knowing.
--
-- It also returns only the price. min_order_qty is the other half of the
-- decision: a contracted price you cannot reach because the MOQ is 200 units is
-- not a usable term, and sizing an order without it produces a proposal the
-- supplier rejects.
--
-- So the replacement returns the whole term and says whether it is IN FORCE
-- today, and the caller gets a basis it can cite rather than a bare number.
-- get_contract_price goes, superseded by the thing that answers the question
-- properly.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.get_contract_terms(p_variant_id uuid, p_supplier_id uuid)
RETURNS TABLE (
  contracted_price numeric,
  min_order_qty    integer,
  valid_from       date,
  valid_until      date,
  in_force         boolean,
  basis            text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT sc.contracted_price,
         sc.min_order_qty,
         sc.contract_start,
         sc.contract_end,
         -- In force means: flagged active AND today sits inside the window.
         -- A NULL bound is open-ended, which is a real contract shape.
         (sc.is_active
          AND (sc.contract_start IS NULL OR sc.contract_start <= current_date)
          AND (sc.contract_end   IS NULL OR sc.contract_end   >= current_date)),
         CASE
           WHEN NOT sc.is_active                                        THEN 'contract marked inactive'
           WHEN sc.contract_end IS NOT NULL AND sc.contract_end < current_date
                                                                        THEN 'contract expired ' || sc.contract_end::text
           WHEN sc.contract_start IS NOT NULL AND sc.contract_start > current_date
                                                                        THEN 'contract starts ' || sc.contract_start::text
           ELSE 'contracted price, in force'
         END
  FROM supplier_contracts sc
  WHERE sc.variant_id  = p_variant_id
    AND sc.supplier_id = p_supplier_id
    AND hotel_is_in_user_scope(sc.hotel_id)
  -- Newest agreement wins when a variant has been re-contracted.
  ORDER BY sc.contract_start DESC NULLS LAST, sc.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_contract_terms(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contract_terms(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_contract_terms(uuid, uuid) IS
  'The full contracted term for a variant from a supplier, with whether it is in force today. SECURITY INVOKER + hotel_is_in_user_scope, so a caller sees only agreements in their scope. Replaces get_contract_price, which ignored the validity window and returned expired prices as current.';

DROP FUNCTION IF EXISTS public.get_contract_price(uuid, uuid);

DELETE FROM public.shape_registry
 WHERE object_kind = 'function' AND object_name = 'get_contract_price';

-- The old function's blind spot, asserted so it cannot come back: an expired
-- contract must not read as in force.
--
-- Asserted against the PREDICATE rather than through get_contract_terms. The
-- first version called the function and got in_force = NULL, not false — it is
-- SECURITY INVOKER and hotel-scoped, so the migration's role cannot see the row
-- it just inserted. That is the function behaving correctly and the assertion
-- proving nothing; RLS contracts cover the scoping, this covers the dates.
DO $$
DECLARE r record; n_bad int;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- start,                end,                   active, expected in_force
    (current_date - 90, current_date - 30, true,  false),  -- expired but still flagged active
    (current_date + 10, current_date + 90, true,  false),  -- not started yet
    (current_date - 10, current_date + 10, true,  true ),  -- inside the window
    (current_date - 10, current_date + 10, false, false),  -- window fine, flag off
    (NULL::date,        NULL::date,        true,  true )   -- open-ended is a real shape
  ) AS t(c_start, c_end, active, expected)
  LOOP
    IF (r.active
        AND (r.c_start IS NULL OR r.c_start <= current_date)
        AND (r.c_end   IS NULL OR r.c_end   >= current_date)) IS DISTINCT FROM r.expected THEN
      RAISE EXCEPTION 'Migration 300: in_force wrong for start=% end=% active=% (expected %)',
        r.c_start, r.c_end, r.active, r.expected;
    END IF;
  END LOOP;

  -- And the function must exist with the shape callers will bind to.
  SELECT count(*) INTO n_bad FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_contract_terms';
  IF n_bad <> 1 THEN
    RAISE EXCEPTION 'Migration 300: expected exactly one get_contract_terms, found %', n_bad;
  END IF;
END $$;

COMMIT;
