-- The organization home page URL: the Platform-experience tab the branding
-- arc (649) deliberately deferred as its own chunk, from the same
-- platform-experience reading (§5 and the map entry).
--
--   "An Organization's home page URL can be configured per Organization or per user group in the **Platform experience** tab of Control Panel."
--   — administration/configure-platform-experience.md
--
--   "If certain user groups should be sent to a home page URL that differs from the Organization default, you can add group-specific overrides under **Group override** from the left sidebar. The first entry in that list, where a user is a member of any of the listed groups, will be used."
--   — administration/configure-platform-experience.md
--
-- So the shape is exact: one default per organization, an ORDERED list of
-- overrides, each override carrying its own LIST of groups, and the first
-- override where the user is in ANY of its groups wins. The capture
-- (administration/images/configure-homepage-url.png, read in the reading)
-- adds what the prose leaves out: a URL is absolute or relative, resolution
-- falls back to the organization default when no override matches, and to
-- the platform's own home when nothing is configured at all. This tab has no
-- Enrollment scope — the capture's sidebar lists Organization default and
-- Group override only.
--
-- The resolver answers from the caller's claims, because the answer is
-- per-user: the same organization sends different groups to different homes.
-- Nothing configured returns NULL and the shell keeps its own home — the
-- platform default is the consumer's, not a row here.
--
-- Writers are organization administrators, the same gate and policy shape as
-- 649. The consumer ships in this PR: the shell redirects the root entry
-- once per session.

CREATE TABLE public.home_page_urls (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  url             text NOT NULL CHECK (url ~ '^https?://' OR url ~ '^/'),
  updated_by      uuid REFERENCES public.users(id),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.home_page_urls IS
  'The Organization default home page URL (administration/configure-platform-experience). Absolute or relative, per the capture''s own examples; group overrides live in home_page_overrides.';

CREATE TABLE public.home_page_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url             text NOT NULL CHECK (url ~ '^https?://' OR url ~ '^/'),
  "position"      integer NOT NULL CHECK ("position" >= 0),
  updated_by      uuid REFERENCES public.users(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, "position")
);

COMMENT ON TABLE public.home_page_overrides IS
  'Group-specific home page overrides, an ORDERED list per organization: "The first entry in that list, where a user is a member of any of the listed groups, will be used" (administration/configure-platform-experience).';

CREATE TABLE public.home_page_override_groups (
  override_id uuid NOT NULL REFERENCES public.home_page_overrides(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  PRIMARY KEY (override_id, group_id)
);

COMMENT ON TABLE public.home_page_override_groups IS
  'The groups an override lists — membership in ANY of them matches the override.';

CREATE INDEX home_page_urls_updated_by ON public.home_page_urls (updated_by);
CREATE INDEX home_page_overrides_updated_by ON public.home_page_overrides (updated_by);
CREATE INDEX home_page_override_groups_group ON public.home_page_override_groups (group_id);

CREATE TRIGGER stamp_home_page_urls BEFORE INSERT OR UPDATE ON public.home_page_urls
FOR EACH ROW EXECUTE FUNCTION public.stamp_platform_experience_actor();
CREATE TRIGGER stamp_home_page_overrides BEFORE INSERT OR UPDATE ON public.home_page_overrides
FOR EACH ROW EXECUTE FUNCTION public.stamp_platform_experience_actor();

ALTER TABLE public.home_page_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_page_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_page_override_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "the home url is visible in its org" ON public.home_page_urls
  FOR SELECT USING (public.auth_in_org(organization_id));
CREATE POLICY "org admins set the home url" ON public.home_page_urls
  FOR INSERT WITH CHECK (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins move the home url" ON public.home_page_urls
  FOR UPDATE USING (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'))
  WITH CHECK (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins clear the home url" ON public.home_page_urls
  FOR DELETE USING (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));

CREATE POLICY "overrides are visible in their org" ON public.home_page_overrides
  FOR SELECT USING (public.auth_in_org(organization_id));
CREATE POLICY "org admins add overrides" ON public.home_page_overrides
  FOR INSERT WITH CHECK (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins reorder overrides" ON public.home_page_overrides
  FOR UPDATE USING (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'))
  WITH CHECK (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "org admins remove overrides" ON public.home_page_overrides
  FOR DELETE USING (public.auth_in_org(organization_id)
    AND (SELECT public.auth_role()) IN ('owner', 'admin'));

-- The listing rows compose their parent's predicate rather than restate it.
CREATE POLICY "listed groups follow their override" ON public.home_page_override_groups
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.home_page_overrides o
                             WHERE o.id = override_id
                               AND public.auth_in_org(o.organization_id)));
CREATE POLICY "org admins list groups" ON public.home_page_override_groups
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.home_page_overrides o
                                  WHERE o.id = override_id
                                    AND public.auth_in_org(o.organization_id)
                                    AND (SELECT public.auth_role()) IN ('owner', 'admin')));
CREATE POLICY "org admins unlist groups" ON public.home_page_override_groups
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.home_page_overrides o
                             WHERE o.id = override_id
                               AND public.auth_in_org(o.organization_id)
                               AND (SELECT public.auth_role()) IN ('owner', 'admin')));

