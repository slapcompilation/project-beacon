-- A deprecated action documents itself, like every other deprecated resource.
--
--   "Every object type, property, link type, action, or interface in the
--    Ontology has a status" — and for deprecated:
--   "A deprecated resource also has metadata that includes: A description for
--    why it is being deprecated; A deadline for when it is expected to be
--    deleted from the system; and The resource that is meant to replace the
--    one that is deprecated."       (object-link-types/metadata-statuses)
--
-- object_types, link_types and ontology_interfaces carry the trio; action
-- types had the status without the metadata — the asymmetry the regression
-- suite recorded. Same columns, same documented-deprecation CHECK, verbatim.

ALTER TABLE public.action_types
  ADD COLUMN deprecation_reason   text,
  ADD COLUMN deprecation_deadline date,
  ADD COLUMN replaced_by          text,
  ADD CONSTRAINT action_types_deprecation_documented CHECK (
    status <> 'deprecated'
    OR (deprecation_reason IS NOT NULL
        AND btrim(deprecation_reason) <> ''
        AND deprecation_deadline IS NOT NULL));

COMMENT ON COLUMN public.action_types.deprecation_reason IS
  '"Fill out a description for why it is being deprecated" — required to enter the deprecated status.';
COMMENT ON COLUMN public.action_types.deprecation_deadline IS
  '"A deadline for when it is expected to be deleted from the system" — required with the reason.';
COMMENT ON COLUMN public.action_types.replaced_by IS
  '"Optionally, select a resource that is meant to replace the one you are deprecating."';

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; a uuid; usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('dep-456') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','dep456@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'dep456@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Dep456');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'dep456', 'Dep 456', false) RETURNING id INTO ont;
  INSERT INTO public.action_types (ontology_id, api_name, label)
  VALUES (ont, 'dep456-probe', 'Probe') RETURNING id INTO a;

  -- Undocumented deprecation refuses.
  BEGIN
    UPDATE public.action_types SET status = 'deprecated' WHERE id = a;
    RAISE EXCEPTION 'assertion failed: an undocumented deprecation should refuse';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Documented, it lands.
  UPDATE public.action_types
     SET status = 'deprecated',
         deprecation_reason = 'Replaced by a better one',
         deprecation_deadline = current_date + 30,
         replaced_by = 'dep456-successor'
   WHERE id = a;
  IF (SELECT status FROM public.action_types WHERE id = a) <> 'deprecated' THEN
    RAISE EXCEPTION 'assertion failed: the documented deprecation did not land';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
