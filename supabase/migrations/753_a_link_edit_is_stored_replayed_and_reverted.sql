-- 753 — a link edit is stored, replayed, and reverted.
--
-- Lifting the refusal 742 wrote when it was true — Actions:LinkEditsNotSupported,
-- whose message said a many-to-many link has no instance store here. 750 built
-- the store, so the reason is stale and the arms become real. The docs settle
-- the shape:
--
--   "For many-to-many links, the link and unlink methods are available on the
--    created batch to add or remove links between objects."
--   — functions/typescript-v2-ontology-edits.md
--
--   "For one-to-one and one-to-many links, use the update method available on
--    the created batch to modify the foreign key property of the source
--    object."
--   — functions/typescript-v2-ontology-edits.md
--
-- So a link edit exists ONLY for join-table links — an FK link keeps arriving
-- as modifyObject, and the refusal stays for it with the page's own reason.
-- The wire members are the api's addLink/deleteLink, each a symmetric pair of
-- sides; provenance needs no new declaration:
--
--   "When editing join table links, both the source and target object types
--    should be declared."
--   — functions/api-ontology-edits.md
--
-- and permission is load-both-endpoints:
--
--   "The user is allowed to create the link as long as they can load both
--    object1 and object2 in any of the datasources D1[i..k] and D2[m..n],
--    respectively. No permission is checked on individual properties or
--    datasources."
--   — object-edits/permission-checks.md
--
-- Application is two-tier, and both tiers are cited: the store is written
-- synchronously because
--
--   "Edits to objects or links in Object Storage V2 will be visible
--    immediately after the action completes."
--   — api/ontologies-v2-resources-actions-apply-action.md
--
-- and the log replays on every build because
--
--   "Every time a writeback dataset is built, the history of edits is
--    reapplied to get the final state of edited links in the writeback
--    dataset."
--   — object-link-types/edit-link-types.md
--
-- Revert of link edits is INFERENCE, marked: action-reverts bounds its scope
-- per object and never says "link". The inference follows how-edits-applied —
-- "There is no mechanism to directly undo a single user edit or deletion
-- other than to make additional user edits" — so a revert appends the
-- compensating link edit (add answered by delete, delete by add), gated by a
-- most-recent-edit-per-pair rule mirroring the page's per-object one. Two
-- more marked inferences: a deleteLink of a pair that is not there is a
-- no-op and logs nothing (the api names no error for it, and logging one
-- would replay-delete a future pair); and a logged delete keeps winning over
-- a reappearing dataset row, importing the object rule "Once a deletion is
-- applied, the object is no longer visible regardless of datasource state".
-- A duplicate addLink refuses with the api's own name: LinkAlreadyExists.

-- ── the log, mirror of object_edits ─────────────────────────────────────────

CREATE SEQUENCE public.link_edits_seq_seq;
CREATE TABLE public.link_edits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_type_id       uuid NOT NULL REFERENCES public.link_types(id) ON DELETE CASCADE,
  a_key              text NOT NULL,
  b_key              text NOT NULL,
  instruction        text NOT NULL CONSTRAINT link_edits_instruction_check
                       CHECK (instruction IN ('addLink', 'deleteLink')),
  applied_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
  applied_by_user_id uuid,
  action_type_id     uuid,
  application_id     uuid,
  seq                bigint NOT NULL DEFAULT nextval('public.link_edits_seq_seq')
);
COMMENT ON TABLE public.link_edits IS
  'The per-link-type edit history, reapplied over the join dataset on every build (edit-link-types). One row per addLink/deleteLink that changed the pair set; a_key/b_key in the link''s own source/target orientation. Append-only by GRANT, like object_edits. 753.';
COMMENT ON CONSTRAINT link_edits_instruction_check ON public.link_edits IS
  'Values from ontologies-v2-resources-actions-apply-action';
CREATE INDEX link_edits_link_type_seq_idx ON public.link_edits (link_type_id, seq);
CREATE INDEX link_edits_application_idx ON public.link_edits (application_id);

ALTER TABLE public.link_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read edits of visible link types" ON public.link_edits
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.link_types l
     WHERE l.id = link_edits.link_type_id AND public.auth_in_ontology(l.ontology_id)));
-- No per-link edits toggle exists in the schema (recorded residual); the
-- INSERT gate is membership, and the store write is separately gated by the
-- action window below.
CREATE POLICY "members write link edits" ON public.link_edits
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.link_types l
     WHERE l.id = link_edits.link_type_id AND public.auth_member_of_ontology(l.ontology_id)));
