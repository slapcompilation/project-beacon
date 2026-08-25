-- Ontology history and restore, from readings/ontology-manager-save-session.md
-- §7 (the reading predates the build by months; the queue called it the item
-- where save_working_state destroys the session rows it would need).
--
-- ── A HISTORY ENTRY IS A SAVE ────────────────────────────────────────────────
--
--   "Each entry in the edits history corresponds to a single instance of a user saving changes. You also have the option to consolidate the view by merging changes that have been made by the same author into a single entry."
--   — ontology-manager/restore-changes.md
--
-- So the recording happens at the two places a save lands on main: the
-- working-state save and the proposal merge — both bump the ontology version
-- and then DELETE their change rows, and the recorder copies those rows one
-- statement earlier. Each copied row keeps the per-field diff (fields, base)
-- for the history view, PLUS a full definition snapshot taken after the save
-- applied (ontology_resource_row serializes all six kinds whole), because
-- restore needs the state at an entry, not a chain of diffs.
--
-- ── PER RESOURCE, BOTH LAYERS ────────────────────────────────────────────────
--
--   "* The unsaved changes you made to the resource.
--   * All saved changes that were made to the resource with details on when the changes were made and the user who applied them."
--   — ontology-manager/restore-changes.md
--
-- The unsaved half is working_state_changes, already readable; the saved half
-- is ontology_save_changes filtered by resource.
--
-- ── RESTORE WRITES INTO THE WORKING STATE ────────────────────────────────────
--
--   "After restoring an object type to a previous version, any changes that were made after the entry you selected will be undone. The changes will be added to your working state and you will need to save your changes to the Ontology for your restore to take effect."
--   — ontology-manager/restore-changes.md
--
-- restore_object_type stages the definition as it stood at the chosen entry
-- (the latest snapshot at or before it) into the caller's working state —
-- reviewable, discardable, and subject to the same errors, warnings and
-- conflicts as any hand edit. A type created after the entry stages a delete;
-- one deleted after it stages a recreate. Restore is documented for OBJECT
-- TYPES only, and the function is scoped exactly that way.
--
-- Every live-patch anchor asserts it occurs exactly once (the 669 lesson).

-- ── THE TABLES ───────────────────────────────────────────────────────────────

CREATE TABLE public.ontology_saves (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ontology_id      uuid NOT NULL REFERENCES public.ontologies(id) ON DELETE CASCADE,
  saved_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- the two landing paths on main
  via              text NOT NULL CHECK (via IN ('save', 'merge')),
  proposal_id      uuid REFERENCES public.ontology_proposals(id) ON DELETE SET NULL,
  -- the ontology version AFTER this save — the bump precedes the recording
  ontology_version integer NOT NULL,
  -- clock_timestamp, not now(): consecutive saves inside one transaction
  -- (the probes, a scripted import) must still order.
  saved_at         timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.ontology_saves IS
  'One row per instance of a user saving changes to the ontology (ontology-manager/restore-changes: a history entry IS a save) — written by record_ontology_save from the two landing paths, the working-state save and the proposal merge.';

CREATE INDEX ontology_saves_ontology ON public.ontology_saves (ontology_id, saved_at DESC);
CREATE INDEX ontology_saves_saved_by ON public.ontology_saves (saved_by);
CREATE INDEX ontology_saves_proposal ON public.ontology_saves (proposal_id);

CREATE TABLE public.ontology_save_changes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  save_id       uuid NOT NULL REFERENCES public.ontology_saves(id) ON DELETE CASCADE,
  resource_kind text NOT NULL CHECK (resource_kind IN
    ('object_type','link_type','shared_property','interface','action_type','type_group')),
  resource_id   uuid NOT NULL,
  operation     text NOT NULL CHECK (operation IN ('created','modified','deleted')),
  -- the per-field diff the history view renders, copied from the session row
  fields        jsonb NOT NULL DEFAULT '{}'::jsonb,
  base          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- the resource's full definition AFTER this save; NULL when this save
  -- deleted it. What restore reads.
  definition    jsonb,
  -- a name snapshot, so a deleted resource stays nameable in history
  label         text NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.ontology_save_changes IS
  'One row per resource a save touched, with the Created/Edited/Deleted pill, the per-field diff, and the post-save definition snapshot restore reads. The kinds and operations copy working_state_changes'' own sets.';

CREATE INDEX ontology_save_changes_save ON public.ontology_save_changes (save_id);
CREATE INDEX ontology_save_changes_resource
  ON public.ontology_save_changes (resource_kind, resource_id);

ALTER TABLE public.ontology_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ontology_save_changes ENABLE ROW LEVEL SECURITY;

-- History is visible to whoever can see the ontology: members of its space's
-- organizations. The hide-inaccessible option is a view concern, recorded as
-- a surface residual.
CREATE POLICY "history follows the ontology" ON public.ontology_saves
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ontologies o
    JOIN public.space_organizations so ON so.space_id = o.space_id
    WHERE o.id = ontology_id AND public.auth_in_org(so.organization_id)));
