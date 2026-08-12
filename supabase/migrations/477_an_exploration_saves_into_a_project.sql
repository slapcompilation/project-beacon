-- E3 of the Object Explorer phase: saving. An Exploration is a dynamic object
-- set — "Save filters as a dynamic exploration that updates with new results" —
-- and a List is a static one — "Save current results as a static list matching
-- filters at this moment" (readings/object-explorer.md §10, the save dialog,
-- object-explorer/images/explorations_saved_list.png). The dynamic half is the
-- object_sets row we already have; the static half is a membership table.
--
-- Where a save lands: "If you choose Public, you will be prompted for a
-- location" (save-explorations.md). Private saves go to "the Explorations
-- folder in your home folder", and the page's own callout — "The configuration
-- of your enrollment might prevent saving files in home folders. In this case,
-- the option to save private explorations will also be disabled." — is this
-- platform: we have no home folders, so every save is Public and names a
-- project. Who may save there is the project's own editor bar, which also
-- retires the hospitality-era admins-only write policy on object_sets.
--
-- The RID note from the reading stands: Foundry distinguishes
-- `versioned-object-set` (saved explorations) from plain `object-set`; ours
-- keeps the one generated form, recorded as not reproduced.

-- ── the saved set is a project resource with a kind ────────────────────────

ALTER TABLE public.object_sets
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT,
  ADD COLUMN set_kind text NOT NULL DEFAULT 'exploration'
    CONSTRAINT object_sets_kind_check CHECK (set_kind IN ('exploration','list'));

-- Empty table, so the placement rule binds from the start.
ALTER TABLE public.object_sets ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX idx_object_sets_project ON public.object_sets (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS object_sets_ontology_api_name
  ON public.object_sets (ontology_id, api_name);

COMMENT ON COLUMN public.object_sets.set_kind IS
  'exploration = dynamic, re-evaluated from filters on every read; list = static, its membership rows are the answer until manually updated.';

-- "the saved list will not change unless manually updated" — one row per
-- member, keyed the way the index keys objects.
CREATE TABLE public.object_set_members (
  object_set_id uuid NOT NULL REFERENCES public.object_sets(id) ON DELETE CASCADE,
  primary_key   text NOT NULL,
  PRIMARY KEY (object_set_id, primary_key)
);

ALTER TABLE public.object_set_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members follow their set" ON public.object_set_members
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_sets s
     WHERE s.id = object_set_members.object_set_id
       AND public.auth_in_ontology(s.ontology_id)));
GRANT SELECT ON public.object_set_members TO authenticated;

-- Membership is what a list is; an exploration has none.
CREATE OR REPLACE FUNCTION public.guard_object_set_member()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT set_kind FROM public.object_sets WHERE id = NEW.object_set_id) <> 'list' THEN
    RAISE EXCEPTION 'Ontology:MembersNeedAList — an exploration is dynamic; only a list stores members';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_object_set_member
  BEFORE INSERT OR UPDATE ON public.object_set_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_object_set_member();

-- ── who saves: the project's editors, not the org's admins ─────────────────

