-- The window closes with the body, again.
--
-- 762 spliced the usage recording into `apply_action` and
-- `apply_function_edits` on an anchor that was two statements long:
--
--   PERFORM set_config('beacon.applying_action', 'off', true);
--   RETURN written;
--
-- and replaced it with the recording call and the RETURN. The first line went
-- with it. So both doors opened the edit window 606 built and never closed it:
-- after any apply, `beacon.applying_action` stayed 'on' for the rest of the
-- transaction, and 605's guard — the one that makes an object type which
-- "only allows edits via actions" mean it — let a direct INSERT into
-- `object_edits` straight through.
--
-- The platform suite said so on the first run after 762, before any of it was
-- pushed: the case in `actions.test.ts` that asks for a direct edit on a type
-- which only allows edits via actions stopped seeing it refused. That case
-- exists because of this exact risk, and it earned its keep.
--
-- The lesson, for the next patch: an anchor that spans more than one statement
-- must be re-read in the replacement, not just extended. 748 and 755 spliced
-- at a comment line and a single statement for this reason; 762 reached for
-- two and dropped one. Where a patch means "insert before X", the safe form is
-- `replace(src, X, NEW || X)` — X survives by construction — not a hand-copied
-- replacement that must remember to include it.
--
-- Both are restored with the window closing where it always did: after the
-- rules, before the request is recorded. Recording is not an edit and does not
-- belong inside the window.

DO $patch$
DECLARE src text; f record; anchor text; close_line text;
BEGIN
  close_line := '  PERFORM set_config(''beacon.applying_action'', ''off'', true);' || chr(10);
  FOR f IN
    SELECT * FROM (VALUES
      ('public.apply_action(uuid,jsonb,text,text)',
       '  -- One write per resource this request edited (762).'),
      ('public.apply_function_edits(uuid,jsonb,uuid,text)',
       '  -- One write per resource this request edited (762). Here p_application')
    ) v(sig, anch)
  LOOP
    src := replace(pg_get_functiondef(f.sig::regprocedure), chr(13), '');
    IF (length(src) - length(replace(src, f.anch, ''))) / length(f.anch) <> 1 THEN
      RAISE EXCEPTION '764: the recording anchor is not exactly once in %', f.sig;
    END IF;
    IF position(close_line IN src) > 0 THEN
      RAISE EXCEPTION '764: % already closes the window — nothing to restore', f.sig;
    END IF;
    -- insert BEFORE the anchor by keeping the anchor in the replacement
    src := replace(src, f.anch, close_line || f.anch);
    EXECUTE src;
  END LOOP;
END $patch$;

-- ── PROVED BY DOING — the guard the defect disabled ─────────────────────────

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid; ds uuid; br uuid;
  ty uuid; act uuid; err text; n int;
BEGIN
  -- both doors close what they open, and open it exactly once
  FOR n IN
    SELECT (length(d) - length(replace(d, 'set_config(''beacon.applying_action''', ''))) /
           length('set_config(''beacon.applying_action''')
      FROM (VALUES (pg_get_functiondef('public.apply_action(uuid,jsonb,text,text)'::regprocedure)),
                   (pg_get_functiondef('public.apply_function_edits(uuid,jsonb,uuid,text)'::regprocedure))) v(d)
  LOOP
    IF n <> 2 THEN RAISE EXCEPTION 'a door should open and close the window, found % set_config calls', n; END IF;
  END LOOP;

  INSERT INTO public.organizations (name) VALUES ('m764 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm764-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm764-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M764 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm764p', 'm764 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm764ds', 'm764ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  SELECT public.save_object_type(
    jsonb_build_object('api_name', 'M764T', 'label', 'M764 T', 'ontology_id', ont,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br))),
    jsonb_build_array(jsonb_build_object('property_id', 't_id', 'display_name', 'T Id',
      'api_name', 'tId', 'base_type', 'string', 'source', 'column', 'backing_column', 't_id',
      'is_primary_key', true, 'is_title_key', true, 'required', true))) INTO ty;
  PERFORM public.save_working_state();
  UPDATE public.object_types SET edits_enabled = true WHERE id = ty;

  SELECT public.save_action_type(jsonb_build_object(
    'api_name', 'm764-make', 'label', 'M764 make', 'ontology_id', ont,
    'parameters', jsonb_build_array(jsonb_build_object(
      'api_name', 'tId', 'display_name', 'T', 'base_type', 'string', 'required', true, 'position', 0)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind', 'create_object', 'position', 0, 'object_type_id', ty,
      'properties', jsonb_build_array(jsonb_build_object(
        'property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ty AND is_primary_key),
        'value_source', 'parameter', 'parameter_api_name', 'tId')))))) INTO act;
  PERFORM public.save_working_state();

  -- the apply leaves the window shut behind it, so a direct edit is refused
  -- exactly as it is before any apply: "by default, new object types only
  -- allow edits via actions" (action-types/permissions)
  PERFORM public.apply_action(act, '{"tId":"T-1"}'::jsonb);
  BEGIN
    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
    VALUES (ty, 'T-DIRECT', 'create', '{}'::jsonb);
    RAISE EXCEPTION 'a direct edit after an apply should still be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Actions:PermissionDenied%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION USING errcode = 'P0764', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0764' THEN
  NULL;
END $$;
