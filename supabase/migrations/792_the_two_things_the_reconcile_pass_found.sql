-- 792 — the two things the reconcile pass found
--
-- Comment-only. 789 to 791 shipped and then the source pages were re-read
-- whole, which is where this repository finds most of what it finds. Both
-- findings are about claims rather than behaviour, and a claim in a COMMENT is
-- read next session as fact, so both are corrected forward here.
--
-- ── 1. 790 IS STRICTER THAN FOUNDRY, AND SAID NOTHING ABOUT IT ──────────────
--
-- upload_file_to_dataset refuses an APPEND or UPDATE whose inferred schema
-- differs from the dataset's current one. Foundry does not:
--
--   "a new transaction may introduce a new column to a tabular dataset or change the type of a field"
--   — data-integration/datasets.md
--
-- and it tolerates the result because a schema describes a VIEW rather than the
-- files under it:
--
--   "there is no guarantee that the files in a dataset actually conform to the specified schema"
--   — data-integration/datasets.md
--
-- So in Foundry the newest schema wins and older files simply may not conform,
-- which surfaces as a read error in whatever is reading. That model needs a
-- file store. Ours materialises one physical table per dataset with one column
-- set, so two files with different columns cannot both be represented and the
-- refusal is forced by the substrate rather than chosen.
--
-- THE DIVERGENCE IS SCOPED, because one nobody scoped grows. It applies only
-- where a dataset already has a committed schema and the new file's inferred
-- schema differs; a SNAPSHOT is unaffected, since it replaces the view and
-- rematerialises. The route out is not to relax the check: it is to widen the
-- physical table when a transaction adds a column, leaving earlier rows NULL,
-- which is the same outcome Foundry's readers get. That is a build, not a
-- comment, and it is not this one. Until then the refusal keeps its name and
-- now says why it exists.
--
-- Consistent with the FAQ, which documents this exact case failing rather than
-- merging, and is explicit that its workaround does not replicate what Parquet
-- does. Being able to fail here is not the divergence; being unable to succeed
-- afterwards is.
--
-- ── 2. 791'S TRIGGER IS RIGHT TODAY AND HAS A NAMED EXPIRY ──────────────────
--
--   "A view may constitute transactions from multiple branches."
--   — data-integration/datasets.md
--
-- The page's example is a branch whose view starts from master's SNAPSHOT and
-- APPENDs. Reaching those means the branch's first transaction must point at
-- the parent branch's head, and 791's trigger reads the head of the
-- transaction's OWN branch — which is NULL on a branch that has never been
-- written to.
--
-- It costs nothing today, and the reason is worth stating rather than assuming:
-- NOTHING IN THIS PLATFORM CREATES A CHILD DATASET BRANCH. parent_branch_id has
-- existed on dataset_branches since 392 and the only writer anywhere is 405's
-- own assertion block, which is a fixture. Every dataset branch in production is
-- a root named master. So the documented multi-branch view is unreachable here,
-- not wrong, and this is one more column with no writer.
--
-- The condition under which the trigger stops being enough, stated so it is not
-- rediscovered: the day something creates a child branch, that branch's
-- head_transaction_id must be seeded from the parent's head at creation. Then
-- the trigger keeps working unchanged, because it reads a head that is already
-- correct. Seeding at creation is the fix; special-casing the trigger is not.

BEGIN;

COMMENT ON FUNCTION public.upload_file_to_dataset(uuid, text, text, text, jsonb, text) IS
  'Uploads one delimited file into an existing dataset, opening and committing its transaction the way api/datasets-resources-files-upload-file describes. The transaction type follows dataset-preview/overview: the same filename and schema is UPDATE, a new filename is APPEND, and a same-filename different-schema upload is refused because no page defines it. SCOPED DIVERGENCE (792): an APPEND or UPDATE whose inferred schema differs from the dataset''s current one is also refused, which data-integration/datasets does not require — there a new transaction may add a column and older files simply may not conform. Ours materialises one physical table with one column set, so the refusal is forced by the substrate; the way out is to widen the table on a column-adding transaction, not to relax the check. A SNAPSHOT is unaffected.';

COMMENT ON FUNCTION public.link_transaction_to_branch_head() IS
  'Fills parent_transaction_id from the branch head when a writer did not. The dataset view walks that link back to the latest SNAPSHOT, so a transaction without it is a root whose view is only its own files — invisible while every writer emitted SNAPSHOT, and wrong for the first APPEND. LIMIT (792): it reads the head of the transaction''s own branch, which is NULL on a branch never written to. data-integration/datasets says a view may constitute transactions from multiple branches, so a child branch must reach its parent''s history. That costs nothing today because nothing creates a child dataset branch — parent_branch_id''s only writer anywhere is 405''s assertion block. When one exists, seed its head_transaction_id from the parent at creation and this trigger stays correct unchanged.';

COMMENT ON COLUMN public.dataset_branches.parent_branch_id IS
  'The branch this one was cut from. Storage with no writer: nothing in the platform creates a child dataset branch, and the only insert that sets this is a fixture inside 405. Recorded by 792 so the next reader does not infer from its existence that branching datasets is built.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────
-- A comment-only migration can still assert what it claims, and these claims
-- are checkable: that the divergence is recorded where a reader will meet it,
-- and that the fact it rests on is still true.

DO $do$
DECLARE cm text; n integer;
BEGIN
  SELECT obj_description(p.oid, 'pg_proc') INTO cm
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'upload_file_to_dataset';
  IF cm NOT LIKE '%SCOPED DIVERGENCE%' THEN
    RAISE EXCEPTION 'the upload must carry its divergence where a reader meets it';
  END IF;

  SELECT obj_description(p.oid, 'pg_proc') INTO cm
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'link_transaction_to_branch_head';
  IF cm NOT LIKE '%LIMIT (792)%' THEN
    RAISE EXCEPTION 'the trigger must carry the condition under which it stops being enough';
  END IF;

  -- The claim the second finding rests on. If a child branch ever appears, this
  -- assertion is where the comment above stops being true, and it will say so
  -- by failing on a later apply.
  SELECT count(*) INTO n FROM public.dataset_branches WHERE parent_branch_id IS NOT NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION '% child dataset branch(es) now exist, so seed head_transaction_id at creation and revisit 792', n;
  END IF;

  RAISE NOTICE '792 proved: the divergence is scoped and the branch claim still holds';
END $do$;

COMMIT;
