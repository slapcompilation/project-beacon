-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 390 — shape_registry, and three CHECKs that were partly ours.
--
-- SHAPE_REGISTRY GOES. It is an allowlist that exists so a static scan can tell
-- "deliberately ahead of its runtime" from "dead" — scaffolding for guards that
-- police OUR structure. Foundry needs no such table: the platform INDEXES
-- ontology resources, so "what uses this" is a query against the resource graph
-- rather than a scan plus a list of exceptions. In a clone the ontology is its
-- own registry — object_types is the list of what exists, and a thing absent
-- from it does not exist.
--
-- With it go the two guards built on it: audit-shape (table classifications) and
-- check-vocabulary (declarations). check:rpcs and check:surfaces stay — they ask
-- about real reachability and need no allowlist to do it.
--
-- Three constraints were partly ours:
--
--   status        `edit-object-type.md`: "Choose from the deprecated,
--                 experimental, and active statuses." Three. Ours had a fourth,
--                 `example`, which is not in any page.
--
--   resource_kind allowed module, document and user_tool — all deleted concepts.
--                 Narrowed to what the ontology still has.
--
--   users.role    owner, admin, team_member, limited_access. The last two are
--                 hospitality staff roles. Foundry's resource roles are owner,
--                 editor, viewer, discoverer (compass), which project_role_grants
--                 already carries; platform roles here narrow to owner/admin.
--
-- Visibility is untouched and is Foundry's: "A prominent object type will lead
-- applications to show this object type first... A hidden object type will not
-- appear in user applications" — same page.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE r record;
BEGIN
  -- status: drop `example` from all three ontology tables.
  FOR r IN SELECT t.relname AS tbl, c.conname
             FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
             JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname='public' AND c.conname LIKE '%_status_check'
  LOOP
    EXECUTE format('UPDATE public.%I SET status = ''experimental'' WHERE status = ''example''', r.tbl);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (status = ANY (ARRAY[''active'',''experimental'',''deprecated'']))',
                   r.tbl, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.project_resources DROP CONSTRAINT IF EXISTS project_resources_resource_kind_check;
ALTER TABLE public.project_resources ADD CONSTRAINT project_resources_resource_kind_check
  CHECK (resource_kind = ANY (ARRAY['object_type','object_set']));

UPDATE public.users SET role = 'admin' WHERE role IN ('team_member','limited_access');
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY['owner','admin']));

DROP TABLE IF EXISTS public.shape_registry CASCADE;

DO $$
DECLARE def text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='shape_registry') THEN
    RAISE EXCEPTION 'Migration 390: shape_registry survived';
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
   WHERE t.relname='object_types' AND c.conname='object_types_status_check';
  IF position('example' IN def) > 0 THEN
    RAISE EXCEPTION 'Migration 390: the fourth status survived';
  END IF;
  IF position('deprecated' IN def) = 0 THEN
    RAISE EXCEPTION 'Migration 390: the rewrite lost a documented status';
  END IF;
END $$;

COMMIT;
