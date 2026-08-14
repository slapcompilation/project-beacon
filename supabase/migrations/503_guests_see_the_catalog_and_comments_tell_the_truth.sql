-- The 2026-08-13 nightly gap run (second of the day), retired.
--
-- Two findings, both verified against the live catalog before acting, and the
-- second one larger than reported.
--
-- §1 The docs name six things a guest may view:
--   "A guest of an Organization is a user who can view Projects, files,
--   users, groups, tag categories, and collections in this Organization."
--   (administration/enrollments-and-organizations-access.md)
-- 492 built the first four and said tag categories and collections were
-- "Compass surfaces we do not have — absent, not stubbed". 499 then built
-- them, and nothing widened their reads. The sentence has been half-true
-- since; this finishes it.
--
-- §2 Five table comments still describe the pre-teardown product — the gap
-- run found three, and the sweep for the teardown's dead vocabulary
-- (hotels, reality-graph, "Studio P") found two more. `hotels` is a dropped
-- table and `@beacon/reality-graph` is not a package here. Worse,
-- object_sets' comment says "nothing is materialised", which 477 made false
-- when a static List got object_set_members.
--
-- 487 asserted every table HAS a comment. Nothing can assert a comment is
-- TRUE — but the teardown deleted a specific vocabulary, and its reappearance
-- is checkable, so catalog.test.ts gains that tripwire.

-- ── §1 the catalog opens to guests ──────────────────────────────────────────
-- Additive SELECT policies, the shape 492 used for users and groups:
-- permissive policies OR together, so the org-member policies stay
-- byte-identical and only the reach widens.
--
-- These use the InitPlan form — (select auth_org_ids()) rather than a bare
-- call — because a helper called bare in a policy is evaluated once per ROW.
-- Measured on 200k rows: 1590ms bare, 86ms wrapped. Every policy written
-- from here on takes this form.
CREATE POLICY "guests see tag categories" ON public.tag_categories FOR SELECT
  USING (organization_id = ANY (coalesce((SELECT public.auth_org_ids()), '{}')));

CREATE POLICY "guests see tags" ON public.tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tag_categories c
                  WHERE c.id = category_id
                    AND c.organization_id = ANY (coalesce((SELECT public.auth_org_ids()), '{}'))));

CREATE POLICY "guests see collections" ON public.collections FOR SELECT
  USING (organization_id = ANY (coalesce((SELECT public.auth_org_ids()), '{}')));

CREATE POLICY "guests see collection contents" ON public.collection_resources FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.collections c
                  WHERE c.id = collection_id
                    AND c.organization_id = ANY (coalesce((SELECT public.auth_org_ids()), '{}'))));

-- ── §2 the comments describe what is actually there ─────────────────────────
COMMENT ON TABLE public.organizations IS
  'The tenant, and a mandatory control: an organization IS a marking, so what it marks is visible to its members and to its guests. Every resource resolves to exactly one.';

COMMENT ON TABLE public.object_types IS
  'An object type: api name, label, status and visibility, backed by a datasource and indexed into a real table of its own in the objects schema.';

COMMENT ON TABLE public.link_types IS
  'A link type: the two sides, their cardinality, and the backing that makes the links real — object type foreign keys, or a join dataset.';

COMMENT ON TABLE public.object_sets IS
  'A saved object set: an exploration re-evaluates its filters on every read, a list stores its members in object_set_members. Both resolve through the same engine path.';

COMMENT ON TABLE public.project_role_grants IS
  'Discretionary access, granted at the PROJECT level only (Foundry disables folder/file grants by default). A grant names a user or a group, and sits inside the mandatory organization boundary — it can never widen past it.';

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  host uuid; away uuid; cat uuid; col uuid; tg uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  -- No comment anywhere still speaks the teardown's dead vocabulary.
  SELECT count(*) INTO n FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
     AND obj_description(c.oid, 'pg_class') ~* '(hotel|reality-graph|Studio P)';
  IF n > 0 THEN
    RAISE EXCEPTION '% table comment(s) still describe the pre-teardown product', n;
  END IF;

  INSERT INTO public.organizations (name) VALUES ('guestcat-503-host') RETURNING id INTO host;
  INSERT INTO public.organizations (name) VALUES ('guestcat-503-away') RETURNING id INTO away;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gc503a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gc503b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 'gc503a@beacon.test', 'admin', host),
    (u2, 'gc503b@beacon.test', 'admin', away);

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', host))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.tag_categories (organization_id, name) VALUES (host, 'Region 503') RETURNING id INTO cat;
  INSERT INTO public.tags (category_id, name) VALUES (cat, 'EU') RETURNING id INTO tg;
  INSERT INTO public.collections (organization_id, name) VALUES (host, 'Curated 503') RETURNING id INTO col;
  RESET ROLE;

  -- Before guesthood the away user sees none of it.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', away,
                                        'guest_org_ids', '[]'::json))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.tag_categories WHERE id = cat;
  IF n <> 0 THEN RAISE EXCEPTION 'a non-guest saw a foreign tag category'; END IF;
  SELECT count(*) INTO n FROM public.collections WHERE id = col;
  IF n <> 0 THEN RAISE EXCEPTION 'a non-guest saw a foreign collection'; END IF;
  RESET ROLE;

  -- As a guest, all four kinds open — and stay read-only.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', away,
                                        'guest_org_ids', json_build_array(host::text)))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.tag_categories WHERE id = cat;
  IF n <> 1 THEN RAISE EXCEPTION 'a guest should view the host tag categories'; END IF;
  SELECT count(*) INTO n FROM public.tags WHERE id = tg;
  IF n <> 1 THEN RAISE EXCEPTION 'a guest should view the host tags'; END IF;
  SELECT count(*) INTO n FROM public.collections WHERE id = col;
  IF n <> 1 THEN RAISE EXCEPTION 'a guest should view the host collections'; END IF;

  BEGIN
    INSERT INTO public.collections (organization_id, name) VALUES (host, 'Gatecrash 503');
    RAISE EXCEPTION 'a guest curated a collection in the host organization';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%row-level security%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '503: guests see the catalog, and the comments tell the truth';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
