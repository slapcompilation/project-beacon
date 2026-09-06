-- A write is one edit request, against each resource it edited.
--
-- 579 built the whole usage pipeline and 746/747/752 gave it read producers.
-- The write half stayed a residual, named in 746's own header: "the write-side
-- producers (apply_action, apply_function_edits) which the page counts
-- separately as writes." Until now `ontology_usage.writes` was non-zero only
-- inside a test, so Interactions and Active users — both defined over reads AND
-- writes — under-counted by every edit anyone ever made.
--
--   "**Writes:** A write is recorded when an application makes edits to objects of this type as the result of an [Action](/docs/foundry/action-types/overview/), [Function](/docs/foundry/functions/overview/), Foundry Form, direct Object Explorer edit, or API call."
--   — ontology-manager/view-usage.md
--
-- Two of those five are doors we have — an Action (`apply_action`) and a
-- Function (`apply_function_edits`, the batch an edit function returns). A
-- Foundry Form, a direct Object Explorer edit and an API call are surfaces
-- this clone does not have; when one arrives it names itself the same way.
--
-- WHAT ONE WRITE IS, which decides everything else:
--
--   "Note that one write represents one edit request sent to [Object Storage v1 (Phonograph)](/docs/foundry/object-databases/object-storage-v1/). Many objects edited in bulk at once will only be recorded as a single write."
--   — ontology-manager/view-usage.md
--
-- So the unit is the REQUEST, not the row — the same shape 579 gave reads ("a
-- read is one load REQUEST"). One `apply_action` writing three `object_edits`
-- rows for three objects of one type is one write. And because the page counts
-- writes "on objects of this type", a request that edits two types records one
-- write against each: one request, one write per resource it touched.
--
-- `record_write_usage` derives those resources from what the request actually
-- wrote — the `object_edits` and `link_edits` rows stamped with its
-- `application_id` — rather than from the rule loop. That is deliberate: a
-- delete-link rule whose pair did not exist logs nothing (755) while
-- `apply_action` still counts it in the integer it returns, so a recorder
-- keyed off that count would record a write that never happened.
--
-- LINK TYPES record too:
--
--   "The Ontology Manager can be configured to show usage metrics for object types and link types."
--   — ontology-manager/view-usage.md
--
-- `ontology_usage` has carried `link_type_id`, its grain index and an RLS arm
-- since 579 with nothing to write them; a link edit is an edit, so a request
-- that writes `link_edits` records a write against the LINK type. INFERENCE,
-- marked: the page defines a write as edits "to objects of this type" and
-- says metrics cover link types, but never spells out that a link edit is a
-- write against the link type. RESIDUAL: `ontology_usage_summary` and
-- `ontology_usage_by_application` still take an object type only, so these
-- rows have no reader yet — the link-type Usage surface is its own chunk, and
-- the ledger being complete is what lets it be built at all.
--
-- WHO THE APPLICATION IS. Nothing at a write door named one: `apply_action`
-- had no such argument, `action_applications` no such column, and the
-- action-apply edge function forwards only a JWT. Each door gains the
-- argument the readers already take, on 746's terms — the caller names
-- itself, and a caller that does not is not recorded, which keeps every suite
-- and every internal replay out of the metrics without a special case.
--
-- **A NAME COLLISION, stated because it will bite the next patch:** in
-- `apply_function_edits` and `revert_action`, `p_application` is already taken
-- — it is the `action_applications.id` (a uuid, 742), not an application name.
-- Those two take `p_application_name text` instead. `apply_action` and the
-- five readers take `p_application text`. Grep for the name, not the meaning.
--
-- THE EXCLUSION works without a line of its own:
--
--   "Also note that any object type or link type usage happening in Ontology Manager is not included."
--   — ontology-manager/view-usage.md
--
-- 579's recorder already returns early on the literal `ontology-manager`, so
-- the Ontology Manager's own Apply dialog — the same `RunActionDialog` the
-- Explorer and the Object View host — passes that name and its writes are
-- dropped where every other caller's are kept. The three surfaces are
-- indistinguishable at the database and are told apart by what they say they
-- are, which is the only thing the page's rule can key on.
--
-- A REVERT IS A WRITE, marked as inference: it is an edit request that writes
-- compensating `object_edits` and `link_edits` rows (682/753). The page does
-- not mention reverts; it does say a write is recorded when an application
-- makes edits as the result of an Action, and a revert makes edits. Its
-- compensating rows carry no `application_id`, so the resources come from the
-- application being reverted — whose edits name exactly what the compensation
-- touches.
--
-- Not changed here, recorded: the recorder is `SECURITY DEFINER` and granted
-- to `authenticated` with no membership check, so any caller can record usage
-- against any resource in a metrics-enabled ontology (579's shape, widened by
-- nothing here); isolate reads stay nameless (747's residual — which
-- application a Function's read belongs to); and `metrics_enabled` stays off
-- by default, an operator's choice the page calls administrative.

-- ── one write per resource per request ──────────────────────────────────────

CREATE FUNCTION public.record_write_usage(p_application text, p_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE r record;
BEGIN
  -- 746's rule: the caller names itself, or nothing is recorded.
  IF p_application IS NULL OR p_application_id IS NULL THEN RETURN; END IF;
  -- A metrics failure must never fail a write, and only its own errors are
  -- swallowed — the edits are already in the log by the time this runs.
  BEGIN
    FOR r IN
      SELECT DISTINCT e.object_type_id AS ot, NULL::uuid AS lt
        FROM public.object_edits e WHERE e.application_id = p_application_id
       UNION
      SELECT DISTINCT NULL::uuid AS ot, l.link_type_id AS lt
        FROM public.link_edits l WHERE l.application_id = p_application_id
    LOOP
      PERFORM public.record_ontology_usage(r.ot, r.lt, p_application, 0, 1);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $fn$;

COMMENT ON FUNCTION public.record_write_usage(text, uuid) IS
  'One write per resource an edit request touched: "one write represents one edit request … Many objects edited in bulk at once will only be recorded as a single write" (ontology-manager/view-usage). The resources come from the object_edits and link_edits rows the request actually wrote, so a rule that logged nothing records nothing. Nameless callers record nothing (746); Ontology Manager is refused by the recorder (579). 762.';

REVOKE ALL ON FUNCTION public.record_write_usage(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_write_usage(text, uuid) TO authenticated, service_role;

-- ── the three doors, patched not retyped ────────────────────────────────────
-- Each gains its argument at the end of the signature, so every existing
-- caller still resolves; the recording call goes after the edit window closes
-- and before the count is returned.

DO $patch$
DECLARE src text; n int; arg text; call text; anchor text; f record;
BEGIN
  FOR f IN
    SELECT * FROM (VALUES
      ('public.apply_action(uuid,jsonb,text)',
       ', p_application text DEFAULT NULL',
       '  PERFORM set_config(''beacon.applying_action'', ''off'', true);
  RETURN written;',
       '  -- One write per resource this request edited (762).
  PERFORM public.record_write_usage(p_application, app);
  RETURN written;'),
      ('public.apply_function_edits(uuid,jsonb,uuid)',
       ', p_application_name text DEFAULT NULL',
       '  PERFORM set_config(''beacon.applying_action'', ''off'', true);
  RETURN written;',
       '  -- One write per resource this request edited (762). Here p_application
  -- is the action_applications id, not a name — hence p_application_name.
  PERFORM public.record_write_usage(p_application_name, p_application);
  RETURN written;'),
      ('public.revert_action(uuid)',
       ', p_application_name text DEFAULT NULL',
       '   WHERE id = p_application;
  RETURN written;',
       '   WHERE id = p_application;

  -- A revert is an edit request too; its compensating rows carry no
  -- application, so the resources come from the application it reverted (762).
  PERFORM public.record_write_usage(p_application_name, p_application);
  RETURN written;')
    ) v(sig, newarg, anch, repl)
  LOOP
    src := replace(pg_get_functiondef(f.sig::regprocedure), chr(13), '');

    -- the signature, by the shape 749 used
    n := position(')' || chr(10) || ' RETURNS' IN src);
    IF n = 0 THEN RAISE EXCEPTION '762: the CREATE line shape moved in %', f.sig; END IF;
    src := left(src, n - 1) || f.newarg || substr(src, n);

    -- the recording call, on an anchor that must sit exactly once
    IF (length(src) - length(replace(src, f.anch, ''))) / length(f.anch) <> 1 THEN
      RAISE EXCEPTION '762: the tail anchor is not exactly once in %', f.sig;
    END IF;
    src := replace(src, f.anch, f.repl);

    EXECUTE format('DROP FUNCTION %s', f.sig);
    EXECUTE src;
  END LOOP;
END $patch$;

-- The old ACLs named no PUBLIC; a recreate must not hand it back.
REVOKE ALL ON FUNCTION public.apply_action(uuid, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_action(uuid, jsonb, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_function_edits(uuid, jsonb, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_function_edits(uuid, jsonb, uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.revert_action(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revert_action(uuid, text) TO authenticated, service_role;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid; ds uuid; br uuid;
  ta uuid; tb uuid; act uuid; two uuid; app uuid; n int; w int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m762 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm762-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm762-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M762 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false,
         metrics_enabled = true, metrics_enabled_at = now() - interval '90 days'
   WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm762p', 'm762 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm762ds', 'm762ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  SELECT public.save_object_type(
    jsonb_build_object('api_name', 'M762A', 'label', 'M762 A', 'ontology_id', ont,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br))),
    jsonb_build_array(jsonb_build_object('property_id', 'a_id', 'display_name', 'A Id',
      'api_name', 'aId', 'base_type', 'string', 'source', 'column', 'backing_column', 'a_id',
      'is_primary_key', true, 'is_title_key', true, 'required', true))) INTO ta;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm762ds2', 'm762ds2') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  SELECT public.save_object_type(
    jsonb_build_object('api_name', 'M762B', 'label', 'M762 B', 'ontology_id', ont,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br))),
    jsonb_build_array(jsonb_build_object('property_id', 'b_id', 'display_name', 'B Id',
      'api_name', 'bId', 'base_type', 'string', 'source', 'column', 'backing_column', 'b_id',
      'is_primary_key', true, 'is_title_key', true, 'required', true))) INTO tb;
  PERFORM public.save_working_state();
  UPDATE public.object_types SET edits_enabled = true WHERE id IN (ta, tb);
  -- a non-key property names the datasource it comes from
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, required)
  VALUES (ta, 'note', 'Note', 'note', 'string', 'column', 'note',
          (SELECT d.id FROM public.object_type_datasources d WHERE d.object_type_id = ta), false);

  -- one action, two rules, two types: one request
  SELECT public.save_action_type(jsonb_build_object(
    'api_name', 'm762-make', 'label', 'M762 make', 'ontology_id', ont,
    'parameters', jsonb_build_array(
      jsonb_build_object('api_name', 'aId', 'display_name', 'A', 'base_type', 'string', 'required', true, 'position', 0),
      jsonb_build_object('api_name', 'bId', 'display_name', 'B', 'base_type', 'string', 'required', true, 'position', 1)),
    'rules', jsonb_build_array(
      jsonb_build_object('kind', 'create_object', 'position', 0, 'object_type_id', ta,
        'properties', jsonb_build_array(jsonb_build_object(
          'property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ta AND is_primary_key),
          'value_source', 'parameter', 'parameter_api_name', 'aId'))),
      jsonb_build_object('kind', 'create_object', 'position', 1, 'object_type_id', tb,
        'properties', jsonb_build_array(jsonb_build_object(
          'property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = tb AND is_primary_key),
          'value_source', 'parameter', 'parameter_api_name', 'bId')))))) INTO two;
  PERFORM public.save_working_state();

  -- a nameless caller records nothing, though it edits
  IF public.apply_action(two, '{"aId":"A0","bId":"B0"}'::jsonb) <> 2 THEN
    RAISE EXCEPTION 'the nameless apply should write two edits';
  END IF;
  SELECT count(*) INTO n FROM public.ontology_usage;
  IF n <> 0 THEN RAISE EXCEPTION 'a nameless caller should record nothing, % row(s)', n; END IF;

  -- Ontology Manager's own writes are not included
  PERFORM public.apply_action(two, '{"aId":"A1","bId":"B1"}'::jsonb, NULL, 'ontology-manager');
  SELECT count(*) INTO n FROM public.ontology_usage;
  IF n <> 0 THEN RAISE EXCEPTION 'Ontology Manager usage is not included, % row(s)', n; END IF;

  -- a named request: ONE write per type it edited, not one per edit
  PERFORM public.apply_action(two, '{"aId":"A2","bId":"B2"}'::jsonb, NULL, 'object-explorer');
  SELECT count(*) INTO n FROM public.ontology_usage WHERE application = 'object-explorer';
  IF n <> 2 THEN RAISE EXCEPTION 'one request over two types should record two rows, recorded %', n; END IF;
  SELECT writes INTO w FROM public.ontology_usage
   WHERE object_type_id = ta AND application = 'object-explorer';
  IF w <> 1 THEN RAISE EXCEPTION 'the request is one write against A, recorded %', w; END IF;
  SELECT reads INTO n FROM public.ontology_usage
   WHERE object_type_id = ta AND application = 'object-explorer';
  IF n <> 0 THEN RAISE EXCEPTION 'a write is not a read, recorded % reads', n; END IF;

  -- bulk: one request writing TWO edits on ONE type is still one write —
  -- a create at position 0 and a modify at position 1, which is 469's order
  SELECT public.save_action_type(jsonb_build_object(
    'api_name', 'm762-touch', 'label', 'M762 touch', 'ontology_id', ont,
    'parameters', jsonb_build_array(
      jsonb_build_object('api_name', 'newId', 'display_name', 'New', 'base_type', 'string', 'required', true, 'position', 0),
      jsonb_build_object('api_name', 'note', 'display_name', 'Note', 'base_type', 'string', 'required', true, 'position', 1)),
    'rules', jsonb_build_array(
      jsonb_build_object('kind', 'create_object', 'position', 0, 'object_type_id', ta,
        'properties', jsonb_build_array(jsonb_build_object(
          'property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ta AND is_primary_key),
          'value_source', 'parameter', 'parameter_api_name', 'newId'))),
      jsonb_build_object('kind', 'modify_object', 'position', 1, 'object_type_id', ta,
        'properties', jsonb_build_array(jsonb_build_object(
          'property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ta AND property_id = 'note'),
          'value_source', 'parameter', 'parameter_api_name', 'note')))))) INTO act;
  PERFORM public.save_working_state();
  IF public.apply_action(act, '{"newId":"A3","note":"n"}'::jsonb, 'A3', 'quiver') <> 2 THEN
    RAISE EXCEPTION 'the touch should write two edits';
  END IF;
  SELECT count(*) INTO n FROM public.object_edits e
    JOIN public.action_applications a ON a.id = e.application_id
   WHERE a.action_type_id = act;
  IF n <> 2 THEN RAISE EXCEPTION 'two edit rows should carry the application, % did', n; END IF;
  SELECT writes INTO w FROM public.ontology_usage
   WHERE object_type_id = ta AND application = 'quiver';
  IF w <> 1 THEN RAISE EXCEPTION 'two objects edited in one request is a single write, recorded %', w; END IF;

  -- a revert is an edit request against what it puts back
  SELECT id INTO app FROM public.action_applications
   WHERE action_type_id = act ORDER BY applied_at DESC LIMIT 1;
  PERFORM public.revert_action(app, 'quiver');
  SELECT writes INTO w FROM public.ontology_usage
   WHERE object_type_id = ta AND application = 'quiver';
  IF w <> 2 THEN RAISE EXCEPTION 'the revert is a second write against A, total is %', w; END IF;

  -- the summary counts writes with no reads, and Active users sees the caller
  SELECT writes INTO w FROM public.ontology_usage_summary(ta, 30);
  IF w <> 3 THEN RAISE EXCEPTION 'the summary should see three writes on A, saw %', w; END IF;
  SELECT active_users INTO n FROM public.ontology_usage_summary(ta, 30);
  IF n <> 1 THEN RAISE EXCEPTION 'one caller made them all, saw %', n; END IF;
  SELECT reads INTO n FROM public.ontology_usage_summary(ta, 30);
  IF n <> 0 THEN RAISE EXCEPTION 'no reads were made, saw %', n; END IF;

  RAISE EXCEPTION USING errcode = 'P0762', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0762' THEN
  NULL;
END $$;
