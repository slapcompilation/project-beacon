-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 392 — the dataset layer.
--
-- `data-integration/datasets`: "Fundamentally, a dataset is a wrapper around a
-- collection of files which are stored in a backing file system." The wrapper
-- exists for four named reasons — "permission management, schema management,
-- version control, and updates over time" — and this migration builds the
-- wrapper. The files come next.
--
-- The mapping to Postgres is not an approximation. Foundry's own sentence:
-- "The files tracked within a dataset are NOT stored in Foundry itself. Instead,
-- a mapping is maintained between a file's logical path in Foundry and its
-- physical path in a backing file system." A dataset is already a logical
-- resource pointing at storage that is not the platform. Ours points at a table
-- in the `datasets` schema; theirs points at S3.
--
-- The two layers get two schemas, which is the OSv2 architecture diagram
-- literally — a Dataset Layer box and an Object Layer box:
--
--     public.     the Object Layer — object types, and this registry
--     datasets.   the Dataset Layer — one real table per dataset
--
-- TRANSACTIONS. Four types and three states, quoted:
--   SNAPSHOT  "replaces the current view of the dataset with a completely new
--             set of files"
--   APPEND    "adds new files… cannot modify existing files in the current
--             dataset view"
--   UPDATE    "adds new files to a dataset view, but may also overwrite the
--             contents of existing files"
--   DELETE    "removes files that are in the current dataset view" — and
--             "committing a DELETE transaction does NOT delete the underlying
--             file… it simply removes the file reference from the dataset view"
--
-- That last clause is why nothing here destroys anything. Destruction is a
-- separate service (Retention, Data Lifetime) under a separate role, and we have
-- neither. A DELETE transaction writes a tombstone.
--
-- BRANCHES. `data-integration/branching`: "dataset branches are simply a pointer
-- to the most recent transaction on that branch… a branch can be interpreted as
-- a linear sequence of transactions ordered by commit time. Unlike Git, there is
-- no support for merging dataset branches." So a branch is a head pointer and a
-- parent, and there is no merge to model.
--
-- SCHEMAS. "A schema is metadata on a *dataset view*" — not on the dataset. It
-- is therefore keyed by the transaction that opens the view, and it changes over
-- time by design.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE SCHEMA IF NOT EXISTS datasets;
COMMENT ON SCHEMA datasets IS
  'The Dataset Layer: one real table per dataset, with real columns. The registry that describes them is public.datasets.';

-- RLS is auto-enabled by event trigger for `public` only. A generated table
-- landing in `datasets` without RLS would be an org-wide read of everything.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger LANGUAGE plpgsql AS $$
DECLARE cmd record;
BEGIN
  FOR cmd IN
    SELECT * FROM pg_event_trigger_ddl_commands()
     WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
       AND object_type IN ('table','partitioned table')
  LOOP
    IF cmd.schema_name IN ('public','datasets') THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    ELSE
      RAISE LOG 'rls_auto_enable: skip % (schema %)', cmd.object_identity, cmd.schema_name;
    END IF;
  END LOOP;
END $$;

-- ── the field type vocabulary ────────────────────────────────────────────────
-- The fifteen from `data-integration/datasets#supported-field-types`, and the
-- four that "require additional parameters". Every value traces to that page.

