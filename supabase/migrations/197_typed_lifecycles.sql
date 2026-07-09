-- Typed lifecycles (handbook §1, A8): enforce legal status transitions at the
-- deepest boundary so web, agents, cron, and raw SQL all obey the same state
-- machines. Source of truth: packages/reality-graph/src/lifecycles.ts — this
-- seed mirrors those maps exactly. Same-state writes always pass (idempotent
-- upserts); INSERTs are unconstrained (any initial state).

CREATE TABLE IF NOT EXISTS lifecycle_transitions (
  node_type   text NOT NULL,
  from_status text NOT NULL,
  to_status   text NOT NULL,
  PRIMARY KEY (node_type, from_status, to_status)
);

ALTER TABLE lifecycle_transitions ENABLE ROW LEVEL SECURITY;
-- config-as-data: readable by any signed-in user (UIs render lawful moves),
-- writable only via migrations/service role.
CREATE POLICY lifecycle_transitions_read ON lifecycle_transitions
  FOR SELECT TO authenticated USING (true);

INSERT INTO lifecycle_transitions (node_type, from_status, to_status) VALUES
  -- restock_request
  ('restock_request', 'pending',          'pending_manager'),
  ('restock_request', 'pending',          'pending_director'),
  ('restock_request', 'pending',          'approved'),
  ('restock_request', 'pending',          'rejected'),
  ('restock_request', 'pending',          'cancelled'),
  ('restock_request', 'pending_manager',  'pending_director'),
  ('restock_request', 'pending_manager',  'approved'),
  ('restock_request', 'pending_manager',  'rejected'),
  ('restock_request', 'pending_manager',  'cancelled'),
  ('restock_request', 'pending_director', 'approved'),
  ('restock_request', 'pending_director', 'rejected'),
  ('restock_request', 'pending_director', 'cancelled'),
  ('restock_request', 'approved',         'fulfilled'),
  ('restock_request', 'approved',         'cancelled'),
  -- purchase_order
  ('purchase_order', 'draft',              'sent'),
  ('purchase_order', 'draft',              'cancelled'),
  ('purchase_order', 'sent',               'confirmed'),
  ('purchase_order', 'sent',               'cancelled'),
  ('purchase_order', 'confirmed',          'partially_received'),
  ('purchase_order', 'confirmed',          'closed'),
  ('purchase_order', 'confirmed',          'cancelled'),
  ('purchase_order', 'partially_received', 'closed'),
  ('purchase_order', 'partially_received', 'cancelled'),
  -- case
  ('case', 'open',      'in_review'),
  ('case', 'open',      'resolved'),
  ('case', 'open',      'closed'),
  ('case', 'in_review', 'open'),
  ('case', 'in_review', 'resolved'),
  ('case', 'in_review', 'closed'),
  ('case', 'resolved',  'open'),
  ('case', 'resolved',  'closed'),
  -- proposal
  ('proposal', 'pending', 'approved'),
  ('proposal', 'pending', 'rejected'),
  ('proposal', 'pending', 'superseded'),
  ('proposal', 'pending', 'expired')
ON CONFLICT DO NOTHING;

-- One generic guard for every lifecycle table. The node type rides in as a
-- trigger argument; failure carries the full derived context (self-apply:
-- a rejection without the from→to chain is a defect).
CREATE OR REPLACE FUNCTION enforce_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node text := TG_ARGV[0];
  v_allowed text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM lifecycle_transitions
    WHERE node_type = v_node AND from_status = OLD.status AND to_status = NEW.status
  ) THEN
    RETURN NEW;
  END IF;
  SELECT string_agg(to_status, ', ') INTO v_allowed
  FROM lifecycle_transitions
  WHERE node_type = v_node AND from_status = OLD.status;
  RAISE EXCEPTION 'illegal % transition ''%'' → ''%'' (%)',
    v_node, OLD.status, NEW.status,
    COALESCE('from ''' || OLD.status || ''' only: ' || v_allowed, '''' || OLD.status || ''' is terminal')
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_lifecycle_restock ON restock_requests;
CREATE TRIGGER trg_lifecycle_restock
  BEFORE UPDATE OF status ON restock_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle('restock_request');

DROP TRIGGER IF EXISTS trg_lifecycle_po ON purchase_orders;
CREATE TRIGGER trg_lifecycle_po
  BEFORE UPDATE OF status ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle('purchase_order');

DROP TRIGGER IF EXISTS trg_lifecycle_case ON cases;
CREATE TRIGGER trg_lifecycle_case
  BEFORE UPDATE OF status ON cases
  FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle('case');

DROP TRIGGER IF EXISTS trg_lifecycle_proposal ON proposals;
CREATE TRIGGER trg_lifecycle_proposal
  BEFORE UPDATE OF status ON proposals
  FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle('proposal');
