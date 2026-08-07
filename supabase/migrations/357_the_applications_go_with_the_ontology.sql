-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 357 — five hospitality applications, built on an ontology that is
-- now empty.
--
-- Workshop is machinery and stays. What it BUILDS is content, and content
-- follows the teardown. `mirror/workshop/overview.md` is explicit about both
-- halves:
--
--   "Workshop enables application builders to create interactive and
--    high-quality applications for operational users."
--
--   "All data in a Workshop Application is read from the Object Data Layer,
--    allowing application creators to take advantage of rich characteristics
--    such as links between object types."
--
-- An application is authored by a builder and reads the object layer. Migration
-- 353 emptied that layer, so these five read nothing — and `pnpm check:modules`
-- said so precisely, naming five object-set variables pointing at two deleted
-- object types:
--
--   low_stock_triage.allVariants, low_stock_triage.lowStock,
--   morning_par_check.belowPar, below_par_cards.belowPar, shift_nav.belowPar
--
-- variant_card is not in that list only because it binds an interface variable
-- rather than an object set. It is a card about a hospitality variant, so it
-- goes with the rest.
--
-- Every child cascades (app_promotions, module_events, module_installations,
-- module_layouts, module_variables, module_widgets); module_installations
-- .forked_module_id is SET NULL and has no fork to orphan.
--
-- Foundry ships no applications either. The builder is the product.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DELETE FROM public.modules;

DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.modules;
  IF n > 0 THEN RAISE EXCEPTION 'Migration 357: % module(s) survived', n; END IF;

  -- The cascade is declared, not assumed. A widget outliving its application is
  -- the quiet half of this class of deletion.
  SELECT (SELECT count(*) FROM public.module_widgets)
       + (SELECT count(*) FROM public.module_variables)
       + (SELECT count(*) FROM public.module_layouts)
       + (SELECT count(*) FROM public.module_events)
       + (SELECT count(*) FROM public.module_installations)
       + (SELECT count(*) FROM public.app_promotions)
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 357: % orphaned module child row(s) remain', n;
  END IF;
END $$;

COMMIT;
