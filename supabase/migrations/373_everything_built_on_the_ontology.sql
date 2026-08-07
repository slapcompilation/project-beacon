-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 373 — the approximations, and the tables under them.
--
-- The test stopped being "does Foundry have this" and became "is ours built the
-- way Foundry builds it". Everything below failed the second question: it was
-- our shape for a thing Palantir ships differently, and a half-built version is
-- worse than none — it looks like a foundation and is not one.
--
-- Gone: automations, scenarios, authored agents and tools, Workshop modules and
-- app promotion, model releases/deployments/eval runs, agent releases and eval
-- case runs, document ingestion with its chunks and entities, proposals,
-- notifications, webhooks, access purposes, resource status, data sources,
-- lifecycle transitions, and the authored action types with their log.
--
-- WHAT STAYS IS THE ONTOLOGY AND WHAT IT NEEDS TO EXIST:
--   object_types, object_type_revisions, object_records, object_links,
--   link_types, ontology_interfaces, object_type_interfaces, shared_properties,
--   time_series_properties, object_sets, relationship_edges_store
--   projects + roles (Compass), tenancy (hotels, organizations, profiles,
--   users, memberships), and shape_registry, which is the guards' own table.
--
-- The collision trigger goes with the action registry it mirrored. It guarded
-- authored names against code-defined ones; there is no code-defined action and
-- no authored action type table left for it to fire on.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.refuse_shipped_action_name() CASCADE;

DO $$
DECLARE
  doomed text[] := ARRAY[
    'automations','scenarios','scenario_messages','scenario_overlay_edits',
    'user_agents','user_tools','modules','module_widgets','module_variables',
    'module_layouts','module_events','module_installations','app_promotions',
    'app_collections','agent_releases','agent_eval_case_runs','model_releases',
    'model_deployments','model_eval_runs','documents','document_chunks','entities',
    'link_mentions','proposals','notifications','webhook_endpoints','webhook_deliveries',
    'access_purposes','resource_status','system_health_events','data_sources',
    'source_dead_letters','lifecycle_transitions','lifecycle_transition_events',
    'user_action_types','user_action_log','gdpr_erasure_requests','causal_trace_logs',
    'intelligence_snapshots','copilot_conversations','copilot_messages',
    'copilot_feedback','copilot_tool_configs','ontology_proposals'
  ];
  kept text[] := ARRAY[
    'object_types','object_records','object_links','link_types','ontology_interfaces',
    'object_type_interfaces','shared_properties','time_series_properties','object_sets',
    'relationship_edges_store','projects','project_role_grants','project_resources',
    'hotels','organizations','profiles','users','user_org_memberships','shape_registry'
  ];
  t text; fn record; n int;
BEGIN
  FOREACH t IN ARRAY doomed LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TABLE public.%I CASCADE', t);
    END IF;
  END LOOP;

  FOR fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.prokind = 'f'
       AND EXISTS (
         SELECT 1 FROM unnest(doomed) d
          WHERE p.prosrc ~ ('(FROM|JOIN|INTO|UPDATE|TABLE)\s+(public\.)?' || d || '\M')
       )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.sig);
  END LOOP;

  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema='public' AND table_name = ANY(doomed);
  IF n > 0 THEN RAISE EXCEPTION 'Migration 373: % table(s) survived', n; END IF;

  FOREACH t IN ARRAY kept LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name=t) THEN
      RAISE EXCEPTION 'Migration 373: CASCADE took %, which is the ontology', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
