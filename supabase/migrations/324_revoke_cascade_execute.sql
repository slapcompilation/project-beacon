-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 324 — take EXECUTE off the cascade.
--
-- Making cascade_object_type_status SECURITY DEFINER in 323 handed anon and
-- authenticated the right to call it directly, and security_invariants.sql
-- refused the build for it (invariant 1, from migration 176). The guard did its
-- job on a function that had existed for four minutes.
--
-- A trigger function needs no EXECUTE grant to fire — Postgres checks TRIGGER
-- privilege on the table when the trigger is created, not the function's ACL on
-- every row. So this is a straight revoke, and the probe below is what proves
-- that claim rather than trusting it.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

REVOKE ALL ON FUNCTION public.cascade_object_type_status() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_org uuid; v_user uuid; v_a uuid; v_b uuid; v_link uuid; v_status text; claims text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;
  claims := json_build_object('sub', v_user,
    'app_metadata', json_build_object('org_id', v_org::text, 'role', 'admin'))::text;

  BEGIN
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_revoke_a', 'A', v_user) RETURNING id INTO v_a;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_revoke_b', 'B', v_user) RETURNING id INTO v_b;
    INSERT INTO link_types (organization_id, source_object_type_id, target_object_type_id,
                            api_name, label, target_api_name, target_label,
                            cardinality, backing_kind, backing_table, created_by_user_id)
    VALUES (v_org, v_a, v_b, 'probe_revoke_link', 'P', 'probe_revoke_link', 'P',
            'many_to_many', 'join_table', 'object_links', v_user) RETURNING id INTO v_link;
    UPDATE object_types SET status = 'active' WHERE id IN (v_a, v_b);
    UPDATE link_types SET status = 'active' WHERE id = v_link;

    -- Fires for a user who can no longer call it.
    PERFORM set_config('request.jwt.claims', claims, true);
    SET LOCAL ROLE authenticated;
    UPDATE object_types SET status = 'deprecated', deprecation_reason = 'probe',
           deprecation_deadline = current_date + 30 WHERE id = v_a;
    RESET ROLE;

    SELECT status INTO v_status FROM link_types WHERE id = v_link;
    IF v_status <> 'deprecated' THEN
      RAISE EXCEPTION
        'Migration 324: revoking EXECUTE stopped the trigger firing — the link is "%"', v_status;
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
