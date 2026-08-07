-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 408 — O2: properties become rows, and the two keys become
-- designations on them.
--
-- Reading: docs/foundry-reference/readings/properties-and-keys.md
--          docs/foundry-reference/readings/create-object-type.md
--
-- "A **property** of an object type is the schema definition of a characteristic
-- of a real-world entity or event." Analogous to a **column**; a property value
-- to a **field**.
--
-- Until now `object_types.properties` was a jsonb blob: a key, a label, a type
-- from a set of seven, and nothing else. It could not carry an API name, a real
-- base type, a backing column, or either key — so nothing downstream could be
-- generated from it and nothing could be validated against a datasource.
--
-- BOTH KEYS ARE CHECKBOXES ON A PROPERTY. The property editor shows them naming
-- their current holder — "Primary key (current: Tail Number)" — so they are
-- flags on a row, enforced one-per-type by a partial unique index, not columns on
-- the object type.
--
-- ELIGIBILITY IS THREE-VALUED, which is why it is not a single CHECK.
-- `properties-overview` gives a table, and only THREE base types are
-- unreservedly valid as a primary key:
--
--     Yes          String, Integer, Short
--     Discouraged  Date, Timestamp, Boolean, Byte, Long
--     No           everything else
--
-- `No` is a constraint. `Discouraged` is an authoring-time warning whose text is
-- the documented reason — "Boolean limits your object type to two object
-- instances"; "Long has representational issues in Javascript… greater than
-- 1e15". A CHECK cannot express that, so it lives in a function the surface
-- reads. Collapsing the tier into `No` would forbid what Foundry permits.
--
-- Title key is a SEPARATE axis and not the complement: fourteen base types can
-- title an object where three can key one.
--
-- ONE DEFINITION, not three (the lesson from 406). The eligibility sets are
-- functions; the CHECK constraints and the surface both call them.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- The base types, from properties-overview's table. Twenty-two, and the set is
-- closed — an unknown one is a typo, not an extension.
CREATE OR REPLACE FUNCTION public.property_base_types()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'string','integer','short','date','timestamp','boolean','byte','long',
    'float','double','decimal','vector','array','struct','media_reference',
    'time_series','geotemporal_series','attachment','geopoint','geoshape',
    'marking','cipher']
$$;

/** yes | discouraged | no — the three tiers, with `no` the only one a constraint
 *  can enforce. */
