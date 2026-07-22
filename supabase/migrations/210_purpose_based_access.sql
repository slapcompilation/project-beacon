-- Purpose-based access controls (C-22, Foundry parity). Restrict data by WHY,
-- not just WHO: the same user, operating under a declared purpose, sees a
-- narrower slice. Effective read clearance = LEAST(role clearance, purpose
-- ceiling) — a purpose can only NARROW below the role, never elevate, so a
-- client declaring a broad purpose can't exceed what its role already allows.
-- The purpose rides in on the x-beacon-purpose request header (PostgREST exposes
-- it via request.headers), so it's per-request and auditable.

-- Config-as-data: the purposes + what each may see. Tunable per org later; the
-- seeded set covers the hospitality baseline.
CREATE TABLE IF NOT EXISTS access_purposes (
  id              text PRIMARY KEY,
  label           text NOT NULL,
  description     text NOT NULL DEFAULT '',
  max_sensitivity text NOT NULL DEFAULT 'internal'
    CHECK (max_sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
  sort_order      int NOT NULL DEFAULT 100
);
ALTER TABLE access_purposes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS access_purposes_read ON access_purposes;
CREATE POLICY access_purposes_read ON access_purposes
  FOR SELECT TO authenticated USING (true);

INSERT INTO access_purposes (id, label, description, max_sensitivity, sort_order) VALUES
  ('operations',    'Operations',    'Day-to-day stock and service. Internal documents only.',          'internal',     10),
  ('procurement',   'Procurement',   'Sourcing and supplier contracts. Confidential terms visible.',    'confidential', 20),
  ('guest_service', 'Guest Service', 'Guest-facing service. Confidential incl. guest contact details.', 'confidential', 30),
  ('compliance',    'Compliance',    'Audit and governance. Full access incl. restricted and PII.',     'restricted',   40)
ON CONFLICT (id) DO NOTHING;

-- The purpose declared for this request (null when none/enforcement off).
CREATE OR REPLACE FUNCTION active_purpose() RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT nullif(current_setting('request.headers', true), '')::json ->> 'x-beacon-purpose';
$$;

-- The sensitivity ceiling the active purpose imposes. No/unknown purpose → rank
-- 3 (no ceiling), so the role clearance governs alone (backward-compatible).
CREATE OR REPLACE FUNCTION active_purpose_ceiling() RETURNS int
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT sensitivity_rank(max_sensitivity) FROM access_purposes WHERE id = active_purpose()),
    3
  );
$$;

-- Extend the P8 read gates: effective clearance is the lesser of role and purpose.
DROP POLICY IF EXISTS "users read documents in scope" ON documents;
CREATE POLICY "users read documents in scope" ON documents
  FOR SELECT TO authenticated
  USING (
    hotel_is_in_user_scope(hotel_id)
    AND sensitivity_rank(sensitivity) <= LEAST(user_doc_clearance(), active_purpose_ceiling())
  );

DROP POLICY IF EXISTS "users read chunks in scope" ON document_chunks;
CREATE POLICY "users read chunks in scope" ON document_chunks
  FOR SELECT TO authenticated
  USING (
    hotel_is_in_user_scope(hotel_id)
    AND EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_chunks.document_id
        AND sensitivity_rank(d.sensitivity) <= LEAST(user_doc_clearance(), active_purpose_ceiling())
    )
  );
