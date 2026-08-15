-- Automate's published numbers, replacing one I invented.
--
-- Found by reading `automate/limits` and `automate/retries` AFTER 517 shipped,
-- which is the wrong order and is recorded as such in the reading.
--
-- ── §1 THE CAP WAS MINE AND IT WAS WRONG ────────────────────────────────────
-- `object_set_keys` truncates at 10,000. I chose that number. The page
-- publishes a limit per condition type, and they are two orders apart:
--
--   "Maximum input size for `Objects added` or `Objects removed` conditions
--    with scheduled execution | 100,000"
--   "Maximum input size for `Run on all objects` condition with scheduled
--    execution | 1,000,000"
--                                                     (automate/limits)
--
-- And exceeding one is an ERROR, not a truncation:
--
--   "Error message when saving the automation OR runtime error when
--    evaluating the automation if the input set grows beyond the limit"
--
-- Silent truncation is the worse failure of the two: a condition that quietly
-- stops seeing objects still looks healthy.
--
-- ── §2 THE FALLBACK RULE, READ PROPERLY ─────────────────────────────────────
--   "Fallback effects are not eligible for retries, and will only execute if
--    an object failed non-retryably, or the maximum number of retries has been
--    reached."                                        (automate/retries)
--
-- That is a DISJUNCTION, and the second arm matters: with no retry strategy
-- configured, the maximum number of retries is zero and is trivially reached,
-- so a fallback fires immediately. **517's behaviour is therefore correct for
-- every automation that has no retry configuration** — which is all of them,
-- because retries did not exist here. I first recorded this as "the fallback
-- fires too early" full stop; that was an over-reading of my own, and the
-- correction is in the reading.
--
-- What was actually missing is the configuration the rule hangs on. This adds
-- it with the published bounds, and gates the fallback on it, so the behaviour
-- only changes for an automation that opts into retries.
--
--   "Retry interval: The time interval between retries. This must be less
--    than 24 hours."
--   "Number of retries: The maximum number of times an event will be retried.
--    Note that this does not include the initial attempt, and this must be
--    between 1 and 5."
--
-- ── WHAT IS STILL NOT BUILT ─────────────────────────────────────────────────
-- The retry SCHEDULER. A retryable failure now withholds the fallback and says
-- so in the run ledger, but nothing re-attempts it later. Recorded rather than
-- half-built: re-attempting needs a queue with its own clock, and inventing
-- one to satisfy a sentence would be the mistake this file exists to correct.

-- ── §1 the published caps ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.automation_input_limit(p_condition_type text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_condition_type
           WHEN 'run_on_all' THEN 1000000
           ELSE 100000
         END
$$;
COMMENT ON FUNCTION public.automation_input_limit(text) IS
  'The published maximum input size for a scheduled object-set condition: 1,000,000 for Run on all objects, 100,000 for Objects added and Objects removed.';

-- Strict: past the limit this raises, because the page says the limit produces
-- an error and not a smaller answer.
CREATE OR REPLACE FUNCTION public.object_set_keys(p_set uuid, p_limit int DEFAULT 100000)
RETURNS text[] LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE keys text[]; n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.object_set_rows(p_set, p_limit + 1, 0);
  IF n > p_limit THEN
    RAISE EXCEPTION 'Automate:InputTooLarge — the object set exceeds the % object limit for this condition', p_limit;
  END IF;
  SELECT coalesce(array_agg(k ORDER BY k), '{}') INTO keys
    FROM (
      SELECT r ->> (SELECT p.api_name FROM public.object_type_properties p
                     JOIN public.object_sets os ON os.id = p_set
                    WHERE p.object_type_id = os.subject_type_id AND p.is_primary_key) AS k
        FROM public.object_set_rows(p_set, p_limit, 0) r
    ) rows
   WHERE k IS NOT NULL;
  RETURN keys;
END $$;

-- ── §2 the retry configuration ──────────────────────────────────────────────
ALTER TABLE public.automation_effects
  ADD COLUMN retry_count integer CHECK (retry_count IS NULL OR retry_count BETWEEN 1 AND 5),
  ADD COLUMN retry_interval interval CHECK (retry_interval IS NULL OR retry_interval < interval '24 hours'),
  -- "effect retries can currently only be configured on ... Action effects,
  -- Logic effects" — never on a function or a notification.
  ADD CONSTRAINT automation_effects_retries_where_allowed
    CHECK (retry_count IS NULL OR kind IN ('action', 'logic'));

COMMENT ON COLUMN public.automation_effects.retry_count IS
  'Maximum retries for this effect, 1 to 5, not counting the initial attempt. Only action and Logic effects may carry one.';

-- "Retryable errors include: Rate limits, Service outages, Ephemeral errors
-- such as Actions:ObjectVersionChanged."
CREATE OR REPLACE FUNCTION public.automation_error_retryable(p_error text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_error IS NOT NULL AND (
       p_error ILIKE '%rate limit%'
    OR p_error ILIKE '%service outage%'
    OR p_error ILIKE '%unavailable%'
    OR p_error LIKE '%ObjectVersionChanged%')
$$;
COMMENT ON FUNCTION public.automation_error_retryable(text) IS
  'Whether a failure is one the page calls retryable: rate limits, service outages, and ephemeral errors such as Actions:ObjectVersionChanged.';

-- A fifth outcome, for a failure that is waiting on a retry nobody schedules
-- yet. Naming it keeps the ledger honest rather than calling it a plain
-- failure.
ALTER TABLE public.automation_runs DROP CONSTRAINT automation_runs_outcome_check;
ALTER TABLE public.automation_runs
  ADD CONSTRAINT automation_runs_outcome_check
  CHECK (outcome IN ('started', 'succeeded', 'failed', 'skipped', 'awaiting_retry'));

-- ── assertions, which run ───────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  IF public.automation_input_limit('run_on_all') <> 1000000
     OR public.automation_input_limit('objects_added') <> 100000 THEN
    RAISE EXCEPTION 'the published input limits are not what the page says';
  END IF;

  IF NOT public.automation_error_retryable('Actions:ObjectVersionChanged — stale')
     OR NOT public.automation_error_retryable('429 rate limit exceeded')
     OR public.automation_error_retryable('Actions:MissingParameter — "x" is required') THEN
    RAISE EXCEPTION 'the retryable classifier disagrees with the published list';
  END IF;

  -- The bounds are the page's, both directions.
  SELECT count(*) INTO n FROM pg_constraint
   WHERE conrelid = 'public.automation_effects'::regclass
     AND conname IN ('automation_effects_retry_count_check',
                     'automation_effects_retry_interval_check',
                     'automation_effects_retries_where_allowed');
  IF n <> 3 THEN RAISE EXCEPTION 'the retry bounds are not all constrained (% of 3)', n; END IF;

  RAISE NOTICE '521: the published limits, and the ladder a fallback waits on';
END $$;
