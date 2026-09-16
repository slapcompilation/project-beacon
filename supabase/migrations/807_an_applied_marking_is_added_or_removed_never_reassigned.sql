-- An applied marking is added or removed, never reassigned.
--
-- Found while reading the markings corpus, by an adversary re-running the
-- claim that `resource_markings` is governed. It is governed on two of three
-- write paths and open on the third, and the catalogues say so plainly:
--
--   · RLS is enabled, and the only write policy is FOR ALL with
--     USING (true) WITH CHECK (true);
--   · `guard_marking_application` — the function that actually checks the
--     apply and remove permissions — is BEFORE INSERT OR DELETE. Not UPDATE.
--   · `log_marking_activity` is AFTER INSERT OR DELETE. Not UPDATE either.
--
-- So an UPDATE reaches the table with no permission check and no activity
-- record. Every identifying column is updatable — the row is
-- (marking_id, resource_kind, resource_id, applied_by_user_id, applied_at) —
-- so `UPDATE resource_markings SET marking_id = <another>` removes a marking
-- from a resource without the remove permission and applies a different one
-- without the apply permission, in one statement. That is the whole mandatory
-- control, bypassed. `audit_management_permissions` does fire on UPDATE, so
-- the act is recorded; it is not prevented.
--
-- A sweep for the same shape across the schema — a BEFORE guard trigger with
-- no UPDATE arm under a permissive FOR ALL/UPDATE policy — returns exactly one
-- table. This is a contained defect, not a pattern.
--
-- WHY REFUSE RATHER THAN WIDEN THE GUARD. Adding UPDATE to
-- `guard_marking_application` would be wrong, and readably so: its apply branch
-- checks `can_apply_marking(NEW.marking_id)` and its remove branch
-- `can_remove_marking(OLD.marking_id)`, and an UPDATE is both at once. Falling
-- into the apply branch would check the incoming marking and never check the
-- outgoing one — a permission hole with a guard in front of it, which is worse
-- than an open door because it looks shut.
--
-- Foundry does not have the operation at all. The filesystem API publishes two
-- verbs against a resource's markings and no third:
--
--   "Adds a list of Markings to a resource."
--   — api/v2/filesystem-v2-resources/resources-add-markings.md

--   "Removes Markings from a resource."
--   — api/v2/filesystem-v2-resources/resources-remove-markings.md
--
-- The only PUT anywhere in `api/` that names a marking is on the marking's own
-- definition (`PUT /api/v2/admin/markings/{markingId}`), never on an
-- application of one. So an application added-or-removed-but-never-edited is
-- Foundry's shape, not our invention.
--
-- Nothing here updates the table either: no migration contains an UPDATE
-- against it, and the platform suite only ever inserts and deletes.
--
-- TWO RUNGS, DELIBERATELY. CLAUDE.md says stop at the first rung that can hold
-- the rule, and RLS holds the `authenticated` half of it — splitting the
-- FOR ALL policy does that, and also stops a write policy being evaluated on
-- every SELECT (619's lesson). But the fact is stronger than that rung: there
-- is no update operation for ANY role, and a SECURITY DEFINER path bypasses
-- RLS entirely. The trigger is what makes it true for the owner and for every
-- SECDEF function, so both are here.

-- 1. The write policy becomes two, one per operation that exists.
drop policy if exists "apply and remove markings" on public.resource_markings;

create policy "apply markings" on public.resource_markings
  for insert to authenticated with check (true);

create policy "remove markings" on public.resource_markings
  for delete to authenticated using (true);

-- There is deliberately no UPDATE policy. The permission check itself stays
-- where it was, in guard_marking_application.

-- 2. And the operation does not exist for anyone, RLS bypass included.
create or replace function public.refuse_marking_reassignment()
returns trigger language plpgsql as $$
BEGIN
  RAISE EXCEPTION 'Markings:CannotReassign — an applied marking is added or removed, never reassigned'
    USING HINT = 'Delete the row and insert the new one, so the apply and remove permissions are each checked.';
END $$;

comment on function public.refuse_marking_reassignment() is
  'resource_markings has no update operation. Foundry publishes addMarkings and removeMarkings against a resource and no third verb; an UPDATE would be an apply and a remove at once, and guard_marking_application can only check one of them.';

drop trigger if exists refuse_marking_reassignment on public.resource_markings;
create trigger refuse_marking_reassignment
  before update on public.resource_markings
  for each row execute function public.refuse_marking_reassignment();

-- PROVED BY DOING.
--
-- Not "the trigger exists" — 592's lesson is that a catalogue assertion passes
-- while the body is broken. This inserts a real row, attempts the reassignment
-- the hole allowed, and requires the refusal by name. The guard is disabled
-- only to plant and remove the fixture, which is what security.test.ts already
-- does; the trigger under test is never disabled.
DO $$
DECLARE
  v_marking uuid;
  v_other   uuid;
  v_ds      uuid;
  v_msg     text;
  v_fired   boolean := false;
BEGIN
  SELECT id INTO v_marking FROM public.markings ORDER BY id LIMIT 1;
  SELECT id INTO v_other   FROM public.markings ORDER BY id DESC LIMIT 1;
  SELECT id INTO v_ds      FROM public.datasets ORDER BY id LIMIT 1;

  IF v_marking IS NULL OR v_ds IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need at least one marking and one dataset (markings=%, datasets=%)',
      (SELECT count(*) FROM public.markings), (SELECT count(*) FROM public.datasets);
  END IF;

  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (v_marking, 'dataset', v_ds);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  BEGIN
    UPDATE public.resource_markings
       SET marking_id = v_other
     WHERE marking_id = v_marking AND resource_kind = 'dataset' AND resource_id = v_ds;
    -- Reached only if the trigger did not fire.
  EXCEPTION WHEN others THEN
    v_msg := SQLERRM;
    v_fired := true;
  END;

  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings
   WHERE resource_kind = 'dataset' AND resource_id = v_ds;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  IF NOT v_fired THEN
    RAISE EXCEPTION 'PROOF FAILED: the UPDATE succeeded — the hole this migration closes is still open';
  END IF;

  IF v_msg NOT LIKE 'Markings:CannotReassign%' THEN
    RAISE EXCEPTION 'PROOF FAILED: refused, but by something else: %', v_msg;
  END IF;

  RAISE NOTICE 'PROVED: reassigning an applied marking raises %', v_msg;
END $$;

-- And the policy split is proved the same way, by asking the catalogue what an
-- UPDATE would be allowed to do rather than trusting the DDL above.
DO $$
DECLARE n_update int; n_all int;
BEGIN
  SELECT count(*) INTO n_update FROM pg_policies
   WHERE schemaname='public' AND tablename='resource_markings' AND cmd='UPDATE';
  SELECT count(*) INTO n_all FROM pg_policies
   WHERE schemaname='public' AND tablename='resource_markings' AND cmd='ALL';
  IF n_update > 0 OR n_all > 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: resource_markings still carries % UPDATE and % FOR ALL policy(ies)', n_update, n_all;
  END IF;
  RAISE NOTICE 'PROVED: no UPDATE and no FOR ALL policy remains on resource_markings';
END $$;
