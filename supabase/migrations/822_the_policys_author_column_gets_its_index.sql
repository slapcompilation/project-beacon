-- The policy's author column gets its index, and its redundant one goes.
--
-- 821's table failed `catalog hygiene > every foreign key has an index on its
-- leading column` on `object_security_policies.created_by`. The suite is right
-- and the omission is mine; 821 is applied and immutable, so this corrects it
-- forward.
--
-- WHILE HERE, THE OPPOSITE MISTAKE IN THE SAME TABLE. 821 declared
-- object_type_id both UNIQUE and separately indexed. A unique constraint is
-- backed by a btree index, so `object_security_policies_object_type_idx` is a
-- second copy of one Postgres had already built — dead weight on every write
-- and a false signal to the next reader that the column needed help. Nothing
-- failed on it, which is why it is worth removing by hand.

create index object_security_policies_created_by_idx
  on public.object_security_policies (created_by);

drop index public.object_security_policies_object_type_idx;

-- PROVED BY DOING: the hygiene rule the suite checks now holds for this table,
-- asked the way the suite asks it, and the unique index is still there to serve
-- the lookups the dropped one was duplicating.
DO $$
DECLARE v_unindexed text; v_n int;
BEGIN
  SELECT string_agg(c.conrelid::regclass || '.' || a.attname, ', ')
    INTO v_unindexed
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
   WHERE c.contype = 'f'
     AND c.conrelid = 'public.object_security_policies'::regclass
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);
  IF v_unindexed IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: still unindexed: %', v_unindexed;
  END IF;

  -- One index per column that needs one, and no duplicate on object_type_id.
  SELECT count(*) INTO v_n FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
   WHERE i.indrelid = 'public.object_security_policies'::regclass
     AND a.attname = 'object_type_id';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: expected exactly one index leading on object_type_id, found %', v_n;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
     WHERE i.indrelid = 'public.object_security_policies'::regclass AND i.indisunique
       AND i.indkey[0] = (SELECT attnum FROM pg_attribute
                           WHERE attrelid = 'public.object_security_policies'::regclass
                             AND attname = 'object_type_id')) THEN
    RAISE EXCEPTION 'PROOF FAILED: the surviving object_type_id index is not the unique one';
  END IF;
  RAISE NOTICE 'PROVED: created_by indexed, object_type_id indexed exactly once, by its unique constraint';
END $$;
