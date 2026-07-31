-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 272 — export and install an ontology package. Tier 4.3.
--
-- Audit §9.1: Foundry packages ONTOLOGIES as products — supported-resources
-- confirms object types, link types, actions and automations are packageable —
-- and installations receive versions. Ours lived as uuid-keyed Postgres rows
-- with no export, no import, no packaging, and the sharp consequence was that
-- EVERY NEW CUSTOMER STARTS FROM AN EMPTY STUDIO. All the authoring work from
-- P1-P5 and G1-G4 was per-tenant and non-transferable, and we could not ship a
-- hospitality starter pack.
--
-- PORTABILITY IS THE WHOLE DESIGN PROBLEM. Every artifact here references others
-- by uuid — a tool points at subject_type_id, a link type at two object types, an
-- automation at an object_set. A uuid means nothing in another organization, so
-- the package refers to everything by API NAME and installation resolves those
-- names locally. An export that carried ids would install as a pile of dangling
-- references, which is the failure this whole arc has been about.
--
-- Built-in types are deliberately NOT packaged: they are code-owned, arrive with
-- the migrations, and already exist in any installation worth installing into.
-- A package carries what an operator authored, which is the part that took work.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.export_ontology_package(p_name text DEFAULT 'ontology-package')
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'package',    p_name,
    'format',     1,
    'exported_at', now(),
    'object_types', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'api_name', t.api_name, 'label', t.label, 'icon', t.icon,
        'description', t.description, 'properties', t.properties,
        'computed_properties', t.computed_properties, 'title_key', t.title_key)
        ORDER BY t.api_name)
      FROM object_types t WHERE t.kind = 'authored' AND t.organization_id = auth_org_id()), '[]'::jsonb),
    'interfaces', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'api_name', i.api_name, 'label', i.label, 'properties', i.properties)
        ORDER BY i.api_name)
      FROM ontology_interfaces i WHERE i.organization_id = auth_org_id()), '[]'::jsonb),
    -- Implementations travel as name pairs, not ids.
    'implementations', coalesce((
      SELECT jsonb_agg(jsonb_build_object('type', t.api_name, 'interface', i.api_name)
        ORDER BY t.api_name, i.api_name)
      FROM object_type_interfaces oti
      JOIN object_types t ON t.id = oti.object_type_id
      JOIN ontology_interfaces i ON i.id = oti.interface_id
      WHERE t.organization_id = auth_org_id() AND t.kind = 'authored'), '[]'::jsonb),
    'link_types', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'api_name', lt.api_name, 'label', lt.label,
        'source_type', s.api_name, 'target_type', t.api_name,
        'target_api_name', lt.target_api_name, 'source_api_name', lt.source_api_name,
        'cardinality', lt.cardinality)
        ORDER BY lt.api_name)
      FROM link_types lt
      JOIN object_types s ON s.id = lt.source_object_type_id
      JOIN object_types t ON t.id = lt.target_object_type_id
      WHERE lt.kind = 'authored' AND lt.organization_id = auth_org_id()), '[]'::jsonb),
    'tools', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'api_name', ut.api_name, 'name', ut.name, 'description', ut.description,
        'subject_type', st.api_name, 'subject_interface', si.api_name,
        'parameters', ut.parameters, 'filters', ut.filters, 'aggregation', ut.aggregation)
        ORDER BY ut.api_name)
      FROM user_tools ut
      LEFT JOIN object_types st ON st.id = ut.subject_type_id
      LEFT JOIN ontology_interfaces si ON si.id = ut.subject_interface_id
      WHERE ut.organization_id = auth_org_id()), '[]'::jsonb),
    'cohorts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'api_name', os.api_name, 'name', os.name, 'description', os.description,
        'subject_type', st.api_name, 'subject_interface', si.api_name,
        'parameters', os.parameters, 'filters', os.filters, 'traversals', os.traversals)
        ORDER BY os.api_name)
      FROM object_sets os
      LEFT JOIN object_types st ON st.id = os.subject_type_id
      LEFT JOIN ontology_interfaces si ON si.id = os.subject_interface_id
      WHERE os.organization_id = auth_org_id()), '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.export_ontology_package(text) IS
  'The authored ontology as a portable document. Everything references by API NAME, never uuid, because an id means nothing in the organization installing it. Built-in types are excluded — they arrive with the migrations.';

