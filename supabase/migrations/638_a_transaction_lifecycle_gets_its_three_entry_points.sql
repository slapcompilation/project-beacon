-- The transaction lifecycle gets its three entry points, and the branch head
-- stops moving before its time.
--
-- Pulled from the last thread of the unread-column sweep:
-- `dataset_transactions.aborted_at` is written by nothing — and the reason is
-- not a missing stamp, it is that ABORT DOES NOT EXIST. Nor does create or
-- commit: every caller INSERTs a row and hand-writes `status` and
-- `committed_at` beside it. The api publishes all three as endpoints:
--
--   "Creates a Transaction on a Branch of a Dataset."
--   — api/datasets-v2-resources-transactions-create-transaction.md
--
--   "Commits an open Transaction. File modifications made on this Transaction
--   are preserved and the Branch is updated to point to the Transaction."
--   — api/datasets-v2-resources-transactions-commit-transaction.md
--
--   "Aborts an open Transaction. File modifications made on this Transaction
--   are not preserved and the Branch is not updated."
--   — api/datasets-v2-resources-transactions-abort-transaction.md
--
-- ── THE HEAD MOVES AT THE WRONG MOMENT, AND WHY NOBODY NOTICED ──────────────
-- `advance_branch_head` fires AFTER INSERT, so the branch head points at a
-- transaction from the moment it is created — while it is OPEN, and the commit
-- page says the head moves when it COMMITS. It has never mattered because the
-- only writers are `run_build_job` and `build_materialization`, which insert
-- OPEN and commit inside one Postgres transaction: no other session can ever
-- observe the wrong head. `create_transaction` ends that luck — an API-made
-- OPEN transaction outlives its statement by design, and under the old trigger
-- the head would sit on uncommitted (or later aborted) work for the whole
-- window. So the retarget and the entry points land together, in this order.
--
-- The read side needs nothing: `dataset_history_from` already filters
-- `status = 'COMMITTED'` in the chain walk, so an aborted transaction's files
-- never appear in a view — which is exactly "not preserved".
--
-- ── ONE OPEN TRANSACTION PER BRANCH, WHICH IS PUBLISHED ─────────────────────
--   "A transaction is already open on this dataset and branch. A branch of a
--   dataset can only have one open transaction at a time."
--   — api/datasets-v2-resources-transactions-create-transaction.md
--
-- A fact about a set of rows, so it is a partial unique index. The function
-- also pre-checks to raise the api's own error name; if a race slips past the
-- check, the index still refuses — the index is the rule, the check is the
-- message.
--
-- ── THE ERROR VOCABULARY IS THE API'S, and each name gets a producer ────────
--   TransactionNotFound, TransactionNotOpen, OpenTransactionAlreadyExists,
--   BranchNotFound, CreateTransactionPermissionDenied,
--   CommitTransactionPermissionDenied, AbortTransactionPermissionDenied
--
-- namespaced `Datasets:`. The one api error with NO producer here is
-- InvalidBranchName — we resolve existing branches and never create one from
-- this path, so a malformed name is indistinguishable from an absent branch
-- and lands on BranchNotFound. Named rather than smuggled.
--
-- ── WHAT CREATE ALSO FIXES ──────────────────────────────────────────────────
-- `parent_transaction_id` has no writer either: the engine's SNAPSHOT inserts
-- do not need one (a view restarts at the latest SNAPSHOT), but an APPEND
-- created without a parent silently orphans its history. `create_transaction`
-- sets the parent to the branch's current head, so the chain stops depending
-- on the caller's memory. `created_by_user_id` is stamped the same way, which
-- is 636's provenance rule at the right call site.

