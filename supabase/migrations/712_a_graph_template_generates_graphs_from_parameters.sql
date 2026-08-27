-- 712: a graph template generates graphs from parameters.
--
--   "Vertex graph templates are resources that generate graphs with a defined styling based on parameters."
--   — vertex/graphs-template.md
--
--   "Any Vertex analysis can be converted into a graph template."
--   — vertex/graphs-template.md
--
-- OBJECT PARAMETERS are the template's inputs, each carrying Search Arounds:
--
--   "Object parameters are object inputs to your template which will be added to the graph when the template is used. Adding object parameters also allows you to perform Search Arounds and functions on the objects provided by the graph template user."
--   — vertex/graphs-template.md
--
--   "Each object parameter can be associated with Search Arounds, which can be either simple Search Arounds using Ontology links, Search Around functions, or saved Search Arounds which were built using the Search Around sidebar."
--   — vertex/graphs-template.md
--
-- NON-OBJECT PARAMETERS mirror the function argument set:
--
--   "Non-object parameters are additional parameters that can be used as arguments to custom Search Around functions or saved Search Arounds. The supported types for non-object parameters mirror the non-object arguments supported by Search Around functions."
--   — vertex/graphs-template.md
--
--   "When used through the toolbar or right click menus, functions may have additional arguments of type `Integer`, `Double`, `Float`, `string`, `boolean`, `Timestamp` or `Date`."
--   — vertex/generate-graph-functions.md
--
-- The wizard's five steps come off template-configure-parameters.png
-- (Configure parameters / Search Arounds / layers / graph / defaults) —
-- step five and the summary's "Pinned items" have NO prose, so they are one
-- jsonb column named for what the capture shows, not modelled deeper. The
-- object parameter's Single object badge is capture-only too; multiplicity
-- is stored with that provenance recorded. Templates ship via Marketplace
-- "with the exception of saved Search Arounds" (vertex/marketplace-vertex) —
-- confirming the saved Search Around's separateness, which 711 holds.

CREATE TABLE public.vertex_graph_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  description     text NOT NULL DEFAULT '',
  layout          text NOT NULL DEFAULT 'Auto',
  -- step 3: per-layer include-as choice; step 5 + Pinned items: capture-only
  layers          jsonb NOT NULL DEFAULT '[]'::jsonb,
  defaults        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(layers) = 'array'),
  CHECK (jsonb_typeof(defaults) = 'object')
);
CREATE INDEX vx_templates_project_idx ON public.vertex_graph_templates (project_id);
CREATE INDEX vx_templates_org_idx ON public.vertex_graph_templates (organization_id);
CREATE INDEX vx_templates_created_by_idx ON public.vertex_graph_templates (created_by);
COMMENT ON TABLE public.vertex_graph_templates IS
  '"Vertex graph templates are resources that generate graphs with a defined styling based on parameters" (vertex/graphs-template). The wizard''s five steps: parameters and Search Arounds are the two tables below; layers carries step 3''s per-layer Include-as choice; defaults holds step 5 and the summary''s Pinned items — both capture-only (template-configure-parameters.png, template-summary.png), so they are one column, not a model.';

CREATE TABLE public.vertex_template_object_parameters (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid NOT NULL REFERENCES public.vertex_graph_templates(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(btrim(name)) > 0),
  description    text NOT NULL DEFAULT '',
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  required       boolean NOT NULL DEFAULT true,
  -- the capture's Single object badge; the alternative is unnamed anywhere
  single_object  boolean NOT NULL DEFAULT true,
  UNIQUE (template_id, name)
);
CREATE INDEX vx_tpl_obj_params_template_idx ON public.vertex_template_object_parameters (template_id);
CREATE INDEX vx_tpl_obj_params_ot_idx ON public.vertex_template_object_parameters (object_type_id);
COMMENT ON TABLE public.vertex_template_object_parameters IS
  '"Object parameters are object inputs to your template which will be added to the graph when the template is used" (vertex/graphs-template). single_object is the capture''s badge (template-configure-parameters.png); no sentence names the alternative, so the default is what the capture shows.';

