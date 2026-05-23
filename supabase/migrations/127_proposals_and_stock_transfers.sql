-- Phase 3 — persist Proposal nodes + add stock_transfers table for TRANSFER_STOCK.
--
-- proposals       : append-mostly; status transitions via decide_proposal()
-- stock_transfers : lateral-before-external moves between sister hotels
--
-- Both are hotel-scoped via existing auth_hotel_id() / hotel_is_in_user_scope().

BEGIN;

-- ── 1. proposals ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id     uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  agent_name          text        NOT NULL,
  agent_version       text        NOT NULL,

  /** BeaconAction type the proposal carries — REQUEST_RESTOCK, TRANSFER_STOCK, etc. */
  action_type         text        NOT NULL,
  /** Typed BeaconAction payload (JSONB) the dispatcher receives when approved. */
  action_payload      jsonb       NOT NULL,

  confidence          numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning           text        NOT NULL,
  /** Array of { kind: 'tool'|'document', ref: string, detail?: string }. */
  provenance          jsonb       NOT NULL DEFAULT '[]'::jsonb,

  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected','superseded','expired')),

  /** Set when the operator refines via NL and the agent re-runs. */
  parent_version_id   uuid        REFERENCES proposals(id) ON DELETE SET NULL,
  refinement_note     text,

  /** Operator who's reviewing — fills in when decided. */
  created_by_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decided_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at          timestamptz,

  /** Optional pointer to the resulting BeaconAction's audit row (stock_logs.id, restock_requests.id, etc.). */
  resulting_node_id   uuid,
  resulting_node_type text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_hotel_pending
  ON proposals (hotel_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_proposals_parent
  ON proposals (parent_version_id)
  WHERE parent_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_agent_recent
  ON proposals (agent_name, created_at DESC);

COMMENT ON TABLE  proposals IS 'AIP Proposal node — typed agent output operators review. Versioned via parent_version_id for refinement chains.';
COMMENT ON COLUMN proposals.action_payload IS 'BeaconAction payload (JSONB) the Action Registry dispatches on approval.';
COMMENT ON COLUMN proposals.parent_version_id IS 'Set when refined-via-NL; chain of supersessions builds via this.';

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read proposals in scope" ON proposals;
CREATE POLICY "users read proposals in scope" ON proposals
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users create proposals in scope" ON proposals;
CREATE POLICY "users create proposals in scope" ON proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND hotel_is_in_user_scope(hotel_id)
  );

DROP POLICY IF EXISTS "users update proposals in scope" ON proposals;
CREATE POLICY "users update proposals in scope" ON proposals
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- No DELETE policy — proposals are append-mostly; status flips for lifecycle.


-- ── 2. stock_transfers ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_transfers (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_hotel_id        uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  to_hotel_id          uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  /** Variant id at the source hotel. Destination's matching variant (by name)
   *  is resolved at approval time. */
  variant_id           uuid        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity             int         NOT NULL CHECK (quantity > 0),
  reason               text        NOT NULL,

  status               text        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','approved','rejected','cancelled','completed')),

  requested_by_user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at          timestamptz,

  /** Stock-log ids that recorded the movement once completed. */
  from_log_id          uuid,
  to_log_id            uuid,

  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT no_self_transfer CHECK (from_hotel_id <> to_hotel_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_to_pending
  ON stock_transfers (to_hotel_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_transfers_from_pending
  ON stock_transfers (from_hotel_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_transfers_variant_open
  ON stock_transfers (variant_id, status)
  WHERE status IN ('pending','approved');

COMMENT ON TABLE stock_transfers IS 'Phase 3 — lateral inter-property moves. Lifecycle: pending → approved → completed.';

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

-- Either side of the transfer can see it
DROP POLICY IF EXISTS "users read transfers touching their scope" ON stock_transfers;
CREATE POLICY "users read transfers touching their scope" ON stock_transfers
  FOR SELECT TO authenticated
  USING (
    hotel_is_in_user_scope(from_hotel_id)
    OR hotel_is_in_user_scope(to_hotel_id)
  );

-- Only the destination hotel can request a transfer in
DROP POLICY IF EXISTS "users request transfers into their hotel" ON stock_transfers;
CREATE POLICY "users request transfers into their hotel" ON stock_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by_user_id = auth.uid()
    AND to_hotel_id = auth_hotel_id()
  );

-- Source hotel approves/rejects; destination cancels
DROP POLICY IF EXISTS "users update transfers in scope" ON stock_transfers;
CREATE POLICY "users update transfers in scope" ON stock_transfers
  FOR UPDATE TO authenticated
  USING (
    hotel_is_in_user_scope(from_hotel_id)
    OR hotel_is_in_user_scope(to_hotel_id)
  )
  WITH CHECK (
    hotel_is_in_user_scope(from_hotel_id)
    OR hotel_is_in_user_scope(to_hotel_id)
  );

COMMIT;
