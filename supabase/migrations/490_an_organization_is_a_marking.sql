-- An organization is a marking, with primary members and guests.
--
-- "The default Organization markings for new Projects and groups created by
-- the user; by default, resources are restricted to users within the primary
-- Organization." (administration/enrollments-and-organizations-access.md)
--
-- "Every user has exactly one primary Organization." (same page)
--
-- "A guest of an Organization is a user who can view Projects, files, users,
-- groups, tag categories, and collections in this Organization. Guests can
-- be users or groups." (same page)
--
-- "**Organization Marking IDs:** The Marking IDs of all organizations that
-- have the user as a member (primary and guest)."
-- (platform-security-management/manage-granular-policies.md)
--
-- Slice one of readings/enrollments-and-organizations.md: the marking side
-- only. The org's backing marking is auto-provisioned into one system
-- category (ours — no page shows where Foundry files them); membership in it
-- is DERIVED — primary members plus guests — never rows. Guest reach into
-- the org-gated RLS policies is deliberately the next slice.

-- ── the backing marking ─────────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN marking_id uuid REFERENCES public.markings(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.organizations.marking_id IS
  'The marking this organization IS. Note that these are Marking IDs which are UUIDs, not Organization IDs — provisioned with the organization, membership derived (primary + guest).';

-- Provisioning is a system act, not a user minting a marking, so the
-- category-administrator gate learns the two system paths: no caller at all
-- (service and migration, enforce_grant_ceiling's own idiom), and a mint
-- fired from inside another trigger. Direct user inserts stay gated as 472
-- left them.
CREATE OR REPLACE FUNCTION public.guard_marking_creation()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NOT public.is_category_admin(NEW.category_id) THEN
    RAISE EXCEPTION 'Markings:CategoryAdministratorOnly — only Category Administrators can create Markings in the category';
  END IF;
  RETURN NEW;
END $$;

-- One marking per organization, in the one system category. The category has
-- no administrators on purpose: org markings are governed from the
-- organization's own surfaces (guests, permissions), never the category page.
CREATE OR REPLACE FUNCTION public.mint_organization_marking(p_org uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cat uuid; mk uuid;
BEGIN
  SELECT id INTO cat FROM public.marking_categories
   WHERE organization_id IS NULL AND name = 'Organizations';
  IF cat IS NULL THEN
    INSERT INTO public.marking_categories (name, category_type, visibility)
    VALUES ('Organizations', 'conjunctive', 'visible') RETURNING id INTO cat;
  END IF;
  BEGIN
    INSERT INTO public.markings (category_id, name) VALUES (cat, p_name) RETURNING id INTO mk;
  EXCEPTION WHEN unique_violation THEN
    -- Markings are unique per category by name; a namesake org gets a
    -- disambiguated marking name, same identity underneath.
    INSERT INTO public.markings (category_id, name)
    VALUES (cat, p_name || ' (' || left(p_org::text, 8) || ')') RETURNING id INTO mk;
  END;
  UPDATE public.organizations SET marking_id = mk WHERE id = p_org;
  RETURN mk;
END $$;
REVOKE EXECUTE ON FUNCTION public.mint_organization_marking(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.provision_organization_marking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.mint_organization_marking(NEW.id, NEW.name);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_provision_organization_marking AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.provision_organization_marking();

-- Every existing organization gets its marking now.
DO $$
DECLARE o record;
BEGIN
  FOR o IN SELECT id, name FROM public.organizations WHERE marking_id IS NULL LOOP
    PERFORM public.mint_organization_marking(o.id, o.name);
  END LOOP;
END $$;

-- ── guests: the existing table learns the principal pair ────────────────────
-- organization_guests already exists (user-only, empty, feeding the JWT's
-- guest_org_ids through custom_access_token_hook) — audited before building,
-- so this extends rather than recreates. "Guests can be users or groups."
-- The token hook stays user-only on purpose: claims reach is the org-gate
-- half, which is deliberately the NEXT slice; the marking side below derives
-- from this table live, so a group guest crosses marking checks immediately.
ALTER TABLE public.organization_guests
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.organization_guests DROP CONSTRAINT organization_guests_pkey;
ALTER TABLE public.organization_guests ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.organization_guests ADD PRIMARY KEY (id);
ALTER TABLE public.organization_guests
  ADD CONSTRAINT organization_guests_one_principal CHECK (num_nonnulls(user_id, group_id) = 1),
  ADD CONSTRAINT organization_guests_user_key UNIQUE (organization_id, user_id),
  ADD CONSTRAINT organization_guests_group_key UNIQUE (organization_id, group_id);
CREATE INDEX organization_guests_group_idx ON public.organization_guests (group_id);
COMMENT ON TABLE public.organization_guests IS
  'Guest membership: members of other organizations who can view what this organization marks. Guests can be users or groups; primary membership stays public.users.organization_id.';

-- "Users who have Organization X as their primary Organization will always
-- be able to view users who are guests of Organization X" — wider than the
-- old own-row-or-admin read; and a guest sees their own standing, directly
-- or through a group.
DROP POLICY "see my own guest grants" ON public.organization_guests;
CREATE POLICY "members see their org's guests" ON public.organization_guests FOR SELECT
  USING (organization_id = public.auth_org_id()
         OR user_id = auth.uid()
         OR group_id = ANY (public.auth_group_ids()));

-- ── membership in an org marking is derived, never rows ─────────────────────
-- Restated whole from 489; the two new arms answer for an organization's
-- backing marking: the user's primary organization, or a guest row reaching
-- them directly or through a group.
CREATE OR REPLACE FUNCTION public.marking_member(p_marking uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marking_members mm
     WHERE mm.marking_id = p_marking
       AND (mm.user_id = p_user
            OR mm.group_id IN (SELECT public.user_group_ids(p_user))))
  OR EXISTS (
    SELECT 1 FROM public.organizations o
     JOIN public.users u ON u.organization_id = o.id
    WHERE o.marking_id = p_marking AND u.id = p_user)
  OR EXISTS (
    SELECT 1 FROM public.organizations o
     JOIN public.organization_guests g ON g.organization_id = o.id
    WHERE o.marking_id = p_marking
      AND (g.user_id = p_user
           OR g.group_id IN (SELECT public.user_group_ids(p_user))))
$$;

-- The policy attribute, bound: "The Marking IDs of all organizations that
-- have the user as a member (primary and guest)." The caller's primary
-- organization comes from the session, guests from the table.
CREATE OR REPLACE FUNCTION public.auth_org_marking_ids()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT o.marking_id::text), '{}')
    FROM public.organizations o
   WHERE o.marking_id IS NOT NULL
     AND (o.id = public.auth_org_id()
          OR EXISTS (SELECT 1 FROM public.organization_guests g
                      WHERE g.organization_id = o.id
                        AND (g.user_id = auth.uid()
                             OR g.group_id = ANY (public.auth_group_ids()))))
$$;

-- ── the compiler binds the attribute ────────────────────────────────────────
-- Restated whole from 484; the one change is organization_marking_ids, which
-- stops compiling fail-closed. authorized_group_ids still does, until scoped
-- sessions bind it.
CREATE OR REPLACE FUNCTION public.granular_term_sql(
  p_term jsonb, p_fields jsonb, p_alias text,
  OUT o_sql text, OUT o_kind text, OUT o_collection boolean)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s record; el jsonb; parts text[] := '{}';
BEGIN
  SELECT * INTO s FROM public.granular_term_shape(p_term, p_fields);
  o_kind := s.kind; o_collection := s.is_collection;

  IF s.kind = 'user_attribute' THEN
    o_sql := CASE p_term->>'user_attribute'
      WHEN 'user_id'                  THEN 'auth.uid()::text'
      WHEN 'username'                 THEN '(auth.jwt() ->> ''email'')'
      WHEN 'group_ids'                THEN 'public.auth_group_ids()::text[]'
      WHEN 'group_names'              THEN 'public.auth_group_names()'
      WHEN 'authorized_group_ids'     THEN '''{}''::text[]'
      WHEN 'organization_marking_ids' THEN 'public.auth_org_marking_ids()'
      WHEN 'marking_ids'              THEN 'public.auth_marking_ids()'
    END;
  ELSIF s.kind = 'column' THEN
    o_sql := format('%s.%I', p_alias, p_term->>'column');
  ELSE
    IF o_collection THEN
      FOR el IN SELECT * FROM jsonb_array_elements(p_term->'value') LOOP
        parts := parts || CASE WHEN jsonb_typeof(el) = 'string'
          THEN quote_literal(el #>> '{}') ELSE el::text END;
      END LOOP;
      o_sql := 'ARRAY[' || array_to_string(parts, ', ') || ']::text[]';
    ELSIF jsonb_typeof(p_term->'value') = 'string' THEN
      o_sql := quote_literal(p_term->>'value');
    ELSE
      o_sql := p_term->>'value';
    END IF;
  END IF;
END $$;

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  o1 uuid; o2 uuid; m1 uuid; m2 uuid; grp uuid; syscat uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  before text; sqltext text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  -- 0. The backfill left nobody unmarked.
  SELECT count(*) INTO n FROM public.organizations WHERE marking_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION '% organization(s) have no backing marking after backfill', n; END IF;

  INSERT INTO public.organizations (name) VALUES ('Enroll 490 A') RETURNING id INTO o1;
  INSERT INTO public.organizations (name) VALUES ('Enroll 490 B') RETURNING id INTO o2;
  SELECT marking_id INTO m1 FROM public.organizations WHERE id = o1;
  SELECT marking_id INTO m2 FROM public.organizations WHERE id = o2;
  IF m1 IS NULL OR m2 IS NULL THEN
    RAISE EXCEPTION 'a new organization was not provisioned a marking';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e490a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e490b@beacon.test'),
    (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e490c@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 'e490a@beacon.test', 'admin', o1),
    (u2, 'e490b@beacon.test', 'admin', o2);

  -- 1. Primary membership satisfies the org's own marking, and no other.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', o2))::text, true);
  IF NOT public.satisfies_markings(ARRAY[m2]) THEN
    RAISE EXCEPTION 'primary membership should satisfy the organization''s marking';
  END IF;
  IF public.satisfies_markings(ARRAY[m1]) THEN
    RAISE EXCEPTION 'a non-member satisfied a foreign organization''s marking';
  END IF;
  IF NOT (public.auth_org_marking_ids() @> ARRAY[m2::text])
     OR public.auth_org_marking_ids() @> ARRAY[m1::text] THEN
    RAISE EXCEPTION 'auth_org_marking_ids should carry the primary org only, got %',
      public.auth_org_marking_ids();
  END IF;

  -- 2. A guest user crosses; "primary and guest".
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', o1))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.organization_guests (organization_id, user_id) VALUES (o1, u2);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', o2))::text, true);
  IF NOT public.satisfies_markings(ARRAY[m1]) THEN
    RAISE EXCEPTION 'guest membership should satisfy the organization''s marking';
  END IF;
  IF NOT (public.auth_org_marking_ids() @> ARRAY[m1::text, m2::text]) THEN
    RAISE EXCEPTION 'auth_org_marking_ids should carry primary and guest, got %',
      public.auth_org_marking_ids();
  END IF;

  -- 3. A guest group carries its members across.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', o2))::text, true);
  INSERT INTO public.groups (organization_id, name, created_by) VALUES (o2, 'Visitors 490', u2)
  RETURNING id INTO grp;
  INSERT INTO public.group_members (group_id, member_user_id) VALUES (grp, u3);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', o1))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.organization_guests (organization_id, group_id) VALUES (o1, grp);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u3::text,
      'app_metadata', json_build_object('role', 'limited_access', 'org_id', o2))::text, true);
  IF NOT public.satisfies_markings(ARRAY[m1]) THEN
    RAISE EXCEPTION 'a guest group''s member should satisfy the organization''s marking';
  END IF;

  -- 4. The compiler binds the attribute to the derived membership.
  sqltext := public.granular_policy_sql('{"match":"all","rules":[
    {"left":{"user_attribute":"organization_marking_ids"},"comparison":"intersects","right":{"value":["x"]}}]}',
    '[]'::jsonb, 'd');
  IF sqltext NOT LIKE '%auth_org_marking_ids()%' THEN
    RAISE EXCEPTION 'organization_marking_ids should compile to auth_org_marking_ids(), got %', sqltext;
  END IF;

  -- 5. The category gate still holds for a direct user insert.
  SELECT category_id INTO syscat FROM public.markings WHERE id = m1;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', o2))::text, true);
  BEGIN
    INSERT INTO public.markings (category_id, name) VALUES (syscat, 'Rogue 490');
    RAISE EXCEPTION 'a user minted a marking in the system category';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Markings:CategoryAdministratorOnly%' THEN RAISE; END IF;
  END;

  -- 6. One principal per guest row.
  BEGIN
    INSERT INTO public.organization_guests (organization_id, user_id, group_id) VALUES (o1, u3, grp);
    RAISE EXCEPTION 'a guest row accepted two principals';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%num_nonnulls%' AND sqlerrm NOT LIKE '%check constraint%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '490: an organization is a marking; membership is primary and guest, derived';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
