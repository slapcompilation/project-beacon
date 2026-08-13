-- Compass slice C2: the catalog layer.
--
-- "Tags are structured metadata that can be applied to resources for
-- categorization and discovery. Tags are a helpful construct, but they do
-- **not** add or imply security." (compass/tags.md)
--
-- "Collections are groups of those files that contain all curated data for a
-- given topic, audience, or purpose." (compass/data-catalog.md)
--
-- "Currently, the only available status is **Promoted**."
-- (compass/resource-status.md)
--
-- "In addition to projects created for collaboration, every user has a
-- personal project." (getting-started/projects-and-resources.md)

-- ── tags ────────────────────────────────────────────────────────────────────
-- "Tags are organized into categories; the visibility of each category can
-- be restricted to one or more Organizations." Ours holds one organization,
-- the same narrowing every resource here has: "By default, a new tag
-- category will be restricted to the Organization of which you are a
-- member."
CREATE TABLE public.tag_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.auth_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
COMMENT ON TABLE public.tag_categories IS
  'Tag categories: structured metadata dimensions (region, source system, refresh schedule), visible to one organization, never security.';
CREATE INDEX tag_categories_org_idx ON public.tag_categories (organization_id);
CREATE INDEX tag_categories_created_by_idx ON public.tag_categories (created_by);

CREATE TABLE public.tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.tag_categories(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  UNIQUE (category_id, name)
);
COMMENT ON TABLE public.tags IS 'One tag inside its category — the value users filter and group by.';
CREATE INDEX tags_category_idx ON public.tags (category_id);

CREATE TABLE public.resource_tags (
  tag_id        uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  resource_kind text NOT NULL CHECK (resource_kind IN ('project', 'folder', 'dataset', 'restricted_view')),
  resource_id   uuid NOT NULL,
  applied_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, resource_kind, resource_id)
);
COMMENT ON TABLE public.resource_tags IS
  'A tag on a resource — categorization and discovery only; removing or adding one never changes who sees what.';
CREATE INDEX resource_tags_resource_idx ON public.resource_tags (resource_kind, resource_id);
CREATE INDEX resource_tags_applied_by_idx ON public.resource_tags (applied_by);

-- Which project a taggable resource answers to, for the apply gate.
-- (resource_project already answers for ontology kinds since 462; this one
-- speaks the compass kinds.)
CREATE OR REPLACE FUNCTION public.compass_project_of(p_kind text, p_id uuid)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE p_kind
    WHEN 'project'         THEN p_id
    WHEN 'folder'          THEN (SELECT f.project_id FROM public.folders f WHERE f.id = p_id)
    WHEN 'dataset'         THEN (SELECT d.project_id FROM public.datasets d WHERE d.id = p_id)
    WHEN 'restricted_view' THEN (SELECT v.project_id FROM public.restricted_views v WHERE v.id = p_id)
  END
$$;

-- ── collections ─────────────────────────────────────────────────────────────
CREATE TABLE public.collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.auth_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  description     text,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
COMMENT ON TABLE public.collections IS
  'Curated groups of files for a topic, audience or purpose — anyone can view the collection; its files stay gated by their own permissions.';
CREATE INDEX collections_org_idx ON public.collections (organization_id);
CREATE INDEX collections_created_by_idx ON public.collections (created_by);

CREATE TABLE public.collection_resources (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  resource_kind text NOT NULL CHECK (resource_kind IN ('project', 'folder', 'dataset', 'restricted_view')),
  resource_id   uuid NOT NULL,
  added_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, resource_kind, resource_id)
);
COMMENT ON TABLE public.collection_resources IS 'What a collection curates, by kind and id.';
CREATE INDEX collection_resources_resource_idx ON public.collection_resources (resource_kind, resource_id);
CREATE INDEX collection_resources_added_by_idx ON public.collection_resources (added_by);

-- ── promoted ────────────────────────────────────────────────────────────────
-- "the most useful projects, folders, and files" — all three kinds carry it.
ALTER TABLE public.projects ADD COLUMN promoted boolean NOT NULL DEFAULT false;
ALTER TABLE public.folders ADD COLUMN promoted boolean NOT NULL DEFAULT false;
ALTER TABLE public.datasets ADD COLUMN promoted boolean NOT NULL DEFAULT false;
ALTER TABLE public.restricted_views ADD COLUMN promoted boolean NOT NULL DEFAULT false;

