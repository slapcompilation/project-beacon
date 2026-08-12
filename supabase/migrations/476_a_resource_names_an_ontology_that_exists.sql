-- Two defects, one discovery. A leaked test row — an object type whose
-- ontology_id pointed at nothing — sat in production and poisoned an
-- unrelated reindex. Both halves of that sentence are bugs:
--
-- 1. It could EXIST: migration 413 gave the five resource kinds an
--    ontology_id column ("every write names its ontology") but never chained
--    the foreign key. object_sets, type_groups, ontology_branches and the
--    working state all have theirs; the five resources do not. An orphan is
--    representable, so one happened.
--
-- 2. It could POISON: index_object_type's well-formedness gate joined
--    ontology_violations() back to the indexed type BY API NAME. Two types
--    named Airline in different ontologies, one incomplete — and the complete
--    one refuses to index with the other's errors. The gate now asks
--    object_type_problems(p_object_type), which is scoped by ID, which is what
--    442 meant all along.
--
-- The patch follows the 454 discipline: read the live definition, assert the
-- needle appears exactly once, replace, execute. A needle that has drifted
-- fails loudly instead of patching the wrong text.

-- ── the five missing foreign keys ──────────────────────────────────────────
-- RESTRICT, not CASCADE: an ontology that still holds resources is not
-- deletable by accident. (The one orphan this migration exists because of was
-- deleted by hand after verification, 2026-08-12.)

DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['object_types','link_types','action_types',
                           'ontology_interfaces','shared_properties'] LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I r WHERE NOT EXISTS
         (SELECT 1 FROM public.ontologies o WHERE o.id = r.ontology_id)', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Migration 476: % rows of % name an ontology that does not exist — clean before constraining', n, t;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.object_types
  ADD CONSTRAINT object_types_ontology_id_fkey
  FOREIGN KEY (ontology_id) REFERENCES public.ontologies(id) ON DELETE RESTRICT;
ALTER TABLE public.link_types
  ADD CONSTRAINT link_types_ontology_id_fkey
  FOREIGN KEY (ontology_id) REFERENCES public.ontologies(id) ON DELETE RESTRICT;
ALTER TABLE public.action_types
  ADD CONSTRAINT action_types_ontology_id_fkey
  FOREIGN KEY (ontology_id) REFERENCES public.ontologies(id) ON DELETE RESTRICT;
ALTER TABLE public.ontology_interfaces
  ADD CONSTRAINT ontology_interfaces_ontology_id_fkey
  FOREIGN KEY (ontology_id) REFERENCES public.ontologies(id) ON DELETE RESTRICT;
ALTER TABLE public.shared_properties
  ADD CONSTRAINT shared_properties_ontology_id_fkey
  FOREIGN KEY (ontology_id) REFERENCES public.ontologies(id) ON DELETE RESTRICT;

-- 464's rule holds for the new FKs: every foreign key has an index. All five
-- columns already carry one (idx_*_ontology or equivalent) — verified below.
DO $$
DECLARE t text; ok boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['object_types','link_types','action_types',
                           'ontology_interfaces','shared_properties'] LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
      WHERE i.indrelid = ('public.' || t)::regclass AND a.attname = 'ontology_id') INTO ok;
    IF NOT ok THEN
      EXECUTE format('CREATE INDEX %I ON public.%I (ontology_id)', 'idx_' || t || '_ontology_fk', t);
    END IF;
  END LOOP;
END $$;

-- ── the gate asks about the type it is indexing ────────────────────────────

DO $$
DECLARE
  def text;
  needle1 text := 'FROM public.ontology_violations() v';
  needle2 text := 'JOIN public.object_types t ON t.api_name = v.object_type';
  needle3 text := 'WHERE t.id = p_object_type;';
BEGIN
  SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'index_object_type' AND pronamespace = 'public'::regnamespace;

  IF (length(def) - length(replace(def, needle1, ''))) / length(needle1) <> 1 THEN
    RAISE EXCEPTION 'Migration 476: expected exactly one violations-gate FROM in index_object_type';
  END IF;
  IF (length(def) - length(replace(def, needle2, ''))) / length(needle2) <> 1 THEN
    RAISE EXCEPTION 'Migration 476: expected exactly one api-name JOIN in index_object_type';
  END IF;
  IF (length(def) - length(replace(def, needle3, ''))) / length(needle3) <> 1 THEN
    RAISE EXCEPTION 'Migration 476: expected exactly one gate WHERE in index_object_type';
  END IF;

  def := replace(def, needle1, 'FROM public.object_type_problems(p_object_type) v');
  def := replace(def, needle2, '');
  def := replace(def, needle3, ';');
  EXECUTE def;
END $$;

-- ── assertions ─────────────────────────────────────────────────────────────
-- Two ontologies, one shared name. The incomplete namesake must not poison
-- the complete one's index; the dangling ontology reference must not insert.
DO $$
DECLARE
  org uuid; sp uuid; ont1 uuid; ont2 uuid; proj uuid;
  ds uuid; br uuid; txn uuid; fid uuid; ptbl text;
  t1 uuid; usr uuid := gen_random_uuid(); before text; x public.object_type_indexes;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('fk-476') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws476@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws476@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  -- A space holds one ontology (412), so the namesakes need one space each.
  sp := public.create_space('WS476A');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'ws476a', 'WS 476 A', false) RETURNING id INTO ont1;
  sp := public.create_space('WS476B');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'ws476b', 'WS 476 B', false) RETURNING id INTO ont2;

  -- The incomplete namesake, in the second ontology: a bare type, four errors.
  -- Resource rows insert elevated: this fixture proves the gate and the FK,
  -- not the authoring write path, which the stagers own.
  RESET ROLE;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont2, 'Twin', 'Twin');
  SET LOCAL ROLE authenticated;

  -- The complete one, in the first: datasource, rows, keys, index.
  INSERT INTO public.projects (organization_id, api_name, name)
  VALUES (org, 'ws476', 'WS476') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'twin476', 'twin') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"k","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'twin.parquet', 1) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format('INSERT INTO datasets.%I (_file, k) VALUES ($1, ''one'')', ptbl) USING fid;

  RESET ROLE;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont1, 'Twin', 'Twin') RETURNING id INTO t1;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (t1, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, required, is_primary_key, is_title_key)
  VALUES (t1, 'k', 'K', 'k', 'string', 'k', true, true, true);
  SET LOCAL ROLE authenticated;

  -- 1. The complete Twin indexes; before this migration it refused with its
  --    namesake's four errors.
  x := public.index_object_type(t1);
  IF x.status <> 'success' OR x.object_count <> 1 THEN
    RAISE EXCEPTION 'the namesake poisoned the index: %/% (%)', x.status, x.object_count, x.error;
  END IF;

  -- 2. A resource cannot name an ontology that does not exist.
  RESET ROLE;
  BEGIN
    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (gen_random_uuid(), 'Dangling', 'Dangling');
    RAISE EXCEPTION 'a dangling ontology reference was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  SET LOCAL ROLE authenticated;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '476: five FKs chained, and the index gate is scoped by id';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
