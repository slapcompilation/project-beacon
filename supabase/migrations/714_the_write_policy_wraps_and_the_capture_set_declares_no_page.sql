-- 714 — two fixes the platform suite caught in 710/712, corrected forward
-- because applied migrations are immutable.
--
-- 1. 710's "org members author type classes" policy called auth.uid() bare, so
--    it ran per row instead of as an InitPlan — the exact cost 619 measured.
--    And it was FOR ALL, which 619 also showed runs on every SELECT. It becomes
--    three write policies, each wrapping the call.
--
-- 2. 712 declared vertex_template_search_arounds.kind as a value set from
--    vertex/graphs-template, but only two of its three tokens are in that
--    page's prose:
--
--   "Non-object parameters are additional parameters that can be used as
--    arguments to custom Search Around functions or saved Search Arounds."
--   — vertex/graphs-template.md
--
--    'relation' — the menu's first entry — is capture-derived:
--    —   template-configure-search-arounds.png
--    A declaration claims every token is ON the page, and for 'relation' that
--    claim is false, so the set follows 711's convention for capture-derived
--    sets and declares no page. The undeclared count vocabularyPages.test.ts
--    prints rises by one, which is the honest state.

-- ── 1. the write policy, wrapped and split ──────────────────────────────────

DROP POLICY "org members author type classes" ON public.ontology_type_classes;

CREATE POLICY "org members insert type classes" ON public.ontology_type_classes
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "org members update type classes" ON public.ontology_type_classes
  FOR UPDATE USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "org members delete type classes" ON public.ontology_type_classes
  FOR DELETE USING ((SELECT auth.uid()) IS NOT NULL);

COMMENT ON POLICY "org members insert type classes" ON public.ontology_type_classes IS
  'Capabilities configuration is ontology metadata; the properties and link types it decorates carry the real access, and their own policies gate what a caller can SEE through the convention views. Tightening to OMA editor roles is a recorded follow-up. Split from 710''s FOR ALL so no write predicate runs on SELECT (619).';

-- ── 2. the capture-derived set stops naming a page ──────────────────────────

COMMENT ON CONSTRAINT vx_tpl_sa_kind_check ON public.vertex_template_search_arounds IS
  'Capture-derived, so no page is declared: ''function'' and ''saved'' are in vertex/graphs-template''s prose ("custom Search Around functions or saved Search Arounds") but ''relation'' is the menu''s first entry in vertex/images/template-configure-search-arounds.png and appears in no prose, so a page declaration would be false for it.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  n integer;
  cmt text;
BEGIN
  -- No policy on the table carries a bare auth.uid() — every occurrence sits
  -- inside an InitPlan subselect, which pg deparses as "( SELECT auth.uid()...".
  SELECT count(*) INTO n
  FROM pg_policy
  WHERE polrelid = 'public.ontology_type_classes'::regclass
    AND (
      regexp_replace(coalesce(pg_get_expr(polqual, polrelid), ''), '\(\s*SELECT\s+auth\.uid\(\)[^)]*\)', '', 'gi') ~ 'auth\.uid\(\)'
      OR regexp_replace(coalesce(pg_get_expr(polwithcheck, polrelid), ''), '\(\s*SELECT\s+auth\.uid\(\)[^)]*\)', '', 'gi') ~ 'auth\.uid\(\)'
    );
  IF n <> 0 THEN
    RAISE EXCEPTION 'a policy on ontology_type_classes still calls auth.uid() bare';
  END IF;

  -- The four policies: one read, three writes, none FOR ALL.
  SELECT count(*) INTO n FROM pg_policy
  WHERE polrelid = 'public.ontology_type_classes'::regclass;
  IF n <> 4 THEN
    RAISE EXCEPTION 'expected 4 policies on ontology_type_classes, found %', n;
  END IF;
  SELECT count(*) INTO n FROM pg_policy
  WHERE polrelid = 'public.ontology_type_classes'::regclass AND polcmd = '*';
  IF n <> 0 THEN
    RAISE EXCEPTION 'a FOR ALL policy remains on ontology_type_classes';
  END IF;

  -- The constraint's comment no longer reads as a page declaration.
  SELECT obj_description(c.oid, 'pg_constraint') INTO cmt
  FROM pg_constraint c
  WHERE c.conname = 'vx_tpl_sa_kind_check'
    AND c.conrelid = 'public.vertex_template_search_arounds'::regclass;
  IF cmt IS NULL OR cmt ~ 'Values from [a-z0-9/-]+' THEN
    RAISE EXCEPTION 'vx_tpl_sa_kind_check still declares a page (or lost its comment)';
  END IF;
END $$;
