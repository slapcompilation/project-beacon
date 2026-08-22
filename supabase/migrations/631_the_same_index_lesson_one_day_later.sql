-- 630 added a foreign key without an index on its leading column, and 626 —
-- applied yesterday — exists because 625 did the identical thing.
--
-- Worth writing down rather than quietly adding the index. The rule is not
-- obscure, the guard is not new, and I had read its failure output less than
-- twenty-four hours earlier. Reciting a lesson does not install it; the guard
-- did. That is the same finding as 543 quoting the runner-needs-a-caller rule
-- in the header of the migration that broke it, and it is now three for three
-- on this particular guard being the thing that notices.
--
-- The practical form, so the next new foreign key does not need a fourth: when
-- a migration writes `REFERENCES`, it writes `CREATE INDEX` in the same file.
-- `automation_effects.object_input_parameter_id` is `ON DELETE RESTRICT`, so
-- deleting an action parameter scans this table for referencing rows.

CREATE INDEX automation_effects_by_object_input
  ON public.automation_effects (object_input_parameter_id)
  WHERE object_input_parameter_id IS NOT NULL;

-- Asked the way the guard asks it, over every table this phase touched rather
-- than only the one that failed.
DO $$
DECLARE r record; v_bad text[] := '{}';
BEGIN
  FOR r IN
    SELECT t.relname AS tbl, c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE c.contype = 'f' AND n.nspname = 'public'
       AND t.relname IN ('automation_effects', 'automation_events',
                         'automation_runs', 'automations')
       AND NOT EXISTS (
         SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND (i.indkey::smallint[])[0] = c.conkey[1])
  LOOP
    v_bad := v_bad || format('%s.%s', r.tbl, r.conname);
  END LOOP;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION 'foreign keys with no leading-column index: %',
      array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE 'every foreign key on the four automation tables has its index';
END $$;
