-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 158 — pin search_path on the H1/H2 functions
--
-- get_advisors flagged three functions introduced in 156 + 157 with a mutable
-- search_path (function_search_path_mutable): append_action_chain_step,
-- remove_action_chain_step, scenarios_touch_updated_at. A mutable search_path
-- lets a caller's session settings change which schema the function resolves
-- unqualified names against. Pin it to public — they only touch public tables.
--
-- Depends on: 156 (action_chain fns), 157 (scenarios trigger fn)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION append_action_chain_step(p_chain_id uuid, p_action jsonb)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE action_chains
     SET simulated_actions = simulated_actions || p_action
   WHERE id = p_chain_id;
$$;

CREATE OR REPLACE FUNCTION remove_action_chain_step(p_chain_id uuid, p_index int)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actions jsonb;
BEGIN
  SELECT simulated_actions INTO v_actions FROM action_chains WHERE id = p_chain_id;
  IF v_actions IS NULL THEN RETURN; END IF;
  IF p_index < 0 OR p_index >= jsonb_array_length(v_actions) THEN RETURN; END IF;
  UPDATE action_chains
     SET simulated_actions = v_actions - p_index
   WHERE id = p_chain_id;
END;
$$;

CREATE OR REPLACE FUNCTION scenarios_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMIT;
