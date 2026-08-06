-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 394 — anchor a view to a transaction, not only to a clock.
--
-- 393 implemented the documented algorithm faithfully: "A dataset view
-- represents the effective file contents of a dataset for a branch **at a point
-- in time**." Checking it against Palantir's own worked example found the
-- boundary case that phrasing hides.
--
-- `committed_at` is timestamptz — microseconds. A JavaScript Date is
-- milliseconds. Read a transaction's commit time into a client and hand it back
-- as `p_at`, and the value has been truncated: the transaction you anchored to
-- is now *after* your anchor and drops out of its own view. The view is off by
-- exactly one transaction, silently, and only for the transaction you named.
--
-- The fix is not to loosen the comparison — `<=` is right — but to offer the
-- anchor Foundry's own surfaces use. The History tab creates branches by
-- selecting a transaction; Data Lifetime's Deletions tab filters by Transaction
-- ID; `branching` says a child branch "can be created from another branch, or
-- **from any transaction**". A transaction is the identifier a user actually
-- holds. The clock stays available, because the algorithm is defined over it.
--
-- The walk is restructured accordingly: history is a chain from a transaction,
-- and a branch is just the transaction its pointer names.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.dataset_view(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.dataset_view_files(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.dataset_view_transactions(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.dataset_history(uuid, timestamptz);

-- The committed chain behind a transaction, oldest first. Crosses fork points,
-- because the parent chain does — "A view may constitute transactions from
-- multiple branches."
CREATE FUNCTION public.dataset_history_from(p_transaction uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (transaction_id uuid, txn_type text, committed_at timestamptz, seq bigint)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE chain AS (
    SELECT t.* FROM public.dataset_transactions t WHERE t.id = p_transaction
    UNION ALL
    SELECT t.* FROM public.dataset_transactions t
      JOIN chain c ON t.id = c.parent_transaction_id
  )
  SELECT c.id, c.txn_type, c.committed_at,
         row_number() OVER (ORDER BY c.committed_at, c.started_at)
    FROM chain c
   WHERE c.status = 'COMMITTED'
     AND (p_at IS NULL OR c.committed_at <= p_at)
   ORDER BY c.committed_at, c.started_at
$$;

-- "dataset branches are simply a pointer to the most recent transaction."
CREATE FUNCTION public.dataset_history(p_branch uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (transaction_id uuid, txn_type text, committed_at timestamptz, seq bigint)
LANGUAGE sql STABLE AS $$
  SELECT * FROM public.dataset_history_from(
    (SELECT b.head_transaction_id FROM public.dataset_branches b WHERE b.id = p_branch), p_at)
$$;

CREATE FUNCTION public.dataset_view_transactions_from(p_transaction uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (transaction_id uuid, txn_type text, seq bigint)
LANGUAGE sql STABLE AS $$
  WITH h AS (SELECT * FROM public.dataset_history_from(p_transaction, p_at)),
       -- "begins at the latest SNAPSHOT transaction before that point in time.
       --  If there is no SNAPSHOT transaction present, then take the earliest
       --  transaction for the dataset instead."
       start AS (
         SELECT coalesce((SELECT max(h.seq) FROM h WHERE h.txn_type = 'SNAPSHOT'),
                         (SELECT min(h.seq) FROM h)) AS seq
       )
  SELECT h.transaction_id, h.txn_type, h.seq
    FROM h, start s
   WHERE s.seq IS NOT NULL AND h.seq >= s.seq
   ORDER BY h.seq
$$;

CREATE FUNCTION public.dataset_view_transactions(p_branch uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (transaction_id uuid, txn_type text, seq bigint)
LANGUAGE sql STABLE AS $$
  SELECT * FROM public.dataset_view_transactions_from(
    (SELECT b.head_transaction_id FROM public.dataset_branches b WHERE b.id = p_branch), p_at)
$$;

-- The replay. Within the view the last transaction to touch a path decides its
-- fate: SNAPSHOT/APPEND/UPDATE set it, DELETE marks it removed.
CREATE FUNCTION public.dataset_view_from(p_transaction uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (file_id uuid, logical_path text, row_count integer)
LANGUAGE sql STABLE AS $$
  SELECT latest.id, latest.logical_path, latest.row_count FROM (
    SELECT DISTINCT ON (f.logical_path) f.id, f.logical_path, f.row_count, f.removes
      FROM public.dataset_view_transactions_from(p_transaction, p_at) v
      JOIN public.dataset_files f ON f.transaction_id = v.transaction_id
     ORDER BY f.logical_path, v.seq DESC
  ) latest
  WHERE NOT latest.removes
$$;

CREATE FUNCTION public.dataset_view(p_branch uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (file_id uuid, logical_path text, row_count integer)
LANGUAGE sql STABLE AS $$
  SELECT * FROM public.dataset_view_from(
    (SELECT b.head_transaction_id FROM public.dataset_branches b WHERE b.id = p_branch), p_at)
$$;

COMMENT ON FUNCTION public.dataset_view_from(uuid, timestamptz) IS
  'The view as of a transaction — the precision-safe anchor. Prefer this over a client-supplied timestamp: a JS Date truncates timestamptz to milliseconds and drops the transaction it names.';
COMMENT ON FUNCTION public.dataset_view(uuid, timestamptz) IS
  'The current view of a branch, or the view at a point in time. For "as of transaction X" use dataset_view_from, which cannot be truncated.';

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'dataset_view') <> 1 THEN
    RAISE EXCEPTION 'Migration 394: dataset_view is ambiguous — an overload survived the drop';
  END IF;
END $$;

COMMIT;
