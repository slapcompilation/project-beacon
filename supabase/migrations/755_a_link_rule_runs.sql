-- 755 — a link rule runs.
--
-- The registry's own note for create_link and delete_link — a link instance
-- store does not exist yet — expired when 750 built the store and 753 built
-- the log. The rules page defines the pair exactly:
--
--   "Create link(s): Can be used to create a many-to-many link between
--    objects that are passed via object reference parameters. For foreign key
--    links, one has to use Modify object rule to explicitly modify the
--    foreign key property."
--   — action-types/rules.md
--
--   "Delete link: Can be used to delete a many-to-many link between objects
--    that are passed via object reference parameters. For foreign key links,
--    one has to use Modify object rule to explicitly modify the foreign key
--    property."
--   — action-types/rules.md
--
-- and bounds what may feed them:
--
--   "Rules on links can only take object reference parameters"
--   — action-types/rules.md
--
--   "While just creating a many-to-many link requires objects on both sides
--    of the link to exist prior, you can create both entities via one action
--    type."
--   — action-types/rules.md
--
-- So a link rule names its link (the column 418 already carries) and its two
-- sides as parameter references — id-resolved at landing the way rule inputs
-- are, cascading the way rule inputs do. At apply time the rule reuses 753's
-- machinery whole: both endpoints must exist, a duplicate create refuses with
-- the api's LinkAlreadyExists, the edit logs and hits the store synchronously
-- inside the action window, the rebuild replays it, and the revert
-- compensates it. The create-object-with-Add-link composite (the page's
-- "Creating an object & many-to-many link") is NOT built here — recorded
-- residual, it needs the create rule to carry link sub-rules.

ALTER TABLE public.action_type_rules
  ADD COLUMN source_parameter_id uuid REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  ADD COLUMN target_parameter_id uuid REFERENCES public.action_type_parameters(id) ON DELETE CASCADE;
COMMENT ON COLUMN public.action_type_rules.source_parameter_id IS
  'A link rule''s source side: an object reference parameter ("Rules on links can only take object reference parameters"). 755.';
COMMENT ON COLUMN public.action_type_rules.target_parameter_id IS
  'A link rule''s target side, the same way. 755.';

-- ── the shared core 753''s arm and this one both stand on ────────────────────

CREATE FUNCTION public.write_link_edit(
  p_link uuid, p_a text, p_b text, p_instruction text, p_action uuid, p_application uuid)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE lk record; s jsonb; exists_now boolean; changed boolean;
