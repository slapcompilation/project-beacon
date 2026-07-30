-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 255 — point `alert` and `user` at the tables that actually exist.
--
-- 253 registered them against `alerts` and `user_profiles`. Neither table exists:
-- alerts are rows in `notifications`, and the profile table is `profiles`. The
-- names were guessed from the edge vocabulary (`source_type = 'alert'`) rather
-- than checked against the schema.
--
-- The ontology drift guard caught both — "2 built-in type(s) have a backing table
-- but no derived properties" — because a source_table that does not exist yields
-- no columns to derive. That tripwire has now caught two separate mistakes in
-- this pair of migrations, which is the argument for having it.
--
-- Forward-only: 253 is applied and checksummed.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE public.object_types
   SET source_table = 'notifications',
       description  = 'A raised operational signal.',
       updated_at   = now()
 WHERE kind = 'builtin' AND api_name = 'alert';

UPDATE public.object_types
   SET source_table = 'profiles',
       updated_at   = now()
 WHERE kind = 'builtin' AND api_name = 'user';

UPDATE public.object_types t
   SET properties = public.derive_object_type_properties(t.source_table),
       updated_at = now()
 WHERE t.kind = 'builtin'
   AND t.source_table IS NOT NULL
   AND jsonb_array_length(t.properties) = 0;

-- Title keys, only where the column is really a property of the type.
UPDATE public.object_types t SET title_key = v.title_key
FROM (VALUES
  ('entity', 'name'),
  ('alert',  'title')
) AS v(api_name, title_key)
WHERE t.api_name = v.api_name
  AND t.kind = 'builtin'
  AND t.title_key IS NULL
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.properties) p WHERE p->>'key' = v.title_key);

COMMIT;
