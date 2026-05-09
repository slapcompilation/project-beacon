-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 122 — Copilot conversation persistence (Phase B1)
--
-- Layer: Eye (intelligence) + Mind (memory)
-- Scope: hotel + user
-- Cadence: on-demand (per chat send)
--
-- Why this exists
-- ───────────────
-- ROADMAP-AIP.md Phase B1 requires "Multi-turn conversation with history
-- persistence" for the LLM-powered Copilot. The `copilot-chat` edge function
-- already implements the agentic tool-calling loop (16 tools, action proposals,
-- system prompt) — but every request is currently stateless. The LLM sees only
-- what the client sends in `body.messages`, with no server-side persistence of
-- prior turns, tool traces, or session context.
--
-- This migration adds the persistence layer:
--
--   • copilot_conversations — one row per chat session, scoped to (user, hotel).
--     Captures the title, started_at, last_message_at for the operator-facing
--     conversation list, plus an optional `agent_scope` ('hotel' | 'organization')
--     so future org-scope copilots can be seeded from the same surface.
--
--   • copilot_messages — one row per turn (user prompt + assistant reply +
--     tool calls). Stores `tool_trace` jsonb so the existing per-turn audit
--     surface (which the edge function already returns) is preserved across
--     reloads. Iterations + model preserved for telemetry / cost tracking.
--
-- Both tables follow the conventions of `copilot_feedback`:
--   - Hotel-scoped RLS via auth_hotel_id() / hotel_is_in_user_scope().
--   - User-scoped read so operators can only see their own conversations
--     (admin/owner can read all hotel conversations for support / audit).
--   - INSERT/UPDATE only via SECURITY DEFINER paths — direct table mutation
--     from anon is blocked.
--
-- Per CLAUDE.md AIP rule (every agent declares purpose/scope/cadence): the
-- conversation row carries `agent_scope` and `cadence` columns so the surface
-- can show "this conversation runs at hotel scope" / "started 2 days ago,
-- 3 turns, last 12 minutes ago" without joins.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. copilot_conversations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copilot_conversations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text,                                                 -- nullable until first turn
  agent_scope       text        NOT NULL DEFAULT 'hotel'
                                CHECK (agent_scope IN ('hotel','organization')),
  started_at        timestamptz NOT NULL DEFAULT now(),
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  message_count     int         NOT NULL DEFAULT 0,
  archived_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_copilot_conv_user_recent
  ON copilot_conversations (user_id, last_message_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_copilot_conv_hotel_recent
  ON copilot_conversations (hotel_id, last_message_at DESC)
  WHERE archived_at IS NULL;

COMMENT ON TABLE  copilot_conversations IS 'Phase B1 — one row per copilot chat session, scoped to (user, hotel).';
COMMENT ON COLUMN copilot_conversations.agent_scope IS 'Whether this conversation runs at hotel scope or org scope (operator portfolio view).';

ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;

-- Read: own conversations, plus admin/owner can read all in their hotel
DROP POLICY IF EXISTS "users read own copilot conversations" ON copilot_conversations;
CREATE POLICY "users read own copilot conversations" ON copilot_conversations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (hotel_id = auth_hotel_id() AND auth_role() = ANY(ARRAY['admin','owner']))
    OR hotel_is_in_user_scope(hotel_id)
  );

-- Insert: any authenticated user, only into their own scope
DROP POLICY IF EXISTS "users create own copilot conversations" ON copilot_conversations;
CREATE POLICY "users create own copilot conversations" ON copilot_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id  = auth.uid()
    AND hotel_id = auth_hotel_id()
  );

-- Update: own conversations only (e.g. rename, archive)
DROP POLICY IF EXISTS "users update own copilot conversations" ON copilot_conversations;
CREATE POLICY "users update own copilot conversations" ON copilot_conversations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete via archive flag, not direct delete — append-only audit posture
-- (matches StockLog/relationship_edges philosophy from CLAUDE.md)


-- 2. copilot_messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copilot_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('user','assistant','system')),
  content         text        NOT NULL,
  /** Per-turn tool-trace returned by the copilot-chat edge function. Each
   *  entry: { tool: text, input: jsonb, duration_ms: int }. */
  tool_trace      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  /** How many tool-calling iterations the agent ran for this turn. */
  iterations      int         NOT NULL DEFAULT 0,
  /** Model id (for telemetry / cost tracking). */
  model           text,
  /** Optional structured action_proposal payload returned by the assistant.
   *  Operators confirm/edit/cancel; the action registry executes. */
  action_proposal jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_msg_conv_time
  ON copilot_messages (conversation_id, created_at);

COMMENT ON TABLE  copilot_messages IS 'Phase B1 — append-only message log for a copilot conversation. Includes tool_trace + action_proposal per CLAUDE.md AIP transparency rule.';
COMMENT ON COLUMN copilot_messages.tool_trace IS 'Array of {tool, input, duration_ms} — surfaces graph nodes/tools considered per turn.';
COMMENT ON COLUMN copilot_messages.action_proposal IS 'Structured BeaconAction proposal when the assistant suggests a mutation. NEVER executed automatically.';

ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;

-- Read: messages of conversations the user can read
DROP POLICY IF EXISTS "users read messages of accessible conversations" ON copilot_messages;
CREATE POLICY "users read messages of accessible conversations" ON copilot_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM copilot_conversations c
      WHERE c.id = copilot_messages.conversation_id
        AND (
          c.user_id  = auth.uid()
          OR (c.hotel_id = auth_hotel_id() AND auth_role() = ANY(ARRAY['admin','owner']))
          OR hotel_is_in_user_scope(c.hotel_id)
        )
    )
  );

-- Insert: only into own conversations, message authorship matches conversation owner
DROP POLICY IF EXISTS "users insert into own copilot conversations" ON copilot_messages;
CREATE POLICY "users insert into own copilot conversations" ON copilot_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM copilot_conversations c
      WHERE c.id = copilot_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- No UPDATE / DELETE policy: messages are immutable. Edge function uses the
-- service role to insert; that role bypasses RLS and is the only writer
-- besides the user's own client (which only inserts via append).


-- 3. Bump conversation aggregate columns on message insert ──────────────────
CREATE OR REPLACE FUNCTION trg_copilot_message_bump_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE copilot_conversations
     SET last_message_at = NEW.created_at,
         message_count   = message_count + 1
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_copilot_message_bump_conversation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_copilot_msg_bump_conv ON copilot_messages;
CREATE TRIGGER trg_copilot_msg_bump_conv
  AFTER INSERT ON copilot_messages
  FOR EACH ROW
  EXECUTE FUNCTION trg_copilot_message_bump_conversation();


COMMIT;

-- ─── Verification ────────────────────────────────────────────────────────────
-- After applying:
--
--   SELECT count(*) FROM information_schema.tables
--   WHERE table_schema='public' AND table_name IN ('copilot_conversations','copilot_messages');
--   -- expected: 2
--
--   SELECT polname FROM pg_policy
--   WHERE polrelid IN ('public.copilot_conversations'::regclass,
--                      'public.copilot_messages'::regclass)
--   ORDER BY polname;
--   -- expected: 5 policies (3 conv + 2 msg)
--
-- Then end-to-end test from the edge function: send a message → conversation
-- row appears, message_count = 2 (user + assistant), last_message_at fresh.
