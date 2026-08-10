-- The working state: the layer between an edit and the ontology.
--
--   "Any changes you make in the Ontology Manager are stored locally in a
--    work-in-progress state. For these Ontology changes to be available for
--    others and reflected in user-facing applications, you must save your
--    changes."                                    (ontology-manager/save-changes)
--
-- Ours has had no such layer: every surface wrote straight through to
-- `object_types`. That is the gap `readings/ontology-manager-save-session.md`
-- was written for, and this is the layer it describes.
--
-- ── WHERE IT LIVES, and how much of that is quoted ──────────────────────────
-- Server-side, one working state per (user, branch). Two of those three are
-- attested and one is inference, and the difference matters:
--
--   per branch — QUOTED. "Branch resets cannot be undone. After resetting, all
--   changes on you original branch will be lost, including saved and unsaved
--   changes." (pipeline-builder/branches-propose-a-change) Unsaved changes are
--   enumerated beside saved ones and die with the branch.
--
--   server-side — INFERENCE, and the reading says so at length. No page states
--   it for the Ontology Manager. Quiver is the one product in 1,766 pages that
--   describes the mechanism: "in between each Save action, Quiver auto-saves
--   your "working" state (storing it in the `state` URL variable, for example
--   `state=j05na7mun3`). This allows you to refresh your page and get back your
--   exact analysis state even if you have not saved." A ten-character token
--   cannot hold an analysis and a shared link cannot serve state that only ever
--   existed in one browser, so the handle names something on a server. Foundry
--   also says "in memory … cleared on refresh" plainly when that is what it
--   means (aip-analyst/workshop-widget), and does not say it here.
--
--   per user — INFERENCE. Quiver keys its working state by a shareable handle,
--   not by a person. The Ontology Manager shows no such parameter in any of its
--   56 screenshots and attributes an unsaved entry to a user, so this follows
--   the Ontology Manager rather than Quiver.
--
-- What would overturn the middle one: a course screen showing unsaved ontology
-- edits lost on refresh, or absent on a second machine.
--
-- ── WHY IT IS SHAPED LIKE `branch_resource_changes` ────────────────────────
-- Because it is the same thing one layer down. 419 overlays a branch on main;
-- this overlays a user on a branch. Same `fields`/`base` pair, same reason:
--
--   "Workshop auto-merges changes that do not overlap. A change is only flagged
--    as a merge conflict when the same widget, variable, section, or layout
--    position was edited on both `main` and your branch."
--                                            (workshop/branching-integration)
--
-- Auto-resolving what does not overlap is only possible against a base. Slate,
-- which has no base, must treat every differing line as a conflict — its own
-- worked example flags a field the second user never touched.

-- ── the ontology carries a version ──────────────────────────────────────────
-- "The Save button may also be grayed out if the Ontology has been saved by
-- another user since you began." Quiver and Slate both render this as an
-- integer — `v8 … Current`, `THEIRS (V16)` — not a timestamp.
ALTER TABLE public.ontologies
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);

COMMENT ON COLUMN public.ontologies.version IS
  'Bumped once per save. An integer, not a timestamp: Quiver renders saved versions as v1..v8 and Slate labels the other side of a merge THEIRS (V16).';

-- ── the working state ───────────────────────────────────────────────────────
CREATE TABLE public.working_state_changes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  ontology_id   uuid NOT NULL REFERENCES public.ontologies(id) ON DELETE CASCADE,
  -- NULL means main. 419 made main implicit — its CHECK forbids a branch named
  -- `main` — so this follows that rather than inventing a row for it.
  branch_id     uuid REFERENCES public.ontology_branches(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  resource_kind text NOT NULL CHECK (resource_kind IN
    ('object_type','link_type','shared_property','interface','action_type','type_group')),
  resource_id   uuid NOT NULL,

  operation     text NOT NULL CHECK (operation IN ('created','modified','deleted')),
  -- What I want each field to be, and what it held when I first touched it.
  fields        jsonb NOT NULL DEFAULT '{}'::jsonb,
  base          jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- The ontology version my base was read at. Only the dialog needs it —
  -- staleness is decided per field by comparing `base` against the live row —
  -- but "saved by another user since you began" is a sentence about versions.
  base_version  integer NOT NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CHECK (operation <> 'created' OR base = '{}'::jsonb),
  CHECK (operation <> 'deleted' OR fields = '{}'::jsonb)
);

COMMENT ON TABLE public.working_state_changes IS
  'The work-in-progress state: one entry per resource I have edited and not yet saved. "Each resource in the Ontology that you edit will have its own entry in the Review edits dialog." Same fields/base pair as branch_resource_changes, one layer down — this overlays a user on a branch, that overlays a branch on main.';

