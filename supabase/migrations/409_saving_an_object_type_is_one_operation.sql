-- 409 — saving an object type is one operation
--
-- 408 moved properties into their own table, which split what the wizard treats
-- as a single save across two writes. `create-object-type.md` states the save as
-- one gate over both:
--
--   "To save a new object type, these object type fields must not be empty:
--    ID · Display name · Plural display name · Backing datasource · API name
--    And these property fields must not be empty:
--    Property ID · Property display name · Backing column · Property API name ·
--    Title key · Primary key"
--
-- One list, one save. A client that inserts the type and then its properties
-- passes through a state that violates the contract, and if the second call
-- fails it stays there — which is the `❗4 errors` type in
-- `create-object-type-edit-backing-dataset.png`, reached by accident instead of
-- by abandonment.
--
-- Invoker rights, deliberately: the RLS policies on `object_types` and
-- `object_type_properties` decide who may write. A SECURITY DEFINER save would
-- be a way around the policies 408 just wrote.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_object_type(
  p_object_type jsonb,
  p_properties  jsonb
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  t     uuid := nullif(p_object_type->>'id', '')::uuid;
  keys  text[];
BEGIN
  IF t IS NULL THEN
    INSERT INTO public.object_types (api_name, label, icon, description)
    VALUES (p_object_type->>'api_name', p_object_type->>'label',
            coalesce(p_object_type->>'icon', 'cube'),
            coalesce(p_object_type->>'description', ''))
    RETURNING id INTO t;
  ELSE
    UPDATE public.object_types
       SET label       = coalesce(p_object_type->>'label', label),
           icon        = coalesce(p_object_type->>'icon', icon),
           description = coalesce(p_object_type->>'description', description)
     WHERE id = t;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ontology:ObjectTypeNotFound %', t USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  -- Properties absent from the payload are gone. `property_id` is the identity
  -- the wizard edits under, not the row id — renaming a display name keeps the
  -- property, retyping the ID replaces it.
  SELECT array_agg(e->>'property_id') INTO keys FROM jsonb_array_elements(p_properties) e;
  DELETE FROM public.object_type_properties
   WHERE object_type_id = t AND property_id <> ALL (coalesce(keys, '{}'::text[]));

  -- Both designations are unique per type, so a swap has to pass through
  -- nobody-holds-it. Clearing first is what makes moving a key one save.
  UPDATE public.object_type_properties
     SET is_primary_key = false, is_title_key = false
   WHERE object_type_id = t AND (is_primary_key OR is_title_key);

  INSERT INTO public.object_type_properties (
    object_type_id, property_id, display_name, api_name, description, aliases,
    base_type, source, datasource_id, backing_column, shared_property_id,
    required, visibility, position, is_primary_key, is_title_key)
  SELECT
    t,
    e->>'property_id',
    e->>'display_name',
    e->>'api_name',
    coalesce(e->>'description', ''),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(e->'aliases')), '{}'::text[]),
    e->>'base_type',
    coalesce(e->>'source', 'column'),
    nullif(e->>'datasource_id', '')::uuid,
    nullif(e->>'backing_column', ''),
    nullif(e->>'shared_property_id', '')::uuid,
    coalesce((e->>'required')::boolean, false),
    coalesce(e->>'visibility', 'normal'),
    coalesce((e->>'position')::integer, (ord - 1)::integer),
    coalesce((e->>'is_primary_key')::boolean, false),
    coalesce((e->>'is_title_key')::boolean, false)
  FROM jsonb_array_elements(p_properties) WITH ORDINALITY AS a(e, ord)
  ON CONFLICT (object_type_id, property_id) DO UPDATE SET
    display_name       = EXCLUDED.display_name,
    api_name           = EXCLUDED.api_name,
    description        = EXCLUDED.description,
    aliases            = EXCLUDED.aliases,
    base_type          = EXCLUDED.base_type,
    source             = EXCLUDED.source,
    datasource_id      = EXCLUDED.datasource_id,
    backing_column     = EXCLUDED.backing_column,
    shared_property_id = EXCLUDED.shared_property_id,
    required           = EXCLUDED.required,
    visibility         = EXCLUDED.visibility,
    position           = EXCLUDED.position,
    is_primary_key     = EXCLUDED.is_primary_key,
    is_title_key       = EXCLUDED.is_title_key;

  RETURN t;
END $$;

COMMENT ON FUNCTION public.save_object_type(jsonb, jsonb) IS
  'One save for an object type and its properties, because create-object-type states the completeness contract as one list over both. Invoker rights: the RLS policies decide.';

