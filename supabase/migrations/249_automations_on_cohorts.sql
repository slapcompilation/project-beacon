-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 249 — an automation may fire on a COHORT. Tier 1 of the map.
--
-- Until now the condition was welded to the effect: one metric, one comparison,
-- and `subject CHECK (subject IN ('variant'))`. That is why the audit found no
-- Cohort object — there was no way to name a set without also saying what to do
-- with it (§7.5).
--
-- Pointing an automation at an object_set separates the two. The set says WHICH
-- records; the automation says WHAT to propose. The set is reusable — the same
-- cohort feeds a tool's count and a report — and it brings multi-condition rules
-- over the type's whole property vocabulary, where the welded form allowed
-- exactly one comparison on one of four metrics.
--
-- Exactly one form per automation. Both would be two conditions with no defined
-- precedence.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS object_set_id uuid REFERENCES public.object_sets(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.automations.object_set_id IS
  'Fire on membership of this cohort instead of a welded metric condition. RESTRICT, not CASCADE: deleting a cohort an automation acts on would silently disarm the automation rather than making the operator confront it.';

-- The welded form is now optional, since a cohort-backed automation has no
-- metric of its own.
ALTER TABLE public.automations
  ALTER COLUMN when_metric DROP NOT NULL,
  ALTER COLUMN when_op     DROP NOT NULL,
  ALTER COLUMN when_value  DROP NOT NULL;

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_one_condition;
ALTER TABLE public.automations
  ADD CONSTRAINT automations_one_condition CHECK (
    (object_set_id IS NOT NULL AND when_metric IS NULL AND when_op IS NULL AND when_value IS NULL)
    OR
    (object_set_id IS NULL AND when_metric IS NOT NULL AND when_op IS NOT NULL AND when_value IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_automations_object_set ON public.automations (object_set_id);

-- Every effect we can build (REQUEST_RESTOCK, TRANSFER_STOCK, WRITE_OFF) acts on
-- a variant, so a cohort of suppliers would produce hits that can never become
-- an action — a rule that looks armed and never fires. A CHECK cannot reach
-- another table, so the rule lives in a trigger.
--
-- When an effect that acts on another type arrives, widen the allowed api_names
-- here alongside it.
CREATE OR REPLACE FUNCTION public.enforce_automation_cohort_subject()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_api_name text;
BEGIN
  IF NEW.object_set_id IS NULL THEN RETURN NEW; END IF;

  SELECT t.api_name INTO v_api_name
  FROM public.object_sets s
  LEFT JOIN public.object_types t ON t.id = s.subject_type_id
  WHERE s.id = NEW.object_set_id;

  IF v_api_name IS DISTINCT FROM 'variant' THEN
    RAISE EXCEPTION
      'Automation effects act on variants, so a cohort-backed automation needs a cohort drawn from Variant (this one is %). Point it at a Variant cohort, or add an effect that acts on this type.',
      coalesce(v_api_name, 'an interface');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_automation_cohort_subject ON public.automations;
CREATE TRIGGER trg_automation_cohort_subject
  BEFORE INSERT OR UPDATE OF object_set_id ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_automation_cohort_subject();

COMMENT ON FUNCTION public.enforce_automation_cohort_subject() IS
  'An automation may only point at a cohort whose subject its effects can act on. The database is the last word on what an automation may be, not the composer.';
