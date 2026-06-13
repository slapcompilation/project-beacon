-- Phase Q2 — Ontology proposals: the self-evolving ontology, persisted.
--
-- Q1 detects typed concepts the data carries but the ontology doesn't capture
-- (a removal_category sitting in free text). Q2 closes the loop: an operator
-- approval is recorded HERE, and the approved value becomes a recognized type —
-- the ontology grows, auditably, under review. Detection stays live (the
-- detector re-derives pending gaps from data each run); only DECISIONS persist.
--
-- One row per decided concept per hotel. status:
--   approved  → the value is now a recognized typed extension (the ontology grew)
--   rejected  → operator said no; the detector stops re-surfacing it
--   superseded→ reserved for a future re-decision chain
-- Both approved + rejected suppress re-proposal; only approved count as growth.
--
-- decided_by/decided_at are the audit; the row is append-mostly (status flips,
-- never deleted) — same contract as proposals/cases. Mirrors the audited
-- hotel-scoped RLS from migration 134 (cases).

BEGIN;

CREATE TABLE IF NOT EXISTS ontology_proposals (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id           uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id    uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  kind               text        NOT NULL DEFAULT 'new_category'
                                 CHECK (kind IN ('new_category')),
  /** Existing node type + field the extension refines (e.g. StockLog.removal_category). */
  target_type        text        NOT NULL,
  target_field       text        NOT NULL,
  /** The proposed typed value (e.g. 'spoilage'). */
  proposed           text        NOT NULL,

  rationale          text        NOT NULL,
  /** Snapshot of the evidence at decision time: { occurrences, totalConsidered, coverage, examples }. */
  evidence           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  confidence         numeric     NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  status             text        NOT NULL
                                 CHECK (status IN ('approved','rejected','superseded')),

  -- ON DELETE SET NULL: the grown ontology outlives the user who approved it.
  decided_by_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at         timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (hotel_id, target_field, proposed)
);

CREATE INDEX IF NOT EXISTS idx_ontology_proposals_hotel_status
  ON ontology_proposals (hotel_id, status, created_at DESC);

COMMENT ON TABLE ontology_proposals IS
  'Phase Q2 — persisted operator decisions on ontology gaps. status=approved rows are recognized typed extensions (the ontology grew, auditably). Detection itself stays live in detect_ontology_gaps.';

ALTER TABLE ontology_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read ontology proposals in scope" ON ontology_proposals;
CREATE POLICY "users read ontology proposals in scope" ON ontology_proposals
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users create ontology proposals in scope" ON ontology_proposals;
CREATE POLICY "users create ontology proposals in scope" ON ontology_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    decided_by_user_id = auth.uid()
    AND hotel_is_in_user_scope(hotel_id)
  );

DROP POLICY IF EXISTS "users update ontology proposals in scope" ON ontology_proposals;
CREATE POLICY "users update ontology proposals in scope" ON ontology_proposals
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

COMMIT;