CREATE OR REPLACE FUNCTION public.primary_key_eligibility(p_base_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_base_type IN ('string','integer','short') THEN 'yes'
    WHEN p_base_type IN ('date','timestamp','boolean','byte','long') THEN 'discouraged'
    ELSE 'no'
  END
$$;

/** The reason, verbatim, for each discouraged type. NULL when there is nothing to
 *  say. This is the text an authoring surface shows — the tier is worthless
 *  without it. */
CREATE OR REPLACE FUNCTION public.primary_key_advice(p_base_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_base_type
    WHEN 'date' THEN 'Time values are inappropriate as primary keys, due to potentially unexpected collisions / uniqueness based on the storage format differing from the display format. In most cases, use String instead.'
    WHEN 'timestamp' THEN 'Time values are inappropriate as primary keys, due to potentially unexpected collisions / uniqueness based on the storage format differing from the display format. In most cases, use String instead.'
    WHEN 'boolean' THEN 'Boolean limits your object type to two object instances.'
    WHEN 'byte' THEN 'Byte properties can only be assigned in Actions via an Integer parameter, so in most cases use Integer instead.'
    WHEN 'long' THEN 'Long has representational issues in Javascript, so not all frontend libraries and code work well with Long values greater than 1e15. In most cases, use String instead.'
    ELSE NULL
  END
$$;

/** Fourteen of the twenty-two. Not the complement of the primary-key set:
 *  Geopoint, Cipher, Float/Double/Decimal and Array can all title an object and
 *  none can key one. */
CREATE OR REPLACE FUNCTION public.title_key_eligible(p_base_type text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_base_type NOT IN (
    'vector','struct','media_reference','time_series','geotemporal_series',
    'attachment','geoshape','marking')
$$;

COMMENT ON FUNCTION public.primary_key_eligibility(text) IS
  'yes | discouraged | no, from properties-overview. Only `no` is a constraint; `discouraged` is a warning carrying primary_key_advice().';

-- "there are a number of reserved keywords that cannot be used for API names"
CREATE OR REPLACE FUNCTION public.reserved_api_names()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['ontology','object','property','link','relation','rid',
               'primaryKey','typeId','ontologyObject']
$$;

CREATE TABLE public.object_type_properties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,

  -- "Can be made up of lowercase or uppercase letters, numbers, dashes, and
  --  underscores. Should start with a letter."
  property_id    text NOT NULL CHECK (property_id ~ '^[A-Za-z][A-Za-z0-9_-]*$'),
  display_name   text NOT NULL CHECK (length(btrim(display_name)) > 0),
  -- "Begin with a lowercase character… camelCase… between 1 and 100 characters."
  api_name       text NOT NULL
    CHECK (api_name ~ '^[a-z][A-Za-z0-9]*$' AND length(api_name) BETWEEN 1 AND 100),
  description    text NOT NULL DEFAULT '',
  aliases        text[] NOT NULL DEFAULT '{}',

  base_type      text NOT NULL CHECK (base_type = ANY (public.property_base_types())),

  -- Where the values come from. The creation wizard shows a Source column whose
  -- entries are either a datasource column or "User input / actions", so not
  -- every property is backed by data — some are populated purely by edits.
  source         text NOT NULL DEFAULT 'column' CHECK (source IN ('column','user_input')),
  -- Which of the object type's datasources. "a specific property of an object
  -- type must come from one—and only one—of the input datasources (except for
  -- the primary key property, which must exist in every input datasource)" —
  -- so NULL on the primary key means every one of them.
  datasource_id  uuid REFERENCES public.object_type_datasources(id) ON DELETE RESTRICT,
  backing_column text,

  -- "one definition used by several object types" — metadata is shared, the data
  -- is not. A real foreign key now: guard_shared_property_in_use existed only
  -- because "the reference lives inside jsonb, so there is no FK to do this".
  shared_property_id uuid REFERENCES public.shared_properties(id) ON DELETE RESTRICT,

  required       boolean NOT NULL DEFAULT false,
  visibility     text NOT NULL DEFAULT 'normal'
                   CHECK (visibility IN ('prominent','normal','hidden')),
  position       integer NOT NULL DEFAULT 0,

  is_primary_key boolean NOT NULL DEFAULT false,
  is_title_key   boolean NOT NULL DEFAULT false,

  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (object_type_id, property_id),
  UNIQUE (object_type_id, api_name),

  CHECK (NOT (api_name = ANY (public.reserved_api_names()))),
  -- A column-sourced property names its column; an edit-sourced one names none.
  CHECK ((source = 'column'     AND backing_column IS NOT NULL)
      OR (source = 'user_input' AND backing_column IS NULL AND datasource_id IS NULL)),
  -- The `no` tier, which is the only part a constraint can carry.
  CHECK (NOT is_primary_key OR public.primary_key_eligibility(base_type) <> 'no'),
  CHECK (NOT is_title_key   OR public.title_key_eligible(base_type)),
  -- "The primary key property cannot be a member of any property security
  --  policy", and a nullable key is not a key.
  CHECK (NOT is_primary_key OR required)
);

COMMENT ON TABLE public.object_type_properties IS
  'A property is the schema definition of a characteristic — analogous to a column, as a property value is to a field. The two keys are designations here, not fields on the object type.';
COMMENT ON COLUMN public.object_type_properties.datasource_id IS
  'Which backing datasource this property comes from. NULL on the primary key, which "must exist in every input datasource"; NULL also when source = user_input.';

-- "there is only one primary key for each object type"
CREATE UNIQUE INDEX object_type_one_primary_key
  ON public.object_type_properties (object_type_id) WHERE is_primary_key;
CREATE UNIQUE INDEX object_type_one_title_key
  ON public.object_type_properties (object_type_id) WHERE is_title_key;

CREATE INDEX object_type_properties_type_idx
  ON public.object_type_properties (object_type_id, position);

-- ── the completeness contract, as data ───────────────────────────────────────
-- Troubleshooting gives it as two lists, and an object type that violates them
-- shows a red triangle and "4 errors". This returns those errors.

CREATE OR REPLACE FUNCTION public.object_type_problems(p_object_type uuid)
RETURNS TABLE (scope text, subject text, problem text)
LANGUAGE sql STABLE AS $$
  -- Object type fields: ID, Display name, Plural display name, Backing
  -- datasource, API name.
  SELECT 'object_type', t.api_name, p.problem
    FROM public.object_types t
   CROSS JOIN LATERAL (VALUES
     ('Display name is required', length(btrim(t.label)) = 0),
     ('API name is required',     length(btrim(t.api_name)) = 0),
     ('A backing datasource is required',
        NOT EXISTS (SELECT 1 FROM public.object_type_datasources d
                     WHERE d.object_type_id = t.id)),
     ('At least one property is required — an object type needs a primary key',
        NOT EXISTS (SELECT 1 FROM public.object_type_properties pr
                     WHERE pr.object_type_id = t.id)),
     ('A primary key is required',
        NOT EXISTS (SELECT 1 FROM public.object_type_properties pr
                     WHERE pr.object_type_id = t.id AND pr.is_primary_key)),
     ('A title key is required',
        NOT EXISTS (SELECT 1 FROM public.object_type_properties pr
                     WHERE pr.object_type_id = t.id AND pr.is_title_key))
   ) AS p(problem, failed)
   WHERE t.id = p_object_type AND p.failed

  UNION ALL

  -- Property fields: Property ID, display name, Backing column, API name.
  SELECT 'property', pr.property_id, q.problem
    FROM public.object_type_properties pr
   CROSS JOIN LATERAL (VALUES
     ('A backing column is required',
        pr.source = 'column' AND coalesce(btrim(pr.backing_column), '') = ''),
     ('A non-key property must name which datasource it comes from',
        pr.source = 'column' AND NOT pr.is_primary_key AND pr.datasource_id IS NULL)
   ) AS q(problem, failed)
   WHERE pr.object_type_id = p_object_type AND q.failed
$$;

COMMENT ON FUNCTION public.object_type_problems(uuid) IS
  'Every reason an object type cannot be saved, from the two lists in create-object-type#mandatory-object-type-fields. This is what the "4 errors" badge counts.';

-- ── access ───────────────────────────────────────────────────────────────────
-- A property follows its object type, which is how ontology-permissions has it:
-- "the selected project determines who can view, edit, and manage them".

CREATE POLICY "read properties of visible object types" ON public.object_type_properties
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()));

