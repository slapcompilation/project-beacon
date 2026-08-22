-- Export and import of the Ontology working state, which Ontology Manager has
-- on its Advanced settings page and we did not have at all.
--
--   "Ontology schema definitions are stored in a JSON file. An Ontology JSON
--   file can be exported and edited with a code editor or text editor before
--   being imported back into Foundry."
--   — ontology-manager/export-import.md
--
-- We have `save_working_state`, `discard_working_state`, `update_working_state`
-- and `working_state_conflicts` — the whole session — and no way to get the
-- thing out or back in. `working_state_changes` is the working state, so this
-- is a serialisation rather than a new model.
--
-- ── THE SCHEMA IS EXPLICITLY NOT A CONTRACT ─────────────────────────────────
--   "You should not depend on the exported JSON schema as it may change over
--   time."
--   — ontology-manager/export-import.md
--
-- Unusually, the page frees us: there is no shape to match, only a shape to
-- pick. Ours is the rows as they are, under an envelope naming what produced
-- them, because the alternative — inventing a Foundry-looking schema — would be
-- inventing a thing the page says not to rely on.
--
-- ── WHAT EXPORT TAKES ───────────────────────────────────────────────────────
--   "Any changes you have in your working state will be included in the
--   export."
--   — ontology-manager/export-import.md
--
-- The WORKING state, not the saved one: unsaved changes are the point of the
-- file. Per caller, because `working_state_changes` is keyed by user and one
-- person's session is not another's.
--
-- ── WHAT IMPORT DOES, AND IT REPLACES ───────────────────────────────────────
--   "select **Import,** which will recreate the entire working state from the
--   JSON file in the application."
--   — ontology-manager/export-import.md
--
-- "The ENTIRE working state" — so import is a replacement, not a merge. It
-- discards the caller's current changes for that ontology and branch first.
-- That is destructive to unsaved work by design, which is why it returns the
-- count the page says the header then shows:
--
--   "You will see the number of changes made in the file that need to be saved
--   in the application header."
--
-- ── CROSS-ONTOLOGY COPYING IS NOT BUILT, AND THE REASON IS OURS ─────────────
-- The page names two workflows and this file serves one. The second — "copy
-- the working state of one Ontology to another" — needs resources to be
-- addressed by something that survives the crossing, and
-- `working_state_changes.resource_id` is a uuid pointing into the ontology it
-- came from. A `modified` change would name a resource the target does not
-- have. Foundry's own file presumably keys on API names; ours would have to,
-- and that is a re-keying rather than an export. Import refuses a mismatched
-- ontology BY NAME rather than silently producing dangling rows.
--
-- ── THE CAVEAT THAT CANNOT FIRE HERE ────────────────────────────────────────
--   "An exported Ontology working state with conditional formatting rules
--   configured on its properties cannot be imported to an Ontology other than
--   the one it was exported from."
--   — ontology-manager/export-import.md
--
-- and its error, `OntologyMetadata:UnreferencedRuleSets`. We have no
-- conditional formatting at all — no table, no column — so there is nothing to
-- refuse and no token to add. Recorded rather than implemented, because a
-- value with no producer is the mistake 622 spent a paragraph on.

CREATE OR REPLACE FUNCTION public.export_working_state(
  p_ontology uuid, p_branch uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'ontology_id', p_ontology,
    'branch_id', p_branch,
    'exported_at', now(),
    -- Named so an older file can be recognised rather than misread. The page
    -- says the schema may change; this is how ours will say that it has.
    'format', 'beacon.working-state.v1',
    'changes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'resource_kind', w.resource_kind,
               'resource_id',   w.resource_id,
               'operation',     w.operation,
               'fields',        w.fields,
               'base',          w.base,
               'base_version',  w.base_version)
             ORDER BY w.resource_kind, w.resource_id)
        FROM public.working_state_changes w
       WHERE w.ontology_id = p_ontology
         AND w.branch_id IS NOT DISTINCT FROM p_branch
         AND w.user_id = (SELECT auth.uid())), '[]'::jsonb))
$$;

COMMENT ON FUNCTION public.export_working_state(uuid, uuid) IS
  'The caller''s working state as JSON. "Any changes you have in your working state will be included in the export" (ontology-manager/export-import). The schema is deliberately ours: the page says not to depend on it.';

