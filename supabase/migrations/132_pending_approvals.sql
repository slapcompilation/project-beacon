-- Phase 11 — soft-constraint routing (finishes Phase 4).
--
-- When a BeaconAction violates a SOFT constraint, the dispatcher used to drop
-- the violation on the floor (per the deferred note in apps/web/.../dispatch.ts).
-- This migration adds a per-org queue where soft-violating actions wait for a
-- higher-tier approver instead of executing.
--
-- Approval flow:
--   originator dispatches → dispatcher detects soft violation → row written
--   here with status='pending' → org-admin reviews on /pending-approvals →
--   approve dispatches the action bypassing the soft check (audit edge marks
--   triggered_by='ai_proposal_accepted' or 'user' per the original ctx).

BEGIN;

CREATE TABLE IF NOT EXISTS pending_action_approvals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id     uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  /** BeaconAction type — e.g. REQUEST_RESTOCK, TRANSFER_STOCK. */
  action_type         text        NOT NULL,
  /** Full typed BeaconAction payload the dispatcher will replay on approval. */
  action_payload      jsonb       NOT NULL,
  /** Constraint violations that gated this action.
   *  Shape: [{ constraintId, message, severity, ruleType }, ...] */
  violations          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  /** Echoes the dispatcher's triggered_by so the eventual write attributes
   *  the audit edge to the original actor. */
  original_triggered_by text       NOT NULL DEFAULT 'user',
  original_actor_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected','expired')),

  requested_by_user_id uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decided_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at          timestamptz,
  decision_note       text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_hotel_pending
  ON pending_action_approvals (hotel_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pending_approvals_org_pending
  ON pending_action_approvals (organization_id, created_at DESC)
  WHERE status = 'pending' AND organization_id IS NOT NULL;

COMMENT ON TABLE pending_action_approvals IS
  'Phase 11 — actions paused for higher-tier approval after a soft constraint violation.';

ALTER TABLE pending_action_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read pending approvals in scope" ON pending_action_approvals;
CREATE POLICY "users read pending approvals in scope" ON pending_action_approvals
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users create pending approvals in scope" ON pending_action_approvals;
CREATE POLICY "users create pending approvals in scope" ON pending_action_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by_user_id = auth.uid()
    AND hotel_is_in_user_scope(hotel_id)
  );

DROP POLICY IF EXISTS "users update pending approvals in scope" ON pending_action_approvals;
CREATE POLICY "users update pending approvals in scope" ON pending_action_approvals
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

COMMIT;
