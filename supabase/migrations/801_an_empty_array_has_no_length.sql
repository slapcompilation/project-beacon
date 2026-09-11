-- 801 — an empty array has no length, and a CHECK passes on NULL
--
-- 800's own test caught this within the hour, which is the only good thing to
-- say about it. `automation_effects_group_properties_nonempty` was written as
--
--   array_length(group_by_properties, 1) >= 1
--
-- and `array_length` of an EMPTY array is NULL, not 0. NULL >= 1 is NULL, a
-- CHECK passes on NULL, and so an effect could be configured to group by no
-- properties at all — which would then group every object into one group and
-- silently behave as `once_for_all` while claiming to be `once_per_group`.
--
-- THE FOURTH APPEARANCE OF THE SAME SHAPE, and the first where the previous
-- three were already written down when I wrote it:
--
--   * 391, a DECIMAL with no precision riding through a schema validator,
--     because `jsonb_typeof` of a missing key is NULL.
--   * 794, a notification effect with no recipients, for exactly that reason,
--     fixed in the same file that introduced it.
--   * 797, the payload CHECK whose ELSE arm returned NULL, so any new
--     data_kind could have carried any payload.
--   * this one.
--
-- The pattern is not really about arrays or about jsonb. It is that SQL's
-- three-valued logic makes "not obviously true" and "false" look identical
-- inside a CHECK, and every one of these was written by reaching for the
-- natural expression instead of the total one. The habit that prevents it is
-- to write the NULL case explicitly — coalesce, or IS NOT TRUE — whenever a
-- constraint touches something that can be absent.
--
-- Nothing is stored wrongly today: the constraint has existed for minutes and
-- no automation effect uses grouping. Corrected forward because 800 is applied.

BEGIN;

ALTER TABLE public.automation_effects
  DROP CONSTRAINT automation_effects_group_properties_nonempty;

ALTER TABLE public.automation_effects
  ADD CONSTRAINT automation_effects_group_properties_nonempty
  CHECK (group_by_properties IS NULL
     OR coalesce(array_length(group_by_properties, 1), 0) >= 1);

COMMENT ON CONSTRAINT automation_effects_group_properties_nonempty ON public.automation_effects IS
  'Grouping names at least one property. coalesce, not a bare comparison: array_length of an EMPTY array is NULL rather than 0, and a CHECK passes on NULL — so the first form of this constraint let an effect group by nothing, which behaves as once_for_all while claiming to be once_per_group.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE
  org uuid; usr uuid; sp uuid; proj uuid; ont uuid; ot uuid; oset uuid;
  auto uuid; act uuid; setpar uuid; eff uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m801 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm801-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm801-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M801 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m801proj', 'm801proj', sp, org) RETURNING id INTO proj;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = sp;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M801Ticket', 'Ticket') RETURNING id INTO ot;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ot, 'pk', 'Pk', 'pk', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, position)
  VALUES (ot, 'category', 'Category', 'category', 'string', 'column', 'category', 1);
  INSERT INTO public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
  VALUES ('M801 set', 'm801_set', ot, proj, ont, '[]'::jsonb) RETURNING id INTO oset;
  INSERT INTO public.automations (project_id, display_name, owner_id, condition)
  VALUES (proj, 'M801 watch', usr,
          jsonb_build_object('type', 'objects_added', 'object_set_id', oset))
  RETURNING id INTO auto;
  INSERT INTO public.action_types (ontology_id, project_id, api_name, label, automate_can_submit)
  VALUES (ont, proj, 'm801-act', 'Act', true) RETURNING id INTO act;
  INSERT INTO public.action_type_parameters
    (action_type_id, api_name, display_name, data_kind, object_type_id, position)
  VALUES (act, 'targets', 'Targets', 'objectSet', ot, 0) RETURNING id INTO setpar;

  -- The exact row 800 accepted and should not have.
  BEGIN
    INSERT INTO public.automation_effects
      (automation_id, position, kind, action_type_id, object_set_parameter_id,
       execution_mode, group_by_properties)
    VALUES (auto, 0, 'action', act, setpar, 'once_per_group', ARRAY[]::text[]);
    RAISE EXCEPTION 'grouping by no properties at all was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- And one property is still enough.
  INSERT INTO public.automation_effects
    (automation_id, position, kind, action_type_id, object_set_parameter_id,
     execution_mode, group_by_properties)
  VALUES (auto, 0, 'action', act, setpar, 'once_per_group', ARRAY['category'])
  RETURNING id INTO eff;

  DELETE FROM public.automation_effects WHERE automation_id = auto;
  DELETE FROM public.automations WHERE project_id = proj;
  DELETE FROM public.action_type_parameters WHERE action_type_id = act;
  DELETE FROM public.action_types WHERE id = act;
  DELETE FROM public.object_sets WHERE project_id = proj;
  DELETE FROM public.object_type_properties WHERE object_type_id = ot;
  DELETE FROM public.object_types WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE space_id = sp;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  RAISE NOTICE '801 proved: an empty grouping list is refused, and a one-property list is not';
END $do$;

COMMIT;