CREATE TABLE public.vertex_template_search_arounds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_parameter_id uuid NOT NULL REFERENCES public.vertex_template_object_parameters(id) ON DELETE CASCADE,
  -- the three kinds, in the page's own words: "simple Search Arounds using
  -- Ontology links, Search Around functions, or saved Search Arounds"
  kind                text NOT NULL
                        CONSTRAINT vx_tpl_sa_kind_check
                        CHECK (kind = ANY (ARRAY['relation', 'function', 'saved'])),
  link_type_id        uuid REFERENCES public.link_types(id) ON DELETE CASCADE,
  function_id         uuid REFERENCES public.functions(id) ON DELETE CASCADE,
  search_around_id    uuid REFERENCES public.vertex_search_arounds(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(link_type_id, function_id, search_around_id) = 1),
  CHECK (CASE kind WHEN 'relation' THEN link_type_id IS NOT NULL
                   WHEN 'function' THEN function_id IS NOT NULL
                   ELSE search_around_id IS NOT NULL END)
);
CREATE INDEX vx_tpl_sa_param_idx ON public.vertex_template_search_arounds (object_parameter_id);
CREATE INDEX vx_tpl_sa_lt_idx ON public.vertex_template_search_arounds (link_type_id);
CREATE INDEX vx_tpl_sa_fn_idx ON public.vertex_template_search_arounds (function_id);
CREATE INDEX vx_tpl_sa_saved_idx ON public.vertex_template_search_arounds (search_around_id);
COMMENT ON TABLE public.vertex_template_search_arounds IS
  'One Search Around bound to an object parameter — "either simple Search Arounds using Ontology links, Search Around functions, or saved Search Arounds" (vertex/graphs-template). The wizard menu labels the first kind Relation (template-configure-search-arounds.png), the UI vocabulary for the ontology''s link type. A Search Around function is discovered structurally ("Vertex will discover the Search Around function using the name and structure of its return type", vertex/generate-graph-functions) — here, a functions row.';
COMMENT ON CONSTRAINT vx_tpl_sa_kind_check ON public.vertex_template_search_arounds IS
  'Values from vertex/graphs-template, whose sentence lists the three: simple Search Arounds using Ontology links (the menu''s Relation), Search Around functions, and saved Search Arounds.';

CREATE TABLE public.vertex_template_value_parameters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.vertex_graph_templates(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  param_type  text NOT NULL
                CONSTRAINT vx_tpl_value_type_check
                CHECK (param_type = ANY (ARRAY['Integer', 'Double', 'Float', 'string', 'boolean', 'Timestamp', 'Date'])),
  required    boolean NOT NULL DEFAULT false,
  default_value jsonb,
  UNIQUE (template_id, name)
);
CREATE INDEX vx_tpl_value_params_template_idx ON public.vertex_template_value_parameters (template_id);
COMMENT ON TABLE public.vertex_template_value_parameters IS
  'A non-object parameter — "additional parameters that can be used as arguments to custom Search Around functions or saved Search Arounds" (vertex/graphs-template), whose types "mirror the non-object arguments supported by Search Around functions".';
COMMENT ON CONSTRAINT vx_tpl_value_type_check ON public.vertex_template_value_parameters IS
  'Values from vertex/generate-graph-functions: "functions may have additional arguments of type Integer, Double, Float, string, boolean, Timestamp or Date" — the set graphs-template mirrors by reference, spellings verbatim (the page really mixes cases). The Search Around panel''s own five-type set is the capture-derived cousin on 711''s parameters.';

-- ── instantiation: the template generates a graph ───────────────────────────

CREATE FUNCTION public.create_graph_from_template(p_template uuid, p_project uuid,
                                                  p_name text, p_objects jsonb)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE t record; g uuid; sg uuid; prm record; val jsonb; i integer := 0;