CREATE OR REPLACE FUNCTION public.dataset_field_valid(f jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t text; sub jsonb;
BEGIN
  IF jsonb_typeof(f) <> 'object' THEN RETURN false; END IF;
  t := f ->> 'type';
  IF t IS NULL THEN RETURN false; END IF;

  IF t NOT IN ('BOOLEAN','BYTE','SHORT','INTEGER','LONG','FLOAT','DOUBLE',
               'DECIMAL','STRING','MAP','ARRAY','STRUCT','BINARY','DATE','TIMESTAMP')
  THEN RETURN false; END IF;

  -- "DECIMAL requires precision and scale." Both keys are tested for presence
  -- first: jsonb_typeof of a missing key is NULL, and a NULL here would ride
  -- through `NOT valid` as neither true nor false and pass silently.
  IF t = 'DECIMAL' THEN
    IF NOT (f ? 'precision' AND f ? 'scale') THEN RETURN false; END IF;
    RETURN jsonb_typeof(f -> 'precision') = 'number'
       AND jsonb_typeof(f -> 'scale')     = 'number'
       AND (f ->> 'precision')::int BETWEEN 1 AND 38
       AND (f ->> 'scale')::int BETWEEN 0 AND (f ->> 'precision')::int;
  END IF;

  -- "ARRAY requires arraySubType, a field type."
  IF t = 'ARRAY' THEN
    RETURN f ? 'arraySubType' AND public.dataset_field_valid(f -> 'arraySubType');
  END IF;

  -- "MAP requires mapKeyType and mapValueType, which are both field types."
  IF t = 'MAP' THEN
    RETURN f ? 'mapKeyType' AND f ? 'mapValueType'
       AND public.dataset_field_valid(f -> 'mapKeyType')
       AND public.dataset_field_valid(f -> 'mapValueType');
  END IF;

  -- "STRUCT requires subSchemas, a list of field types."
  IF t = 'STRUCT' THEN
    IF jsonb_typeof(f -> 'subSchemas') <> 'array'
       OR jsonb_array_length(f -> 'subSchemas') = 0 THEN RETURN false; END IF;
    FOR sub IN SELECT * FROM jsonb_array_elements(f -> 'subSchemas') LOOP
      IF sub ->> 'name' IS NULL OR NOT public.dataset_field_valid(sub) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;

  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.dataset_schema_valid(fields jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE f jsonb; seen text[] := '{}';
BEGIN
  IF jsonb_typeof(fields) <> 'array' THEN RETURN false; END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(fields) LOOP
    IF f ->> 'name' !~ '^[a-z][a-z0-9_]*$' THEN RETURN false; END IF;
    IF (f ->> 'name') = ANY (seen) THEN RETURN false; END IF;
    seen := seen || (f ->> 'name');
    -- IS NOT TRUE, not NOT: a NULL from a malformed field must fail closed.
    IF public.dataset_field_valid(f) IS NOT TRUE THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

COMMENT ON FUNCTION public.dataset_schema_valid(jsonb) IS
  'A tabular dataset schema: an array of uniquely-named fields whose types are the fifteen from data-integration/datasets, with the four parameterised ones carrying their parameters.';

-- ── the registry ─────────────────────────────────────────────────────────────

CREATE TABLE public.datasets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('foundry', 'dataset', id)) STORED,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Location is one of the two ways Foundry identifies a dataset, and object
  -- permissions derive from it: "As permissions of the objects of a type are
  -- determined by the location of their backing datasources…" A dataset with
  -- nowhere to live is a permission hole, so this is NOT NULL.
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  api_name        text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  description     text NOT NULL DEFAULT '',
  -- The physical half of the wrapper: a real table in the `datasets` schema.
  -- NULL until the dataset has a schema — Foundry has schema-less datasets too.
  physical_table  text UNIQUE CHECK (physical_table ~ '^[a-z][a-z0-9_]*$'),
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

COMMENT ON TABLE public.datasets IS
  'The dataset wrapper: identity, location, and the physical table it maps to. "a dataset is a wrapper around a collection of files which are stored in a backing file system" — ours is a table in the datasets schema.';
COMMENT ON COLUMN public.datasets.physical_table IS
  'Table name in the `datasets` schema. NULL for a schema-less dataset, which Foundry also allows.';

CREATE TABLE public.dataset_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid         text GENERATED ALWAYS AS (public.rid_of('foundry', 'transaction', id)) STORED,
  dataset_id  uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL,
  txn_type    text NOT NULL CHECK (txn_type IN ('SNAPSHOT','APPEND','UPDATE','DELETE')),
  status      text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','COMMITTED','ABORTED')),
  -- The previous head of the branch. "a branch can be interpreted as a linear
  -- sequence of transactions ordered by commit time."
  parent_transaction_id uuid REFERENCES public.dataset_transactions(id) ON DELETE RESTRICT,
  started_at   timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  aborted_at   timestamptz,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CHECK (
    (status = 'OPEN'      AND committed_at IS NULL AND aborted_at IS NULL) OR
    (status = 'COMMITTED' AND committed_at IS NOT NULL AND aborted_at IS NULL) OR
    (status = 'ABORTED'   AND aborted_at IS NOT NULL AND committed_at IS NULL)
  ),
  UNIQUE (id, dataset_id)
);

