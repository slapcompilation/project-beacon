-- 805: a dataset remembers who created it
--
-- Reading: docs/foundry-reference/readings/dataset-preview.md (§2).
--
--   "* **About:** Information including the time the dataset was created and updated, the users who created and last updated the dataset, the size of the table, any tools and input datasets used to create the data, tags, and more."
--   — dataset-preview/overview.md
--
-- 392 gave datasets a created_by_user_id and nothing ever wrote it: the web's
-- insert names no creator, and neither does generate_backing_dataset. So the
-- About panel's "Created … by" row, built to the capture in 804's surface, had
-- nothing to say. The column takes the caller as its default, which is the
-- same answer every insert path would have given had it been asked.
--
-- Not "last updated by": nothing here records who wrote a transaction, so the
-- Updated row keeps its time alone. Recorded in docs/SURFACE-BUILD-MAP.md §1.
--
-- PROVED BY DOING: the block inserts a dataset as a real caller and reads the
-- creator back; then inserts one with no caller and reads NULL, because a
-- fixture or a migration inserting as the owner must not be refused.

ALTER TABLE public.datasets
  ALTER COLUMN created_by_user_id SET DEFAULT auth.uid();

COMMENT ON COLUMN public.datasets.created_by_user_id IS
  'Who created the dataset — the About panel''s "Created … by". Defaults to the caller; NULL when there is none (a fixture, a migration).';

DO $$
DECLARE org uuid; usr uuid; sp uuid; proj uuid; who uuid; msg text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m805 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm805-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm805-' || usr || '@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  SELECT public.create_space('M805 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m805proj', 'm805proj', sp, org) RETURNING id INTO proj;

  INSERT INTO public.datasets (api_name, name, project_id, organization_id)
  VALUES ('m805ds', 'm805', proj, org) RETURNING created_by_user_id INTO who;
  IF who IS DISTINCT FROM usr THEN
    RAISE EXCEPTION 'the caller should be recorded as the creator, got %', who;
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO public.datasets (api_name, name, project_id, organization_id)
  VALUES ('m805ds2', 'm805b', proj, org) RETURNING created_by_user_id INTO who;
  IF who IS NOT NULL THEN RAISE EXCEPTION 'with no caller the creator is NULL, got %', who; END IF;

  RAISE EXCEPTION 'M805_PROBE_DONE';
EXCEPTION WHEN others THEN
  msg := SQLERRM;
  PERFORM set_config('request.jwt.claims', '', true);
  IF msg = 'M805_PROBE_DONE' THEN
    RAISE NOTICE '805 proved: the creator is the caller, and NULL without one';
  ELSE
    RAISE;
  END IF;
END $$;
