-- Phase 15 — Case nodes.
--
-- Cases are the AIP workflow envelope: one row ties an operator's input
-- (alert, agent run, manual note) to the proposals an agent emitted in
-- response, and finally to the outcome the operator chose. They give the
-- learning flywheel a unit of analysis bigger than a single proposal.
--
-- Shape mirrors CasePayload in packages/reality-graph/src/nodes/aip.ts:
--   { title, status, opened_by_user_id, input_refs, proposal_ids, outcome }
--
-- proposal_ids is a uuid[] for cheap ANY-queries; input_refs is jsonb
-- because each entry carries kind + ref ('alert:uuid', 'note:freetext', …).

BEGIN;

CREATE TABLE IF NOT EXISTS cases (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id      uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  title                text        NOT NULL,
  status               text        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open','in_review','resolved','closed')),

  /** Array of { kind: 'alert'|'agent_run'|'note'|'proposal'|'manual', ref: string }. */
  input_refs           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  /** Proposal nodes attached to this case. Duplicates are deduped at the API layer. */
  proposal_ids         uuid[]      NOT NULL DEFAULT '{}',
  /** Final outcome when status = resolved/closed. { action_type, summary }. */
  outcome              jsonb,

  opened_by_user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resolved_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at          timestamptz,

  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_hotel_open
  ON cases (hotel_id, created_at DESC)
  WHERE status IN ('open','in_review');

CREATE INDEX IF NOT EXISTS idx_cases_hotel_all
  ON cases (hotel_id, created_at DESC);

-- GIN index lets us query "all cases referencing this proposal" cheaply.
CREATE INDEX IF NOT EXISTS idx_cases_proposal_ids
  ON cases USING gin (proposal_ids);

COMMENT ON TABLE cases IS
  'Phase 15 — Case nodes. Workflow envelope tying input → proposals → outcome. Mirrors CasePayload in @beacon/reality-graph.';

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read cases in scope" ON cases;
CREATE POLICY "users read cases in scope" ON cases
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users create cases in scope" ON cases;
CREATE POLICY "users create cases in scope" ON cases
  FOR INSERT TO authenticated
  WITH CHECK (
    opened_by_user_id = auth.uid()
    AND hotel_is_in_user_scope(hotel_id)
  );

DROP POLICY IF EXISTS "users update cases in scope" ON cases;
CREATE POLICY "users update cases in scope" ON cases
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- attach_proposal_to_case(p_case_id, p_proposal_id) — appends the proposal
-- id to proposal_ids[] iff it isn't already present. Atomic; avoids the
-- read-modify-write race that an array_append would otherwise have.
CREATE OR REPLACE FUNCTION attach_proposal_to_case(p_case_id uuid, p_proposal_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE cases
     SET proposal_ids = (
       CASE
         WHEN proposal_ids @> ARRAY[p_proposal_id]::uuid[] THEN proposal_ids
         ELSE array_append(proposal_ids, p_proposal_id)
       END
     )
   WHERE id = p_case_id;
$$;

CREATE OR REPLACE FUNCTION detach_proposal_from_case(p_case_id uuid, p_proposal_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE cases
     SET proposal_ids = array_remove(proposal_ids, p_proposal_id)
   WHERE id = p_case_id;
$$;

REVOKE ALL ON FUNCTION attach_proposal_to_case(uuid, uuid)   FROM PUBLIC;
REVOKE ALL ON FUNCTION detach_proposal_from_case(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION attach_proposal_to_case(uuid, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION detach_proposal_from_case(uuid, uuid) TO authenticated;

COMMIT;
