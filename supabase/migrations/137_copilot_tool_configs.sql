-- Phase 10.b — per-hotel copilot tool allowlist.
--
-- The copilot-chat edge function declares ~16 tools across query / propose
-- categories. Operators want to restrict which of those the copilot may
-- invoke per hotel (e.g. disable propose_stock_adjustment for line staff
-- but keep it for managers). v1 = single per-hotel row with disabled
-- tool names; absence of a row = all enabled.

BEGIN;

CREATE TABLE IF NOT EXISTS copilot_tool_configs (
  hotel_id            uuid        PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id     uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  /** Tool names the copilot should NOT see in its tool list. Default empty
   *  means every registered tool is enabled. */
  disabled_tools      text[]      NOT NULL DEFAULT '{}',

  updated_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE copilot_tool_configs IS
  'Phase 10.b — per-hotel allowlist for copilot tools. Edge function filters TOOLS by this list.';

ALTER TABLE copilot_tool_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read copilot configs in scope" ON copilot_tool_configs;
CREATE POLICY "users read copilot configs in scope" ON copilot_tool_configs
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users upsert copilot configs in scope" ON copilot_tool_configs;
CREATE POLICY "users upsert copilot configs in scope" ON copilot_tool_configs
  FOR ALL TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

COMMIT;
