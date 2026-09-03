-- 748 — a before-image holds what the reader saw.
--
-- Found by the isolate production demo, the first execution of a revert
-- against a datasource-backed object anywhere: reverting a modify wrote
-- `model = NULL` over a real value. Root cause: 682 (and 742, copying it)
-- capture the before-image from `object_state(<type>, <pk>, NULL)`, and that
-- third argument is the DATASOURCE ROW — the caller is supposed to supply it,
-- the way `index_object_type` does during replay. Handed NULL, `object_state`
-- can only see the edit-log overlay, so any property whose value came from
-- the datasource snapshots as NULL, and the revert — which "can only be
-- reverted if the action is the most recent edit" and writes the before-image
-- back — replaces data with that NULL.
--
--   "Action reverts in Ontology Manager allow an action to be reverted (that
--    is, undone) immediately after the action has been applied."
--   — action-types/action-reverts.md
--
-- Undone means the state the user saw comes back. What the user saw is the
-- index row — datasource and overlay merged by the last build — with any
-- edits appended since the build replayed on top. That is what this helper
-- returns, and both apply paths now capture from it. Every suite revert case
-- stayed green over the bug because every one reverted an edit-log-only
-- object, where the overlay IS the whole state.
--
-- The helper is SECURITY DEFINER because the physical index tables are
-- owner-read (the same reason evaluate_object_set is), and it carries the
-- same visibility refusal the readers do, so it is safe as a standalone
-- surface.

CREATE FUNCTION public.object_before_state(p_object_type uuid, p_primary_key text)
RETURNS TABLE(properties jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE ont uuid; tbl text; pk_col text; base jsonb := '{}'::jsonb; overlay jsonb;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x
      ON x.object_type_id = t.id AND public.object_type_index_ready(x.object_type_id)
   WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;
  SELECT p.property_id INTO pk_col FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.is_primary_key;
  IF tbl IS NOT NULL AND pk_col IS NOT NULL THEN
    EXECUTE format('SELECT to_jsonb(o) FROM objects.%I o WHERE o.%I = $1', tbl, pk_col)
      INTO base USING p_primary_key;
    base := coalesce(base, '{}'::jsonb);
  END IF;
  -- Edits since the last build are not in the index yet; the overlay wins.
  SELECT s.properties INTO overlay
    FROM public.object_state(p_object_type, p_primary_key, NULL) s;
  RETURN QUERY SELECT base || coalesce(overlay, '{}'::jsonb);
END $fn$;

COMMENT ON FUNCTION public.object_before_state(uuid, text) IS
  'The merged state a reader currently sees for one object: the built index row with the edit-log overlay replayed on top. What apply_action and apply_function_edits capture as an edit''s before-image, so a revert restores what was actually visible (action-reverts: reverted, "that is, undone"). 748.';

REVOKE ALL ON FUNCTION public.object_before_state(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.object_before_state(uuid, text) TO authenticated, service_role;

-- Both apply paths capture from the helper now. Same signature, so the
-- live definitions are patched in place and the grants stay.
DO $patch$
DECLARE fn text; bad text; good text; src text; n int;
BEGIN
  FOR fn, bad, good IN
    SELECT * FROM (VALUES
      ('apply_action',
       'public.object_state(target, pk_val, NULL)',
       'public.object_before_state(target, pk_val)'),
      ('apply_function_edits',
       'public.object_state(ot, pk, NULL)',
       'public.object_before_state(ot, pk)')
    ) v(f, b, g)
  LOOP
    SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname = fn;
    n := (length(src) - length(replace(src, bad, ''))) / length(bad);
    IF n <> 2 THEN RAISE EXCEPTION '%: expected the 2 before-capture sites, found %', fn, n; END IF;
    src := replace(src, bad, good);
    EXECUTE src;
  END LOOP;
END $patch$;

-- ── PROVED BY DOING — the revert the demo ran, against the same shape ───────
--
-- A datasource-backed, indexed object is modified by an action and the
-- application reverted: the before-image carries the datasource value, and
-- the state after revert shows it — not NULL. Exactly the sequence that
-- corrupted N101AA.

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  file_id uuid; phys text; t uuid; b uuid; st text; err text;
  act uuid; app uuid; bef jsonb; after jsonb; label_prop uuid; dsrc uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m748 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm748-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm748-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M748 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm748p', 'm748 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm748ds', 'm748ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"label","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'rows.parquet', 1) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, label) VALUES ($1, ''R1'', ''from-datasource'')', phys)
    USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M748Thing', 'M748 thing', true) RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (t, ds, br) RETURNING id INTO dsrc;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (t, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id)
  VALUES (t, 'label', 'Label', 'label', 'string', 'column', 'label', dsrc)
  RETURNING id INTO label_prop;
  SELECT public.run_index_build(ARRAY[t]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj WHERE bj.build_id = b;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'no index to revert against: %', coalesce(err, '?'); END IF;

  -- The helper sees the datasource value through the index.
  SELECT s.properties INTO bef FROM public.object_before_state(t, 'R1') s;
  IF bef->>'label' IS DISTINCT FROM 'from-datasource' THEN
    RAISE EXCEPTION 'the helper does not see the index row: %', bef;
  END IF;

  -- An action modifies the datasource-backed property...
  INSERT INTO public.action_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'm748-edit', 'm748 edit') RETURNING id INTO act;
  INSERT INTO public.action_type_rules (action_type_id, kind, object_type_id, position)
  VALUES (act, 'modify_object', t, 0);
  INSERT INTO public.action_type_rule_properties
    (rule_id, property_id, value_source, static_value)
  SELECT r.id, label_prop, 'static', to_jsonb('edited'::text)
    FROM public.action_type_rules r WHERE r.action_type_id = act;
  PERFORM public.apply_action(act, '{}'::jsonb, 'R1');

  -- ...and its before-image is the value the reader saw, not NULL.
  SELECT oe."before", oe.application_id INTO bef, app
    FROM public.object_edits oe
   WHERE oe.object_type_id = t AND oe.primary_key = 'R1' AND oe.instruction = 'modify';
  IF bef->>'label' IS DISTINCT FROM 'from-datasource' THEN
    RAISE EXCEPTION 'the before-image is % — the demo''s corruption, unfixed', bef;
  END IF;

  -- The revert restores it: the merged state shows the datasource value again.
  PERFORM public.revert_action(app);
  SELECT s.properties INTO after FROM public.object_before_state(t, 'R1') s;
  IF after->>'label' IS DISTINCT FROM 'from-datasource' THEN
    RAISE EXCEPTION 'the revert did not restore the value: %', after;
  END IF;

  DELETE FROM public.object_edits WHERE object_type_id = t;
  DELETE FROM public.action_types WHERE id = act;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
