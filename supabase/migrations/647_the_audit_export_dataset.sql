-- The delivery half of the audit log: a per-organization export into a real
-- dataset. Decision 5 of the enrollment-audit-log reading, the recorded
-- remainder of 645/646.
--
--   "Both `audit.2` and `audit.3` logs can be exported, per-organization, directly into a Foundry dataset through the audit logs tooling in [Control Panel](/docs/foundry/administration/control-panel/)."
--   — security/audit-logs-overview.md
--
-- Ours is audit.3 only (Decision 6: audit.2 is historical-migration material
-- for a history we do not have — the log-type parameter exists and refuses it
-- by name). The Control Panel *surface* is still out of scope; this is the
-- machinery, which must not wait for its chrome.
--
-- ── WHO MAY CREATE ONE ───────────────────────────────────────────────────────
--
--   "To export audit logs, you will need the `audit-export:orchestrate-v3` operation (for `audit.3`) on the target organization(s). This can be granted with the **Organization administrator** role in Control Panel, configurable from the **Organization permissions** tab."
--   — security/audit-logs-overview.md
--
-- The operation itself waits with the workflow catalogue (Decision 7); the
-- role that grants it is one we have, so the gate here is the organization
-- administrator: auth_role() IN ('owner','admin') on the export's own
-- organization. Location placement then passes through dataset_materialize,
-- which carries its own can_write_dataset gate — choosing a location you may
-- not write to refuses exactly as any other dataset creation would.
--
-- ── WHAT THE DATASET IS ──────────────────────────────────────────────────────
-- One dataset per export, schema 1:1 with the published audit.3 fields under
-- their PUBLISHED camelCase names — the reader of this dataset is the analyst
-- holding the audit.3 docs, so the columns speak the analyst vocabulary while
-- audit_events speaks ours (the two-vocabularies rule, decided per audience).
-- Plus the date column their schema carries:
--
--   "`Audit.3` export datasets use the `date` column as a Hive Partition column in their schema."
--   — security/audit-logs-overview.md
--
-- map<string, any> has no dataset spelling, so requestFields and resultFields
-- declare MAP<STRING, STRING> — the closest the schema grammar expresses — and
-- land physically as jsonb either way. users declares the published
-- ContextualizedUser struct whole, empty enrichment fields included.
--
-- The COLUMN is faithful (a real DATE derived from time); Hive partitioning
-- itself is storage behaviour we do not have — the btree on time is our
-- answer to the same query pattern, divergence noted here.
--
--   "By default, audit log datasets will be marked with the organization selected above."
--   — security/audit-logs-overview.md
--
-- Foundry's organization IS a marking; ours is the organization_id column and
-- the auth_in_org conjunction every dataset read already passes through, so
-- the default marking holds by construction. Further markings apply through
-- the normal resource_markings path. And read access is the dataset's own row
-- policy — this is where the audit log's readers arrive, which is why the raw
-- table stayed unreadable in 646.
--
-- ── HOW IT FILLS ─────────────────────────────────────────────────────────────
--
--   "New logs are appended to the export dataset on a regular cadence."
--   — security/audit-logs-overview.md
--
--   "Schedules controlling the builds of the export dataset are controlled by the audit-export service and are hidden from view of the user."
--   — security/audit-logs-overview.md
--
-- So the cadence is service-owned, not a user schedule: a pg_cron job every
-- fifteen minutes, the number anchored to the published latency —
--
--   "**Low latency:** Available within ~15 minutes of event occurrence, enabling timely threat detection."
--   — security/audit-logs-overview.md
--
-- on 553's runner shape. Each run appends only lines attributed to the
-- export's organization —
--
--   "An audit export orchestrated for a given organization is limited to audit logs attributed to that organization."
--   — security/audit-logs-overview.md
--
-- past the watermark, as one APPEND transaction carrying one file of logs
-- (the api's own resource grammar: a LogFile is "A file of audit logs").
-- A run with nothing new appends nothing — the page calls empty append
-- transactions an audit.2 behaviour absent from audit.3 exports.
--
-- ── THE KNOBS ────────────────────────────────────────────────────────────────
--
--   "Optionally, enable a **start date filter** to limit this dataset to events that occur on or after a given date."
--   — security/audit-logs-overview.md
--
-- The start date IS the watermark's starting value — one mechanism, not two.
--
--   "Optionally, enable a dataset-specific **retention policy** to limit the number of days logs are preserved in this particular export dataset (max 730 days). Note that retention policies are based on the transaction timestamp when logs were added to the export dataset, not the timestamp of the log entries themselves."
--   — security/audit-logs-overview.md
--
-- Retention deletes the FILES of transactions committed past the bound (the
-- physical rows cascade through _file); the transaction rows stay as history
-- skeleton. This is the third unattended destructive path, but the first
-- whose bound is user-configured — per export, capped at the page's 730.
--
-- ── THE HALT ─────────────────────────────────────────────────────────────────
--
--   "Moving an audit log dataset will stop any further builds of that dataset after roughly one hour has elapsed in the Trash or different project."
--   — security/audit-logs-overview.md
--
--   "Note that **there is no way to restart these builds once halted**, even if the dataset is subsequently restored from the Trash or moved back to the original project."
--   — security/audit-logs-overview.md
--
-- The run notices a trashed or moved dataset, stamps displaced_at, pauses;
-- restored within the hour, the stamp clears and appends resume; an hour
-- displaced, halted_at is stamped and a guard trigger makes it permanent.

CREATE TABLE public.audit_exports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  dataset_id      uuid NOT NULL UNIQUE REFERENCES public.datasets(id),
  branch_id       uuid NOT NULL REFERENCES public.dataset_branches(id),
  -- the registered location: a move away from it is the page's halt clock
  project_id      uuid NOT NULL REFERENCES public.projects(id),
  log_type        text NOT NULL DEFAULT 'audit.3' CHECK (log_type = 'audit.3'),
  start_date      date,
  retention_days  integer CHECK (retention_days > 0 AND retention_days <= 730),
  exported_through timestamptz NOT NULL,
  displaced_at    timestamptz,
  halted_at       timestamptz,
  created_by      uuid NOT NULL REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_exports IS
  'One row per audit log export dataset (security/audit-logs-overview): per-organization, audit.3 only, filled by run_audit_exports on the fifteen-minute cron. exported_through is the watermark and the start-date filter is its starting value. displaced_at tracks the trash/move grace hour; halted_at is permanent by trigger.';

COMMENT ON CONSTRAINT audit_exports_log_type_check ON public.audit_exports IS
  'audit.3 alone: "Audit.2 logs of new events will soon cease to be available for export" (security/audit-logs-overview), and this platform has no audit.2 history at all — create_audit_export refuses the request by name.';

CREATE INDEX audit_exports_org ON public.audit_exports (organization_id);
CREATE INDEX audit_exports_branch ON public.audit_exports (branch_id);
CREATE INDEX audit_exports_project ON public.audit_exports (project_id);
CREATE INDEX audit_exports_created_by ON public.audit_exports (created_by);

ALTER TABLE public.audit_exports ENABLE ROW LEVEL SECURITY;

-- The registry is Control Panel material: organization administrators see
-- their organization's exports, nobody else sees anything, and no write path
-- exists outside the definer functions (disabling an export is trashing its
-- DATASET, not editing this row).
CREATE POLICY "org admins see their exports" ON public.audit_exports
  FOR SELECT USING (public.auth_in_org(organization_id)
                    AND public.auth_role() IN ('owner', 'admin'));

-- Once halted, halted forever.
CREATE FUNCTION public.guard_audit_export_halt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.halted_at IS NOT NULL AND NEW.halted_at IS DISTINCT FROM OLD.halted_at THEN
    RAISE EXCEPTION 'AuditExport:CannotRestart — there is no way to restart these builds once halted'
      USING HINT = 'Create a new export dataset instead.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_audit_export_halt
BEFORE UPDATE ON public.audit_exports
FOR EACH ROW EXECUTE FUNCTION public.guard_audit_export_halt();

-- ── CREATION ─────────────────────────────────────────────────────────────────
CREATE FUNCTION public.create_audit_export(
  p_organization uuid, p_project uuid, p_api_name text, p_name text,
  p_start_date date DEFAULT NULL, p_retention_days integer DEFAULT NULL,
  p_log_type text DEFAULT 'audit.3'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_ds uuid; v_br uuid; v_txn uuid;
BEGIN
  IF p_log_type IS DISTINCT FROM 'audit.3' THEN
    RAISE EXCEPTION 'AuditExport:LogTypeNotSupported — % has no logs here; only audit.3 is written', p_log_type
      USING HINT = 'audit.2 is a historical schema, and this platform has no audit.2 history.';
  END IF;
  IF NOT (public.auth_in_org(p_organization) AND public.auth_role() IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'AuditExport:NotAuthorized — the Organization administrator role creates audit log exports';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects p
                  WHERE p.id = p_project AND p.organization_id = p_organization) THEN
    RAISE EXCEPTION 'AuditExport:NoSuchProject — % is not a project of this organization', p_project;
  END IF;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (p_organization, p_project, p_api_name, p_name) RETURNING id INTO v_ds;
  INSERT INTO public.dataset_branches (dataset_id, name)
  VALUES (v_ds, 'master') RETURNING id INTO v_br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (v_ds, v_br, 'SNAPSHOT') RETURNING id INTO v_txn;

  -- the audit.3 fields under their published names, plus the date column
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (v_ds, v_txn, '[
    {"name": "categories",     "type": "ARRAY", "arraySubType": {"type": "STRING"}},
    {"name": "entities",       "type": "ARRAY", "arraySubType": {"type": "STRING"}},
    {"name": "environment",    "type": "STRING"},
    {"name": "eventId",        "type": "STRING"},
    {"name": "host",           "type": "STRING"},
    {"name": "logEntryId",     "type": "STRING"},
    {"name": "name",           "type": "STRING"},
    {"name": "orgId",          "type": "STRING"},
    {"name": "origin",         "type": "STRING"},
    {"name": "origins",        "type": "ARRAY", "arraySubType": {"type": "STRING"}},
    {"name": "product",        "type": "STRING"},
    {"name": "producerType",   "type": "STRING"},
    {"name": "productVersion", "type": "STRING"},
    {"name": "requestFields",  "type": "MAP",
     "mapKeyType": {"type": "STRING"}, "mapValueType": {"type": "STRING"}},
    {"name": "result",         "type": "STRING"},
    {"name": "resultFields",   "type": "MAP",
     "mapKeyType": {"type": "STRING"}, "mapValueType": {"type": "STRING"}},
    {"name": "sequenceId",     "type": "STRING"},
    {"name": "service",        "type": "STRING"},
    {"name": "sid",            "type": "STRING"},
    {"name": "sourceOrigin",   "type": "STRING"},
    {"name": "stack",          "type": "STRING"},
    {"name": "time",           "type": "TIMESTAMP"},
    {"name": "tokenId",        "type": "STRING"},
    {"name": "traceId",        "type": "STRING"},
    {"name": "uid",            "type": "STRING"},
    {"name": "userAgent",      "type": "STRING"},
    {"name": "users",          "type": "ARRAY", "arraySubType": {"type": "STRUCT",
     "subSchemas": [
       {"name": "uid",       "type": "STRING"},
       {"name": "userName",  "type": "STRING"},
       {"name": "firstName", "type": "STRING"},
       {"name": "lastName",  "type": "STRING"},
       {"name": "groups",    "type": "ARRAY", "arraySubType": {"type": "STRING"}},
       {"name": "realm",     "type": "STRING"}
     ]}},
    {"name": "date",           "type": "DATE"}
  ]'::jsonb);

  UPDATE public.dataset_transactions
     SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = v_txn;
  -- carries its own can_write_dataset gate: the chosen location must be one
  -- the caller may create a dataset in
  PERFORM public.dataset_materialize(v_ds, v_txn);

  INSERT INTO public.audit_exports
    (organization_id, dataset_id, branch_id, project_id, log_type,
     start_date, retention_days, exported_through, created_by)
  VALUES
    (p_organization, v_ds, v_br, p_project, p_log_type, p_start_date, p_retention_days,
     -- "on or after" is inclusive, and the watermark comparison is strict
     coalesce(p_start_date::timestamptz - interval '1 microsecond', '-infinity'), auth.uid());
  RETURN v_ds;
END $$;

COMMENT ON FUNCTION public.create_audit_export(uuid, uuid, text, text, date, integer, text) IS
  'Create export dataset (security/audit-logs-overview): an empty audit.3-schema dataset in the chosen location, registered for the fifteen-minute append. Gate is the organization administrator; the start-date filter becomes the watermark''s starting value.';

-- ── THE APPEND, ON THE RUNNER ────────────────────────────────────────────────
CREATE FUNCTION public.run_audit_exports() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  e record; d record; v_total integer := 0; v_n integer;
  v_high timestamptz; v_txn uuid; v_file uuid; v_phys text;
BEGIN
  FOR e IN SELECT * FROM public.audit_exports WHERE halted_at IS NULL LOOP
    SELECT ds.trashed_at, ds.project_id, ds.physical_table INTO d
      FROM public.datasets ds WHERE ds.id = e.dataset_id;

    -- the trash/move clock: displaced pauses, an hour displaced halts forever
    IF d.trashed_at IS NOT NULL OR d.project_id <> e.project_id THEN
      IF e.displaced_at IS NULL THEN
        UPDATE public.audit_exports SET displaced_at = clock_timestamp() WHERE id = e.id;
      ELSIF e.displaced_at < now() - interval '1 hour' THEN
        UPDATE public.audit_exports SET halted_at = clock_timestamp() WHERE id = e.id;
      END IF;
      CONTINUE;
    ELSIF e.displaced_at IS NOT NULL THEN
      UPDATE public.audit_exports SET displaced_at = NULL WHERE id = e.id;
    END IF;

    SELECT count(*), max(a.time) INTO v_n, v_high
      FROM public.audit_events a
     WHERE a.org_id = e.organization_id AND a.time > e.exported_through;
    CONTINUE WHEN v_n = 0;  -- no empty append transactions in audit.3

    INSERT INTO public.dataset_transactions
      (dataset_id, branch_id, txn_type, parent_transaction_id)
    SELECT e.dataset_id, e.branch_id, 'APPEND', b.head_transaction_id
      FROM public.dataset_branches b WHERE b.id = e.branch_id
    RETURNING id INTO v_txn;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (e.dataset_id, v_txn,
            'audit-' || to_char(clock_timestamp(), 'YYYYMMDD"T"HH24MISSMS') || '.log', v_n)
    RETURNING id INTO v_file;

    v_phys := d.physical_table;
    EXECUTE format($i$
      INSERT INTO datasets.%I
        (_file, categories, entities, environment, "eventId", host, "logEntryId",
         name, "orgId", origin, origins, product, "producerType", "productVersion",
         "requestFields", result, "resultFields", "sequenceId", service, sid,
         "sourceOrigin", stack, time, "tokenId", "traceId", uid, "userAgent",
         users, date)
      SELECT $1, a.categories,
             (SELECT coalesce(array_agg(x), '{}') FROM jsonb_array_elements_text(a.entities) x),
             a.environment, a.event_id::text, a.host,
             a.log_entry_id::text, a.name, a.org_id::text, a.origin, a.origins,
             a.product, a.producer_type, a.product_version, a.request_fields,
             a.result, a.result_fields, a.sequence_id::text, a.service, a.sid,
             a.source_origin, a.stack, a.time, a.token_id, a.trace_id,
             a.uid::text, a.user_agent,
             (SELECT coalesce(array_agg(u), '{}') FROM jsonb_array_elements(a.users) u),
             a.time::date
        FROM public.audit_events a
       WHERE a.org_id = $2 AND a.time > $3 AND a.time <= $4
       ORDER BY a.time$i$, v_phys)
    USING v_file, e.organization_id, e.exported_through, v_high;

    UPDATE public.dataset_transactions
       SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = v_txn;
    UPDATE public.audit_exports SET exported_through = v_high WHERE id = e.id;
    v_total := v_total + v_n;

    -- retention by the transaction timestamp, never the log's own
    IF e.retention_days IS NOT NULL THEN
      DELETE FROM public.dataset_files f
       USING public.dataset_transactions t
       WHERE f.transaction_id = t.id AND t.dataset_id = e.dataset_id
         AND t.committed_at < now() - make_interval(days => e.retention_days);
    END IF;
  END LOOP;
  RETURN v_total;
END $$;

COMMENT ON FUNCTION public.run_audit_exports() IS
  'The audit-export service: appends new attributed lines to every live export as one transaction carrying one log file, honours the trash/move grace hour, and applies each export''s own retention by transaction timestamp. SECURITY DEFINER on 553''s ledger-helper shape: the runner holds EXECUTE and no table grant.';

REVOKE ALL ON FUNCTION public.run_audit_exports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_audit_exports() TO beacon_runner;

SELECT cron.schedule('beacon-audit-export', '*/15 * * * *',
  'SET ROLE beacon_runner; SELECT public.run_audit_exports();');

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
-- An org admin creates an export, a producer writes real audit lines, the
-- runner fills the dataset, a second run appends nothing, and the refusals
-- refuse: audit.2, a non-admin, a halted export un-halted.
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_usr uuid; v_email text;
  v_grp uuid; v_ds uuid; v_phys text; v_n int; v_txns int; v_ok boolean;
  v_member uuid;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe647') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe647') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe647', 'Probe647') RETURNING id INTO v_proj;
    v_usr := gen_random_uuid();
    v_email := 'probe647-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    -- claims first: a write with no caller is unattributed and correctly
    -- never reaches a per-organization export
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);

    -- audit.2 refuses by name
    v_ok := false;
    BEGIN
      PERFORM public.create_audit_export(v_org, v_proj, 'probe647x', 'X',
        NULL, NULL, 'audit.2');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%LogTypeNotSupported%' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'audit.2 was accepted for export'; END IF;

    SELECT public.create_audit_export(v_org, v_proj, 'probe647audit', 'Audit logs')
      INTO v_ds;
    SELECT ds.physical_table INTO v_phys FROM public.datasets ds WHERE ds.id = v_ds;
    IF v_phys IS NULL THEN
      RAISE EXCEPTION 'the export dataset was not materialized';
    END IF;

    -- real lines through a real producer (645's managementGroups path), and
    -- the project_role_grants line from the fixture above is attributed too
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe 647', 'internal') RETURNING id INTO v_grp;
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_grp, v_usr);

    SET LOCAL ROLE beacon_runner;
    v_n := public.run_audit_exports();
    RESET ROLE;
    IF v_n < 2 THEN
      RAISE EXCEPTION 'the run exported % line(s); the fixture produced at least 2', v_n;
    END IF;
    EXECUTE format('SELECT count(*) FROM datasets.%I', v_phys) INTO v_n;
    IF v_n < 2 THEN
      RAISE EXCEPTION 'the dataset holds % row(s) after the run', v_n;
    END IF;
    EXECUTE format($q$SELECT count(*) FROM datasets.%I
       WHERE categories @> ARRAY['managementGroups'] AND uid = %L AND date = current_date$q$,
      v_phys, v_usr::text) INTO v_n;
    IF v_n < 1 THEN
      RAISE EXCEPTION 'the membership line did not reach the dataset with its analyst columns';
    END IF;

    -- a second run with nothing new appends no transaction
    SELECT count(*) INTO v_txns FROM public.dataset_transactions WHERE dataset_id = v_ds;
    SET LOCAL ROLE beacon_runner;
    v_n := public.run_audit_exports();
    RESET ROLE;
    SELECT count(*) - v_txns INTO v_n FROM public.dataset_transactions WHERE dataset_id = v_ds;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'an empty run appended % transaction(s)', v_n;
    END IF;

    -- a non-admin of the organization is refused
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    v_ok := false;
    BEGIN
      PERFORM public.create_audit_export(v_org, v_proj, 'probe647y', 'Y');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%AuditExport:NotAuthorized%' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a member created an audit export'; END IF;

    -- halted is forever
    UPDATE public.audit_exports SET halted_at = clock_timestamp() WHERE dataset_id = v_ds;
    v_ok := false;
    BEGIN
      UPDATE public.audit_exports SET halted_at = NULL WHERE dataset_id = v_ds;
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%CannotRestart%' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a halted export was restarted'; END IF;

    IF NOT EXISTS (SELECT 1 FROM cron.job
                    WHERE command ~ 'run_audit_exports' AND active) THEN
      RAISE EXCEPTION 'the export job is not on the scheduler';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '647 proved: an org admin''s export filled from real producer lines with analyst columns, an empty run appended nothing, and audit.2, a member, and a restart each refused';
  END;
END $$;
