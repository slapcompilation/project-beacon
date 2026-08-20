-- `cleanup-filter-example.png` shows the candidate table with a **READS**
-- column — `1`, `1` and `43` for its three example types — and the one with 43
-- is the one the page deprecates rather than deletes. The reading settled what
-- that column is for: Cleanup consumes usage metrics directly, and the count is
-- what tells a reader whether a dead-looking type is actually dead.
--
-- Ours has carried a hardcoded null in its place since the page was built. The
-- number was never far away: `no_registered_usage` is a computable flag, so
-- `run_cleanup` already asks the usage ledger about every object type it walks.
-- It asked, used the answer as a boolean, and threw the number away.
--
-- Stored on the row rather than fetched per row by the surface, because the
-- queue is materialised for exactly this reason — "the tool may take time to
-- find cleanup candidates based on the size of your Ontology" — and a list of
-- 5,632 candidates should not become 5,632 round trips to render a column.
--
-- OFF IS NOT ZERO. 579's rule holds here: `ontology_usage_window_covered()` says
-- whether metrics were on for the whole window, and where they were not the
-- count is NULL rather than 0. A zero means "nobody used this"; a null means
-- "we were not counting", and rendering the second as the first is how a live
-- object type gets deleted.

ALTER TABLE public.cleanup_candidates
  ADD COLUMN reads bigint;

COMMENT ON COLUMN public.cleanup_candidates.reads IS
  'Reads over the usage window at the moment the queue was computed. NULL where '
  'metrics were not on for the whole window — not zero, which would read as "unused".';

CREATE OR REPLACE FUNCTION public.run_cleanup(p_config uuid)
RETURNS integer LANGUAGE plpgsql AS $fn$
DECLARE c record; t record; hits text[]; n int := 0; covered boolean;
BEGIN
  SELECT * INTO c FROM public.cleanup_configurations WHERE id = p_config;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'Ontology:CleanupConfigurationNotFound — % is not a configuration you can run', p_config;
  END IF;

  -- Asked once for the ontology, not once per type: the window is a property of
  -- when metrics were switched on, which does not vary by object type.
  covered := public.ontology_usage_window_covered(c.ontology_id, 30);

  DELETE FROM public.cleanup_candidates WHERE configuration_id = p_config;

  FOR t IN SELECT id FROM public.object_types WHERE ontology_id = c.ontology_id LOOP
    -- "Once you act on an object type in your queue, it disappears from the
    --  queue" — a live snooze keeps it out.
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.cleanup_snoozes s
                           WHERE s.user_id = c.user_id AND s.object_type_id = t.id
                             AND s.until > now());
    hits := public.object_type_cleanup_flags(t.id, p_config);
    CONTINUE WHEN cardinality(hits) = 0;

    INSERT INTO public.cleanup_candidates (configuration_id, object_type_id, flags, priority, reads)
    VALUES (p_config, t.id, hits,
            -- "sorted by the highest priority among the flags that an object
            --  type triggers" — highest is the LOWEST rank.
            (SELECT e.priority FROM public.cleanup_effective_flags(p_config) e
              WHERE e.flag = ANY (hits)
              ORDER BY public.cleanup_priority_rank(e.priority) LIMIT 1),
            CASE WHEN covered
              THEN (SELECT s.reads FROM public.ontology_usage_summary(t.id, 30) s)
              ELSE NULL END);
    n := n + 1;
  END LOOP;

  UPDATE public.cleanup_configurations SET computed_at = now() WHERE id = p_config;
  RETURN n;
END $fn$;

DO $$
DECLARE n int;
BEGIN
  -- The column exists and nothing has claimed a count it could not have.
  SELECT count(*) INTO n FROM public.cleanup_candidates WHERE reads < 0;
  IF n > 0 THEN RAISE EXCEPTION '% candidate(s) carry a negative read count', n; END IF;

  -- And run_cleanup still parses and still returns a count, called on a
  -- configuration that does not exist so nothing is written.
  BEGIN
    PERFORM public.run_cleanup(gen_random_uuid());
    RAISE EXCEPTION 'run_cleanup accepted a configuration that does not exist';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%CleanupConfigurationNotFound%' THEN RAISE; END IF;
  END;
END $$;
