-- E4: a value type is a reusable semantic declaration — a base type plus a
-- constraint, versioned, owned by a SPACE, and bound by properties across the
-- ontology. Built from readings/value-types.md (11 decisions; the six pages
-- total under 100 lines of prose, so the images carried most of the spec).
--
--   "value types are associated with a space in the platform."
--   "Provide a clear name, description, and unique API name for your value
--    type." … "Choose a base type" … "(Optional) Define a constraint"
--                                     (object-link-types/create-value-type)
--
-- SPACE-scoped, not ontology-scoped: type-reference.md's own outline puts
-- Value types OUTSIDE Ontology resources, and Pipeline Builder consumes them
-- without being an ontology resource. Visibility therefore reads the space's
-- organization list, the same shape 441 gave ontologies.
--
-- The eight constraint kinds, verbatim from value-type-constraints.md:
--   Enum ("String, Boolean, Decimal, Double, Float, Integer, or Short"),
--   Range ("Decimal, Double, Float, Integer, Short, Date, Timestamp, String,
--   or Array" — value, string length, or array size), Regex (String),
--   RID (String), UUID (String), Uniqueness (Array), Nested (Array),
--   Element constraints (Struct).
--
-- The last two make the graph SELF-REFERENTIAL: a value type for an array of
-- emails references the email value type; a struct value type references one
-- per field.
--
-- ── DECISIONS, and which are inference ─────────────────────────────────────
-- · Q3 default (INFERENCE): constraints are ROWS, at most ONE non-element
--   constraint per version (the prose says "a constraint", the radios pick one
--   kind) — element constraints take one row per struct field. Starting at
--   0..1 is relaxable later; a cap added later would not be.
-- · Q3's second half (INFERENCE): Nested's "value type constraint can be
--   applied to the elements" is read as a reference to another VALUE TYPE,
--   matching Element constraints' plainer "value type reference" — one edge
--   shape, not two.
-- · Versioning: "only a constraint change mints one" — metadata mutates
--   freely; minting is a function so a version cannot be half-written. The
--   version is an integer; its display format is unattested.
-- · The ontology never pins: binders reference the value type, not a version —
--   "non-breaking versions auto-propagate to all uses".
-- · failure_message rests on ONE screenshot (default "Constraint failed") and
--   the reading flags it; taken, because an enforcement without a message
--   would invent its own words instead.
-- · Enforcement is INDEX-TIME, as the reading found ("whole object type
--   fails") — wired into index_object_type below. Action-submission
--   enforcement is not attested and not built.
-- · No status, no RID column: metadata-statuses lists the five status-bearing
--   kinds and value types are not among them; the RID form is unattested.
-- · Validation recursion is capped at depth 10 — a nested-reference cycle is
--   not documented anywhere, so rather than inventing a graph guard, the
--   validator refuses past the cap by name. DECLARED INVENTION.

CREATE TABLE public.value_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        uuid NOT NULL REFERENCES public.spaces(id) ON DELETE RESTRICT,
  api_name        text NOT NULL CHECK (length(btrim(api_name)) > 0),
  display_name    text NOT NULL CHECK (length(btrim(display_name)) > 0),
  description     text NOT NULL DEFAULT '',
  base_type       text NOT NULL CHECK (base_type = ANY (public.property_base_types())),
  example_value   jsonb,
  -- The screenshot's field, its default verbatim.
  failure_message text NOT NULL DEFAULT 'Constraint failed',
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, api_name)
);

COMMENT ON TABLE public.value_types IS
  'A reusable semantic declaration: base type + constraint, versioned, owned by a space (type-reference puts value types outside Ontology resources). Metadata mutates freely; constraints mint versions; the base type is immutable from save.';

-- "the base type is immutable from save" — image-attested, guarded.
CREATE OR REPLACE FUNCTION public.guard_value_type_base()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.base_type IS DISTINCT FROM OLD.base_type THEN
    RAISE EXCEPTION 'Ontology:ValueTypeBaseIsFixed — a value type''s base type cannot change after save'
      USING HINT = 'Create a new value type instead.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER guard_value_type_base
  BEFORE UPDATE ON public.value_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_value_type_base();

CREATE TABLE public.value_type_constraints (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_type_id uuid NOT NULL REFERENCES public.value_types(id) ON DELETE CASCADE,
  version       integer NOT NULL CHECK (version > 0),
  kind          text NOT NULL CHECK (kind IN
    ('enum','range','regex','rid','uuid','uniqueness','nested','element')),
  -- enum: {"values":[…],"case_sensitive":bool} · range: {"min":…,"max":…} ·
  -- regex: {"pattern":…,"substring":bool} · rid/uuid/uniqueness: {}
  params        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The self-edge: nested and element point at another value type.
  referenced_value_type_id uuid REFERENCES public.value_types(id) ON DELETE RESTRICT,
  struct_field  text,
  CHECK ((kind IN ('nested','element')) = (referenced_value_type_id IS NOT NULL)),
  CHECK ((kind = 'element') = (struct_field IS NOT NULL))
);

