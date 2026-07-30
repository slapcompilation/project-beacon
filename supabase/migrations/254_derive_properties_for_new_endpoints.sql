-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 254 — actually populate the properties 253 meant to derive.
--
-- derive_object_type_properties RETURNS jsonb; it is STABLE and writes nothing.
-- 253 called it with PERFORM, which computed the properties and threw them away,
-- so the nine new types were registered with an empty property list.
--
-- The ontology drift guard caught it on the next run — "9 built-in type(s) have a
-- backing table but no derived properties" — which is exactly the tripwire's job
-- and the reason it exists.
--
-- Forward-only: 253 is applied and its checksum recorded, so amending it would
-- fail the drift guard added in #430.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE public.object_types t
   SET properties = public.derive_object_type_properties(t.source_table),
       updated_at = now()
 WHERE t.kind = 'builtin'
   AND t.source_table IS NOT NULL
   AND jsonb_array_length(t.properties) = 0;

-- Title keys, now that there are properties for the guard to check them against.
UPDATE public.object_types t SET title_key = v.title_key
FROM (VALUES
  ('entity', 'name'),
  ('alert',  'title')
) AS v(api_name, title_key)
WHERE t.api_name = v.api_name
  AND t.kind = 'builtin'
  AND t.title_key IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(t.properties) p
    WHERE p->>'key' = v.title_key
  );

COMMIT;
