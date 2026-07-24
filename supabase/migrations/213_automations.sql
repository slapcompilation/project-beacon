-- Studio P1 — user-authored automations. A monitor created as DATA, not code:
-- "when a bounded ontology condition holds, propose a typed action, routed
-- through the same gate." The condition is stored as CHECK-constrained flat
-- columns (typed grammar, queryable) that map to the Automation type in
-- @beacon/reality-graph. Firing goes through decideAutoExecution like any
-- proposal; authoring never adds a second execution path.

CREATE TABLE IF NOT EXISTS automations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL = org-wide (every hotel in the org); otherwise scoped to one property.
  hotel_id             uuid        REFERENCES hotels(id) ON DELETE CASCADE,

  name                 text        NOT NULL,

  -- when ‹subject.metric op value›
  subject              text        NOT NULL DEFAULT 'variant' CHECK (subject IN ('variant')),
  when_metric          text        NOT NULL,
  when_op              text        NOT NULL CHECK (when_op IN ('lt','lte','gt','gte')),
  when_value           numeric     NOT NULL,

  -- then ‹effect›
  effect               text        NOT NULL CHECK (effect IN ('REQUEST_RESTOCK','TRANSFER_STOCK','WRITE_OFF')),

  -- gate: queue for review, or auto-execute above the confidence floor (the gate still decides)
  gate                 text        NOT NULL DEFAULT 'review' CHECK (gate IN ('review','auto')),
  confidence           numeric     NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),

  enabled              boolean     NOT NULL DEFAULT true,
  stage                text        NOT NULL DEFAULT 'sandbox' CHECK (stage IN ('sandbox','staging','production')),
  version              int         NOT NULL DEFAULT 1,

  created_by_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Server-authoritative provenance: the client sends only the automation fields;
-- org + author come from the caller's identity, so they can't be spoofed and the
-- RLS WITH CHECK (organization_id = auth_org_id(), created_by = auth.uid()) holds.
ALTER TABLE automations ALTER COLUMN organization_id  SET DEFAULT auth_org_id();
ALTER TABLE automations ALTER COLUMN created_by_user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_automations_cycle_lookup
  ON automations (organization_id, hotel_id, stage, enabled)
  WHERE enabled = true;

COMMENT ON TABLE automations IS 'Studio P1 — operator-authored when→then→gate automations (config-as-data). Maps to the Automation type in @beacon/reality-graph; evaluated by evaluateAutomations; fires through decideAutoExecution.';

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

-- Read: org members see org-wide automations + those for a hotel in their scope.
DROP POLICY IF EXISTS "read automations in scope" ON automations;
CREATE POLICY "read automations in scope" ON automations
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
  );

-- Author/update/delete: admin & owner only (automations can auto-execute actions),
-- inside their org, org-wide or for an in-scope hotel.
DROP POLICY IF EXISTS "admins author automations" ON automations;
CREATE POLICY "admins author automations" ON automations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
    AND created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "admins update automations" ON automations;
CREATE POLICY "admins update automations" ON automations
  FOR UPDATE TO authenticated
  USING (
    auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
  )
  WITH CHECK (
    auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
  );

DROP POLICY IF EXISTS "admins delete automations" ON automations;
CREATE POLICY "admins delete automations" ON automations
  FOR DELETE TO authenticated
  USING (
    auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
  );
