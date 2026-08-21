-- A property's datasource must be one of ITS object type's.
--
--   "Permissioned to one of the datasets backing the object type: To ensure
--   data consistency and security, edit-only properties must be permissioned to
--   one of the datasets backing the object type."
--   — object-link-types/edit-only-properties.md
--
-- 545 built the half a CHECK can hold — an edit-only property names a
-- datasource rather than nothing. It cannot hold this half: the question needs
-- object_type_datasources, and a CHECK may not contain a subquery. The foreign
-- key only requires the row to EXIST, so a property could point at another
-- object type's datasource and every guard would stay green.
--
-- Ladder: a fact needing another table, so the trigger rung. Not
-- ontology_violations() — a datasource cannot change object type, so this
-- cannot go stale on its own the way a dropped column can.
--
-- It is not only about edit-only properties: a `column` property names a
-- datasource_id too, and the same hole is under it. The guard reads the column,
-- not the source.
--
-- A GUARD, NOT A REPAIR: asked of the live database first, 0 of the properties
-- point at another object type's datasource. The surface never offered one —
-- PropertySourceDialog lists useObjectTypeDatasources(objectTypeId) — so this
-- closes the paths that do not go through it.

CREATE OR REPLACE FUNCTION public.guard_property_datasource()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.datasource_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.object_type_datasources d
                      WHERE d.id = NEW.datasource_id
                        AND d.object_type_id = NEW.object_type_id) THEN
    RAISE EXCEPTION 'Ontology:DatasourceBacksAnotherObjectType — a property is permissioned to one of the datasets backing its own object type'
      USING HINT = 'Add the datasource to this object type first, or choose one it already has.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_property_datasource
  BEFORE INSERT OR UPDATE OF datasource_id, object_type_id
  ON public.object_type_properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_datasource();

-- Refuse the foreign one, accept the type's own, and accept a null — the third
-- because a derived property has no datasource and must not be caught.
DO $$
DECLARE
  v_ont uuid;
  v_ds  uuid;
  v_a   uuid;
  v_b   uuid;
  v_dsb uuid;
  v_dset uuid;
  v_br  uuid;
BEGIN
  BEGIN
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT d.id, d.object_type_id INTO v_dsb, v_b
      FROM public.object_type_datasources d
     WHERE d.media_set_rid IS NULL LIMIT 1;
    IF v_ont IS NULL OR v_dsb IS NULL THEN
      RAISE EXCEPTION 'no ontology with a backed object type: 608 cannot prove its own guard';
    END IF;

    INSERT INTO public.object_types (ontology_id, api_name, label, icon)
    VALUES (v_ont, 'Probe608', 'Probe 608', 'cube') RETURNING id INTO v_a;

    -- v_dsb belongs to v_b, and v_a is a different object type
    IF v_a = v_b THEN RAISE EXCEPTION 'the probe picked its own datasource; it proves nothing'; END IF;

    BEGIN
      INSERT INTO public.object_type_properties
        (object_type_id, property_id, api_name, display_name, base_type, source,
         datasource_id, position)
      VALUES (v_a, 'borrowed', 'borrowed', 'Borrowed', 'string', 'user_input', v_dsb, 0);
      RAISE EXCEPTION 'a property was permissioned to another object type''s datasource';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ontology:DatasourceBacksAnotherObjectType%' THEN RAISE; END IF;
    END;

    -- Its own datasource is accepted. It needs a dataset of its own: a
    -- dataset+branch backs exactly one object type
    -- (Phonograph2:DatasetAndBranchAlreadyRegistered), which the first draft of
    -- this probe discovered by cloning one and being refused.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    SELECT ds.organization_id, ds.project_id, 'probe608ds', 'probe608ds'
      FROM public.datasets ds
      JOIN public.object_type_datasources d ON d.dataset_id = ds.id
     WHERE d.id = v_dsb RETURNING id INTO v_dset;
    INSERT INTO public.dataset_branches (dataset_id, name)
    VALUES (v_dset, 'master') RETURNING id INTO v_br;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
    VALUES (v_a, v_dset, v_br) RETURNING id INTO v_ds;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       datasource_id, position)
    VALUES (v_a, 'mine', 'mine', 'Mine', 'string', 'user_input', v_ds, 0);

    -- and a property with no datasource at all is untouched by the guard
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source, position)
    VALUES (v_a, 'derived', 'derived', 'Derived', 'string', 'linked_objects', 1);

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'refused another object type''s datasource, accepted its own, ignored a property with none';
  END;
END $$;
