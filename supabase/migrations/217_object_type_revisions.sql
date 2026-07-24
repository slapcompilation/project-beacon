-- Studio P2.5 — save/restore versioning on object types (Foundry Ontology
-- Manager's save-changes discipline). Every schema write snapshots the NEW shape
-- into object_type_revisions via trigger — so every path (UI, SQL, future NL
-- authoring) is captured, and history can't be skipped or rewritten. Restore =
-- write an old snapshot's schema back onto the row, which itself snapshots.

CREATE TABLE IF NOT EXISTS object_type_revisions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id      uuid        NOT NULL REFERENCES object_types(id) ON DELETE CASCADE,
  organization_id     uuid        NOT NULL,
  version             int         NOT NULL,
  label               text        NOT NULL,
  icon                text        NOT NULL,
  description         text        NOT NULL,
  properties          jsonb       NOT NULL,
  computed_properties jsonb       NOT NULL,
  -- auth.uid() of whoever made the change; NULL for service/system writes.
  changed_by_user_id  uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_type_id, version)
);

CREATE INDEX IF NOT EXISTS idx_otr_type ON object_type_revisions (object_type_id, version DESC);

COMMENT ON TABLE object_type_revisions IS 'Studio P2.5 — immutable snapshots of an object type''s schema, one per version. Written by trigger; never edited.';

-- Version bumps live here (not in clients) so no writer can forget them: any
-- schema-shape change increments version, then the AFTER trigger snapshots.
CREATE OR REPLACE FUNCTION bump_object_type_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(NEW.label, NEW.icon, NEW.description, NEW.properties, NEW.computed_properties)
     IS DISTINCT FROM
     ROW(OLD.label, OLD.icon, OLD.description, OLD.properties, OLD.computed_properties) THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION snapshot_object_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On UPDATE, only snapshot when the version moved (i.e. the schema changed —
  -- enable/disable toggles and no-op writes don't pollute history).
  IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN
    RETURN NEW;
  END IF;
  INSERT INTO object_type_revisions
    (object_type_id, organization_id, version, label, icon, description, properties, computed_properties, changed_by_user_id)
  VALUES
    (NEW.id, NEW.organization_id, NEW.version, NEW.label, NEW.icon, NEW.description, NEW.properties, NEW.computed_properties, auth.uid());
  RETURN NEW;
END $$;

-- Trigger functions run via the trigger, never by callers — revoke the default
-- PUBLIC EXECUTE (security invariant 1: anon must not execute SECURITY DEFINER fns).
REVOKE EXECUTE ON FUNCTION snapshot_object_type() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION bump_object_type_version() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_bump_object_type_version ON object_types;
CREATE TRIGGER trg_bump_object_type_version
  BEFORE UPDATE ON object_types
  FOR EACH ROW EXECUTE FUNCTION bump_object_type_version();

DROP TRIGGER IF EXISTS trg_snapshot_object_type ON object_types;
CREATE TRIGGER trg_snapshot_object_type
  AFTER INSERT OR UPDATE ON object_types
  FOR EACH ROW EXECUTE FUNCTION snapshot_object_type();

-- Backfill: one v-current snapshot per existing type so history starts populated.
INSERT INTO object_type_revisions
  (object_type_id, organization_id, version, label, icon, description, properties, computed_properties, changed_by_user_id)
SELECT ot.id, ot.organization_id, ot.version, ot.label, ot.icon, ot.description, ot.properties, ot.computed_properties, NULL
FROM object_types ot
ON CONFLICT (object_type_id, version) DO NOTHING;

-- RLS: history is read-only for org members in scope. No INSERT/UPDATE/DELETE
-- policies — the SECURITY DEFINER trigger is the only writer.
ALTER TABLE object_type_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read revisions in scope" ON object_type_revisions;
CREATE POLICY "read revisions in scope" ON object_type_revisions
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id());