COMMENT ON TABLE public.dataset_transactions IS
  'An atomic change to a dataset. "A transaction is analogous to a commit in Git." Nothing here destroys data — a DELETE transaction removes a file from the view, not from storage.';

CREATE TABLE public.dataset_branches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  -- "Each dataset branch has exactly one parent branch, unless it is a root
  -- branch." NULL = root. The composite FK keeps a parent inside the same dataset.
  parent_branch_id uuid,
  parent_dataset_id uuid,
  -- "dataset branches are simply a pointer to the most recent transaction on
  -- that branch." NULL until the first transaction is started.
  head_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, dataset_id),
  UNIQUE (dataset_id, name),
  CHECK ((parent_branch_id IS NULL) = (parent_dataset_id IS NULL)),
  CHECK (parent_dataset_id IS NULL OR parent_dataset_id = dataset_id),
  FOREIGN KEY (parent_branch_id, parent_dataset_id)
    REFERENCES public.dataset_branches (id, dataset_id) ON DELETE SET NULL,
  FOREIGN KEY (head_transaction_id, dataset_id)
    REFERENCES public.dataset_transactions (id, dataset_id) ON DELETE SET NULL
);

COMMENT ON TABLE public.dataset_branches IS
  'A branch is a head pointer plus a parent. "Unlike Git, there is no support for merging dataset branches" — so there is no merge state to model.';

ALTER TABLE public.dataset_transactions
  ADD CONSTRAINT dataset_transactions_branch_fkey
  FOREIGN KEY (branch_id, dataset_id)
    REFERENCES public.dataset_branches (id, dataset_id) ON DELETE CASCADE;

-- "Every branch can have at most one open transaction, and this transaction is
-- always the latest transaction on the branch."
CREATE UNIQUE INDEX dataset_transactions_one_open_per_branch
  ON public.dataset_transactions (branch_id) WHERE status = 'OPEN';

CREATE INDEX dataset_transactions_branch_idx ON public.dataset_transactions (branch_id, started_at);
CREATE INDEX dataset_branches_dataset_idx    ON public.dataset_branches (dataset_id);

CREATE TABLE public.dataset_schemas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id     uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  -- "A schema is metadata on a *dataset view*." A view begins at a transaction,
  -- so the schema hangs off that transaction and changes when a new view begins.
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.dataset_transactions(id) ON DELETE CASCADE,
  fields         jsonb NOT NULL CHECK (public.dataset_schema_valid(fields)),
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dataset_schemas IS
  'The schema of one dataset view. Deliberately not on the dataset: "Because schemas are stored on a dataset view, schemas can change over time."';

-- ── access ───────────────────────────────────────────────────────────────────
-- Read is org scope; write is admin/owner or project owner, matching projects.
-- The dataset's own project is the grant, per ontology-permissions: "Ontology
-- resources are saved into a project, and the selected project determines who
-- can view, edit, and manage them."

CREATE POLICY "members read datasets" ON public.datasets
  FOR SELECT USING (organization_id IS NOT DISTINCT FROM public.auth_org_id());

