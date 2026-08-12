-- Two corrections from the 2026-08-12 nightly foundry-gap run, each verified
-- against the live catalog before building (one of the run's own findings was
-- a migration-file misread, so nothing here trusts a file).
--
-- 1. markings.color is INVENTED. "color"/"colour" appear nowhere in
--    security/markings.md or manage-markings.md, and the marking-detail
--    screenshots show a uniform badge. Zero rows carry a value; the one web
--    consumer was a mapper whose output nothing rendered (trimmed in this
--    PR). The teardown rule applies: everything not in the documentation is
--    deleted, and the longer it sits the more likely a surface starts
--    depending on it.
--
-- 2. "Submission criteria do not support attachment and object set
--    parameters. These parameter types are removed from the selection panel."
--                                        (action-types/submission-criteria)
--    Nothing enforced it. Attachment parameters exist here (a base type);
--    object-set parameters do not exist as a parameter kind at all yet, so
--    the enforceable half is the attachment exclusion — the other half
--    arrives with the kind, recorded.

ALTER TABLE public.markings DROP COLUMN color;

-- ── the exclusion, from both directions ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_criteria_parameter()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.action_type_parameters p
              WHERE p.id IN (NEW.parameter_id, NEW.value_parameter_id)
                AND p.base_type = 'attachment') THEN
    RAISE EXCEPTION 'Actions:CriteriaParameterNotSupported — submission criteria do not support attachment and object set parameters';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_criteria_parameter
  BEFORE INSERT OR UPDATE OF parameter_id, value_parameter_id
  ON public.action_type_submission_criteria
  FOR EACH ROW EXECUTE FUNCTION public.guard_criteria_parameter();

-- The same rule when the PARAMETER moves under an existing criterion.
CREATE OR REPLACE FUNCTION public.guard_parameter_base_type_change()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.base_type = 'attachment' AND OLD.base_type IS DISTINCT FROM 'attachment'
     AND EXISTS (SELECT 1 FROM public.action_type_submission_criteria c
                  WHERE NEW.id IN (c.parameter_id, c.value_parameter_id)) THEN
    RAISE EXCEPTION 'Actions:CriteriaParameterNotSupported — submission criteria reference this parameter, and criteria do not support attachment parameters';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_parameter_base_type_change
  BEFORE UPDATE OF base_type ON public.action_type_parameters
  FOR EACH ROW EXECUTE FUNCTION public.guard_parameter_base_type_change();

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; act uuid; pa uuid; ps uuid; crit uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('night-463') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','n463@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'n463@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Night463');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'night463', 'Night 463', false) RETURNING id INTO ont;
  INSERT INTO public.action_types (ontology_id, api_name, label)
  VALUES (ont, 'night463-act', 'Act') RETURNING id INTO act;
  INSERT INTO public.action_type_parameters (action_type_id, api_name, display_name, base_type)
  VALUES (act, 'file', 'File', 'attachment') RETURNING id INTO pa;
  INSERT INTO public.action_type_parameters (action_type_id, api_name, display_name, base_type)
  VALUES (act, 'note', 'Note', 'string') RETURNING id INTO ps;

  -- A criterion may not reference the attachment parameter, on either side.
  BEGIN
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, node_type, template, parameter_id, operator, value_source, static_value)
    VALUES (act, 'condition', 'parameter', pa, 'is set', 'static', '"x"'::jsonb);
    RAISE EXCEPTION 'assertion failed: an attachment parameter criterion should refuse';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%CriteriaParameterNotSupported%' THEN RAISE; END IF;
  END;

  -- A string parameter is fine — and then may not BECOME an attachment while
  -- a criterion references it.
  INSERT INTO public.action_type_submission_criteria
    (action_type_id, node_type, template, parameter_id, operator, value_source, static_value)
  VALUES (act, 'condition', 'parameter', ps, 'is', 'static', '"ok"'::jsonb) RETURNING id INTO crit;
  BEGIN
    UPDATE public.action_type_parameters SET base_type = 'attachment' WHERE id = ps;
    RAISE EXCEPTION 'assertion failed: a referenced parameter must not become an attachment';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%CriteriaParameterNotSupported%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
