-- 711: a Vertex graph is materialized objects in sub-graphs, shape shared,
-- data gated.
--
--   "Vertex allows you to visualize and quantify cause and effect across the digital twin of your real-world organization. Using the Vertex toolkit, you can access and explore existing graphs that have been curated and published by your organization or build new system graphs."
--   — vertex/overview.md
--
-- THE GRAPH IS MATERIALIZED, NOT A RECIPE — the adversary pass assembled
-- this from the pages: specific objects as nodes ("Adds all objects in the
-- specified object set as nodes to the graph", vertex/generate-graph-apps),
-- positions ("Graph nodes cannot be re-arranged" in read-only mode), and
-- the Workshop embed's Append on parameter change option, which appends to
-- an existing materialization. And a graph contains SUB-GRAPHS:
--
--   "When embedding an existing graph or diagram resource with multiple sub-graphs, you can choose which sub-graph to display by selecting an object set variable from Workshop that contains any object from that sub-graph."
--   — vertex/embed-graph-workshop.md
--
-- SHARING SHARES THE SHAPE AND NEVER THE DATA:
--
--   "Sharing a graph will not grant users access to any other resources to which a user does not already have access. When opening a graph, if a user does not have access to any objects or time series referenced in the graph due to permissions or deleted data, they will still see the structure and shape of the graph."
--   — vertex/save-share.md
--
-- Here that is RLS composition, not machinery: the node row (type, key,
-- position) is the shape and readers of the graph see it; the property
-- values live in the per-type object tables under their own policies.
--
-- VERSIONS ARE PROSE, not capture: "A full version history can be viewed in
-- the **Graph History** sidebar. Previous versions of the graph can be
-- accessed in read-only mode (the current version number will be visible in
-- the resource header)." (vertex/save-share.md). The branch chip beside the
-- version chip in graph_history.png has NO prose anywhere — recorded, not
-- built.
--
-- SEARCH AROUND is the traversal engine. The wire contract the adversary
-- surfaced makes a step (object set, ONE link type by API name):
--
--   "The name of the link type in the API. To find the API name for your Link Type, check the Ontology Manager application."
--   — api/ontologies-v2-resources-ontology-object-sets-load-object-set.md
--
-- and a saved Search Around is a first-class resource ("If you would like
-- to reuse this Search Around in other graphs or within graph templates,
-- you can save it as a resource.", vertex/explore-object-relationships) —
-- which marketplace-vertex confirms by excluding it from template shipping.
-- The downstream-filter semantics are the semi-join:
--
--   "Once a filter has been applied, the starting object set will be filtered to those objects connected to the filtered resulting object set."
--   — vertex/explore-object-relationships.md
--
-- EXECUTION runs through engines we already have — the ontology package's
-- searchAround (set-to-set traversal) and object_set_where (475) — the
-- definitions live here, the expansion runs there. No Vertex RID is
-- attested; the graph's kind token is INFERENCE, evidenced by the
-- {graphRid} token in vertex/generate-graph-apps' route.

-- ── the graph, a project resource of sub-graphs ─────────────────────────────

CREATE TABLE public.vertex_graphs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- {graphRid} is a route token, so a graph rid EXISTS; its grammar does
  -- not — kind and service are INFERENCE
  rid             text GENERATED ALWAYS AS (public.rid_of('vertex', 'graph', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  description     text NOT NULL DEFAULT '',
  read_only       boolean NOT NULL DEFAULT false,
  trashed_at      timestamptz,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vertex_graphs_rid_key ON public.vertex_graphs (rid);
CREATE INDEX vertex_graphs_project_idx ON public.vertex_graphs (project_id);
CREATE INDEX vertex_graphs_folder_idx ON public.vertex_graphs (folder_id);
CREATE INDEX vertex_graphs_org_idx ON public.vertex_graphs (organization_id);
CREATE INDEX vertex_graphs_created_by_idx ON public.vertex_graphs (created_by);
COMMENT ON TABLE public.vertex_graphs IS
  'A system graph: materialized objects in sub-graphs with layout, layers and versions. Sharing shares the SHAPE — "they will still see the structure and shape of the graph. The user will not see the specific data" (vertex/save-share) — which here is RLS composition: graph readers see node rows; the data behind a node answers to the object tables'' own policies. The RID token is INFERENCE, evidenced only by the {graphRid} route token. The branch chip in graph_history.png has no prose and is recorded, not built.';

CREATE TABLE public.vertex_subgraphs (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id uuid NOT NULL REFERENCES public.vertex_graphs(id) ON DELETE CASCADE,
  name     text NOT NULL DEFAULT 'Subgraph',
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX vertex_subgraphs_graph_idx ON public.vertex_subgraphs (graph_id);
COMMENT ON TABLE public.vertex_subgraphs IS
  'One sub-graph — the navigation unit the Workshop embed selects by containing object ("you can choose which sub-graph to display by selecting an object set variable … that contains any object from that sub-graph", vertex/embed-graph-workshop). A graph cannot be copied as-is into one (questions-answers/vertex).';

CREATE TABLE public.vertex_graph_nodes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subgraph_id    uuid NOT NULL REFERENCES public.vertex_subgraphs(id) ON DELETE CASCADE,
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  -- the specific object, by primary key — a graph holds objects, not a recipe
  primary_key    text NOT NULL,
  x              double precision NOT NULL DEFAULT 0,
  y              double precision NOT NULL DEFAULT 0,
  UNIQUE (subgraph_id, object_type_id, primary_key)
);
CREATE INDEX vertex_graph_nodes_subgraph_idx ON public.vertex_graph_nodes (subgraph_id);
CREATE INDEX vertex_graph_nodes_ot_idx ON public.vertex_graph_nodes (object_type_id);
COMMENT ON TABLE public.vertex_graph_nodes IS
  'One node: a specific object ("Adds all objects in the specified object set as nodes to the graph", vertex/generate-graph-apps) with its position — read-only mode says "Graph nodes cannot be re-arranged", so arrangement is state. The node row IS the shape sharing shares; the data behind it stays behind the object tables'' policies.';

CREATE TABLE public.vertex_graph_edges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subgraph_id  uuid NOT NULL REFERENCES public.vertex_subgraphs(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES public.vertex_graph_nodes(id) ON DELETE CASCADE,
  to_node_id   uuid NOT NULL REFERENCES public.vertex_graph_nodes(id) ON DELETE CASCADE,
  link_type_id uuid REFERENCES public.link_types(id) ON DELETE SET NULL,
  UNIQUE (subgraph_id, from_node_id, to_node_id, link_type_id)
);
CREATE INDEX vertex_graph_edges_subgraph_idx ON public.vertex_graph_edges (subgraph_id);
CREATE INDEX vertex_graph_edges_from_idx ON public.vertex_graph_edges (from_node_id);
CREATE INDEX vertex_graph_edges_to_idx ON public.vertex_graph_edges (to_node_id);
CREATE INDEX vertex_graph_edges_lt_idx ON public.vertex_graph_edges (link_type_id);
COMMENT ON TABLE public.vertex_graph_edges IS
  'One edge, carrying the link type it came from. Vertex calls this a Relation where the ontology says link type — the two-vocabularies rule, decided for the ontology audience: our column names the link_types row. Edge arrows default from the link''s cardinality and are overridable by the three link-direction type classes (710, vertex/graphs-display-options).';

-- per-(subgraph, object type) styling — the layer, as the page defines it
CREATE TABLE public.vertex_graph_layers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subgraph_id    uuid NOT NULL REFERENCES public.vertex_subgraphs(id) ON DELETE CASCADE,
  object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE,
  link_type_id   uuid REFERENCES public.link_types(id) ON DELETE CASCADE,
  style          jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (num_nonnulls(object_type_id, link_type_id) = 1),
  CHECK (jsonb_typeof(style) = 'object')
);
CREATE INDEX vertex_graph_layers_subgraph_idx ON public.vertex_graph_layers (subgraph_id);
CREATE INDEX vertex_graph_layers_ot_idx ON public.vertex_graph_layers (object_type_id);
CREATE INDEX vertex_graph_layers_lt_idx ON public.vertex_graph_layers (link_type_id);
COMMENT ON TABLE public.vertex_graph_layers IS
  'A layer is "the object node(s) of the same object type or the edge relationships between nodes" (vertex/graphs-display-options) — one styling row per (subgraph, object type or link type). The styling menu''s seven sections and the timeline shape live in the style jsonb; groups and saved selections are recorded residuals in the reading.';

-- save = a version; past versions read-only (save-share's Graph History)
CREATE TABLE public.vertex_graph_versions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id  uuid NOT NULL REFERENCES public.vertex_graphs(id) ON DELETE CASCADE,
  version   integer NOT NULL CHECK (version > 0),
  label     text NOT NULL DEFAULT '',
  snapshot  jsonb NOT NULL,
  saved_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  saved_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (jsonb_typeof(snapshot) = 'object'),
  UNIQUE (graph_id, version)
);
CREATE INDEX vertex_graph_versions_graph_idx ON public.vertex_graph_versions (graph_id);
CREATE INDEX vertex_graph_versions_saved_by_idx ON public.vertex_graph_versions (saved_by);
COMMENT ON TABLE public.vertex_graph_versions IS
  '"A full version history can be viewed in the Graph History sidebar. Previous versions of the graph can be accessed in read-only mode (the current version number will be visible in the resource header)" (vertex/save-share). Saving snapshots the sub-graphs, nodes, edges and layers; the free-text label is the capture''s "Modified color" line.';

-- ── saved Search Arounds: a first-class resource ────────────────────────────

CREATE TABLE public.vertex_search_arounds (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL DEFAULT public.auth_org_id()
                           REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id             uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name                   text NOT NULL CHECK (length(btrim(name)) > 0),
  -- "Only objects of the appropriate type can be selected."
  starting_object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  -- [{link_type_id, filters}] — each step takes the previous step's result:
  -- "The next link in the Search Around will take the resulting object set
  -- from the previous link as its starting object set."
  steps                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{name, type, description, default_value}] — the panel's five types,
  -- capture-derived (explore_objects_9.png), so undeclared
  parameters             jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by             uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(steps) = 'array'),
  CHECK (jsonb_typeof(parameters) = 'array')
);
CREATE INDEX vertex_search_arounds_project_idx ON public.vertex_search_arounds (project_id);
CREATE INDEX vertex_search_arounds_ot_idx ON public.vertex_search_arounds (starting_object_type_id);
CREATE INDEX vertex_search_arounds_org_idx ON public.vertex_search_arounds (organization_id);
CREATE INDEX vertex_search_arounds_created_by_idx ON public.vertex_search_arounds (created_by);
COMMENT ON TABLE public.vertex_search_arounds IS
  'A saved Search Around — a first-class resource ("you can save it as a resource", vertex/explore-object-relationships; marketplace-vertex excludes it from template shipping BECAUSE it is separate). Each step is one link type by the wire contract (api''s searchAround takes an object set and one link''s API name); a downstream filter SEMI-JOINS back to the start ("the starting object set will be filtered to those objects connected to the filtered resulting object set"), which the executing engine — the ontology package''s searchAround plus object_set_where — must honour. A parameter stores name, description and default value, the fields the page names.';

CREATE FUNCTION public.guard_vertex_search_around()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st jsonb; prm jsonb;
BEGIN
  FOR st IN SELECT * FROM jsonb_array_elements(NEW.steps) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.link_types lt
                    WHERE lt.id = (st ->> 'link_type_id')::uuid) THEN
      RAISE EXCEPTION 'Vertex:UnknownRelation — a Search Around step names a link type that does not exist';
    END IF;
  END LOOP;
  FOR prm IN SELECT * FROM jsonb_array_elements(NEW.parameters) LOOP
    -- the panel's dropdown: String, Number, Boolean, Date, Timestamp
    -- (vertex/images/explore_objects_9.png) — capture-derived
    -- capture-derived (explore_objects_9.png), so no page declaration —
    -- the 676/689 convention; IN rather than a CHECK set for the same reason
    IF (prm ->> 'type') NOT IN ('String', 'Number', 'Boolean', 'Date', 'Timestamp') THEN
      RAISE EXCEPTION 'Vertex:UnknownParameterType — % is not one of the panel''s five', prm ->> 'type';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_vertex_search_around
  BEFORE INSERT OR UPDATE ON public.vertex_search_arounds
  FOR EACH ROW EXECUTE FUNCTION public.guard_vertex_search_around();

