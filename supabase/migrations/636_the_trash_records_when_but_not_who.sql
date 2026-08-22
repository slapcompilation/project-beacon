-- Nine provenance columns exist and nothing ever writes them. Found by
-- re-running the unread-column sweep, and the shape is an inconsistency rather
-- than a design: **the "when" column defaults and the "who" beside it does
-- not.**
--
-- Four pairs are complete — `collection_resources`, `group_members`,
-- `resource_tags` and `restricted_view_marking_stops` all default their `*_at`
-- to `now()` AND their `*_by` to `auth.uid()`. Four are half:
--
--   object_edits             applied_at  now()   applied_by_user_id  (none)
--   resource_markings        applied_at  now()   applied_by_user_id  (none)
--   object_type_datasources  added_at    now()   added_by_user_id    (none)
--   portfolio_curators       added_at    now()   added_by            (none)
--
-- so the platform records when an edit was applied, a marking attached, a
-- datasource added and a curator appointed, and never who did any of it. The
-- fix is to make the four match the four, using the default their own siblings
-- already use.
--
-- ── AND THE TRASH IS THE SAME BUG WITH A DIFFERENT CLOCK ────────────────────
-- `folders`, `datasets`, `restricted_views` and `project_resources` each carry
-- `trashed_at` and `trashed_by`. The web mutation sets `trashed_at` and nothing
-- has ever set `trashed_by`:
--
--   .update({ trashed_at: i.trashed ? new Date().toISOString() : null })
--
-- A DEFAULT cannot fix this one: trashing is an UPDATE, not an insert, so the
-- value has to be stamped when the column changes. That is a fact about the row
-- needing the auth context, which is the trigger rung.
--
-- **A trigger rather than four call sites**, deliberately: the client that
-- forgot `trashed_by` is exactly how this happened, and the next caller — a
-- bulk restore, an API, a cleanup job — would forget it again. One rule that
-- cannot be bypassed beats four that can.
--
-- ── WHY IT MATTERS, WITH THE PAGE THAT SAYS SO ─────────────────────────────
--   "To confirm the item's state while the listing catches up, review the
--   Activity log for the Project, or open the item or folder directly and
--   verify that it shows as In trash."
--   — compass/use-project-navigation-panel.md
--
-- Compass answers "what happened to this" from an Activity log, and a log that
-- cannot say who moved a file to the trash is not one.
--
-- ── WHAT IS NOT BUILT ───────────────────────────────────────────────────────
-- The Activity log itself. "The Activity log provides a running view of changes
-- made throughout the Project and is only visible at the Project level"
-- (compass/use-project-details-panel), with a stated one-month retention. That
-- is the coherent surface the fourteen already-populating provenance columns
-- are waiting for, and it is a phase rather than a tail: an event table, a
-- writer on every path that changes a resource, and a retention job that
-- DELETES, which this repository has never run. Recorded, not started.
--
-- `dataset_transactions.aborted_at` is left alone for a different reason: it is
-- the ninth column and it belongs to the transaction lifecycle, where ABORTED
-- is a status the build engine sets. It wants the same treatment at that call
-- site, not a default and not this trigger.

ALTER TABLE public.object_edits            ALTER COLUMN applied_by_user_id SET DEFAULT auth.uid();
ALTER TABLE public.resource_markings       ALTER COLUMN applied_by_user_id SET DEFAULT auth.uid();
ALTER TABLE public.object_type_datasources ALTER COLUMN added_by_user_id   SET DEFAULT auth.uid();
ALTER TABLE public.portfolio_curators      ALTER COLUMN added_by           SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.stamp_trashed_by()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Into the trash: record who put it there.
  IF NEW.trashed_at IS NOT NULL AND OLD.trashed_at IS NULL THEN
    NEW.trashed_by := auth.uid();
  -- Restored: the previous trasher is not a fact about a live resource.
  ELSIF NEW.trashed_at IS NULL AND OLD.trashed_at IS NOT NULL THEN
    NEW.trashed_by := NULL;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.stamp_trashed_by() IS
  'Records who moved a resource to the trash, and clears it on restore. A trigger rather than four call sites, because the client that set trashed_at and forgot trashed_by is how this was missed.';

CREATE TRIGGER stamp_trashed_by BEFORE UPDATE OF trashed_at ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_trashed_by();
CREATE TRIGGER stamp_trashed_by BEFORE UPDATE OF trashed_at ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.stamp_trashed_by();
CREATE TRIGGER stamp_trashed_by BEFORE UPDATE OF trashed_at ON public.restricted_views
  FOR EACH ROW EXECUTE FUNCTION public.stamp_trashed_by();
CREATE TRIGGER stamp_trashed_by BEFORE UPDATE OF trashed_at ON public.project_resources
  FOR EACH ROW EXECUTE FUNCTION public.stamp_trashed_by();

-- Proved by doing it, as a real caller, in both directions — and the restore
-- half matters as much as the trash half, because a stale trasher on a live
-- resource is worse than none.
DO $$
DECLARE
  v_org uuid; v_proj uuid; v_user uuid; v_ds uuid; v_who uuid; v_at timestamptz;
BEGIN
  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p WHERE p.organization_id = v_org
      ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_user FROM public.users u WHERE u.organization_id = v_org LIMIT 1;
    IF v_proj IS NULL OR v_user IS NULL THEN
      RAISE EXCEPTION 'no project or user: 636 cannot prove its own trigger';
    END IF;

    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (v_org, v_proj, 'trash636', 'Trash 636') RETURNING id INTO v_ds;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- (1) trashing stamps who, the way the web mutation does it — trashed_at
    -- alone, exactly the UPDATE that has been losing the information.
    UPDATE public.datasets SET trashed_at = now() WHERE id = v_ds;
    SELECT trashed_by, trashed_at INTO v_who, v_at FROM public.datasets WHERE id = v_ds;
    IF v_at IS NULL THEN RAISE EXCEPTION 'the dataset was not trashed'; END IF;
    IF v_who IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'trashing recorded % rather than the caller', coalesce(v_who::text, 'nobody');
    END IF;

    -- (2) restoring clears it
    UPDATE public.datasets SET trashed_at = NULL WHERE id = v_ds;
    SELECT trashed_by INTO v_who FROM public.datasets WHERE id = v_ds;
    IF v_who IS NOT NULL THEN
      RAISE EXCEPTION 'a restored dataset still names a trasher';
    END IF;

    -- (3) an unrelated UPDATE does not stamp anything, so the trigger is not
    -- blanket
    UPDATE public.datasets SET name = 'Trash 636 renamed' WHERE id = v_ds;
    SELECT trashed_by INTO v_who FROM public.datasets WHERE id = v_ds;
    IF v_who IS NOT NULL THEN
      RAISE EXCEPTION 'renaming a dataset marked it as trashed by someone';
    END IF;

    -- (4) and the four half pairs now default, like the four that always did
    IF (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public'
           AND (table_name, column_name) IN (
             ('object_edits', 'applied_by_user_id'),
             ('resource_markings', 'applied_by_user_id'),
             ('object_type_datasources', 'added_by_user_id'),
             ('portfolio_curators', 'added_by'))
           AND column_default LIKE '%auth.uid()%') <> 4 THEN
      RAISE EXCEPTION 'not all four who-columns took the default their siblings have';
    END IF;

    PERFORM set_config('request.jwt.claims', '', true);
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '636 proved: trashing stamps the caller, restoring clears it, a rename does neither, and the four who-columns default';
  END;
END $$;