REVOKE ALL ON FUNCTION public.save_object_type(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_object_type(jsonb, jsonb) TO authenticated;

-- ── assertions ───────────────────────────────────────────────────────────────
-- The first version of this block ran as the migration owner and its cross-org
-- case passed the save it was written to refuse: the owner bypasses RLS, so
-- "invoker rights" was the one claim here the assertions could not see. The
-- fixture is built as the owner; every assertion runs as `authenticated`.

DO $$
DECLARE
  org uuid; proj uuid; ds uuid; br uuid; bind uuid; t uuid; before text; n int;
  other uuid; other_t uuid;
  -- A real subject, because "admins author object types" checks
  -- `created_by_user_id = auth.uid()` and the column is a foreign key into
  -- auth.users. Claims alone would insert NULL and be refused.
  usr uuid := gen_random_uuid();
  claims text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '409@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('409 save') RETURNING id INTO org;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'p409', '409') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'aircraft', 'aircraft') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  INSERT INTO public.organizations (name) VALUES ('409 other') RETURNING id INTO other;
  INSERT INTO public.object_types (organization_id, api_name, label)
       VALUES (other, 'Foreign', 'Foreign') RETURNING id INTO other_t;

  -- Both resolvers read `app_metadata`, not the top level of the claim set.
  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);

  -- A type and its properties in one call.
  t := public.save_object_type(
    jsonb_build_object('api_name', 'Aircraft', 'label', 'Aircraft'),
    '[]'::jsonb);
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (t, ds, br) RETURNING id INTO bind;

  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text, 'label', 'Aircraft'),
    jsonb_build_array(
      jsonb_build_object('property_id', 'tail', 'display_name', 'Tail number',
        'api_name', 'tailNumber', 'base_type', 'string', 'backing_column', 'tail',
        'required', true, 'is_primary_key', true, 'is_title_key', true),
      jsonb_build_object('property_id', 'model', 'display_name', 'Model',
        'api_name', 'model', 'base_type', 'string', 'backing_column', 'model',
        'datasource_id', bind::text)));

  SELECT count(*) INTO n FROM public.object_type_problems(t);
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 409: a type saved complete still reports % problem(s)', n;
  END IF;

  -- Position falls out of payload order when the client does not send one.
  IF (SELECT position FROM public.object_type_properties
       WHERE object_type_id = t AND property_id = 'model') <> 1 THEN
    RAISE EXCEPTION 'Migration 409: payload order did not become position';
  END IF;

  -- Moving the title key to another property is one save. Both designations are
  -- unique per type, so this is the case that fails without the clearing step.
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text),
    jsonb_build_array(
      jsonb_build_object('property_id', 'tail', 'display_name', 'Tail number',
        'api_name', 'tailNumber', 'base_type', 'string', 'backing_column', 'tail',
        'required', true, 'is_primary_key', true),
      jsonb_build_object('property_id', 'model', 'display_name', 'Model',
        'api_name', 'model', 'base_type', 'string', 'backing_column', 'model',
        'datasource_id', bind::text, 'is_title_key', true)));

  IF (SELECT property_id FROM public.object_type_properties
       WHERE object_type_id = t AND is_title_key) <> 'model' THEN
    RAISE EXCEPTION 'Migration 409: the title key did not move';
  END IF;

  -- A property left out of the payload is removed, and the badge notices.
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text),
    jsonb_build_array(
      jsonb_build_object('property_id', 'tail', 'display_name', 'Tail number',
        'api_name', 'tailNumber', 'base_type', 'string', 'backing_column', 'tail',
        'required', true, 'is_primary_key', true)));

  IF EXISTS (SELECT 1 FROM public.object_type_properties
              WHERE object_type_id = t AND property_id = 'model') THEN
    RAISE EXCEPTION 'Migration 409: a property absent from the payload survived';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.object_type_problems(t)
                  WHERE problem = 'A title key is required') THEN
    RAISE EXCEPTION 'Migration 409: dropping the title key holder went unreported';
  END IF;

  -- The save is one transaction, and the deletion is the half that matters:
  -- a rejected payload must not have already removed the properties it omits.
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text),
    jsonb_build_array(
      jsonb_build_object('property_id', 'tail', 'display_name', 'Tail number',
        'api_name', 'tailNumber', 'base_type', 'string', 'backing_column', 'tail',
        'required', true, 'is_primary_key', true),
      jsonb_build_object('property_id', 'model', 'display_name', 'Model',
        'api_name', 'model', 'base_type', 'string', 'backing_column', 'model',
        'datasource_id', bind::text, 'is_title_key', true)));

  BEGIN
    PERFORM public.save_object_type(
      jsonb_build_object('id', t::text),
      jsonb_build_array(
        jsonb_build_object('property_id', 'rid', 'display_name', 'Rid',
          'api_name', 'rid', 'base_type', 'string', 'backing_column', 'r',
          'datasource_id', bind::text)));
    RAISE EXCEPTION 'Migration 409: a reserved API name was accepted through the save';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  SELECT count(*) INTO n FROM public.object_type_properties WHERE object_type_id = t;
  IF n <> 2 THEN
    RAISE EXCEPTION 'Migration 409: a rejected save left % properties, expected the 2 it tried to replace', n;
  END IF;

  -- A type in another org is not writable through the RPC either — the policies
  -- decide, and this is what invoker rights buy. The UPDATE matches nothing
  -- under RLS, so the save reports the type as missing rather than as forbidden.
  BEGIN
    PERFORM public.save_object_type(
      jsonb_build_object('id', other_t::text, 'label', 'Mine now'), '[]'::jsonb);
    RAISE EXCEPTION 'Migration 409: the save reached across organizations';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;

  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.object_types WHERE id = other_t;
  DELETE FROM public.organizations WHERE id = other;
  DELETE FROM public.object_type_properties WHERE object_type_id = t;
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.dataset_branches WHERE dataset_id = ds;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
