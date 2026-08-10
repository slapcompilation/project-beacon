-- 410 — one query for every violation
--
-- Two things, and the second is the point.
--
-- First, a constraint the client was carrying alone. `create-object-type.md`:
-- an object type's API name must "Begin with an uppercase character… written in
-- PascalCase… unique across all object types… between 1 and 100 characters."
-- The uniqueness was there; the spelling was only in TypeScript, so anything
-- writing SQL could put a lower_snake_case name in.
--
-- Second, `ontology_violations()`. `superrepo/core-concepts.md` names the
-- pattern: "Ontology linting is a second established pattern: Ontology owners
-- who need to enforce style and design-pattern guidelines write linters that
-- check the entity definitions." Ours checks the definitions in the database
-- instead of in a repo, because that is where our entities live.
--
-- What belongs here and what does not: a constraint holds a rule about one row,
-- and everything expressible that way is already one — 408's CHECKs, the two
-- partial unique indexes, `object_type_datasources`' UNIQUE (dataset, branch),
-- which is "a single datasource can only be used to back one object type". What
-- is left is the rules that read two tables at once, and the one that matters
-- most is this: **a property names a column, and nothing until now checked that
-- the column exists.**

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.object_types'::regclass
                    AND conname  = 'object_types_api_name_check') THEN
    ALTER TABLE public.object_types
      ADD CONSTRAINT object_types_api_name_check
      CHECK (api_name ~ '^[A-Z][A-Za-z0-9]*$' AND length(api_name) BETWEEN 1 AND 100);
  END IF;
END $$;

-- A schema belongs to a transaction, so it is found the way a view is: down the
-- branch's commit chain. `dataset_current_schema` ordered by `created_at`, which
-- is the transaction clock — two schemas attached in one transaction carry the
-- same timestamp and the tie broke arbitrarily. That is how this assertion found
-- it: a dataset that gained a STRUCT column reported the older schema.
--
-- 394 already settled the shape for views: "a view is anchored to a transaction."
-- The same walk answers the schema, and it answers it per branch, which is what
-- a datasource names.

