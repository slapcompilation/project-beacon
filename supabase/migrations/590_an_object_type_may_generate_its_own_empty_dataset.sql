-- Step 1 of the create wizard is "Object type backing", and it offers two
-- things. We have only ever offered one.
--
--   "If you do not have an existing datasource containing data for the object
--    type, you can choose to continue without an existing datasource and select
--    a location to generate a dataset for permissions. This option is not
--    available if you are using Object Storage v1. As permissions of the objects
--    of a type are determined by the location of their backing datasources, you
--    will be prompted to choose a location to which you want to save an empty
--    dataset."
--   — object-link-types/create-object-type.md
--
-- Step 1 draws the choice as two cards, one of them titled
--   "Continue without datasource" over "Generate a dataset for permissions purposes"
--   — object-link-types/images/create-object-type-datasource-step.png
--
-- and picking it opens a dialog with a File name and a Location, defaulting to
-- a folder named `.auto-save`:
--   "Create a new backing dataset"
--   — object-link-types/images/create-object-type-choose-new-datasource-location.png
--
-- Without it a new object type has no datasource at all, so the first thing it
-- does is fail its own linter: `object_type_problems` reports "A backing
-- datasource is required" and the save that would introduce it is refused. The
-- wizard forces the choice at step 1 for exactly that reason.
--
-- One function rather than three inserts from the client, because a half-done
-- create leaves an object type that cannot be saved and cannot be indexed. And
-- deliberately NOT security definer: making a dataset in a folder is the
-- caller's right or nobody's, and this must answer the same as a hand-written
-- insert would.

CREATE OR REPLACE FUNCTION public.generate_backing_dataset(
  p_object_type uuid, p_name text, p_folder uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE
  ont uuid; proj uuid; org uuid; slug text; ds uuid; br uuid;
BEGIN
  SELECT t.ontology_id, t.project_id INTO ont, proj
    FROM public.object_types t WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;

  -- "As permissions of the objects of a type are determined by the location of
  -- their backing datasources": the location IS the argument. A folder answers
  -- which project, so it wins over the object type's own placement.
  IF p_folder IS NOT NULL THEN
    SELECT f.project_id, f.organization_id INTO proj, org
      FROM public.folders f WHERE f.id = p_folder;
    IF proj IS NULL THEN
      RAISE EXCEPTION 'Compass:FolderNotFound — % is not a folder you can see', p_folder;
    END IF;
  ELSE
    IF proj IS NULL THEN
      RAISE EXCEPTION 'Ontology:DatasourceNeedsALocation — choose a folder to save the empty dataset in'
        USING HINT = 'Object permissions come from where the backing dataset lives, so it needs somewhere to live.';
    END IF;
    SELECT p.organization_id INTO org FROM public.projects p WHERE p.id = proj;
  END IF;

  slug := regexp_replace(lower(btrim(coalesce(p_name, ''))), '[^a-z0-9]+', '_', 'g');
  slug := regexp_replace(slug, '^_+|_+$', '', 'g');
  IF slug !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Compass:InvalidName — "%" does not make a dataset name', p_name;
  END IF;

  INSERT INTO public.datasets (organization_id, project_id, folder_id, api_name, name)
  VALUES (org, proj, p_folder, slug, btrim(p_name))
  RETURNING id INTO ds;

  -- No transaction and no schema: the dataset is empty, which is the point.
  -- Both linters already tolerate that — the backing-column arm requires a
  -- non-null schema, and 587's key arm requires a non-empty field list — so an
  -- object type backed by one is incomplete without being wrong.
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master')
  RETURNING id INTO br;

  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (p_object_type, ds, br);

  RETURN ds;
END $fn$;

COMMENT ON FUNCTION public.generate_backing_dataset(uuid, text, uuid) IS
  'The create wizard''s "Continue without datasource" branch: an empty dataset in '
  'a chosen location, its master branch, and the datasource row — one transaction, '
  'because a half-done create leaves an object type that cannot be saved.';

DO $$
DECLARE n int;
BEGIN
  -- It exists, it is invoker, and it takes the three arguments the dialog has.
  SELECT count(*) INTO n FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'generate_backing_dataset'
     AND NOT p.prosecdef;
  IF n <> 1 THEN
    RAISE EXCEPTION 'generate_backing_dataset must exist exactly once, as invoker (found %)', n;
  END IF;
END $$;
