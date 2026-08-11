-- Ontology resources live in projects, and the project decides who sees and
-- edits them. Ontology-level roles survive for ontology-wide acts.
--
--   "The permissions to view, edit, and manage ontology resources are managed
--    through Compass, the Palantir platform's filesystem. Ontology resources
--    are saved into a project, and the selected project determines who can
--    view, edit, and manage them."   (object-permissioning/ontology-permissions)
--
--   "This project-based permissions approach replaces the previous permission
--    models: ontology roles and datasource-derived permissions."
--
--   "Additional privacy controls: Hide sensitive ontology resources by
--    applying a marking or by placing them in a project where the user lacks
--    a role grant."
--
--   "If you are an Editor in project A, you can edit the Building object type."
--
-- The legacy vocabulary, verbatim from the same page's table — "Ontology
-- `viewer`, Ontology `editor`, and Ontology `owner`" — is not dead: the
-- statuses page still requires it for promotion ("Only users with the
-- Ontology Owner role on the ontology level can directly apply the `promoted`
-- status"), and this very page has "an ontology owner must enable the
-- capability manually". So ONTOLOGY-WIDE acts read ontology_role_grants;
-- per-RESOURCE acts read the project.
--
--   "This capability is enabled for new ontologies."
--
-- — hence `require_resources_in_project` defaults true, and the toggle the
-- page names ("The Require new ontology resources be saved in a project
-- toggle in Ontology configuration") is that column, flippable only by an
-- ontology owner.
--
-- ── SCOPE, stated ──────────────────────────────────────────────────────────
-- Built here: the project column on the five placeable resource kinds
-- (type_groups already carry one), the toggle with its enforcement, the
-- project-lack HIDES rule on every resource SELECT, project-Editor write
-- allowance on the resource write policies, the ontology roles table, and the
-- promotion gate. Recorded, not built: datasource-derived permissions (the
-- other legacy model), CBAC file classifications, and the migration wizard
-- (ontology-manager/migrate-to-project-based-permissions is mirrored and
-- unconsumed).

-- ── the placement ───────────────────────────────────────────────────────────
ALTER TABLE public.object_types       ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT;
ALTER TABLE public.link_types         ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT;
ALTER TABLE public.shared_properties  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT;
ALTER TABLE public.ontology_interfaces ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT;
ALTER TABLE public.action_types       ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT;

ALTER TABLE public.ontologies
  ADD COLUMN require_resources_in_project boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ontologies.require_resources_in_project IS
  'The Ontology configuration toggle: "Require new ontology resources be saved in a project". Enabled for new ontologies; flipping it is an ontology-owner act.';

-- ── ontology-level roles: the surviving vocabulary ─────────────────────────
CREATE TABLE public.ontology_role_grants (
  ontology_id uuid NOT NULL REFERENCES public.ontologies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('viewer','editor','owner')),
  granted_at  timestamptz NOT NULL DEFAULT now(),
  granted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (ontology_id, user_id)
);

COMMENT ON TABLE public.ontology_role_grants IS
  '"Ontology viewer, Ontology editor, and Ontology owner" — the ontology-level roles. Per-resource permissions moved to projects; these govern ontology-WIDE acts: applying promoted, and Ontology configuration.';

ALTER TABLE public.ontology_role_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read grants in scope" ON public.ontology_role_grants
  FOR SELECT USING (public.auth_in_ontology(ontology_id));
CREATE POLICY "admins grant ontology roles" ON public.ontology_role_grants
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin'])
                 AND public.auth_member_of_ontology(ontology_id))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin'])
              AND public.auth_member_of_ontology(ontology_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ontology_role_grants TO authenticated;

CREATE OR REPLACE FUNCTION public.ontology_role(p_ontology uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.ontology_role_grants
   WHERE ontology_id = p_ontology AND user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.ontology_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ontology_role(uuid) TO authenticated;

-- ── the toggle enforces on create ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_resource_placement()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NULL
     AND (SELECT require_resources_in_project FROM public.ontologies
           WHERE id = NEW.ontology_id) THEN
    RAISE EXCEPTION 'Ontology:ResourceNeedsAProject — this ontology requires new resources be saved in a project'
      USING HINT = 'Pick a project, or an ontology owner can disable the toggle in Ontology configuration.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_object_type_placement    BEFORE INSERT ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_resource_placement();
CREATE TRIGGER guard_link_type_placement      BEFORE INSERT ON public.link_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_resource_placement();
CREATE TRIGGER guard_shared_property_placement BEFORE INSERT ON public.shared_properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_resource_placement();
CREATE TRIGGER guard_interface_placement      BEFORE INSERT ON public.ontology_interfaces
  FOR EACH ROW EXECUTE FUNCTION public.guard_resource_placement();
CREATE TRIGGER guard_action_type_placement    BEFORE INSERT ON public.action_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_resource_placement();

-- Flipping the toggle is an ontology-owner act ("an ontology owner must
-- enable the capability manually").
CREATE OR REPLACE FUNCTION public.guard_ontology_configuration()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.require_resources_in_project IS DISTINCT FROM OLD.require_resources_in_project
     AND coalesce(public.ontology_role(NEW.id), '') <> 'owner' THEN
    RAISE EXCEPTION 'Ontology:OwnerOnly — Ontology configuration is an ontology owner''s to change';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_ontology_configuration
  BEFORE UPDATE OF require_resources_in_project ON public.ontologies
  FOR EACH ROW EXECUTE FUNCTION public.guard_ontology_configuration();

-- ── promotion is the owner's, directly ─────────────────────────────────────
--   "Only users with the Ontology Owner role on the ontology level can
--    directly apply the `promoted` status. Other users must submit a proposal
--    for review and approval" — the proposal path is 420's machinery and is
--    recorded, not wired, here.
CREATE OR REPLACE FUNCTION public.guard_promotion()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'promoted' AND OLD.status IS DISTINCT FROM 'promoted'
     AND coalesce(public.ontology_role(NEW.ontology_id), '') <> 'owner' THEN
    RAISE EXCEPTION 'Ontology:PromotionIsOwnerOnly — only users with the Ontology Owner role on the ontology level can directly apply the promoted status'
      USING HINT = 'Submit a proposal for review by an Ontology Owner instead.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_promotion
  BEFORE UPDATE OF status ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_promotion();

-- ── placement hides, and the project's Editor writes ───────────────────────
-- "Hide sensitive ontology resources… by placing them in a project where the
-- user lacks a role grant": a placed resource needs ANY project role to see.
-- "If you are an Editor in project A, you can edit the Building object type":
-- the write policies gain the project Editor beside the org admin.
CREATE OR REPLACE FUNCTION public.can_see_placed(p_project uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT p_project IS NULL OR public.project_role(p_project) IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.can_see_placed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_placed(uuid) TO authenticated;

DROP POLICY "read object types in scope" ON public.object_types;
CREATE POLICY "read object types in scope" ON public.object_types
  FOR SELECT USING (public.auth_in_ontology(ontology_id) AND public.can_see_placed(project_id));
DROP POLICY "admins update object types" ON public.object_types;
CREATE POLICY "admins update object types" ON public.object_types
  FOR UPDATE USING (public.auth_member_of_ontology(ontology_id)
    AND (public.auth_role() = ANY (ARRAY['owner','admin'])
         OR public.has_resource_role('object_type', id, 'editor')
         OR public.project_role(project_id) = ANY (ARRAY['owner','editor'])));

DROP POLICY "read link types in scope" ON public.link_types;
CREATE POLICY "read link types in scope" ON public.link_types
  FOR SELECT USING (public.auth_in_ontology(ontology_id) AND public.can_see_placed(project_id));
DROP POLICY "admins update link types" ON public.link_types;
CREATE POLICY "admins update link types" ON public.link_types
  FOR UPDATE USING (public.auth_member_of_ontology(ontology_id)
    AND (public.auth_role() = ANY (ARRAY['owner','admin'])
         OR public.project_role(project_id) = ANY (ARRAY['owner','editor'])));

DROP POLICY "members read shared properties" ON public.shared_properties;
CREATE POLICY "members read shared properties" ON public.shared_properties
  FOR SELECT USING (public.auth_in_ontology(ontology_id) AND public.can_see_placed(project_id));

DROP POLICY "members read interfaces in scope" ON public.ontology_interfaces;
CREATE POLICY "members read interfaces in scope" ON public.ontology_interfaces
  FOR SELECT USING (public.auth_in_ontology(ontology_id) AND public.can_see_placed(project_id));

DROP POLICY "read action types in scope" ON public.action_types;
CREATE POLICY "read action types in scope" ON public.action_types
  FOR SELECT USING (public.auth_in_ontology(ontology_id) AND public.can_see_placed(project_id));

-- ── the stagers carry the placement ────────────────────────────────────────
-- save_object_type / save_link_type / save_shared_property / save_action_type /
-- save_interface each pass an optional project_id through their fields; the
-- generic save arm casts it via ontology_column_type, and the object-type and
-- action-type writers need it added explicitly.
DO $$
DECLARE def text; fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['save_object_type(jsonb,jsonb)','save_link_type(jsonb)',
                            'save_shared_property(jsonb)','save_action_type(jsonb)',
                            'save_interface(jsonb)'] LOOP
    def := pg_get_functiondef(('public.' || fn)::regprocedure);
    IF def NOT LIKE '%''ontology_id'',%' AND def NOT LIKE '%ontology_id%' THEN
      RAISE EXCEPTION '% has drifted — wire project placement by hand', fn;
    END IF;
    -- Every stager builds `fields` with jsonb_strip_nulls(jsonb_build_object(…))
    -- exactly once; that opening is the safe needle. ('api_name', is NOT — it
    -- also matches the value expression ->>'api_name', which is how the first
    -- version of this patch built a jsonb with a null key.)
    IF def NOT LIKE '%jsonb_strip_nulls(jsonb_build_object(%' THEN
      RAISE EXCEPTION '% has drifted — wire project placement by hand', fn;
    END IF;
    def := replace(def,
      'jsonb_strip_nulls(jsonb_build_object(',
      'jsonb_strip_nulls(jsonb_build_object(''project_id'', ' ||
      CASE WHEN fn LIKE 'save_object_type%' THEN 'p_object_type'
           WHEN fn LIKE 'save_link_type%' THEN 'p_link'
           WHEN fn LIKE 'save_shared_property%' THEN 'p_property'
           WHEN fn LIKE 'save_action_type%' THEN 'p_action'
           ELSE 'p_interface' END
      || '->>''project_id'', ');
    EXECUTE def;
  END LOOP;
END $$;

-- apply_object_type and apply_interface insert named columns; they gain the
-- placement column via the same needle-asserted patch.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.apply_object_type(jsonb,jsonb,jsonb)'::regprocedure);
  IF def NOT LIKE '%INSERT INTO public.object_types (id, ontology_id, api_name, label, icon, description)%' THEN
    RAISE EXCEPTION 'apply_object_type has drifted — wire placement by hand';
  END IF;
  def := replace(def,
    'INSERT INTO public.object_types (id, ontology_id, api_name, label, icon, description)',
    'INSERT INTO public.object_types (id, ontology_id, project_id, api_name, label, icon, description)');
  def := replace(def,
    'coalesce(ont, public.default_ontology()),',
    'coalesce(ont, public.default_ontology()),
            nullif(p_object_type->>''project_id'','''')::uuid,');
  EXECUTE def;

  def := pg_get_functiondef('public.apply_interface(jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  IF def NOT LIKE '%INSERT INTO public.ontology_interfaces (id, ontology_id, api_name, label, description, icon, searchable)%' THEN
    RAISE EXCEPTION 'apply_interface has drifted — wire placement by hand';
  END IF;
  def := replace(def,
    'INSERT INTO public.ontology_interfaces (id, ontology_id, api_name, label, description, icon, searchable)',
    'INSERT INTO public.ontology_interfaces (id, ontology_id, project_id, api_name, label, description, icon, searchable)');
  def := replace(def,
    'coalesce(nullif(p_interface->>''ontology_id'','''')::uuid, public.default_ontology()),',
    'coalesce(nullif(p_interface->>''ontology_id'','''')::uuid, public.default_ontology()),
            nullif(p_interface->>''project_id'','''')::uuid,');
  EXECUTE def;

  def := pg_get_functiondef('public.apply_action_type(jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  IF def NOT LIKE '%INSERT INTO public.action_types (id, ontology_id, api_name, label, description)%' THEN
    RAISE EXCEPTION 'apply_action_type has drifted — wire placement by hand';
  END IF;
  def := replace(def,
    'INSERT INTO public.action_types (id, ontology_id, api_name, label, description)',
    'INSERT INTO public.action_types (id, ontology_id, project_id, api_name, label, description)');
  def := replace(def,
    'coalesce(nullif(p_action->>''ontology_id'','''')::uuid, public.default_ontology()),',
    'coalesce(nullif(p_action->>''ontology_id'','''')::uuid, public.default_ontology()),
            nullif(p_action->>''project_id'','''')::uuid,');
  EXECUTE def;
END $$;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; hidden_proj uuid; ds uuid; br uuid; t uuid;
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('roles-454') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (ua,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a454@beacon.test'),
    (ub,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','b454@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (ua,'a454@beacon.test','admin',org), (ub,'b454@beacon.test','admin',org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', ua::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS454');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws454', 'WS 454') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws454', 'WS454') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, ua, 'owner', org);
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'r454', 'r454') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;

  -- 1. The toggle is on for a new ontology, so a project-less create refuses.
  BEGIN
    t := public.save_object_type(
      jsonb_build_object('api_name','Loose','label','Loose','ontology_id', ont::text), NULL);
    PERFORM public.save_working_state();
    RAISE EXCEPTION 'a resource landed outside a project with the toggle on';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%ResourceNeedsAProject%' THEN RAISE; END IF;
  END;
  PERFORM public.discard_working_state();

  -- 2. Placed, it lands.
  t := public.save_object_type(
    jsonb_build_object('api_name','Placed','label','Placed','ontology_id', ont::text,
      'project_id', proj::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','k','display_name','K','api_name','k',
      'base_type','string','source','column','backing_column','k',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
  IF (SELECT project_id FROM public.object_types WHERE id = t) <> proj THEN
    RAISE EXCEPTION 'the placement did not land';
  END IF;

  -- 3. Placement hides: a same-org member with no role in the project cannot
  --    see the resource.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', ub::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.object_types WHERE id = t;
  IF n <> 0 THEN RAISE EXCEPTION 'a member without a project role saw a placed resource'; END IF;

  -- 4. Granted Viewer, they see it; Viewer does not write.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', ua::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, ub, 'viewer', org);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', ub::text,
      'app_metadata', json_build_object('role','viewer','org_id',org))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.object_types WHERE id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'a project viewer cannot see the placed resource'; END IF;

  -- 5. Promotion is the ontology owner's, directly, and nobody else's.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', ua::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.object_types SET status = 'active' WHERE id = t;
  BEGIN
    UPDATE public.object_types SET status = 'promoted' WHERE id = t;
    RAISE EXCEPTION 'promotion succeeded without the Ontology Owner role';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%PromotionIsOwnerOnly%' THEN RAISE; END IF;
  END;
  INSERT INTO public.ontology_role_grants (ontology_id, user_id, role) VALUES (ont, ua, 'owner');
  UPDATE public.object_types SET status = 'promoted' WHERE id = t;
  IF (SELECT visibility FROM public.object_types WHERE id = t) <> 'prominent' THEN
    RAISE EXCEPTION 'the promotion side-effect was lost';
  END IF;

  -- 6. Ontology configuration is owner-gated the same way.
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  IF (SELECT require_resources_in_project FROM public.ontologies WHERE id = ont) THEN
    RAISE EXCEPTION 'the owner could not flip the toggle';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '454: the project decides who sees and edits; the ontology owner promotes and configures';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
