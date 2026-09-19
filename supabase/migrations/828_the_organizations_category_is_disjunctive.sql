-- The Organizations marking category is disjunctive.
--
-- A one-column correction to 490, found by an adversary attacking a reading
-- rather than by any guard, and worth the migration on its own because the
-- markings slot of a security policy is about to make it reachable.
--
-- 490 mints one marking per organization into a system category and creates that
-- category like this:
--
--   INSERT INTO public.marking_categories (name, category_type, visibility)
--   VALUES ('Organizations', 'conjunctive', 'visible')
--
-- There is no comment beside it and no sentence behind it. `conjunctive` was the
-- unmarked option, not a decision — and it is the opposite of the published rule:
--
--   "Access requirements for a resource are composed of Markings and Organizations. Organizations are disjunctive, while Markings are conjunctive."
--   — api/filesystem-v2-resources-resources-get-access-requirements.md
--
-- That is an api page, which CLAUDE.md ranks above prose for shape questions, and
-- the prose agrees from two other directions:
--
--   "If a resource has multiple organizations, the user must be a member of at least one of the organizations applied to the resource."
--   — object-link-types/mandatory-control-properties.md
--
--   "[Organizations](/docs/foundry/security/orgs-and-spaces/#organizations) are an access requirement applied to Projects that guarantees strict silos between groups of users and resources. In order to meet access requirements, users must be a member or guest member of at least one Organization applied to a Project."
--   — building-pipelines/remove-inherited-markings.md
--
-- WHY THE CATEGORY IS THE RIGHT PLACE, rather than special-casing organizations
-- in the evaluator. Foundry models an organization AS a marking in a category,
-- and the category is what carries the combinator:
--
--   "Internally, Organizations are represented as a slightly different kind of Marking, hence the transforms keyword following `stop_requiring` is called `OrgMarkings`."
--   — building-pipelines/remove-inherited-markings.md
--
-- `satisfies_markings` already implements the category rule exactly — every
-- marking of a conjunctive category must be held, and at least one of each
-- disjunctive category. So the fix is the data, not the code.
--
-- THE SHARPER ARGUMENT IS THAT WE CONTRADICT OURSELVES. Two evaluators in this
-- repo disagree about organizations right now:
--
--   satisfies_mandatory_control (821) excludes org markings from satisfies_markings
--     and applies at-least-one to them itself — correct.
--   satisfies_markings, via effective_object_type_markings (819/825), applies the
--     category rule — and with a conjunctive category that is ALL-of — wrong.
--
-- LATENT, NOT LIVE, AND MEASURED RATHER THAN ASSUMED. `resource_markings` holds
-- 0 rows today, so no resource carries any marking and nothing can currently hit
-- the wrong arm. It becomes reachable the moment a policy's markings slot applies
-- an organization, which is the next build. Fixing it first is cheaper than
-- fixing it inside a feature that would then be suspected of causing it.
--
-- RECORDED, NOT FIXED: 53 markings sit in this category and exactly 1
-- organization has a marking_id, so 52 are orphans left by test fixtures whose
-- organizations were rolled back. Markings cannot be deleted by design
-- ("Remove it from the resources that carry it instead"), so clearing that litter
-- is a deliberate operator decision and not a side effect of this migration.

DO $$
DECLARE v_cat uuid; v_was text;
BEGIN
  SELECT id, category_type INTO v_cat, v_was
    FROM public.marking_categories
   WHERE organization_id IS NULL AND name = 'Organizations';

  IF v_cat IS NULL THEN
    RAISE NOTICE 'No Organizations category exists yet; mint_organization_marking below creates it correctly.';
  ELSIF v_was = 'disjunctive' THEN
    RAISE NOTICE 'Already disjunctive; nothing to change.';
  ELSE
    -- guard_category_change refuses an update by anyone who is not a Category
    -- Administrator, and 490 gave this category no administrators on purpose:
    -- "org markings are governed from the organization's own surfaces (guests,
    -- permissions), never the category page." So there is no caller who could
    -- make this change through the front door, which is precisely why it has to
    -- be a migration. Disabled for this one statement and re-enabled after.
    ALTER TABLE public.marking_categories DISABLE TRIGGER guard_category_change;
    UPDATE public.marking_categories SET category_type = 'disjunctive' WHERE id = v_cat;
    ALTER TABLE public.marking_categories ENABLE TRIGGER guard_category_change;
    RAISE NOTICE 'Organizations category changed from % to disjunctive', v_was;
  END IF;
END $$;

-- And a future mint creates it right. PATCHED, NOT RETYPED: pg_get_functiondef's
-- own output with the one literal changed.
DO $patch$
DECLARE src text; out text;
BEGIN
  src := pg_get_functiondef('public.mint_organization_marking(uuid,text)'::regprocedure);
  out := replace(src,
    'VALUES (''Organizations'', ''conjunctive'', ''visible'') RETURNING id INTO cat;',
    'VALUES (''Organizations'', ''disjunctive'', ''visible'') RETURNING id INTO cat;');
  IF out = src THEN
    RAISE EXCEPTION 'PATCH FAILED: mint_organization_marking does not carry the expected category insert';
  END IF;
  EXECUTE out;
