-- 795 — two standing rules the notification tables broke
--
-- Both caught by the platform suite the moment 793 landed, which is what those
-- two guards are for. Corrected forward, because 793 is applied.
--
-- ── 1. EVERY FOREIGN KEY HAS AN INDEX ON ITS LEADING COLUMN ────────────────
-- 464's rule, enforced by catalog hygiene. `notifications.created_by_user_id`
-- references users and had none, so deleting a user would sequentially scan
-- every notification ever sent. The two columns on notification_deliveries were
-- covered by the indexes 793 added for the inbox read; this one was not covered
-- by anything, because nothing reads a notification by its author.
--
-- ── 2. A POLICY CALLS auth.uid() ONCE, NOT PER ROW ─────────────────────────
-- 619's rule: an unwrapped helper in a policy is re-evaluated for every row,
-- and wrapping it in a scalar subquery makes it an InitPlan evaluated once. The
-- measured cost there was 18x and 47x. 793 wrapped the call in the
-- `notifications` policy and left it bare in both `notification_deliveries`
-- policies — the inbox is the one read a person makes most often, so it is the
-- worst of the three places to have missed.
--
-- The policies are dropped and recreated because a policy's USING expression
-- cannot be altered in place. Nothing else about them changes: same names, same
-- commands, same predicate, same table.

BEGIN;

CREATE INDEX notifications_created_by_user_id_idx
  ON public.notifications (created_by_user_id);

DROP POLICY "a delivery is yours alone" ON public.notification_deliveries;
DROP POLICY "you may mark your own read" ON public.notification_deliveries;

CREATE POLICY "a delivery is yours alone" ON public.notification_deliveries
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "you may mark your own read" ON public.notification_deliveries
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
          WITH CHECK (user_id = (SELECT auth.uid()));

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────
-- Both assertions ask the same questions the two suites ask, so a regression
-- here fails at apply rather than three minutes into a test run.

DO $do$
DECLARE bad text[];
BEGIN
  -- 1. the rule, asked of the whole catalogue rather than of this one column
  SELECT array_agg(t.rel || '.' || t.col) INTO bad FROM (
    SELECT c.conrelid::regclass::text AS rel, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.connamespace = 'public'::regnamespace
       AND NOT EXISTS (SELECT 1 FROM pg_index i
                        WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])
  ) t;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'foreign keys without a leading-column index: %', bad;
  END IF;

  -- 2. no policy on these two tables calls the helper per row
  -- The suite's own test, verbatim in shape: strip every wrapped call, then
  -- look for a bare one in what is left. A lookbehind would be the obvious
  -- way and Postgres has none, which is why the suite does it by subtraction.
  SELECT array_agg(p.tablename || '.' || p.policyname) INTO bad
    FROM pg_policies p
   WHERE p.schemaname = 'public'
     AND p.tablename IN ('notifications', 'notification_deliveries')
     AND regexp_replace(coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''),
                        '\( SELECT auth\.uid\(\)[^)]*\)', '', 'g')
         LIKE '%auth.uid()%';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'policies calling auth.uid() per row: %', bad;
  END IF;

  RAISE NOTICE '795 proved: every foreign key is indexed and every notification policy is an InitPlan';
END $do$;

COMMIT;
