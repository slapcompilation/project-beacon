-- Reconcile the stock-movement category vocabulary (corrections backlog #3).
--
-- Two fixes, both surfaced by verifying live data (removal_category + movement_category
-- are 100% NULL; ontology_proposals is empty — so nothing to migrate, only to align):
--
-- 1. Drop the rigid removal_category CHECK. It pinned the column to five Title-Case
--    values, which is incompatible with how categories are actually governed now:
--      • custom_removal_reasons let operators name arbitrary reasons (picked in the
--        StockAdjust modal) — none of which the CHECK admits;
--      • WRITE_OFF's fallback writes 'waste' — also rejected by the CHECK;
--      • the self-evolving ontology (Pillar 2) can grow new categories (Transfer,
--        Correction, Complimentary…) the CHECK never knew about.
--    Governance lives at the app layer (RemovalCategory union + custom_removal_reasons
--    + approved ontology_proposals); a hand-maintained DB enum just drifts and rejects
--    legitimate writes. Reports filter by value, not by the constraint — dropping it
--    changes no report behavior.
--
-- 2. Re-case the receipt auto-typer to 'Receipt'. The detector now proposes Title-Case
--    canonical categories (matching the RemovalCategory union + the reporting SQL), so
--    the addition equivalent is 'Receipt'. Gate folds case so an approval recorded under
--    either casing still fires.

BEGIN;

ALTER TABLE stock_logs DROP CONSTRAINT IF EXISTS stock_logs_removal_category_check;

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
    NEW.movement_category := 'Receipt';
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
