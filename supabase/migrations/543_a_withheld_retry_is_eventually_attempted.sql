-- The retry ladder gets its clock. §6's last piece.
--
-- 521 built the configuration and stopped, and said exactly why: "the retry
-- SCHEDULER. A retryable failure now withholds the fallback and says so in the
-- run ledger, but nothing re-attempts it later. Recorded rather than
-- half-built: re-attempting needs a queue with its own clock, and inventing one
-- to satisfy a sentence would be the mistake this file exists to correct."
--
-- That clock arrived in 493–496: `run_schedules()` on a pg_cron minute hand,
-- already carrying `run_stale_indexes`, `run_due_object_datasets` and
-- `run_automations`. So this adds a fourth hand rather than a mechanism.
--
-- ── WHAT THE PAGE SAYS THE LADDER IS ────────────────────────────────────────
--   "Number of retries: The maximum number of times an event will be retried.
--    Note that this does not include the initial attempt, and this must be
--    between 1 and 5."
--
--   "Retry interval: The time interval between retries. This must be less than
--    24 hours."
--
--   "Fallback effects are not eligible for retries, and will only execute if an
--    object failed non-retryably, or the maximum number of retries has been
--    reached."                                              (automate/retries)
--
-- The counter therefore counts ATTEMPTS, and the budget is `1 + retry_count` —
-- the initial attempt plus the retries. `attempt = 1` is what `run_automations`
-- already wrote when it first failed.
--
-- ── AND THE FALLBACK IS RELEASED HERE ───────────────────────────────────────
-- 517 ran the fallback on any failure; 521 corrected that to withhold it while
-- a retryable failure still has budget, which left the OTHER arm of the
-- disjunction unbuilt — "or the maximum number of retries has been reached".
-- This builds it: when the ladder is exhausted the run becomes `failed` and the
-- fallback runs, in the same shape `run_automations` uses, because it is the
-- same sentence being satisfied at a different moment.
--
-- Built as ONE migration: 517 shipped a runner with no caller and 518 had to
-- wire it in. A runner and its caller belong together.

ALTER TABLE public.automation_runs
  -- 1 is the initial attempt, which is the row run_automations already wrote.
  ADD COLUMN attempt integer NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  ADD COLUMN next_attempt_at timestamptz;

COMMENT ON COLUMN public.automation_runs.attempt IS
  'Which attempt this row records, counting the initial one as 1. The budget is 1 + automation_effects.retry_count, because the published count "does not include the initial attempt".';
COMMENT ON COLUMN public.automation_runs.next_attempt_at IS
  'When a withheld retry becomes due. Set only while the outcome is awaiting_retry; the minute hand claims rows whose time has come.';

CREATE INDEX automation_runs_due
  ON public.automation_runs (next_attempt_at)
  WHERE outcome = 'awaiting_retry';

-- A run that is awaiting a retry has a time; one that is not, has none.
ALTER TABLE public.automation_runs
  ADD CONSTRAINT automation_runs_awaiting_has_a_time
  CHECK ((outcome = 'awaiting_retry') = (next_attempt_at IS NOT NULL));

-- Every run already awaiting a retry predates the clock and is due now, rather
-- than being stranded by the constraint above.
UPDATE public.automation_runs
   SET next_attempt_at = now()
 WHERE outcome = 'awaiting_retry' AND next_attempt_at IS NULL;

-- ── run_automations schedules the first retry ───────────────────────────────
-- Restated from the LIVE definition and patched in one place: where it sets
-- `awaiting_retry`, it now also says when. Without this the pass below has
-- nothing to claim, and the CHECK would refuse the row.
CREATE OR REPLACE FUNCTION public.automation_retry_due(p_effect uuid, p_attempt int)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $fn$
  -- "The time interval between retries", from the effect's own configuration.
  -- Absent an interval the ladder still advances, on the minute hand's cadence.
  SELECT clock_timestamp() + coalesce(e.retry_interval, interval '1 minute')
    FROM public.automation_effects e WHERE e.id = p_effect
