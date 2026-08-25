-- 674: CBAC — the classification banner, marking restrictions, and the
-- disjunctive citation 399's CHECK said it was waiting for.
--
--   "Returns a classification banner string and colors for the given set of marking IDs."
--   — api/admin-v2-resources-cbac-banners-get-cbac-banner.md
--
--   "The display type of the banner. Defaults to PORTION_MARKING. BANNER_LINE is the long classification string used in the header of a document; PORTION_MARKING is a short classification string used for individual paragraphs"
--   — api/admin-v2-resources-cbac-banners-get-cbac-banner.md
--
--   "A user-facing message describing a classification level, for example, MOCK TOP SECRET//NOFORN."
--   — api/admin-v2-resources-cbac-banners-cbac-banner-basics.md
--
-- The restrictions resource defines three relations and two verdicts:
--
--   "Markings that cannot appear in conjunction with the provided markings. This includes all such markings, not just those present in the provided set."
--   — api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md
--
--   "Markings that are automatically granted when a user has membership in any of the provided markings."
--   — api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md
--
--   "Markings that must appear in conjunction with the provided markings. Each list contains the requirements for one of the provided markings, and at least one marking from each must be included in the provided markingIds to constitute a valid classification."
--   — api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md
--
--   "True if the current user satisfies the provided markings. The user must be a member of all conjunctive markings. The provided disjunctive markings are grouped by category, and the user must be a member of at least one marking in each group."
--   — api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md
--
--   "True if the provided markings constitute a valid classification, containing no disallowed markings and satisfying all required marking constraints."
--   — api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions.md
--
-- That userSatisfiesMarkings sentence is the citation 399 planned for: its
-- category_type CHECK admits only 'conjunctive', with a comment saying the
-- disjunctive value gets added here when a page attests it. This page does.
-- satisfies_markings learns the full rule; with zero disjunctive categories
-- and zero implied rows — the state the database is in — the new definition
-- reduces to the old one, and the probe asserts the old cases unchanged.
--
-- Inference, marked: the // separator is the basics page's own example; the
-- category-then-name ordering, the white text color, and single-level (not
-- transitive) implication are ours (readings/cbac.md, Questions 1-3). Both
-- display types return the same string — markings hold no short form to
-- shorten to, a recorded divergence rather than invented initials.
--
-- 463 dropped markings.color as invented — no markings page says colour.
-- The banner api is the first page that does, and only in banner
-- composition, so the colors live in a CBAC side table and the marking row
-- stays uncolored; 463's deletion stands. (readings/cbac.md records that my
-- first substrate probe read 399 and missed 463.)
--
-- 649's blocked toggle also lands: platform_banners refused the
-- show-with-classification-banner column while no CBAC banner existed for it
-- to interact with (administration/images/configure-static-banner.png). Now
-- one does.

-- ── 'disjunctive' joins the category vocabulary, with its citation ──────────

ALTER TABLE public.marking_categories
  DROP CONSTRAINT marking_categories_category_type_check;
ALTER TABLE public.marking_categories
  ADD CONSTRAINT marking_categories_category_type_check
  CHECK (category_type IN ('conjunctive', 'disjunctive'));
COMMENT ON CONSTRAINT marking_categories_category_type_check ON public.marking_categories IS
  'Values from api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions: the user must be a member of all conjunctive markings, and the provided disjunctive markings are grouped by category with at least one membership required per group.';

-- ── the three restriction relations, real columns each ──────────────────────

CREATE TABLE public.marking_disallowed (
  marking_id            uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  disallowed_marking_id uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  PRIMARY KEY (marking_id, disallowed_marking_id),
  CHECK (marking_id <> disallowed_marking_id)
);
COMMENT ON TABLE public.marking_disallowed IS
  'A directed pair evaluated symmetrically: the two markings cannot appear in conjunction (api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions).';
CREATE INDEX marking_disallowed_reverse_idx
  ON public.marking_disallowed (disallowed_marking_id);

CREATE TABLE public.marking_implied (
  marking_id         uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  implied_marking_id uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  PRIMARY KEY (marking_id, implied_marking_id),
  CHECK (marking_id <> implied_marking_id)
);
COMMENT ON TABLE public.marking_implied IS
  'Membership in marking_id automatically grants implied_marking_id for satisfaction. Single-level — no transitive closure, an inference recorded in readings/cbac.md Question 3.';
