-- 754 — the instruction set names its page by its real path.
--
-- 753's constraint comment declared its values as coming from
-- ontologies-v2-resources-actions-apply-action — a slug the vocabulary suite
-- resolves against the mirror root, where no such page exists; it lives under
-- api/. The suite failed on main exactly as designed ("a value set names the
-- page it came from"), which is this guard doing its job one commit late: I
-- shipped 753 without running the full platform suite locally, and the two
-- suites that would have caught it ran first in CI. An applied migration is
-- immutable; a comment is not part of one, so the correction lands here.

COMMENT ON CONSTRAINT link_edits_instruction_check ON public.link_edits IS
  'Values from api/ontologies-v2-resources-actions-apply-action';

-- ── PROVED BY DOING — the named page exists and carries both values ─────────

DO $$
DECLARE c text;
BEGIN
  SELECT pg_catalog.obj_description(oid, 'pg_constraint') INTO c
    FROM pg_constraint
   WHERE conname = 'link_edits_instruction_check'
     AND conrelid = 'public.link_edits'::regclass;
  IF c IS DISTINCT FROM 'Values from api/ontologies-v2-resources-actions-apply-action' THEN
    RAISE EXCEPTION 'the correction did not land: %', c;
  END IF;
END $$;
