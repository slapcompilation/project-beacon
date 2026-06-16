-- Phase Q (ontology consume) — auto-type receipts' movement_category.
--
-- PR #171 made movement_category consumable on the MANUAL adjust path. Receipts
-- are the high-volume path (receive_restock) and nobody hand-tags them, so we
-- auto-classify at insert: a positive receive_restock log becomes movement_category
-- 'receipt' — but only once the operator has grown the ontology to include it
-- (Pillar 2 = consume the APPROVED set, not invent types). 'receipt' is the
-- canonical the ADDITION_LEXICON / detector proposes for these reasons.
--
-- A BEFORE INSERT trigger (not a rewrite of the large receive_restock function)
-- keeps the change tiny and preserves stock-log immutability — the value is set
-- AS the row is written, never updated after. The WHEN clause gates the function
-- to receipt inserts only, so consumption/removal inserts pay nothing.
-- Historical receipts (already inserted) stay untyped — immutable, never backfilled.

BEGIN;

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
      AND proposed     = 'receipt'
      AND status       = 'approved'
  ) THEN
    NEW.movement_category := 'receipt';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_stock_log_autotype_receipt ON public.stock_logs;
CREATE TRIGGER trg_stock_log_autotype_receipt
  BEFORE INSERT ON public.stock_logs
  FOR EACH ROW
  -- Coupled to receive_restock's fixed reason string; keep in sync if it changes.
  WHEN (
    NEW.movement_category IS NULL
    AND NEW.quantity_change > 0
    AND NEW.reason = 'Received against restock request'
  )
  EXECUTE FUNCTION public.tg_autotype_receipt_movement();

COMMIT;
