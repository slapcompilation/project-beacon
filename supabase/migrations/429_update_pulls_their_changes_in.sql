-- Update: pull their changes into my working state, and choose where we clash.
--
--   "The Save button may also be grayed out if the Ontology has been saved by
--    another user since you began… You will need to select **Update**… It is
--    possible that there are **merge conflicts**… You can choose between keeping
--    the changes in the latest version of the Ontology or **overriding them**
--    with the changes in your working state."   (ontology-manager/save-changes)
--
-- 426 could see the clash and refuse; there was no way out but discarding. This
-- is the way out.
--
-- ── THE DECISION IS PER ENTITY, THE DISPLAY IS PER FIELD ───────────────────
-- Both halves are read off the screenshots, and they disagree on granularity on
-- purpose. The conflict panel lists the fields:
--
--   "Review edits … 1 conflict … Use latest … Keep my changes … Apply"
--     — ontology-manager/images/save-review-edits-merge-conflict.png
--
-- but the choice offered is one pair of buttons for the entity, not one per
-- field. So `p_resolutions` carries one choice per resource, and it applies to
-- every field of that resource we both moved.
--
-- Rebase-time is the same shape at resource granularity with a third option we
-- do not have — "Alternatively, you can navigate directly to that resource and
-- apply custom changes to resolve its conflicts." Editing the resource by hand
-- is already possible here; it is just not a button in the dialog.
--
-- ── WHAT UPDATE ACTUALLY DOES ──────────────────────────────────────────────
-- It re-bases. Every field I have staged gets its `base` set to what the
-- ontology holds *now*, which is what makes the entry no longer stale. The
-- resolution only decides what happens to `fields` on the way:
--
--   'latest'  → drop my value for the clashing fields; theirs stands. An entry
--               with nothing left is removed, because there is nothing to save.
--   'mine'    → keep my value. Re-basing is what makes it an override rather
--               than a conflict, and it is the same operation either way.
--
-- Fields only I moved need no decision — that is the auto-merge, and it is why
-- the base is stored at all: "Workshop auto-merges changes that do not overlap."
--
-- Unresolved conflicts raise. "Resolve all conflicts and errors before saving
-- and finishing the rebase" is the rebase banner, and fail-closed is the only
-- reading of it that does not lose an edit.

CREATE OR REPLACE FUNCTION public.update_working_state(
  p_resolutions jsonb DEFAULT '[]'::jsonb,
  p_branch      uuid  DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c         record;
  live      jsonb;
  choice    text;
  unresolved text;
  v_fields  jsonb;
  v_base    jsonb;
  v_ver     integer;
  v_touched integer := 0;
  k         text;
BEGIN
  -- Every conflicting resource must carry a decision before anything moves.
  SELECT string_agg(DISTINCT format('%s %s', x.resource_kind, x.resource_id), ', ')
    INTO unresolved
    FROM public.working_state_conflicts(p_branch) x
   WHERE NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(coalesce(p_resolutions, '[]'::jsonb)) r
      WHERE r->>'resource_kind' = x.resource_kind
        AND (r->>'resource_id')::uuid = x.resource_id
        AND r->>'choice' IN ('latest','mine'));
  IF unresolved IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:UnresolvedConflicts — no choice given for %', unresolved
      USING HINT = 'Every resource in working_state_conflicts() needs {"resource_kind","resource_id","choice"} with choice of latest or mine.';
  END IF;

  FOR c IN SELECT * FROM public.working_state_changes
            WHERE user_id = auth.uid()
              AND branch_id IS NOT DISTINCT FROM p_branch
              AND operation = 'modified'
  LOOP
    live := public.ontology_resource_row(c.resource_kind, c.resource_id);

    IF live IS NULL THEN
      -- They deleted what I am editing. Neither published option covers it, and
      -- guessing either way loses something.
      RAISE EXCEPTION 'OntologyMetadata:ResourceDeletedUnderEdit — % % was deleted while you were editing it', c.resource_kind, c.resource_id
        USING HINT = 'Discard this entry to accept the deletion. Re-creating it is a new resource.';
    END IF;

    SELECT r->>'choice' INTO choice
      FROM jsonb_array_elements(coalesce(p_resolutions, '[]'::jsonb)) r
     WHERE r->>'resource_kind' = c.resource_kind
       AND (r->>'resource_id')::uuid = c.resource_id;

    v_fields := c.fields;
    v_base   := c.base;

    FOR k IN SELECT jsonb_object_keys(c.fields) LOOP
      IF live -> k IS DISTINCT FROM c.base -> k AND choice = 'latest' THEN
        v_fields := v_fields - k;      -- theirs stands
        v_base   := v_base - k;
      ELSE
        v_base := v_base || jsonb_build_object(k, live -> k);
      END IF;
    END LOOP;

    IF v_fields = c.fields AND v_base = c.base THEN
      CONTINUE;                        -- nothing moved under this one
    END IF;

    SELECT version INTO v_ver FROM public.ontologies WHERE id = c.ontology_id;

    IF v_fields = '{}'::jsonb THEN
      -- Taking theirs on every field leaves nothing to save.
      DELETE FROM public.working_state_changes WHERE id = c.id;
    ELSE
      UPDATE public.working_state_changes
         SET fields = v_fields, base = v_base,
             base_version = coalesce(v_ver, base_version), updated_at = now()
       WHERE id = c.id;
    END IF;

    v_touched := v_touched + 1;
  END LOOP;

  RETURN v_touched;
