-- The gap sweep's Direction 2, executed: four columns the teardown missed and
-- three comments its census could not see. The census (catalog.test.ts) reads
-- TABLE comments alone; the sweep probed col_description, pg_proc and
-- pg_constraint and found the pre-teardown vocabulary alive in all three
-- places — including on auth_org_id(), the helper every policy calls, whose
-- comment described a hotel fallback that does not exist. The suite widens in
-- the same PR so this class cannot hide again.
--
-- The columns, each on 640's pattern — measured before deleted:
--   object_types.computed_properties (216, "Studio P2.4") — 349's own header
--   already ruled the grammar out of the ontology, quoting
--   ontology/ontology-structural-guidance: computed-from-same-object values
--   belong to a pipeline transform, not an ontology property. Foundry's
--   derived properties (576-577) aggregate across a link chain — a different
--   mechanism we hold with its page.
--   object_types.view_config (218, "Studio P3.1") — the presentation config
--   whose documented counterpart is property visibility
--   (prominent/normal/hidden), which we hold with its page.
--   object_types.enabled (214) — the hospitality soft-delete pattern;
--   Foundry's counterparts are status and visibility, both held.
--   organizations.slug, organizations.config (111) — the two siblings of
--   logo_url, which 640 deleted on measurement; these were beside it and
--   were not measured then.

-- One function did still read the columns: the version trigger compared them
-- to decide whether an edit is real. Patch the live definition first — the
-- comparison loses the two Studio columns and keeps the three that are ours.
DO $$
DECLARE src text; anchor text;
BEGIN
  src := pg_get_functiondef('public.bump_object_type_version()'::regprocedure);
  anchor := 'ROW(NEW.label, NEW.icon, NEW.description, NEW.computed_properties, NEW.view_config)';
  IF position(anchor in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: bump_object_type_version is not the text 658 read';
  END IF;
  src := replace(src, anchor, 'ROW(NEW.label, NEW.icon, NEW.description)');
  src := replace(src,
    'ROW(OLD.label, OLD.icon, OLD.description, OLD.computed_properties, OLD.view_config)',
    'ROW(OLD.label, OLD.icon, OLD.description)');
  EXECUTE src;
END $$;

DO $$
DECLARE v_n int;
BEGIN
  -- refuse if any premise stopped being true
  -- the editor saved EMPTY_VIEW_CONFIG as a value, so empty counts as unpopulated
  SELECT count(*) INTO v_n FROM public.object_types
   WHERE coalesce(computed_properties, '[]'::jsonb) <> '[]'::jsonb
      OR coalesce(view_config, '{"prominent": [], "sections": []}'::jsonb)
         <> '{"prominent": [], "sections": []}'::jsonb
      OR enabled IS DISTINCT FROM true;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not orphans any more: % object type(s) populate the Studio columns', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.organizations
   WHERE slug IS NOT NULL OR coalesce(config, '{}'::jsonb) <> '{}'::jsonb;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not orphans any more: % organization(s) populate slug/config', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prosrc ~ 'computed_properties|view_config';
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% function(s) read the Studio columns', v_n;
  END IF;
END $$;

ALTER TABLE public.object_types DROP COLUMN computed_properties;
ALTER TABLE public.object_types DROP COLUMN view_config;
ALTER TABLE public.object_types DROP COLUMN enabled;
ALTER TABLE public.organizations DROP COLUMN slug;
ALTER TABLE public.organizations DROP COLUMN config;

-- The two function comments, rewritten to describe what the bodies do. The
-- bodies were verified clean; only the prose was stale.
COMMENT ON FUNCTION public.auth_org_id() IS
  'The caller''s organization from the JWT app_metadata.org_id claim, stamped at token issuance by custom_access_token_hook. NULL when unauthenticated.';
COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'GoTrue''s token hook: stamps org_id, role and guest_org_ids claims, and since 654 runs the login-time assignments — rule_based group sync and organization assignment, with the blocked-login refusal returned outside the fail-open umbrella.';

-- Gone completely: nothing left in any catalog describes the old product.
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM (
    SELECT obj_description(c.oid, 'pg_class') AS d FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
    UNION ALL
    SELECT col_description(c.oid, a.attnum) FROM pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
     WHERE c.relnamespace = 'public'::regnamespace
    UNION ALL
    SELECT obj_description(p.oid, 'pg_proc') FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
    UNION ALL
    SELECT obj_description(t.oid, 'pg_constraint') FROM pg_constraint t
     WHERE t.connamespace = 'public'::regnamespace
  ) d WHERE d.d ~* '(hotel|reality-graph|Studio P)';
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% comment(s) still describe the pre-teardown product', v_n;
  END IF;
  RAISE NOTICE '658 proved: the Studio columns are gone and no catalog comment names the old product anywhere the census now looks';
END $$;