BEGIN
  SELECT l.*, st.api_name AS source_type_api, tt.api_name AS target_type_api INTO lk
    FROM public.link_types l
    JOIN public.object_types st ON st.id = l.source_object_type_id
    JOIN public.object_types tt ON tt.id = l.target_object_type_id
   WHERE l.id = p_link;

  -- "requires objects on both sides of the link to exist prior", and the
  -- permission page's load-both-endpoints rule.
  SELECT st.properties INTO s FROM public.object_before_state(lk.source_object_type_id, p_a) st;
  IF s IS NULL OR s = '{}'::jsonb THEN
    RAISE EXCEPTION 'Ontology:LinkedObjectNotFound — % has no object "%"', lk.source_type_api, p_a;
  END IF;
  SELECT st.properties INTO s FROM public.object_before_state(lk.target_object_type_id, p_b) st;
  IF s IS NULL OR s = '{}'::jsonb THEN
    RAISE EXCEPTION 'Ontology:LinkedObjectNotFound — % has no object "%"', lk.target_type_api, p_b;
  END IF;

  exists_now := public.link_pair_exists(p_link, p_a, p_b);
  IF p_instruction = 'addLink' AND exists_now THEN
    RAISE EXCEPTION 'Ontology:LinkAlreadyExists — % already links "%" and "%"', lk.api_name, p_a, p_b;
  END IF;

  changed := public.replay_link_edit_to_store(p_link, p_instruction, p_a, p_b);
  IF p_instruction = 'deleteLink' AND exists_now IS NOT NULL AND NOT changed THEN
    RETURN;   -- a no-op unlink logs nothing (753's marked inference)
  END IF;

  INSERT INTO public.link_edits
    (link_type_id, a_key, b_key, instruction, applied_by_user_id, action_type_id, application_id)
  VALUES (p_link, p_a, p_b, p_instruction, auth.uid(), p_action, p_application);
END $fn$;

-- 753's guest-facing arm keeps its resolution and provenance, and delegates
-- its tail to the shared core. Same signature, so grants stay.
CREATE OR REPLACE FUNCTION public.apply_link_edit(
  p_variant text, p_body jsonb, p_allowed text[], p_action uuid, p_application uuid)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  aname text; a_type text; b_type text; a_key text; b_key text;
  lk record; s jsonb;
BEGIN
  aname  := p_body ->> 'linkTypeApiNameAtoB';
  a_type := p_body -> 'aSideObject' ->> 'objectType';
  b_type := p_body -> 'bSideObject' ->> 'objectType';
  a_key  := p_body -> 'aSideObject' ->> 'primaryKey';
  b_key  := p_body -> 'bSideObject' ->> 'primaryKey';
  IF aname IS NULL OR a_type IS NULL OR b_type IS NULL OR a_key IS NULL OR b_key IS NULL THEN
    RAISE EXCEPTION 'Actions:MalformedEdit — % names a link and both sides', p_variant;
  END IF;

  SELECT l.*, st.api_name AS source_type_api, tt.api_name AS target_type_api INTO lk
    FROM public.link_types l
    JOIN public.object_types st ON st.id = l.source_object_type_id
    JOIN public.object_types tt ON tt.id = l.target_object_type_id
    JOIN public.action_types a ON a.id = p_action AND a.ontology_id = l.ontology_id
   WHERE (l.api_name = aname OR l.source_api_name = aname OR l.target_api_name = aname)
     AND ((st.api_name = a_type AND tt.api_name = b_type)
          OR (st.api_name = b_type AND tt.api_name = a_type));
  IF lk IS NULL THEN
    RAISE EXCEPTION 'Ontology:LinkTypeNotFound — % is not a link between % and %', aname, a_type, b_type;
  END IF;
  IF lk.backing_kind IS DISTINCT FROM 'join_table' THEN
    RAISE EXCEPTION 'Actions:LinkEditsNotSupported — % is edited by updating its foreign key property', lk.api_name
      USING HINT = 'For one-to-one and one-to-many links, use the update method to modify the foreign key property of the source object.';
  END IF;
  IF lk.source_type_api <> a_type THEN
    s := to_jsonb(a_key); a_key := b_key; b_key := s #>> '{}';
  END IF;
  IF NOT (lk.source_type_api = ANY (p_allowed) AND lk.target_type_api = ANY (p_allowed)) THEN
    RAISE EXCEPTION 'Functions:UndeclaredObjectTypeEdited — a % edit declares both % and %',
      lk.api_name, lk.source_type_api, lk.target_type_api;
  END IF;

  PERFORM public.write_link_edit(lk.id, a_key, b_key, p_variant, p_action, p_application);
END $fn$;

-- ── the rule arm ────────────────────────────────────────────────────────────

CREATE FUNCTION public.apply_rule_link_edit(
  p_rule uuid, p_action uuid, p_parameters jsonb, p_application uuid)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE r record; lk record; sp record; tp record; a_key text; b_key text;
BEGIN
  SELECT * INTO r FROM public.action_type_rules WHERE id = p_rule;
  IF r.link_type_id IS NULL OR r.source_parameter_id IS NULL OR r.target_parameter_id IS NULL THEN
    RAISE EXCEPTION 'Actions:LinkRuleIncomplete — a % rule names its link and both object reference parameters', r.kind;
  END IF;
  SELECT l.* INTO lk FROM public.link_types l WHERE l.id = r.link_type_id;
  IF lk.backing_kind IS DISTINCT FROM 'join_table' THEN
    -- "For foreign key links, one has to use Modify object rule to explicitly
    -- modify the foreign key property."
    RAISE EXCEPTION 'Actions:LinkEditsNotSupported — % is edited by updating its foreign key property', lk.api_name;
  END IF;

  -- "Rules on links can only take object reference parameters"
  SELECT * INTO sp FROM public.action_type_parameters WHERE id = r.source_parameter_id;
  SELECT * INTO tp FROM public.action_type_parameters WHERE id = r.target_parameter_id;
  IF sp.data_kind IS DISTINCT FROM 'object' OR tp.data_kind IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Actions:LinkRuleNeedsObjectReferences — rules on links can only take object reference parameters';
  END IF;
  a_key := p_parameters ->> sp.api_name;
  b_key := p_parameters ->> tp.api_name;
  IF a_key IS NULL OR b_key IS NULL THEN
    RAISE EXCEPTION 'Actions:MissingParameter — "%" and "%" name the two objects to link',
      sp.api_name, tp.api_name;
  END IF;

  PERFORM public.write_link_edit(lk.id, a_key, b_key,
    CASE r.kind WHEN 'create_link' THEN 'addLink' ELSE 'deleteLink' END,
    p_action, p_application);
END $fn$;

REVOKE ALL ON FUNCTION public.write_link_edit(uuid, text, text, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_rule_link_edit(uuid, uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_link_edit(uuid, text, text, text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_rule_link_edit(uuid, uuid, jsonb, uuid) TO authenticated, service_role;

-- ── the seams: the registry, the dispatcher, the landing ────────────────────

DO $patch$
DECLARE src text; n int; anchor text; addition text;
BEGIN
  -- action_rule_kinds: the two rows whose reason expired.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'action_rule_kinds';
  anchor := '    (''create_link'', ''link_type'', false, ''sql'',' || chr(10) ||
            '     ''A link instance store does not exist yet.''),';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'action_rule_kinds: create_link anchor found % times', n; END IF;
  src := replace(src, anchor,
    '    (''create_link'', ''link_type'', true, ''sql'',' || chr(10) ||
    '     ''Creates a many-to-many link between objects passed via object reference parameters (755).''),');
  anchor := '    (''delete_link'', ''link_type'', false, ''sql'',' || chr(10) ||
            '     ''A link instance store does not exist yet.''),';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'action_rule_kinds: delete_link anchor found % times', n; END IF;
  src := replace(src, anchor,
    '    (''delete_link'', ''link_type'', true, ''sql'',' || chr(10) ||
    '     ''Deletes a many-to-many link between objects passed via object reference parameters (755).''),');
  EXECUTE src;

  -- apply_action: the link arm, right after the runtime check.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_action';
  anchor := '    -- ── which object type this rule edits ──────────────────────────────────';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_action: dispatch anchor found % times', n; END IF;
  addition :=
    '    -- ── link rules (755): both sides from object reference parameters ──────' || chr(10) ||
    '    IF r.kind IN (''create_link'', ''delete_link'') THEN' || chr(10) ||
    '      PERFORM public.apply_rule_link_edit(r.id, p_action_type, p_parameters, app);' || chr(10) ||
    '      written := written + 1;' || chr(10) ||
    '      CONTINUE;' || chr(10) ||
    '    END IF;' || chr(10) || chr(10);
  src := replace(src, anchor, addition || anchor);
  EXECUTE src;

  -- apply_action_type: the parameter upsert never carried data_kind, so an
  -- object reference parameter could not land through the front door at all —
  -- it defaulted to base_type and tripped the payload CHECK. Carried now,
  -- inferred as object when an object_type_id is present so old payloads keep
  -- meaning what they meant. Then the rule INSERT carries the two sides,
  -- resolved from the parameter map the way rule inputs are.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_action_type';
  anchor := '       required, exposed, editable, position)';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_action_type: parameter columns anchor found % times', n; END IF;
  src := replace(src, anchor, '       required, exposed, editable, position, data_kind)');
  anchor := '            coalesce((e->>''position'')::integer, 0))';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_action_type: parameter values anchor found % times', n; END IF;
  src := replace(src, anchor,
    '            coalesce((e->>''position'')::integer, 0),' || chr(10) ||
    '            coalesce(nullif(e->>''data_kind'',''''),' || chr(10) ||
    '                     CASE WHEN nullif(e->>''object_type_id'','''') IS NOT NULL THEN ''object'' ELSE ''base_type'' END))');
  anchor := '           object_type_id = EXCLUDED.object_type_id,';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_action_type: parameter set anchor found % times', n; END IF;
  src := replace(src, anchor,
    '           object_type_id = EXCLUDED.object_type_id,' || chr(10) ||
    '           data_kind    = EXCLUDED.data_kind,');
  anchor := '      (action_type_id, kind, position, object_type_id, link_type_id, function_name,' || chr(10) ||
            '       function_version_id, auto_upgrade, interface_id, schedule_id)';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_action_type: insert anchor found % times', n; END IF;
  src := replace(src, anchor,
    '      (action_type_id, kind, position, object_type_id, link_type_id, function_name,' || chr(10) ||
    '       function_version_id, auto_upgrade, interface_id, schedule_id,' || chr(10) ||
    '       source_parameter_id, target_parameter_id)');
  anchor := '            nullif(e->>''schedule_id'','''')::uuid)';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_action_type: values anchor found % times', n; END IF;
  src := replace(src, anchor,
    '            nullif(e->>''schedule_id'','''')::uuid,' || chr(10) ||
    '            (param_id->>(e->>''source_parameter_api_name''))::uuid,' || chr(10) ||
    '            (param_id->>(e->>''target_parameter_api_name''))::uuid)');
  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — the rule pair, end to end ─────────────────────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  dsa uuid; dsb uuid; jds uuid; bra uuid; brb uuid; jbr uuid;
  txn uuid; file_id uuid; phys text;
  ta uuid; tb uuid; ln uuid; act uuid; del_act uuid; b uuid; st text; err text;
  n bigint; itbl text; app uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m755 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm755-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm755-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M755 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm755p', 'm755 probe') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm755a', 'm755a') RETURNING id INTO dsa;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsa, 'master') RETURNING id INTO bra;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsa, bra, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsa, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsa, txn, 'rows.parquet', 2) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsa, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1,''A1''), ($1,''A2'')', phys)
    USING file_id;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm755b', 'm755b') RETURNING id INTO dsb;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsb, 'master') RETURNING id INTO brb;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsb, brb, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsb, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsb, txn, 'rows.parquet', 1) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsb, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1,''B1'')', phys)
    USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M755A', 'M755 A', true) RETURNING id INTO ta;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (ta, dsa, bra);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ta, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M755B', 'M755 B', true) RETURNING id INTO tb;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (tb, dsb, brb);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (tb, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  SELECT public.run_index_build(ARRAY[ta, tb]::uuid[], true) INTO b;
  IF EXISTS (SELECT 1 FROM public.build_jobs bj WHERE bj.build_id = b AND bj.state <> 'COMPLETED') THEN
    RAISE EXCEPTION 'the side indexes did not land';
  END IF;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm755join', 'm755join') RETURNING id INTO jds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (jds, 'master') RETURNING id INTO jbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (jds, jbr, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (jds, txn, '[{"name":"a_key","type":"STRING"},{"name":"b_key","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (jds, txn, 'rows.parquet', 0) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  PERFORM public.dataset_materialize(jds, txn);
  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, dataset_id, branch_id,
     source_key_column, target_key_column,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm755-pairs', 'M755 pairs', 'many_to_many', 'join_table',
          jds, jbr, 'a_key', 'b_key', 'as', 'As', 'bs', 'Bs')
  RETURNING id INTO ln;
  SELECT public.run_link_index_build(ARRAY[ln]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj
   WHERE bj.build_id = b AND bj.output_link_type_id = ln;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'the pair build did not land: %', coalesce(err, '?'); END IF;
  SELECT i.index_table INTO itbl FROM public.link_type_indexes i WHERE i.link_type_id = ln;

  -- The action lands through the front door: staged, then saved, so the
  -- parameter references resolve the way the surface's do.
  PERFORM public.save_action_type(jsonb_build_object(
    'api_name', 'm755-link', 'label', 'M755 link', 'ontology_id', ont, 'project_id', proj,
    'parameters', jsonb_build_array(
      jsonb_build_object('api_name', 'left', 'display_name', 'Left',
        'data_kind', 'object', 'object_type_id', ta,
        'required', true, 'exposed', true, 'editable', true, 'position', 0),
      jsonb_build_object('api_name', 'right', 'display_name', 'Right',
        'data_kind', 'object', 'object_type_id', tb,
        'required', true, 'exposed', true, 'editable', true, 'position', 1)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind', 'create_link', 'position', 0, 'link_type_id', ln,
      'source_parameter_api_name', 'left', 'target_parameter_api_name', 'right',
      'properties', '[]'::jsonb))));
  PERFORM public.save_working_state();
  SELECT id INTO act FROM public.action_types WHERE api_name = 'm755-link' AND ontology_id = ont;

  -- Create: the pair lands in the store and the log, counted as one edit.
  SELECT public.apply_action(act, '{"left":"A1","right":"B1"}'::jsonb) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'one link rule should write one edit, wrote %', n; END IF;
  EXECUTE format('SELECT count(*) FROM objects.%I WHERE a_key = ''A1'' AND b_key = ''B1''', itbl) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the created link is not in the store'; END IF;
  SELECT count(*) INTO n FROM public.link_edits WHERE link_type_id = ln AND instruction = 'addLink';
  IF n <> 1 THEN RAISE EXCEPTION 'the created link is not in the log'; END IF;

  -- A duplicate refuses with the api's name; a missing endpoint refuses too.
  BEGIN
    PERFORM public.apply_action(act, '{"left":"A1","right":"B1"}'::jsonb);
    RAISE EXCEPTION 'a duplicate link was created by rule';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%LinkAlreadyExists%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.apply_action(act, '{"left":"A9","right":"B1"}'::jsonb);
    RAISE EXCEPTION 'a link to a missing object was created by rule';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%LinkedObjectNotFound%' THEN RAISE; END IF;
  END;

  -- The delete rule takes it back out — and the revert restores it.
  PERFORM public.save_action_type(jsonb_build_object(
    'api_name', 'm755-unlink', 'label', 'M755 unlink', 'ontology_id', ont, 'project_id', proj,
    'parameters', jsonb_build_array(
      jsonb_build_object('api_name', 'left', 'display_name', 'Left',
        'data_kind', 'object', 'object_type_id', ta,
        'required', true, 'exposed', true, 'editable', true, 'position', 0),
      jsonb_build_object('api_name', 'right', 'display_name', 'Right',
        'data_kind', 'object', 'object_type_id', tb,
        'required', true, 'exposed', true, 'editable', true, 'position', 1)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind', 'delete_link', 'position', 0, 'link_type_id', ln,
      'source_parameter_api_name', 'left', 'target_parameter_api_name', 'right',
      'properties', '[]'::jsonb))));
  PERFORM public.save_working_state();
  SELECT id INTO del_act FROM public.action_types WHERE api_name = 'm755-unlink' AND ontology_id = ont;
  PERFORM public.apply_action(del_act, '{"left":"A1","right":"B1"}'::jsonb);
  EXECUTE format('SELECT count(*) FROM objects.%I WHERE a_key = ''A1''', itbl) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'the delete rule left the link in the store'; END IF;
  SELECT id INTO app FROM public.action_applications
   WHERE action_type_id = del_act ORDER BY applied_at DESC LIMIT 1;
  PERFORM public.revert_action(app);
  EXECUTE format('SELECT count(*) FROM objects.%I WHERE a_key = ''A1'' AND b_key = ''B1''', itbl) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the revert did not restore the rule-deleted link'; END IF;

  DELETE FROM public.link_edits WHERE link_type_id = ln;
  DELETE FROM public.action_types WHERE id IN (act, del_act);
  DELETE FROM public.link_types WHERE id = ln;
  DELETE FROM public.object_types WHERE id IN (ta, tb);
  DELETE FROM public.datasets WHERE id IN (dsa, dsb, jds);
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