CREATE INDEX marking_implied_reverse_idx
  ON public.marking_implied (implied_marking_id);

CREATE TABLE public.marking_requirements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marking_id   uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  alternatives uuid[] NOT NULL CHECK (cardinality(alternatives) > 0)
);
COMMENT ON TABLE public.marking_requirements IS
  'One row per requirement list: at least one of the alternatives must accompany marking_id to constitute a valid classification (api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions).';
CREATE INDEX marking_requirements_marking_idx
  ON public.marking_requirements (marking_id);

CREATE TABLE public.cbac_marking_colors (
  marking_id       uuid PRIMARY KEY REFERENCES public.markings(id) ON DELETE CASCADE,
  background_color text NOT NULL CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$')
);
COMMENT ON TABLE public.cbac_marking_colors IS
  'The banner''s backgroundColors, one stripe per configured marking (api/admin-v2-resources-cbac-banners-get-cbac-banner). A side table because 463 dropped markings.color as uncited — this api attests color only in banner composition.';

-- Postgres cannot FK an array's elements; a dangling alternative would
-- silently never satisfy, so a trigger holds the fact instead.
CREATE FUNCTION public.guard_requirement_markings()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bad uuid;
BEGIN
  SELECT a.id INTO bad FROM unnest(NEW.alternatives) AS a(id)
   WHERE NOT EXISTS (SELECT 1 FROM public.markings m WHERE m.id = a.id)
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cbac:CbacMarkingRestrictionsNotFound — alternative % names no marking', bad;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_requirement_markings
  BEFORE INSERT OR UPDATE ON public.marking_requirements
  FOR EACH ROW EXECUTE FUNCTION public.guard_requirement_markings();

-- Read like markings themselves: visible with the category, authored by
-- admins — the 399 policy shapes, helpers initplan-wrapped per 505.
ALTER TABLE public.marking_disallowed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marking_implied ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marking_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbac_marking_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see colors of visible categories" ON public.cbac_marking_colors
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.markings m
                             WHERE m.id = marking_id
                               AND public.can_see_marking_category(m.category_id)));
CREATE POLICY "admins author colors" ON public.cbac_marking_colors
  FOR ALL USING ((SELECT public.auth_role()) IN ('owner','admin'))
          WITH CHECK ((SELECT public.auth_role()) IN ('owner','admin'));

CREATE POLICY "see restrictions of visible categories" ON public.marking_disallowed
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.markings m
                             WHERE m.id = marking_id
                               AND public.can_see_marking_category(m.category_id)));
CREATE POLICY "admins author restrictions" ON public.marking_disallowed
  FOR ALL USING ((SELECT public.auth_role()) IN ('owner','admin'))
          WITH CHECK ((SELECT public.auth_role()) IN ('owner','admin'));
CREATE POLICY "see implications of visible categories" ON public.marking_implied
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.markings m
                             WHERE m.id = marking_id
                               AND public.can_see_marking_category(m.category_id)));
CREATE POLICY "admins author implications" ON public.marking_implied
  FOR ALL USING ((SELECT public.auth_role()) IN ('owner','admin'))
          WITH CHECK ((SELECT public.auth_role()) IN ('owner','admin'));
CREATE POLICY "see requirements of visible categories" ON public.marking_requirements
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.markings m
                             WHERE m.id = marking_id
                               AND public.can_see_marking_category(m.category_id)));
CREATE POLICY "admins author requirements" ON public.marking_requirements
  FOR ALL USING ((SELECT public.auth_role()) IN ('owner','admin'))
          WITH CHECK ((SELECT public.auth_role()) IN ('owner','admin'));

-- ── satisfies_markings learns the whole rule ────────────────────────────────
-- Redefined whole, as 407 and 489 each did. Three conjuncts: an id naming no
-- marking satisfies nothing (the pre-CBAC behaviour, preserved — a bare join
-- would let an unknown id drop out and satisfy vacuously); every conjunctive
-- marking is held; each disjunctive category group has at least one held.
-- Held = direct membership, or one implication step from a membership.