CREATE OR REPLACE FUNCTION public.dataset_branch_schema(p_branch uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH RECURSIVE chain AS (
    SELECT tx.id, tx.parent_transaction_id
      FROM public.dataset_branches b
      JOIN public.dataset_transactions tx ON tx.id = b.head_transaction_id
     WHERE b.id = p_branch
    UNION ALL
    SELECT tx.id, tx.parent_transaction_id
      FROM chain c JOIN public.dataset_transactions tx ON tx.id = c.parent_transaction_id
  )
  SELECT s.fields FROM chain c
    JOIN public.dataset_schemas s ON s.transaction_id = c.id
   LIMIT 1
$$;

COMMENT ON FUNCTION public.dataset_branch_schema(uuid) IS
  'The schema in force on a branch: the nearest one down the commit chain from its head. Per branch, because a datasource is a dataset ON A BRANCH.';

REVOKE ALL ON FUNCTION public.dataset_branch_schema(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dataset_branch_schema(uuid) TO authenticated;

-- The binding guard asked the dataset when it had the branch in hand.
CREATE OR REPLACE FUNCTION public.guard_object_type_datasource()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  n int; holder uuid; bad text; ds_org uuid; ot_org uuid;
BEGIN
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
    FROM jsonb_array_elements(coalesce(public.dataset_branch_schema(NEW.branch_id), '[]'::jsonb)) f
   WHERE f ->> 'type' IN ('MAP', 'STRUCT');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Ontology:UnsupportedColumnType — a backing datasource may not contain MAP or STRUCT columns (%)', bad
      USING HINT = 'Those two field types are the ones that cannot be property base types.';
  END IF;

  RETURN NEW;
END $$;

-- Its ordering is the bug above and nothing calls it any more.
DROP FUNCTION IF EXISTS public.dataset_current_schema(uuid);

CREATE OR REPLACE FUNCTION public.ontology_violations()
RETURNS TABLE (object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $$
  -- The completeness contract, per type. One rule, one place: this is the same
  -- function the `❗4 errors` badge counts.
  SELECT t.api_name, p.scope, p.subject, p.problem
    FROM public.object_types t
   CROSS JOIN LATERAL public.object_type_problems(t.id) p

  UNION ALL

  -- "The property ID, display name, and base type will be inferred from the
  -- name of the column." A property that names a column its datasource does not
  -- have is the case that inference cannot produce and an edit can.
  SELECT t.api_name, 'property', pr.property_id,
         format('Backing column "%s" is not in the schema of dataset "%s"',
                pr.backing_column, d.name)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.object_type_datasources ds ON ds.id = pr.datasource_id
    JOIN public.datasets d ON d.id = ds.dataset_id
   WHERE pr.source = 'column'
     AND public.dataset_branch_schema(ds.branch_id) IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(public.dataset_branch_schema(ds.branch_id)) f
        WHERE f ->> 'name' = pr.backing_column)

  UNION ALL

  -- "a specific property of an object type must come from one—and only one—of
  -- the input datasources (except for the primary key property, which must
  -- exist in every input datasource)". So the key is checked against all of
  -- them, which is why it is the one property allowed to name none.
  SELECT t.api_name, 'property', pr.property_id,
         format('The primary key must exist in every input datasource; dataset "%s" has no column "%s"',
                d.name, pr.backing_column)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.object_type_datasources ds ON ds.object_type_id = pr.object_type_id
    JOIN public.datasets d ON d.id = ds.dataset_id
   WHERE pr.is_primary_key AND pr.source = 'column'
     AND public.dataset_branch_schema(ds.branch_id) IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(public.dataset_branch_schema(ds.branch_id)) f
        WHERE f ->> 'name' = pr.backing_column)

  UNION ALL

  -- "A backing datasource for an object type may not contain MapType or
  -- StructType columns." `guard_object_type_datasource` refuses the binding, so
  -- this catches only what a trigger cannot: a dataset that gains one after it
  -- was bound. Same rule, the half that arrives later.
  SELECT t.api_name, 'datasource', d.name,
         format('Column "%s" is a %s, which a backing datasource may not contain',
                f ->> 'name', f ->> 'type')
    FROM public.object_type_datasources ds
    JOIN public.object_types t ON t.id = ds.object_type_id
    JOIN public.datasets d ON d.id = ds.dataset_id
   CROSS JOIN LATERAL jsonb_array_elements(
     coalesce(public.dataset_branch_schema(ds.branch_id), '[]'::jsonb)) f
   WHERE f ->> 'type' IN ('MAP', 'STRUCT')

  UNION ALL

  -- "the property ID and API name of the object-specific property will remain
  -- unchanged", but the metadata is the definition's. A base type that has
  -- drifted from the shared definition means two answers to one question.
  SELECT t.api_name, 'property', pr.property_id,
         format('Inherits from "%s", which is %s, but this property is %s',
                sp.api_name, sp.base_type, pr.base_type)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.shared_properties sp ON sp.id = pr.shared_property_id
   WHERE sp.base_type <> pr.base_type
$$;

COMMENT ON FUNCTION public.ontology_violations() IS
  'Every well-formedness violation in the ontology, as rows. The linting half of what check:datasets was doing by assertion — see superrepo/core-concepts "Ontology linting".';

REVOKE ALL ON FUNCTION public.ontology_violations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ontology_violations() TO authenticated;

-- ── assertions ───────────────────────────────────────────────────────────────
-- Fixture as the owner, assertions as `authenticated`.

DO $$
DECLARE
  org uuid; proj uuid; ds uuid; br uuid; txn uuid; bind uuid;
  other_ds uuid; other_br uuid; other_txn uuid; other_bind uuid;
  t uuid; usr uuid := gen_random_uuid(); claims text; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '410@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m410') RETURNING id INTO org;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm410', 'm410') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'flights', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status, committed_at)
       VALUES (ds, br, 'SNAPSHOT', 'COMMITTED', now()) RETURNING id INTO txn;
  UPDATE public.dataset_branches SET head_transaction_id = txn WHERE id = br;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"flight_id","type":"STRING"},{"name":"callsign","type":"STRING"}]'::jsonb);

  -- PascalCase, now a constraint rather than a client-side rule.
  BEGIN
    INSERT INTO public.object_types (organization_id, api_name, label)
    VALUES (org, 'flight_leg', 'Flight leg');
    RAISE EXCEPTION 'Migration 410: a lower_snake_case object type API name was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.object_types (organization_id, api_name, label)
       VALUES (org, 'Flight', 'Flight') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (t, ds, br) RETURNING id INTO bind;

  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, backing_column,
     required, is_primary_key)
  VALUES (t, 'flight_id', 'Flight ID', 'flightId', 'string', 'flight_id', true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, backing_column,
     datasource_id, is_title_key)
  VALUES (t, 'callsign', 'Callsign', 'callsign', 'string', 'callsign', bind, true);

  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO n FROM public.ontology_violations() WHERE object_type = 'Flight';
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 410: a well-formed object type reported % violation(s)', n;
  END IF;

  PERFORM set_config('role', 'none', true);

  -- A column that is not in the schema. This is the class nothing caught before:
  -- every constraint on the row passes, and the property is still broken.
  UPDATE public.object_type_properties SET backing_column = 'call_sign'
   WHERE object_type_id = t AND property_id = 'callsign';

  PERFORM set_config('role', 'authenticated', true);
  IF NOT EXISTS (SELECT 1 FROM public.ontology_violations()
                  WHERE subject = 'callsign' AND problem LIKE 'Backing column%') THEN
    RAISE EXCEPTION 'Migration 410: a property naming a column that does not exist went unreported';
  END IF;
  PERFORM set_config('role', 'none', true);

  UPDATE public.object_type_properties SET backing_column = 'callsign'
   WHERE object_type_id = t AND property_id = 'callsign';

  -- A second datasource without the primary key's column. The key names no
  -- datasource of its own precisely because it is checked against all of them.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'legs', 'legs') RETURNING id INTO other_ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (other_ds, 'master') RETURNING id INTO other_br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status, committed_at)
       VALUES (other_ds, other_br, 'SNAPSHOT', 'COMMITTED', now()) RETURNING id INTO other_txn;
  UPDATE public.dataset_branches SET head_transaction_id = other_txn WHERE id = other_br;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (other_ds, other_txn,
    '[{"name":"leg_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (t, other_ds, other_br) RETURNING id INTO other_bind;

  -- The binding was legal. A later transaction adds the column the rule forbids,
  -- which is the drift no trigger on the binding can see. Both schemas carry the
  -- same `created_at` — one statement, one transaction clock — so this only
  -- resolves correctly by walking the commit chain.
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status, committed_at, parent_transaction_id)
       VALUES (other_ds, other_br, 'SNAPSHOT', 'COMMITTED', now(), other_txn) RETURNING id INTO other_txn;
  UPDATE public.dataset_branches SET head_transaction_id = other_txn WHERE id = other_br;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (other_ds, other_txn,
    '[{"name":"leg_id","type":"STRING"},{"name":"detail","type":"STRUCT","subSchemas":[{"name":"a","type":"STRING"}]}]'::jsonb);

  PERFORM set_config('role', 'authenticated', true);
  IF NOT EXISTS (SELECT 1 FROM public.ontology_violations()
                  WHERE subject = 'flight_id' AND problem LIKE 'The primary key must exist%') THEN
    RAISE EXCEPTION 'Migration 410: a primary key missing from an input datasource went unreported';
  END IF;
  -- "may not contain MapType or StructType columns"
  IF NOT EXISTS (SELECT 1 FROM public.ontology_violations()
                  WHERE scope = 'datasource' AND problem LIKE '%STRUCT%') THEN
    RAISE EXCEPTION 'Migration 410: a STRUCT column in a backing datasource went unreported';
  END IF;
  PERFORM set_config('role', 'none', true);

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.object_type_properties WHERE object_type_id = t;
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  UPDATE public.dataset_branches SET head_transaction_id = NULL WHERE dataset_id IN (ds, other_ds);
  DELETE FROM public.dataset_schemas WHERE dataset_id IN (ds, other_ds);
  DELETE FROM public.dataset_transactions WHERE dataset_id IN (ds, other_ds);
  DELETE FROM public.dataset_branches WHERE dataset_id IN (ds, other_ds);
  DELETE FROM public.datasets WHERE id IN (ds, other_ds);
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
