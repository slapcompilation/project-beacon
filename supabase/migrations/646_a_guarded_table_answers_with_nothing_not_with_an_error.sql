-- 645 revoked every grant on audit_events, and the platform suite refused it:
-- the audit contract says the role the product connects as must be able to
-- READ every table RLS guards, because "permission denied" from a guarded
-- table is indistinguishable from a broken policy. The suite is right and the
-- design intent survives unchanged: SELECT is granted back, and with RLS
-- enabled and ZERO policies the answer to every authenticated query is the
-- empty set — fail-closed by construction, an answer rather than an error.
--
-- What does NOT come back is any write: INSERT, UPDATE and DELETE stay
-- revoked, so the table remains append-only through the one SECURITY DEFINER
-- emitter, and the log stays effectively private until the export chunk
-- defines its readers —
--
--   "As such, audit log contents should be considered sensitive and viewed only by persons with the necessary security qualifications."
--   — security/audit-logs-overview.md
--
-- and those readers arrive with the export dataset, which is where the page
-- puts them, not as a policy on the raw table.

GRANT SELECT ON public.audit_events TO authenticated;

-- A real line exists; authenticated sees none of it, and still cannot write.
DO $$
DECLARE v_n int; v_ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.audit_events (event_id, name, categories, host, product,
      producer_type, product_version, result, request_fields)
    VALUES (gen_random_uuid(), 'PROBE_646', ARRAY['managementGroups'], 'x', 'beacon',
      'SERVER', '0', 'SUCCESS', '{"groupPatches": []}'::jsonb);

    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.audit_events WHERE name = 'PROBE_646';
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'authenticated saw % audit line(s); zero policies must mean zero rows', v_n;
    END IF;
    v_ok := false;
    BEGIN
      UPDATE public.audit_events SET result = 'X' WHERE name = 'PROBE_646';
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'authenticated can update the audit log'; END IF;
    v_ok := false;
    BEGIN
      DELETE FROM public.audit_events WHERE name = 'PROBE_646';
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'authenticated can delete from the audit log'; END IF;
    RESET ROLE;

    -- and the row is really there, so the empty answer above was RLS, not absence
    SELECT count(*) INTO v_n FROM public.audit_events WHERE name = 'PROBE_646';
    IF v_n <> 1 THEN RAISE EXCEPTION 'the planted line is missing'; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '646 proved: authenticated gets the empty set, not an error, and still cannot write';
  END;
END $$;
