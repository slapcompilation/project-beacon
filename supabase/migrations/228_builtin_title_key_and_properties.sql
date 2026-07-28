-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 228 — G2: every registered built-in type gets derived properties
-- and an explicit title key.
--
-- WHY A TITLE KEY, AND WHY NOW. Foundry requires a primary key and a title key
-- on every object type (`create-object-type.md`). G1 guessed the title from the
-- first text property, which happened to pick well but is a guess. Foundry also
-- says the title key is *cheap* to change — "changing the display name, title
-- key, render hints, type classes, and visibility of a property will not require
-- the object type to unregister" — i.e. it is presentation, not schema. So it
-- belongs as its own column, set deliberately, not inferred.
--
-- NULL is allowed and meaningful: stock_log, restock_request, purchase_order and
-- proposal have no single column that reads as a title (theirs come from joins).
-- Those fall back to "<Label> <id-prefix>" rather than pretending.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.object_types
  ADD COLUMN IF NOT EXISTS title_key text;

COMMENT ON COLUMN public.object_types.title_key IS
  'Property whose value titles a record. NULL when no single column reads as a title.';

-- Every registered built-in, not just the four G1 proved the path on.
UPDATE public.object_types t
SET properties = public.derive_object_type_properties(t.source_table),
    updated_at = now()
WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL;

-- Title keys, set deliberately per type. Only columns that survive the property
-- derivation are valid, so these are checked against it below.
UPDATE public.object_types SET title_key = v.title_key
FROM (VALUES
  ('hotel',           'name'),
  ('product',         'name'),
  ('variant',         'name'),
  ('supplier',        'name'),
  ('location',        'name'),
  ('product_batch',   'lot_number'),
  ('stock_transfer',  'reason'),
  ('document',        'title'),
  ('principle',       'body'),
  ('constraint',      'body'),
  ('case',            'title')
) AS v(api_name, title_key)
WHERE object_types.kind = 'builtin' AND object_types.api_name = v.api_name;

-- ── The drift tripwire ───────────────────────────────────────────────────────
-- Foundry gets loud failure from its architecture: objects are materialised into
-- an index, so a schema change forces an unregister + reindex and it cannot be
-- ignored. We read the backing table live, so we get no downtime — and no
-- failure either. A renamed column would silently render as `undefined`.
--
-- This is that missing tripwire, and it is the same discipline Foundry's own
-- pipeline guidance asks for: "explicitly cast the column types … this will help
-- catch breaking changes from the source system if a column type changes."
CREATE OR REPLACE FUNCTION public.builtin_property_drift()
RETURNS TABLE (api_name text, property_key text, problem text)
LANGUAGE sql STABLE AS $$
  -- A registered property whose column vanished or changed type.
  SELECT t.api_name, p->>'key',
         CASE WHEN c.column_name IS NULL THEN 'column no longer exists'
              ELSE 'column type changed to ' || c.data_type END
  FROM public.object_types t
  CROSS JOIN LATERAL jsonb_array_elements(t.properties) p
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = t.source_table AND c.column_name = p->>'key'
  WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL
    AND (
      c.column_name IS NULL
      OR (p->>'type') <> CASE
           WHEN c.data_type IN ('integer','bigint','smallint','numeric','real','double precision') THEN 'number'
           WHEN c.data_type = 'boolean' THEN 'boolean'
           WHEN c.data_type LIKE 'timestamp%' OR c.data_type = 'date' THEN 'date'
           ELSE 'text' END
    )
  UNION ALL
  -- A title key that is not one of the type's own properties.
  SELECT t.api_name, t.title_key, 'title_key is not a property of this type'
  FROM public.object_types t
  WHERE t.kind = 'builtin' AND t.title_key IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(t.properties) p WHERE p->>'key' = t.title_key
    );
$$;

COMMENT ON FUNCTION public.builtin_property_drift() IS
  'Rows = drift between a built-in type registration and its backing table. Empty is the invariant; supabase/tests/ontology_drift.sql asserts it.';

REVOKE EXECUTE ON FUNCTION public.builtin_property_drift() FROM anon;
