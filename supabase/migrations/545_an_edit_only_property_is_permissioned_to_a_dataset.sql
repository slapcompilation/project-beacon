-- An edit-only property names a dataset. 408 forbade exactly that.
--
-- 408 built the source column from the only page we had then — a creation-wizard
-- screenshot — and said so in its own comment: "the creation wizard shows a
-- Source column whose entries are either a datasource column or 'User input /
-- actions', so not every property is backed by data". From that it wrote:
--
--   CHECK ((source = 'column'     AND backing_column IS NOT NULL)
--       OR (source = 'user_input' AND backing_column IS NULL AND datasource_id IS NULL))
--
-- `object-link-types/edit-only-properties` is the page for this property, and it
-- requires the thing that CHECK forbids:
--
--   "Edit-only properties allow you to define Ontology properties that are not
--    directly mapped to a column in the backing dataset of the object type."
--
--   "Permissioned to one of the datasets backing the object type: To ensure data
--    consistency and security, edit-only properties must be permissioned to one
--    of the datasets backing the object type."
--
-- An edit-only property escapes the COLUMN, not the DATASOURCE. The wizard
-- screenshot was not wrong; it never showed the Data section, where the creation
-- steps say to "choose a dataset to permission to (if you have more than one
-- dataset backing the object type)".
--
-- Also from that page, and the reason this is worth correcting now rather than
-- filing: "Available only in Object Storage v2: Edit-only properties are a
-- feature that is exclusively available for object types leveraging Object
-- Storage v2." We are on OSv2, so this is a property we can actually have.
--
-- The THIRD source type stays unbuilt on purpose. `derived-properties` is Beta,
-- "read-only", and "calculated at runtime based on values from linked objects"
-- with aggregations over a link type — an expression language, not a column
-- reference. It gets its own reading before a token is added here.

BEGIN;

-- ── the rows that predate the correction ────────────────────────────────────
-- Backfilled only where the choice is unambiguous: the page makes it a user's
-- choice when a type has several datasources, so we never guess between them.
UPDATE public.object_type_properties p
   SET datasource_id = (SELECT d.id FROM public.object_type_datasources d
                         WHERE d.object_type_id = p.object_type_id)
 WHERE p.source = 'user_input'
   AND p.datasource_id IS NULL
   AND (SELECT count(*) FROM public.object_type_datasources d
         WHERE d.object_type_id = p.object_type_id) = 1;

DO $do$
DECLARE n int; m int;
BEGIN
  SELECT count(*) INTO n FROM public.object_type_properties p
   WHERE p.source = 'user_input' AND p.datasource_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.object_type_datasources d
                      WHERE d.object_type_id = p.object_type_id);
  SELECT count(*) INTO m FROM public.object_type_properties p
   WHERE p.source = 'user_input' AND p.datasource_id IS NULL;

  IF n > 0 THEN
    RAISE EXCEPTION '% edit-only propert(ies) sit on an object type with no datasource to be permissioned to', n;
  END IF;
  IF m > 0 THEN
    RAISE EXCEPTION '% edit-only propert(ies) have several datasources to choose between; the page makes that a human choice', m;
  END IF;
END $do$;

-- ── the pairing rule, corrected ─────────────────────────────────────────────
-- 408's CHECK is unnamed, so it is found by what it says rather than guessed at.
DO $do$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.object_type_properties'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%user_input%'
     AND pg_get_constraintdef(oid) LIKE '%backing_column%';
  IF c IS NULL THEN
    RAISE EXCEPTION 'the source/backing_column pairing CHECK is not there to replace';
  END IF;
  EXECUTE format('ALTER TABLE public.object_type_properties DROP CONSTRAINT %I', c);
END $do$;

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT object_type_properties_source_names_its_data
  -- A column-sourced property names its column. An edit-only one names no column
  -- and one datasource — it escapes the column, not the permissioning.
  CHECK ((source = 'column'     AND backing_column IS NOT NULL)
      OR (source = 'user_input' AND backing_column IS NULL AND datasource_id IS NOT NULL));

COMMENT ON CONSTRAINT object_type_properties_source_names_its_data
  ON public.object_type_properties IS
  'A column-sourced property names its backing column; an edit-only property names none, but must still be permissioned to one of the datasets backing the object type.';

-- ── assertions, which execute the path ──────────────────────────────────────
-- Built on existing rows and rolled back, the way 531 does it: a fixture tree of
-- org, space, project and user is more machinery than this rule needs.
DO $do$
DECLARE ont uuid; org uuid; proj uuid; ds uuid; br uuid; bind uuid; t uuid; p uuid; ok boolean;
BEGIN
  SELECT o.id INTO ont FROM public.ontologies o LIMIT 1;
  SELECT d.organization_id, d.project_id INTO org, proj
    FROM public.datasets d WHERE d.project_id IS NOT NULL LIMIT 1;
  IF ont IS NULL OR proj IS NULL THEN
    RAISE EXCEPTION '545: no ontology or project to build the fixture on';
  END IF;

  -- Its own dataset, because a (dataset, branch) may back only one object type
  -- and every existing branch is already spoken for.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'edit_only_probe_545', 'Edit-only probe 545') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name)
       VALUES (ds, 'master') RETURNING id INTO br;

  INSERT INTO public.object_types (ontology_id, api_name, label)
       VALUES (ont, 'EditOnlyProbe545', 'Probe 545') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (t, ds, br) RETURNING id INTO bind;

  -- What 408 allowed and the page forbids: edit-only, permissioned to nothing.
  ok := false;
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, source)
    VALUES (t, 'stray', 'Stray', 'stray', 'string', 'user_input');
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'an edit-only property was accepted with no dataset to be permissioned to';
  END IF;

  -- What the page requires: no column, one datasource.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, datasource_id)
  VALUES (t, 'note', 'Note', 'note', 'string', 'user_input', bind)
  RETURNING id INTO p;
  IF p IS NULL THEN
    RAISE EXCEPTION 'a correctly permissioned edit-only property was refused';
  END IF;

  -- It escapes the column, so naming one is still a contradiction.
  ok := false;
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, source, datasource_id, backing_column)
    VALUES (t, 'both', 'Both', 'both', 'string', 'user_input', bind, 'note');
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'an edit-only property was accepted while also naming a column';
  END IF;

  -- A column-sourced property is untouched by any of this.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, backing_column, datasource_id)
  VALUES (t, 'title', 'Title', 'title', 'string', 'title', bind);

  RAISE NOTICE '545: an edit-only property is permissioned to a dataset';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $do$;

COMMIT;
