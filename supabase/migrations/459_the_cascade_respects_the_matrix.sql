-- The cascade respects the matrix.
--
-- 457's cascade pulled a link to experimental/example whenever one endpoint
-- turned; but the matrix says a link with ANY deprecated endpoint is
-- "deprecated only" (object-link-types/metadata-statuses, the table). The
-- regression suite caught the collision on its first run: turning B example
-- while A is deprecated asked the link to hold a status the guard rightly
-- refuses. Deprecated wins; the pulls skip links with a deprecated endpoint.
-- Same rule for the foreign-key property cascade from 458.

CREATE OR REPLACE FUNCTION public.cascade_status_to_link_types()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('experimental','example') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.link_types lt
       SET status = NEW.status
     WHERE (lt.source_object_type_id = NEW.id OR lt.target_object_type_id = NEW.id)
       AND lt.status IS DISTINCT FROM NEW.status
       AND NOT EXISTS (
         SELECT 1 FROM public.object_types o
          WHERE o.id IN (lt.source_object_type_id, lt.target_object_type_id)
            AND o.status = 'deprecated');
  END IF;
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

CREATE OR REPLACE FUNCTION public.cascade_property_status_to_link_types()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('experimental','example') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.link_types lt
       SET status = NEW.status
     WHERE lt.backing_object_type_id = NEW.object_type_id
       AND lt.backing_column = NEW.backing_column
       AND lt.status IS DISTINCT FROM NEW.status
       AND lt.status IS DISTINCT FROM 'deprecated'
       AND NOT EXISTS (
         SELECT 1 FROM public.object_types o
          WHERE o.id IN (lt.source_object_type_id, lt.target_object_type_id)
            AND o.status = 'deprecated');
  END IF;
  IF NEW.status = 'deprecated' AND OLD.status IS DISTINCT FROM 'deprecated' THEN
    UPDATE public.link_types lt
       SET status = 'deprecated',
           deprecation_reason = coalesce(lt.deprecation_reason,
             format('Foreign key property %s is deprecated', NEW.api_name)),
           deprecation_deadline = coalesce(lt.deprecation_deadline, NEW.deprecation_deadline)
     WHERE lt.backing_object_type_id = NEW.object_type_id
       AND lt.backing_column = NEW.backing_column
       AND lt.status IS DISTINCT FROM 'deprecated';
  END IF;
  RETURN NEW;
END $$;

-- ── assertion, as authenticated: the collision that found this ──────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; ta uuid; tb uuid; lt uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('mtx-459') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','mtx459@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'mtx459@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Mtx459');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'mtx459', 'Mtx 459', false) RETURNING id INTO ont;
  INSERT INTO public.object_types (ontology_id, api_name, label, status)
  VALUES (ont, 'Mtx459A', 'A', 'active') RETURNING id INTO ta;
  INSERT INTO public.object_types (ontology_id, api_name, label, status)
  VALUES (ont, 'Mtx459B', 'B', 'active') RETURNING id INTO tb;
  INSERT INTO public.link_types
    (ontology_id, api_name, label, source_object_type_id, target_object_type_id, status)
  VALUES (ont, 'mtx459_ab', 'A to B', ta, tb, 'active') RETURNING id INTO lt;

  UPDATE public.object_types
     SET status = 'deprecated', deprecation_reason = 'Retired', deprecation_deadline = current_date + 30
   WHERE id = ta;

  -- B turning example must leave the deprecated link deprecated, not raise.
  UPDATE public.object_types SET status = 'example' WHERE id = tb;
  IF (SELECT status FROM public.link_types WHERE id = lt) <> 'deprecated' THEN
    RAISE EXCEPTION 'assertion failed: deprecated must win over the example pull';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