END $patch$;

comment on function public.mint_organization_marking(uuid, text) is
  'One marking per organization, in the one system category, which is disjunctive — "Organizations are disjunctive, while Markings are conjunctive" (api/filesystem-v2-resources-resources-get-access-requirements). 490 created it conjunctive with no sentence behind it; 828 corrected the category and this function.';

-- PROVED BY DOING, as `authenticated`, and in BOTH directions — because a change
-- that made every category disjunctive would pass a one-sided test while
-- destroying every marking in the platform.
DO $$
DECLARE
  v_user uuid; v_org uuid; v_role text;
  v_orgcat uuid; v_a uuid; v_b uuid;
  v_concat uuid; v_c uuid; v_d uuid;
  v_ok boolean;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user'; END IF;

  SELECT id INTO v_orgcat FROM public.marking_categories
   WHERE organization_id IS NULL AND name = 'Organizations';
  IF v_orgcat IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no Organizations category'; END IF;
  IF (SELECT category_type FROM public.marking_categories WHERE id = v_orgcat) <> 'disjunctive' THEN
    RAISE EXCEPTION 'PROOF FAILED: the Organizations category is still not disjunctive';
  END IF;

  -- Two organization markings, and a conjunctive control pair beside them.
  INSERT INTO public.markings (category_id, name) VALUES (v_orgcat, 'zz-proof-828-org-a') RETURNING id INTO v_a;
  INSERT INTO public.markings (category_id, name) VALUES (v_orgcat, 'zz-proof-828-org-b') RETURNING id INTO v_b;

  INSERT INTO public.marking_categories (name, description, category_type, visibility)
    VALUES ('zz-proof-828', 'temporary fixture', 'conjunctive', 'visible') RETURNING id INTO v_concat;
  INSERT INTO public.markings (category_id, name) VALUES (v_concat, 'zz-proof-828-c') RETURNING id INTO v_c;
  INSERT INTO public.markings (category_id, name) VALUES (v_concat, 'zz-proof-828-d') RETURNING id INTO v_d;

  -- The caller holds exactly ONE of each pair.
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_a, v_user), (v_c, v_user);

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);
  SET LOCAL ROLE authenticated;

  -- 1. THE FIX. One of two organizations is enough.
  SELECT public.satisfies_markings(ARRAY[v_a, v_b]) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'PROOF FAILED: holding one of two organizations was refused';
  END IF;

  -- 2. THE OTHER DIRECTION. One of two ordinary markings is NOT enough, so this
  --    migration did not simply make everything permissive.
  SELECT public.satisfies_markings(ARRAY[v_c, v_d]) INTO v_ok;
  IF v_ok THEN
    RAISE EXCEPTION 'PROOF FAILED: holding one of two conjunctive markings was accepted';
  END IF;

  -- 3. And holding NEITHER organization is still a refusal, or "disjunctive"
  --    would have become "no requirement at all".
  DELETE FROM public.marking_members WHERE marking_id = v_a AND user_id = v_user;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  SELECT public.satisfies_markings(ARRAY[v_a, v_b]) INTO v_ok;
  IF v_ok THEN
    RAISE EXCEPTION 'PROOF FAILED: holding neither organization was accepted';
  END IF;
  RESET ROLE;
  RAISE NOTICE 'PROVED: one of two organizations passes, one of two markings does not, neither fails';

  -- 4. The two evaluators now agree about organizations, which is the whole
  --    point: satisfies_mandatory_control excludes org markings and applies
  --    at-least-one itself, and satisfies_markings now reaches the same answer
  --    through the category.
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_a, v_user);
  SET LOCAL ROLE authenticated;
  IF public.satisfies_markings(ARRAY[v_a, v_b])
     IS DISTINCT FROM public.satisfies_mandatory_control(
          jsonb_build_array(v_a::text, v_b::text)) THEN
    RAISE EXCEPTION 'PROOF FAILED: the two organization evaluators still disagree';
  END IF;
  RESET ROLE;
  RAISE NOTICE 'PROVED: satisfies_markings and satisfies_mandatory_control agree about organizations';

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.marking_members WHERE marking_id IN (v_a, v_b, v_c, v_d);
  ALTER TABLE public.markings           DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings WHERE id IN (v_a, v_b, v_c, v_d);
  DELETE FROM public.marking_categories WHERE id = v_concat;
  ALTER TABLE public.markings           ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;

  IF EXISTS (SELECT 1 FROM public.markings WHERE name LIKE 'zz-proof-828%')
     OR EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-828') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed';
END $$;
