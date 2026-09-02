-- 739 — the action wire speaks api names.
--
-- `action_function_to_run` hands the isolate the function it should run: the
-- source, the signature, the pinned version — and the imports, which it emitted
-- as `v.imports->'object_types'` verbatim. The imports column stores UUIDS
-- (referential integrity; the publish form has sent `t.id` since it existed),
-- but the guest audience is AUTHORED CODE, and code can only speak api names:
--
--   "Any object, interface, or link types you want to use in your function
--    must be imported into the Project that contains your repository."
--   — functions/ontology-imports.md
--
-- so the isolate bound its guest globals under uuid names no identifier can
-- reach, and the mediator's declared-set check made every read raise
-- `Functions:UndeclaredImport`. Only a function that reads nothing worked.
--
-- `function_to_run` — the helper-run twin — has converted uuid to api name at
-- this exact boundary since 501. Its action-side twin never did, and the one
-- suite that could have seen it (`editFunctions.test.ts`) seeded its fixture's
-- imports with api names directly — the convention under which the defect does
-- not exist — and then never asserted `payload.object_types`. The suite gains
-- both halves alongside this migration.
--
-- The audience ruling, stated once: `imports` STORAGE stays uuids, the wire to
-- the isolate speaks api names, and the conversion lives at the boundary. Same
-- join `function_to_run` carries, patched in from the live definition with
-- nothing else moved.

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := $a$'object_types',   v.imports->'object_types',$a$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'action_function_to_run';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'imports anchor found % times', n; END IF;

  src := replace(src, anchor,
$a$-- The declared imports, as the api names the guest speaks — the same
    -- boundary conversion function_to_run has carried since 501 (739).
    'object_types',   coalesce(
      (SELECT jsonb_agg(t.api_name)
         FROM public.object_types t
        WHERE t.id::text IN (SELECT jsonb_array_elements_text(v.imports->'object_types'))),
      '[]'::jsonb),$a$);

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — a uuid import crosses the wire as an api name ─────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  t uuid; fn uuid; ver uuid; act uuid; rule_id uuid; payload jsonb;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m739 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm739-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm739-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M739 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm739p', 'm739 probe') RETURNING id INTO proj;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M739Ticket', 'M739 ticket', true) RETURNING id INTO t;

  INSERT INTO public.functions (ontology_id, api_name, display_name)
  VALUES (ont, 'm739EditFn', 'M739 edit fn') RETURNING id INTO fn;
  -- Imports as the shipped form stores them: the type's UUID.
  INSERT INTO public.function_versions
    (function_id, major, minor, patch, source, signature, imports, edits)
  VALUES (fn, 1, 0, 0, 'export default function f(){return []}',
          '{"parameters":[],"returns":"OntologyEdit[]"}'::jsonb,
          jsonb_build_object('object_types', jsonb_build_array(t::text), 'link_types', '[]'::jsonb),
          '{"object_types":["M739Ticket"]}'::jsonb) RETURNING id INTO ver;


  INSERT INTO public.action_types (ontology_id, api_name, label)
  VALUES (ont, 'm739-run', 'M739 run') RETURNING id INTO act;
  INSERT INTO public.action_type_rules
    (action_type_id, kind, position, function_name, function_version_id)
  VALUES (act, 'function', 0, 'm739EditFn', ver) RETURNING id INTO rule_id;

  payload := public.action_function_to_run(act);
  IF payload IS NULL THEN RAISE EXCEPTION 'no payload came back'; END IF;
  IF payload -> 'object_types' <> jsonb_build_array('M739Ticket') THEN
    RAISE EXCEPTION 'the wire spoke %, not the api name', payload -> 'object_types';
  END IF;
  -- The edits provenance already spoke api names; it must still.
  IF payload -> 'edits' <> jsonb_build_array('M739Ticket') THEN
    RAISE EXCEPTION 'the edits provenance moved: %', payload -> 'edits';
  END IF;

  DELETE FROM public.action_type_rules WHERE id = rule_id;
  DELETE FROM public.action_types WHERE id = act;
  DELETE FROM public.function_versions WHERE id = ver;
  DELETE FROM public.functions WHERE id = fn;
  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
