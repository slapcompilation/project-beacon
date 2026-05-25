-- Phase 14 — ApprovedAnswers tier-1 cache.
--
-- Curated Q&A served before fresh LLM calls. Operators "Curate this answer"
-- on a copilot reply to add it; the chat hook does a similarity match on
-- the next question and serves the cached answer when it's close enough.
--
-- v1 is text-similarity client-side. Adding pgvector later just swaps the
-- lookup; the table shape stays the same (the embedding_ref column is
-- reserved now to avoid a follow-up schema change).

BEGIN;

CREATE TABLE IF NOT EXISTS approved_answers (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id      uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  question             text        NOT NULL,
  answer               text        NOT NULL,

  /** Reserved for the pgvector upgrade (Phase 14.b). Stays NULL for v1. */
  embedding_ref        text,

  /** Hit count and last-served stamp. Updated each time the cache serves
   *  this entry instead of routing to the LLM. */
  hit_count            int         NOT NULL DEFAULT 0,
  last_served_at       timestamptz,

  /** Optional source: copilot message id this was curated from. */
  source_message_id    uuid,

  curated_by_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  retired_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_approved_answers_hotel
  ON approved_answers (hotel_id, created_at DESC)
  WHERE retired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_approved_answers_hits
  ON approved_answers (hotel_id, hit_count DESC)
  WHERE retired_at IS NULL;

COMMENT ON TABLE approved_answers IS
  'Phase 14 — tier-1 cache: curated Q&A served before fresh LLM calls. embedding_ref is reserved for the pgvector upgrade.';

ALTER TABLE approved_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read approved answers in scope" ON approved_answers;
CREATE POLICY "users read approved answers in scope" ON approved_answers
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users create approved answers in scope" ON approved_answers;
CREATE POLICY "users create approved answers in scope" ON approved_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    curated_by_user_id = auth.uid()
    AND hotel_is_in_user_scope(hotel_id)
  );

DROP POLICY IF EXISTS "users update approved answers in scope" ON approved_answers;
CREATE POLICY "users update approved answers in scope" ON approved_answers
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- record_approved_answer_hit(p_id) — increments hit_count + bumps last_served_at
-- atomically. Called from the client when a cache hit is served; small RPC so
-- the increment doesn't need a read-modify-write round trip.
CREATE OR REPLACE FUNCTION record_approved_answer_hit(p_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE approved_answers
     SET hit_count      = hit_count + 1,
         last_served_at = now()
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION record_approved_answer_hit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_approved_answer_hit(uuid) TO authenticated;

COMMIT;
