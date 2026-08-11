-- A link type follows its object types' statuses.
--
--   "The Ontology Manager ensures status consistency between an object type
--    and its related properties or link types."
--   "If at least one object type in a link type is changed to `experimental`,
--    the link type will automatically be changed to `experimental`."
--   "If at least one object type in a link type is changed to `example`, the
--    link type will automatically be changed to `example`."
--   "If at least one object type in a link type is changed to `deprecated`,
--    the link type will automatically be changed to `deprecated`."
--                                       (object-link-types/metadata-statuses)
--
-- And the matrix under those bullets says which statuses a link may HOLD:
-- any endpoint deprecated → deprecated only; any endpoint experimental →
-- experimental only; both active → "can be experimental, active, or
-- deprecated". Promoted is treated as active here — it is the trust status
-- above active, and the matrix does not row it (INFERENCE, marked).
--
-- OUT OF SCOPE, recorded: the same page couples PROPERTY statuses to object
-- types and to foreign-key links ("all of its properties will be marked
-- experimental as well") — object_type_properties carries no status column
-- yet, so that half cannot be built without inventing the column's shape.

-- ── the cascade ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cascade_status_to_link_types()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('experimental','example') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.link_types lt
       SET status = NEW.status
     WHERE (lt.source_object_type_id = NEW.id OR lt.target_object_type_id = NEW.id)
       AND lt.status IS DISTINCT FROM NEW.status;
  END IF;
  -- A deprecated link must document itself, so the cascade carries the
  -- object type's own reason and deadline down.
  IF NEW.status = 'deprecated' AND OLD.status IS DISTINCT FROM 'deprecated' THEN
    UPDATE public.link_types lt
       SET status = 'deprecated',
           deprecation_reason = coalesce(lt.deprecation_reason,
             format('Object type %s is deprecated', NEW.api_name)),
           deprecation_deadline = coalesce(lt.deprecation_deadline, NEW.deprecation_deadline)
     WHERE (lt.source_object_type_id = NEW.id OR lt.target_object_type_id = NEW.id)
       AND lt.status IS DISTINCT FROM 'deprecated';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cascade_status_to_link_types
  AFTER UPDATE OF status ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.cascade_status_to_link_types();

-- ── the matrix ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_link_type_status()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE a text; b text; allowed text[];
BEGIN
  SELECT status INTO a FROM public.object_types WHERE id = NEW.source_object_type_id;
  SELECT status INTO b FROM public.object_types WHERE id = NEW.target_object_type_id;
  allowed := CASE
    WHEN 'deprecated' IN (a, b)   THEN ARRAY['deprecated']
    WHEN 'experimental' IN (a, b) THEN ARRAY['experimental']
    WHEN 'example' IN (a, b)      THEN ARRAY['example']
    ELSE ARRAY['experimental','active','deprecated']
  END;
  IF NEW.status <> ALL (allowed) THEN
    RAISE EXCEPTION 'Ontology:LinkStatusDisagrees — a link between % and % object types may only be %',
      a, b, array_to_string(allowed, ' or ')
      USING HINT = 'The link type''s status follows its object types. Change theirs first.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_link_type_status
  BEFORE INSERT OR UPDATE OF status ON public.link_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_link_type_status();

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid;
  ta uuid; tb uuid; lt uuid; usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('cas-457') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','cas457@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'cas457@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Cas457');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'cas457', 'Cas 457', false) RETURNING id INTO ont;
  INSERT INTO public.object_types (ontology_id, api_name, label, status)
  VALUES (ont, 'Cas457A', 'A', 'active') RETURNING id INTO ta;
  INSERT INTO public.object_types (ontology_id, api_name, label, status)
  VALUES (ont, 'Cas457B', 'B', 'active') RETURNING id INTO tb;
  INSERT INTO public.link_types (ontology_id, api_name, label, source_object_type_id, target_object_type_id, status)
  VALUES (ont, 'cas457_ab', 'A to B', ta, tb, 'active') RETURNING id INTO lt;

  -- Both endpoints active: the link may be active. One endpoint experimental:
  -- the cascade pulls the link along.
  UPDATE public.object_types SET status = 'experimental' WHERE id = ta;
  IF (SELECT status FROM public.link_types WHERE id = lt) <> 'experimental' THEN
    RAISE EXCEPTION 'assertion failed: the link did not follow its object type to experimental';
  END IF;

  -- The matrix refuses activating a link whose endpoint is experimental.
  BEGIN
    UPDATE public.link_types SET status = 'active' WHERE id = lt;
    RAISE EXCEPTION 'assertion failed: the matrix should refuse active here';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%LinkStatusDisagrees%' THEN RAISE; END IF;
  END;

  -- Deprecating an endpoint deprecates the link, documented.
  UPDATE public.object_types
     SET status = 'deprecated', deprecation_reason = 'Retired', deprecation_deadline = current_date + 30
   WHERE id = ta;
  IF (SELECT status FROM public.link_types WHERE id = lt) <> 'deprecated'
     OR (SELECT deprecation_reason FROM public.link_types WHERE id = lt) IS NULL THEN
    RAISE EXCEPTION 'assertion failed: the link did not follow its object type into documented deprecation';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
