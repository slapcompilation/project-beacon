-- 677: rid_display — the documentation renderer's link resolver.
--
--   "Links to Foundry resources are also supported. Use the following syntax to have the description automatically add links with icon and file name inferred: `[optional link text](rid)`."
--   — projects/add-documentation.md
--
-- Inferring icon and file name needs (kind, name) for a RID. Every resource
-- table stores its generated rid column, so the resolver matches the rid
-- itself — no grammar parsing — across the kinds a description would link.
-- INVOKER rights on purpose: RLS decides what resolves, so a link to a
-- resource the reader cannot see renders as plain text rather than leaking
-- its name.

CREATE FUNCTION public.rid_display(p_rid text)
RETURNS TABLE (kind text, name text)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT * FROM (
    SELECT 'project'::text AS kind, pr.name FROM public.projects pr WHERE pr.rid = p_rid
    UNION ALL
    SELECT 'folder', f.name FROM public.folders f WHERE f.rid = p_rid
    UNION ALL
    SELECT 'dataset', d.name FROM public.datasets d WHERE d.rid = p_rid
    UNION ALL
    SELECT 'restricted_view', rv.name FROM public.restricted_views rv WHERE rv.rid = p_rid
    UNION ALL
    SELECT 'object_type', ot.label FROM public.object_types ot WHERE ot.rid = p_rid
  ) hits LIMIT 1
$$;
COMMENT ON FUNCTION public.rid_display(text) IS
  'Resolves a RID to (kind, name) for the documentation renderer''s inferred links (projects/add-documentation). Invoker rights: RLS decides what resolves; an invisible or unknown RID resolves to nothing and the renderer keeps plain text.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; pr uuid; fl uuid; k text; nm text; n int;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('rid-677') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('rid-677') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'rid_probe_677', 'Rid probe 677') RETURNING id INTO pr;
    INSERT INTO public.folders (organization_id, project_id, name)
    VALUES (org, pr, 'rid-folder-677') RETURNING id INTO fl;

    SELECT d.kind, d.name INTO k, nm FROM public.rid_display(
      (SELECT rid FROM public.projects WHERE id = pr)) d;
    IF k IS DISTINCT FROM 'project' OR nm IS DISTINCT FROM 'Rid probe 677' THEN
      RAISE EXCEPTION 'the project rid should resolve to its kind and name, got % %', k, nm;
    END IF;
    SELECT d.kind, d.name INTO k, nm FROM public.rid_display(
      (SELECT rid FROM public.folders WHERE id = fl)) d;
    IF k IS DISTINCT FROM 'folder' OR nm IS DISTINCT FROM 'rid-folder-677' THEN
      RAISE EXCEPTION 'the folder rid should resolve, got % %', k, nm;
    END IF;
    SELECT count(*) INTO n FROM public.rid_display('ri.compass.main.folder.' || gen_random_uuid());
    IF n <> 0 THEN RAISE EXCEPTION 'an unknown rid resolved to something'; END IF;
    SELECT count(*) INTO n FROM public.rid_display('not a rid at all');
    IF n <> 0 THEN RAISE EXCEPTION 'a non-rid resolved to something'; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '677 proved: a project and a folder rid resolve to kind and name, and unknown or malformed input resolves to nothing';
  END;
END $$;
