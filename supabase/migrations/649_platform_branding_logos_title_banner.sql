-- Platform branding: the three Platform-experience tabs this platform can
-- hold — logo, title, static banner. Built from the platform-experience
-- reading, whose Decisions block the operator approved whole (the web shell
-- consumers ship in the same PR). 640 dropped the wrong shape
-- (`organizations.logo_url`, one URL) and recorded this as the right one.
--
--   "The platform logo can be configured per Enrollment and Organization, replacing any occurrences of the default Palantir logo with an image of your choice. You can provide up to four different logo sizes: favicon, small, medium, and large. If you do not provide an image for each size, then Foundry uses an appropriate fallback size. The favicon does not have any fallback behavior. When customizing your logo, you should upload a favicon and *at least* one of the other three sizes."
--   — administration/configure-platform-experience.md
--
-- ── SCOPE ────────────────────────────────────────────────────────────────────
-- A nullable organization_id: NULL is the Enrollment row, because this
-- deployment IS the enrollment and no enrollments table exists to point at.
--
--   "You can configure platform logos per Enrollment if you have **Enrollment administrator** permissions. If you do not have those permissions, then you can only configure logos per Organization."
--   — administration/configure-platform-experience.md
--
-- Organization administrators therefore write ORGANIZATION rows only; the
-- enrollment scope has NO writer until enrollment-level permissions exist —
-- the write policies simply never admit organization_id IS NULL, which keeps
-- the missing half fail-closed rather than invented around. Precedence when
-- both scopes hold a value is unstated on the page; the resolver takes the
-- organization row first, marked as inference in the reading (Decision 5).
--
-- ── VOCABULARIES ─────────────────────────────────────────────────────────────
-- Sizes and banner positions are in the prose and carry declarations. The
-- content types are only in the capture — SVG and PNG recommended, JPEG and
-- GIF also supported, per administration/images/configure-platform-logo.png
-- as the platform-experience reading records verbatim — so their set lives in
-- a function, the shape a set without a PAGE takes here
-- (project_activity_actions precedent).
--
-- The banner's colors, position control, and print toggle are the capture's
-- half of the spec (administration/images/configure-static-banner.png):
-- defaults #FFFFFF on #2D72D2, Top selected, Show when printing on. The
-- show-with-classification-banner toggle is NOT built: no CBAC banner exists
-- here for it to interact with (reading, Decision 6).
--
-- Inference, marked: the default platform title here is 'Beacon' — the page's
-- default is `Palantir`, and the mechanism is what is copied, not the
-- trademark. The 1 MiB per-image cap is ours; the page publishes none.

-- ── THE TABLES ───────────────────────────────────────────────────────────────

CREATE FUNCTION public.platform_logo_content_types()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['image/svg+xml', 'image/png', 'image/jpeg', 'image/gif']
$$;

COMMENT ON FUNCTION public.platform_logo_content_types() IS
  'The four formats the logo upload accepts, from the capture (administration/images/configure-platform-logo.png): SVG and PNG recommended, JPEG and GIF also supported. A function because the set''s source is a screenshot, not a page the declared-set suite could grep.';

CREATE TABLE public.platform_logos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  size            text NOT NULL CHECK (size = ANY (ARRAY['favicon', 'small', 'medium', 'large'])),
  content_type    text NOT NULL CHECK (content_type = ANY (public.platform_logo_content_types())),
  image           bytea NOT NULL CHECK (octet_length(image) BETWEEN 1 AND 1048576),
  updated_by      uuid REFERENCES public.users(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (organization_id, size)
);

COMMENT ON TABLE public.platform_logos IS
  'One row per scope and size (administration/configure-platform-experience). organization_id NULL is the Enrollment scope. The fallback table lives in platform_logo(), never here.';

COMMENT ON CONSTRAINT platform_logos_size_check ON public.platform_logos IS
  'Values from administration/configure-platform-experience — "You can provide up to four different logo sizes: favicon, small, medium, and large."';

