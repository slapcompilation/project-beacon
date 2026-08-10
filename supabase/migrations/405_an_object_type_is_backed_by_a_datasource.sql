-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 405 — O1: bind object types to datasources.
--
-- Reading: docs/foundry-reference/readings/create-object-type.md
--
-- "In order to populate property values for objects of this type with data, you
-- must add a **backing datasource**." And the constraint that governs it:
--
--   "Note that a single datasource can only be used to back one object type."
--
-- Until now that was `object_types.source_table` — a text column holding a table
-- name, with no foreign key, no uniqueness, and no relationship to the dataset
-- layer built in 391–395. It is replaced here.
--
-- WHY THE BRANCH IS PART OF THE KEY. The error Foundry raises names both:
--
--   Phonograph2:DatasetAndBranchAlreadyRegistered — "the datasource backing the
--   object type you are trying to save is already backing a different object type
--   in the Ontology and cannot be used again."
--
-- A *datasource* is a dataset **on a branch**, not a dataset. So the uniqueness is
-- on the pair, which is both what the error names and a superset of the prose
-- rule: the same dataset+branch still cannot back two object types.
--
-- THE TWO LIMITS, from different pages:
--   • one object type per datasource (`create-object-type`)
--   • "Object types are limited to a maximum of **70 datasources**"
--     (`object-permissioning/multi-datasource-objects`) — per object type, not
--     per object, and only counting datasources synced to object storage
--
-- AND THE SCHEMA RULE:
--   "A backing datasource for an object type may **not contain `MapType` or
--    `StructType` columns**."
-- Which lines up exactly with `base-types`: "All field types are valid base types
-- except for `Map` and `Binary` types."
--
-- NOT HERE, and each for a reason:
--   • Property-to-column mapping and the MDO rules that go with it (each non-PK
--     property from exactly one datasource, the PK present in every one) need
--     properties to be rows rather than jsonb. That is O2.
--   • Streaming XOR datasets — MDOs are "only Foundry datasets or restricted
--     views… Streaming sources are not supported" — but we have no streaming
--     datasets, so there is nothing to exclude yet.
--
-- WHAT source_table WAS DOING BESIDES NAMING A TABLE. It gated three RLS
-- policies: an object type could only be authored, updated or deleted when
-- `source_table IS NULL`. That encoded a built-in-versus-authored split which the
-- teardown already rejected — "Foundry classifies object types by their datasource
-- and has no notion of a built-in one". Keeping the clause after this migration
-- would invert into something worse: no object type with a datasource could be
-- edited at all.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE public.object_type_datasources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  dataset_id     uuid NOT NULL REFERENCES public.datasets(id) ON DELETE RESTRICT,
  -- The branch half of the datasource. Composite FK keeps it inside its dataset.
  branch_id      uuid NOT NULL,
  added_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at       timestamptz NOT NULL DEFAULT now(),
  -- The rule the error names.
  UNIQUE (dataset_id, branch_id),
  FOREIGN KEY (branch_id, dataset_id)
    REFERENCES public.dataset_branches (id, dataset_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.object_type_datasources IS
  'The backing datasources of an object type. A datasource is a dataset ON A BRANCH, and one may back only one object type — Phonograph2:DatasetAndBranchAlreadyRegistered.';

CREATE INDEX object_type_datasources_type_idx ON public.object_type_datasources (object_type_id);

-- The dataset's current schema: the newest one recorded. Schemas hang off a
-- transaction ("A schema is metadata on a dataset view"), so "current" means the
-- most recently attached rather than a column on the dataset.
CREATE OR REPLACE FUNCTION public.dataset_current_schema(p_dataset uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT s.fields FROM public.dataset_schemas s
   WHERE s.dataset_id = p_dataset
   ORDER BY s.created_at DESC LIMIT 1
$$;

COMMENT ON FUNCTION public.dataset_current_schema(uuid) IS
  'The most recently attached schema for a dataset. NULL for a schema-less dataset, which Foundry also allows.';

CREATE OR REPLACE FUNCTION public.guard_object_type_datasource()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  n int; holder uuid; bad text; ds_org uuid; ot_org uuid;
BEGIN
  -- Same tenant. Neither page states this because Foundry has no cross-tenant
  -- ontology; it is our mandatory control, restated where it could be lost.
  SELECT organization_id INTO ds_org FROM public.datasets     WHERE id = NEW.dataset_id;
  SELECT organization_id INTO ot_org FROM public.object_types WHERE id = NEW.object_type_id;
  IF ds_org IS DISTINCT FROM ot_org THEN
    RAISE EXCEPTION 'Ontology:DatasourceInAnotherOrganization — a datasource must belong to the object type''s organization';
  END IF;

  -- "a single datasource can only be used to back one object type"
  SELECT object_type_id INTO holder FROM public.object_type_datasources
   WHERE dataset_id = NEW.dataset_id AND branch_id = NEW.branch_id
     AND id IS DISTINCT FROM NEW.id;
  IF holder IS NOT NULL THEN
    RAISE EXCEPTION 'Phonograph2:DatasetAndBranchAlreadyRegistered — this datasource is already backing a different object type and cannot be used again'
      USING HINT = 'Pick another dataset, or another branch of this one.';
  END IF;

  -- "Object types are limited to a maximum of 70 datasources."
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = NEW.object_type_id AND id IS DISTINCT FROM NEW.id;
  IF n >= 70 THEN
    RAISE EXCEPTION 'Ontology:TooManyDatasources — an object type is limited to 70 datasources, and this one already has %', n;
  END IF;

  -- "A backing datasource for an object type may not contain MapType or
  --  StructType columns." The same two field types base-types excludes.
  SELECT string_agg(f ->> 'name', ', ') INTO bad
    FROM jsonb_array_elements(coalesce(public.dataset_current_schema(NEW.dataset_id), '[]'::jsonb)) f
   WHERE f ->> 'type' IN ('MAP', 'STRUCT');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Ontology:UnsupportedColumnType — a backing datasource may not contain MAP or STRUCT columns (%)', bad
      USING HINT = 'Those two field types are the ones that cannot be property base types.';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER guard_object_type_datasource
  BEFORE INSERT OR UPDATE ON public.object_type_datasources
  FOR EACH ROW EXECUTE FUNCTION public.guard_object_type_datasource();

-- Reading an object type's datasources follows the object type; changing them
-- follows the dataset, because binding a datasource exposes its data.
CREATE POLICY "read datasources of visible object types" ON public.object_type_datasources
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()));