CREATE OR REPLACE FUNCTION public.import_working_state(p_file jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public' AS $$
DECLARE v_ont uuid; v_branch uuid; c jsonb; n int := 0;
BEGIN
  IF p_file IS NULL OR jsonb_typeof(p_file) <> 'object' THEN
    RAISE EXCEPTION 'OntologyMetadata:MalformedImport — the file is not a JSON object';
  END IF;
  IF p_file->>'format' IS DISTINCT FROM 'beacon.working-state.v1' THEN
    RAISE EXCEPTION 'OntologyMetadata:MalformedImport — unknown file format %',
      coalesce(p_file->>'format', '(none)');
  END IF;
  IF jsonb_typeof(p_file->'changes') <> 'array' THEN
    RAISE EXCEPTION 'OntologyMetadata:MalformedImport — the file carries no changes array';
  END IF;

  v_ont := (p_file->>'ontology_id')::uuid;
  v_branch := (p_file->>'branch_id')::uuid;

  -- The ontology has to exist and be one the caller can see; RLS decides that,
  -- so an invisible ontology reads as absent.
  IF NOT EXISTS (SELECT 1 FROM public.ontologies o WHERE o.id = v_ont) THEN
    RAISE EXCEPTION 'OntologyMetadata:OntologyNotFound — % is not an ontology you can see', v_ont
      USING HINT = 'A working state cannot be imported into a different ontology: its changes address resources by id.';
  END IF;

  -- "recreate the ENTIRE working state" — a replacement, not a merge.
  DELETE FROM public.working_state_changes w
   WHERE w.ontology_id = v_ont
     AND w.branch_id IS NOT DISTINCT FROM v_branch
     AND w.user_id = (SELECT auth.uid());

  FOR c IN SELECT * FROM jsonb_array_elements(p_file->'changes') LOOP
    INSERT INTO public.working_state_changes
      (ontology_id, branch_id, user_id, resource_kind, resource_id,
       operation, fields, base, base_version)
    VALUES (v_ont, v_branch, (SELECT auth.uid()),
            c->>'resource_kind', (c->>'resource_id')::uuid,
            c->>'operation',
            coalesce(c->'fields', '{}'::jsonb),
            coalesce(c->'base', '{}'::jsonb),
            -- NOT NULL, and an export always carries it; a hand-edited file
            -- that drops it gets the base rather than a constraint error.
            coalesce((c->>'base_version')::integer, 0));
    n := n + 1;
  END LOOP;

  -- "You will see the number of changes made in the file that need to be
  -- saved in the application header."
  RETURN n;
END $$;

COMMENT ON FUNCTION public.import_working_state(jsonb) IS
  'Recreates the caller''s entire working state from an exported file, replacing whatever is there. Returns the number of changes, which is what the page says the header then shows.';

-- A round trip, run rather than described: export, change the world, import,
-- and check the world came back. Both refusals are exercised too, because an
-- import that accepts anything is worse than none.
DO $$
DECLARE
  v_ont uuid; v_ot uuid; v_user uuid; v_org uuid; v_file jsonb; v_n int;
  v_err text; v_before int; v_after int;
BEGIN
  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_user FROM public.users u LIMIT 1;
    IF v_ont IS NULL OR v_user IS NULL THEN
      RAISE EXCEPTION 'no ontology or user: 634 cannot prove its own round trip';
    END IF;

    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (v_ont, 'Exported634', 'Exported 634') RETURNING id INTO v_ot;

    -- The caller is the one whose working state this is.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.working_state_changes
      (ontology_id, user_id, resource_kind, resource_id, operation, fields, base, base_version)
    VALUES (v_ont, v_user, 'object_type', v_ot, 'modified',
            '{"label":"Renamed by the working state"}'::jsonb,
            '{"label":"Exported 634"}'::jsonb, 1),
           (v_ont, v_user, 'action_type', gen_random_uuid(), 'created',
            '{"label":"A new action"}'::jsonb, '{}'::jsonb, 1);

    SELECT count(*) INTO v_before FROM public.working_state_changes
     WHERE ontology_id = v_ont AND user_id = v_user;
    IF v_before <> 2 THEN
      RAISE EXCEPTION 'the probe did not stage two changes (% found)', v_before;
    END IF;

    -- (1) EXPORT carries them
    v_file := public.export_working_state(v_ont);
    IF jsonb_array_length(v_file->'changes') <> 2 THEN
      RAISE EXCEPTION 'the export carried % change(s) of two', jsonb_array_length(v_file->'changes');
    END IF;
    IF v_file->>'format' IS NULL THEN
      RAISE EXCEPTION 'the export names no format, so an older file could not be recognised';
    END IF;

    -- (2) the world changes underneath it
    DELETE FROM public.working_state_changes WHERE ontology_id = v_ont AND user_id = v_user;
    INSERT INTO public.working_state_changes
      (ontology_id, user_id, resource_kind, resource_id, operation, fields, base, base_version)
    VALUES (v_ont, v_user, 'link_type', gen_random_uuid(), 'created',
            '{"label":"Something else entirely"}'::jsonb, '{}'::jsonb, 1);

    -- (3) IMPORT recreates the ENTIRE working state — the interloper is gone
    v_n := public.import_working_state(v_file);
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'the import reported % change(s), and the page says it reports the file''s count', v_n;
    END IF;
    SELECT count(*) INTO v_after FROM public.working_state_changes
     WHERE ontology_id = v_ont AND user_id = v_user;
    IF v_after <> 2 THEN
      RAISE EXCEPTION 'after import the working state holds % change(s); import replaces rather than merges', v_after;
    END IF;
    IF EXISTS (SELECT 1 FROM public.working_state_changes
                WHERE ontology_id = v_ont AND user_id = v_user
                  AND resource_kind = 'link_type') THEN
      RAISE EXCEPTION 'a change absent from the file survived the import';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.working_state_changes
                    WHERE ontology_id = v_ont AND user_id = v_user
                      AND resource_kind = 'object_type' AND resource_id = v_ot
                      AND fields->>'label' = 'Renamed by the working state') THEN
      RAISE EXCEPTION 'the exported change did not come back intact';
    END IF;

    -- (4) both refusals, by name
    v_err := NULL;
    BEGIN PERFORM public.import_working_state('{"changes":[]}'::jsonb);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'OntologyMetadata:MalformedImport%' THEN
      RAISE EXCEPTION 'a file with no format was imported';
    END IF;

    v_err := NULL;
    BEGIN
      PERFORM public.import_working_state(jsonb_set(v_file, '{ontology_id}',
        to_jsonb(gen_random_uuid()::text)));
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'OntologyMetadata:OntologyNotFound%' THEN
      RAISE EXCEPTION 'a file naming an unknown ontology was imported (%)', coalesce(v_err, 'no error');
    END IF;

    PERFORM set_config('request.jwt.claims', '', true);
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '634 proved: two changes out, the world replaced, two back and the interloper gone, and both malformed files refused by name';
  END;
END $$;