CREATE POLICY "editors write datasets" ON public.datasets
  FOR ALL
  USING (organization_id IS NOT DISTINCT FROM public.auth_org_id()
         AND (public.auth_role() IN ('owner','admin')
              OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')))
  WITH CHECK (organization_id IS NOT DISTINCT FROM public.auth_org_id()
         AND (public.auth_role() IN ('owner','admin')
              OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')));

-- The three child tables inherit the dataset's access rather than restating it,
-- so a change to the dataset policy cannot leave them behind.
CREATE OR REPLACE FUNCTION public.can_read_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = p_dataset)
$$;

CREATE OR REPLACE FUNCTION public.can_write_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_dataset
       AND (public.auth_role() IN ('owner','admin')
            OR public.role_rank(public.project_role(d.project_id)) >= public.role_rank('editor'))
  )
$$;

COMMENT ON FUNCTION public.can_read_dataset(uuid) IS
  'True when the caller can see the dataset. SECURITY INVOKER on purpose — the datasets RLS policy does the work, so this cannot drift from it.';

CREATE POLICY "read branches of readable datasets" ON public.dataset_branches
  FOR SELECT USING (public.can_read_dataset(dataset_id));
CREATE POLICY "write branches of writable datasets" ON public.dataset_branches
  FOR ALL USING (public.can_write_dataset(dataset_id))
          WITH CHECK (public.can_write_dataset(dataset_id));

CREATE POLICY "read transactions of readable datasets" ON public.dataset_transactions
  FOR SELECT USING (public.can_read_dataset(dataset_id));
CREATE POLICY "write transactions of writable datasets" ON public.dataset_transactions
  FOR ALL USING (public.can_write_dataset(dataset_id))
          WITH CHECK (public.can_write_dataset(dataset_id));

CREATE POLICY "read schemas of readable datasets" ON public.dataset_schemas
  FOR SELECT USING (public.can_read_dataset(dataset_id));
CREATE POLICY "write schemas of writable datasets" ON public.dataset_schemas
  FOR ALL USING (public.can_write_dataset(dataset_id))
          WITH CHECK (public.can_write_dataset(dataset_id));

GRANT USAGE ON SCHEMA datasets TO authenticated, service_role;

DO $$
DECLARE n int;
BEGIN
  -- Every new table carries RLS and a policy per command it needs.
  FOR n IN
    SELECT 1 FROM unnest(ARRAY['datasets','dataset_branches','dataset_transactions','dataset_schemas']) AS t(name)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname='public' AND c.relname = t.name AND c.relrowsecurity)
  LOOP
    RAISE EXCEPTION 'Migration 392: a new table is missing RLS';
  END LOOP;

  IF NOT public.dataset_schema_valid(
       '[{"name":"iata","type":"STRING"},
         {"name":"fare","type":"DECIMAL","precision":38,"scale":18},
         {"name":"tags","type":"ARRAY","arraySubType":{"type":"STRING"}},
         {"name":"meta","type":"MAP","mapKeyType":{"type":"STRING"},"mapValueType":{"type":"LONG"}},
         {"name":"leg","type":"STRUCT","subSchemas":[{"name":"origin","type":"STRING"}]}]'::jsonb)
  THEN RAISE EXCEPTION 'Migration 392: a valid schema was rejected'; END IF;

  -- The four parameterised types must not pass without their parameters, and an
  -- unknown type must not pass at all. A validator that accepts everything reads
  -- exactly like one that works.
  IF public.dataset_schema_valid('[{"name":"a","type":"DECIMAL"}]'::jsonb)
  OR public.dataset_schema_valid('[{"name":"a","type":"ARRAY"}]'::jsonb)
  OR public.dataset_schema_valid('[{"name":"a","type":"MAP","mapKeyType":{"type":"STRING"}}]'::jsonb)
  OR public.dataset_schema_valid('[{"name":"a","type":"STRUCT","subSchemas":[]}]'::jsonb)
  OR public.dataset_schema_valid('[{"name":"a","type":"VARCHAR"}]'::jsonb)
  OR public.dataset_schema_valid('[{"name":"A","type":"STRING"}]'::jsonb)
  OR public.dataset_schema_valid('[{"name":"a","type":"STRING"},{"name":"a","type":"LONG"}]'::jsonb)
  THEN RAISE EXCEPTION 'Migration 392: an invalid schema was accepted'; END IF;
END $$;

COMMIT;