CREATE OR REPLACE FUNCTION public.install_ontology_package(p_package jsonb)
RETURNS TABLE (artifact text, installed integer, skipped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid := auth_org_id();
  e jsonb;
  n_types int := 0; s_types int := 0;
  n_iface int := 0; s_iface int := 0;
  n_impl  int := 0; s_impl  int := 0;
  n_links int := 0; s_links int := 0;
  n_tools int := 0; s_tools int := 0;
  n_sets  int := 0; s_sets  int := 0;
BEGIN
  IF auth_role() NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Only owner or admin may install an ontology package' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF coalesce((p_package->>'format')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'Unsupported package format: %', p_package->>'format';
  END IF;

  -- Idempotent throughout: installing twice is a no-op, and installing over an
  -- existing artifact leaves the local one alone. An install must never silently
  -- overwrite work someone did here.
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_package->'object_types','[]'::jsonb)) LOOP
    IF EXISTS (SELECT 1 FROM object_types WHERE organization_id = v_org AND api_name = e->>'api_name') THEN
      s_types := s_types + 1;
    ELSE
      INSERT INTO object_types (organization_id, api_name, label, icon, description, properties, computed_properties, title_key, kind, created_by_user_id)
      VALUES (v_org, e->>'api_name', e->>'label', coalesce(e->>'icon','cube'), coalesce(e->>'description',''),
              coalesce(e->'properties','[]'::jsonb), coalesce(e->'computed_properties','[]'::jsonb),
              e->>'title_key', 'authored', auth.uid());
      n_types := n_types + 1;
    END IF;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_package->'interfaces','[]'::jsonb)) LOOP
    IF EXISTS (SELECT 1 FROM ontology_interfaces WHERE organization_id = v_org AND api_name = e->>'api_name') THEN
      s_iface := s_iface + 1;
    ELSE
      INSERT INTO ontology_interfaces (organization_id, api_name, label, properties, created_by_user_id)
      VALUES (v_org, e->>'api_name', e->>'label', coalesce(e->'properties','[]'::jsonb), auth.uid());
      n_iface := n_iface + 1;
    END IF;
  END LOOP;

  -- Resolved by name against what is here NOW, which is the point of the format.
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_package->'implementations','[]'::jsonb)) LOOP
    INSERT INTO object_type_interfaces (organization_id, object_type_id, interface_id)
    SELECT v_org, t.id, i.id
    FROM object_types t, ontology_interfaces i
    WHERE t.organization_id = v_org AND t.api_name = e->>'type'
      AND i.organization_id = v_org AND i.api_name = e->>'interface'
      AND NOT EXISTS (SELECT 1 FROM object_type_interfaces x WHERE x.object_type_id = t.id AND x.interface_id = i.id)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN n_impl := n_impl + 1; ELSE s_impl := s_impl + 1; END IF;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_package->'link_types','[]'::jsonb)) LOOP
    IF EXISTS (SELECT 1 FROM link_types WHERE organization_id = v_org AND api_name = e->>'api_name') THEN
      s_links := s_links + 1;
    ELSE
      INSERT INTO link_types (organization_id, source_object_type_id, target_object_type_id,
                              api_name, label, target_api_name, target_label, source_api_name,
                              cardinality, kind, created_by_user_id)
      SELECT v_org, s.id, t.id, e->>'api_name', e->>'label',
             coalesce(e->>'target_api_name', e->>'api_name'), e->>'label', e->>'source_api_name',
             coalesce(e->>'cardinality','many_to_many'), 'authored', auth.uid()
      FROM object_types s, object_types t
      WHERE s.organization_id = v_org AND s.api_name = e->>'source_type'
        AND t.organization_id = v_org AND t.api_name = e->>'target_type';
      IF FOUND THEN n_links := n_links + 1; ELSE s_links := s_links + 1; END IF;
    END IF;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_package->'tools','[]'::jsonb)) LOOP
    IF EXISTS (SELECT 1 FROM user_tools WHERE organization_id = v_org AND api_name = e->>'api_name') THEN
      s_tools := s_tools + 1;
    ELSE
      INSERT INTO user_tools (organization_id, name, api_name, description,
                              subject_type_id, subject_interface_id, parameters, filters, aggregation, created_by_user_id)
      SELECT v_org, e->>'name', e->>'api_name', coalesce(e->>'description',''),
             (SELECT id FROM object_types WHERE organization_id = v_org AND api_name = e->>'subject_type'),
             (SELECT id FROM ontology_interfaces WHERE organization_id = v_org AND api_name = e->>'subject_interface'),
             coalesce(e->'parameters','[]'::jsonb), coalesce(e->'filters','[]'::jsonb),
             coalesce(e->'aggregation','{"fn":"count"}'::jsonb), auth.uid();
      n_tools := n_tools + 1;
    END IF;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_package->'cohorts','[]'::jsonb)) LOOP
    IF EXISTS (SELECT 1 FROM object_sets WHERE organization_id = v_org AND api_name = e->>'api_name') THEN
      s_sets := s_sets + 1;
    ELSE
      INSERT INTO object_sets (organization_id, name, api_name, description,
                               subject_type_id, subject_interface_id, parameters, filters, traversals, created_by_user_id)
      SELECT v_org, e->>'name', e->>'api_name', coalesce(e->>'description',''),
             (SELECT id FROM object_types WHERE organization_id = v_org AND api_name = e->>'subject_type'),
             (SELECT id FROM ontology_interfaces WHERE organization_id = v_org AND api_name = e->>'subject_interface'),
             coalesce(e->'parameters','[]'::jsonb), coalesce(e->'filters','[]'::jsonb),
             coalesce(e->'traversals','[]'::jsonb), auth.uid();
      n_sets := n_sets + 1;
    END IF;
  END LOOP;

  RETURN QUERY VALUES
    ('object_types', n_types, s_types), ('interfaces', n_iface, s_iface),
    ('implementations', n_impl, s_impl), ('link_types', n_links, s_links),
    ('tools', n_tools, s_tools), ('cohorts', n_sets, s_sets);
END $$;

REVOKE ALL ON FUNCTION public.install_ontology_package(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.install_ontology_package(jsonb) TO authenticated;

COMMENT ON FUNCTION public.install_ontology_package(jsonb) IS
  'Installs a package into the caller''s organization, resolving every reference by API name. Idempotent: an artifact that already exists is skipped, never overwritten — an install must not silently replace work someone did here.';

COMMIT;
