-- 636 gave four `*_by` columns the `auth.uid()` default their siblings already
-- had, and two of them broke inserts. The platform suite caught it on the next
-- run: `restrictedViews` and `workingState` both failed with
--
--   insert or update on table object_type_datasources violates foreign key
--   constraint object_type_datasources_added_by_user_id_fkey
--
-- ── WHAT I MISSED, WHICH IS THE POINT ───────────────────────────────────────
-- The four working siblings all reference **auth.users**:
--
--   collection_resources.added_by              -> auth.users
--   group_members.added_by                     -> auth.users
--   resource_tags.applied_by                   -> auth.users
--   restricted_view_marking_stops.stopped_by   -> auth.users
--
-- and every authenticated caller is in `auth.users` by construction, so
-- `DEFAULT auth.uid()` can never dangle. Two of the four I changed reference
-- **public.users**, our own profile table, where membership is NOT guaranteed:
--
--   object_type_datasources.added_by_user_id   -> public.users
--   resource_markings.applied_by_user_id       -> public.users
--
-- I copied a pattern without checking its precondition. The pattern was sound;
-- the precondition was the foreign key, and it differs between the two groups.
--
-- ── THE FIX KEEPS THE INTENT ────────────────────────────────────────────────
-- Reverting the default would leave the column unwritten again, which was the
-- defect. A BEFORE INSERT trigger stamps it only when the caller HAS a profile
-- row, and leaves NULL when they do not — so the column records who whenever
-- that is knowable, and never refuses an insert to say so.
--
-- Same rung and the same reasoning as 636's `stamp_trashed_by`: a fact about
-- the row that needs another table is a trigger, not a default.
--
-- The other two stay as defaults, because they reference `auth.users` and match
-- their four working siblings exactly.

ALTER TABLE public.object_type_datasources ALTER COLUMN added_by_user_id   DROP DEFAULT;
ALTER TABLE public.resource_markings       ALTER COLUMN applied_by_user_id DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.stamp_actor_if_known()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_who uuid;
BEGIN
  SELECT u.id INTO v_who FROM public.users u WHERE u.id = auth.uid();
  IF TG_TABLE_NAME = 'object_type_datasources' THEN
    IF NEW.added_by_user_id IS NULL THEN NEW.added_by_user_id := v_who; END IF;
  ELSE
    IF NEW.applied_by_user_id IS NULL THEN NEW.applied_by_user_id := v_who; END IF;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.stamp_actor_if_known() IS
  'Records who added a datasource or applied a marking, when the caller has a public.users row. These two foreign keys point at public.users rather than auth.users, so a DEFAULT auth.uid() can dangle — 637.';

CREATE TRIGGER stamp_actor_if_known BEFORE INSERT ON public.object_type_datasources
  FOR EACH ROW EXECUTE FUNCTION public.stamp_actor_if_known();
CREATE TRIGGER stamp_actor_if_known BEFORE INSERT ON public.resource_markings
  FOR EACH ROW EXECUTE FUNCTION public.stamp_actor_if_known();

-- Both directions, and the second one is the whole reason this file exists: a
-- caller with no profile must still be able to insert.
DO $$
DECLARE
  v_org uuid; v_ont uuid; v_ot uuid; v_user uuid; v_ds uuid; v_br uuid;
  v_proj uuid; v_who uuid; v_id uuid;
BEGIN
  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_user FROM public.users u WHERE u.organization_id = v_org LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p WHERE p.organization_id = v_org LIMIT 1;
    IF v_ont IS NULL OR v_user IS NULL OR v_proj IS NULL THEN
      RAISE EXCEPTION 'no ontology, user or project: 637 cannot prove its own trigger';
    END IF;

    -- Its own dataset and branch: a datasource pair may back only one object
    -- type, so borrowing an existing one raises before the trigger is reached.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (v_org, v_proj, 'stamp637', 'Stamp 637') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
    VALUES (v_ds, 'master') RETURNING id INTO v_br;

    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (v_ont, 'Stamp637', 'Stamp 637') RETURNING id INTO v_ot;

    -- (1) a caller WITH a profile is recorded
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
    VALUES (v_ot, v_ds, v_br) RETURNING id INTO v_id;
    SELECT added_by_user_id INTO v_who FROM public.object_type_datasources WHERE id = v_id;
    IF v_who IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'a known caller was recorded as %', coalesce(v_who::text, 'nobody');
    END IF;
    DELETE FROM public.object_type_datasources WHERE id = v_id;

    -- (2) a caller with NO profile row still gets their insert, which is the
    -- case 636's default refused and the suite caught.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
    VALUES (v_ot, v_ds, v_br) RETURNING id INTO v_id;
    SELECT added_by_user_id INTO v_who FROM public.object_type_datasources WHERE id = v_id;
    IF v_who IS NOT NULL THEN
      RAISE EXCEPTION 'an unknown caller was recorded as %', v_who;
    END IF;

    -- (3) and the two that reference auth.users keep the default, so the four
    -- working siblings and their two new matches stay one pattern
    IF (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public'
           AND (table_name, column_name) IN (
             ('object_edits', 'applied_by_user_id'), ('portfolio_curators', 'added_by'))
           AND column_default LIKE '%auth.uid()%') <> 2 THEN
      RAISE EXCEPTION 'the auth.users-backed columns lost their default';
    END IF;

    PERFORM set_config('request.jwt.claims', '', true);
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '637 proved: a known caller is recorded, an unknown one still inserts, and the auth.users pair keeps its default';
  END;
END $$;
