-- 798 — a host read asks what type a set is over
--
-- 797 built the resolver. This is the one thing the host needs before it may
-- call it, and it exists as its own function because of where the rule lives.
--
-- The function host answers a read only for object types the published version
-- declared as imports. That rule is ours, enforcing a documented one: the
-- repository generates code bindings for every object and link type that was
-- loaded. The host applies the gate in TypeScript for its three existing reads,
-- because each is handed an object type by the guest and can check it before
-- asking the database anything.
--
-- An object set read is given a RID instead, and a RID does not say what it is
-- over. So the host has to ask first, and this is the question: one api name,
-- read as the caller, so a set the caller cannot see is indistinguishable from
-- one that does not exist.
--
-- Deliberately NOT folded into evaluate_object_set_by_rid as a declared-types
-- argument, which was the obvious alternative. The gate belongs where the other
-- three gates already are — one place, in the host, applied the same way for
-- every read — rather than half in TypeScript and half as an array threaded
-- through SQL. A rule enforced in two shapes is a rule someone will satisfy in
-- one of them.

BEGIN;

CREATE FUNCTION public.object_set_subject_api_name(p_rid text)
RETURNS text LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v text;
BEGIN
  SELECT t.api_name INTO v
    FROM public.object_sets s
    JOIN public.object_types t ON t.id = s.subject_type_id
   WHERE s.rid = p_rid;
  IF v IS NULL THEN
    RAISE EXCEPTION 'Ontology:ObjectSetNotFound — % is not an object set you can see', p_rid;
  END IF;
  RETURN v;
END $fn$;

COMMENT ON FUNCTION public.object_set_subject_api_name(text) IS
  'The api name of the object type a stored set is over, so the function host can apply the declared-imports gate before reading it — the same gate it applies to count, page and fetch-one, which are handed a type outright. INVOKER: a set the caller cannot see is not distinguishable here from one that does not exist.';

GRANT EXECUTE ON FUNCTION public.object_set_subject_api_name(text) TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE
  org uuid; usr uuid; sp uuid; proj uuid; ont uuid; ot uuid; setrid text; v text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m798 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm798-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm798-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M798 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m798proj', 'm798proj', sp, org) RETURNING id INTO proj;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = sp;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M798Thing', 'Thing') RETURNING id INTO ot;
  INSERT INTO public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
  VALUES ('M798 set', 'm798_set', ot, proj, ont, '[]'::jsonb) RETURNING rid INTO setrid;

  v := public.object_set_subject_api_name(setrid);
  IF v <> 'M798Thing' THEN
    RAISE EXCEPTION 'the set is over M798Thing, got %', v;
  END IF;

  BEGIN
    PERFORM public.object_set_subject_api_name('ri.object-set.main.object-set.7b7f1d1e-0000-4000-8000-00000000000a');
    RAISE EXCEPTION 'an unknown set rid was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Ontology:ObjectSetNotFound%' THEN RAISE; END IF;
  END;

  DELETE FROM public.object_sets WHERE project_id = proj;
  DELETE FROM public.object_types WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE space_id = sp;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  RAISE NOTICE '798 proved: a set names its subject type, and an unknown rid is refused';
END $do$;

COMMIT;
