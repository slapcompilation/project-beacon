-- 791 — a transaction knows the one it follows
--
-- Found while building 790, and mine. A dataset view is a walk: it starts at
-- the head of a branch, follows parent_transaction_id backwards to the latest
-- SNAPSHOT, and takes the newest version of each path in between. That is the
-- algorithm data-integration/datasets prints and 393 and 394 implement.
--
-- Only create_transaction (638) ever set that link. Five other functions insert
-- a transaction row directly and leave it NULL — sync_table_region,
-- run_build_job, record_batch_run, create_audit_export and
-- build_materialization — so each of their transactions is a root, and the
-- walk from it reaches nothing earlier.
--
-- WHY IT HAS NEVER SHOWN. Every one of those five writes SNAPSHOT, and a
-- SNAPSHOT is the boundary the walk stops at:
--
--   "an intermediate snapshot transaction will remove all files from the view"
--   — api/datasets-resources-files-list-files.md
--
-- So a chain that cannot reach past the snapshot loses nothing, and the view
-- has been right for every dataset this platform has ever written. 790's upload
-- is the first APPEND anyone has produced here, and an APPEND is additive, so
-- it is the first write that needed the link to exist. Reading it back showed a
-- second file replacing the first instead of joining it.
--
-- WHAT ELSE IT COST, which is the part that matters beyond uploads: an
-- as-of-time view. dataset_view takes a timestamp, and asking for one earlier
-- than a root transaction returns an empty view rather than the state that was
-- there, because the walk has nowhere to go. That is broken today for every
-- dataset those five wrote, and this fixes it.
--
-- WHERE THE RULE GOES. Down the ladder: this is a fact that needs another
-- table — the branch's current head — so it is a trigger rather than a CHECK,
-- and it goes on the table rather than into six call sites, because a rule
-- restated in six places is a rule that will be missed in the seventh. 790 was
-- written before this existed and calls create_transaction directly, which the
-- trigger then leaves alone; both paths now agree.

BEGIN;

CREATE FUNCTION public.link_transaction_to_branch_head()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  -- A caller that already named a parent is obeyed: create_transaction does,
  -- and a branch created from another branch's transaction will want to.
  IF NEW.parent_transaction_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT b.head_transaction_id INTO NEW.parent_transaction_id
    FROM public.dataset_branches b WHERE b.id = NEW.branch_id;
  RETURN NEW;
END $fn$;

COMMENT ON FUNCTION public.link_transaction_to_branch_head() IS
  'Fills parent_transaction_id from the branch head when a writer did not. The dataset view walks that link back to the latest SNAPSHOT, so a transaction without it is a root whose view is only its own files — invisible while every writer emitted SNAPSHOT, and wrong for the first APPEND.';

CREATE TRIGGER link_transaction_to_branch_head
  BEFORE INSERT ON public.dataset_transactions
  FOR EACH ROW EXECUTE FUNCTION public.link_transaction_to_branch_head();

-- The history already written. Each branch's transactions are chained in the
-- order they were committed, which is the order create_transaction would have
-- produced had it been the only writer. Only NULL parents are touched, and
-- only where an earlier transaction exists on the same branch, so a genuine
-- first transaction stays a root.
WITH ordered AS (
  SELECT t.id, t.branch_id,
         lag(t.id) OVER (PARTITION BY t.branch_id
                         ORDER BY coalesce(t.committed_at, t.started_at), t.started_at) AS prev
    FROM public.dataset_transactions t
)
UPDATE public.dataset_transactions t
   SET parent_transaction_id = o.prev
  FROM ordered o
 WHERE o.id = t.id
   AND t.parent_transaction_id IS NULL
   AND o.prev IS NOT NULL;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE
  org uuid; sp uuid; proj uuid; ds uuid; br uuid; usr uuid;
  t1 uuid; t2 uuid; n integer; par uuid; mid timestamptz;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m791 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm791-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm791-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M791 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m791proj', 'm791proj', sp, org) RETURNING id INTO proj;
  INSERT INTO public.datasets (api_name, name, project_id, organization_id)
  VALUES ('m791ds', 'm791', proj, org) RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  -- 1. Two APPENDs of different paths must BOTH be in the view. This is the
  --    read that failed before the trigger existed.
  t1 := public.upload_file_to_dataset(ds, 'a.csv', 'name' || chr(10) || 'Ada' || chr(10));
  mid := clock_timestamp();
  t2 := public.upload_file_to_dataset(ds, 'b.csv', 'name' || chr(10) || 'Kay' || chr(10));

  SELECT count(*) INTO n FROM public.dataset_view(br);
  IF n <> 2 THEN
    RAISE EXCEPTION 'an APPEND adds to the view rather than replacing it; got % file(s)', n;
  END IF;

  -- 2. the link itself
  SELECT parent_transaction_id INTO par FROM public.dataset_transactions WHERE id = t2;
  IF par IS DISTINCT FROM t1 THEN
    RAISE EXCEPTION 'the second transaction should follow the first, got %', par;
  END IF;

  -- 3. a raw INSERT — the shape the five other writers use — is linked too
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status)
  VALUES (ds, br, 'APPEND', 'OPEN') RETURNING id, parent_transaction_id INTO t1, par;
  IF par IS DISTINCT FROM t2 THEN
    RAISE EXCEPTION 'a direct insert must still follow the branch head, got %', par;
  END IF;
  DELETE FROM public.dataset_transactions WHERE id = t1;

  -- 4. an explicit parent is obeyed rather than overwritten
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status, parent_transaction_id)
  VALUES (ds, br, 'APPEND', 'OPEN', NULL) RETURNING id INTO t1;
  DELETE FROM public.dataset_transactions WHERE id = t1;

  -- 5. the as-of-time view now reaches back instead of coming up empty
  SELECT count(*) INTO n FROM public.dataset_view(br, mid);
  IF n <> 1 THEN
    RAISE EXCEPTION 'the view as of a point between the two uploads holds one file, got %', n;
  END IF;

  -- 6. a SNAPSHOT still resets the view, which is the reason this was invisible
  PERFORM public.upload_file_to_dataset(ds, 'c.csv', 'name' || chr(10) || 'Hop' || chr(10),
    'master', NULL, 'SNAPSHOT');
  SELECT count(*) INTO n FROM public.dataset_view(br);
  IF n <> 1 THEN
    RAISE EXCEPTION 'a SNAPSHOT view holds exactly the files of that transaction, got %', n;
  END IF;

  -- 7. nothing already written was left a root where a predecessor exists
  SELECT count(*) INTO n
    FROM public.dataset_transactions t
   WHERE t.parent_transaction_id IS NULL
     AND EXISTS (SELECT 1 FROM public.dataset_transactions e
                  WHERE e.branch_id = t.branch_id
                    AND coalesce(e.committed_at, e.started_at) < coalesce(t.committed_at, t.started_at));
  IF n <> 0 THEN
    RAISE EXCEPTION '% transaction(s) are still roots with an earlier sibling', n;
  END IF;

  DELETE FROM public.organizations WHERE id = org;
  EXECUTE 'DROP TABLE IF EXISTS datasets.m791ds';
  RAISE NOTICE '791 proved: an APPEND adds, the chain links, and time travel reaches back';
END $do$;

COMMIT;
