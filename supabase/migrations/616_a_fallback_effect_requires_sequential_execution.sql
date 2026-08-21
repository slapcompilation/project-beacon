-- A fallback may only exist on a sequential automation.
--
-- `effect-fallback` had never been read, while `fallback_for` has been in the
-- schema since 517 and the runner has executed fallbacks since 521. Reading it
-- confirms two things we got right and names one rule we do not have.
--
--   "Fallback effects can only be configured for sequential execution and are
--   not available for parallel execution."
--   — automate/effect-fallback.md
--
-- Ours allows a fallback on any automation, and `parallel` is the default, so
-- the configuration Foundry forbids is the one you get without asking.
--
-- CONFIRMED, NOT CHANGED, and worth recording because both were built from a
-- different page:
--
--   "Fallback effects are not eligible for event retries. A fallback effect
--   runs only after an object fails with a non-retryable error or reaches the
--   maximum number of retries."
--   — automate/effect-fallback.md
--
-- which is run_automations' `held` branch exactly, and
--
--   "A successful fallback execution does not resume the sequential execution
--   chain. If an effect fails and triggers a fallback, subsequent effects in
--   the sequence will not execute, even if the fallback succeeds."
--   — automate/effect-fallback.md
--
-- which is why 611 put its EXIT after the fallback block rather than before it.
-- Two pages now say so; 611 was built from the other one.
--
-- THE INTERACTION WITH 611, stated because it is not obvious: sequential needs
-- at least two ORDERABLE effects, and a fallback is not one of them — 611's
-- guard already excludes `fallback_for IS NOT NULL` from that count. So an
-- automation with a fallback needs two orderable effects PLUS the fallback.
-- That follows from the two rules together and neither page says it; it is the
-- arithmetic, not an invention.
--
-- BOTH DIRECTIONS, because either alone leaves the illegal state reachable: a
-- fallback cannot be added to a parallel automation, and an automation with a
-- fallback cannot be switched back to parallel.
--
-- NOT BUILT, and named: a fallback is "triggered on a per-object basis", and we
-- have no per-object execution; and the error information a fallback can read —
-- error message, automation RID, automation EVENT ID — is passed to nothing
-- here, the last of which waits on the event log anyway.

CREATE OR REPLACE FUNCTION public.guard_fallback_needs_sequential()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_automation uuid; v_bad int;
BEGIN
  IF TG_TABLE_NAME = 'automations' THEN
    -- switching an automation back to parallel while a fallback exists
    IF NEW.execution = 'parallel' THEN
      SELECT count(*) INTO v_bad FROM public.automation_effects e
       WHERE e.automation_id = NEW.id AND e.fallback_for IS NOT NULL;
      IF v_bad > 0 THEN
        RAISE EXCEPTION 'Automate:FallbackNeedsSequential — % fallback effect(s) exist, and fallbacks are not available for parallel execution', v_bad;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- adding a fallback to an automation that is not sequential
  IF NEW.fallback_for IS NOT NULL THEN
    v_automation := NEW.automation_id;
    IF (SELECT a.execution FROM public.automations a WHERE a.id = v_automation) <> 'sequential' THEN
      RAISE EXCEPTION 'Automate:FallbackNeedsSequential — a fallback effect can only be configured for sequential execution'
        USING HINT = 'Set the automation to sequential first; it needs at least two orderable effects besides the fallback.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_fallback_needs_sequential
  BEFORE INSERT OR UPDATE OF fallback_for ON public.automation_effects
  FOR EACH ROW EXECUTE FUNCTION public.guard_fallback_needs_sequential();

CREATE TRIGGER guard_fallback_survives_execution_change
  BEFORE UPDATE OF execution ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.guard_fallback_needs_sequential();

-- Both directions, and the legal case, proved by doing them. A probe that only
-- showed the refusal would pass against a guard that refuses everything.
DO $$
DECLARE
  v_ont uuid; v_proj uuid; v_owner uuid; v_a uuid; v_at uuid; v_e1 uuid;
BEGIN
  BEGIN
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_ont IS NULL OR v_proj IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no ontology, project or user: 616 cannot prove its own rule';
    END IF;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-616-fallback', 'Probe 616') RETURNING id INTO v_at;
    -- 613: a plain-number minute, so `0 * * * *` rather than `* * * * *`
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 616', v_owner,
            '{"type":"time","cron":"0 * * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);

    -- two orderable effects, which is what sequential needs (611)
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_a, 0, 'action', v_at) RETURNING id INTO v_e1;
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_a, 1, 'action', v_at);

    -- (1) parallel is the default, so a fallback is refused BY NAME
    BEGIN
      INSERT INTO public.automation_effects (automation_id, kind, action_type_id, fallback_for)
      VALUES (v_a, 'action', v_at, v_e1);
      RAISE EXCEPTION 'a fallback was configured on a parallel automation';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Automate:FallbackNeedsSequential%' THEN RAISE; END IF;
    END;

    -- (2) sequential, and the same insert is accepted — so the guard is not blanket
    UPDATE public.automations SET execution = 'sequential' WHERE id = v_a;
    INSERT INTO public.automation_effects (automation_id, kind, action_type_id, fallback_for)
    VALUES (v_a, 'action', v_at, v_e1);

    -- (3) and it cannot be switched back while the fallback exists
    BEGIN
      UPDATE public.automations SET execution = 'parallel' WHERE id = v_a;
      RAISE EXCEPTION 'an automation with a fallback was switched to parallel';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Automate:FallbackNeedsSequential%' THEN RAISE; END IF;
    END;

    PERFORM set_config('request.jwt.claims', '', true);
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'refused on parallel, accepted on sequential, and refused the switch back while a fallback exists';
  END;
END $$;
