-- The audit.3 log line, and the three producers that make it a record and not
-- a label. Built from the enrollment-audit-log reading, whose Decisions block
-- the operator approved (Decisions 2-4: schema + management-path emitters; the
-- export dataset is a later chunk).
--
--   "Audit logs provide a comprehensive record of every action taken in Foundry, enabling security teams to detect threats, investigate incidents, ensure compliance, and maintain accountability across the platform."
--   — security/audit-logs-overview.md
--
-- We cannot instrument every entry point in one migration, and an audit log
-- that quietly covers three things while implying coverage of everything is a
-- liability wearing a compliance label. So the slice is honest by
-- construction: the table carries the full published 27-field schema, and the
-- categories CHECK admits ONLY categories a writer in this repository
-- produces — the event-log vocabulary rule (622, 639, 641). The published
-- ~80-category enumeration is the ceiling and the spelling authority; our set
-- grows one category per producer, in the migration that adds the producer.
--
--   "In the `audit.3` schema, every event must be logged under one or more standardized categories that provide consistent request and result parameters."
--   — security/audit-log-categories.md
--
-- The three producers, each the category's own page-row:
--
--   "Changes to group membership should always go through here."
--   — security/audit-log-categories.md            (managementGroups)
--
--   "Anything that changes permissions on the platform. These logs should use the `result_params` `changes` field to enumerate the precise change that occurred."
--   — security/audit-log-categories.md            (managementPermissions)
--
--   "Anything that modifies access to mandatory controls."
--   — security/audit-log-categories.md            (managementMarkings)
--
-- Applying a marking TO a resource routes to managementPermissions, not
-- managementMarkings — the audit.2 tombstone says so by name:
--
--   "Privileged action affecting mandatory controls in the system. Replaced by `managementPermissions` in `audit.3`."
--   — security/audit-log-categories.md            (mandatoryControlApplication)
--
-- so marking APPLICATION is a permissions change on the resource, and
-- managementMarkings is reserved for changes to the marking's own access
-- (marking_permissions).
--
-- ── APPEND-ONLY, FAIL-CLOSED ─────────────────────────────────────────────────
--
--   "The infrastructure through which audit logs flow from generation to storage is engineered to be append-only, ensuring audit trail integrity."
--   — security/monitor-audit-logs.md
--
-- RLS is enabled with NO policies and every table grant is revoked: nothing
-- reads or writes this table as authenticated. Writes happen only inside the
-- SECURITY DEFINER emitter, which itself is revoked from every role — it is
-- reachable only from the SECURITY DEFINER trigger functions, so a caller
-- cannot forge an audit line. Reads arrive with the export-dataset chunk,
-- which is where the page puts them ("viewed only by persons with the
-- necessary security qualifications" — the operation gating that is recorded
-- against the workflow-catalogue gap, not invented here).
--
-- Inference, marked: `result` carries our token 'SUCCESS' — an AFTER trigger
-- only fires on success, and the page gives examples (ERROR, UNAUTHORIZED)
-- but no enumeration, so the column takes no CHECK. `sequence_id` is a uuid
-- because the published schema types it uuid. `product` is 'beacon' and
-- `product_version` is the migrations ledger's max version, because that is
-- the one version this product actually has.

