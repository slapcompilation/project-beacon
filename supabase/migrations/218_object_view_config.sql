-- Studio P3.1 — Object View config on object types. How a type's records
-- present: prominent keys (metric strip) + grouped sections. Empty config →
-- the standard derived view (resolveViewConfig in @beacon/reality-graph).
-- View changes version + snapshot like any schema change — same one history.

ALTER TABLE object_types
  ADD COLUMN IF NOT EXISTS view_config jsonb NOT NULL DEFAULT '{"prominent":[],"sections":[]}'::jsonb;

ALTER TABLE object_type_revisions
  ADD COLUMN IF NOT EXISTS view_config jsonb NOT NULL DEFAULT '{"prominent":[],"sections":[]}'::jsonb;

COMMENT ON COLUMN object_types.view_config IS
  '{ prominent: [key], sections: [{title, keys:[key]}] } — ViewConfigDef in @beacon/reality-graph. Empty = standard derived view.';

-- Extend the versioning triggers (217) to treat a view change as a schema change.
CREATE OR REPLACE FUNCTION bump_object_type_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(NEW.label, NEW.icon, NEW.description, NEW.properties, NEW.computed_properties, NEW.view_config)
     IS DISTINCT FROM
     ROW(OLD.label, OLD.icon, OLD.description, OLD.properties, OLD.computed_properties, OLD.view_config) THEN
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
  IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN
    RETURN NEW;
  END IF;
  INSERT INTO object_type_revisions
    (object_type_id, organization_id, version, label, icon, description, properties, computed_properties, view_config, changed_by_user_id)
  VALUES
    (NEW.id, NEW.organization_id, NEW.version, NEW.label, NEW.icon, NEW.description, NEW.properties, NEW.computed_properties, NEW.view_config, auth.uid());
  RETURN NEW;
END $$;

-- CREATE OR REPLACE drops nothing, but re-assert the revokes (invariant 1).
REVOKE EXECUTE ON FUNCTION snapshot_object_type() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION bump_object_type_version() FROM anon, authenticated, public;
