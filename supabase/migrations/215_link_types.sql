-- Studio P2.3 — link types: a named relationship from one object type to another
-- (link_types), and its instances connecting a source record to a target record
-- (object_links). Same discipline as object_types: link-type schema is
-- admin/owner-authored; creating links is operational (org members). Maps to
-- LinkTypeDef in @beacon/reality-graph.

CREATE TABLE IF NOT EXISTS link_types (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid        NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id               uuid        REFERENCES hotels(id) ON DELETE CASCADE,
  source_object_type_id  uuid        NOT NULL REFERENCES object_types(id) ON DELETE CASCADE,
  target_object_type_id  uuid        NOT NULL REFERENCES object_types(id) ON DELETE CASCADE,
  api_name               text        NOT NULL,
  label                  text        NOT NULL,
  created_by_user_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_object_type_id, api_name)
);

CREATE TABLE IF NOT EXISTS object_links (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  link_type_id       uuid        NOT NULL REFERENCES link_types(id) ON DELETE CASCADE,
  organization_id    uuid        NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id           uuid        REFERENCES hotels(id) ON DELETE CASCADE,
  source_record_id   uuid        NOT NULL REFERENCES object_records(id) ON DELETE CASCADE,
  target_record_id   uuid        NOT NULL REFERENCES object_records(id) ON DELETE CASCADE,
  created_by_user_id uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_type_id, source_record_id, target_record_id)
);

CREATE INDEX IF NOT EXISTS idx_link_types_source ON link_types (source_object_type_id);
CREATE INDEX IF NOT EXISTS idx_object_links_source ON object_links (source_record_id);

COMMENT ON TABLE link_types  IS 'Studio P2.3 — named relationship between two object types. See LinkTypeDef in @beacon/reality-graph.';
COMMENT ON TABLE object_links IS 'A link instance: source_record --link_type--> target_record.';

-- ── link_types: read org-scoped, author admin/owner
ALTER TABLE link_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read link types in scope" ON link_types;
CREATE POLICY "read link types in scope" ON link_types
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

DROP POLICY IF EXISTS "admins author link types" ON link_types;
CREATE POLICY "admins author link types" ON link_types
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('owner','admin')
              AND organization_id IS NOT DISTINCT FROM auth_org_id()
              AND created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "admins delete link types" ON link_types;
CREATE POLICY "admins delete link types" ON link_types
  FOR DELETE TO authenticated
  USING (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

-- ── object_links: read + write for org members in scope
ALTER TABLE object_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read links in scope" ON object_links;
CREATE POLICY "read links in scope" ON object_links
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

DROP POLICY IF EXISTS "write links in scope" ON object_links;
CREATE POLICY "write links in scope" ON object_links
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT DISTINCT FROM auth_org_id()
              AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
              AND created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "delete links in scope" ON object_links;
CREATE POLICY "delete links in scope" ON object_links
  FOR DELETE TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));
