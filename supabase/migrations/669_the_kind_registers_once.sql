-- 668's live-patch of action_rule_kinds() anchored on a note string that
-- appears twice (the two link-on-interface kinds share it) and replaced BOTH,
-- registering the schedule kind twice. The platform suite's count assertions
-- caught it within the hour — expected 6 executable kinds, found 8.
-- Corrected forward, because the applied 668 cannot be edited: the duplicate
-- row is cut out of the live definition, and the registry counts are asserted
-- here so a re-run of this same mistake refuses.

DO $do$
DECLARE
  src text; blk text; i int; j int; n int;
BEGIN
  src := replace(pg_get_functiondef('public.action_rule_kinds()'::regprocedure), chr(13), '');
  blk := ',
    (''schedule'', ''schedule'', true, ''sql'',
     ''Triggers a build of the named project-scoped schedule before the edits apply; the run RID becomes a value source.'')';
  i := position(blk in src);
  IF i = 0 THEN
    RAISE EXCEPTION 'an anchor moved: the schedule row is not the text 669 read';
  END IF;
  j := position(blk in substring(src from i + length(blk)));
  IF j = 0 THEN
    RAISE EXCEPTION 'nothing to fix: the schedule row appears once already';
  END IF;
  -- cut the FIRST occurrence; the second stays
  src := substring(src from 1 for i - 1) || substring(src from i + length(blk));
  EXECUTE src;

  SELECT count(*) INTO n FROM public.action_rule_kinds() k WHERE k.kind = 'schedule';
  IF n <> 1 THEN
    RAISE EXCEPTION 'the schedule kind should register exactly once, found %', n;
  END IF;
  SELECT count(*) INTO n FROM public.action_rule_kinds() k WHERE k.executable;
  IF n <> 8 THEN
    RAISE EXCEPTION 'eight kinds execute (the seven plus schedule), found %', n;
  END IF;
  SELECT count(*) INTO n FROM public.action_rule_kinds();
  IF n <> 13 THEN
    RAISE EXCEPTION 'thirteen kinds register (the published twelve plus schedule), found %', n;
  END IF;
END $do$;
