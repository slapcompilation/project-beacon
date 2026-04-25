-- ═══════════════════════════════════════════════════════════════════════════════
-- 111 — Organizations Tier (Phase R1 · Network Primitive)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- FRAMING — the three influences:
--
--   FOUNDRY    Every Organization is a first-class ontology node with a typed
--              `belongs_to_org` edge (reserved in migration 110). One source of
--              truth; RLS on every read and write; scope-aware by design.
--
--   AIP        Agents inherit the scope of the human (or cron) that triggered
--              them. `auth_org_id()` mirrors `auth_hotel_id()` so a hotel-level
--              agent sees only its hotel, while an org-level agent sees its
--              whole portfolio. Scope is never assumed — it's always checked
--              at the RLS boundary via `hotel_is_in_user_scope()`.
--
--   GALLATIN   Network, not site. The Organization is the primitive; single-
--              property customers get a 1:1 auto-org so the tier is always
--              present. Role hierarchy mirrors the echelon
--              (org_director → regional_manager → hotel_admin → hotel_manager
--              → team_member). Higher roles read down; writes are always
--              explicitly scoped.
--
-- WHAT THIS MIGRATION DOES (purely additive — breaks nothing):
--
--   1. `organizations` table + RLS
--   2. `hotels.organization_id` NOT NULL, with 1:1 auto-backfill
--   3. `user_org_memberships` — org-scope role assignments
--   4. `auth_org_id()` — mirror of auth_hotel_id(), reads JWT then falls back
--      to parent org of the caller's hotel
--   5. `auth_org_role()` — mirror of auth_role() for org-level roles
--   6. `hotel_is_in_user_scope(hotel_id)` — THE helper every RLS policy in
--      migrations 111a/b/c will delegate to. Encapsulates the two ways a user
--      can see a hotel: direct hotel membership OR org-level role on the
--      parent org.
--   7. `belongs_to_org` edges written for every hotel→org mapping to keep the
--      Reality Graph self-consistent from day 1.
--
-- WHAT THIS MIGRATION DOES NOT DO (intentionally deferred):
--
--   - Extending all 326 existing RLS policies to use `hotel_is_in_user_scope`.
--     That happens in sub-migrations 111a (inventory), 111b (procurement),
--     111c (intelligence). Batched by domain so each is reviewable.
--   - JWT claim stamping server-side (edge function). Until then, org-level
--     users are identified via `user_org_memberships`; hotel-level users
--     continue to use `app_metadata.hotel_id` unchanged.
--   - Role UI. Org-scope role assignment UI arrives after 111c.
--
-- Depends on: 001 (hotels, auth_hotel_id, auth_role), 007 (profiles),
--             018+110 (relationship_edges with `belongs_to_org` edge type)
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ─── 1. organizations table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        UNIQUE,
  logo_url    text,
  config      jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE organizations IS
  'Portfolio tier above hotels. Every hotel belongs to exactly one organization. '
  'Single-property customers get a 1:1 auto-org so the tier is always present. '
  'Org-scope contracts, benchmarks, and agents attach here.';

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ─── 2. hotels.organization_id (nullable → backfill → NOT NULL) ─────────────

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT;

-- Backfill: create a 1:1 organization for every hotel lacking one.
-- Wrapped in DO block so re-runs are no-ops once every hotel has an org.
DO $$
DECLARE
  h RECORD;
  v_org_id uuid;
BEGIN
  FOR h IN SELECT id, name FROM hotels WHERE organization_id IS NULL LOOP
    INSERT INTO organizations (name)
    VALUES (h.name)
    RETURNING id INTO v_org_id;

    UPDATE hotels SET organization_id = v_org_id WHERE id = h.id;

    RAISE NOTICE 'Created 1:1 organization % for hotel "%"', v_org_id, h.name;
  END LOOP;
END $$;

-- Enforce NOT NULL once backfill is complete.
-- Guarded so re-runs on an already-tight column don't error.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'hotels'
      AND column_name  = 'organization_id'
      AND is_nullable  = 'YES'
  ) THEN
    ALTER TABLE hotels ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hotels_organization
  ON hotels (organization_id);

