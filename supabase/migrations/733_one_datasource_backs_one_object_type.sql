-- 733 — one datasource backs one object type, for all three kinds; and the
-- restricted-view divergence gets the scope it never had.
--
-- Two loose ends from F11's build, both recorded in #901 as unbuilt.
--
-- ── the save hid the reason a datasource was refused ────────────────────────
--
--   "Note that a single datasource can only be used to back one object type."
--   — object-link-types/create-object-type.md
--
-- `guard_object_type_datasource` already holds that for all three kinds, and
-- says so accurately: `Phonograph2:DatasetAndBranchAlreadyRegistered — this
-- datasource is already backing a different object type`. The save never let it
-- speak. `apply_object_type` decides whether to insert with a NOT EXISTS that is
-- deliberately NOT scoped to the type — the comment 598 wrote on it reasons
-- "a datasource backs one object type, so one already spoken for is not taken
-- from it" — so a payload naming a taken datasource is silently SKIPPED. The
-- type then lands with no backing, and the linter refuses the save with
-- `A backing datasource is required`, which is true and tells the user nothing
-- about the datasource they actually chose.
--
-- Scoped to the type, the row is attempted and the trigger says the real thing.
-- The skip was never the rule; the trigger is the rule.
--
-- The two partial unique indexes are the same fact one rung down. A BEFORE
-- trigger reads the table and then inserts, so two concurrent claims on one
-- restricted view can both find no holder; 405 gave the dataset kind
-- `UNIQUE (dataset_id, branch_id)` and the two kinds added since got nothing.
-- Partial, because those columns are NULL for the kinds they do not describe
-- and a plain unique index would collapse every row of every other kind.
--
-- ── and the divergence 484 took without a page ──────────────────────────────
--
-- `guard_rv_datasource` refuses to let a restricted view sit beside any other
-- datasource. 484 says why, and says what it was working from:
--
--   "A restricted view backs alone: merged index rows cannot be attributed back
--    to the datasource they came from... Ours refuses the mix; no page shows one
--    either way."
--
-- The second half is no longer true. The page is
-- `object-permissioning/managing-object-security.md`:
--
--   "These input data sources can be any combination of datasets or restricted
--    views."
--   — object-permissioning/managing-object-security.md
--
-- and mandatory controls depend on precisely that shape:
--
--   "However, for multi-datasource-backed object types (MDOs), each datasource
--    could have its own mandatory control property. Only the properties backed
--    by a specific datasource will be secured by the mandatory control in that
--    datasource."
--   — object-link-types/mandatory-control-properties.md
--
-- So the refusal is stricter than Foundry. 484's ENGINEERING reason still holds
-- — our read path gates whole rows through `restricted_view_predicate`, and
-- Foundry's answer is per-property instead:
--
--   "This means that it is possible for a user to only have permission to see a
--    subset of properties on an object, In this case, the user will only be able
--    to see the properties mapped from those datasources. Other properties will
--    appear as null when displaying an object instance to the user."
--   — object-link-types/mandatory-control-properties.md
--
-- which is a real piece of work: attributing each property to its datasource at
-- read time and nulling the ones the caller cannot reach. `object_type_
-- properties.datasource_id` already carries the attribution, so the missing part
-- is the read path, not the model.
--
-- This migration does NOT lift the refusal. Lifting it before the per-property
-- read path exists would leak or over-hide, which is the one thing 484 got
-- right. What it does is stop the divergence being unscoped: the reason is now
-- on the function, with the page that contradicts it and the work that would
-- close it, so the next reader meets a decision rather than an assumption.

