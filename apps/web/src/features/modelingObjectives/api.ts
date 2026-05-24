// Modeling Objectives runtime API — reads/writes against model_releases,
// model_deployments, model_eval_runs. Adapter/objective metadata is code-level
// (see packages/reality-graph/src/objectives/*).

import { supabase } from '@/lib/supabase/client'

export type ReleaseStage   = 'sandbox' | 'staging' | 'production'
export type DeploymentKind = 'live' | 'batch'
export type DeploymentStatus = 'starting' | 'running' | 'failed' | 'stopped'

export interface EvalRunRow {
  id:                 string
  organization_id:    string | null
  objective_name:     string
  adapter_name:       string
  adapter_version:    string
  dataset:            string
  metric:             string
  value:              number
  subset:             string
  case_count:         number
  triggered_by_user_id: string | null
  run_at:             string
}

export interface ReleaseRow {
  id:                  string
  organization_id:     string | null
  objective_name:      string
  adapter_name:        string
  adapter_version:     string
  stage:               ReleaseStage
  tag:                 string
  compatibility_passed: boolean
  released_by_user_id: string | null
  released_at:         string
}

export interface DeploymentRow {
  id:                string
  organization_id:   string | null
  release_id:        string
  kind:              DeploymentKind
  status:            DeploymentStatus
  resource_profile:  string
  started_at:        string
  last_health_check: string
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function fetchEvalRuns(objectiveName: string, organizationId: string | null): Promise<EvalRunRow[]> {
  let q = supabase
    .from('model_eval_runs')
    .select('*')
    .eq('objective_name', objectiveName)
    .order('run_at', { ascending: false })
    .limit(200)
  if (organizationId) q = q.eq('organization_id', organizationId)
  const { data, error } = await q.overrideTypes<EvalRunRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchReleases(objectiveName: string, organizationId: string | null): Promise<ReleaseRow[]> {
  let q = supabase
    .from('model_releases')
    .select('*')
    .eq('objective_name', objectiveName)
    .order('released_at', { ascending: false })
  if (organizationId) q = q.eq('organization_id', organizationId)
  const { data, error } = await q.overrideTypes<ReleaseRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchDeployments(organizationId: string | null): Promise<DeploymentRow[]> {
  let q = supabase
    .from('model_deployments')
    .select('*')
    .order('started_at', { ascending: false })
  if (organizationId) q = q.eq('organization_id', organizationId)
  const { data, error } = await q.overrideTypes<DeploymentRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchDeployment(id: string): Promise<DeploymentRow | null> {
  const { data, error } = await supabase
    .from('model_deployments')
    .select('*')
    .eq('id', id)
    .maybeSingle<DeploymentRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchRelease(id: string): Promise<ReleaseRow | null> {
  const { data, error } = await supabase
    .from('model_releases')
    .select('*')
    .eq('id', id)
    .maybeSingle<ReleaseRow>()
  if (error) throw new Error(error.message)
  return data
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export interface CreateReleaseInput {
  organizationId:  string | null
  objectiveName:   string
  adapterName:     string
  adapterVersion:  string
  stage:           ReleaseStage
  tag:             string
  releasedByUserId: string | null
}

export async function createRelease(input: CreateReleaseInput): Promise<ReleaseRow> {
  // Upsert: only one active release per (org, objective, stage).
  const { data, error } = await supabase
    .from('model_releases')
    .upsert(
      {
        organization_id:      input.organizationId,
        objective_name:       input.objectiveName,
        adapter_name:         input.adapterName,
        adapter_version:      input.adapterVersion,
        stage:                input.stage,
        tag:                  input.tag,
        compatibility_passed: true,
        released_by_user_id:  input.releasedByUserId,
        released_at:          new Date().toISOString(),
      },
      { onConflict: 'organization_id,objective_name,stage' },
    )
    .select('*')
    .single<ReleaseRow>()
  if (error) throw new Error(error.message)
  return data
}

export interface CreateDeploymentInput {
  organizationId:  string | null
  releaseId:       string
  kind:            DeploymentKind
  resourceProfile?: string
}

export async function createDeployment(input: CreateDeploymentInput): Promise<DeploymentRow> {
  const { data, error } = await supabase
    .from('model_deployments')
    .insert({
      organization_id:  input.organizationId,
      release_id:       input.releaseId,
      kind:             input.kind,
      status:           'running',
      resource_profile: input.resourceProfile ?? 'low-cpu-low-memory',
    })
    .select('*')
    .single<DeploymentRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function stopDeployment(deploymentId: string): Promise<void> {
  const { error } = await supabase
    .from('model_deployments')
    .update({ status: 'stopped', last_health_check: new Date().toISOString() })
    .eq('id', deploymentId)
  if (error) throw new Error(error.message)
}

export interface RecordEvalRunInput {
  organizationId:     string | null
  objectiveName:      string
  adapterName:        string
  adapterVersion:     string
  dataset:            string
  metric:             string
  value:              number
  caseCount:          number
  subset?:            string
  triggeredByUserId:  string | null
}

export async function recordEvalRun(input: RecordEvalRunInput): Promise<EvalRunRow> {
  const { data, error } = await supabase
    .from('model_eval_runs')
    .insert({
      organization_id:      input.organizationId,
      objective_name:       input.objectiveName,
      adapter_name:         input.adapterName,
      adapter_version:      input.adapterVersion,
      dataset:              input.dataset,
      metric:               input.metric,
      value:                input.value,
      case_count:           input.caseCount,
      subset:               input.subset ?? 'overall',
      triggered_by_user_id: input.triggeredByUserId,
    })
    .select('*')
    .single<EvalRunRow>()
  if (error) throw new Error(error.message)
  return data
}