END $$;

COMMENT ON FUNCTION public.update_working_state(jsonb, uuid) IS
  'Pull the latest ontology into my working state. Re-bases every staged field to what the ontology holds now; a resolution of latest drops my value for the fields we both moved, mine keeps it as an override. One choice per resource, because the conflict dialog offers one pair of buttons per entity even though it lists the fields.';

REVOKE ALL ON FUNCTION public.update_working_state(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_working_state(jsonb, uuid) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  usr uuid := gen_random_uuid(); before text; n int; got text;
  res jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('update-429') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'ws429@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
                      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS429');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws429', 'WS 429') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws429', 'WS429') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name)
  VALUES (ds, 'master') RETURNING id INTO br;

  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(
        jsonb_build_object('dataset_id', ds::text, 'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object(
      'property_id','flight_id', 'display_name','Flight Id', 'api_name','flightId',
      'base_type','string', 'source','column', 'backing_column','flight_id',
      'is_primary_key', true, 'is_title_key', true, 'required', true)));
  PERFORM public.save_working_state();

  res := jsonb_build_array(jsonb_build_object(
    'resource_kind','object_type', 'resource_id', t::text, 'choice','mine'));

  -- 1. An update with nothing to merge touches nothing.
  PERFORM public.stage_change('object_type', t, jsonb_build_object('label','Mine'));
  IF public.update_working_state() <> 0 THEN
    RAISE EXCEPTION 'update moved something with no conflict to resolve';
  END IF;

  -- 2. A field only THEY moved needs no decision — that is the auto-merge.
  UPDATE public.object_types SET description = 'theirs' WHERE id = t;
  IF public.update_working_state() <> 0 THEN
    RAISE EXCEPTION 'a field I never staged demanded a resolution';
  END IF;

  -- 3. A field we BOTH moved refuses without one.
  UPDATE public.object_types SET label = 'Theirs' WHERE id = t;
  BEGIN
    PERFORM public.update_working_state();
    RAISE EXCEPTION 'an unresolved conflict was allowed through';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%UnresolvedConflicts%' THEN RAISE; END IF;
  END;

  -- 4. `mine` keeps my value, clears the conflict, and the save then overrides.
  IF public.update_working_state(res) <> 1 THEN
    RAISE EXCEPTION 'update did not touch the conflicting resource';
  END IF;
  SELECT count(*) INTO n FROM public.working_state_conflicts();
  IF n <> 0 THEN RAISE EXCEPTION 'the conflict survived the update'; END IF;
  PERFORM public.save_working_state();
  IF (SELECT label FROM public.object_types WHERE id = t) <> 'Mine' THEN
    RAISE EXCEPTION 'keeping my changes did not override theirs';
  END IF;
  -- Their untouched field is still theirs.
  IF (SELECT description FROM public.object_types WHERE id = t) <> 'theirs' THEN
    RAISE EXCEPTION 'the override clobbered a field I never edited';
  END IF;

  -- 5. `latest` drops my value, and an entry with nothing left goes away.
  PERFORM public.stage_change('object_type', t, jsonb_build_object('label','Doomed'));
  UPDATE public.object_types SET label = 'Won' WHERE id = t;
  n := public.update_working_state(jsonb_build_array(jsonb_build_object(
    'resource_kind','object_type', 'resource_id', t::text, 'choice','latest')));
  IF n <> 1 THEN RAISE EXCEPTION 'update did not act on the resource'; END IF;
  SELECT count(*) INTO n FROM public.working_state_changes WHERE resource_id = t;
  IF n <> 0 THEN
    RAISE EXCEPTION 'taking latest on the only staged field left an empty entry behind';
  END IF;
  IF (SELECT label FROM public.object_types WHERE id = t) <> 'Won' THEN
    RAISE EXCEPTION 'taking latest changed the ontology — it should only change my working state';
  END IF;

  -- 6. Deleted under me is neither option, and says so.
  PERFORM public.stage_change('object_type', t, jsonb_build_object('label','Orphan'));
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  BEGIN
    PERFORM public.update_working_state();
    RAISE EXCEPTION 'editing a deleted resource was merged silently';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%ResourceDeletedUnderEdit%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '429: update auto-merges, resolves per entity and refuses what it cannot decide';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