-- ── THE RESOLVER ─────────────────────────────────────────────────────────────
-- Per user, from claims: the first override listing any group the caller is
-- in, else the organization default, else NULL — the shell keeps its own
-- home when nothing is configured.
CREATE FUNCTION public.home_page_url()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT o.url FROM public.home_page_overrides o
      WHERE o.organization_id = public.auth_org_id()
        AND EXISTS (SELECT 1 FROM public.home_page_override_groups g
                     WHERE g.override_id = o.id
                       AND g.group_id = ANY (coalesce(public.auth_group_ids(), '{}')))
      ORDER BY o."position" LIMIT 1),
    (SELECT u.url FROM public.home_page_urls u
      WHERE u.organization_id = public.auth_org_id()))
$$;

COMMENT ON FUNCTION public.home_page_url() IS
  'The caller''s home page: the first override (by position) listing any of their groups, falling back to the organization default, then NULL. Invoker rights, answered from claims — the same organization sends different groups to different homes.';

-- ── PROVED BY DOING, as the real role ────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_usr uuid; v_email text;
  v_g1 uuid; v_g2 uuid; v_o1 uuid; v_o2 uuid; v_url text; v_ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe650') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe650') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    v_usr := gen_random_uuid();
    v_email := 'probe650-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe650 g1', 'internal') RETURNING id INTO v_g1;
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe650 g2', 'internal') RETURNING id INTO v_g2;

    -- the admin configures THROUGH the policies
    SET LOCAL ROLE authenticated;
    INSERT INTO public.home_page_urls (organization_id, url) VALUES (v_org, '/gamma');
    INSERT INTO public.home_page_overrides (organization_id, url, "position")
      VALUES (v_org, '/alpha', 0) RETURNING id INTO v_o1;
    INSERT INTO public.home_page_overrides (organization_id, url, "position")
      VALUES (v_org, '/beta', 1) RETURNING id INTO v_o2;
    INSERT INTO public.home_page_override_groups (override_id, group_id)
      VALUES (v_o1, v_g1), (v_o2, v_g2);
    RESET ROLE;

    -- a URL that is neither relative nor http(s) refuses
    v_ok := false;
    BEGIN
      INSERT INTO public.home_page_urls (organization_id, url)
      VALUES (v_org, 'javascript:alert(1)')
      ON CONFLICT (organization_id) DO UPDATE SET url = excluded.url;
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a non-URL home page was accepted'; END IF;

    -- no memberships: the organization default
    SELECT public.home_page_url() INTO v_url;
    IF v_url <> '/gamma' THEN
      RAISE EXCEPTION 'expected the organization default, got %', v_url;
    END IF;

    -- in the second-listed group: the FIRST MATCHING entry, not the first row
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_g2, v_usr);
    SELECT public.home_page_url() INTO v_url;
    IF v_url <> '/beta' THEN
      RAISE EXCEPTION 'expected the first matching override, got %', v_url;
    END IF;

    -- in both: the first entry in the list wins
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_g1, v_usr);
    SELECT public.home_page_url() INTO v_url;
    IF v_url <> '/alpha' THEN
      RAISE EXCEPTION 'expected the first entry to win, got %', v_url;
    END IF;

    -- nothing configured at all: NULL, and the shell keeps its own home
    DELETE FROM public.home_page_overrides WHERE organization_id = v_org;
    DELETE FROM public.home_page_urls WHERE organization_id = v_org;
    SELECT public.home_page_url() INTO v_url;
    IF v_url IS NOT NULL THEN
      RAISE EXCEPTION 'expected NULL with nothing configured, got %', v_url;
    END IF;

    -- a member may read the configuration and may not write it
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    SET LOCAL ROLE authenticated;
    v_ok := false;
    BEGIN
      INSERT INTO public.home_page_urls (organization_id, url) VALUES (v_org, '/x');
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    WHEN OTHERS THEN
      IF sqlerrm ~ 'row-level security' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a member set the home page'; END IF;
    RESET ROLE;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '650 proved: admins configure through the policies, the first matching entry wins over the first row, the default and the nothing-configured NULL both resolve, and a member cannot write';
  END;
END $$;
