-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 257 — authored link types default to their real backing.
--
-- 256 made a backing mandatory, which is right: Foundry has no link type without
-- one. But the authored path — the Studio composer, and the C16 contract probe —
-- inserts only the two endpoints and a name, so every authored link began
-- violating the constraint.
--
-- An authored link's rows live in object_links, which is a join table in
-- Foundry's terms. That was always the answer; nothing was declaring it. Making
-- it the column default keeps authoring working AND keeps every link type
-- honestly backed.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.link_types
  ALTER COLUMN cardinality  SET DEFAULT 'many_to_many',
  ALTER COLUMN backing_kind SET DEFAULT 'join_table',
  ALTER COLUMN backing_table SET DEFAULT 'object_links';

COMMENT ON COLUMN public.link_types.backing_table IS
  'Where the links live. Authored link types default to object_links (a join table); built-in registrations name the table whose FK column already holds the relationship.';