-- ── save: snapshot the graph as a version ───────────────────────────────────

CREATE FUNCTION public.save_vertex_graph(p_graph uuid, p_label text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v uuid; snap jsonb; n integer;
BEGIN
  SELECT jsonb_build_object(
    'subgraphs', coalesce((SELECT jsonb_agg(to_jsonb(sg) ORDER BY sg.position)
                             FROM public.vertex_subgraphs sg WHERE sg.graph_id = p_graph), '[]'::jsonb),
    'nodes', coalesce((SELECT jsonb_agg(to_jsonb(nd))
                         FROM public.vertex_graph_nodes nd
                         JOIN public.vertex_subgraphs sg ON sg.id = nd.subgraph_id
                        WHERE sg.graph_id = p_graph), '[]'::jsonb),
    'edges', coalesce((SELECT jsonb_agg(to_jsonb(ed))
                         FROM public.vertex_graph_edges ed
                         JOIN public.vertex_subgraphs sg ON sg.id = ed.subgraph_id
                        WHERE sg.graph_id = p_graph), '[]'::jsonb),
    'layers', coalesce((SELECT jsonb_agg(to_jsonb(ly))
                          FROM public.vertex_graph_layers ly
                          JOIN public.vertex_subgraphs sg ON sg.id = ly.subgraph_id
                         WHERE sg.graph_id = p_graph), '[]'::jsonb))
  INTO snap;
  SELECT coalesce(max(gv.version), 0) + 1 INTO n
    FROM public.vertex_graph_versions gv WHERE gv.graph_id = p_graph;
  INSERT INTO public.vertex_graph_versions (graph_id, version, label, snapshot)
  VALUES (p_graph, n, p_label, snap) RETURNING id INTO v;
  RETURN v;
END $$;
COMMENT ON FUNCTION public.save_vertex_graph(uuid, text) IS
  'Saving writes a version the Graph History sidebar lists — sub-graphs, nodes, edges and layers snapshotted, the version number the resource header shows. INVOKER.';

CREATE FUNCTION public.create_vertex_graph(p_project uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE g uuid;
BEGIN
  INSERT INTO public.vertex_graphs (project_id, name)
  VALUES (p_project, p_name) RETURNING id INTO g;
  INSERT INTO public.vertex_subgraphs (graph_id, name) VALUES (g, 'Subgraph 1');
  RETURN g;
END $$;
COMMENT ON FUNCTION public.create_vertex_graph(uuid, text) IS
  'Creates a graph with its first sub-graph. INVOKER.';

-- ── RLS: readers see the shape; editors shape it ────────────────────────────

ALTER TABLE public.vertex_graphs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertex_subgraphs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertex_graph_nodes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertex_graph_edges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertex_graph_layers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertex_graph_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertex_search_arounds ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_read_vertex_graph(p_graph uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vertex_graphs g
                  WHERE g.id = p_graph
                    AND g.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(g.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_vertex_graph(p_graph uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vertex_graphs g
                  WHERE g.id = p_graph
                    AND g.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND NOT g.read_only
                    AND public.role_rank(public.project_role(g.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_edit_vertex_graph(uuid) IS
  'Editor on the project edits a graph that is not read-only — "Graph nodes cannot be re-arranged" and its siblings (vertex/read-only-mode) are this flag.';

CREATE POLICY "project members read graphs" ON public.vertex_graphs
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author graphs" ON public.vertex_graphs
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read subgraphs" ON public.vertex_subgraphs
  FOR SELECT USING ((SELECT public.can_read_vertex_graph(graph_id)));
CREATE POLICY "author subgraphs" ON public.vertex_subgraphs
  FOR ALL USING ((SELECT public.can_edit_vertex_graph(graph_id)))
          WITH CHECK ((SELECT public.can_edit_vertex_graph(graph_id)));

CREATE POLICY "read nodes" ON public.vertex_graph_nodes
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.vertex_subgraphs sg
                             WHERE sg.id = subgraph_id
                               AND public.can_read_vertex_graph(sg.graph_id)));
CREATE POLICY "author nodes" ON public.vertex_graph_nodes
  FOR ALL USING (EXISTS (SELECT 1 FROM public.vertex_subgraphs sg
                          WHERE sg.id = subgraph_id
                            AND public.can_edit_vertex_graph(sg.graph_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vertex_subgraphs sg
                       WHERE sg.id = subgraph_id
                         AND public.can_edit_vertex_graph(sg.graph_id)));

CREATE POLICY "read edges" ON public.vertex_graph_edges
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.vertex_subgraphs sg
                             WHERE sg.id = subgraph_id
                               AND public.can_read_vertex_graph(sg.graph_id)));
CREATE POLICY "author edges" ON public.vertex_graph_edges
  FOR ALL USING (EXISTS (SELECT 1 FROM public.vertex_subgraphs sg
                          WHERE sg.id = subgraph_id
                            AND public.can_edit_vertex_graph(sg.graph_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vertex_subgraphs sg
                       WHERE sg.id = subgraph_id
                         AND public.can_edit_vertex_graph(sg.graph_id)));

CREATE POLICY "read layers" ON public.vertex_graph_layers
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.vertex_subgraphs sg
                             WHERE sg.id = subgraph_id
                               AND public.can_read_vertex_graph(sg.graph_id)));
CREATE POLICY "author layers" ON public.vertex_graph_layers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.vertex_subgraphs sg
                          WHERE sg.id = subgraph_id
                            AND public.can_edit_vertex_graph(sg.graph_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vertex_subgraphs sg
                       WHERE sg.id = subgraph_id
                         AND public.can_edit_vertex_graph(sg.graph_id)));

CREATE POLICY "read versions" ON public.vertex_graph_versions
  FOR SELECT USING ((SELECT public.can_read_vertex_graph(graph_id)));
CREATE POLICY "author versions" ON public.vertex_graph_versions
  FOR ALL USING ((SELECT public.can_edit_vertex_graph(graph_id)))
          WITH CHECK ((SELECT public.can_edit_vertex_graph(graph_id)));

CREATE POLICY "project members read search arounds" ON public.vertex_search_arounds
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author search arounds" ON public.vertex_search_arounds
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_graphs         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_subgraphs      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_graph_nodes    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_graph_edges    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_graph_layers   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_graph_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertex_search_arounds TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ont uuid; ota uuid; otb uuid; lt uuid;
  g uuid; sg uuid; n1 uuid; n2 uuid; v uuid; sa uuid; n integer;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('vx-711') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('vx-711') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
    VALUES (sp, 'vx711', 'VX711', false) RETURNING id INTO ont;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vx711@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'vx711@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'vx_711', 'VX 711') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (ont, 'Airport711', 'Airport') RETURNING id INTO ota;
    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (ont, 'Flight711', 'Flight') RETURNING id INTO otb;
    INSERT INTO public.link_types (ontology_id, source_object_type_id, target_object_type_id,
                                   api_name, label, cardinality)
    VALUES (ont, ota, otb, 'departingFlight', 'Departing flight', 'one_to_many')
    RETURNING id INTO lt;

    -- 1. A graph opens with one sub-graph; nodes are specific objects with
    --    positions; edges carry the link type they came from.
    SELECT public.create_vertex_graph(proj, 'Airport ops') INTO g;
    SELECT id INTO sg FROM public.vertex_subgraphs WHERE graph_id = g;
    INSERT INTO public.vertex_graph_nodes (subgraph_id, object_type_id, primary_key, x, y)
    VALUES (sg, ota, 'ATH', 0, 0) RETURNING id INTO n1;
    INSERT INTO public.vertex_graph_nodes (subgraph_id, object_type_id, primary_key, x, y)
    VALUES (sg, otb, 'FL-102', 240, 0) RETURNING id INTO n2;
    INSERT INTO public.vertex_graph_edges (subgraph_id, from_node_id, to_node_id, link_type_id)
    VALUES (sg, n1, n2, lt);
    INSERT INTO public.vertex_graph_layers (subgraph_id, object_type_id, style)
    VALUES (sg, ota, '{"color": "#2d72d2", "size": "large"}'::jsonb);

    -- 2. The same object cannot sit twice in one sub-graph.
    BEGIN
      INSERT INTO public.vertex_graph_nodes (subgraph_id, object_type_id, primary_key)
      VALUES (sg, ota, 'ATH');
      RAISE EXCEPTION 'one object landed twice in a sub-graph';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- 3. Save writes version 1 then 2, snapshot carrying the shape.
    SELECT public.save_vertex_graph(g, 'first save') INTO v;
    IF (SELECT version FROM public.vertex_graph_versions WHERE id = v) <> 1 THEN
      RAISE EXCEPTION 'the first save is not version 1';
    END IF;
    SELECT public.save_vertex_graph(g, 'moved nodes') INTO v;
    SELECT jsonb_array_length(snapshot -> 'nodes') INTO n
      FROM public.vertex_graph_versions WHERE id = v;
    IF n <> 2 THEN RAISE EXCEPTION 'the snapshot holds % nodes, not 2', n; END IF;

    -- 4. A saved Search Around holds steps of real link types and the
    --    panel's five parameter types; an invented type refuses.
    INSERT INTO public.vertex_search_arounds
      (project_id, name, starting_object_type_id, steps, parameters)
    VALUES (proj, 'Departures', ota,
      jsonb_build_array(jsonb_build_object('link_type_id', lt, 'filters', '[]'::jsonb)),
      '[{"name": "minDate", "type": "Date", "description": "From", "default_value": null}]'::jsonb)
    RETURNING id INTO sa;
    BEGIN
      UPDATE public.vertex_search_arounds
         SET parameters = '[{"name": "x", "type": "Float"}]'::jsonb WHERE id = sa;
      RAISE EXCEPTION 'a parameter type outside the panel''s five was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Vertex:UnknownParameterType%' THEN RAISE; END IF;
    END;
    BEGIN
      UPDATE public.vertex_search_arounds
         SET steps = jsonb_build_array(jsonb_build_object('link_type_id', gen_random_uuid()))
       WHERE id = sa;
      RAISE EXCEPTION 'a step named an invented link type';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Vertex:UnknownRelation%' THEN RAISE; END IF;
    END;

    -- 5. Read-only closes the editing path.
    UPDATE public.vertex_graphs SET read_only = true WHERE id = g;
    IF public.can_edit_vertex_graph(g) THEN
      RAISE EXCEPTION 'a read-only graph still edits';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '711 proved, as the caller: a graph opens with one sub-graph and holds specific objects with positions, typed edges and per-layer styles; one object cannot sit twice in a sub-graph; save writes versions 1 then 2 snapshotting the shape; a saved Search Around holds real link-type steps and the panel''s five parameter types, refusing a sixth and an invented relation; and read-only closes editing';
  END;
END $$;
