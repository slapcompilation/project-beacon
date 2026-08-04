-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 345 — a promoted object type can currently be renamed and deleted.
--
-- Foundry (`mirror/object-link-types/metadata-statuses.md`):
--
--   "`Promoted` object types inherit similar protections as `active` object
--    types for API names."
--
-- and, on the same page: promoted types inherit "similar operational
-- protections of the `active` status, such as restrictions on deletion."
--
-- HOW THE HOLE OPENED. Migration 321 put `promoted` inside the status enum, so
-- the guard read `OLD.status IN ('active','promoted')` and the protection came
-- for free. Migration 327 correctly re-modelled promotion as a separate axis —
-- a `resource_status` row, because a type is `active` AND promoted, not one or
-- the other — and dropped the now-impossible enum value from the guard. What it
-- did not do is teach the guard where promotion moved to. So today:
--
--   * a promoted + experimental object type can be RENAMED (rename is allowed
--     for experimental), and
--   * a promoted + anything-but-active object type can be DELETED.
--
-- The curated, checkmarked, search-boosted resource is the one with no
-- protection. That is the drift class this repo keeps finding: a guard that
-- silently stopped covering a case when the model underneath it moved.
--
-- The trigger is shared by object_types, link_types and ontology_interfaces,
-- but `resource_status` only admits `object_type` — which matches Foundry,
-- where promotion is documented as object-types-only. So the lookup is scoped
-- to that table and the other two are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_ontology_status()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  -- Promotion lives in resource_status since 327, and only object types may be
  -- promoted. For link types and interfaces this stays false.
  v_promoted boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'object_types' THEN
    SELECT EXISTS (
      SELECT 1 FROM resource_status
       WHERE resource_kind = 'object_type'
         AND resource_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
         AND status = 'promoted'
    ) INTO v_promoted;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_promoted AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION
        'Ontology:ResourceIsPromoted %.% is promoted and cannot be deleted. Withdraw the promotion first — a promoted type is a vetted, core resource other work is built on.',
        TG_TABLE_NAME, OLD.api_name;
    END IF;
    IF OLD.status = 'active' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION
        'Ontology:ResourceIsActive %.% is active and cannot be deleted. Mark it deprecated — with a reason, a deadline and ideally a replacement — or experimental first.',
        TG_TABLE_NAME, OLD.api_name;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.api_name IS DISTINCT FROM OLD.api_name AND v_promoted THEN
    RAISE EXCEPTION
      'Ontology:ResourceIsPromoted %.% is promoted; its API name is protected like an active resource. Withdraw the promotion before renaming "%".',
      TG_TABLE_NAME, OLD.api_name, OLD.api_name;
  END IF;

  IF NEW.api_name IS DISTINCT FROM OLD.api_name AND OLD.status <> 'experimental' THEN
    RAISE EXCEPTION
      'Ontology:ResourceIsActive %.% is %; only an experimental resource may be renamed. Anything already built against "%" would break.',
      TG_TABLE_NAME, OLD.api_name, OLD.status, OLD.api_name;
  END IF;

  IF NEW.status <> 'deprecated' AND OLD.status = 'deprecated' THEN
    NEW.deprecation_reason := NULL;
    NEW.deprecation_deadline := NULL;
    NEW.replaced_by := NULL;
  END IF;

  RETURN NEW;
END $function$;

DO $$
DECLARE v_org uuid; v_user uuid; v_type uuid; v_ok boolean;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT id INTO v_user FROM auth.users LIMIT 1;

  -- The guard only fires for operator sessions, so the probe needs one.
  PERFORM set_config('request.jwt.claims', json_build_object(
    'role','authenticated','sub',v_user::text,
    'app_metadata', json_build_object('org_id', v_org::text, 'role','owner'))::text, true);

  INSERT INTO object_types (organization_id, api_name, label, icon, description,
                            properties, status, created_by_user_id)
  VALUES (v_org, 'probe_promoted_345', 'Probe 345', 'cube', 'probe',
          '[{"key":"name","label":"Name","type":"text","required":false}]'::jsonb,
          'experimental', v_user)
  RETURNING id INTO v_type;

  -- Experimental and unpromoted: renaming is allowed. This is the control.
  UPDATE object_types SET api_name = 'probe_promoted_345b' WHERE id = v_type;

  INSERT INTO resource_status (resource_kind, resource_id, organization_id)
  VALUES ('object_type', v_type, v_org);

  -- Now promoted. Both protections must bite even though it is still experimental.
  v_ok := false;
  BEGIN
    UPDATE object_types SET api_name = 'probe_promoted_345c' WHERE id = v_type;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'Ontology:ResourceIsPromoted%' THEN v_ok := true; ELSE RAISE; END IF;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'Migration 345: a promoted type was renamed'; END IF;

  v_ok := false;
  BEGIN
    DELETE FROM object_types WHERE id = v_type;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'Ontology:ResourceIsPromoted%' THEN v_ok := true; ELSE RAISE; END IF;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'Migration 345: a promoted type was deleted'; END IF;

  -- Withdrawing the promotion returns it to experimental freedom.
  DELETE FROM resource_status WHERE resource_kind='object_type' AND resource_id = v_type;
  UPDATE object_types SET api_name = 'probe_promoted_345d' WHERE id = v_type;
  DELETE FROM object_types WHERE id = v_type;

  RAISE EXCEPTION 'rollback_probe';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
END $$;

COMMIT;