-- "a constraint", singular: at most one non-element row per version; element
-- rows are one per struct field.
CREATE UNIQUE INDEX value_type_one_constraint_per_version
  ON public.value_type_constraints (value_type_id, version) WHERE kind <> 'element';
CREATE UNIQUE INDEX value_type_element_per_field
  ON public.value_type_constraints (value_type_id, version, struct_field) WHERE kind = 'element';

-- ── versions are minted, never edited ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mint_value_type_version(
  p_value_type  uuid,
  p_constraints jsonb DEFAULT '[]'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v integer; e jsonb;
BEGIN
  UPDATE public.value_types
     SET current_version = current_version + 1
   WHERE id = p_value_type
  RETURNING current_version INTO v;
  IF v IS NULL THEN
    RAISE EXCEPTION 'Ontology:ValueTypeNotFound — % is not a value type you can edit', p_value_type;
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_constraints, '[]'::jsonb)) LOOP
    INSERT INTO public.value_type_constraints
      (value_type_id, version, kind, params, referenced_value_type_id, struct_field)
    VALUES (p_value_type, v, e->>'kind', coalesce(e->'params','{}'::jsonb),
            nullif(e->>'referenced_value_type_id','')::uuid,
            nullif(e->>'struct_field',''));
  END LOOP;
  RETURN v;
END $$;

COMMENT ON FUNCTION public.mint_value_type_version(uuid, jsonb) IS
  '"Only a constraint change mints one." The new constraint set lands as a fresh version in one call, so a version can never be half-written; earlier versions stay readable for consumers that pin (function repositories do; the ontology does not).';

REVOKE ALL ON FUNCTION public.mint_value_type_version(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mint_value_type_version(uuid, jsonb) TO authenticated;

-- ── visibility: the space's list, as 441 shaped it ─────────────────────────
ALTER TABLE public.value_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_type_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read value types in scope" ON public.value_types
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.space_organizations so
     WHERE so.space_id = value_types.space_id AND public.auth_in_org(so.organization_id)));
CREATE POLICY "editors author value types" ON public.value_types
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.space_organizations so
     WHERE so.space_id = value_types.space_id AND so.organization_id = public.auth_org_id()))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.space_organizations so
     WHERE so.space_id = value_types.space_id AND so.organization_id = public.auth_org_id()));

CREATE POLICY "read constraints in scope" ON public.value_type_constraints
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.value_types vt
     JOIN public.space_organizations so ON so.space_id = vt.space_id
    WHERE vt.id = value_type_constraints.value_type_id AND public.auth_in_org(so.organization_id)));
CREATE POLICY "editors author constraints" ON public.value_type_constraints
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.value_types vt
     JOIN public.space_organizations so ON so.space_id = vt.space_id
    WHERE vt.id = value_type_constraints.value_type_id
      AND so.organization_id = public.auth_org_id()))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.value_types, public.value_type_constraints TO authenticated;

-- ── the binders: four of the attested seven exist here ─────────────────────
-- The ontology never pins, so the FK is to the type, not a version.
ALTER TABLE public.object_type_properties
  ADD COLUMN value_type_id uuid REFERENCES public.value_types(id) ON DELETE RESTRICT;
ALTER TABLE public.shared_properties
  ADD COLUMN value_type_id uuid REFERENCES public.value_types(id) ON DELETE RESTRICT;
ALTER TABLE public.interface_properties
  ADD COLUMN value_type_id uuid REFERENCES public.value_types(id) ON DELETE RESTRICT;
ALTER TABLE public.action_type_parameters
  ADD COLUMN value_type_id uuid REFERENCES public.value_types(id) ON DELETE RESTRICT;