GRANT SELECT, INSERT ON public.link_edits TO authenticated;
GRANT ALL ON public.link_edits TO service_role;
GRANT USAGE ON SEQUENCE public.link_edits_seq_seq TO authenticated, service_role;

-- ── the store writers, owner-side and window-gated ──────────────────────────

CREATE FUNCTION public.link_pair_exists(p_link uuid, p_a text, p_b text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE store text; hit boolean; lk record;
BEGIN
  SELECT l.* INTO lk FROM public.link_types l WHERE l.id = p_link;
  IF lk IS NULL OR NOT public.auth_in_ontology(lk.ontology_id) THEN
    RAISE EXCEPTION 'Ontology:LinkTypeNotFound — % is not a link type you can see', p_link;
  END IF;
  SELECT i.index_table INTO store FROM public.link_type_indexes i
   WHERE i.link_type_id = p_link AND public.link_type_index_ready(p_link);
  IF store IS NULL THEN RETURN NULL; END IF;   -- no store to ask
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM objects.%I WHERE %I::text = %L AND %I::text = %L)',
                 store, lk.source_key_column, p_a, lk.target_key_column, p_b) INTO hit;
  RETURN hit;
END $fn$;

CREATE FUNCTION public.replay_link_edit_to_store(p_link uuid, p_instruction text, p_a text, p_b text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE store text; lk record; changed boolean := false;
BEGIN
  -- "visible immediately after the action completes" — and only an action.
  -- The window closes with the body (606), so a direct caller cannot write
  -- the physical store through this door.
  IF current_setting('beacon.applying_action', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Actions:LinkEditOutsideAction — link edits arrive through an action';
  END IF;
  SELECT l.* INTO lk FROM public.link_types l WHERE l.id = p_link;
  IF lk IS NULL OR NOT public.auth_in_ontology(lk.ontology_id) THEN
    RAISE EXCEPTION 'Ontology:LinkTypeNotFound — % is not a link type you can see', p_link;
  END IF;
  SELECT i.index_table INTO store FROM public.link_type_indexes i
   WHERE i.link_type_id = p_link AND public.link_type_index_ready(p_link);
  IF store IS NULL THEN RETURN false; END IF;  -- the first build replays it
  IF p_instruction = 'addLink' THEN
    EXECUTE format('INSERT INTO objects.%I (%I, %I) VALUES (%L, %L) ON CONFLICT DO NOTHING',
                   store, lk.source_key_column, lk.target_key_column, p_a, p_b);
  ELSE
    EXECUTE format('DELETE FROM objects.%I WHERE %I::text = %L AND %I::text = %L',
                   store, lk.source_key_column, p_a, lk.target_key_column, p_b);
  END IF;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed THEN
    UPDATE public.link_type_indexes
       SET link_count = link_count + CASE WHEN p_instruction = 'addLink' THEN 1 ELSE -1 END,
           updated_at = clock_timestamp()
     WHERE link_type_id = p_link;
  END IF;
  RETURN changed;
END $fn$;

-- ── the edit arm apply_function_edits hands a link variant to ───────────────

CREATE FUNCTION public.apply_link_edit(
  p_variant text, p_body jsonb, p_allowed text[], p_action uuid, p_application uuid)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  aname text; a_type text; b_type text; a_key text; b_key text;
  lk record; exists_now boolean; changed boolean; s jsonb;
BEGIN
  aname  := p_body ->> 'linkTypeApiNameAtoB';
  a_type := p_body -> 'aSideObject' ->> 'objectType';
  b_type := p_body -> 'bSideObject' ->> 'objectType';
  a_key  := p_body -> 'aSideObject' ->> 'primaryKey';
  b_key  := p_body -> 'bSideObject' ->> 'primaryKey';
  IF aname IS NULL OR a_type IS NULL OR b_type IS NULL OR a_key IS NULL OR b_key IS NULL THEN
    RAISE EXCEPTION 'Actions:MalformedEdit — % names a link and both sides', p_variant;
  END IF;

  -- The guest speaks a directional api name and both side types; storage
  -- speaks the link row. Translate at the boundary (740's rule again).
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
  -- The pair in the link's own orientation, whatever order the guest passed.
  IF lk.source_type_api <> a_type THEN
    s := to_jsonb(a_key); a_key := b_key; b_key := s #>> '{}';
  END IF;

  -- "both the source and target object types should be declared"
  IF NOT (lk.source_type_api = ANY (p_allowed) AND lk.target_type_api = ANY (p_allowed)) THEN
    RAISE EXCEPTION 'Functions:UndeclaredObjectTypeEdited — a % edit declares both % and %',
      lk.api_name, lk.source_type_api, lk.target_type_api;
  END IF;
  -- "allowed to create the link as long as they can load both object1 and
  -- object2" — the endpoints must exist as readable objects.
  SELECT st.properties INTO s FROM public.object_before_state(lk.source_object_type_id, a_key) st;
  IF s IS NULL OR s = '{}'::jsonb THEN
    RAISE EXCEPTION 'Ontology:LinkedObjectNotFound — % has no object "%"', lk.source_type_api, a_key;
  END IF;
  SELECT st.properties INTO s FROM public.object_before_state(lk.target_object_type_id, b_key) st;
  IF s IS NULL OR s = '{}'::jsonb THEN
    RAISE EXCEPTION 'Ontology:LinkedObjectNotFound — % has no object "%"', lk.target_type_api, b_key;
  END IF;

  exists_now := public.link_pair_exists(lk.id, a_key, b_key);
  IF p_variant = 'addLink' AND exists_now THEN
    RAISE EXCEPTION 'Ontology:LinkAlreadyExists — % already links "%" and "%"', lk.api_name, a_key, b_key;
  END IF;

  changed := public.replay_link_edit_to_store(lk.id, p_variant, a_key, b_key);
  -- A deleteLink that removed nothing is a no-op and logs nothing — logging
  -- it would replay-delete a future pair. With no store yet (exists_now is
  -- NULL), the log is the truth and the first build replays it.
  IF p_variant = 'deleteLink' AND exists_now IS NOT NULL AND NOT changed THEN
    RETURN;
  END IF;

  INSERT INTO public.link_edits
    (link_type_id, a_key, b_key, instruction, applied_by_user_id, action_type_id, application_id)
  VALUES (lk.id, a_key, b_key, p_variant, auth.uid(), p_action, p_application);
END $fn$;

REVOKE ALL ON FUNCTION public.link_pair_exists(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_link_edit_to_store(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_link_edit(text, jsonb, text[], uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_pair_exists(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replay_link_edit_to_store(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_link_edit(text, jsonb, text[], uuid, uuid) TO authenticated, service_role;

-- ── the three seams: apply, revert, rebuild ─────────────────────────────────

DO $patch$
DECLARE src text; n int; anchor text; addition text;
BEGIN
  -- apply_function_edits: the refusal becomes the arm.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_function_edits';
  anchor := '    IF variant IN (''addLink'', ''deleteLink'') THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Actions:LinkEditsNotSupported — % edits a many-to-many link, which has no instance store here'', variant' || chr(10) ||
    '        USING HINT = ''A foreign-key link is edited as a property, which arrives as modifyObject.'';' || chr(10) ||
    '    END IF;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_function_edits: refusal anchor found % times', n; END IF;
  src := replace(src, anchor,
    '    -- 753: the store exists now, so the refusal 742 wrote is an arm.' || chr(10) ||
    '    IF variant IN (''addLink'', ''deleteLink'') THEN' || chr(10) ||
    '      PERFORM public.apply_link_edit(variant, body, allowed, p_action_type, p_application);' || chr(10) ||
    '      written := written + 1;' || chr(10) ||
    '      CONTINUE;' || chr(10) ||
    '    END IF;');
  EXECUTE src;

  -- revert_action: the per-pair gate, then the compensating link edits.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'revert_action';
  anchor := '  -- the compensating append, newest edit first so a multi-edit application';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'revert_action: comment anchor found % times', n; END IF;
  addition :=
    '  -- The per-pair gate, mirroring the per-object rule (753, inference:' || chr(10) ||
    '  -- action-reverts bounds scope per object and never says link).' || chr(10) ||
    '  FOR e IN SELECT DISTINCT le.link_type_id AS lt, le.a_key AS ak, le.b_key AS bk' || chr(10) ||
    '             FROM public.link_edits le WHERE le.application_id = p_application' || chr(10) ||
    '  LOOP' || chr(10) ||
    '    SELECT max(le.seq) INTO v_latest FROM public.link_edits le' || chr(10) ||
    '     WHERE le.link_type_id = e.lt AND le.a_key = e.ak AND le.b_key = e.bk;' || chr(10) ||
    '    SELECT max(le.seq) INTO v_mine FROM public.link_edits le' || chr(10) ||
    '     WHERE le.application_id = p_application' || chr(10) ||
    '       AND le.link_type_id = e.lt AND le.a_key = e.ak AND le.b_key = e.bk;' || chr(10) ||
    '    IF v_latest > v_mine THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Actions:LinkEditedSince — the link between "%" and "%" has been edited since, so this action is no longer its most recent edit'', e.ak, e.bk;' || chr(10) ||
    '    END IF;' || chr(10) ||
    '  END LOOP;' || chr(10) || chr(10);
  src := replace(src, anchor, addition || anchor);

  anchor := '  PERFORM set_config(''beacon.applying_action'', '''', true);';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'revert_action: window anchor found % times', n; END IF;
  addition :=
    '  -- Link edits compensate the only documented way: "There is no mechanism' || chr(10) ||
    '  -- to directly undo a single user edit or deletion other than to make' || chr(10) ||
    '  -- additional user edits" (753).' || chr(10) ||
    '  FOR e IN SELECT le.* FROM public.link_edits le' || chr(10) ||
    '            WHERE le.application_id = p_application ORDER BY le.seq DESC' || chr(10) ||
    '  LOOP' || chr(10) ||
    '    INSERT INTO public.link_edits' || chr(10) ||
    '      (link_type_id, a_key, b_key, instruction, applied_by_user_id, action_type_id)' || chr(10) ||
    '    VALUES (e.link_type_id, e.a_key, e.b_key,' || chr(10) ||
    '            CASE e.instruction WHEN ''addLink'' THEN ''deleteLink'' ELSE ''addLink'' END,' || chr(10) ||
    '            auth.uid(), v_action);' || chr(10) ||
    '    PERFORM public.replay_link_edit_to_store(e.link_type_id,' || chr(10) ||
    '            CASE e.instruction WHEN ''addLink'' THEN ''deleteLink'' ELSE ''addLink'' END,' || chr(10) ||
    '            e.a_key, e.b_key);' || chr(10) ||
    '    written := written + 1;' || chr(10) ||
    '  END LOOP;' || chr(10) || chr(10);
  src := replace(src, anchor, addition || anchor);
  EXECUTE src;

  -- index_link_type: the history replays over the join dataset.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'index_link_type';
  anchor := '  bad    bigint;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'index_link_type: declare anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) || '  e      record;');

  anchor := '  EXECUTE format(''SELECT count(*) FROM objects.%I'', tbl || ''__next'') INTO n;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'index_link_type: count anchor found % times', n; END IF;
  addition :=
    '  -- "Every time a writeback dataset is built, the history of edits is' || chr(10) ||
    '  -- reapplied to get the final state of edited links" (753). In seq' || chr(10) ||
    '  -- order, so a delete of a dataset pair keeps winning on rebuild.' || chr(10) ||
    '  FOR e IN SELECT le.instruction, le.a_key, le.b_key FROM public.link_edits le' || chr(10) ||
    '            WHERE le.link_type_id = p_link ORDER BY le.seq' || chr(10) ||
    '  LOOP' || chr(10) ||
    '    IF e.instruction = ''addLink'' THEN' || chr(10) ||
    '      EXECUTE format(''INSERT INTO objects.%I (%I, %I) VALUES (%L, %L) ON CONFLICT DO NOTHING'',' || chr(10) ||
    '                     tbl || ''__next'', lk.source_key_column, lk.target_key_column, e.a_key, e.b_key);' || chr(10) ||
    '    ELSE' || chr(10) ||
    '      EXECUTE format(''DELETE FROM objects.%I WHERE %I::text = %L AND %I::text = %L'',' || chr(10) ||
    '                     tbl || ''__next'', lk.source_key_column, e.a_key, lk.target_key_column, e.b_key);' || chr(10) ||
    '    END IF;' || chr(10) ||
    '  END LOOP;' || chr(10) || chr(10);
  src := replace(src, anchor, addition || anchor);
  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — the arms, the immediacy, the replay, the revert ───────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  dsa uuid; dsb uuid; jds uuid; bra uuid; brb uuid; jbr uuid;
  txn uuid; file_id uuid; phys text;
  ta uuid; tb uuid; ln uuid; fkl uuid; fn uuid; ver uuid; act uuid; app uuid;
  b uuid; st text; err text; n bigint; itbl text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m753 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm753-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm753-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M753 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm753p', 'm753 probe') RETURNING id INTO proj;

  -- Two indexed sides, A1..A2 and B1..B2, plus an FK column for the FK arm.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm753a', 'm753a') RETURNING id INTO dsa;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsa, 'master') RETURNING id INTO bra;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsa, bra, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsa, txn, '[{"name":"pk","type":"STRING"},{"name":"b_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsa, txn, 'rows.parquet', 2) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsa, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, b_id) VALUES ($1,''A1'',''B1''), ($1,''A2'',NULL)', phys)
    USING file_id;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm753b', 'm753b') RETURNING id INTO dsb;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsb, 'master') RETURNING id INTO brb;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsb, brb, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsb, txn, '[{"name":"b_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsb, txn, 'rows.parquet', 2) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsb, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, b_id) VALUES ($1,''B1''), ($1,''B2'')', phys)
    USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M753A', 'M753 A', true) RETURNING id INTO ta;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (ta, dsa, bra);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ta, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M753B', 'M753 B', true) RETURNING id INTO tb;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (tb, dsb, brb);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (tb, 'pk', 'Id', 'id', 'string', 'column', 'b_id', true, true, true);
  SELECT public.run_index_build(ARRAY[ta, tb]::uuid[], true) INTO b;
  IF EXISTS (SELECT 1 FROM public.build_jobs bj WHERE bj.build_id = b AND bj.state <> 'COMPLETED') THEN
    RAISE EXCEPTION 'the side indexes did not land';
  END IF;

  -- The join dataset holds one pair; the pair store is built from it.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm753join', 'm753join') RETURNING id INTO jds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (jds, 'master') RETURNING id INTO jbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (jds, jbr, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (jds, txn, '[{"name":"a_key","type":"STRING"},{"name":"b_key","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (jds, txn, 'rows.parquet', 1) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(jds, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, a_key, b_key) VALUES ($1,''A1'',''B1'')', phys)
    USING file_id;
  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, dataset_id, branch_id,
     source_key_column, target_key_column,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm753-pairs', 'M753 pairs', 'many_to_many', 'join_table',
          jds, jbr, 'a_key', 'b_key', 'as', 'As', 'bs', 'Bs')
  RETURNING id INTO ln;
  SELECT public.run_link_index_build(ARRAY[ln]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj
   WHERE bj.build_id = b AND bj.output_link_type_id = ln;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'the pair build did not land: %', coalesce(err, '?'); END IF;
  SELECT i.index_table INTO itbl FROM public.link_type_indexes i WHERE i.link_type_id = ln;

  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, backing_column,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm753-ref', 'M753 ref', 'many_to_one', 'foreign_key', 'b_id',
          'as2', 'As2', 'bs2', 'Bs2')
  RETURNING id INTO fkl;

  -- The function-backed action, 742's chain.
  INSERT INTO public.functions (ontology_id, api_name, display_name)
  VALUES (ont, 'm753EditFn', 'M753 edit fn') RETURNING id INTO fn;
  INSERT INTO public.function_versions
    (function_id, major, minor, patch, source, signature, imports, edits)
  VALUES (fn, 1, 0, 0, 'export default function f(){return []}',
          '{"parameters":[],"returns":"OntologyEdit[]"}'::jsonb,
          '{"object_types":[],"link_types":[]}'::jsonb,
          '{"object_types":["M753A","M753B"]}'::jsonb) RETURNING id INTO ver;
  INSERT INTO public.action_types (ontology_id, api_name, label, allow_revert)
  VALUES (ont, 'm753-run', 'M753 run', true) RETURNING id INTO act;
  INSERT INTO public.action_type_rules
    (action_type_id, kind, position, function_name, function_version_id)
  VALUES (act, 'function', 0, 'm753EditFn', ver);

  -- addLink lands: logged, and in the store immediately.
  app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;
  PERFORM public.apply_function_edits(act, jsonb_build_array(
    jsonb_build_object('addLink', jsonb_build_object(
      'linkTypeApiNameAtoB', 'm753-pairs',
      'aSideObject', jsonb_build_object('objectType', 'M753A', 'primaryKey', 'A2'),
      'bSideObject', jsonb_build_object('objectType', 'M753B', 'primaryKey', 'B2')))), app);
  EXECUTE format('SELECT count(*) FROM objects.%I WHERE a_key = ''A2'' AND b_key = ''B2''', itbl) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the added link is not visible immediately'; END IF;
  SELECT count(*) INTO n FROM public.link_edits
   WHERE link_type_id = ln AND instruction = 'addLink' AND application_id = app;
  IF n <> 1 THEN RAISE EXCEPTION 'the add was not logged'; END IF;

  -- The refusals, each by its documented name.
  app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;
  BEGIN
    PERFORM public.apply_function_edits(act, jsonb_build_array(
      jsonb_build_object('addLink', jsonb_build_object(
        'linkTypeApiNameAtoB', 'm753-pairs',
        'aSideObject', jsonb_build_object('objectType', 'M753A', 'primaryKey', 'A2'),
        'bSideObject', jsonb_build_object('objectType', 'M753B', 'primaryKey', 'B2')))), app);
    RAISE EXCEPTION 'a duplicate link was created';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%LinkAlreadyExists%' THEN RAISE; END IF;
  END;
  app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;
  BEGIN
    PERFORM public.apply_function_edits(act, jsonb_build_array(
      jsonb_build_object('addLink', jsonb_build_object(
        'linkTypeApiNameAtoB', 'm753-ref',
        'aSideObject', jsonb_build_object('objectType', 'M753A', 'primaryKey', 'A1'),
        'bSideObject', jsonb_build_object('objectType', 'M753B', 'primaryKey', 'B1')))), app);
    RAISE EXCEPTION 'an FK link took a link edit';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%LinkEditsNotSupported%' THEN RAISE; END IF;
  END;
  app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;
  BEGIN
    PERFORM public.apply_function_edits(act, jsonb_build_array(
      jsonb_build_object('addLink', jsonb_build_object(
        'linkTypeApiNameAtoB', 'm753-pairs',
        'aSideObject', jsonb_build_object('objectType', 'M753A', 'primaryKey', 'A9'),
        'bSideObject', jsonb_build_object('objectType', 'M753B', 'primaryKey', 'B1')))), app);
    RAISE EXCEPTION 'a link to a missing object was created';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%LinkedObjectNotFound%' THEN RAISE; END IF;
  END;

  -- deleteLink of a dataset-backed pair: gone now, and the rebuild keeps it
  -- gone — the history is reapplied over the join dataset.
  app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;
  PERFORM public.apply_function_edits(act, jsonb_build_array(
    jsonb_build_object('deleteLink', jsonb_build_object(
      'linkTypeApiNameAtoB', 'm753-pairs',
      'aSideObject', jsonb_build_object('objectType', 'M753A', 'primaryKey', 'A1'),
      'bSideObject', jsonb_build_object('objectType', 'M753B', 'primaryKey', 'B1')))), app);
  EXECUTE format('SELECT count(*) FROM objects.%I WHERE a_key = ''A1''', itbl) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'the deleted link is still visible'; END IF;
  SELECT public.run_link_index_build(ARRAY[ln]::uuid[], true) INTO b;
  EXECUTE format('SELECT count(*) FROM objects.%I', itbl) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the rebuild should hold only the edit-added pair, got %', n; END IF;
  EXECUTE format('SELECT count(*) FROM objects.%I WHERE a_key = ''A2''', itbl) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the edit-added pair did not survive the rebuild'; END IF;

  -- The revert: the deleted pair comes back, through a compensating edit.
  PERFORM public.revert_action(app);
  EXECUTE format('SELECT count(*) FROM objects.%I WHERE a_key = ''A1'' AND b_key = ''B1''', itbl) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the revert did not restore the link'; END IF;

  -- A later edit on the same pair blocks the revert of an earlier one.
  app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;
  PERFORM public.apply_function_edits(act, jsonb_build_array(
    jsonb_build_object('deleteLink', jsonb_build_object(
      'linkTypeApiNameAtoB', 'm753-pairs',
      'aSideObject', jsonb_build_object('objectType', 'M753A', 'primaryKey', 'A2'),
      'bSideObject', jsonb_build_object('objectType', 'M753B', 'primaryKey', 'B2')))), app);
  b := app;   -- the application whose revert must now be blocked
  app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;
  PERFORM public.apply_function_edits(act, jsonb_build_array(
    jsonb_build_object('addLink', jsonb_build_object(
      'linkTypeApiNameAtoB', 'm753-pairs',
      'aSideObject', jsonb_build_object('objectType', 'M753A', 'primaryKey', 'A2'),
      'bSideObject', jsonb_build_object('objectType', 'M753B', 'primaryKey', 'B2')))), app);
  BEGIN
    PERFORM public.revert_action(b);
    RAISE EXCEPTION 'a revert past a later link edit was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%LinkEditedSince%' THEN RAISE; END IF;
  END;

  DELETE FROM public.link_edits WHERE link_type_id = ln;
  DELETE FROM public.link_types WHERE id IN (ln, fkl);
  DELETE FROM public.action_types WHERE id = act;
  DELETE FROM public.functions WHERE id = fn;
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
