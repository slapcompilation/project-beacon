-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 323 — the status cascade only worked for superusers.
--
-- 321's probe passed because migrations run as the table owner, and the owner
-- bypasses RLS. Under an actual browser session it did nothing at all:
--
--   an org admin deprecates an object type
--     → AFTER trigger issues UPDATE link_types ... (SECURITY INVOKER, so as them)
--     → link_types has NO UPDATE POLICY for authenticated
--     → the update matches zero rows, raises nothing, and the link stays `active`
--
-- Verified against the live database before changing anything: the link read
-- back "active" after an admin deprecated one of its ends. Which is the exact
-- invalid state Foundry names an error for —
-- `OntologyMetadata:ConflictBetweenLinkTypeStatusAndObjectTypeStatus`, "an
-- experimental object type cannot have an active link type".
--
-- A silent no-op is the worst of the three possible outcomes. Refusing would at
-- least have been visible.
--
-- SECURITY DEFINER is right here rather than a workaround, because the cascade
-- is not the user's write — it is the database keeping its own invariant, the
-- same way Foundry's Ontology Manager "ensures status consistency" without
-- asking whether you had permission on the other end. The blast radius is
-- exactly the link types touching the object type the caller already passed RLS
-- to update, and search_path is pinned.
--
-- Deliberately NOT adding an UPDATE policy on link_types: nothing edits a link
-- type's status directly yet, and a policy with no consumer is the dead surface
-- this codebase keeps deleting.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.cascade_object_type_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Touch the links so sync_link_type_status recomputes from both ends. The
  -- precedence lives in one place rather than being restated here.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('experimental', 'example', 'deprecated') THEN
    UPDATE link_types SET status = status
     WHERE source_object_type_id = NEW.id OR target_object_type_id = NEW.id;
  END IF;
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.cascade_object_type_status() IS
  'Keeps a link type no healthier than the object types it joins. SECURITY DEFINER because the cascade is the database holding its invariant, not the caller writing — link_types has no UPDATE policy, so as INVOKER this silently did nothing (migration 323).';

-- ── Proved as an operator, not as the owner ─────────────────────────────────

DO $$
DECLARE v_org uuid; v_user uuid; v_a uuid; v_b uuid; v_link uuid; v_status text; claims text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;
  claims := json_build_object('sub', v_user,
    'app_metadata', json_build_object('org_id', v_org::text, 'role', 'admin'))::text;

  BEGIN
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_cascade_a', 'A', v_user) RETURNING id INTO v_a;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_cascade_b', 'B', v_user) RETURNING id INTO v_b;
    INSERT INTO link_types (organization_id, source_object_type_id, target_object_type_id,
                            api_name, label, target_api_name, target_label,
                            cardinality, backing_kind, backing_table, created_by_user_id)
    VALUES (v_org, v_a, v_b, 'probe_cascade_link', 'P', 'probe_cascade_link', 'P',
            'many_to_many', 'join_table', 'object_links', v_user) RETURNING id INTO v_link;
    UPDATE object_types SET status = 'active' WHERE id IN (v_a, v_b);
    UPDATE link_types SET status = 'active' WHERE id = v_link;

    -- The path the Studio surface actually takes.
    PERFORM set_config('request.jwt.claims', claims, true);
    SET LOCAL ROLE authenticated;
    UPDATE object_types SET status = 'deprecated', deprecation_reason = 'probe',
           deprecation_deadline = current_date + 30 WHERE id = v_a;
    RESET ROLE;

    SELECT status INTO v_status FROM link_types WHERE id = v_link;
    IF v_status <> 'deprecated' THEN
      RAISE EXCEPTION
        'Migration 323: an admin deprecated an object type and its link stayed "%" — the cascade is still invisible to operators', v_status;
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