DROP POLICY "admins author object sets in scope" ON public.object_sets;
CREATE POLICY "project editors author object sets" ON public.object_sets
  FOR ALL
  USING (public.auth_member_of_ontology(ontology_id)
         AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (public.auth_member_of_ontology(ontology_id)
              AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

-- ── saving ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_object_set(p_set jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type uuid := (p_set->>'subject_type_id')::uuid;
  v_kind text := coalesce(p_set->>'set_kind', 'exploration');
  v_filters jsonb := coalesce(p_set->'filters', '[]'::jsonb);
  v_project uuid := (p_set->>'project_id')::uuid;
  v_ont uuid; v_id uuid; v_pk text; r jsonb;
BEGIN
  SELECT t.ontology_id INTO v_ont FROM public.object_types t WHERE t.id = v_type;
  IF v_ont IS NULL OR NOT public.auth_in_ontology(v_ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', v_type;
  END IF;
  -- "If you choose Public, you will be prompted for a location" — and here
  -- every save is public, because there are no home folders to be private in.
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Ontology:SaveNeedsALocation — a saved exploration or list lands in a project';
  END IF;
  IF public.role_rank(public.project_role(v_project)) < public.role_rank('editor') THEN
    RAISE EXCEPTION 'Compass:InsufficientPermissions — saving into a project takes its editor role';
  END IF;

  INSERT INTO public.object_sets
    (ontology_id, project_id, name, api_name, description, subject_type_id, filters, set_kind)
  VALUES (v_ont, v_project,
    p_set->>'name',
    coalesce(p_set->>'api_name',
      regexp_replace(regexp_replace(lower(p_set->>'name'), '[^a-z0-9]+', '_', 'g'), '^_+|_+$', '', 'g')),
    coalesce(p_set->>'description', ''),
    v_type, v_filters, v_kind)
  RETURNING id INTO v_id;

  IF v_kind = 'list' THEN
    SELECT p.property_id INTO v_pk FROM public.object_type_properties p
     WHERE p.object_type_id = v_type AND p.is_primary_key;
    IF p_set->'primary_keys' IS NOT NULL THEN
      -- "save a specific selection of objects by manually ticking each row".
      INSERT INTO public.object_set_members (object_set_id, primary_key)
      SELECT v_id, x FROM jsonb_array_elements_text(p_set->'primary_keys') x;
    ELSE
      -- "matching filters at this moment": the snapshot is taken server-side,
      -- against the same engine a reader uses.
      FOR r IN SELECT e FROM public.evaluate_object_set(v_type, v_filters, '[]'::jsonb, 100000, 0) e LOOP
        INSERT INTO public.object_set_members (object_set_id, primary_key)
        VALUES (v_id, r->>v_pk);
      END LOOP;
    END IF;
  END IF;

  RETURN v_id;
END $$;

-- ── reading a saved set ────────────────────────────────────────────────────
-- One reader for both kinds: an exploration re-evaluates its filters; a list
-- resolves to a values filter on the primary key, so the row path — hidden
-- properties stripped, visibility checked — is exactly the engine's.

CREATE OR REPLACE FUNCTION public.object_set_rows(
  p_set uuid, p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s record; pk text; member_filter jsonb;
BEGIN
  SELECT * INTO s FROM public.object_sets WHERE id = p_set;
  IF s IS NULL OR NOT public.auth_in_ontology(s.ontology_id) THEN
    RAISE EXCEPTION 'Ontology:ObjectSetNotFound — % is not a saved set you can see', p_set;
  END IF;
  IF s.set_kind = 'exploration' THEN
    RETURN QUERY SELECT * FROM public.evaluate_object_set(
      s.subject_type_id, s.filters, '[]'::jsonb, p_limit, p_offset);
  ELSE
    SELECT p.property_id INTO pk FROM public.object_type_properties p
     WHERE p.object_type_id = s.subject_type_id AND p.is_primary_key;
    SELECT jsonb_build_array(jsonb_build_object(
      'type', 'propertyFilter', 'propertyType', pk,
      'value', jsonb_build_object('type', 'valuesFilter',
        'values', coalesce(jsonb_agg(m.primary_key), '[]'::jsonb))))
      INTO member_filter
      FROM public.object_set_members m WHERE m.object_set_id = p_set;
    RETURN QUERY SELECT * FROM public.evaluate_object_set(
      s.subject_type_id, member_filter, '[]'::jsonb, p_limit, p_offset);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.object_set_size(p_set uuid)
RETURNS bigint
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s record; n bigint;
BEGIN
  SELECT * INTO s FROM public.object_sets WHERE id = p_set;
  IF s IS NULL OR NOT public.auth_in_ontology(s.ontology_id) THEN
    RAISE EXCEPTION 'Ontology:ObjectSetNotFound — % is not a saved set you can see', p_set;
  END IF;
  IF s.set_kind = 'exploration' THEN
    RETURN public.count_object_set(s.subject_type_id, s.filters);
  END IF;
  SELECT count(*) INTO n FROM public.object_set_members m WHERE m.object_set_id = p_set;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.save_object_set(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.object_set_rows(uuid, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.object_set_size(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_object_set(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.object_set_rows(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.object_set_size(uuid) TO authenticated;

COMMENT ON FUNCTION public.save_object_set(jsonb) IS
  'Save the current exploration as a dynamic Exploration or a static List, into a project the caller can edit. A list without an explicit selection snapshots the filtered results at this moment.';
COMMENT ON FUNCTION public.object_set_rows(uuid, int, int) IS
  'A saved set''s objects: an exploration re-evaluates its filters; a list resolves its stored membership through the same engine path.';
COMMENT ON FUNCTION public.object_set_size(uuid) IS
  'How many objects a saved set holds right now — live for an exploration, stored for a list.';

-- ── assertions: dynamic updates, static does not ───────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid;
  ds uuid; br uuid; txn uuid; fid uuid; ptbl text;
  t uuid; usr uuid := gen_random_uuid(); before text; x public.object_type_indexes;
  exploration uuid; the_list uuid; picked uuid; n bigint;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('save-477') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws477@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws477@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS477');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'ws477', 'WS 477', false) RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws477', 'WS477') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'tickets477', 'tickets') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"ticket_id","type":"STRING"},{"name":"status","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'tickets.parquet', 3) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, ticket_id, status) VALUES
       ($1,''T1'',''open''),($1,''T2'',''open''),($1,''T3'',''closed'')', ptbl) USING fid;

  RESET ROLE;
  INSERT INTO public.object_types (ontology_id, api_name, label, edits_enabled)
  VALUES (ont, 'Ticket477', 'Ticket', true) RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (t, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, required, is_primary_key, is_title_key)
  VALUES (t, 'ticket_id', 'Ticket Id', 'ticketId', 'string', 'ticket_id', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, datasource_id, required)
  SELECT t, 'status', 'Status', 'status', 'string', 'status', d.id, false
    FROM public.object_type_datasources d WHERE d.object_type_id = t;
  SET LOCAL ROLE authenticated;

  x := public.index_object_type(t);
  IF x.status <> 'success' OR x.object_count <> 3 THEN
    RAISE EXCEPTION 'index expected success/3, got %/% (%)', x.status, x.object_count, x.error;
  END IF;

  -- 1. Without a location, the save refuses by name.
  BEGIN
    picked := public.save_object_set(jsonb_build_object(
      'name', 'Loose', 'subject_type_id', t::text));
    RAISE EXCEPTION 'a save landed without a location';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Ontology:SaveNeedsALocation%' THEN RAISE; END IF;
  END;

  -- 2. An exploration and a list of the same moment agree at first.
  exploration := public.save_object_set(jsonb_build_object(
    'name', 'Open tickets', 'subject_type_id', t::text, 'project_id', proj::text,
    'set_kind', 'exploration',
    'filters', '[{"type":"propertyFilter","propertyType":"status","value":{"type":"valuesFilter","values":["open"]}}]'::jsonb));
  the_list := public.save_object_set(jsonb_build_object(
    'name', 'Open tickets snapshot', 'subject_type_id', t::text, 'project_id', proj::text,
    'set_kind', 'list',
    'filters', '[{"type":"propertyFilter","propertyType":"status","value":{"type":"valuesFilter","values":["open"]}}]'::jsonb));
  IF public.object_set_size(exploration) <> 2 OR public.object_set_size(the_list) <> 2 THEN
    RAISE EXCEPTION 'both saves should hold 2, got % and %',
      public.object_set_size(exploration), public.object_set_size(the_list);
  END IF;

  -- 3. The world changes: the exploration follows, the list does not.
  INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
  VALUES (t, 'T4', 'create', '{"ticket_id":"T4","status":"open"}'::jsonb);
  x := public.index_object_type(t);
  IF public.object_set_size(exploration) <> 3 THEN
    RAISE EXCEPTION 'the dynamic exploration did not update with new results';
  END IF;
  IF public.object_set_size(the_list) <> 2 THEN
    RAISE EXCEPTION 'the static list changed without being manually updated';
  END IF;

  -- 4. A ticked selection saves exactly those.
  picked := public.save_object_set(jsonb_build_object(
    'name', 'Just T1', 'subject_type_id', t::text, 'project_id', proj::text,
    'set_kind', 'list', 'primary_keys', '["T1"]'::jsonb));
  IF public.object_set_size(picked) <> 1
     OR (SELECT e->>'ticket_id' FROM public.object_set_rows(picked) e) <> 'T1' THEN
    RAISE EXCEPTION 'the ticked selection did not save exactly itself';
  END IF;

  -- 5. Members belong to lists alone.
  BEGIN
    INSERT INTO public.object_set_members (object_set_id, primary_key) VALUES (exploration, 'T1');
    RAISE EXCEPTION 'an exploration accepted members';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Ontology:MembersNeedAList%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '477: a save needs a location; dynamic follows the world, static holds its moment';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