-- One entry per resource, per person, per branch. Two partial indexes rather
-- than one, because NULL is not equal to itself and main is spelled NULL.
CREATE UNIQUE INDEX working_state_one_entry_per_branch
  ON public.working_state_changes (user_id, branch_id, resource_kind, resource_id)
  WHERE branch_id IS NOT NULL;
CREATE UNIQUE INDEX working_state_one_entry_on_main
  ON public.working_state_changes (user_id, resource_kind, resource_id)
  WHERE branch_id IS NULL;

CREATE INDEX idx_working_state_mine ON public.working_state_changes (user_id, ontology_id);

ALTER TABLE public.working_state_changes ENABLE ROW LEVEL SECURITY;

-- Mine and nobody else's. Unsaved work is not "available for others" by
-- definition — that is what saving is for.
CREATE POLICY "my working state" ON public.working_state_changes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid()
              AND NOT (ontology_id IN (SELECT id FROM public.ontologies) IS NOT TRUE));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.working_state_changes TO authenticated;

-- ── the live row for a resource, whatever kind it is ────────────────────────
-- 419 inlines this CASE inside branch_conflicts. Lifting it out means the two
-- layers cannot drift on what "the current value" means.
CREATE OR REPLACE FUNCTION public.ontology_resource_row(p_kind text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE row_json jsonb; tbl text;
BEGIN
  tbl := CASE p_kind
           WHEN 'object_type'     THEN 'object_types'
           WHEN 'link_type'       THEN 'link_types'
           WHEN 'shared_property' THEN 'shared_properties'
           WHEN 'interface'       THEN 'ontology_interfaces'
           WHEN 'action_type'     THEN 'action_types'
           WHEN 'type_group'      THEN 'type_groups'
         END;
  IF tbl IS NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:UnknownResourceKind — % is not an ontology resource', p_kind;
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1', tbl)
    INTO row_json USING p_id;
  RETURN row_json;
END $$;

COMMENT ON FUNCTION public.ontology_resource_row(text, uuid) IS
  'A resource as jsonb, whatever kind it is. One place where a resource kind maps to its table, so the working state and the branch overlay cannot disagree about what the current value is.';

REVOKE ALL ON FUNCTION public.ontology_resource_row(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ontology_resource_row(text, uuid) TO authenticated;

-- ── staging an edit ─────────────────────────────────────────────────────────
-- The base is captured the FIRST time a resource is touched and never again.
-- Re-reading it on every edit would quietly adopt somebody else's save as my
-- own starting point, and the conflict would vanish instead of being shown.
CREATE OR REPLACE FUNCTION public.stage_change(
  p_kind      text,
  p_id        uuid,
  p_fields    jsonb,
  p_branch    uuid DEFAULT NULL,
  p_operation text DEFAULT 'modified'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_live jsonb;
  v_ont  uuid;
  v_ver  integer;
  v_id   uuid;
  v_base jsonb := '{}'::jsonb;
  k      text;
BEGIN
  v_live := public.ontology_resource_row(p_kind, p_id);

  IF p_operation = 'created' THEN
    v_ont := nullif(p_fields->>'ontology_id','')::uuid;
    IF v_ont IS NULL THEN
      RAISE EXCEPTION 'Ontology:NoOntology — a staged creation must name the ontology it is for';
    END IF;
  ELSE
    IF v_live IS NULL THEN
      RAISE EXCEPTION 'OntologyMetadata:ResourceNotFound — % % does not exist, so there is nothing to edit', p_kind, p_id;
    END IF;
    v_ont := (v_live->>'ontology_id')::uuid;
    -- Only the fields being changed, and only on first touch.
    FOR k IN SELECT jsonb_object_keys(p_fields) LOOP
      v_base := v_base || jsonb_build_object(k, v_live -> k);
    END LOOP;
  END IF;

  SELECT version INTO v_ver FROM public.ontologies WHERE id = v_ont;
  IF v_ver IS NULL THEN
    RAISE EXCEPTION 'Ontology:NoOntology — ontology % is not visible to this session', v_ont;
  END IF;

  SELECT id INTO v_id FROM public.working_state_changes
   WHERE user_id = auth.uid() AND resource_kind = p_kind AND resource_id = p_id
     AND branch_id IS NOT DISTINCT FROM p_branch;

  IF v_id IS NULL THEN
    INSERT INTO public.working_state_changes
      (ontology_id, branch_id, resource_kind, resource_id, operation, fields, base, base_version)
    VALUES (v_ont, p_branch, p_kind, p_id, p_operation,
            CASE WHEN p_operation = 'deleted' THEN '{}'::jsonb ELSE p_fields END,
            CASE WHEN p_operation = 'created' THEN '{}'::jsonb ELSE v_base END,
            v_ver)
    RETURNING id INTO v_id;
  ELSE
    -- Merge into the existing entry. A field already in `base` keeps the value
    -- it was first seen with; a field touched for the first time gets one now.
    -- `base` must cover every key in `fields` or the conflict check compares a
    -- live value against an absent key and calls it a disagreement.
    UPDATE public.working_state_changes
       SET fields = CASE WHEN p_operation = 'deleted' THEN '{}'::jsonb ELSE fields || p_fields END,
           base   = CASE WHEN p_operation = 'created' THEN '{}'::jsonb ELSE v_base || base END,
           operation = CASE WHEN operation = 'created' THEN 'created' ELSE p_operation END,
           updated_at = now()
     WHERE id = v_id;
  END IF;

  RETURN v_id;
END $$;

COMMENT ON FUNCTION public.stage_change(text, uuid, jsonb, uuid, text) IS
  'Put an edit in my working state instead of writing it through. Captures the base on first touch only — re-reading it would silently adopt someone else''s save as my starting point and the conflict would disappear rather than be shown.';

REVOKE ALL ON FUNCTION public.stage_change(text, uuid, jsonb, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stage_change(text, uuid, jsonb, uuid, text) TO authenticated;

-- ── what somebody else moved while I was editing ────────────────────────────
-- The same comparison branch_conflicts() makes, one layer down: my base against
-- the live row. Everything not listed auto-merges, which is the Workshop rule.
CREATE OR REPLACE FUNCTION public.working_state_conflicts(p_branch uuid DEFAULT NULL)
RETURNS TABLE (resource_kind text, resource_id uuid, field text,
               base_value jsonb, mine jsonb, theirs jsonb)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE c record; k text; live jsonb;
BEGIN
  FOR c IN SELECT * FROM public.working_state_changes
            WHERE user_id = auth.uid()
              AND branch_id IS NOT DISTINCT FROM p_branch
              AND operation = 'modified'
  LOOP
    live := public.ontology_resource_row(c.resource_kind, c.resource_id);
    IF live IS NULL THEN CONTINUE; END IF;   -- deleted under me; a different case

    FOR k IN SELECT jsonb_object_keys(c.fields) LOOP
      IF live -> k IS DISTINCT FROM c.base -> k THEN
        resource_kind := c.resource_kind;
        resource_id   := c.resource_id;
        field         := k;
        base_value    := c.base -> k;
        mine          := c.fields -> k;
        theirs        := live -> k;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.working_state_conflicts(uuid) IS
  'Every field both I and someone else have moved since I started. Everything not listed auto-merges: "Workshop auto-merges changes that do not overlap." The rows here are what the Update-and-merge dialog asks about.';

REVOKE ALL ON FUNCTION public.working_state_conflicts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.working_state_conflicts(uuid) TO authenticated;

-- ── discarding, per resource and wholesale ──────────────────────────────────
--   "You can discard the changes you made to a resource by hovering over the
--    entry and selecting the trash icon."
--
-- Per ENTRY, note — not per field. The dialog offers no finer discard, so
-- neither does this.
CREATE OR REPLACE FUNCTION public.discard_working_state(
  p_kind   text DEFAULT NULL,
  p_id     uuid DEFAULT NULL,
  p_branch uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF (p_kind IS NULL) <> (p_id IS NULL) THEN
    RAISE EXCEPTION 'OntologyMetadata:PartialDiscardTarget — name both a resource kind and an id, or neither to discard everything';
  END IF;

  DELETE FROM public.working_state_changes
   WHERE user_id = auth.uid()
     AND branch_id IS NOT DISTINCT FROM p_branch
     AND (p_kind IS NULL OR (resource_kind = p_kind AND resource_id = p_id));

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMENT ON FUNCTION public.discard_working_state(text, uuid, uuid) IS
  'Discard one entry, or all of them. Per entry and not per field, because that is the only granularity the Review edits dialog offers.';

REVOKE ALL ON FUNCTION public.discard_working_state(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discard_working_state(text, uuid, uuid) TO authenticated;

-- ── the save ────────────────────────────────────────────────────────────────
--   "While errors need to be handled in order to save, warnings will not
--    prevent you from saving."
--
-- Errors are checked by APPLYING and then asking ontology_violations(), inside
-- the caller's transaction. A rejected save raises, so nothing lands. That is
-- cheaper and truer than a second linter that predicts what applying would do,
-- and it cannot drift from the real one.
--
-- Branch saves are not implemented here and raise rather than pretending: a
-- save onto a branch writes to the branch overlay (419), not to the live tables,
-- and that path needs its own migration.
CREATE OR REPLACE FUNCTION public.save_working_state(p_branch uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c        record;
  v_ont    uuid;
  v_stale  integer;
  v_before text[];
  v_bad    text;
  v_saved  integer := 0;
  tbl      text;
  sets     text;
  k        text;
BEGIN
  IF p_branch IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:BranchSaveNotImplemented — saving onto a branch writes to the branch overlay, which is a separate path'
      USING HINT = 'Save on main, or use the branch overlay directly until that path exists.';
  END IF;

  SELECT count(*) INTO v_stale FROM public.working_state_conflicts(p_branch);
  IF v_stale > 0 THEN
    RAISE EXCEPTION 'OntologyMetadata:StaleWorkingState — % field(s) were changed by someone else since you began', v_stale
      USING HINT = 'Update to pull their changes in, then choose per field. working_state_conflicts() lists them.';
  END IF;

  -- Every violation standing BEFORE this save. A save is blocked by the errors
  -- it causes, not by errors that were already there — otherwise one malformed
  -- resource freezes the ontology for everybody who edits anything else.
  SELECT array_agg(format('%s|%s|%s|%s', object_type, scope, subject, problem))
    INTO v_before FROM public.ontology_violations();

  FOR c IN SELECT * FROM public.working_state_changes
            WHERE user_id = auth.uid() AND branch_id IS NOT DISTINCT FROM p_branch
            ORDER BY created_at
  LOOP
    v_ont := c.ontology_id;
    tbl := CASE c.resource_kind
             WHEN 'object_type'     THEN 'object_types'
             WHEN 'link_type'       THEN 'link_types'
             WHEN 'shared_property' THEN 'shared_properties'
             WHEN 'interface'       THEN 'ontology_interfaces'
             WHEN 'action_type'     THEN 'action_types'
             WHEN 'type_group'      THEN 'type_groups'
           END;

    IF c.operation = 'deleted' THEN
      EXECUTE format('DELETE FROM public.%I WHERE id = $1', tbl) USING c.resource_id;
    ELSIF c.operation = 'created' THEN
      EXECUTE format(
        'INSERT INTO public.%I (id, %s) SELECT $1, %s',
        tbl,
        (SELECT string_agg(quote_ident(key), ', ') FROM jsonb_each(c.fields)),
        (SELECT string_agg(format('$2->>%L', key), ', ') FROM jsonb_each(c.fields)))
      USING c.resource_id, c.fields;
    ELSE
      sets := '';
      FOR k IN SELECT jsonb_object_keys(c.fields) LOOP
        sets := sets || CASE WHEN sets = '' THEN '' ELSE ', ' END
                     || format('%I = ($2->>%L)', k, k);
      END LOOP;
      EXECUTE format('UPDATE public.%I SET %s WHERE id = $1', tbl, sets)
        USING c.resource_id, c.fields;
    END IF;

    v_saved := v_saved + 1;
  END LOOP;

  IF v_saved = 0 THEN
    RETURN 0;
  END IF;

  -- Errors block; warnings do not. This is the same function the badge counts,
  -- minus whatever was already broken when we started.
  SELECT string_agg(v.shown, '; ') INTO v_bad
    FROM (SELECT format('%s.%s: %s', object_type, subject, problem) AS shown,
                 format('%s|%s|%s|%s', object_type, scope, subject, problem) AS key
            FROM public.ontology_violations()) v
   WHERE NOT (v.key = ANY (coalesce(v_before, ARRAY[]::text[])));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:SaveBlockedByErrors — %', v_bad
      USING HINT = 'Errors need to be handled in order to save. Nothing was written.';
  END IF;

  UPDATE public.ontologies SET version = version + 1 WHERE id = v_ont;

  DELETE FROM public.working_state_changes
   WHERE user_id = auth.uid() AND branch_id IS NOT DISTINCT FROM p_branch;

  RETURN v_saved;
END $$;

COMMENT ON FUNCTION public.save_working_state(uuid) IS
  'Apply my working state to the ontology, bump its version and clear the state. Errors block the whole save and nothing lands; warnings do not. Validation runs by applying and then asking ontology_violations(), so it cannot drift from the linter the badge counts.';

REVOKE ALL ON FUNCTION public.save_working_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_working_state(uuid) TO authenticated;

-- ── assertions, as the role the surface connects as ─────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; t uuid; usr uuid := gen_random_uuid();
  before text; n int; v int; got text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('working-426') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'ws426@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
                      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp  := public.create_space('WS426');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws426', 'WS 426') RETURNING id INTO ont;

  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text),
    '[]'::jsonb);

  -- 1. An edit goes to the working state, and NOT to the live row.
  PERFORM public.stage_change('object_type', t, jsonb_build_object('label','Flight Leg'));
  IF (SELECT label FROM public.object_types WHERE id = t) <> 'Flight' THEN
    RAISE EXCEPTION 'a staged edit reached the live ontology — the whole point of the layer is that it does not';
  END IF;
  SELECT count(*) INTO n FROM public.working_state_changes WHERE resource_id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'expected one working state entry, found %', n; END IF;

  -- 2. A second edit to the same resource merges into the SAME entry, and the
  --    base still names the original value.
  PERFORM public.stage_change('object_type', t, jsonb_build_object('description','A leg'));
  SELECT count(*) INTO n FROM public.working_state_changes WHERE resource_id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'a second edit made a second entry — it is one entry per resource'; END IF;
  SELECT base->>'label' INTO got FROM public.working_state_changes WHERE resource_id = t;
  IF got <> 'Flight' THEN
    RAISE EXCEPTION 'the base was re-read on the second edit (got %) — that adopts someone else''s save as my starting point', got;
  END IF;

  -- 3. Nobody else moved anything, so there is no conflict.
  SELECT count(*) INTO n FROM public.working_state_conflicts();
  IF n <> 0 THEN RAISE EXCEPTION 'a conflict appeared with only one editor'; END IF;

  -- 4. Somebody else saves the SAME field. Now it conflicts.
  UPDATE public.object_types SET label = 'Sector' WHERE id = t;
  SELECT count(*) INTO n FROM public.working_state_conflicts();
  IF n <> 1 THEN RAISE EXCEPTION 'expected exactly one conflicting field, found %', n; END IF;

  -- 5. And the save refuses while it stands.
  BEGIN
    PERFORM public.save_working_state();
    RAISE EXCEPTION 'a stale save was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%StaleWorkingState%' THEN RAISE; END IF;
  END;

  -- 6. Somebody else moving a DIFFERENT field is not a conflict — the Workshop
  --    rule, and the whole reason the base is stored.
  UPDATE public.object_types SET label = 'Flight' WHERE id = t;    -- put it back
  UPDATE public.object_types SET icon = 'airplane' WHERE id = t;   -- untouched by me
  SELECT count(*) INTO n FROM public.working_state_conflicts();
  IF n <> 0 THEN
    RAISE EXCEPTION 'a field I never touched was called a conflict — that is the two-way diff Slate is stuck with';
  END IF;

  -- 7. The save applies, bumps the version and clears the state.
  SELECT version INTO v FROM public.ontologies WHERE id = ont;
  n := public.save_working_state();
  IF n <> 1 THEN RAISE EXCEPTION 'expected one resource saved, got %', n; END IF;
  IF (SELECT label FROM public.object_types WHERE id = t) <> 'Flight Leg' THEN
    RAISE EXCEPTION 'the save did not reach the ontology';
  END IF;
  IF (SELECT icon FROM public.object_types WHERE id = t) <> 'airplane' THEN
    RAISE EXCEPTION 'the save overwrote a field it was never asked to touch';
  END IF;
  IF (SELECT version FROM public.ontologies WHERE id = ont) <> v + 1 THEN
    RAISE EXCEPTION 'the version did not move';
  END IF;
  SELECT count(*) INTO n FROM public.working_state_changes;
  IF n <> 0 THEN RAISE EXCEPTION 'the working state survived its own save'; END IF;

  -- 8. Discard removes an entry without touching the ontology.
  PERFORM public.stage_change('object_type', t, jsonb_build_object('label','Discarded'));
  n := public.discard_working_state('object_type', t);
  IF n <> 1 THEN RAISE EXCEPTION 'discard removed % entries', n; END IF;
  IF (SELECT label FROM public.object_types WHERE id = t) <> 'Flight Leg' THEN
    RAISE EXCEPTION 'discard changed the ontology';
  END IF;

  -- 9. A save that would break the ontology lands nothing at all.
  PERFORM public.stage_change('object_type', t, jsonb_build_object('api_name','not pascal'));
  BEGIN
    PERFORM public.save_working_state();
    RAISE EXCEPTION 'an invalid api name was saved';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm LIKE '%an invalid api name was saved%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '426: staged, merged, conflicted, discarded and saved as authenticated';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