-- ── conformance: does a value satisfy a value type's current constraint? ───
CREATE OR REPLACE FUNCTION public.value_conforms(p_value jsonb, p_value_type uuid, p_depth int DEFAULT 0)
RETURNS boolean
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE vt record; c record; s text; n numeric; el jsonb; passed boolean := true;
BEGIN
  IF p_depth > 10 THEN
    -- No page documents nested-reference cycles; refusing past the cap is a
    -- declared invention, and quieter than an infinite recursion.
    RAISE EXCEPTION 'Ontology:ValueTypeTooDeep — value type references nest more than 10 levels';
  END IF;
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN RETURN true; END IF;

  SELECT * INTO vt FROM public.value_types WHERE id = p_value_type;
  IF vt.id IS NULL THEN RETURN true; END IF;

  FOR c IN SELECT * FROM public.value_type_constraints
            WHERE value_type_id = p_value_type AND version = vt.current_version
  LOOP
    s := p_value #>> '{}';
    passed := CASE c.kind
      WHEN 'enum' THEN
        CASE WHEN coalesce((c.params->>'case_sensitive')::boolean, true)
             THEN p_value IN (SELECT v FROM jsonb_array_elements(c.params->'values') v)
             ELSE lower(s) IN (SELECT lower(v.value #>> '{}')
                                 FROM jsonb_array_elements(c.params->'values') v)
        END
      WHEN 'range' THEN
        CASE
          WHEN jsonb_typeof(p_value) = 'array' THEN
            (c.params->>'min' IS NULL OR jsonb_array_length(p_value) >= (c.params->>'min')::int)
            AND (c.params->>'max' IS NULL OR jsonb_array_length(p_value) <= (c.params->>'max')::int)
          WHEN vt.base_type = 'string' THEN
            (c.params->>'min' IS NULL OR length(s) >= (c.params->>'min')::int)
            AND (c.params->>'max' IS NULL OR length(s) <= (c.params->>'max')::int)
          WHEN s ~ '^-?\d+(\.\d+)?$' THEN
            (c.params->>'min' IS NULL OR s::numeric >= (c.params->>'min')::numeric)
            AND (c.params->>'max' IS NULL OR s::numeric <= (c.params->>'max')::numeric)
          ELSE
            (c.params->>'min' IS NULL OR s >= c.params->>'min')
            AND (c.params->>'max' IS NULL OR s <= c.params->>'max')
        END
      WHEN 'regex' THEN
        CASE WHEN coalesce((c.params->>'substring')::boolean, false)
             THEN s ~ (c.params->>'pattern')
             ELSE s ~ ('^(?:' || (c.params->>'pattern') || ')$')
        END
      WHEN 'rid'  THEN s ~ '^ri\.[a-z0-9\-]+\.[a-z0-9\-]*\.[a-z0-9\-]+\.[a-zA-Z0-9\-\._]+$'
      WHEN 'uuid' THEN s ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      WHEN 'uniqueness' THEN
        jsonb_typeof(p_value) = 'array' AND
        (SELECT count(*) = count(DISTINCT v.value)
           FROM jsonb_array_elements(p_value) v)
      WHEN 'nested' THEN
        jsonb_typeof(p_value) = 'array' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_value) v
           WHERE NOT public.value_conforms(v.value, c.referenced_value_type_id, p_depth + 1))
      WHEN 'element' THEN
        public.value_conforms(p_value -> c.struct_field, c.referenced_value_type_id, p_depth + 1)
    END;
    IF passed IS NOT TRUE THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

COMMENT ON FUNCTION public.value_conforms(jsonb, uuid, int) IS
  'Does a value satisfy the value type''s CURRENT constraint — the ontology never pins a version. NULL conforms (requiredness is the property''s concern). Nested and element recurse through the self-edge, capped at depth 10 by declared invention.';

