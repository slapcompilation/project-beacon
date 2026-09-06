-- A recreated function says what it is again.
--
-- 762 changed three signatures, and a signature change is DROP + CREATE. The
-- text it recreates from is `pg_get_functiondef`, which carries the body, the
-- volatility, the search_path and nothing else — **not the COMMENT**. So
-- `apply_action`, `apply_function_edits` and `revert_action` came back without
-- theirs, and `pnpm gen:client` showed it immediately: three entities lost
-- their doc comment in the generated client, which is where anyone reading the
-- typed platform meets them.
--
-- The grants were remembered (762 re-granted, because the ACLs go the same
-- way) and the comments were not. Both belong in the same checklist: after a
-- DROP + CREATE, restore the ACL *and* the COMMENT.
--
-- Restored verbatim from what the generated client carried before 762, with
-- two corrections the restoration makes unavoidable — a comment is re-written
-- here, so leaving a sentence that has since gone false would be choosing to:
--
--   * `apply_action` said "The other four rule kinds refuse by name rather
--     than half-working." That was true of 592's registry. 755 made both link
--     rules executable and 760 the create-or-modify rule, so two refuse now:
--     the interface link kinds, which need an interface link constraint no
--     rule column points at.
--   * All three gain the sentence naming their usage argument (762), because
--     the argument is invisible in the body and the collision between
--     `p_application` (an `action_applications` id) and `p_application_name`
--     (what the page calls the application) is exactly what a reader of the
--     generated client needs told.

COMMENT ON FUNCTION public.apply_action(uuid, jsonb, text, text) IS
  'Apply an action: evaluate the submission criteria tree, validate required parameters, run create/modify/delete rules in order, append to the edit log with the action recorded on each edit. The next index build merges the result. The two interface link rule kinds refuse by name rather than half-working. Invoker — the edit lands through object_edits'' own policy. p_application is the calling application''s name for the usage ledger: one write per resource this request edited, nothing when the caller does not name itself (762).';

COMMENT ON FUNCTION public.apply_function_edits(uuid, jsonb, uuid, text) IS
  'Applies an edit function''s batch as one action application: 741''s preflight opens the application, this consumes it exactly once, and every edit carries the application id and apply_action''s own before-snapshot, so revert_action reads both paths the same way. 742. Note the two arguments that look alike: p_application is that application''s id, p_application_name is the calling application''s name for the usage ledger (762).';

COMMENT ON FUNCTION public.revert_action(uuid, text) IS
  'Reverts one action submission by appending compensating edits — create answered by delete, modify by a modify back to its before-image, delete by a create from it (action-types/action-reverts). Refuses a caller who is not the applier, an application already reverted or not revertible, and any object edited since. Side effects are NOT reverted: the page states that a revert "will not revert side effects, such as notifications or webhooks". p_application is the application being reverted; p_application_name is the calling application''s name for the usage ledger, whose write is recorded against the resources that application edited (762).';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(sig, ', ') INTO missing FROM (
    SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('apply_action', 'apply_function_edits', 'revert_action')
       AND obj_description(p.oid, 'pg_proc') IS NULL) q;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'these came back from 762 without a comment: %', missing;
  END IF;
  -- and the stale sentence is gone
  IF obj_description('public.apply_action(uuid, jsonb, text, text)'::regprocedure, 'pg_proc')
     LIKE '%other four rule kinds%' THEN
    RAISE EXCEPTION 'the four-kinds sentence outlived the registry it described';
  END IF;
END $$;