BEGIN
  SELECT * INTO t FROM public.vertex_graph_templates WHERE id = p_template;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Vertex:NoSuchTemplate — % is not a template you can see', p_template;
  END IF;
  SELECT public.create_vertex_graph(p_project, p_name) INTO g;
  SELECT id INTO sg FROM public.vertex_subgraphs WHERE graph_id = g;
  -- "Object parameters are object inputs to your template which will be
  -- added to the graph when the template is used."
  FOR prm IN SELECT * FROM public.vertex_template_object_parameters
              WHERE template_id = p_template LOOP
    val := p_objects -> prm.name;
    IF val IS NULL THEN
      IF prm.required THEN
        RAISE EXCEPTION 'Vertex:ParameterRequired — % has no value', prm.name;
      END IF;
      CONTINUE;
    END IF;
    IF prm.single_object AND jsonb_array_length(val) > 1 THEN
      RAISE EXCEPTION 'Vertex:SingleObjectParameter — % takes a single object', prm.name;
    END IF;
    INSERT INTO public.vertex_graph_nodes (subgraph_id, object_type_id, primary_key, x, y)
    SELECT sg, prm.object_type_id, pk #>> '{}', 0, (i * 80)::double precision
      FROM jsonb_array_elements(val) pk
    ON CONFLICT DO NOTHING;
    i := i + 1;
  END LOOP;
  -- step 3's layer styling travels onto the new graph
  INSERT INTO public.vertex_graph_layers (subgraph_id, object_type_id, link_type_id, style)
  SELECT sg, (l ->> 'object_type_id')::uuid, (l ->> 'link_type_id')::uuid,
         coalesce(l -> 'style', '{}'::jsonb)
    FROM jsonb_array_elements(t.layers) l
   WHERE coalesce(l ->> 'include_as', 'styling') = 'styling';
  RETURN g;
END $$;
COMMENT ON FUNCTION public.create_graph_from_template(uuid, uuid, text, jsonb) IS
  'Using a template: the object parameter values become nodes and the template''s layer styling travels onto the generated graph — "resources that generate graphs with a defined styling based on parameters" (vertex/graphs-template). Executing the bound Search Arounds to EXPAND the generated graph runs through the ontology traversal engine in the surface, the same split as every compiler here. INVOKER.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.vertex_graph_templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertex_template_object_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertex_template_search_arounds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertex_template_value_parameters  ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_read_vx_template(p_template uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vertex_graph_templates t
                  WHERE t.id = p_template
                    AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(t.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_vx_template(p_template uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vertex_graph_templates t
                  WHERE t.id = p_template
                    AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(t.project_id))
                        >= public.role_rank('editor'))
$$;

CREATE POLICY "project members read templates" ON public.vertex_graph_templates
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author templates" ON public.vertex_graph_templates
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read object params" ON public.vertex_template_object_parameters
  FOR SELECT USING ((SELECT public.can_read_vx_template(template_id)));
CREATE POLICY "author object params" ON public.vertex_template_object_parameters
  FOR ALL USING ((SELECT public.can_edit_vx_template(template_id)))
          WITH CHECK ((SELECT public.can_edit_vx_template(template_id)));

CREATE POLICY "read template SAs" ON public.vertex_template_search_arounds
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.vertex_template_object_parameters p
                             WHERE p.id = object_parameter_id
                               AND public.can_read_vx_template(p.template_id)));
