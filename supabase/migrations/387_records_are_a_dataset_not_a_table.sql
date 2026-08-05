-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 387 — object_records and object_type_revisions.
--
-- object_records was a universal store: one row per object of any type, its
-- properties in a jsonb blob. That is the third form of the same mistake, after
-- object_links (382) and relationship_edges_store (385).
--
-- Foundry does not have it. An object type is backed by a DATASOURCE, and when
-- there is not one yet you "select a location to generate a dataset"
-- (`create-object-type.md`) — a real table with real columns, per type. A
-- universal EAV table is our shape for avoiding that, and every property it
-- holds is invisible to the database: no column, no type, no constraint, no
-- index worth the name.
--
-- object_type_revisions was a per-edit snapshot with a restore button. Nothing
-- in the mirror describes it; it was ours, and the trigger that fed it
-- (snapshot_object_type) goes with it.
--
-- What replaces them is the thing this teardown exists to build: a datasource
-- per object type, mapped to properties, with a primary key.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP TABLE IF EXISTS public.object_records        CASCADE;
DROP TABLE IF EXISTS public.object_type_revisions CASCADE;
DROP FUNCTION IF EXISTS public.snapshot_object_type() CASCADE;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema='public' AND table_name IN ('object_records','object_type_revisions');
  IF n > 0 THEN RAISE EXCEPTION 'Migration 387: % survived', n; END IF;

  -- object_types must keep a policy per command, which 383 established.
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
                  WHERE c.relname='object_types' AND (p.polcmd='r' OR p.polcmd='*')) THEN
    RAISE EXCEPTION 'Migration 387: object_types lost its read policy';
  END IF;
END $$;

COMMIT;
