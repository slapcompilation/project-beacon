-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 227 — G1: built-in types get properties DERIVED from their backing
-- table, so they can render through the generated Object View.
--
-- Foundry: "If you have an existing datasource … it will map every column of the
-- backing datasource to a property." `source_table` (migration 223) already IS
-- that backing datasource; this is the mapping it was waiting for.
--
-- Derived, never hand-written. A hand-copied schema is exactly the drift the 223
-- registration avoided by calling the row "a registration, not a definition" —
-- this reads information_schema so the table stays the single source of truth.
--
-- Complex columns are skipped, matching Foundry: "A backing datasource for an
-- object type may not contain MapType or StructType columns." Foreign keys are
-- skipped too — a raw uuid renders as noise, and the relationship belongs in a
-- link type, not a property.
--
-- Applied here ONLY to the four registered built-ins that have no hand-written
-- page (hotel, location, product_batch, stock_transfer). They are the types with
-- no Object View at all today, so they prove the path on real data. G2 extends
-- to the rest and adds the drift contract test.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.derive_object_type_properties(p_source_table text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'key',   c.column_name,
      -- "lot_number" → "Lot number": readable without a hand-written label.
      'label', upper(left(replace(c.column_name, '_', ' '), 1)) || substr(replace(c.column_name, '_', ' '), 2),
      'type',  CASE
                 WHEN c.data_type IN ('integer','bigint','smallint','numeric','real','double precision') THEN 'number'
                 WHEN c.data_type = 'boolean' THEN 'boolean'
                 WHEN c.data_type LIKE 'timestamp%' OR c.data_type = 'date' THEN 'date'
                 ELSE 'text'
               END,
      'required', c.is_nullable = 'NO'
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_source_table
    -- Identity and scope are the row's plumbing, not properties an operator reads.
    AND c.column_name NOT IN ('id','hotel_id','organization_id')
    -- Foreign keys: the relationship is a link type, not a raw uuid on the page.
    AND c.column_name NOT LIKE '%\_id'
    -- Foundry excludes Struct/Map columns from a backing datasource; jsonb,
    -- arrays and vectors/enums are ours.
    AND c.data_type NOT IN ('jsonb','json','ARRAY','USER-DEFINED');
$$;

COMMENT ON FUNCTION public.derive_object_type_properties(text) IS
  'Maps a backing table''s columns to PropertyDefs. Derived so the table stays the single source of truth; skips ids, FKs and complex columns.';

REVOKE EXECUTE ON FUNCTION public.derive_object_type_properties(text) FROM anon;

-- The four registered built-ins with no hand-written page. Guarded on kind so
-- this can never touch an authored type's operator-authored schema.
UPDATE public.object_types t
SET properties = public.derive_object_type_properties(t.source_table),
    updated_at = now()
WHERE t.kind = 'builtin'
  AND t.source_table IS NOT NULL
  AND t.api_name IN ('hotel','location','product_batch','stock_transfer');