COMMENT ON COLUMN hotels.organization_id IS
  'Parent organization. Single-property customers have a 1:1 auto-created org. '
  'Multi-property customers share one organization across all their hotels.';

-- ─── 3. user_org_memberships — org-scope role assignments ───────────────────
-- Existing hotel-scope roles remain on `profiles` (unchanged). New table is
-- additive: a user with a row here has BOTH their hotel role (on profiles)
-- AND an org-level role (on this table). Resolution order in auth helpers:
-- org role takes precedence for org-scope queries; hotel role for hotel-scope.

CREATE TABLE IF NOT EXISTS user_org_memberships (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            text        NOT NULL
                    CHECK (role IN ('org_director', 'regional_manager')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

COMMENT ON TABLE user_org_memberships IS
  'Org-scope role assignments. Extends the echelon above hotel roles. '
  'org_director: full portfolio access. regional_manager: read portfolio, '
  'write approved operations across hotels.';

ALTER TABLE user_org_memberships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_uom_user       ON user_org_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_uom_org        ON user_org_memberships (organization_id);

-- ─── 4. auth_org_id() — mirror of auth_hotel_id() ───────────────────────────
-- Resolution:
--   (1) JWT app_metadata.org_id if explicitly stamped (future edge-function work)
--   (2) Otherwise, the org that owns the caller's hotel (via auth_hotel_id())
--   (3) NULL if unauthenticated or no hotel scope
--
-- Used by every org-scope query and every RLS policy in 111a/b/c.

CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
    (SELECT organization_id FROM hotels WHERE id = auth_hotel_id())
  )
$$;

COMMENT ON FUNCTION auth_org_id() IS
  'Current user''s organization scope. Mirrors auth_hotel_id(). '
  'JWT claim takes precedence; falls back to parent org of hotel.';

-- ─── 5. auth_org_role() — org-level role for the current user ───────────────
-- Returns 'org_director' | 'regional_manager' | NULL.
-- JWT takes precedence (once edge function stamps it); falls back to
-- user_org_memberships lookup.

CREATE OR REPLACE FUNCTION auth_org_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'org_role',
    (SELECT role FROM user_org_memberships
      WHERE user_id = auth.uid()
        AND organization_id = auth_org_id()
      LIMIT 1)
  )
$$;

COMMENT ON FUNCTION auth_org_role() IS
  'Current user''s org-scope role. NULL for hotel-only users.';

-- ─── 6. hotel_is_in_user_scope(hotel_id) — the delegation target ────────────
-- THE critical helper. Every RLS policy in 111a/b/c will delegate to this.
-- Encapsulates the two legitimate ways a user can see a hotel:
--   (A) Direct hotel membership:  hotel_id = auth_hotel_id()
--   (B) Org-level role on the parent org (portfolio-wide visibility)
--
-- Writes remain scope-gated per-table; this is for reads (and for write
-- policies that allow org-level users to write across hotels when the
-- existing hotel-level policy would also permit it).

CREATE OR REPLACE FUNCTION hotel_is_in_user_scope(p_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_hotel_id = auth_hotel_id()
    OR (
      auth_org_role() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM hotels h
        WHERE h.id = p_hotel_id
          AND h.organization_id = auth_org_id()
      )
    )
$$;

COMMENT ON FUNCTION hotel_is_in_user_scope(uuid) IS
  'Returns TRUE if the current user may read the given hotel''s rows — '
  'either via direct hotel membership or via an org-level role on the '
  'parent organization. The delegation target for every RLS policy in '
  'migrations 111a/b/c.';

-- ─── 7. RLS policies on organizations ───────────────────────────────────────
-- Read: anyone whose hotel belongs to this org, OR anyone with an org role here.
-- Write: org_director only (for now — regional_manager is read-only at this tier).

DROP POLICY IF EXISTS "org_read" ON organizations;
CREATE POLICY "org_read" ON organizations
  FOR SELECT
  USING (
    id = auth_org_id()
    OR EXISTS (
      SELECT 1 FROM user_org_memberships uom
      WHERE uom.user_id = auth.uid()
        AND uom.organization_id = organizations.id
    )
  );