-- ── the save lets the trigger speak ────────────────────────────────────────

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := $a$-- What is left is new. The NOT EXISTS is deliberately not scoped to this
  -- type: a datasource backs one object type, so one already spoken for is not
  -- taken from it.$a$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_object_type';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'insert anchor found % times', n; END IF;
  src := replace(src, anchor,
$a$-- What is left is new, and the NOT EXISTS asks only about THIS type. A
  -- datasource another type holds is refused by guard_object_type_datasource,
  -- which names it; skipping it here instead left the type unbacked and the
  -- linter complaining about a missing backing rather than a taken one (733).$a$);

  n := (length(src) - length(replace(src, 'SELECT 1 FROM public.object_type_datasources d
      WHERE CASE WHEN nullif(e->>''rid'','''') IS NOT NULL', ''))) /
       length('SELECT 1 FROM public.object_type_datasources d
      WHERE CASE WHEN nullif(e->>''rid'','''') IS NOT NULL');
  IF n <> 1 THEN RAISE EXCEPTION 'insert NOT EXISTS anchor found % times', n; END IF;
  src := replace(src,
'SELECT 1 FROM public.object_type_datasources d
      WHERE CASE WHEN nullif(e->>''rid'','''') IS NOT NULL',
'SELECT 1 FROM public.object_type_datasources d
      WHERE d.object_type_id = t
        AND CASE WHEN nullif(e->>''rid'','''') IS NOT NULL');

  EXECUTE src;
END $patch$;

CREATE UNIQUE INDEX object_type_datasources_restricted_view_key
  ON public.object_type_datasources (restricted_view_id)
  WHERE restricted_view_id IS NOT NULL;

CREATE UNIQUE INDEX object_type_datasources_media_set_view_key
  ON public.object_type_datasources (media_set_view_rid)
  WHERE media_set_view_rid IS NOT NULL;

COMMENT ON INDEX public.object_type_datasources_restricted_view_key IS
  'A single datasource can only be used to back one object type (create-object-type) — the rule 405 held for datasets only. 733.';
COMMENT ON INDEX public.object_type_datasources_media_set_view_key IS
  'A single datasource can only be used to back one object type (create-object-type), for the media set view kind 585 added. 733.';

COMMENT ON FUNCTION public.guard_rv_datasource() IS
  'DIVERGENCE, scoped 733: refuses a restricted view beside any other datasource. managing-object-security says "These input data sources can be any combination of datasets or restricted views", and mandatory-control-properties needs that shape for MDOs, so this IS stricter than Foundry. It stands only until the read path can attribute a property to its datasource and null what the caller cannot reach — Foundry''s own answer — because our restricted_view_predicate gates whole rows and mixing sources would leak or over-hide. Lift it with that work, not before.';

-- ── PROVED BY DOING ────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  ds2 uuid; br2 uuid; rv uuid; t uuid; t2 uuid; n int;
  props jsonb := jsonb_build_array(jsonb_build_object(
    'property_id','pk','display_name','Id','api_name','id','base_type','string',
    'source','column','backing_column','pk','is_primary_key',true,
    'is_title_key',true,'required',true));
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m733 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm733-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm733-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M733 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm733p', 'm733 probe') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm733ds', 'm733ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"owner_id","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  -- The first type takes the dataset through the front door.
  SELECT public.save_object_type(
    jsonb_build_object('api_name','M733One','label','M733 one','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds,'branch_id',br))), props) INTO t;
  PERFORM public.save_working_state();

  -- The second asks for the same one. Before 733 this was skipped and the save
  -- failed for a MISSING backing; now the trigger names what actually happened.
  SELECT public.save_object_type(
    jsonb_build_object('api_name','M733Two','label','M733 two','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds,'branch_id',br))), props) INTO t2;
  BEGIN
    PERFORM public.save_working_state();
    RAISE EXCEPTION 'a taken datasource was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%DatasetAndBranchAlreadyRegistered%' THEN
      RAISE EXCEPTION 'the save hid the reason: %', sqlerrm;
    END IF;
  END;
  DELETE FROM public.working_state_changes WHERE resource_id = t2;

  -- A free datasource still lands, so the narrower question did not refuse the
  -- ordinary case.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm733ds2', 'm733ds2') RETURNING id INTO ds2;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds2, br2, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds2, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.save_object_type(
    jsonb_build_object('api_name','M733Two','label','M733 two','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds2,'branch_id',br2))), props) INTO t2;
  PERFORM public.save_working_state();
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = t2 AND dataset_id = ds2;
  IF n <> 1 THEN RAISE EXCEPTION 'a free datasource did not land (%)', n; END IF;

  -- And re-stating the SAME backing is still a no-op rather than a second row,
  -- which is what the narrower question had to keep true.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t2,'api_name','M733Two','label','M733 two','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds2,'branch_id',br2))), props);
  PERFORM public.save_working_state();
  SELECT count(*) INTO n FROM public.object_type_datasources WHERE object_type_id = t2;
  IF n <> 1 THEN RAISE EXCEPTION 'restating the backing made % rows', n; END IF;

  -- The same rule one rung down, where concurrency lives. The trigger raises
  -- first; the index behind it is the floor the trigger cannot be.
  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'm733rv', 'm733rv',
    '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}'::jsonb)
  RETURNING id INTO rv;
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  INSERT INTO public.object_type_datasources (object_type_id, restricted_view_id)
  VALUES (t, rv);
  BEGIN
    INSERT INTO public.object_type_datasources (object_type_id, restricted_view_id)
    VALUES (t2, rv);
    RAISE EXCEPTION 'a restricted view backed two object types';
  EXCEPTION
    WHEN unique_violation THEN NULL;
    WHEN raise_exception THEN
      IF sqlerrm NOT LIKE '%AlreadyRegistered%' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO n FROM pg_indexes
   WHERE tablename = 'object_type_datasources'
     AND indexname IN ('object_type_datasources_restricted_view_key',
                       'object_type_datasources_media_set_view_key');
  IF n <> 2 THEN RAISE EXCEPTION 'the partial unique indexes are not both there (%)', n; END IF;

  DELETE FROM public.object_type_datasources WHERE object_type_id IN (t, t2);
  DELETE FROM public.job_specs WHERE output_object_type_id IN (t, t2);
  DELETE FROM public.object_types WHERE id IN (t, t2);
  DELETE FROM public.restricted_views WHERE id = rv;
  DELETE FROM public.datasets WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
