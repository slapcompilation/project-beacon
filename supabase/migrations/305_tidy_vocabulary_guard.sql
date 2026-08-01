-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 305 — the guard's own output was unreadable.
--
-- 304's unbacked_vocabulary() cleaned the CHECK-constraint literals when
-- JOINING but returned them raw, so its finding read:
--
--   caught=['rejected_by'::text <- restock_requests.rejected_by]
--
-- A guard nobody can read at a glance is a guard people learn to skim. Same
-- cleaning on the way out as on the way in.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.unbacked_vocabulary()
RETURNS TABLE (edge_type text, backing text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  WITH vocab AS (
    SELECT replace(replace(trim(v), '''', ''), '::text', '') AS edge_type
    FROM pg_constraint con,
         unnest(string_to_array(substring(pg_get_constraintdef(con.oid) from '\((.*)\)'), ', ')) AS v
    WHERE con.conname = 'relationship_edges_edge_type_check'
  )
  SELECT DISTINCT vo.edge_type, c.table_name || '.' || c.column_name
  FROM vocab vo
  JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.column_name = vo.edge_type
  JOIN pg_constraint fk
    ON fk.conrelid = ('public.' || c.table_name)::regclass AND fk.contype = 'f'
  WHERE NOT EXISTS (SELECT 1 FROM link_types l WHERE l.edge_type = vo.edge_type)
$$;

COMMENT ON FUNCTION public.unbacked_vocabulary() IS
  'Edge types the vocabulary allows that have a same-named foreign-key column and no link_types row — a relationship the schema already holds and the ontology cannot traverse. Narrow on purpose: it matches column NAMES, so a link backed by a differently-named column (belongs_to_session over session_id) slips past.';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM unbacked_vocabulary();
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 305: % vocabulary name(s) have a column and no link', n;
  END IF;
END $$;

COMMIT;
