-- 583 said the single-function column was "kept nullable and unused". It was
-- not nullable: 581's `vector_declares_its_distance` requires it on every
-- vector property, and 583 left that constraint standing while declaring the
-- column superseded. So a vector had to name one distance function AND list the
-- functions it supports — two answers to one question, with nothing keeping
-- them agreed.
--
-- Found by reading the catalog after applying 583, rather than by trusting the
-- comment I had just written. A superseded column that is still required is not
-- superseded; it is duplicated.
--
-- The api makes `supportsSearchWith` the field and does not carry a single
-- distance function at all, so the list is the answer and the column keeps only
-- the value it already holds.

BEGIN;

ALTER TABLE public.object_type_properties
  DROP CONSTRAINT vector_declares_its_distance;

COMMENT ON COLUMN public.object_type_properties.vector_distance_function IS
  'SUPERSEDED by object_type_vector_searches (583) and no longer required (584). The api makes supportsSearchWith a LIST — each entry its own index — and carries no single distance function, so nothing should be writing this.';

DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ot uuid; n int;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe584') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe584') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe584', 'Probe584') RETURNING id INTO proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe584', 'Probe584', false) RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Doc', 'Doc') RETURNING id INTO ot;

    -- A vector property with NO distance function: the shape the api describes.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column,
       vector_dimension, vector_embedding_kind, vector_embedding_model,
       searchable, sortable, selectable)
      VALUES (ot, 'embedding', 'embedding', 'Embedding', 'vector', 'embedding',
              1536, 'lms', 'text_embedding_3_small', false, false, false);

    SELECT count(*) INTO n FROM public.object_type_properties
     WHERE object_type_id = ot AND vector_distance_function IS NULL;
    IF n <> 1 THEN RAISE EXCEPTION 'the superseded column is still required'; END IF;

    -- And the dimension is still required, because the api does require it.
    BEGIN
      INSERT INTO public.object_type_properties
        (object_type_id, property_id, api_name, display_name, base_type, backing_column,
         searchable, sortable, selectable)
        VALUES (ot, 'e2', 'e2', 'E2', 'vector', 'e2', false, false, false);
      RAISE EXCEPTION 'a vector property with no dimension was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'probe584:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe584:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe584';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '584: the superseded column stops being required';
END $do$;

COMMIT;
