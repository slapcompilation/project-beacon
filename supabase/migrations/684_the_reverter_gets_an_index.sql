-- 684: the reverter gets an index.
--
-- 682 indexed action_type_id and applied_by_user_id and forgot
-- reverted_by_user_id, which 464's rule covers: every foreign key has an
-- index on its leading column, so a cascade or a lookup by principal never
-- scans the table. The platform suite's catalog hygiene test named it.

CREATE INDEX action_applications_reverted_by_idx
  ON public.action_applications (reverted_by_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
     WHERE c.relname = 'action_applications' AND a.attname = 'reverted_by_user_id') THEN
    RAISE EXCEPTION 'the index did not land on the column it names';
  END IF;
  RAISE NOTICE '684 proved: reverted_by_user_id leads an index, as every foreign key here does';
END $$;