REVOKE ALL ON FUNCTION public.value_conforms(jsonb, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.value_conforms(jsonb, uuid, int) TO authenticated;

-- ── enforcement is index-time: the build fails with the authored message ───
-- Patched in place with the needle asserted (440's pattern): after the merge
-- drops deleted objects, each value-typed property must conform before the
-- row may enter the index.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.index_object_type(uuid)'::regprocedure);
  IF def NOT LIKE '%CONTINUE WHEN merged.deleted;%' THEN
    RAISE EXCEPTION 'index_object_type has drifted — wire value-type enforcement by hand';
  END IF;
  def := replace(def, 'CONTINUE WHEN merged.deleted;',
    'CONTINUE WHEN merged.deleted;
      -- Value types enforce at index time; a violation fails the whole build.
      PERFORM 1 FROM public.object_type_properties vp
        JOIN public.value_types vvt ON vvt.id = vp.value_type_id
       WHERE vp.object_type_id = p_object_type
         AND NOT public.value_conforms(merged.properties -> vp.property_id, vp.value_type_id);
      IF FOUND THEN
        SELECT format(''property "%s" of object "%s": %s'', vp.property_id, staged.pk, vvt.failure_message)
          INTO bad
          FROM public.object_type_properties vp
          JOIN public.value_types vvt ON vvt.id = vp.value_type_id
         WHERE vp.object_type_id = p_object_type
           AND NOT public.value_conforms(merged.properties -> vp.property_id, vp.value_type_id)
         LIMIT 1;
        RAISE EXCEPTION ''%'', bad;
      END IF;');
  EXECUTE def;
  IF pg_get_functiondef('public.index_object_type(uuid)'::regprocedure)
     NOT LIKE '%value_conforms%' THEN
    RAISE EXCEPTION 'the enforcement did not land in index_object_type';
  END IF;
END $$;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; txn uuid; t uuid;
  vt_email uuid; vt_emails uuid; usr uuid := gen_random_uuid(); before text;
  ptbl text; fid uuid; x public.object_type_indexes; v int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('vt-452') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws452@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws452@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS452');

  -- 1. A value type with a regex constraint, and its self-referential array.
  INSERT INTO public.value_types (space_id, api_name, display_name, base_type, failure_message)
  VALUES (sp, 'Email', 'Email', 'string', 'Not a valid email address.')
  RETURNING id INTO vt_email;
  v := public.mint_value_type_version(vt_email, jsonb_build_array(jsonb_build_object(
    'kind','regex','params', jsonb_build_object('pattern','[^@]+@[^@]+\.[^@]+'))));
  IF v <> 2 THEN RAISE EXCEPTION 'minting did not bump the version (got %)', v; END IF;

  INSERT INTO public.value_types (space_id, api_name, display_name, base_type)
  VALUES (sp, 'Emails', 'Emails', 'array') RETURNING id INTO vt_emails;
  PERFORM public.mint_value_type_version(vt_emails, jsonb_build_array(jsonb_build_object(
    'kind','nested','referenced_value_type_id', vt_email::text)));

  IF NOT public.value_conforms(to_jsonb('a@b.co'::text), vt_email) THEN
    RAISE EXCEPTION 'a valid email did not conform';
  END IF;
  IF public.value_conforms(to_jsonb('nope'::text), vt_email) THEN
    RAISE EXCEPTION 'an invalid email conformed';
  END IF;
  IF NOT public.value_conforms('["a@b.co","c@d.eu"]'::jsonb, vt_emails) THEN
    RAISE EXCEPTION 'a valid email array did not conform through the self-edge';
  END IF;
  IF public.value_conforms('["a@b.co","nope"]'::jsonb, vt_emails) THEN
    RAISE EXCEPTION 'an invalid element conformed through the self-edge';
  END IF;

  -- 2. The base type is immutable from save.
  BEGIN
    UPDATE public.value_types SET base_type = 'integer' WHERE id = vt_email;
    RAISE EXCEPTION 'a base type changed after save';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%ValueTypeBaseIsFixed%' THEN RAISE; END IF;
  END;

  -- 3. Enforcement is index-time, with the authored failure message.
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws452', 'WS 452') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws452', 'WS452') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'people452', 'people') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"person_id","type":"STRING"},{"name":"email","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'people.parquet', 2) RETURNING id INTO fid;
  UPDATE public.dataset_transactions
     SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, person_id, email) VALUES ($1,''P1'',''a@b.co''),($1,''P2'',''broken'')',
    ptbl) USING fid;

  t := public.save_object_type(
    jsonb_build_object('api_name','Person','label','Person','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','person_id','display_name','Person Id',
      'api_name','personId','base_type','string','source','column','backing_column','person_id',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text, 'api_name','Person','label','Person'),
    jsonb_build_array(
      jsonb_build_object('property_id','person_id','display_name','Person Id','api_name','personId',
        'base_type','string','source','column','backing_column','person_id',
        'is_primary_key',true,'is_title_key',true,'required',true),
      jsonb_build_object('property_id','email','display_name','Email','api_name','email',
        'base_type','string','source','column','backing_column','email',
        'datasource_id', (SELECT id::text FROM public.object_type_datasources
                           WHERE object_type_id = t))));
  PERFORM public.save_working_state();
  UPDATE public.object_type_properties SET value_type_id = vt_email
   WHERE object_type_id = t AND property_id = 'email';

  x := public.index_object_type(t);
  IF x.status <> 'failed' OR x.error NOT LIKE '%Not a valid email address.%' THEN
    RAISE EXCEPTION 'the violating row did not fail the build with the authored message (%/%)', x.status, x.error;
  END IF;

  EXECUTE format('UPDATE datasets.%I SET email = ''p2@b.co'' WHERE person_id = ''P2''', ptbl);
  x := public.index_object_type(t);
  IF x.status <> 'success' OR x.object_count <> 2 THEN
    RAISE EXCEPTION 'the corrected rows did not index (%/%: %)', x.status, x.object_count, x.error;
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '452: a declaration, a version, a self-edge, and an index that enforces it';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