CREATE TABLE public.platform_titles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (length(btrim(title)) > 0),
  updated_by      uuid REFERENCES public.users(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (organization_id)
);

COMMENT ON TABLE public.platform_titles IS
  '"The platform title can be configured per Enrollment and Organization and replaces references to the platform with the provided title" (administration/configure-platform-experience). One row per scope; the default when no row holds is Beacon, this platform''s own name.';

CREATE TABLE public.platform_banners (
  organization_id    uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled            boolean NOT NULL DEFAULT false,
  text               text NOT NULL DEFAULT '',
  text_color         text NOT NULL DEFAULT '#FFFFFF' CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  banner_color       text NOT NULL DEFAULT '#2D72D2' CHECK (banner_color ~ '^#[0-9A-Fa-f]{6}$'),
  "position"         text NOT NULL DEFAULT 'top'
                     CHECK ("position" = ANY (ARRAY['top', 'bottom', 'top_and_bottom'])),
  show_when_printing boolean NOT NULL DEFAULT true,
  updated_by         uuid REFERENCES public.users(id),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_banners IS
  'The per-Organization static banner (administration/configure-platform-experience): disabled by default, markdown text, and the capture''s half of the spec — text and banner colors, position, print visibility (administration/images/configure-static-banner.png).';

COMMENT ON CONSTRAINT platform_banners_position_check ON public.platform_banners IS
  'Values from administration/configure-platform-experience — "renders at the top, bottom, or top and bottom of every page".';

CREATE INDEX platform_logos_updated_by ON public.platform_logos (updated_by);
CREATE INDEX platform_titles_updated_by ON public.platform_titles (updated_by);
CREATE INDEX platform_banners_updated_by ON public.platform_banners (updated_by);

-- who saved, when a profile exists to name (637's shape, local columns)
CREATE FUNCTION public.stamp_platform_experience_actor() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  SELECT u.id INTO NEW.updated_by FROM public.users u WHERE u.id = auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER stamp_platform_logos BEFORE INSERT OR UPDATE ON public.platform_logos
FOR EACH ROW EXECUTE FUNCTION public.stamp_platform_experience_actor();
CREATE TRIGGER stamp_platform_titles BEFORE INSERT OR UPDATE ON public.platform_titles
FOR EACH ROW EXECUTE FUNCTION public.stamp_platform_experience_actor();
CREATE TRIGGER stamp_platform_banners BEFORE INSERT OR UPDATE ON public.platform_banners
FOR EACH ROW EXECUTE FUNCTION public.stamp_platform_experience_actor();

-- ── POLICIES ─────────────────────────────────────────────────────────────────
-- Reads: branding is for everyone the scope covers. Writes: organization
-- administrators, organization rows only — per command, never FOR ALL (619),
-- zero-argument helpers wrapped as InitPlans.

ALTER TABLE public.platform_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branding is visible in its scope" ON public.platform_logos
  FOR SELECT USING (organization_id IS NULL OR public.auth_in_org(organization_id));
CREATE POLICY "org admins brand their org" ON public.platform_logos
  FOR INSERT WITH CHECK (organization_id IS NOT NULL
    AND public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins rebrand their org" ON public.platform_logos
  FOR UPDATE USING (organization_id IS NOT NULL
    AND public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'))
  WITH CHECK (organization_id IS NOT NULL
    AND public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins unbrand their org" ON public.platform_logos
  FOR DELETE USING (organization_id IS NOT NULL
    AND public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));

CREATE POLICY "titles are visible in their scope" ON public.platform_titles
  FOR SELECT USING (organization_id IS NULL OR public.auth_in_org(organization_id));
CREATE POLICY "org admins title their org" ON public.platform_titles
  FOR INSERT WITH CHECK (organization_id IS NOT NULL
    AND public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins retitle their org" ON public.platform_titles
  FOR UPDATE USING (organization_id IS NOT NULL
    AND public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'))
  WITH CHECK (organization_id IS NOT NULL
    AND public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins untitle their org" ON public.platform_titles
  FOR DELETE USING (organization_id IS NOT NULL
    AND public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));

CREATE POLICY "the banner is visible in its org" ON public.platform_banners
  FOR SELECT USING (public.auth_in_org(organization_id));
CREATE POLICY "org admins raise the banner" ON public.platform_banners
  FOR INSERT WITH CHECK (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins adjust the banner" ON public.platform_banners
  FOR UPDATE USING (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'))
  WITH CHECK (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins lower the banner" ON public.platform_banners
  FOR DELETE USING (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));

-- ── THE RESOLVER: the page's fallback table, executable ──────────────────────
--   Favicon → (none); Small → Medium, Large; Medium → Small, Large;
--   Large → Medium, Small. Within a size, the organization row beats the
--   enrollment row; an exact size in either scope beats any fallback size.
CREATE FUNCTION public.platform_logo(p_org uuid, p_size text)
RETURNS TABLE (content_type text, image bytea)
LANGUAGE plpgsql STABLE AS $$
DECLARE s text; sizes text[];
BEGIN
  sizes := CASE p_size
    WHEN 'favicon' THEN ARRAY['favicon']
    WHEN 'small'   THEN ARRAY['small', 'medium', 'large']
    WHEN 'medium'  THEN ARRAY['medium', 'small', 'large']
    WHEN 'large'   THEN ARRAY['large', 'medium', 'small']
  END;
  IF sizes IS NULL THEN
    RAISE EXCEPTION 'Branding:NoSuchSize — % is not one of favicon, small, medium, large', p_size;
  END IF;
  FOREACH s IN ARRAY sizes LOOP
    RETURN QUERY
      SELECT l.content_type, l.image FROM public.platform_logos l
       WHERE l.size = s AND (l.organization_id = p_org OR l.organization_id IS NULL)
       ORDER BY l.organization_id NULLS LAST LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.platform_logo(uuid, text) IS
  'The published fallback table, executable: exact size (org row, then enrollment row), then the size''s own preference order. "The favicon does not have any fallback behavior" — its list is itself alone.';

-- One call for the shell: title, the four logos as data URLs, the banner.
CREATE FUNCTION public.platform_experience(p_org uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'title', coalesce(
      (SELECT t.title FROM public.platform_titles t WHERE t.organization_id = p_org),
      (SELECT t.title FROM public.platform_titles t WHERE t.organization_id IS NULL),
      'Beacon'),
    'logos', (SELECT jsonb_object_agg(sz, u) FROM (
      SELECT sz, 'data:' || r.content_type || ';base64,' ||
                 replace(encode(r.image, 'base64'), E'\n', '') AS u
        FROM unnest(ARRAY['favicon', 'small', 'medium', 'large']) sz
       CROSS JOIN LATERAL public.platform_logo(p_org, sz) r) resolved),
    'banner', (SELECT to_jsonb(b) - 'organization_id' - 'updated_by' - 'updated_at'
                 FROM public.platform_banners b
                WHERE b.organization_id = p_org AND b.enabled))
$$;

COMMENT ON FUNCTION public.platform_experience(uuid) IS
  'The shell''s one branding call: resolved title (org, enrollment, then Beacon), the four logos through the fallback table as data URLs, and the enabled banner if any. Invoker rights — RLS decides what each caller''s scope shows.';

-- ── PROVED BY DOING, as the real role ────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_org2 uuid; v_sp uuid; v_usr uuid; v_email text;
  v_ct text; v_img bytea; v_x jsonb; v_ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe649') RETURNING id INTO v_org;
    INSERT INTO public.organizations (name) VALUES ('probe649b') RETURNING id INTO v_org2;
    INSERT INTO public.spaces (name) VALUES ('probe649') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    v_usr := gen_random_uuid();
    v_email := 'probe649-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- the enrollment scope is planted at the operator's seat: no policy
    -- admits it, which is the fail-closed half of the callout
    INSERT INTO public.platform_logos (organization_id, size, content_type, image)
    VALUES (NULL, 'small', 'image/png', convert_to('S-enr', 'UTF8')),
           (NULL, 'large', 'image/png', convert_to('L-enr', 'UTF8'));

    -- an organization administrator writes org rows THROUGH the policy
    SET LOCAL ROLE authenticated;
    INSERT INTO public.platform_logos (organization_id, size, content_type, image)
    VALUES (v_org, 'favicon', 'image/png', convert_to('F-org', 'UTF8')),
           (v_org, 'medium', 'image/svg+xml', convert_to('M-org', 'UTF8'));
    INSERT INTO public.platform_titles (organization_id, title) VALUES (v_org, 'Acme');
    INSERT INTO public.platform_banners (organization_id, enabled, text)
    VALUES (v_org, true, 'Scheduled maintenance Sunday');

    -- and may NOT write the enrollment scope
    v_ok := false;
    BEGIN
      INSERT INTO public.platform_logos (organization_id, size, content_type, image)
      VALUES (NULL, 'favicon', 'image/png', convert_to('x', 'UTF8'));
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN v_ok := true;
    WHEN OTHERS THEN IF sqlerrm ~ 'row-level security' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'an org admin wrote the enrollment scope'; END IF;
    RESET ROLE;

    -- a member is refused entirely
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    SET LOCAL ROLE authenticated;
    v_ok := false;
    BEGIN
      INSERT INTO public.platform_logos (organization_id, size, content_type, image)
      VALUES (v_org, 'large', 'image/png', convert_to('x', 'UTF8'));
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    WHEN OTHERS THEN
      IF sqlerrm ~ 'row-level security' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a member branded the organization'; END IF;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- the fallback table, all four directions
    SELECT r.image INTO v_img FROM public.platform_logo(v_org, 'favicon') r;
    IF convert_from(v_img, 'UTF8') <> 'F-org' THEN
      RAISE EXCEPTION 'the exact org favicon did not win';
    END IF;
    SELECT r.image INTO v_img FROM public.platform_logo(v_org, 'small') r;
    IF convert_from(v_img, 'UTF8') <> 'S-enr' THEN
      RAISE EXCEPTION 'the exact enrollment size did not beat a fallback size';
    END IF;
    DELETE FROM public.platform_logos WHERE organization_id IS NULL AND size = 'large';
    SELECT r.image INTO v_img FROM public.platform_logo(v_org, 'large') r;
    IF convert_from(v_img, 'UTF8') <> 'M-org' THEN
      RAISE EXCEPTION 'large did not fall back to medium first';
    END IF;
    -- "The favicon does not have any fallback behavior."
    IF EXISTS (SELECT 1 FROM public.platform_logo(v_org2, 'favicon')) THEN
      RAISE EXCEPTION 'a favicon fell back across sizes';
    END IF;

    -- the one shell call: resolved title, data URLs, the enabled banner
    v_x := public.platform_experience(v_org);
    IF v_x ->> 'title' <> 'Acme' THEN
      RAISE EXCEPTION 'the organization title did not resolve';
    END IF;
    IF public.platform_experience(v_org2) ->> 'title' <> 'Beacon' THEN
      RAISE EXCEPTION 'the default title did not resolve';
    END IF;
    IF v_x -> 'logos' ->> 'favicon' !~ '^data:image/png;base64,' THEN
      RAISE EXCEPTION 'the favicon did not arrive as a data URL';
    END IF;
    IF v_x -> 'banner' ->> 'position' <> 'top'
       OR v_x -> 'banner' ->> 'banner_color' <> '#2D72D2'
       OR (v_x -> 'banner' ->> 'show_when_printing')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'the banner did not carry the capture''s defaults';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '649 proved: org admins brand through the policy and cannot reach the enrollment scope, a member cannot brand at all, the fallback table resolves all four directions, and the shell call carries title, data URLs and the banner defaults';
  END;
END $$;