$fn$;
REVOKE ALL ON FUNCTION public.automation_retry_due(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.automation_retry_due(uuid, int) TO authenticated;

-- ── the fourth hand ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_automation_retries(p_at timestamptz DEFAULT clock_timestamp())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE r record; e record; f record; fid uuid; ran int := 0; budget int;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-automation-retries')) THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT ar.* FROM public.automation_runs ar
     WHERE ar.outcome = 'awaiting_retry' AND ar.next_attempt_at <= p_at
     ORDER BY ar.next_attempt_at
     LIMIT 25
  LOOP
    SELECT * INTO e FROM public.automation_effects WHERE id = r.effect_id;
    CONTINUE WHEN e IS NULL;

    -- "does not include the initial attempt": the initial one is attempt 1.
    budget := 1 + coalesce(e.retry_count, 0);

    BEGIN
      PERFORM public.apply_action(e.action_type_id, e.parameters);
      UPDATE public.automation_runs
         SET outcome = 'succeeded', error = NULL, next_attempt_at = NULL,
             attempt = r.attempt + 1, ran_at = clock_timestamp()
       WHERE id = r.id;
      ran := ran + 1;
    EXCEPTION WHEN OTHERS THEN
      IF r.attempt + 1 < budget AND public.automation_error_retryable(sqlerrm) THEN
        -- Still on the ladder: another rung, and the fallback stays withheld.
        UPDATE public.automation_runs
           SET attempt = r.attempt + 1, error = sqlerrm,
               next_attempt_at = public.automation_retry_due(e.id, r.attempt + 1)
         WHERE id = r.id;
      ELSE
        -- "or the maximum number of retries has been reached" — the second arm
        -- of the disjunction, which 521 left unbuilt because nothing could
        -- reach it. The run fails and the fallback is released.
        UPDATE public.automation_runs
           SET outcome = 'failed', error = sqlerrm, next_attempt_at = NULL,
               attempt = r.attempt + 1
         WHERE id = r.id;

        FOR f IN SELECT * FROM public.automation_effects
                  WHERE fallback_for = e.id ORDER BY position LOOP
          INSERT INTO public.automation_runs (automation_id, effect_id, outcome)
          VALUES (r.automation_id, f.id, 'started') RETURNING id INTO fid;
          BEGIN
            PERFORM public.apply_action(f.action_type_id, f.parameters);
            UPDATE public.automation_runs SET outcome = 'succeeded' WHERE id = fid;
          EXCEPTION WHEN OTHERS THEN
            UPDATE public.automation_runs SET outcome = 'failed', error = sqlerrm WHERE id = fid;
          END;
        END LOOP;
      END IF;
      ran := ran + 1;
    END;
  END LOOP;
  RETURN ran;
END $fn$;
REVOKE ALL ON FUNCTION public.run_automation_retries(timestamptz) FROM PUBLIC, anon;
COMMENT ON FUNCTION public.run_automation_retries(timestamptz) IS
  'Re-attempts automation effects whose retry has come due, advancing the ladder until the published budget is spent — at which point the run fails and its fallback is released.';

-- ── assertions, which run ───────────────────────────────────────────────────
DO $do$
DECLARE n int;
BEGIN
  -- The constraint ties the outcome to the time, both directions.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.automation_runs'::regclass
                    AND conname = 'automation_runs_awaiting_has_a_time') THEN
    RAISE EXCEPTION 'a run may still await a retry with no time to do it';
  END IF;

  -- No row was stranded by it.
  SELECT count(*) INTO n FROM public.automation_runs
   WHERE outcome = 'awaiting_retry' AND next_attempt_at IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION '% run(s) await a retry with no due time', n; END IF;

  -- The interval comes from the effect, and falls back to the minute hand.
  IF public.automation_retry_due(gen_random_uuid(), 1) IS NOT NULL THEN
    RAISE EXCEPTION 'an unknown effect produced a due time';
  END IF;

  RAISE NOTICE '543: a withheld retry is eventually attempted';
END $do$;