CREATE POLICY "authors write properties" ON public.object_type_properties
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()
      AND (public.auth_role() IN ('owner','admin')
           OR public.has_resource_role('object_type', t.id, 'editor'))))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()
      AND (public.auth_role() IN ('owner','admin')
           OR public.has_resource_role('object_type', t.id, 'editor'))));

-- The jsonb blob is replaced. Empty in production, so there is nothing to carry
-- over — asserted rather than assumed.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.object_types
   WHERE jsonb_array_length(coalesce(properties, '[]'::jsonb)) > 0;
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 408: % object type(s) still hold jsonb properties — write a conversion before dropping the column', n;
  END IF;
END $$;

-- ── the jsonb-era validators, retired ────────────────────────────────────────
-- Four triggers read `properties`. Each is either replaced by something stronger
-- or moved onto the row.

-- Replaced by CHECK (NOT is_title_key OR title_key_eligible(base_type)) — and the
-- CHECK is stricter: this forbade only media_reference and vector, where
-- properties-overview names eight types that cannot title an object.
DROP TRIGGER IF EXISTS trg_title_key_type ON public.object_types;
DROP FUNCTION IF EXISTS public.enforce_title_key_type() CASCADE;

-- Replaced by a foreign key. Its own comment said why it existed: "The reference
-- lives inside jsonb, so there is no FK to do this." Now there is one.
DROP TRIGGER IF EXISTS trg_shared_property_in_use ON public.shared_properties;
DROP FUNCTION IF EXISTS public.guard_shared_property_in_use() CASCADE;

