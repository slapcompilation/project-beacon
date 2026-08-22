-- 628 dropped `time_series_properties` and left two COMMENTs pointing at it.
--
-- Found because `pnpm gen:client` copies `pg_description` verbatim into the
-- typed client, so `generated.ts` still named a table that no longer exists —
-- a doc string telling the next reader to go somewhere there is nothing. The
-- COMMENT is not decoration here: it is the source of the generated
-- documentation, so a stale one propagates.
--
--   capability_slots()          "...lives in time_series_properties."
--   object_type_capabilities    "...lives in time_series_properties."
--
-- Both were written when the second panel shape had a table behind it. It does
-- not, and the honest statement is the one 628 arrived at: Time series is not
-- among the twenty-two base types, so no property here can be one, and Foundry
-- has a 42-page section none of which is read.
--
-- The lesson generalises past this pair, which is why it gets its own file
-- rather than a line in the last one: **dropping a table is not finished until
-- nothing describes it.** Foreign keys and policies go with the DROP; comments,
-- and the generated client built from them, do not.

COMMENT ON FUNCTION public.capability_slots() IS
  'The slot-based Capabilities vocabulary, from metadata-typeclasses (the page it replaces) and the Geospatial panel screenshot. Time series is the other panel shape and is not built: it is not one of the twenty-two base types, and Foundry gives it a 42-page section of its own.';

COMMENT ON TABLE public.object_type_capabilities IS
  'An object type nominating its properties against platform capability slots — what type classes became. Slot-based panels only. The list-shaped Time series panel is not built: no base type admits a series, and its table was a pre-teardown orphan dropped by 628.';

-- Nothing anywhere still describes the dropped table.
DO $$
DECLARE v_left int;
BEGIN
  SELECT count(*) INTO v_left FROM (
    SELECT obj_description(p.oid, 'pg_proc') AS d
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
    UNION ALL
    SELECT obj_description(c.oid, 'pg_class')
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
    UNION ALL
    SELECT col_description(c.oid, a.attnum)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
     WHERE n.nspname = 'public'
  ) d WHERE d.d ~ 'time_series_properties';

  IF v_left <> 0 THEN
    RAISE EXCEPTION '% comment(s) still name the dropped table', v_left;
  END IF;
  RAISE NOTICE 'no function, table or column comment names time_series_properties';
END $$;
