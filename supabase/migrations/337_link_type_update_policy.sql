-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 337 — link types become editable, now that something edits them.
--
-- Migration 323 said this explicitly and was right to wait:
--
--   "Deliberately NOT adding an UPDATE policy on link_types: nothing edits a
--    link type's status directly yet, and a policy with no consumer is the dead
--    surface this codebase keeps deleting."
--
-- The Studio now has a status control on every link type, so the consumer
-- exists. Without the policy the write SILENTLY DID NOTHING — RLS matched zero
-- rows, PostgREST returned success, and the operator would have watched a status
-- refuse to change with no error anywhere. Caught by running the UI's own write
-- against the database rather than trusting the form.
--
-- Same shape as the other authoring policies: admin or owner, inside the
-- organization. The status guards in 321 still apply on top — an active link
-- type cannot be renamed, and the cascade from its object types still overrides
-- whatever is set here.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP POLICY IF EXISTS "admins update link types" ON public.link_types;
CREATE POLICY "admins update link types" ON public.link_types
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('owner', 'admin')
         AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner', 'admin')
              AND organization_id IS NOT DISTINCT FROM auth_org_id());

DO $$
DECLARE v_org uuid; v_user uuid; v_a uuid; v_b uuid; v_link uuid; st text; claims text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT id INTO v_user FROM auth.users LIMIT 1;
  claims := json_build_object('sub', v_user,
    'app_metadata', json_build_object('org_id', v_org::text, 'role', 'admin'))::text;

  BEGIN
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_ltp_a', 'A', v_user) RETURNING id INTO v_a;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_ltp_b', 'B', v_user) RETURNING id INTO v_b;
    INSERT INTO link_types (organization_id, source_object_type_id, target_object_type_id,
      api_name, label, target_api_name, target_label, cardinality, backing_kind, backing_table, created_by_user_id)
    VALUES (v_org, v_a, v_b, 'probe_ltp_link', 'L', 'probe_ltp_link', 'L',
            'many_to_many', 'join_table', 'object_links', v_user)
    RETURNING id INTO v_link;
    UPDATE object_types SET status = 'active' WHERE id IN (v_a, v_b);
    UPDATE link_types SET status = 'active' WHERE id = v_link;

    -- The write the Studio makes.
    PERFORM set_config('request.jwt.claims', claims, true);
    SET LOCAL ROLE authenticated;
    UPDATE link_types SET status = 'deprecated', deprecation_reason = 'probe',
           deprecation_deadline = current_date + 30 WHERE id = v_link;
    RESET ROLE;

    SELECT status INTO st FROM link_types WHERE id = v_link;
    IF st <> 'deprecated' THEN
      RAISE EXCEPTION 'Migration 337: an admin deprecated a link type and it stayed "%"', st;
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
