-- Phase 5 — principles: operator feedback that becomes soft constraints on
-- the agent's reasoning. Each row carries the NL body + a categorized bucket
-- (inventory-policy, supplier-preference, time-window, budget, compliance,
-- other) so the agent can pull a focused subset by topic when relevant.
--
-- Principles differ from constraints:
--   constraints  → hard/soft gates evaluated against typed action payloads
--   principles   → soft guidance injected into the agent's system prompt

BEGIN;

CREATE TABLE IF NOT EXISTS principles (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id      uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  /** Natural-language body the operator typed. */
  body                 text        NOT NULL,
  /** Categorization bucket assigned by the LLM (or heuristic fallback). */
  category             text        NOT NULL
                                   CHECK (category IN (
                                     'inventory-policy',
                                     'supplier-preference',
                                     'time-window',
                                     'budget',
                                     'compliance',
                                     'other'
                                   )),

  /** Optional scope narrowing — apply only to these node ids. */
  applies_to_node_ids  uuid[]      NOT NULL DEFAULT '{}',

  active               boolean     NOT NULL DEFAULT true,
  authored_by_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  created_at           timestamptz NOT NULL DEFAULT now(),
  deactivated_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_principles_active_lookup
  ON principles (hotel_id, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_principles_category
  ON principles (hotel_id, category)
  WHERE active = true;

COMMENT ON TABLE principles IS 'AIP principles — operator feedback injected as soft guidance into agent prompts.';
COMMENT ON COLUMN principles.category IS 'LLM-assigned bucket. Heuristic fallback maps to "other" when classification fails.';

ALTER TABLE principles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read principles in scope" ON principles;
CREATE POLICY "users read principles in scope" ON principles
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users author principles in own hotel" ON principles;
CREATE POLICY "users author principles in own hotel" ON principles
  FOR INSERT TO authenticated
  WITH CHECK (
    authored_by_user_id = auth.uid()
    AND hotel_id = auth_hotel_id()
  );

DROP POLICY IF EXISTS "users update principles in scope" ON principles;
CREATE POLICY "users update principles in scope" ON principles
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

COMMIT;