DROP POLICY IF EXISTS "org_update" ON organizations;
CREATE POLICY "org_update" ON organizations
  FOR UPDATE
  USING (
    id = auth_org_id()
    AND auth_org_role() = 'org_director'
  );

-- Insert/delete intentionally not permitted via RLS — orgs are created by
-- backfill, by setup wizard (service_role), or by future owner-scoped RPC.

-- ─── 8. RLS policies on user_org_memberships ────────────────────────────────
-- Read: self, or any member of the same org (so a director can see the team).
-- Write: org_director only, and only within their own org.

DROP POLICY IF EXISTS "uom_read" ON user_org_memberships;
CREATE POLICY "uom_read" ON user_org_memberships
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR organization_id = auth_org_id()
  );

DROP POLICY IF EXISTS "uom_write" ON user_org_memberships;
CREATE POLICY "uom_write" ON user_org_memberships
  FOR ALL
  USING (
    organization_id = auth_org_id()
    AND auth_org_role() = 'org_director'
  )
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_org_role() = 'org_director'
  );

-- ─── 9. belongs_to_org edges — Reality Graph consistency ────────────────────
-- Every hotel → org relationship becomes a typed edge in relationship_edges
-- so graph traversals pick it up.
--
-- Note: migration 098 dropped and recreated relationship_edges without the
-- UNIQUE (source_id, edge_type, target_id) constraint that migration 018 had,
-- so `create_relationship_edge()` with ON CONFLICT fails on this database.
-- We write the edge directly with a NOT EXISTS guard for idempotency.

DO $$
DECLARE
  h RECORD;
BEGIN
  FOR h IN SELECT id, organization_id FROM hotels WHERE organization_id IS NOT NULL LOOP
    IF NOT EXISTS (
      SELECT 1 FROM relationship_edges re
      WHERE re.source_type = 'hotel'
        AND re.source_id   = h.id
        AND re.edge_type   = 'belongs_to_org'
        AND re.target_type = 'organization'
        AND re.target_id   = h.organization_id
    ) THEN
      INSERT INTO relationship_edges (
        hotel_id, source_type, source_id, edge_type, target_type, target_id, metadata
      ) VALUES (
        h.id, 'hotel', h.id, 'belongs_to_org', 'organization', h.organization_id,
        jsonb_build_object('created_by_migration', 111)
      );
    END IF;
  END LOOP;
END $$;

-- ─── 10. Grants ─────────────────────────────────────────────────────────────

GRANT SELECT, UPDATE ON organizations          TO authenticated;
GRANT SELECT                 ON user_org_memberships TO authenticated;
GRANT INSERT, UPDATE, DELETE ON user_org_memberships TO authenticated; -- RLS gates access

GRANT EXECUTE ON FUNCTION auth_org_id()                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_org_role()                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION hotel_is_in_user_scope(uuid)        TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Verification queries (run manually after apply):
--
--   -- Every hotel has an org:
--   SELECT COUNT(*) FROM hotels WHERE organization_id IS NULL;  -- expect 0
--
--   -- auth_org_id() resolves for a logged-in user:
--   SELECT auth_hotel_id(), auth_org_id();                       -- both non-null
--
--   -- hotel_is_in_user_scope works for own hotel:
--   SELECT hotel_is_in_user_scope(auth_hotel_id());              -- expect true
--
--   -- belongs_to_org edges were written:
--   SELECT COUNT(*) FROM relationship_edges WHERE edge_type = 'belongs_to_org';
--   -- expect same count as hotels table
--
-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Network tier now materialized:                                              │
-- │   Organization (1) ──belongs_to_org← (N) Hotel ──belongs_to_hotel← Zone    │
-- │                                                                             │
-- │ Every RLS policy touching hotel-scoped data will migrate to call            │
-- │ hotel_is_in_user_scope(hotel_id) in 111a/b/c. Single-hotel customers        │
-- │ see no behavioral change; multi-property customers gain portfolio reads.    │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Next:  111a (inventory RLS)  →  111b (procurement RLS)  →  111c (intelligence RLS)
-- ═══════════════════════════════════════════════════════════════════════════════