CREATE POLICY "author template SAs" ON public.vertex_template_search_arounds
  FOR ALL USING (EXISTS (SELECT 1 FROM public.vertex_template_object_parameters p
                          WHERE p.id = object_parameter_id
                            AND public.can_edit_vx_template(p.template_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vertex_template_object_parameters p
                       WHERE p.id = object_parameter_id
                         AND public.can_edit_vx_template(p.template_id)));

CREATE POLICY "read value params" ON public.vertex_template_value_parameters
  FOR SELECT USING ((SELECT public.can_read_vx_template(template_id)));
CREATE POLICY "author value params" ON public.vertex_template_value_parameters
  FOR ALL USING ((SELECT public.can_edit_vx_template(template_id)))
          WITH CHECK ((SELECT public.can_edit_vx_template(template_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_graph_templates            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_template_object_parameters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_template_search_arounds    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_template_value_parameters  TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ont uuid; ota uuid; lt uuid; otb uuid;
  tpl uuid; prm uuid; g uuid; n integer;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('vx-712') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('vx-712') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
    VALUES (sp, 'vx712', 'VX712', false) RETURNING id INTO ont;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vx712@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'vx712@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'vx_712', 'VX 712') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (ont, 'Delay712', 'Flight delay') RETURNING id INTO ota;
    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (ont, 'Flight712', 'Flight') RETURNING id INTO otb;
    INSERT INTO public.link_types (ontology_id, source_object_type_id, target_object_type_id,
                                   api_name, label, cardinality)
    VALUES (ont, ota, otb, 'delayedFlights', 'Delayed flights', 'one_to_many')
    RETURNING id INTO lt;

    -- 1. A template with an object parameter, a Relation search-around and
    --    a value parameter of the function set.
    INSERT INTO public.vertex_graph_templates (project_id, name, layers)
    VALUES (proj, 'Delay investigation',
      jsonb_build_array(jsonb_build_object('object_type_id', ota, 'include_as', 'styling',
                                           'style', jsonb_build_object('color', '#c87619'))))
    RETURNING id INTO tpl;
    INSERT INTO public.vertex_template_object_parameters
      (template_id, name, description, object_type_id, required, single_object)
    VALUES (tpl, 'Event to investigate', 'Event for which same-day delayed flights will be found',
            ota, true, true)
    RETURNING id INTO prm;
    INSERT INTO public.vertex_template_search_arounds (object_parameter_id, kind, link_type_id)
    VALUES (prm, 'relation', lt);
    INSERT INTO public.vertex_template_value_parameters (template_id, name, param_type, required)
    VALUES (tpl, 'Max # of flights', 'Integer', true);
    BEGIN
      INSERT INTO public.vertex_template_value_parameters (template_id, name, param_type)
      VALUES (tpl, 'Bad', 'Number');
      RAISE EXCEPTION 'a type outside the function set was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.vertex_template_search_arounds (object_parameter_id, kind, function_id)
      VALUES (prm, 'relation', gen_random_uuid());
      RAISE EXCEPTION 'a kind/reference mismatch was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 2. Instantiation: the object value becomes a node, the styling
    --    travels, a required parameter refuses to be absent, and single
    --    object means one.
    SELECT public.create_graph_from_template(tpl, proj, 'Delay 2026-08-27',
      '{"Event to investigate": ["DLY-1"]}'::jsonb) INTO g;
    SELECT count(*) INTO n FROM public.vertex_graph_nodes nd
      JOIN public.vertex_subgraphs sg ON sg.id = nd.subgraph_id
     WHERE sg.graph_id = g AND nd.primary_key = 'DLY-1';
    IF n <> 1 THEN RAISE EXCEPTION 'the object parameter did not become a node'; END IF;
    SELECT count(*) INTO n FROM public.vertex_graph_layers ly
      JOIN public.vertex_subgraphs sg ON sg.id = ly.subgraph_id
     WHERE sg.graph_id = g AND ly.style ->> 'color' = '#c87619';
    IF n <> 1 THEN RAISE EXCEPTION 'the template styling did not travel'; END IF;
    BEGIN
      PERFORM public.create_graph_from_template(tpl, proj, 'No value', '{}'::jsonb);
      RAISE EXCEPTION 'a required parameter went unvalued';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Vertex:ParameterRequired%' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.create_graph_from_template(tpl, proj, 'Two objects',
        '{"Event to investigate": ["DLY-1", "DLY-2"]}'::jsonb);
      RAISE EXCEPTION 'a single-object parameter took two';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Vertex:SingleObjectParameter%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '712 proved, as the caller: a template holds an object parameter with a Relation search-around and a function-set value parameter, refusing a type outside the seven and a kind mismatch; instantiation turns the parameter value into a node and carries the styling; a required parameter refuses to be absent and a single-object one refuses two';
  END;
END $$;
