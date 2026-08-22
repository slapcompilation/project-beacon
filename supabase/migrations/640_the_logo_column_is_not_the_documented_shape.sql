-- `organizations.logo_url` goes, on 628's checklist: a pre-teardown survivor
-- whose documented counterpart has a different shape.
--
-- Born in 111 — the hospitality product — as a nullable text column. Measured
-- before deleting, not assumed: zero rows populated, zero functions or
-- policies read it, zero files under apps/web or packages/ name it, and it
-- carries no COMMENT (so 629's generated-client tail cannot exist for it).
--
-- The feature is real; the shape is not. `administration/`, mirrored in this
-- week's drift sweep, documents platform branding:
--
--   "The platform logo can be configured per Enrollment and Organization,
--   replacing any occurrences of the default Palantir logo with an image of
--   your choice. You can provide up to four different logo sizes: favicon,
--   small, medium, and large."
--   — administration/configure-platform-experience.md
--
-- and the fallback rule that makes four sizes a structure rather than a list:
--
--   "If you do not provide an image for each size, then Foundry uses an
--   appropriate fallback size. The favicon does not have any fallback
--   behavior."
--   — administration/configure-platform-experience.md
--
-- One URL is not four sizes with per-size fallback, and it also misses the
-- Enrollment half — the page opens by scoping who may configure which:
-- "You can configure platform logos per Enrollment if you have Enrollment
-- administrator permissions." Keeping the single column would be the
-- half-built version that looks like a foundation; the honest state is no
-- column and a recorded gap, which DELIVERABLE-MAP now carries.

DO $$
DECLARE v_rows int; v_fns int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'organizations'
                    AND column_name = 'logo_url') THEN
    RAISE NOTICE 'already gone';
    RETURN;
  END IF;

  -- Refuse to run if any premise stopped being true.
  EXECUTE 'SELECT count(logo_url) FROM public.organizations' INTO v_rows;
  SELECT count(*) INTO v_fns FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ~ 'logo_url';
  IF v_rows <> 0 OR v_fns <> 0 THEN
    RAISE EXCEPTION 'not an orphan any more: % populated row(s), % function reader(s) — 640 refuses to drop it',
      v_rows, v_fns;
  END IF;
END $$;

ALTER TABLE public.organizations DROP COLUMN IF EXISTS logo_url;

-- Gone completely: nothing left describes it.
DO $$
DECLARE v_left int;
BEGIN
  SELECT count(*) INTO v_left FROM (
    SELECT obj_description(p.oid, 'pg_proc') AS d
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
    UNION ALL
    SELECT col_description(c.oid, a.attnum)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
     WHERE n.nspname = 'public'
  ) d WHERE d.d ~ 'logo_url';
  IF v_left <> 0 THEN
    RAISE EXCEPTION '% comment(s) still name the dropped column', v_left;
  END IF;
  RAISE NOTICE 'logo_url dropped; the documented four-size-per-scope feature is recorded in DELIVERABLE-MAP';
END $$;
