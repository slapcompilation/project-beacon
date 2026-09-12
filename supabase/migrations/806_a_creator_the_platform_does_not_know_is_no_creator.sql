-- 806: a creator the platform does not know is no creator
--
-- 805 defaulted datasets.created_by_user_id to auth.uid(), and the platform
-- suite refused it within the hour: workingState.test.ts sets a JWT whose
-- `sub` has no public.users row, inserts a dataset, and the default handed
-- the FK a uuid it had never seen. The migration's own proof did not catch it
-- because its two callers were a known user and no user at all; the third
-- case — a caller the platform has not registered — is the one every probe
-- and fixture is.
--
-- The default becomes the caller if the platform knows them: auth.uid() when
-- a users row carries it, NULL otherwise. Nothing else moves. 805 stays
-- as applied; this corrects it forward.
--
-- PROVED BY DOING: three inserts — a known caller, a claimed-but-unregistered
-- caller, no caller — and the creator read back as the id, NULL, NULL.

CREATE OR REPLACE FUNCTION public.known_caller()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id FROM public.users u WHERE u.id = auth.uid()
$$;
COMMENT ON FUNCTION public.known_caller() IS
  'auth.uid() when the platform has a users row for it, else NULL — the value a "created by" column may take without the FK refusing an unregistered caller.';
REVOKE ALL ON FUNCTION public.known_caller() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.known_caller() TO authenticated;

ALTER TABLE public.datasets
  ALTER COLUMN created_by_user_id SET DEFAULT public.known_caller();

DO $$
DECLARE org uuid; usr uuid; sp uuid; proj uuid; who uuid; msg text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m806 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm806-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm806-' || usr || '@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  SELECT public.create_space('M806 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m806proj', 'm806proj', sp, org) RETURNING id INTO proj;

  INSERT INTO public.datasets (api_name, name, project_id, organization_id)
  VALUES ('m806ds', 'm806', proj, org) RETURNING created_by_user_id INTO who;
  IF who IS DISTINCT FROM usr THEN RAISE EXCEPTION 'a known caller is the creator, got %', who; END IF;

  -- the case 805 missed: a caller the platform has never registered
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.datasets (api_name, name, project_id, organization_id)
  VALUES ('m806ds2', 'm806b', proj, org) RETURNING created_by_user_id INTO who;
  IF who IS NOT NULL THEN RAISE EXCEPTION 'an unregistered caller is no creator, got %', who; END IF;

  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO public.datasets (api_name, name, project_id, organization_id)
  VALUES ('m806ds3', 'm806c', proj, org) RETURNING created_by_user_id INTO who;
  IF who IS NOT NULL THEN RAISE EXCEPTION 'no caller, no creator, got %', who; END IF;

  RAISE EXCEPTION 'M806_PROBE_DONE';
EXCEPTION WHEN others THEN
  msg := SQLERRM;
  PERFORM set_config('request.jwt.claims', '', true);
  IF msg = 'M806_PROBE_DONE' THEN
    RAISE NOTICE '806 proved: known caller, unregistered caller, no caller';
  ELSE
    RAISE;
  END IF;
END $$;