-- Moved onto the row, keeping the rule it carried.
DROP TRIGGER IF EXISTS trg_shared_property_types ON public.object_types;
DROP FUNCTION IF EXISTS public.enforce_shared_property_types() CASCADE;

/** "Base types… must match the column type in order to be applied on an object
 *  type." Same rule, now against a row and a real reference. */
CREATE OR REPLACE FUNCTION public.enforce_shared_property_type()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE sp record; ot_org uuid;
BEGIN
  IF NEW.shared_property_id IS NULL THEN RETURN NEW; END IF;
  SELECT api_name, base_type, organization_id INTO sp
    FROM public.shared_properties WHERE id = NEW.shared_property_id;
  SELECT organization_id INTO ot_org FROM public.object_types WHERE id = NEW.object_type_id;

  IF sp.organization_id IS DISTINCT FROM ot_org THEN
    RAISE EXCEPTION 'Ontology:SharedPropertyInAnotherOrganization — "%" belongs to a different organization', sp.api_name;
  END IF;
  IF NEW.base_type IS DISTINCT FROM sp.base_type THEN
    RAISE EXCEPTION 'Ontology:SharedPropertyTypeMismatch — property "%" is % but shared property "%" is %. A shared property can only be applied where the base type matches.',
      NEW.property_id, NEW.base_type, sp.api_name, sp.base_type;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER enforce_shared_property_type
  BEFORE INSERT OR UPDATE ON public.object_type_properties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shared_property_type();

-- shared_properties spoke the old six-value vocabulary. One base-type vocabulary
-- now, the same function the property rows use.
ALTER TABLE public.shared_properties DROP CONSTRAINT IF EXISTS shared_properties_base_type_check;
ALTER TABLE public.shared_properties
  ADD CONSTRAINT shared_properties_base_type_check
  CHECK (base_type = ANY (public.property_base_types()));

-- The version bump no longer watches a column that is going away; a property
-- change bumps its object type instead.
CREATE OR REPLACE FUNCTION public.bump_object_type_version()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF ROW(NEW.label, NEW.icon, NEW.description, NEW.computed_properties, NEW.view_config)
     IS DISTINCT FROM
     ROW(OLD.label, OLD.icon, OLD.description, OLD.computed_properties, OLD.view_config) THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.bump_object_type_on_property_change()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.object_types
     SET version = version + 1, updated_at = now()
   WHERE id = coalesce(NEW.object_type_id, OLD.object_type_id);
  RETURN NULL;
END $fn$;

CREATE TRIGGER bump_object_type_on_property_change
  AFTER INSERT OR UPDATE OR DELETE ON public.object_type_properties
  FOR EACH ROW EXECUTE FUNCTION public.bump_object_type_on_property_change();

ALTER TABLE public.object_types DROP COLUMN properties;
ALTER TABLE public.object_types DROP COLUMN title_key;