CREATE TABLE public.audit_events (
  log_entry_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL,
  sequence_id     uuid NOT NULL DEFAULT gen_random_uuid(),
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  categories      text[] NOT NULL,
  entities        jsonb NOT NULL DEFAULT '[]'::jsonb,
  environment     text,
  host            text NOT NULL,
  org_id          uuid,
  origin          text,
  origins         text[] NOT NULL DEFAULT '{}',
  product         text NOT NULL,
  producer_type   text NOT NULL CHECK (producer_type = ANY (ARRAY['SERVER', 'CLIENT'])),
  product_version text NOT NULL,
  request_fields  jsonb NOT NULL DEFAULT '{}'::jsonb,
  result          text NOT NULL,
  result_fields   jsonb NOT NULL DEFAULT '{}'::jsonb,
  service         text,
  sid             text,
  source_origin   text,
  stack           text,
  time            timestamptz NOT NULL DEFAULT clock_timestamp(),
  token_id        text,
  trace_id        text,
  uid             uuid,
  user_agent      text,
  users           jsonb NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE public.audit_events IS
  'The audit.3 log line, one row per line, snake_case of the 27 published fields (security/audit-logs-overview). Append-only: no policies, no grants, written only by record_audit_event. uid and org_id carry no foreign keys on purpose — an audit line is a record of the past and must outlive its subjects.';

COMMENT ON CONSTRAINT audit_events_producer_type_check ON public.audit_events IS
  'Values from security/audit-logs-overview — "How this audit log was produced; for example, from a backend (SERVER) or frontend (CLIENT)". Ours only writes SERVER.';

-- The admitted categories: only what a writer below produces. The page
-- security/audit-log-categories enumerates ~80 and is the spelling authority;
-- admitting one nothing emits would be a false past (639's event-log rule).
CREATE FUNCTION public.audit_categories()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['managementGroups', 'managementPermissions', 'managementMarkings']
$$;

COMMENT ON FUNCTION public.audit_categories() IS
  'The audit.3 categories a producer in this repository emits. Spelling from security/audit-log-categories; the set grows one category per producer, in the migration that adds the producer, never ahead of one.';

ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_categories_admitted
  CHECK (cardinality(categories) >= 1 AND categories <@ public.audit_categories());

COMMENT ON CONSTRAINT audit_events_categories_admitted ON public.audit_events IS
  'Every log names at least one category ("every event must be logged under one or more standardized categories") and only categories with a producer here; the set lives in audit_categories() so the constraint text never restates it.';

-- "Each audit category explicitly defines the values/items on which it applies" —
-- the guarantee is enforceable per row, so it is a CHECK: each admitted
-- category demands its published required request field.
CREATE FUNCTION public.audit_required_fields_present(p_categories text[], p_request jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(CASE c
    WHEN 'managementGroups'      THEN p_request ? 'groupPatches'
    WHEN 'managementPermissions' THEN p_request ? 'resourcesWithPermissionsChanges'
    WHEN 'managementMarkings'    THEN p_request ? 'markingPatches'
    ELSE false END), false)
  FROM unnest(p_categories) c
$$;

COMMENT ON FUNCTION public.audit_required_fields_present(text[], jsonb) IS
  'The audit.3 field guarantee, per admitted category: groupPatches, resourcesWithPermissionsChanges and markingPatches are each "type: required" on security/audit-log-categories.';

ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_fields_follow_categories
  CHECK (public.audit_required_fields_present(categories, request_fields));

-- "Always filter using the `time` column before performing aggregations", and
-- categories early; org_id+time is the export chunk's read shape.
CREATE INDEX audit_events_time ON public.audit_events (time);
CREATE INDEX audit_events_org_time ON public.audit_events (org_id, time);
CREATE INDEX audit_events_categories ON public.audit_events USING gin (categories);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_events FROM PUBLIC, anon, authenticated;

-- ── THE EMITTER ──────────────────────────────────────────────────────────────
-- One writer. Context it can actually observe: the caller from claims, their
-- organization, the PostgREST request headers when present (user-agent,
-- x-forwarded-for), the session id claim. The users set carries the uid alone,
-- which is the published behaviour: "In the current `audit.3` pipeline, only
-- the `uid` field is populated" (security/audit-logs-overview).
CREATE FUNCTION public.record_audit_event(
  p_name text, p_categories text[], p_service text,
  p_request jsonb DEFAULT '{}'::jsonb,
  p_result_fields jsonb DEFAULT '{}'::jsonb,
  p_entities jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid; v_headers jsonb; v_claims jsonb; v_version text;
  v_id uuid := gen_random_uuid();
BEGIN
  BEGIN v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN v_headers := NULL; END;
  BEGIN v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN v_claims := NULL; END;
  SELECT u.organization_id INTO v_org FROM public.users u WHERE u.id = v_uid;
  SELECT max(version) INTO v_version FROM supabase_migrations.schema_migrations;

  INSERT INTO public.audit_events
    (log_entry_id, event_id, name, categories, product, product_version,
     producer_type, service, environment, host, uid, org_id, users,
     origin, origins, sid, user_agent,
     request_fields, result, result_fields, entities)
  VALUES
    (v_id, gen_random_uuid(), p_name, p_categories, 'beacon', coalesce(v_version, '0'),
     'SERVER', p_service, current_database(),
     coalesce(inet_server_addr()::text, 'local'), v_uid, v_org,
     CASE WHEN v_uid IS NULL THEN '[]'::jsonb
          ELSE jsonb_build_array(jsonb_build_object('uid', v_uid)) END,
     v_headers ->> 'x-forwarded-for',
     CASE WHEN v_headers ? 'x-forwarded-for'
          THEN ARRAY[v_headers ->> 'x-forwarded-for'] ELSE '{}' END,
     v_claims ->> 'session_id', v_headers ->> 'user-agent',
     p_request, 'SUCCESS', p_result_fields, p_entities);
  RETURN v_id;
END $$;

COMMENT ON FUNCTION public.record_audit_event(text, text[], text, jsonb, jsonb, jsonb) IS
  'The one writer of audit_events. SECURITY DEFINER and revoked from every role: reachable only from the SECURITY DEFINER audit trigger functions, so a caller cannot forge a line. result is always SUCCESS because an AFTER trigger fires only on success — the page publishes examples (ERROR, UNAUTHORIZED), not an enumeration, so the column takes no CHECK.';

REVOKE ALL ON FUNCTION public.record_audit_event(text, text[], text, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

-- ── THE PRODUCERS ────────────────────────────────────────────────────────────
-- SECURITY DEFINER trigger functions: a trigger fires regardless of the
-- caller's EXECUTE rights, and definer rights let the emitter insert while
-- the table stays granted to nobody.

CREATE FUNCTION public.audit_management_groups() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r public.group_members;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  PERFORM public.record_audit_event(
    'BEACON_' || upper(TG_TABLE_NAME) || '_' || TG_OP,
    ARRAY['managementGroups'], TG_TABLE_NAME,
    jsonb_build_object('groupPatches', jsonb_build_array(jsonb_build_object(
      'group', r.group_id,
      'member', coalesce(r.member_user_id, r.member_group_id),
      'patch', TG_OP))),
    '{}'::jsonb,
    jsonb_build_array(to_jsonb(r.group_id::text)));
  RETURN NULL;
END $$;

CREATE TRIGGER audit_group_members
AFTER INSERT OR UPDATE OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.audit_management_groups();

CREATE FUNCTION public.audit_management_permissions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_resource text; v_row jsonb;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_resource := CASE TG_TABLE_NAME
    WHEN 'project_role_grants' THEN 'project:' || (v_row ->> 'project_id')
    WHEN 'space_role_grants'   THEN 'space:'   || (v_row ->> 'space_id')
    WHEN 'resource_markings'   THEN (v_row ->> 'resource_kind') || ':' || (v_row ->> 'resource_id')
  END;
  PERFORM public.record_audit_event(
    'BEACON_' || upper(TG_TABLE_NAME) || '_' || TG_OP,
    ARRAY['managementPermissions'], TG_TABLE_NAME,
    jsonb_build_object('resourcesWithPermissionsChanges', jsonb_build_array(v_resource)),
    -- "should use the `result_params` `changes` field to enumerate the precise change"
    jsonb_build_object('changes', jsonb_build_array(
      jsonb_build_object('op', TG_OP, 'row', v_row))),
    jsonb_build_array(to_jsonb(v_resource)));
  RETURN NULL;
END $$;

CREATE TRIGGER audit_project_role_grants
AFTER INSERT OR UPDATE OR DELETE ON public.project_role_grants
FOR EACH ROW EXECUTE FUNCTION public.audit_management_permissions();

CREATE TRIGGER audit_space_role_grants
AFTER INSERT OR UPDATE OR DELETE ON public.space_role_grants
FOR EACH ROW EXECUTE FUNCTION public.audit_management_permissions();

CREATE TRIGGER audit_resource_markings
AFTER INSERT OR UPDATE OR DELETE ON public.resource_markings
FOR EACH ROW EXECUTE FUNCTION public.audit_management_permissions();

CREATE FUNCTION public.audit_management_markings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r public.marking_permissions;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  PERFORM public.record_audit_event(
    'BEACON_' || upper(TG_TABLE_NAME) || '_' || TG_OP,
    ARRAY['managementMarkings'], TG_TABLE_NAME,
    jsonb_build_object('markingPatches', jsonb_build_array(jsonb_build_object(
      'marking', r.marking_id,
      'principal', coalesce(r.user_id, r.group_id),
      'permission', r.permission,
      'patch', TG_OP))),
    '{}'::jsonb,
    jsonb_build_array(to_jsonb(r.marking_id::text)));
  RETURN NULL;
END $$;

CREATE TRIGGER audit_marking_permissions
AFTER INSERT OR UPDATE OR DELETE ON public.marking_permissions
FOR EACH ROW EXECUTE FUNCTION public.audit_management_markings();

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
-- A real caller exercises every producer table; then every admitted category
-- is shown to have been produced (the 641 completeness loop), the line's
-- grammar is checked, authenticated is shown to reach nothing — not the
-- table, not the emitter — and the field guarantee refuses by contrast.
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_usr uuid; v_email text;
  v_grp uuid; v_ds uuid; v_mc uuid; v_mk uuid; v_role uuid;
  v_line record; v_missing text[]; v_seen text[]; v_ok boolean; v_n int;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe645') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe645') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe645', 'Probe645') RETURNING id INTO v_proj;
    v_usr := gen_random_uuid();
    v_email := 'probe645-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- managementGroups: membership added, then removed
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe 645', 'internal') RETURNING id INTO v_grp;
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_grp, v_usr);
    DELETE FROM public.group_members WHERE group_id = v_grp AND member_user_id = v_usr;

    -- managementMarkings: the marking's own access changes
    INSERT INTO public.marking_categories (organization_id, name, category_type, visibility)
      VALUES (v_org, 'Probe 645', 'conjunctive', 'visible') RETURNING id INTO v_mc;
    INSERT INTO public.markings (category_id, name)
      VALUES (v_mc, 'Probe 645') RETURNING id INTO v_mk;
    INSERT INTO public.marking_permissions (marking_id, user_id, permission)
      VALUES (v_mk, v_usr, 'apply');

    -- managementPermissions, all three producer tables: a project role, a
    -- space role, and a marking applied to a dataset
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);
    INSERT INTO public.space_roles (space_id, api_name, display_name)
      VALUES (v_sp, 'probe645', 'Probe 645') RETURNING id INTO v_role;
    INSERT INTO public.space_role_grants (space_id, role_id, user_id)
      VALUES (v_sp, v_role, v_usr);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe645', 'Probe645 DS') RETURNING id INTO v_ds;
    INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
      VALUES (v_mk, 'dataset', v_ds);

    -- every admitted category was produced through a real path
    SELECT array_agg(DISTINCT c) INTO v_seen
      FROM public.audit_events e CROSS JOIN LATERAL unnest(e.categories) c
     WHERE e.org_id = v_org;
    SELECT array_agg(t) INTO v_missing
      FROM unnest(public.audit_categories()) t
     WHERE NOT (t = ANY (coalesce(v_seen, '{}')));
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'these categories have no producer: %', array_to_string(v_missing, ', ');
    END IF;

    -- the line's grammar, on the membership add
    SELECT * INTO v_line FROM public.audit_events
     WHERE org_id = v_org AND name = 'BEACON_GROUP_MEMBERS_INSERT';
    IF v_line.log_entry_id IS NULL THEN
      RAISE EXCEPTION 'the group membership add produced no line';
    END IF;
    IF v_line.uid IS DISTINCT FROM v_usr
       OR v_line.users -> 0 ->> 'uid' IS DISTINCT FROM v_usr::text THEN
      RAISE EXCEPTION 'the line does not name its caller';
    END IF;
    IF NOT (v_line.request_fields -> 'groupPatches' -> 0 ? 'group')
       OR v_line.producer_type <> 'SERVER' OR v_line.product <> 'beacon' THEN
      RAISE EXCEPTION 'the line does not carry its category''s required shape';
    END IF;

    -- six real writes above; six tables fired; count the lines to prove no
    -- producer double-fires (group add+remove = 2, marking perm = 1, project
    -- role = 1, space role = 1, marking applied = 1)
    SELECT count(*) INTO v_n FROM public.audit_events WHERE org_id = v_org;
    IF v_n <> 6 THEN
      RAISE EXCEPTION 'expected 6 audit lines from 6 writes, found %', v_n;
    END IF;

    -- authenticated reaches nothing: not the table, not the emitter
    SET LOCAL ROLE authenticated;
    v_ok := false;
    BEGIN
      PERFORM count(*) FROM public.audit_events;
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'authenticated can read the audit table'; END IF;
    v_ok := false;
    BEGIN
      PERFORM public.record_audit_event('FORGED', ARRAY['managementGroups'], 'x',
        '{"groupPatches": []}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'authenticated can forge an audit line'; END IF;
    RESET ROLE;

    -- the guarantees refuse by contrast: an unadmitted category, and an
    -- admitted one missing its required field
    v_ok := false;
    BEGIN
      INSERT INTO public.audit_events (event_id, name, categories, host, product,
        producer_type, product_version, result, request_fields)
      VALUES (gen_random_uuid(), 'X', ARRAY['dataExport'], 'x', 'beacon',
        'SERVER', '0', 'SUCCESS', '{}'::jsonb);
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a category with no producer was admitted'; END IF;
    v_ok := false;
    BEGIN
      INSERT INTO public.audit_events (event_id, name, categories, host, product,
        producer_type, product_version, result, request_fields)
      VALUES (gen_random_uuid(), 'X', ARRAY['managementGroups'], 'x', 'beacon',
        'SERVER', '0', 'SUCCESS', '{}'::jsonb);
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a managementGroups line without groupPatches was admitted'; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '645 proved: all three categories produced through six real writes, the line names its caller, authenticated reaches neither table nor emitter, and both guarantees refuse by contrast';
  END;
END $$;
