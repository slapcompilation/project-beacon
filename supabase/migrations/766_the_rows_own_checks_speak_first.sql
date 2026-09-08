-- The row's own CHECKs speak first.
--
-- 765 put `guard_object_backed_edges` on a BEFORE INSERT OR UPDATE trigger, and
-- a BEFORE trigger runs ahead of every CHECK on the row. So the guard answered
-- questions that were not its own: an object-backed link declared
-- `many_to_many` was told its source edge could not be found, when what is
-- wrong with it is the cardinality — `link_types_object_backed_cardinality`
-- (717) had the answer and never got to give it. The platform suite said so
-- twice on the first full run after 765, which is the value of a case that
-- names the guard it expects.
--
-- CLAUDE.md's ladder puts a fact about one row in a CHECK and a fact needing
-- other tables in a trigger; it also warns, in its own words, that a BEFORE
-- trigger runs ahead of the CHECKs and so a test can pass against the wrong
-- guard. The fix is the
-- shape 469 already uses for `assert_rule_order`: a CONSTRAINT TRIGGER, which
-- fires at the end of the statement — after the row's own CHECKs have had
-- their say. Nothing about what the guard checks changes; only when.
--
-- What each now answers, in the order a caller meets them:
--   * `link_types_object_backed_edges` (765) — an object-backed link names two
--     edges, and no other kind names any.
--   * `link_types_object_backed_cardinality` (717) — and it is many-to-one or
--     one-to-many.
--   * `guard_object_backed_edges` (765) — and each named edge really is a
--     many-to-one foreign-key link from the backing type to that side.

DROP TRIGGER guard_object_backed_edges ON public.link_types;

CREATE CONSTRAINT TRIGGER guard_object_backed_edges
AFTER INSERT OR UPDATE ON public.link_types
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.guard_object_backed_edges();

COMMENT ON FUNCTION public.guard_object_backed_edges() IS
  'An object-backed link''s two edges must each be a many-to-one foreign-key link from the backing object type to one side — the shape create-link-type''s prerequisites describe, and the one the two-hop walk reads. Refusing here is what lets the readers assume it. A CONSTRAINT TRIGGER since 766, so the row''s own CHECKs answer for the row and this answers only for the edges.';

-- ── PROVED BY DOING — each guard answers its own question ───────────────────

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid; ta uuid; tb uuid;
  plain uuid; err text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m766 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm766-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm766-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M766 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm766p', 'm766 probe') RETURNING id INTO proj;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M766A', 'M766 A') RETURNING id INTO ta;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M766B', 'M766 B') RETURNING id INTO tb;

  -- the cardinality CHECK answers for the cardinality, not the edges
  BEGIN
    INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                   api_name, label, cardinality, backing_kind, backing_object_type_id,
                                   source_edge_link_type_id, target_edge_link_type_id)
    VALUES (ont, proj, ta, tb, 'm766-mm', 'M766 mm', 'many_to_many', 'object_backed', tb,
            gen_random_uuid(), gen_random_uuid());
    RAISE EXCEPTION 'a many-to-many object-backed link should be refused';
  EXCEPTION WHEN check_violation THEN
    err := SQLERRM;
    IF err NOT LIKE '%link_types_object_backed_cardinality%' THEN
      RAISE EXCEPTION 'the cardinality CHECK should answer first, got: %', err;
    END IF;
  END;

  -- the edges CHECK answers for their absence
  BEGIN
    INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                   api_name, label, cardinality, backing_kind, backing_object_type_id)
    VALUES (ont, proj, ta, tb, 'm766-bare', 'M766 bare', 'many_to_one', 'object_backed', tb);
    RAISE EXCEPTION 'an object-backed link without edges should be refused';
  EXCEPTION WHEN check_violation THEN
    err := SQLERRM;
    IF err NOT LIKE '%link_types_object_backed_edges%' THEN
      RAISE EXCEPTION 'the edges CHECK should answer for missing edges, got: %', err;
    END IF;
  END;

  -- and the trigger still answers for the edges themselves. A real link type
  -- is needed to reach it: the foreign key on source_edge_link_type_id is an
  -- AFTER trigger too, and Postgres fires the internal RI ones first.
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality)
  VALUES (ont, proj, ta, tb, 'm766-plain', 'M766 plain', 'many_to_one') RETURNING id INTO plain;
  BEGIN
    INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                   api_name, label, cardinality, backing_kind, backing_object_type_id,
                                   source_edge_link_type_id, target_edge_link_type_id)
    VALUES (ont, proj, ta, tb, 'm766-ghost', 'M766 ghost', 'many_to_one', 'object_backed', tb,
            plain, plain);
    RAISE EXCEPTION 'an edge that is not a foreign-key link should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Ontology:LinkEdgeNotForeignKey%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION USING errcode = 'P0766', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0766' THEN
  NULL;
END $$;