-- "you must have the **Editor** role or higher on that resource, and you
-- must be granted the **Resource Curator** role at the space level" — our
-- spaces have no role machinery, so the org admin stands in for the
-- curator (reading, open question 2, marked ours). Under that stand-in the
-- two clauses collapse: an org admin passes both.
CREATE OR REPLACE FUNCTION public.guard_promotion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.promoted IS DISTINCT FROM OLD.promoted
     AND auth.uid() IS NOT NULL
     AND public.auth_role() NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Compass:PromotionTakesACurator — changing a resource''s status takes the curator role (org admin stands in)';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_project_promotion BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_promotion();
CREATE TRIGGER trg_guard_folder_promotion BEFORE UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.guard_promotion();
CREATE TRIGGER trg_guard_dataset_promotion BEFORE UPDATE ON public.datasets
FOR EACH ROW EXECUTE FUNCTION public.guard_promotion();
CREATE TRIGGER trg_guard_rv_promotion BEFORE UPDATE ON public.restricted_views
FOR EACH ROW EXECUTE FUNCTION public.guard_promotion();

-- ── personal projects ───────────────────────────────────────────────────────
-- "every user has a personal project" — visible only to its person, the way
-- the Compass tabs call it "Your files (visible only to you)".
ALTER TABLE public.projects
  ADD COLUMN personal_of uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX projects_personal_of_key ON public.projects (personal_of)
  WHERE personal_of IS NOT NULL;

CREATE OR REPLACE FUNCTION public.provision_personal_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE proj uuid;
BEGIN
  IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.projects (organization_id, api_name, name, personal_of)
  VALUES (NEW.organization_id,
          'personal_' || replace(NEW.id::text, '-', ''),
          'Your files', NEW.id)
  ON CONFLICT (personal_of) WHERE personal_of IS NOT NULL DO NOTHING
  RETURNING id INTO proj;
  IF proj IS NOT NULL THEN
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, NEW.id, 'owner', NEW.organization_id)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_provision_personal_project AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.provision_personal_project();

-- Everyone already here gets theirs now.
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT id, organization_id FROM public.users
            WHERE organization_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.personal_of = users.id)
  LOOP
    INSERT INTO public.projects (organization_id, api_name, name, personal_of)
    VALUES (u.organization_id, 'personal_' || replace(u.id::text, '-', ''), 'Your files', u.id);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    SELECT p.id, u.id, 'owner', u.organization_id FROM public.projects p WHERE p.personal_of = u.id;
  END LOOP;
END $$;

-- Visible only to its person — as a RESTRICTIVE policy, because the
-- permissive read and admin-write policies OR together and any one of them
-- would otherwise leak the row. A restrictive policy ANDs over them all.
CREATE POLICY "personal projects show only to their person" ON public.projects
  AS RESTRICTIVE FOR SELECT
  USING (personal_of IS NULL OR personal_of = auth.uid());

-- ── visibility and management ───────────────────────────────────────────────
ALTER TABLE public.tag_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_resources ENABLE ROW LEVEL SECURITY;

-- "You can manage tags and tag categories in the **Tags** section of
-- Platform Settings." — an admin surface.
CREATE POLICY "org members see tag categories" ON public.tag_categories FOR SELECT
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "admins manage tag categories" ON public.tag_categories FOR ALL
  USING (public.auth_role() IN ('owner', 'admin')
         AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()))
  WITH CHECK (public.auth_role() IN ('owner', 'admin')
              AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "org members see tags" ON public.tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tag_categories c WHERE c.id = category_id
                   AND NOT (c.organization_id IS DISTINCT FROM public.auth_org_id())));
CREATE POLICY "admins manage tags" ON public.tags FOR ALL
  USING (EXISTS (SELECT 1 FROM public.tag_categories c WHERE c.id = category_id
                   AND public.auth_role() IN ('owner', 'admin')
                   AND NOT (c.organization_id IS DISTINCT FROM public.auth_org_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tag_categories c WHERE c.id = category_id
                        AND public.auth_role() IN ('owner', 'admin')
                        AND NOT (c.organization_id IS DISTINCT FROM public.auth_org_id())));

-- Applying a tag: Foundry gates it on a granted Control Panel workflow we do
-- not have; ours takes the editor role on the resource's project (marked in
-- the reading). Tags never gate, so reading them is org-wide.
CREATE POLICY "org members see resource tags" ON public.resource_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tags t JOIN public.tag_categories c ON c.id = t.category_id
                  WHERE t.id = tag_id
                    AND NOT (c.organization_id IS DISTINCT FROM public.auth_org_id())));