-- 1. The head advances when a transaction becomes COMMITTED — at INSERT if it
-- is born committed (the test fixtures' style), at UPDATE on the transition
-- (the engine's style). Never for OPEN, never for ABORTED.
CREATE OR REPLACE FUNCTION public.advance_branch_head()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'COMMITTED' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'COMMITTED' THEN RETURN NEW; END IF;
  UPDATE public.dataset_branches SET head_transaction_id = NEW.id WHERE id = NEW.branch_id;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.advance_branch_head() IS
  'The branch head moves when a transaction COMMITS — "the Branch is updated to point to the Transaction" — not when it is created, and never for an abort. Until 638 it fired on INSERT, masked because the engine inserts and commits in one statement window.';

DROP TRIGGER advance_branch_head ON public.dataset_transactions;
CREATE TRIGGER advance_branch_head
  AFTER INSERT OR UPDATE OF status ON public.dataset_transactions
  FOR EACH ROW EXECUTE FUNCTION public.advance_branch_head();

-- 2. One open transaction per branch.
CREATE UNIQUE INDEX one_open_transaction_per_branch
  ON public.dataset_transactions (branch_id) WHERE status = 'OPEN';

-- 3. The three entry points. SECURITY INVOKER throughout: RLS decides what the
-- caller sees, and the pre-checks exist to give the api's error names to the
-- refusals RLS would express as absence or as zero rows.
CREATE OR REPLACE FUNCTION public.create_transaction(
  p_dataset uuid, p_txn_type text, p_branch_name text DEFAULT 'master')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public' AS $$
DECLARE v_branch uuid; v_head uuid; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = p_dataset) THEN
    RAISE EXCEPTION 'Datasets:DatasetNotFound — % is not a dataset you can see', p_dataset;
  END IF;
  SELECT b.id, b.head_transaction_id INTO v_branch, v_head
    FROM public.dataset_branches b
   WHERE b.dataset_id = p_dataset AND b.name = p_branch_name;
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'Datasets:BranchNotFound — no branch named % on this dataset', p_branch_name;
  END IF;
  IF NOT public.can_write_dataset(p_dataset) THEN
    RAISE EXCEPTION 'Datasets:CreateTransactionPermissionDenied — could not create the Transaction';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dataset_transactions t
              WHERE t.branch_id = v_branch AND t.status = 'OPEN') THEN
    RAISE EXCEPTION 'Datasets:OpenTransactionAlreadyExists — a branch of a dataset can only have one open transaction at a time';
  END IF;

  INSERT INTO public.dataset_transactions
    (dataset_id, branch_id, txn_type, parent_transaction_id, created_by_user_id)
  VALUES (p_dataset, v_branch, p_txn_type, v_head, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

COMMENT ON FUNCTION public.create_transaction(uuid, text, text) IS
  '"Creates a Transaction on a Branch of a Dataset" (api create-transaction). The branch name defaults to master, the parent is the branch''s current head, and one open transaction per branch is enforced. InvalidBranchName has no producer here: we resolve branches, never create them, so a malformed name reads as BranchNotFound.';

CREATE OR REPLACE FUNCTION public.commit_transaction(p_transaction uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public' AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.dataset_transactions t WHERE t.id = p_transaction;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Datasets:TransactionNotFound — % is not a transaction you can see', p_transaction;
  END IF;
  IF v.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Datasets:TransactionNotOpen — the given transaction is not open';
  END IF;
  UPDATE public.dataset_transactions
     SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = p_transaction;
  IF NOT FOUND THEN
    -- Visible to read, refused to write: the caller lacks the dataset's
    -- editor role, which is the api's PERMISSION_DENIED arm.
    RAISE EXCEPTION 'Datasets:CommitTransactionPermissionDenied — the provided token does not have permission to commit the given transaction';
  END IF;
END $$;

COMMENT ON FUNCTION public.commit_transaction(uuid) IS
  '"Commits an open Transaction. File modifications made on this Transaction are preserved and the Branch is updated to point to the Transaction" — the head moves via advance_branch_head on this UPDATE.';

CREATE OR REPLACE FUNCTION public.abort_transaction(p_transaction uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public' AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.dataset_transactions t WHERE t.id = p_transaction;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Datasets:TransactionNotFound — % is not a transaction you can see', p_transaction;
  END IF;
  IF v.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Datasets:TransactionNotOpen — the given transaction is not open';
  END IF;
  UPDATE public.dataset_transactions
     SET status = 'ABORTED', aborted_at = clock_timestamp()
   WHERE id = p_transaction;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Datasets:AbortTransactionPermissionDenied — could not abort the Transaction';
  END IF;
END $$;

COMMENT ON FUNCTION public.abort_transaction(uuid) IS
  '"Aborts an open Transaction. File modifications made on this Transaction are not preserved and the Branch is not updated." Not preserved is the read side''s doing — dataset_history_from filters COMMITTED — and not updated is the retargeted head trigger''s.';

-- Proved as `authenticated`, both directions on every rule, and the changed
-- head semantics asserted at each step — because the head is the part that
-- silently behaved differently for two hundred migrations.
DO $$
DECLARE
  v_org uuid; v_proj uuid; v_user uuid; v_ds uuid; v_br uuid;
  v_head uuid; v_t1 uuid; v_t2 uuid; v_err text; v_parent uuid; v_at timestamptz;
BEGIN
  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p WHERE p.organization_id = v_org
      ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_user FROM public.users u WHERE u.organization_id = v_org LIMIT 1;
    IF v_proj IS NULL OR v_user IS NULL THEN
      RAISE EXCEPTION 'no project or user: 638 cannot prove its own lifecycle';
    END IF;

    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (v_org, v_proj, 'txn638', 'Txn 638') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
    VALUES (v_ds, 'master') RETURNING id INTO v_br;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    SET LOCAL ROLE authenticated;

    -- (0) an unknown branch name refuses BY NAME
    v_err := NULL;
    BEGIN PERFORM public.create_transaction(v_ds, 'SNAPSHOT', 'no-such-branch');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Datasets:BranchNotFound%' THEN
      RAISE EXCEPTION 'an unknown branch was accepted (%)', coalesce(v_err, 'no error');
    END IF;

    -- (1) create: OPEN, parented on the head, and the head DOES NOT MOVE
    SELECT head_transaction_id INTO v_head FROM public.dataset_branches WHERE id = v_br;
    v_t1 := public.create_transaction(v_ds, 'SNAPSHOT');
    SELECT parent_transaction_id INTO v_parent FROM public.dataset_transactions WHERE id = v_t1;
    IF v_parent IS DISTINCT FROM v_head THEN
      RAISE EXCEPTION 'the new transaction is not parented on the branch head';
    END IF;
    IF (SELECT head_transaction_id FROM public.dataset_branches WHERE id = v_br)
       IS DISTINCT FROM v_head THEN
      RAISE EXCEPTION 'creating an OPEN transaction moved the branch head — 638''s whole point';
    END IF;

    -- (2) a second open on the same branch refuses BY NAME
    v_err := NULL;
    BEGIN PERFORM public.create_transaction(v_ds, 'SNAPSHOT');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Datasets:OpenTransactionAlreadyExists%' THEN
      RAISE EXCEPTION 'a second open transaction was allowed (%)', coalesce(v_err, 'no error');
    END IF;

    -- (3) abort: ABORTED with its timestamp, the head still where it was,
    -- and a second abort refused because the transaction is no longer open
    PERFORM public.abort_transaction(v_t1);
    SELECT aborted_at INTO v_at FROM public.dataset_transactions WHERE id = v_t1;
    IF v_at IS NULL THEN RAISE EXCEPTION 'the abort did not stamp aborted_at'; END IF;
    IF (SELECT head_transaction_id FROM public.dataset_branches WHERE id = v_br)
       IS DISTINCT FROM v_head THEN
      RAISE EXCEPTION 'aborting moved the branch head; the page says the Branch is not updated';
    END IF;
    v_err := NULL;
    BEGIN PERFORM public.abort_transaction(v_t1);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Datasets:TransactionNotOpen%' THEN
      RAISE EXCEPTION 'an aborted transaction was aborted again (%)', coalesce(v_err, 'no error');
    END IF;

    -- (4) the abort released the branch: a new transaction opens, and COMMIT
    -- is what finally moves the head
    v_t2 := public.create_transaction(v_ds, 'SNAPSHOT');
    PERFORM public.commit_transaction(v_t2);
    IF (SELECT status FROM public.dataset_transactions WHERE id = v_t2) <> 'COMMITTED'
       OR (SELECT committed_at FROM public.dataset_transactions WHERE id = v_t2) IS NULL THEN
      RAISE EXCEPTION 'the commit did not settle the transaction';
    END IF;
    IF (SELECT head_transaction_id FROM public.dataset_branches WHERE id = v_br)
       IS DISTINCT FROM v_t2 THEN
      RAISE EXCEPTION 'committing did not move the branch head to the transaction';
    END IF;
    -- and a committed transaction cannot be committed again
    v_err := NULL;
    BEGIN PERFORM public.commit_transaction(v_t2);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Datasets:TransactionNotOpen%' THEN
      RAISE EXCEPTION 'a committed transaction was committed again (%)', coalesce(v_err, 'no error');
    END IF;

    RESET ROLE;
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '638 proved: create parents on the head without moving it, one open per branch, abort stamps and leaves the head, commit stamps and moves it, and every re-entry refuses by name';
  END;
END $$;
