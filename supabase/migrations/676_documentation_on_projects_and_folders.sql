-- 676: documentation on projects and folders — the cover page, its
-- discovery carve-out, and the folder description.
--
--   "You can add documentation to any folder by dragging and dropping a Markdown file named `README.md` into the folder, or selecting **Add description** from the folder’s Actions menu."
--   — projects/add-documentation.md
--
--   "The Project **Cover Page** section offers a Markdown-based rich-text editor for writing comprehensive documentation about the Project."
--   — security/cover-pages.md
--
--   "Cover pages can be configured by Project owners to be discoverable by all users in the Project's organization, even in cases when a Project has markings applied to it. Users without access to the Project or its files can still discover and view the Project's cover page."
--   — security/cover-pages.md
--
-- The discoverability set is the capture's two radio labels — all can
-- discover, require marking access (security/images/cover-page.png) — which
-- the prose page never prints, so the constraint cannot carry a page
-- declaration the platform suite could verify; it joins the printed
-- undeclared count instead, and readings/project-documentation.md holds the
-- trace. NULL means the cover page follows project access like any other
-- column — the un-configured state appears in no capture, an inference the
-- reading records (Question 1).
--
-- The carve-out is a SECURITY DEFINER function, never a policy arm: the
-- projects SELECT policy guards every column of a marked project, and
-- widening it would expose them all. The function returns only the
-- discovery tuple, fail-closed, composing the same predicates the policy
-- uses — resource_file_access for the marking-gated flavor, the caller's
-- organization for both.
--
-- The README.md file route is NOT built: no file-resource kind exists here
-- for a folder to hold (datasets carry project_id; nothing carries
-- folder_id). Recorded in the reading, Decision 4.

ALTER TABLE public.folders ADD COLUMN documentation text;
COMMENT ON COLUMN public.folders.documentation IS
  'The folder''s documentation, standard Markdown — the Add-description route (projects/add-documentation). The README.md file route is not built: no file-resource kind exists to hold one (readings/project-documentation.md, Decision 4).';

ALTER TABLE public.projects ADD COLUMN cover_page text;
ALTER TABLE public.projects ADD COLUMN cover_page_discoverability text
  CONSTRAINT projects_cover_page_discoverability_check
  CHECK (cover_page_discoverability IN ('all_can_discover', 'require_marking_access'));
COMMENT ON COLUMN public.projects.cover_page IS
  'The project''s cover page, markdown (security/cover-pages): comprehensive documentation, rendered with a heading table of contents (security/images/cover-page.png).';
COMMENT ON CONSTRAINT projects_cover_page_discoverability_check ON public.projects IS
  'The two radio labels under Cover page discoverability in security/images/cover-page.png — all can discover, require marking access — snake_cased. The prose page never prints the set, so no page declaration is possible; the platform suite counts this set as undeclared and readings/project-documentation.md carries the trace. NULL = the cover page follows project access.';