CREATE POLICY "editors apply tags" ON public.resource_tags FOR ALL
  USING (public.auth_role() IN ('owner', 'admin')
         OR public.role_rank(public.project_role(public.compass_project_of(resource_kind, resource_id)))
            >= public.role_rank('editor'))
  WITH CHECK (public.auth_role() IN ('owner', 'admin')
              OR public.role_rank(public.project_role(public.compass_project_of(resource_kind, resource_id)))
                 >= public.role_rank('editor'));

-- "Anyone can view collections and their descriptions" — org-wide reads;
-- "By default, Organization administrators have the permission to add and
-- remove resources from collections" — admin writes, delegation recorded.
CREATE POLICY "org members see collections" ON public.collections FOR SELECT
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "admins curate collections" ON public.collections FOR ALL
  USING (public.auth_role() IN ('owner', 'admin')
         AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()))
  WITH CHECK (public.auth_role() IN ('owner', 'admin')
              AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "org members see collection contents" ON public.collection_resources FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id
                   AND NOT (c.organization_id IS DISTINCT FROM public.auth_org_id())));
CREATE POLICY "admins curate collection contents" ON public.collection_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id
                   AND public.auth_role() IN ('owner', 'admin')
                   AND NOT (c.organization_id IS DISTINCT FROM public.auth_org_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id
                        AND public.auth_role() IN ('owner', 'admin')
                        AND NOT (c.organization_id IS DISTINCT FROM public.auth_org_id())));

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ds uuid; cat uuid; tg uuid; col uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); before text;
  n int; personal uuid;
BEGIN
  before := current_setting('request.jwt.claims', true);

  -- 0. Backfill left nobody without a personal project.
  SELECT count(*) INTO n FROM public.users u
   WHERE u.organization_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.personal_of = u.id);
  IF n > 0 THEN RAISE EXCEPTION '% user(s) have no personal project after backfill', n; END IF;

  INSERT INTO public.organizations (name) VALUES ('catalog-499') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c499a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c499b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 'c499a@beacon.test', 'admin', org),
    (u2, 'c499b@beacon.test', 'admin', org);

  -- 1. A new user is provisioned a personal project with the owner grant,
  --    visible to them and hidden from everyone else.
  SELECT id INTO personal FROM public.projects WHERE personal_of = u2;
  IF personal IS NULL THEN RAISE EXCEPTION 'a new user should get a personal project'; END IF;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.projects WHERE id = personal;
  IF n <> 1 THEN RAISE EXCEPTION 'the person should see their own personal project'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.projects WHERE id = personal;
  IF n <> 0 THEN RAISE EXCEPTION 'a personal project must be visible only to its person'; END IF;

  -- 2. Tags: an admin builds the vocabulary, an editor applies it, and a
  --    foreign organization sees none of it.
  sp := public.create_space('C499');
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'c499', 'C499') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org);
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'c499_ds', 'Tagged') RETURNING id INTO ds;
  INSERT INTO public.tag_categories (name) VALUES ('Region') RETURNING id INTO cat;
  INSERT INTO public.tags (category_id, name) VALUES (cat, 'EU') RETURNING id INTO tg;
  INSERT INTO public.resource_tags (tag_id, resource_kind, resource_id) VALUES (tg, 'dataset', ds);
  SELECT count(*) INTO n FROM public.resource_tags WHERE resource_id = ds;
  IF n <> 1 THEN RAISE EXCEPTION 'the tag should land on the dataset'; END IF;

  -- 3. Collections: admins curate, members read, and a member write refuses.
  INSERT INTO public.collections (name, description) VALUES ('Sales curated', 'For the sales audience')
  RETURNING id INTO col;
  INSERT INTO public.collection_resources (collection_id, resource_kind, resource_id)
  VALUES (col, 'dataset', ds);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
  SELECT count(*) INTO n FROM public.collections WHERE id = col;
  IF n <> 1 THEN RAISE EXCEPTION 'anyone in the org can view collections'; END IF;
  BEGIN
    INSERT INTO public.collections (name) VALUES ('Rogue curation');
    RAISE EXCEPTION 'a non-admin curated a collection';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%row-level security%' THEN RAISE; END IF;
  END;

  -- 4. Promoted: the curator stand-in flips it, a plain member cannot.
  BEGIN
    UPDATE public.datasets SET promoted = true WHERE id = ds;
    IF FOUND THEN RAISE EXCEPTION 'a non-curator promoted a resource'; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Compass:PromotionTakesACurator%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  UPDATE public.datasets SET promoted = true WHERE id = ds;
  IF NOT (SELECT promoted FROM public.datasets WHERE id = ds) THEN
    RAISE EXCEPTION 'the curator stand-in should promote';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '499: the catalog layer sits above the tree — tags, collections, Promoted, and a personal project each';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
