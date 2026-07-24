-- Studio P2.1 — user-authored object types (Ontology authoring). Foundry's
-- Ontology Manager as data: an operator defines a new kind of thing with typed
-- properties (object_types), then creates records of it (object_records) — no
-- code deploy. The engine reads these alongside the code substrate. Maps to the
-- ObjectTypeDef / PropertyDef / RecordDraft types in @beacon/reality-graph.
--
-- Discipline: schema authoring is admin/owner (it shapes the ontology); creating
-- records is operational (any org member in scope). org + author server-set.

CREATE TABLE IF NOT EXISTS object_types (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id            uuid        REFERENCES hotels(id) ON DELETE CASCADE,   -- NULL = org-wide
  api_name            text        NOT NULL,
  label               text        NOT NULL,
  icon                text        NOT NULL DEFAULT 'cube',
  description         text        NOT NULL DEFAULT '',
  -- [{ key, label, type: text|number|boolean|date, required }]
  properties          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  enabled             boolean     NOT NULL DEFAULT true,
  version             int         NOT NULL DEFAULT 1,
  created_by_user_id  uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

CREATE TABLE IF NOT EXISTS object_records (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id      uuid        NOT NULL REFERENCES object_types(id) ON DELETE CASCADE,
  organization_id     uuid        NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id            uuid        REFERENCES hotels(id) ON DELETE CASCADE,
  title               text        NOT NULL,
  data                jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id  uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_object_types_org ON object_types (organization_id, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_object_records_type ON object_records (object_type_id, created_at DESC);

COMMENT ON TABLE object_types IS 'Studio P2 — operator-authored object types (config-as-data ontology). See ObjectTypeDef in @beacon/reality-graph.';
COMMENT ON TABLE object_records IS 'Instances of a user-authored object_type; data jsonb holds the typed property values.';

-- ── object_types: read org-scoped, author admin/owner (schema shapes the ontology)
ALTER TABLE object_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read object types in scope" ON object_types;
CREATE POLICY "read object types in scope" ON object_types
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

DROP POLICY IF EXISTS "admins author object types" ON object_types;
CREATE POLICY "admins author object types" ON object_types
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('owner','admin')
              AND organization_id IS NOT DISTINCT FROM auth_org_id()
              AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
              AND created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "admins update object types" ON object_types;
CREATE POLICY "admins update object types" ON object_types
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "admins delete object types" ON object_types;
CREATE POLICY "admins delete object types" ON object_types
  FOR DELETE TO authenticated
  USING (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

-- ── object_records: read + write for org members in scope (operational data)
ALTER TABLE object_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read records in scope" ON object_records;
CREATE POLICY "read records in scope" ON object_records
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

DROP POLICY IF EXISTS "write records in scope" ON object_records;
CREATE POLICY "write records in scope" ON object_records
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT DISTINCT FROM auth_org_id()
              AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
              AND created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "update records in scope" ON object_records;
CREATE POLICY "update records in scope" ON object_records
  FOR UPDATE TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)))
  WITH CHECK (organization_id IS NOT DISTINCT FROM auth_org_id()
              AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

DROP POLICY IF EXISTS "delete records in scope" ON object_records;
CREATE POLICY "delete records in scope" ON object_records
  FOR DELETE TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));