CREATE OR REPLACE FUNCTION public.satisfies_markings(p_markings uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  WITH provided AS (
    SELECT DISTINCT m.id, m.category_id, c.category_type
      FROM unnest(coalesce(p_markings, '{}'::uuid[])) AS u(id)
      JOIN public.markings m ON m.id = u.id
      JOIN public.marking_categories c ON c.id = m.category_id
  ), held AS (
    SELECT p.id FROM provided p
     WHERE public.marking_member(p.id, auth.uid())
        OR EXISTS (SELECT 1 FROM public.marking_implied mi
                    WHERE mi.implied_marking_id = p.id
                      AND public.marking_member(mi.marking_id, auth.uid()))
  )
  SELECT NOT EXISTS (
           SELECT 1 FROM unnest(coalesce(p_markings, '{}'::uuid[])) AS u(id)
            WHERE NOT EXISTS (SELECT 1 FROM provided p WHERE p.id = u.id))
     AND NOT EXISTS (
           SELECT 1 FROM provided p
            WHERE p.category_type = 'conjunctive'
              AND NOT EXISTS (SELECT 1 FROM held h WHERE h.id = p.id))
     AND NOT EXISTS (
           SELECT 1 FROM provided p
           LEFT JOIN held h ON h.id = p.id
            WHERE p.category_type = 'disjunctive'
            GROUP BY p.category_id
           HAVING count(h.id) = 0)
$$;

-- ── the banner ──────────────────────────────────────────────────────────────

CREATE FUNCTION public.cbac_banner(p_marking_ids uuid[], p_display_type text DEFAULT 'PORTION_MARKING')
RETURNS TABLE (classification_string text, markings uuid[], text_color text, background_colors text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE bad uuid;
BEGIN
  IF p_display_type NOT IN ('BANNER_LINE', 'PORTION_MARKING') THEN
    RAISE EXCEPTION 'Cbac:UnknownClassificationBannerDisplayType — % is neither BANNER_LINE nor PORTION_MARKING', p_display_type;
  END IF;
  IF p_marking_ids IS NULL OR cardinality(p_marking_ids) = 0 THEN
    RAISE EXCEPTION 'Cbac:CbacUnavailable — no markings were provided, so no banner exists';
  END IF;
  SELECT u.id INTO bad FROM unnest(p_marking_ids) AS u(id)
   WHERE NOT EXISTS (SELECT 1 FROM public.markings m WHERE m.id = u.id) LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cbac:CbacBannerNotFound — % names no marking', bad;
  END IF;
  SELECT u.id INTO bad FROM unnest(p_marking_ids) AS u(id)
    JOIN public.markings m ON m.id = u.id
   WHERE NOT public.can_see_marking_category(m.category_id) LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cbac:GetCbacBannerPermissionDenied — the caller cannot see marking %', bad;
  END IF;
  RETURN QUERY
  SELECT string_agg(x.name, '//' ORDER BY x.category_name, x.name),
         array_agg(x.id ORDER BY x.category_name, x.name),
         '#FFFFFF'::text,
         coalesce(array_agg(x.background_color ORDER BY x.category_name, x.name)
                    FILTER (WHERE x.background_color IS NOT NULL), '{}'::text[])
    FROM (SELECT DISTINCT m.id, m.name, cc.background_color, c.name AS category_name
            FROM unnest(p_marking_ids) AS u(id)
            JOIN public.markings m ON m.id = u.id
            JOIN public.marking_categories c ON c.id = m.category_id
            LEFT JOIN public.cbac_marking_colors cc ON cc.marking_id = m.id) x;
END $$;
COMMENT ON FUNCTION public.cbac_banner(uuid[], text) IS
  'The classification banner for a set of markings (api/admin-v2-resources-cbac-banners-get-cbac-banner): names joined // in category-then-name order, the markings'' own colors as the background stripe. Both display types return the same string — no short form is stored to shorten to (readings/cbac.md, Decision 1).';

-- ── the restrictions ────────────────────────────────────────────────────────

CREATE FUNCTION public.cbac_marking_restrictions(p_marking_ids uuid[])
RETURNS TABLE (disallowed_markings uuid[], implied_markings uuid[], required_markings jsonb,
               user_satisfies_markings boolean, is_valid boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE bad uuid; ids uuid[] := coalesce(p_marking_ids, '{}');
BEGIN
  IF cardinality(ids) = 0 THEN
    RAISE EXCEPTION 'Cbac:CbacUnavailable — no markings were provided, so no restrictions exist';
  END IF;
  SELECT u.id INTO bad FROM unnest(ids) AS u(id)
   WHERE NOT EXISTS (SELECT 1 FROM public.markings m WHERE m.id = u.id) LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cbac:CbacMarkingRestrictionsNotFound — % names no marking', bad;
  END IF;
  SELECT u.id INTO bad FROM unnest(ids) AS u(id)
    JOIN public.markings m ON m.id = u.id
   WHERE NOT public.can_see_marking_category(m.category_id) LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cbac:GetCbacMarkingRestrictionInfoPermissionDenied — the caller cannot see marking %', bad;
  END IF;
  RETURN QUERY
  SELECT
    (SELECT coalesce(array_agg(DISTINCT d.other), '{}'::uuid[]) FROM (
       SELECT md.disallowed_marking_id AS other FROM public.marking_disallowed md
        WHERE md.marking_id = ANY (ids)
       UNION
       SELECT md.marking_id FROM public.marking_disallowed md
        WHERE md.disallowed_marking_id = ANY (ids)) d),
    (SELECT coalesce(array_agg(DISTINCT mi.implied_marking_id), '{}'::uuid[])
       FROM public.marking_implied mi WHERE mi.marking_id = ANY (ids)),
    (SELECT coalesce(jsonb_agg(to_jsonb(r.alternatives) ORDER BY r.marking_id, r.id), '[]'::jsonb)
       FROM public.marking_requirements r WHERE r.marking_id = ANY (ids)),
    public.satisfies_markings(ids),
    (NOT EXISTS (SELECT 1 FROM public.marking_disallowed md
                  WHERE md.marking_id = ANY (ids)
                    AND md.disallowed_marking_id = ANY (ids))
     AND NOT EXISTS (SELECT 1 FROM public.marking_requirements r
                      WHERE r.marking_id = ANY (ids)
                        AND NOT (r.alternatives && ids)));
END $$;
COMMENT ON FUNCTION public.cbac_marking_restrictions(uuid[]) IS
  'Disallowed, implied and required markings for a set, with the two verdicts (api/admin-v2-resources-cbac-marking-restrictions-objects-get-cbac-marking-restrictions). userSatisfiesMarkings is answered BY satisfies_markings — composed, never restated.';

-- ── 649's blocked toggle lands ──────────────────────────────────────────────

ALTER TABLE public.platform_banners
  ADD COLUMN show_with_classification_banner boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.platform_banners.show_with_classification_banner IS
  'The capture''s show-with-classification-banner toggle (administration/images/configure-static-banner.png): when a CBAC banner exists for the viewer, the static banner hides beneath it by default; enabling this shows it below. 649 recorded the column as unbuildable while no CBAC banner existed; 674 built the banner.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; org2 uuid; catc uuid; catd uuid; cate uuid;
  mka uuid; mkb uuid; mkc uuid; d1 uuid; d2 uuid; e1 uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  before text; r record; s text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('cbac-674') RETURNING id INTO org;
    INSERT INTO public.organizations (name) VALUES ('cbac-674-other') RETURNING id INTO org2;
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cbac674a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cbac674b@beacon.test'),
      (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cbac674c@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'cbac674a@beacon.test', 'admin', org),
      (u2, 'cbac674b@beacon.test', 'admin', org),
      (u3, 'cbac674c@beacon.test', 'admin', org2);
    -- The category seeds its creator from the claims, so u1 goes first.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.marking_categories (name, category_type, organization_id)
    VALUES ('ALPHA', 'conjunctive', org) RETURNING id INTO catc;
    -- The CHECK now admits the attested second value.
    INSERT INTO public.marking_categories (name, category_type, organization_id)
    VALUES ('BRAVO', 'disjunctive', org) RETURNING id INTO catd;
    INSERT INTO public.marking_categories (name, category_type, organization_id)
    VALUES ('CHARLIE', 'disjunctive', org) RETURNING id INTO cate;
    INSERT INTO public.markings (category_id, name) VALUES (catc, 'MOCK SECRET') RETURNING id INTO mka;
    INSERT INTO public.markings (category_id, name) VALUES (catc, 'MOCK EYES ONLY') RETURNING id INTO mkb;
    INSERT INTO public.markings (category_id, name) VALUES (catc, 'MOCK THIRD') RETURNING id INTO mkc;
    INSERT INTO public.markings (category_id, name) VALUES (catd, 'MOCK REL A') RETURNING id INTO d1;
    INSERT INTO public.markings (category_id, name) VALUES (catd, 'MOCK REL B') RETURNING id INTO d2;
    INSERT INTO public.markings (category_id, name) VALUES (cate, 'MOCK GROUP C') RETURNING id INTO e1;
    INSERT INTO public.cbac_marking_colors (marking_id, background_color)
    VALUES (mka, '#137CBD'), (d1, '#D13913');
    INSERT INTO public.marking_members (marking_id, user_id) VALUES (mka, u2), (d1, u2);

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

    -- 1. The conjunctive cases behave exactly as before the upgrade.
    IF NOT public.satisfies_markings(ARRAY[mka]) THEN RAISE EXCEPTION 'a held conjunctive marking should satisfy'; END IF;
    IF public.satisfies_markings(ARRAY[mka, mkb]) THEN RAISE EXCEPTION 'an unheld conjunctive marking satisfied'; END IF;
    IF NOT public.satisfies_markings(NULL) THEN RAISE EXCEPTION 'NULL markings should satisfy'; END IF;
    IF NOT public.satisfies_markings('{}'::uuid[]) THEN RAISE EXCEPTION 'empty markings should satisfy'; END IF;
    IF public.satisfies_markings(ARRAY[gen_random_uuid()]) THEN RAISE EXCEPTION 'an id naming no marking satisfied'; END IF;

    -- 2. Disjunctive: at least one held marking per category group.
    IF NOT public.satisfies_markings(ARRAY[d1, d2]) THEN RAISE EXCEPTION 'one held of two disjunctive should satisfy the group'; END IF;
    IF public.satisfies_markings(ARRAY[d2]) THEN RAISE EXCEPTION 'a group with nothing held satisfied'; END IF;
    IF public.satisfies_markings(ARRAY[d1, d2, e1]) THEN RAISE EXCEPTION 'a second empty-handed group satisfied'; END IF;
    IF public.satisfies_markings(ARRAY[mkb, d1]) THEN RAISE EXCEPTION 'a held disjunctive excused an unheld conjunctive'; END IF;

    -- 3. Implication is membership for satisfaction, one level deep.
    INSERT INTO public.marking_implied (marking_id, implied_marking_id) VALUES (mka, mkb);
    INSERT INTO public.marking_implied (marking_id, implied_marking_id) VALUES (mkb, mkc);
    IF NOT public.satisfies_markings(ARRAY[mkb]) THEN RAISE EXCEPTION 'an implied marking should count as held'; END IF;
    IF NOT public.satisfies_markings(ARRAY[mka, mkb]) THEN RAISE EXCEPTION 'direct plus implied should satisfy'; END IF;
    IF public.satisfies_markings(ARRAY[mkc]) THEN RAISE EXCEPTION 'implication chained transitively'; END IF;

    -- 4. The restrictions verdicts.
    INSERT INTO public.marking_disallowed (marking_id, disallowed_marking_id) VALUES (mkb, d2);
    INSERT INTO public.marking_requirements (marking_id, alternatives) VALUES (mkb, ARRAY[d1, e1]);
    SELECT * INTO r FROM public.cbac_marking_restrictions(ARRAY[mkb, d2]);
    IF r.is_valid THEN RAISE EXCEPTION 'a disallowed pair was called valid'; END IF;
    SELECT * INTO r FROM public.cbac_marking_restrictions(ARRAY[mkb]);
    IF NOT (r.disallowed_markings @> ARRAY[d2]) THEN RAISE EXCEPTION 'the disallowed list should carry the pair even when absent from the set'; END IF;
    IF r.is_valid THEN RAISE EXCEPTION 'an unmet requirement list was called valid'; END IF;
    IF r.required_markings <> jsonb_build_array(jsonb_build_array(d1, e1)) THEN
      RAISE EXCEPTION 'required_markings should carry the alternatives list, got %', r.required_markings;
    END IF;
    SELECT * INTO r FROM public.cbac_marking_restrictions(ARRAY[d2]);
    IF NOT (r.disallowed_markings @> ARRAY[mkb]) THEN RAISE EXCEPTION 'disallowed should evaluate symmetrically'; END IF;
    SELECT * INTO r FROM public.cbac_marking_restrictions(ARRAY[mkb, d1]);
    IF NOT r.is_valid THEN RAISE EXCEPTION 'a met requirement list should be valid'; END IF;
    SELECT * INTO r FROM public.cbac_marking_restrictions(ARRAY[mka]);
    IF NOT (r.implied_markings @> ARRAY[mkb]) THEN RAISE EXCEPTION 'the implied list should carry the implication'; END IF;
    IF NOT r.user_satisfies_markings THEN RAISE EXCEPTION 'user_satisfies_markings should compose satisfies_markings'; END IF;

    -- 5. A dangling requirement alternative refuses.
    BEGIN
      INSERT INTO public.marking_requirements (marking_id, alternatives) VALUES (mka, ARRAY[gen_random_uuid()]);
      RAISE EXCEPTION 'a dangling alternative was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Cbac:CbacMarkingRestrictionsNotFound%' THEN RAISE; END IF;
    END;

    -- 6. The banner: category-then-name order, the markings' own colors.
    SELECT * INTO r FROM public.cbac_banner(ARRAY[d1, mka], 'BANNER_LINE');
    IF r.classification_string <> 'MOCK SECRET//MOCK REL A' THEN
      RAISE EXCEPTION 'banner string out of order: %', r.classification_string;
    END IF;
    IF r.markings <> ARRAY[mka, d1] OR r.background_colors <> ARRAY['#137CBD', '#D13913']
       OR r.text_color <> '#FFFFFF' THEN
      RAISE EXCEPTION 'banner colors or markings out of order';
    END IF;
    SELECT * INTO r FROM public.cbac_banner(ARRAY[mkb], 'BANNER_LINE');
    IF r.background_colors <> '{}'::text[] THEN
      RAISE EXCEPTION 'an unconfigured marking should contribute no stripe';
    END IF;
    SELECT b.classification_string INTO s FROM public.cbac_banner(ARRAY[d1, mka], 'PORTION_MARKING') b;
    IF s <> 'MOCK SECRET//MOCK REL A' THEN
      RAISE EXCEPTION 'the two display types should return the same string until a short form is stored';
    END IF;

    -- 7. The banner's error set.
    BEGIN
      PERFORM public.cbac_banner(ARRAY[mka], 'MARGIN_NOTE');
      RAISE EXCEPTION 'an unknown display type was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Cbac:UnknownClassificationBannerDisplayType%' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.cbac_banner('{}'::uuid[], 'BANNER_LINE');
      RAISE EXCEPTION 'an empty set produced a banner';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Cbac:CbacUnavailable%' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.cbac_banner(ARRAY[gen_random_uuid()], 'BANNER_LINE');
      RAISE EXCEPTION 'an unknown marking produced a banner';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Cbac:CbacBannerNotFound%' THEN RAISE; END IF;
    END;

    -- 8. A caller outside the categories' organization is refused by name.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u3::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org2))::text, true);
    BEGIN
      PERFORM public.cbac_banner(ARRAY[mka], 'BANNER_LINE');
      RAISE EXCEPTION 'a foreign caller read a banner';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Cbac:GetCbacBannerPermissionDenied%' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.cbac_marking_restrictions(ARRAY[mka]);
      RAISE EXCEPTION 'a foreign caller read restrictions';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Cbac:GetCbacMarkingRestrictionInfoPermissionDenied%' THEN RAISE; END IF;
    END;

    -- 9. 649's toggle defaults to the capture's off state.
    INSERT INTO public.platform_banners (organization_id) VALUES (org);
    IF (SELECT show_with_classification_banner FROM public.platform_banners
         WHERE organization_id = org) THEN
      RAISE EXCEPTION 'the toggle should default off';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '674 proved: conjunctive behaviour unchanged (held/unheld/empty/unknown), disjunctive one-per-group, single-level implication, both restriction verdicts with symmetric disallowed and carried requirement lists, banner order and colors with all four errors by name, and the toggle defaults off';
  END;
END $$;
