-- 697: the one table 696 left without a comment.
--
-- catalog.test's "every public table says what it holds" caught it, which is
-- the guard doing exactly its job: I commented quiver_dashboard_cards.height
-- and forgot the table itself. 696 is applied and immutable, so forward.

COMMENT ON TABLE public.quiver_dashboard_cards IS
  'Where a card sits on a dashboard. Separate from quiver_canvas_cards because a dashboard is a different presentation of the same analysis, not a canvas: "Start from a blank dashboard and easily drag and drop content from your analysis into the dashboard" (quiver/dashboards-overview).';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind = 'r'
     AND c.relname LIKE 'quiver_%'
     AND obj_description(c.oid, 'pg_class') IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION '% quiver table(s) still say nothing about themselves', n; END IF;
  RAISE NOTICE '697 proved: all eight quiver_* tables carry a comment';
END $$;
