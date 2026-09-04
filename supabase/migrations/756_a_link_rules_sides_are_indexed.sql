-- 756 — a link rule's sides are indexed.
--
-- The catalog-hygiene suite requires every foreign key to carry an index on
-- its leading column, and 755's two side-parameter columns did not. The guard
-- caught it on the full local run, before the push this time.

CREATE INDEX action_type_rules_source_parameter_id_idx
  ON public.action_type_rules (source_parameter_id);
CREATE INDEX action_type_rules_target_parameter_id_idx
  ON public.action_type_rules (target_parameter_id);

-- ── PROVED BY DOING — both foreign keys now lead an index ───────────────────

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM pg_constraint c
   WHERE c.conrelid = 'public.action_type_rules'::regclass AND c.contype = 'f'
     AND c.conname LIKE '%parameter_id%'
     AND NOT EXISTS (SELECT 1 FROM pg_index i
                      WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);
  IF n <> 0 THEN RAISE EXCEPTION '% side-parameter foreign key(s) still unindexed', n; END IF;
END $$;