DO $$
DECLARE
  org uuid; proj uuid; ds uuid; br uuid; t uuid; bind uuid; p uuid; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('m408') RETURNING id INTO org;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm408', 'm408') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm408', 'm408') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.object_types (organization_id, api_name, label)
       VALUES (org, 'm408', 'Aircraft') RETURNING id INTO t;

  -- An object type with nothing: the badge counts every missing field.
  SELECT count(*) INTO n FROM public.object_type_problems(t);
  IF n <> 4 THEN
    RAISE EXCEPTION 'Migration 408: a bare object type reported % problems, expected 4 (datasource, a property, a primary key, a title key)', n;
  END IF;

  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (t, ds, br) RETURNING id INTO bind;

  -- Only three base types are unreservedly valid as a primary key; the `no` tier
  -- is refused outright.
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type,
       backing_column, datasource_id, required, is_primary_key)
    VALUES (t, 'loc', 'Location', 'location', 'geopoint', 'loc', bind, true, true);
    RAISE EXCEPTION 'Migration 408: a geopoint was accepted as a primary key';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- …but the discouraged tier is PERMITTED, with its reason available.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, required, is_primary_key)
  VALUES (t, 'built', 'Built', 'built', 'timestamp', 'built', true, true) RETURNING id INTO p;
  IF public.primary_key_eligibility('timestamp') <> 'discouraged' THEN
    RAISE EXCEPTION 'Migration 408: timestamp is not reported as discouraged';
  END IF;
  IF public.primary_key_advice('timestamp') IS NULL THEN
    RAISE EXCEPTION 'Migration 408: a discouraged type carries no reason — the tier is worthless without it';
  END IF;
  IF public.primary_key_advice('string') IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 408: an unreservedly valid type carries advice';
  END IF;

  -- One primary key per object type.
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type,
       backing_column, datasource_id, required, is_primary_key)
    VALUES (t, 'tail', 'Tail Number', 'tailNumber', 'string', 'tail', bind, true, true);
    RAISE EXCEPTION 'Migration 408: a second primary key was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Title key is a different axis: geopoint cannot key but CAN title.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, datasource_id, is_title_key)
  VALUES (t, 'loc', 'Location', 'location', 'geopoint', 'loc', bind, true);
  -- …while a media reference can do neither.
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type,
       backing_column, datasource_id, is_title_key)
    VALUES (t, 'photo', 'Photo', 'photo', 'media_reference', 'photo', bind, true);
    RAISE EXCEPTION 'Migration 408: a media reference was accepted as a title key';
  EXCEPTION WHEN unique_violation THEN NULL;   -- one title key already exists
           WHEN check_violation  THEN NULL;
  END;

  -- Reserved API names, and camelCase.
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type,
       backing_column, datasource_id)
    VALUES (t, 'r', 'Rid', 'rid', 'string', 'r', bind);
    RAISE EXCEPTION 'Migration 408: a reserved API name was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type,
       backing_column, datasource_id)
    VALUES (t, 'T', 'Tail', 'TailNumber', 'string', 'tail', bind);
    RAISE EXCEPTION 'Migration 408: a PascalCase property API name was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A user-input property names no column, and must not name a datasource.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source)
  VALUES (t, 'note', 'Note', 'note', 'string', 'user_input');

  -- Complete now: datasource, properties, both keys.
  SELECT count(*) INTO n FROM public.object_type_problems(t);
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 408: a complete object type still reports % problem(s)', n;
  END IF;

  -- Remove the primary key and the badge comes back — with TWO problems, not
  -- one, and the second is the interesting one. `built` carried no datasource
  -- because the primary key "must exist in every input datasource"; the moment it
  -- stops being the key, that exemption stops applying and it owes a datasource.
  -- The first version of this assertion expected one problem and was wrong.
  UPDATE public.object_type_properties SET is_primary_key = false WHERE object_type_id = t;
  IF NOT EXISTS (SELECT 1 FROM public.object_type_problems(t)
                  WHERE problem = 'A primary key is required') THEN
    RAISE EXCEPTION 'Migration 408: removing the primary key did not report it missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.object_type_problems(t)
                  WHERE problem LIKE 'A non-key property must name%') THEN
    RAISE EXCEPTION 'Migration 408: the demoted key was not asked for a datasource';
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.object_type_properties WHERE object_type_id = t;
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.dataset_branches WHERE dataset_id = ds;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.organizations WHERE id = org;
END $$;

COMMIT;
