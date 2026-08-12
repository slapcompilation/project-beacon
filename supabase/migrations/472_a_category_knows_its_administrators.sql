-- A marking category knows its administrators and viewers.
--
--   "Category Administrators: Users who can change the description and
--    permissions for the category and create Markings in the category.
--    Category Viewers: Users who can see the existence of the category and
--    all the Markings within it."
--   "By default, the category creator will be an administrator."
--   "The `Hidden` category can be made invisible to all users who have not
--    explicitly been granted `Category Viewer` permissions."
--                          (platform-security-management/manage-markings)
--
-- A nightly direction-1 item, verified against the page's prose (not just the
-- screenshot). can_see_marking_category() already carried the ASSUMED-viewer
-- rules — marking members and marking-role holders see the category — and
-- 472 adds the explicit grants beside them. Existing categories backfill
-- their creator as administrator, or the guard would brick them.

CREATE TABLE public.marking_category_permissions (
  category_id uuid NOT NULL REFERENCES public.marking_categories(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('administrator','viewer')),
  granted_at  timestamptz NOT NULL DEFAULT now(),
  granted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (category_id, user_id)
);

COMMENT ON TABLE public.marking_category_permissions IS
  'The explicit category grants. Marking members and marking-role holders are ASSUMED viewers — "these users will not appear in API results as category viewers but should be assumed" — and live in their own tables, not here.';

CREATE INDEX marking_category_permissions_user_idx
  ON public.marking_category_permissions (user_id);

CREATE OR REPLACE FUNCTION public.is_category_admin(p_category uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.marking_category_permissions
                  WHERE category_id = p_category AND user_id = auth.uid()
                    AND role = 'administrator')
$$;

REVOKE ALL ON FUNCTION public.is_category_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_category_admin(uuid) TO authenticated;

ALTER TABLE public.marking_category_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grants visible with the category" ON public.marking_category_permissions
  FOR SELECT USING (public.can_see_marking_category(category_id));
-- Category administrators manage the grants; org admins keep the bootstrap
-- door the org-wide policy has always held.
CREATE POLICY "category admins manage grants" ON public.marking_category_permissions
  FOR ALL USING (public.is_category_admin(category_id)
                 OR public.auth_role() = ANY (ARRAY['owner','admin']))
  WITH CHECK (public.is_category_admin(category_id)
              OR public.auth_role() = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marking_category_permissions TO authenticated;

-- "By default, the category creator will be an administrator."
CREATE OR REPLACE FUNCTION public.seed_category_administrator()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.marking_category_permissions (category_id, user_id, role, granted_by_user_id)
    VALUES (NEW.id, auth.uid(), 'administrator', auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER seed_category_administrator
  AFTER INSERT ON public.marking_categories
  FOR EACH ROW EXECUTE FUNCTION public.seed_category_administrator();

-- Existing categories: the creator becomes what they always were.
INSERT INTO public.marking_category_permissions (category_id, user_id, role)
SELECT c.id, c.created_by_user_id, 'administrator'
  FROM public.marking_categories c
 WHERE c.created_by_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── the two administrator acts, gated ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_category_change()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_category_admin(NEW.id) THEN
    RAISE EXCEPTION 'Markings:CategoryAdministratorOnly — only Category Administrators can change the description and permissions for the category';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_category_change
  BEFORE UPDATE ON public.marking_categories
  FOR EACH ROW EXECUTE FUNCTION public.guard_category_change();

CREATE OR REPLACE FUNCTION public.guard_marking_creation()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_category_admin(NEW.category_id) THEN
    RAISE EXCEPTION 'Markings:CategoryAdministratorOnly — only Category Administrators can create Markings in the category';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_marking_creation
  BEFORE INSERT ON public.markings
  FOR EACH ROW EXECUTE FUNCTION public.guard_marking_creation();

-- ── the explicit grants join the assumed viewers ────────────────────────────
CREATE OR REPLACE FUNCTION public.can_see_marking_category(p_category uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.marking_categories c
     WHERE c.id = p_category
       AND (c.organization_id IS NULL
            OR c.organization_id IS NOT DISTINCT FROM public.auth_org_id())
       AND (c.visibility = 'visible'
            OR EXISTS (SELECT 1 FROM public.markings m
                        JOIN public.marking_members mm ON mm.marking_id = m.id
                       WHERE m.category_id = c.id AND mm.user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.markings m
                        JOIN public.marking_permissions p ON p.marking_id = m.id
                       WHERE m.category_id = c.id AND p.user_id = auth.uid())
            -- "explicitly been granted Category Viewer permissions" — and an
            -- administrator sees what it administers.
            OR EXISTS (SELECT 1 FROM public.marking_category_permissions cp
                       WHERE cp.category_id = c.id AND cp.user_id = auth.uid())))
$function$;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; cat uuid; u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  before text; seen boolean;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('cat-472') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','c472a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','c472b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 'c472a@beacon.test', 'admin', org),
    (u2, 'c472b@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  INSERT INTO public.marking_categories (name, category_type, visibility, organization_id)
  VALUES ('Cat472', 'conjunctive', 'hidden', org) RETURNING id INTO cat;

  -- The creator became an administrator by default, and can create markings.
  IF NOT public.is_category_admin(cat) THEN
    RAISE EXCEPTION 'assertion failed: the category creator must default to administrator';
  END IF;
  INSERT INTO public.markings (name, category_id)
  VALUES ('M472', cat);

  -- Another org admin is NOT a category administrator: both acts refuse.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  BEGIN
    UPDATE public.marking_categories SET description = 'nope' WHERE id = cat;
    RAISE EXCEPTION 'assertion failed: a non-administrator must not change the category';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%CategoryAdministratorOnly%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.markings (name, category_id)
    VALUES ('M472b', cat);
    RAISE EXCEPTION 'assertion failed: a non-administrator must not create markings in the category';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%CategoryAdministratorOnly%' THEN RAISE; END IF;
  END;

  -- Hidden means invisible without a grant — and visible with one.
  seen := public.can_see_marking_category(cat);
  IF seen THEN
    RAISE EXCEPTION 'assertion failed: a hidden category must not be visible without a grant';
  END IF;
  INSERT INTO public.marking_category_permissions (category_id, user_id, role)
  VALUES (cat, u2, 'viewer');
  IF NOT public.can_see_marking_category(cat) THEN
    RAISE EXCEPTION 'assertion failed: a Category Viewer must see the hidden category';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
