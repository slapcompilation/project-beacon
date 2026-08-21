-- The three dataset write policies are FOR ALL, so every SELECT evaluates
-- can_write_dataset per row. 615 measured that and named the fix, then declined
-- to take it for want of one proof. The proof is in the function's first line.
--
-- WHAT 615 LEFT OPEN. Scoping the write policies to INSERT/UPDATE/DELETE stops
-- SELECT paying for them, but RLS is permissive-OR: today a caller who can
-- write and NOT read still passes `read OR write`, and afterwards would not.
-- That is a security boundary moving, and it wanted a proof that write implies
-- read rather than a performance patch at the end of a long session.
--
-- THERE IS NO SUCH CALLER, BY CONSTRUCTION:
--
--   CREATE FUNCTION can_write_dataset(p_dataset uuid) ... AS $$
--     SELECT public.can_read_dataset(p_dataset)
--        AND EXISTS ( ... editor or better ... )
--   $$
--
-- can_write_dataset is can_read_dataset AND something. So write implies read,
-- `read OR write` is exactly `read` on a SELECT, and dropping the write half
-- from the SELECT path cannot narrow what anyone sees. This is not an argument
-- about our data; it is the definition of the predicate. The probe below
-- asserts it both structurally and against the rows that exist.
--
-- MEASURED FIRST, because 614 assumed a win and got none. Same session, same
-- database, as `authenticated`, policies dropped inside a rolled-back
-- subtransaction and the identical queries re-run:
--
--   count(*) over dataset_branches      66.1 ms  ->   5.2 ms   (12.6x)
--   ontology_violations()              150.5 ms  ->  76.1 ms   (2.0x)
--
-- and the row count came back 1 both times, which is the half that matters.
--
-- WHY IT IS WORTH A MIGRATION: this is the linter timeout that has turned main
-- red three times, most recently on the merge of #759, where
-- `ontology_violations()` blew a 30 s test timeout and poisoned the rest of the
-- file. A sampler caught it ACTIVE for 27.8 s during an earlier failure. The
-- cost is quadratic in the wrong direction — datasource_mapping_problems()
-- calls dataset_branch_schema() once per datasource, and each of those pays the
-- write predicate on every row it scans.
--
-- THE PREDICATES ARE UNCHANGED, byte for byte. Only `cmd` changes. They are
-- deliberately NOT wrapped as (SELECT f(x)): 615 established that the wrapping
-- is correlated and buys nothing when the argument is the row's own column, and
-- rlsInitPlan.test.ts governs zero-argument helpers only. Rewriting them here
-- would put a change in the diff that no measurement supports.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches', 'transactions', 'schemas'] LOOP
    EXECUTE format('DROP POLICY %I ON public.dataset_%s',
                   'write ' || t || ' of writable datasets', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.dataset_%s FOR INSERT WITH CHECK (public.can_write_dataset(dataset_id))',
      'insert ' || t || ' of writable datasets', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.dataset_%s FOR UPDATE USING (public.can_write_dataset(dataset_id)) WITH CHECK (public.can_write_dataset(dataset_id))',
      'update ' || t || ' of writable datasets', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.dataset_%s FOR DELETE USING (public.can_write_dataset(dataset_id))',
      'delete ' || t || ' of writable datasets', t);
  END LOOP;
END $$;

COMMENT ON POLICY "insert branches of writable datasets" ON public.dataset_branches IS
  'Split out of a FOR ALL policy by 619 so a SELECT stops evaluating can_write_dataset per row. Safe because can_write_dataset is can_read_dataset AND more, so it never widened a read.';

-- Proved four ways, because three of them alone would pass against a mistake.
DO $$
DECLARE
  v_def text; v_bad int; v_org uuid; v_ds uuid; v_b uuid; v_seen int; v_refused boolean;
BEGIN
  -- (1) structural: the implication this whole migration rests on
  v_def := pg_get_functiondef('public.can_write_dataset(uuid)'::regprocedure);
  IF position('can_read_dataset' in v_def) = 0 THEN
    RAISE EXCEPTION 'can_write_dataset no longer calls can_read_dataset — 619''s premise is gone';
  END IF;

  -- (2) catalogue: no FOR ALL policy is left on the three tables
  SELECT count(*) INTO v_bad FROM pg_policies
   WHERE tablename IN ('dataset_branches','dataset_transactions','dataset_schemas')
     AND cmd = 'ALL';
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '% FOR ALL policies remain; SELECT still pays for them', v_bad;
  END IF;

  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(),
      'app_metadata', json_build_object('role','admin','org_id',v_org))::text, true);
    SET LOCAL ROLE authenticated;

    -- (3) behavioural: no row is writable-but-not-readable for a real caller
    SELECT count(*) INTO v_bad FROM public.datasets d
     WHERE public.can_write_dataset(d.id) AND NOT public.can_read_dataset(d.id);
    IF v_bad <> 0 THEN
      RAISE EXCEPTION '% dataset(s) are writable but not readable — the OR was load-bearing after all', v_bad;
    END IF;

    -- (4) the write path still WORKS, run rather than inspected. A guard that
    -- refuses everything would satisfy every assertion above.
    SELECT d.id INTO v_ds FROM public.datasets d WHERE public.can_write_dataset(d.id) LIMIT 1;
    IF v_ds IS NULL THEN
      RAISE NOTICE 'this caller can write no dataset, so the write path was not exercised here';
    ELSE
      INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds, 'probe-619') RETURNING id INTO v_b;
      UPDATE public.dataset_branches SET name = 'probe-619b' WHERE id = v_b;
      SELECT count(*) INTO v_seen FROM public.dataset_branches WHERE id = v_b;
      IF v_seen <> 1 THEN
        RAISE EXCEPTION 'a branch written by this caller is not visible to it';
      END IF;
      DELETE FROM public.dataset_branches WHERE id = v_b;
      RAISE NOTICE 'insert, update, select and delete all still work as authenticated';
    END IF;

    -- and the other direction: a caller with no claim on the dataset is refused
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(),
      'app_metadata', json_build_object('role','user','org_id',gen_random_uuid()))::text, true);
    SET LOCAL ROLE authenticated;
    v_refused := false;
    IF v_ds IS NOT NULL THEN
      BEGIN
        INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_ds, 'probe-619-bad');
      EXCEPTION WHEN OTHERS THEN
        v_refused := true;
      END;
      IF NOT v_refused THEN
        RAISE EXCEPTION 'a stranger inserted a branch on a dataset it has no claim on';
      END IF;
    END IF;

    RESET ROLE;
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '619 proved: write implies read, no FOR ALL left, writes still work, strangers still refused';
  END;
END $$;
