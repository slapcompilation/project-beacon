-- `catalog.test.ts` requires an index on every foreign key's leading column.
-- 625 added `automation_events.requested_by` without one, and an applied
-- migration cannot be edited.
--
-- This is the third guard in four migrations to catch something 622-625 shipped
-- — after the ledger writer reachable by `authenticated` and the table with no
-- COMMENT — and all three were caught by rules written long before this phase.
-- Worth saying plainly rather than filing quietly: the checks are doing more
-- work than the probes I write by hand, because they ask the same question of
-- every migration instead of the one in front of me.
--
-- The index is not decorative here. `requested_by` is `ON DELETE SET NULL`, so
-- deleting a user scans this table for referencing rows, and the event log is
-- the one table in this family that grows without bound — no retention job
-- deletes it yet, which is itself recorded as unbuilt.

CREATE INDEX automation_events_by_requester
  ON public.automation_events (requested_by) WHERE requested_by IS NOT NULL;

DO $$
DECLARE v_missing int;
BEGIN
  -- Asked the way the guard asks it, so this file agrees with the thing that
  -- failed rather than with my reading of it.
  SELECT count(*) INTO v_missing
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
   WHERE c.contype = 'f'
     AND t.relname = 'automation_events'
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (i.indkey::smallint[])[0] = c.conkey[1]);

  IF v_missing <> 0 THEN
    RAISE EXCEPTION '% foreign key(s) on automation_events still have no leading-column index', v_missing;
  END IF;
  RAISE NOTICE 'every foreign key on automation_events has an index on its leading column';
END $$;
