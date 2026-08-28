-- 719 — the index 718 owed: object_view_tabs.module_id is a foreign key
-- (ON DELETE RESTRICT into workshop_modules) and the catalog hygiene suite
-- rightly refused it unindexed — every FK carries an index on its leading
-- column (464's rule). 718 is applied and immutable, so the index arrives
-- forward.

CREATE INDEX object_view_tabs_module_idx ON public.object_view_tabs (module_id);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'object_view_tabs_module_idx';
  IF n <> 1 THEN RAISE EXCEPTION 'the module index did not land'; END IF;
END $$;
