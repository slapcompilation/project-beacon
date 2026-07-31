-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 273 — a data source becomes config, not code.
--
-- Audit §2.2: Foundry's source-type-overview makes a source a first-class
-- configurable object with credentials, health and lineage. Ours were nine
-- hard-coded edge functions, so adding a connector meant writing one — and a
-- client asking to stream SAP or Oracle meant shipping code before they could
-- see a single row.
--
-- WHAT THIS DELIBERATELY DOES NOT DO: extract from SAP or Oracle. That is
-- commodity — Debezium, Airbyte, Fivetran, GoldenGate, SAP SLT all do it better
-- than we would, and a pipeline engine is already a non-goal. Let a commodity
-- CDC tool land raw rows in a staging table; this registry is what turns a
-- landed table into an ontology object, and what proves nothing was lost on the
-- way.
--
--   SAP/Oracle -> [commodity CDC] -> staging table -> data_sources -> object type
--
-- The loss-prevention design is four things, none of which is "be careful":
--   • natural_key      — so a replay upserts instead of duplicating
--   • watermark_column — so a restart resumes and never skips
--   • a dead-letter table — a row that fails validation lands SOMEWHERE
--   • reconciliation counts — do not CLAIM no loss, measure it
--
-- That last one is this codebase's own lesson. The failure will not be a crash:
-- it will be a connector returning success having written nothing (D1/D2), or
-- landing rows whose parents do not exist (the 24% dangling edges). So a source
-- is only healthy when its numbers agree, not when its last call returned 200.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.data_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id          uuid REFERENCES hotels(id) ON DELETE CASCADE,   -- NULL = org-wide

  api_name          text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  label             text NOT NULL CHECK (length(btrim(label)) > 0),
  -- How rows arrive. `cdc` is a commodity tool writing into staging_table;
  -- `webhook` is a push we receive; `pull` is us polling; `file` is an upload.
  kind              text NOT NULL CHECK (kind IN ('cdc','webhook','pull','file')),
  system            text NOT NULL DEFAULT '',   -- 'sap', 'oracle', 'mews', 'square'

  -- Where rows land, untouched, before anything interprets them.
  staging_table     text NOT NULL,
  -- The column that makes a row identifiable, so a replay upserts rather than
  -- duplicates. At-least-once plus idempotency beats chasing exactly-once.
  natural_key       text NOT NULL,
  -- Position resumed from: an Oracle SCN, a SAP change pointer, a timestamp.
  watermark_column  text,
  watermark_value   text,

  -- What the landed rows become. NULL until somebody ontologizes them, which is
  -- the honest state for a source that is landing data nobody has modelled yet.
  object_type_id    uuid REFERENCES object_types(id) ON DELETE SET NULL,

  enabled           boolean NOT NULL DEFAULT true,
  last_run_at       timestamptz,
  last_error        text,

  created_by_user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, api_name)
);

COMMENT ON TABLE public.data_sources IS
  'A source as configuration rather than an edge function. Registers where rows land, what identifies them, where to resume, and what they become. Extraction from SAP/Oracle is deliberately somebody else''s job — this is the part that makes landed rows ontology.';
COMMENT ON COLUMN public.data_sources.natural_key IS
  'The column that identifies a row at the source. Replay upserts on it instead of duplicating — at-least-once plus idempotency, rather than pretending exactly-once is achievable across two systems.';
COMMENT ON COLUMN public.data_sources.watermark_value IS
  'Last position successfully ingested. A restart resumes here, so a crash costs a re-read and never a gap.';

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read sources in scope" ON public.data_sources;
CREATE POLICY "members read sources in scope" ON public.data_sources
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

DROP POLICY IF EXISTS "admins configure sources" ON public.data_sources;
CREATE POLICY "admins configure sources" ON public.data_sources
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

-- ── Dead letters — a rejected row lands somewhere ────────────────────────────
-- D2's lesson as a table: the ingest gate reported success while writing
-- nothing. A row that fails validation must be recoverable, not absent.

CREATE TABLE IF NOT EXISTS public.source_dead_letters (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  payload        jsonb NOT NULL,
  reason         text NOT NULL,
  watermark      text,
  received_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dead_letters_open
  ON public.source_dead_letters (source_id, received_at DESC) WHERE resolved_at IS NULL;

COMMENT ON TABLE public.source_dead_letters IS
  'Rows a source could not land, kept with the reason and the watermark they arrived at. A dropped row that nobody can name is indistinguishable from a row that never existed.';

ALTER TABLE public.source_dead_letters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read dead letters in scope" ON public.source_dead_letters;
CREATE POLICY "members read dead letters in scope" ON public.source_dead_letters
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM data_sources s WHERE s.id = source_id
                 AND s.organization_id IS NOT DISTINCT FROM auth_org_id()));

-- ── Reconciliation: measure the loss, do not promise its absence ─────────────

CREATE OR REPLACE FUNCTION public.source_reconciliation()
RETURNS TABLE (api_name text, label text, staging_rows bigint, landed_rows bigint,
               dead_letters bigint, ontologized boolean, verdict text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE s record; n_stage bigint; n_land bigint; n_dead bigint;
BEGIN
  FOR s IN SELECT d.*, t.source_table AS target_table FROM data_sources d
           LEFT JOIN object_types t ON t.id = d.object_type_id
           WHERE d.enabled ORDER BY d.api_name
  LOOP
    n_stage := NULL; n_land := NULL;
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', s.staging_table) INTO n_stage;
    EXCEPTION WHEN undefined_table THEN n_stage := NULL;
    END;
    IF s.target_table IS NOT NULL THEN
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I', s.target_table) INTO n_land;
      EXCEPTION WHEN undefined_table THEN n_land := NULL;
      END;
    END IF;
    SELECT count(*) INTO n_dead FROM source_dead_letters dl
     WHERE dl.source_id = s.id AND dl.resolved_at IS NULL;

    RETURN QUERY SELECT s.api_name, s.label, n_stage, n_land, n_dead,
      (s.object_type_id IS NOT NULL),
      CASE
        WHEN n_stage IS NULL              THEN 'staging table missing'
        WHEN s.object_type_id IS NULL     THEN 'landing, not yet ontologized'
        WHEN n_dead > 0                   THEN format('%s row(s) dead-lettered', n_dead)
        WHEN n_land IS NOT NULL AND n_land < n_stage THEN format('%s staged row(s) never landed', n_stage - n_land)
        ELSE 'reconciled'
      END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.source_reconciliation() IS
  'Staged vs landed vs dead-lettered, per source. A source is healthy when its numbers agree — not when its last call returned 200. That distinction is what D1 and D2 cost us.';

COMMIT;