CREATE POLICY "changes follow their save" ON public.ontology_save_changes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ontology_saves s WHERE s.id = save_id));
-- immutable to callers; the recorder is the one writer
REVOKE INSERT, UPDATE, DELETE ON public.ontology_saves FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ontology_save_changes FROM authenticated;

-- ── THE RECORDER ─────────────────────────────────────────────────────────────

CREATE FUNCTION public.record_ontology_save(
  p_ontology uuid, p_via text, p_branch uuid DEFAULT NULL, p_proposal uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_save uuid;
BEGIN
  INSERT INTO public.ontology_saves (ontology_id, saved_by, via, proposal_id, ontology_version)
  VALUES (p_ontology, auth.uid(), p_via, p_proposal,
          (SELECT version FROM public.ontologies WHERE id = p_ontology))
  RETURNING id INTO v_save;

  IF p_via = 'save' THEN
    INSERT INTO public.ontology_save_changes
      (save_id, resource_kind, resource_id, operation, fields, base, definition, label)
    SELECT v_save, w.resource_kind, w.resource_id, w.operation, w.fields, w.base,
           CASE WHEN w.operation = 'deleted' THEN NULL
                ELSE public.ontology_resource_row(w.resource_kind, w.resource_id) END,
           coalesce(w.fields ->> 'api_name', w.fields ->> 'name',
                    w.base ->> 'api_name', w.base ->> 'name', '')
      FROM public.working_state_changes w
     WHERE w.user_id = auth.uid() AND w.branch_id IS NULL AND w.ontology_id = p_ontology;
  ELSE
    INSERT INTO public.ontology_save_changes
      (save_id, resource_kind, resource_id, operation, fields, base, definition, label)
    SELECT v_save, b.resource_kind, b.resource_id, b.operation, b.fields, b.base,
           CASE WHEN b.operation = 'deleted' THEN NULL
                ELSE public.ontology_resource_row(b.resource_kind, b.resource_id) END,
           coalesce(b.fields ->> 'api_name', b.fields ->> 'name',
                    b.base ->> 'api_name', b.base ->> 'name', '')
      FROM public.branch_resource_changes b
     WHERE b.branch_id = p_branch;
  END IF;

  -- the label falls back to the live row for edits that never touched a name
  UPDATE public.ontology_save_changes c
     SET label = coalesce(nullif(c.label, ''),
                          c.definition ->> 'api_name', c.definition ->> 'name', '')
   WHERE c.save_id = v_save AND c.label = '';

  RETURN v_save;
END $$;

COMMENT ON FUNCTION public.record_ontology_save(uuid, text, uuid, uuid) IS
  'Copies the session''s change rows into history — called by save_working_state and merge_proposal AFTER the version bump and BEFORE their deletes, snapshotting each surviving resource''s full definition for restore. The one writer of the history tables.';

REVOKE ALL ON FUNCTION public.record_ontology_save(uuid, text, uuid, uuid) FROM PUBLIC, anon;

-- ── THE TWO LANDING PATHS RECORD ─────────────────────────────────────────────
DO $do$
DECLARE src text; a text; anchors text[]; i int;
BEGIN
  src := replace(pg_get_functiondef('public.save_working_state(uuid)'::regprocedure), chr(13), '');
  anchors := ARRAY['    UPDATE public.ontologies SET version = version + 1 WHERE id = v_ont;
    DELETE FROM public.working_state_changes
     WHERE user_id = auth.uid() AND branch_id IS NULL;'];
  FOREACH a IN ARRAY anchors LOOP
    i := position(a in src);
    IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
      RAISE EXCEPTION 'an anchor moved or repeats: save_working_state is not the text 672 read';
    END IF;
  END LOOP;
  src := replace(src, anchors[1],
'    UPDATE public.ontologies SET version = version + 1 WHERE id = v_ont;
    -- a history entry is a save: record before the rows are destroyed
    PERFORM public.record_ontology_save(v_ont, ''save'');
    DELETE FROM public.working_state_changes
     WHERE user_id = auth.uid() AND branch_id IS NULL;');
  EXECUTE src;
END $do$;

DO $do$
DECLARE src text; a text; anchors text[]; i int;
BEGIN
  src := replace(pg_get_functiondef('public.merge_proposal(uuid)'::regprocedure), chr(13), '');
  anchors := ARRAY['  UPDATE public.ontologies SET version = version + 1 WHERE id = v_ont;
  DELETE FROM public.branch_resource_changes WHERE branch_id = b;'];
  FOREACH a IN ARRAY anchors LOOP
    i := position(a in src);
    IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
      RAISE EXCEPTION 'an anchor moved or repeats: merge_proposal is not the text 672 read';
    END IF;
  END LOOP;
  src := replace(src, anchors[1],
'  UPDATE public.ontologies SET version = version + 1 WHERE id = v_ont;
  -- the merge is the branch''s save onto main: record before the rows go
  PERFORM public.record_ontology_save(v_ont, ''merge'', b, p_proposal);
  DELETE FROM public.branch_resource_changes WHERE branch_id = b;');
  EXECUTE src;
END $do$;

-- ── RESTORE ──────────────────────────────────────────────────────────────────

CREATE FUNCTION public.restore_object_type(p_object_type uuid, p_save uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  s record; v_def jsonb; v_current jsonb; v_op text; v_fields jsonb; v_base jsonb;
BEGIN
  SELECT * INTO s FROM public.ontology_saves WHERE id = p_save;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ontology:NoSuchSave — %', p_save;
  END IF;

  -- "any changes that were made after the entry you selected will be undone"
  -- — nothing after it means nothing to undo
  IF NOT EXISTS (
    SELECT 1 FROM public.ontology_save_changes c
    JOIN public.ontology_saves sv ON sv.id = c.save_id
    WHERE c.resource_kind = 'object_type' AND c.resource_id = p_object_type
      AND sv.ontology_id = s.ontology_id AND sv.saved_at > s.saved_at) THEN
    RAISE EXCEPTION 'Ontology:NothingToRestore — nothing changed on this object type after that entry';
  END IF;

  -- the definition as it stood at the entry: the latest snapshot at or before
  SELECT c.definition INTO v_def
    FROM public.ontology_save_changes c
    JOIN public.ontology_saves sv ON sv.id = c.save_id
   WHERE c.resource_kind = 'object_type' AND c.resource_id = p_object_type
     AND sv.ontology_id = s.ontology_id AND sv.saved_at <= s.saved_at
   ORDER BY sv.saved_at DESC LIMIT 1;

  v_current := public.ontology_resource_row('object_type', p_object_type);

  IF v_def IS NULL THEN
    -- deleted at the entry, or created only after it
    IF v_current IS NULL THEN
      RAISE EXCEPTION 'Ontology:NothingToRestore — the object type does not exist now and did not exist then';
    END IF;
    v_op := 'deleted'; v_fields := '{}'::jsonb; v_base := v_current;
  ELSIF v_current IS NULL THEN
    v_op := 'created'; v_fields := v_def; v_base := '{}'::jsonb;
  ELSE
    v_op := 'modified'; v_fields := v_def; v_base := v_current;
  END IF;

  -- "The changes will be added to your working state" — replacing any
  -- unsaved edit of this type, since the restore is the newer intent
  DELETE FROM public.working_state_changes
   WHERE user_id = auth.uid() AND branch_id IS NULL
     AND resource_kind = 'object_type' AND resource_id = p_object_type;
  INSERT INTO public.working_state_changes
    (ontology_id, branch_id, resource_kind, resource_id, operation,
     fields, base, base_version)
  VALUES (s.ontology_id, NULL, 'object_type', p_object_type, v_op,
          v_fields, v_base,
          (SELECT version FROM public.ontologies WHERE id = s.ontology_id));
END $$;

COMMENT ON FUNCTION public.restore_object_type(uuid, uuid) IS
  'Stages the object type''s definition as it stood at the chosen history entry into the caller''s working state — reviewable, discardable, and saved through the same session as any hand edit (ontology-manager/restore-changes). Documented for object types only, scoped exactly that way. A type created after the entry stages a delete; one deleted after it stages a recreate.';

REVOKE ALL ON FUNCTION public.restore_object_type(uuid, uuid) FROM PUBLIC, anon;

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_ont uuid; v_usr uuid;
  v_ds uuid; v_br uuid; v_ds2 uuid; v_br2 uuid; v_ot uuid; v_ot2 uuid; v_save0 uuid; v_save1 uuid;
  v_branch uuid; v_prop uuid; v_n int; v_label text;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe672') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe672') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe672', 'Probe672') RETURNING id INTO v_proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_sp, 'probe672', 'Probe 672', false) RETURNING id INTO v_ont;
    v_usr := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe672-' || v_usr || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, 'probe672-' || v_usr || '@beacon.test', 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe672', 'Probe672') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds, 'master') RETURNING id INTO v_br;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe672b', 'Probe672 B') RETURNING id INTO v_ds2;
    INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds2, 'master') RETURNING id INTO v_br2;

    -- save 0: another resource entirely, so a restore-before-creation exists
    v_ot2 := public.save_object_type(
      jsonb_build_object('api_name', 'Probe672Other', 'label', 'Other', 'ontology_id', v_ont::text,
        'datasources', jsonb_build_array(jsonb_build_object('dataset_id', v_ds::text, 'branch_id', v_br::text))),
      jsonb_build_array(jsonb_build_object('property_id', 'pk', 'display_name', 'Id',
        'api_name', 'pk', 'base_type', 'string', 'source', 'column', 'backing_column', 'pk',
        'is_primary_key', true, 'is_title_key', true, 'required', true)));
    PERFORM public.save_working_state();
    SELECT id INTO v_save0 FROM public.ontology_saves
     WHERE ontology_id = v_ont ORDER BY saved_at DESC LIMIT 1;

    -- save 1: the type under test is born as "One"
    v_ot := public.save_object_type(
      jsonb_build_object('api_name', 'Probe672A', 'label', 'One', 'ontology_id', v_ont::text,
        'datasources', jsonb_build_array(jsonb_build_object('dataset_id', v_ds2::text, 'branch_id', v_br2::text))),
      jsonb_build_array(jsonb_build_object('property_id', 'pk', 'display_name', 'Id',
        'api_name', 'pk', 'base_type', 'string', 'source', 'column', 'backing_column', 'pk',
        'is_primary_key', true, 'is_title_key', true, 'required', true)));
    PERFORM public.save_working_state();
    SELECT id INTO v_save1 FROM public.ontology_saves
     WHERE ontology_id = v_ont ORDER BY saved_at DESC LIMIT 1;

    -- save 2: renamed to "Two"
    PERFORM public.save_object_type(
      jsonb_build_object('id', v_ot::text, 'api_name', 'Probe672A', 'label', 'Two',
        'ontology_id', v_ont::text,
        'datasources', jsonb_build_array(jsonb_build_object('dataset_id', v_ds2::text, 'branch_id', v_br2::text))),
      NULL);
    PERFORM public.save_working_state();

    -- the history: three saves, each with its rows and snapshots
    SELECT count(*) INTO v_n FROM public.ontology_saves WHERE ontology_id = v_ont AND via = 'save';
    IF v_n <> 3 THEN
      RAISE EXCEPTION 'three saves should have recorded, got %', v_n;
    END IF;
    SELECT count(*) INTO v_n FROM public.ontology_save_changes c
      JOIN public.ontology_saves s ON s.id = c.save_id
     WHERE s.ontology_id = v_ont AND c.resource_kind = 'object_type'
       AND c.resource_id = v_ot AND c.definition IS NOT NULL AND c.label = 'Probe672A';
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'the type under test should carry two labeled snapshots, got %', v_n;
    END IF;

    -- restore to save 1 stages the old definition; the save applies it
    PERFORM public.restore_object_type(v_ot, v_save1);
    SELECT count(*) INTO v_n FROM public.working_state_changes
     WHERE user_id = v_usr AND resource_kind = 'object_type' AND resource_id = v_ot
       AND operation = 'modified' AND fields ->> 'label' = 'One';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'the restore should stage the entry''s definition, found %', v_n;
    END IF;
    PERFORM public.save_working_state();
    SELECT label INTO v_label FROM public.object_types WHERE id = v_ot;
    IF v_label IS DISTINCT FROM 'One' THEN
      RAISE EXCEPTION 'the saved restore should bring the old label back, got %', v_label;
    END IF;
    -- and the restore itself is now a fourth history entry
    SELECT count(*) INTO v_n FROM public.ontology_saves WHERE ontology_id = v_ont;
    IF v_n <> 4 THEN
      RAISE EXCEPTION 'the saved restore should record as an entry, got %', v_n;
    END IF;

    -- restoring to the newest entry has nothing to undo
    BEGIN
      PERFORM public.restore_object_type(v_ot,
        (SELECT id FROM public.ontology_saves WHERE ontology_id = v_ont ORDER BY saved_at DESC LIMIT 1));
      RAISE EXCEPTION 'a restore to the newest entry should refuse';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ontology:NothingToRestore%' THEN RAISE; END IF;
    END;

    -- restoring to before the type existed stages a delete — then discard it,
    -- which is the documented other half of reviewability
    PERFORM public.restore_object_type(v_ot, v_save0);
    SELECT count(*) INTO v_n FROM public.working_state_changes
     WHERE user_id = v_usr AND resource_id = v_ot AND operation = 'deleted';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'a restore to before creation should stage a delete, found %', v_n;
    END IF;
    DELETE FROM public.working_state_changes WHERE user_id = v_usr AND resource_id = v_ot;

    -- the merge path records too: a branch change, a task-less proposal, merge
    INSERT INTO public.ontology_branches (ontology_id, name, title, status)
      VALUES (v_ont, 'probe672-branch', 'Probe 672 branch', 'active') RETURNING id INTO v_branch;
    INSERT INTO public.working_state_changes
      (ontology_id, branch_id, resource_kind, resource_id, operation, fields, base, base_version)
    VALUES (v_ont, v_branch, 'object_type', v_ot, 'modified',
            '{"label": "Merged"}', '{"label": "One"}',
            (SELECT version FROM public.ontologies WHERE id = v_ont));
    PERFORM public.save_working_state(v_branch);
    INSERT INTO public.ontology_proposals (branch_id, name)
      VALUES (v_branch, 'Probe672 proposal') RETURNING id INTO v_prop;
    PERFORM public.merge_proposal(v_prop);

    SELECT count(*) INTO v_n FROM public.ontology_saves
     WHERE ontology_id = v_ont AND via = 'merge' AND proposal_id = v_prop;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'the merge should record one history entry, got %', v_n;
    END IF;
    SELECT c.label INTO v_label FROM public.ontology_save_changes c
      JOIN public.ontology_saves s ON s.id = c.save_id
     WHERE s.proposal_id = v_prop AND c.resource_id = v_ot;
    IF v_label IS DISTINCT FROM 'Probe672A' THEN
      RAISE EXCEPTION 'the merge entry should carry the labeled change row, got %', v_label;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '672 proved: three saves record three entries with labeled snapshots, a restore stages the entry''s definition and saving it brings the old label back as a fourth entry, restore-to-newest refuses, restore-to-before-creation stages a discardable delete, and a merged proposal records as a merge entry';
  END;
END $$;
