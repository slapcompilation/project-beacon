-- 666's form configuration hangs off parameter rows, and the Studio save path
-- (apply_action_type, 595) rewrote parameters wholesale — DELETE then INSERT,
-- new ids every save. One save of an action in the editor would have orphaned
-- every section membership, default reference and override block. The same
-- wholesale DELETE on the criteria table would have taken the override
-- conditions with it, because they live in that table by design (666).
--
-- Corrected forward, because the applied 595 cannot be edited:
--
-- 1. Parameters UPSERT by (action_type_id, api_name), so a surviving
--    parameter keeps its id — and with it its defaults, its section, and its
--    override blocks. Parameters absent from the payload are deleted, and
--    their form config cascades away with them, which is the right death.
-- 2. The criteria DELETE narrows to the block-less rows: the save path owns
--    submission criteria, never override conditions.
--
-- Both are anchored live-patches; 595's stored body carries CRLF (like 651's,
-- the 665 lesson), so carriage returns are stripped before anchoring.

DO $do$
DECLARE src text; a1 text; a2 text; a3 text;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action_type(jsonb,jsonb,jsonb,jsonb)'::regprocedure), chr(13), '');

  a1 := 'DELETE FROM public.action_type_submission_criteria WHERE action_type_id = t;';
  a2 := 'DELETE FROM public.action_type_parameters WHERE action_type_id = t;';
  a3 := 'coalesce((e->>''position'')::integer, 0))
    RETURNING id INTO cid;
    param_id := param_id || jsonb_build_object(e->>''api_name'', cid::text);';
  IF position(a1 in src) = 0 OR position(a2 in src) = 0 OR position(a3 in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: apply_action_type is not the text 667 read';
  END IF;

  src := replace(src, a1,
    'DELETE FROM public.action_type_submission_criteria WHERE action_type_id = t AND override_block_id IS NULL;');
  src := replace(src, a2,
    'DELETE FROM public.action_type_parameters
   WHERE action_type_id = t
     AND api_name NOT IN (SELECT p ->> ''api_name''
                            FROM jsonb_array_elements(coalesce(p_parameters, ''[]''::jsonb)) p);');
  src := replace(src, a3,
    'coalesce((e->>''position'')::integer, 0))
    ON CONFLICT (action_type_id, api_name) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           description  = EXCLUDED.description,
           base_type    = EXCLUDED.base_type,
           object_type_id = EXCLUDED.object_type_id,
           required     = EXCLUDED.required,
           exposed      = EXCLUDED.exposed,
           editable     = EXCLUDED.editable,
           position     = EXCLUDED.position
    RETURNING id INTO cid;
    param_id := param_id || jsonb_build_object(e->>''api_name'', cid::text);');
  EXECUTE src;
END $do$;

-- Proved by doing: a Studio save keeps the parameter's id and everything
-- hanging off it, deletes what left the payload, and never touches an
-- override's conditions.
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_ont uuid; v_act uuid; v_p1 uuid; v_p2 uuid;
  v_sec uuid; v_blk uuid; v_after uuid; v_n int;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe667') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe667') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_sp, 'probe667', 'Probe 667', false) RETURNING id INTO v_ont;
    INSERT INTO public.action_types (ontology_id, api_name, label)
      VALUES (v_ont, 'probe-667-action', 'Probe 667') RETURNING id INTO v_act;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, position)
      VALUES (v_act, 'keeper', 'Keeper', 'string', 0) RETURNING id INTO v_p1;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, position)
      VALUES (v_act, 'goner', 'Goner', 'string', 1) RETURNING id INTO v_p2;

    INSERT INTO public.action_type_form_sections (action_type_id, api_name, title)
      VALUES (v_act, 'section-1', 'Kept things') RETURNING id INTO v_sec;
    UPDATE public.action_type_parameters
       SET section_id = v_sec, default_source = 'static', default_static = '"kept"'
     WHERE id = v_p1;
    INSERT INTO public.action_type_parameter_overrides
      (action_type_id, parameter_id, effects)
      VALUES (v_act, v_p1, '{"disabled": true}') RETURNING id INTO v_blk;
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, override_block_id, node_type, template, user_field,
       operator, value_source, static_value)
      VALUES (v_act, v_blk, 'condition', 'current_user', 'user_id',
              'is', 'static', '"nobody"');
    -- and one real submission criterion, which the save path DOES own
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, node_type, template, user_field, operator, value_source, static_value)
      VALUES (v_act, 'condition', 'current_user', 'user_id', 'is not', 'static', '"nobody"');

    -- the Studio save: keeper stays (renamed), goner is gone
    PERFORM public.apply_action_type(
      jsonb_build_object('id', v_act),
      jsonb_build_array(jsonb_build_object(
        'api_name', 'keeper', 'display_name', 'Keeper renamed',
        'base_type', 'string', 'position', 0)));

    SELECT id INTO v_after FROM public.action_type_parameters
     WHERE action_type_id = v_act AND api_name = 'keeper';
    IF v_after IS DISTINCT FROM v_p1 THEN
      RAISE EXCEPTION 'the save changed the surviving parameter''s id';
    END IF;
    IF EXISTS (SELECT 1 FROM public.action_type_parameters WHERE id = v_p2) THEN
      RAISE EXCEPTION 'the vanished parameter should be deleted';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.action_type_parameters
                    WHERE id = v_p1 AND section_id = v_sec
                      AND default_static = '"kept"'::jsonb
                      AND display_name = 'Keeper renamed') THEN
      RAISE EXCEPTION 'the surviving parameter lost its form config or missed the rename';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.action_type_parameter_overrides WHERE id = v_blk) THEN
      RAISE EXCEPTION 'the override block did not survive the save';
    END IF;
    SELECT count(*) INTO v_n FROM public.action_type_submission_criteria
     WHERE action_type_id = v_act AND override_block_id IS NOT NULL;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'the override condition did not survive the save, % remain', v_n;
    END IF;
    SELECT count(*) INTO v_n FROM public.action_type_submission_criteria
     WHERE action_type_id = v_act AND override_block_id IS NULL;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'the save path should have rewritten (here: cleared) the submission criteria, % remain', v_n;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '667 proved: a Studio save keeps the surviving parameter''s id with its section, default and override intact, applies the rename, deletes the vanished parameter, and rewrites only the block-less criteria';
  END;
END $$;
