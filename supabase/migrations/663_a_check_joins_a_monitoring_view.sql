-- The half of the view's definition 661 left unreachable:
--
--   "Monitoring views are a collection of monitoring rules and health checks."
--   — monitoring-views/overview.md
--
-- Checks join a view by selection in the Data Health application:
--
--   "In the resource selection dialog, select multiple datasets and choose the existing health checks you want to add to the monitoring view."
--   — monitoring-views/overview.md
--
--   "The selected health checks are grouped in the monitoring view."
--   — monitoring-views/overview.md
--
-- One view per check, mirroring the upgrade path's one-to-one:
--
--   "Each check group can be linked to a single monitoring view and vice versa; therefore, you can only upgrade one check group to a single existing monitoring view, or create a new monitoring view if a suitable one does not exist."
--   — monitoring-views/overview.md
--
-- Who may link is INFERENCE: the page shows the action inside the Data Health
-- app without naming a permission, so linking rides the check's own UPDATE
-- policy (editors of the check's target), and a guard makes the named view
-- visible to the caller — SECURITY INVOKER on purpose, so "visible" is
-- visible to the person linking.

ALTER TABLE public.health_checks
  ADD COLUMN monitoring_view_id uuid REFERENCES public.monitoring_views(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.health_checks.monitoring_view_id IS
  'The monitoring view this check is grouped into, if any (monitoring-views/overview: a view collects monitoring rules and health checks). One view per check.';

CREATE INDEX health_checks_monitoring_view ON public.health_checks (monitoring_view_id);

CREATE FUNCTION public.guard_check_view_link() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.monitoring_view_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.monitoring_views v WHERE v.id = NEW.monitoring_view_id) THEN
    RAISE EXCEPTION 'Monitoring:ViewNotVisible — the monitoring view must be visible to whoever links a check to it';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_check_view_link BEFORE INSERT OR UPDATE OF monitoring_view_id ON public.health_checks
FOR EACH ROW EXECUTE FUNCTION public.guard_check_view_link();

-- Proved by doing: a visible view links, an invisible one refuses.
DO $$
DECLARE
  v_org uuid; v_usr uuid; v_email text; v_sp uuid; v_proj uuid; v_ds uuid;
  v_view uuid; v_chk uuid;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe663') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe663') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe663', 'Probe663') RETURNING id INTO v_proj;
    v_usr := gen_random_uuid();
    v_email := 'probe663-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe663', 'Probe663') RETURNING id INTO v_ds;

    SET LOCAL ROLE authenticated;
    INSERT INTO public.monitoring_views (organization_id, project_id, name)
      VALUES (v_org, v_proj, 'Probe663 view') RETURNING id INTO v_view;
    INSERT INTO public.health_checks (dataset_id, check_type, config)
      VALUES (v_ds, 'row_count', '{"threshold": {"op": "gte", "value": 1}}')
      RETURNING id INTO v_chk;

    UPDATE public.health_checks SET monitoring_view_id = v_view WHERE id = v_chk;
    IF NOT EXISTS (SELECT 1 FROM public.health_checks
                    WHERE id = v_chk AND monitoring_view_id = v_view) THEN
      RAISE EXCEPTION 'the check did not join the visible view';
    END IF;

    BEGIN
      UPDATE public.health_checks SET monitoring_view_id = gen_random_uuid() WHERE id = v_chk;
      RAISE EXCEPTION 'a link to an invisible view was admitted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Monitoring:ViewNotVisible%' THEN RAISE; END IF;
    END;
    RESET ROLE;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '663 proved: a check joins a visible monitoring view, and a link to an invisible one is refused by name';
  END;
END $$;
