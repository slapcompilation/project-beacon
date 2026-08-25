-- 675: platform_experience carries the viewer's CBAC banner.
--
-- The shell's one branding call gains a 'cbac' key: the classification
-- banner composed from the markings the caller is a member of THAT ARE
-- CBAC-CONFIGURED (have a cbac_marking_colors row). The capture's own
-- wording is conditional — it speaks of a CBAC banner configured for the
-- current user (administration/images/configure-static-banner.png) — and
-- configuration is exactly what the colors table records, so a user none of
-- whose markings are configured gets NULL and the static banner behaves as
-- before 674. Display type:
--
--   "The display type of the banner. Defaults to PORTION_MARKING. BANNER_LINE is the long classification string used in the header of a document; PORTION_MARKING is a short classification string used for individual paragraphs"
--   — api/admin-v2-resources-cbac-banners-get-cbac-banner.md
--
-- The shell's top bar is the header position, so BANNER_LINE — reading that
-- sentence onto our surface is inference, recorded.
--
-- Patched live via pg_get_functiondef with counted anchors (the 669 rule);
-- nothing but the one inserted arm moves. 649's json already carries every
-- platform_banners column, so show_with_classification_banner rides along
-- unpatched — the probe asserts it.

DO $$
DECLARE
  src text;
  anchor text := $a$WHERE b.organization_id = p_org AND b.enabled))$a$;
  replacement text := $r$WHERE b.organization_id = p_org AND b.enabled),
    'cbac', (SELECT CASE WHEN s.ids IS NULL THEN NULL
                    ELSE (SELECT to_jsonb(b2.*) FROM public.cbac_banner(s.ids, 'BANNER_LINE') b2) END
               FROM (SELECT (SELECT array_agg(cc.marking_id)
                               FROM public.cbac_marking_colors cc
                              WHERE public.marking_member(cc.marking_id, auth.uid())) AS ids) s))$r$;
  i int;
BEGIN
  src := replace(pg_get_functiondef('public.platform_experience(uuid)'::regprocedure), chr(13), '');
  i := position(anchor IN src);
  IF i = 0 OR position(anchor IN substring(src FROM i + length(anchor))) > 0 THEN
    RAISE EXCEPTION 'anchor must occur exactly once in platform_experience';
  END IF;
  EXECUTE replace(src, anchor, replacement);
END $$;

COMMENT ON FUNCTION public.platform_experience(uuid) IS
  'The shell''s one branding call: resolved title (org, enrollment, then Beacon), the four logos through the fallback table as data URLs, the enabled banner if any, and since 675 the caller''s CBAC banner — composed over the caller''s CBAC-configured marking memberships, NULL when none. Invoker rights — RLS decides what each caller''s scope shows.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; cat uuid; mk uuid; x jsonb; before text;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('cbac-675') RETURNING id INTO org;
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cbac675a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cbac675b@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'cbac675a@beacon.test', 'admin', org),
      (u2, 'cbac675b@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.marking_categories (name, category_type, organization_id)
    VALUES ('DELTA-675', 'conjunctive', org) RETURNING id INTO cat;
    INSERT INTO public.markings (category_id, name) VALUES (cat, 'MOCK CONFIDENTIAL') RETURNING id INTO mk;
    INSERT INTO public.cbac_marking_colors (marking_id, background_color) VALUES (mk, '#1F4B99');
    INSERT INTO public.marking_members (marking_id, user_id) VALUES (mk, u1);
    INSERT INTO public.platform_banners (organization_id, enabled, text) VALUES (org, true, 'static 675');

    -- 1. A member of a configured marking wears the banner.
    x := public.platform_experience(org);
    IF x->'cbac'->>'classification_string' IS DISTINCT FROM 'MOCK CONFIDENTIAL' THEN
      RAISE EXCEPTION 'the configured membership should compose the banner, got %', x->'cbac';
    END IF;
    IF x->'cbac'->'background_colors'->>0 IS DISTINCT FROM '#1F4B99' THEN
      RAISE EXCEPTION 'the banner should carry the configured stripe';
    END IF;

    -- 2. The static banner json carries the 674 toggle for the shell to read.
    IF NOT (x->'banner' ? 'show_with_classification_banner') THEN
      RAISE EXCEPTION 'the banner json should carry show_with_classification_banner';
    END IF;

    -- 3. A caller with no configured membership gets NULL, not an error.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'member', 'org_id', org))::text, true);
    x := public.platform_experience(org);
    IF x->'cbac' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'no configured membership should mean no CBAC banner, got %', x->'cbac';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '675 proved: a configured membership composes the shell banner with its stripe, the static banner json carries the toggle, and an unconfigured caller gets NULL rather than an error';
  END;
END $$;