CREATE FUNCTION public.discoverable_cover_pages()
RETURNS TABLE (project_id uuid, rid text, name text, description text, cover_page text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT p.id, p.rid, p.name, p.description, p.cover_page
    FROM public.projects p
   WHERE p.cover_page IS NOT NULL
     AND p.organization_id IS NOT DISTINCT FROM public.auth_org_id()
     AND (p.personal_of IS NULL OR p.personal_of = auth.uid())
     AND (p.cover_page_discoverability = 'all_can_discover'
          OR (p.cover_page_discoverability = 'require_marking_access'
              AND public.resource_file_access('project', p.id, p.organization_id)))
$$;
COMMENT ON FUNCTION public.discoverable_cover_pages() IS
  'The discovery carve-out (security/cover-pages): projects in the caller''s organization whose cover page admits the caller — all_can_discover needs the organization alone, require_marking_access composes resource_file_access, the same org-and-markings predicate the read policy uses. Returns only the discovery tuple; the row policy stays untouched. NULL discoverability discovers nothing.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; org2 uuid; sp uuid; cat uuid; mk uuid; pr uuid; ppr uuid; fl uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  before text; n int; doc text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('docs-676') RETURNING id INTO org;
    INSERT INTO public.organizations (name) VALUES ('docs-676-other') RETURNING id INTO org2;
    INSERT INTO public.spaces (name) VALUES ('docs-676') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'docs676a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'docs676b@beacon.test'),
      (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'docs676c@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'docs676a@beacon.test', 'admin', org),
      (u2, 'docs676b@beacon.test', 'admin', org),
      (u3, 'docs676c@beacon.test', 'admin', org2);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.marking_categories (name, category_type, organization_id)
    VALUES ('DOCS-676', 'conjunctive', org) RETURNING id INTO cat;
    INSERT INTO public.markings (category_id, name) VALUES (cat, 'DOCS 676 SECRET') RETURNING id INTO mk;
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'docs_probe_676', 'Docs probe 676') RETURNING id INTO pr;
    -- Applying a marking needs the apply permission and Owner on the resource.
    INSERT INTO public.marking_permissions (marking_id, user_id, permission) VALUES (mk, u1, 'apply');
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (pr, u1, 'owner', org);
    INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (mk, 'project', pr);
    UPDATE public.projects SET cover_page = '# Docs 676' WHERE id = pr;

    -- u2: in the organization, no role, no marking membership.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

    -- 1. The marked project is genuinely closed to u2 on the normal path.
    IF public.resource_file_access('project', pr, org) THEN
      RAISE EXCEPTION 'the marked project should be closed to a non-member';
    END IF;

    -- 2. NULL discoverability discovers nothing, cover page or not.
    SELECT count(*) INTO n FROM public.discoverable_cover_pages() d WHERE d.project_id = pr;
    IF n <> 0 THEN RAISE EXCEPTION 'NULL discoverability leaked the cover page'; END IF;

    -- 3. all_can_discover pierces the closed row with the tuple only.
    UPDATE public.projects SET cover_page_discoverability = 'all_can_discover' WHERE id = pr;
    SELECT count(*) INTO n FROM public.discoverable_cover_pages() d
     WHERE d.project_id = pr AND d.cover_page = '# Docs 676' AND d.name = 'Docs probe 676';
    IF n <> 1 THEN RAISE EXCEPTION 'all_can_discover should discover the marked project'; END IF;

    -- 4. require_marking_access asks the same markings question the policy does.
    UPDATE public.projects SET cover_page_discoverability = 'require_marking_access' WHERE id = pr;
    SELECT count(*) INTO n FROM public.discoverable_cover_pages() d WHERE d.project_id = pr;
    IF n <> 0 THEN RAISE EXCEPTION 'require_marking_access should refuse a non-member'; END IF;
    INSERT INTO public.marking_members (marking_id, user_id) VALUES (mk, u2);
    SELECT count(*) INTO n FROM public.discoverable_cover_pages() d WHERE d.project_id = pr;
    IF n <> 1 THEN RAISE EXCEPTION 'a marking member should discover under require_marking_access'; END IF;

    -- 5. No cover page, nothing to discover.
    UPDATE public.projects SET cover_page = NULL WHERE id = pr;
    SELECT count(*) INTO n FROM public.discoverable_cover_pages() d WHERE d.project_id = pr;
    IF n <> 0 THEN RAISE EXCEPTION 'a NULL cover page was discovered'; END IF;
    UPDATE public.projects SET cover_page = '# Docs 676',
                               cover_page_discoverability = 'all_can_discover' WHERE id = pr;

    -- 6. A personal project shows only to its person, discovery included.
    SELECT p.id INTO ppr FROM public.projects p WHERE p.personal_of = u1;
    IF ppr IS NULL THEN
      INSERT INTO public.projects (organization_id, space_id, api_name, name, personal_of)
      VALUES (org, sp, 'docs_probe_676_p', 'Personal 676', u1) RETURNING id INTO ppr;
    END IF;
    UPDATE public.projects SET cover_page = '# Personal 676',
                               cover_page_discoverability = 'all_can_discover' WHERE id = ppr;
    SELECT count(*) INTO n FROM public.discoverable_cover_pages() d WHERE d.project_id = ppr;
    IF n <> 0 THEN RAISE EXCEPTION 'another person''s personal project was discovered'; END IF;

    -- 7. The carve-out is organization-scoped in both flavors.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u3::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org2))::text, true);
    SELECT count(*) INTO n FROM public.discoverable_cover_pages() d WHERE d.project_id = pr;
    IF n <> 0 THEN RAISE EXCEPTION 'a foreign organization discovered the cover page'; END IF;

    -- 8. The CHECK admits exactly the capture's two labels.
    BEGIN
      UPDATE public.projects SET cover_page_discoverability = 'public' WHERE id = pr;
      RAISE EXCEPTION 'a third discoverability value was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 9. The folder's Add-description route is a real column.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.folders (organization_id, project_id, name)
    VALUES (org, pr, 'docs-676') RETURNING id INTO fl;
    UPDATE public.folders SET documentation = '# Folder readme 676' WHERE id = fl;
    SELECT f.documentation INTO doc FROM public.folders f WHERE f.id = fl;
    IF doc IS DISTINCT FROM '# Folder readme 676' THEN
      RAISE EXCEPTION 'the folder documentation did not read back';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '676 proved: the marked project is closed on the normal path yet discovered under all_can_discover, require_marking_access composes the policy''s own markings question, NULL and no-cover-page discover nothing, personal and foreign-org projects stay hidden, the CHECK holds two values, and the folder documentation reads back';
  END;
END $$;