CREATE POLICY "bind datasources you can write" ON public.object_type_datasources
  FOR ALL USING (public.can_write_dataset(dataset_id))
          WITH CHECK (public.can_write_dataset(dataset_id));

-- ── retiring source_table ────────────────────────────────────────────────────
-- The three policies gate on `source_table IS NULL`. Rewritten without it: an
-- object type is authored by an org admin or by an editor on its project, which
-- is what `ontology-permissions` describes — "the selected project determines who
-- can view, edit, and manage them".

DROP POLICY IF EXISTS "admins author object types" ON public.object_types;
CREATE POLICY "admins author object types" ON public.object_types
  FOR INSERT WITH CHECK (
    public.auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM public.auth_org_id()
    AND created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "admins delete object types" ON public.object_types;
CREATE POLICY "admins delete object types" ON public.object_types
  FOR DELETE USING (
    public.auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM public.auth_org_id());

DROP POLICY IF EXISTS "admins update object types" ON public.object_types;
CREATE POLICY "admins update object types" ON public.object_types
  FOR UPDATE
  USING (organization_id IS NOT DISTINCT FROM public.auth_org_id()
         AND (public.auth_role() IN ('owner','admin')
              OR public.has_resource_role('object_type', id, 'editor')))
  WITH CHECK (organization_id IS NOT DISTINCT FROM public.auth_org_id()
         AND (public.auth_role() IN ('owner','admin')
              OR public.has_resource_role('object_type', id, 'editor')));

DROP FUNCTION IF EXISTS public.derive_object_type_properties(text);
ALTER TABLE public.object_types DROP COLUMN source_table;

DO $$
DECLARE
  org uuid; other uuid; proj uuid; ds uuid; ds2 uuid; br uuid; br2 uuid;
  t1 uuid; t2 uuid; txn uuid; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('m405')   RETURNING id INTO org;
  INSERT INTO public.organizations (name) VALUES ('m405 b') RETURNING id INTO other;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm405', 'm405') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm405_a', 'a') RETURNING id INTO ds;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm405_b', 'b') RETURNING id INTO ds2;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,  'master') RETURNING id INTO br;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;
  INSERT INTO public.object_types (organization_id, api_name, label)
       VALUES (org, 'm405_one', 'One') RETURNING id INTO t1;
  INSERT INTO public.object_types (organization_id, api_name, label)
       VALUES (org, 'm405_two', 'Two') RETURNING id INTO t2;

  -- The happy path.
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (t1, ds, br);

  -- "a single datasource can only be used to back one object type"
  BEGIN
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
         VALUES (t2, ds, br);
    RAISE EXCEPTION 'Migration 405: one datasource backed two object types';
  EXCEPTION WHEN OTHERS THEN
    IF position('DatasetAndBranchAlreadyRegistered' in SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- A different BRANCH of the same dataset is a different datasource, which is
  -- what the error name says. Asserted so a later simplification to
  -- UNIQUE(dataset_id) is a visible change rather than a silent one.
  INSERT INTO public.dataset_branches (dataset_id, name, parent_branch_id, parent_dataset_id)
       VALUES (ds, 'feature', br, ds) RETURNING id INTO br2;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (t2, ds, br2);

  -- An object type may hold several; only the datasource side is exclusive.
  SELECT count(*) INTO n FROM public.object_type_datasources WHERE object_type_id = t2;
  IF n <> 1 THEN RAISE EXCEPTION 'Migration 405: expected one datasource on t2, got %', n; END IF;

  -- Cross-tenant is refused.
  UPDATE public.object_types SET organization_id = other WHERE id = t2;
  BEGIN
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
         VALUES (t2, ds2, (SELECT id FROM public.dataset_branches WHERE dataset_id = ds2 LIMIT 1));
    RAISE EXCEPTION 'Migration 405: a datasource crossed an organization boundary';
  EXCEPTION WHEN OTHERS THEN
    IF position('DatasourceInAnotherOrganization' in SQLERRM) = 0 THEN RAISE; END IF;
  END;
  UPDATE public.object_types SET organization_id = org WHERE id = t2;

  -- "may not contain MapType or StructType columns"
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status, committed_at)
       VALUES (ds2, (SELECT id FROM public.dataset_branches WHERE dataset_id = ds2 LIMIT 1),
               'SNAPSHOT', 'COMMITTED', now()) RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
       VALUES (ds2, txn, '[{"name":"ok","type":"STRING"},
                           {"name":"nope","type":"STRUCT","subSchemas":[{"name":"a","type":"STRING"}]}]'::jsonb);
  BEGIN
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
         VALUES (t2, ds2, (SELECT id FROM public.dataset_branches WHERE dataset_id = ds2 LIMIT 1));
    RAISE EXCEPTION 'Migration 405: a STRUCT column was accepted as a backing datasource';
  EXCEPTION WHEN OTHERS THEN
    IF position('UnsupportedColumnType' in SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- source_table is gone, and nothing still gates a policy on it.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='object_types' AND column_name='source_table') THEN
    RAISE EXCEPTION 'Migration 405: source_table survived';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
              WHERE c.relname='object_types'
                AND (coalesce(pg_get_expr(p.polqual,p.polrelid),'') LIKE '%source_table%'
                  OR coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') LIKE '%source_table%')) THEN
    RAISE EXCEPTION 'Migration 405: a policy still references source_table';
  END IF;
  -- All four commands still covered, which 383 established and 387 asserts.
  SELECT count(DISTINCT polcmd) INTO n FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='object_types';
  IF n < 4 THEN RAISE EXCEPTION 'Migration 405: object_types lost a policy command (% distinct)', n; END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.object_type_datasources WHERE object_type_id IN (t1, t2);
  DELETE FROM public.object_types WHERE id IN (t1, t2);
  DELETE FROM public.dataset_schemas WHERE dataset_id = ds2;
  UPDATE public.dataset_branches SET head_transaction_id = NULL WHERE dataset_id = ds2;
  DELETE FROM public.dataset_transactions WHERE dataset_id = ds2;
  DELETE FROM public.dataset_branches WHERE dataset_id IN (ds, ds2);
  DELETE FROM public.datasets WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.organizations WHERE id IN (org, other);
END $$;

COMMIT;
