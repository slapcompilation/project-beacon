// Machine Learning — models, objectives, and the lifecycle between them
// (699/700/701).
//
// The batch run is split where the substrate splits: SQL reads the input
// view and writes the output dataset; the adapter executes in the function
// isolate between the two, one predict call with the whole dataframe.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  createModel, publishModelVersion, createModelingObjective, submitModel,
  createRelease, markReleaseAsProduction, latestTaggedRelease,
  resolveObjectiveDeployment, resolveDirectDeployment, batchRunInput,
  recordBatchRun, submissionCheckStatus, modelStudioTrainers,
} from '@beacon/platform'

export interface Model {
  id: string
  rid: string
  projectId: string
  name: string
}

export interface ModelVersion {
  id: string
  version: number
  source: string
  artifacts: Record<string, unknown>
  api: { inputs: Record<string, unknown>; outputs: Record<string, unknown> }
  adapterVersionId: string
  createdAt: string
}

export interface Objective {
  id: string
  rid: string
  projectId: string
  name: string
  description: string
}

export interface Submission {
  id: string
  modelId: string
  modelVersionId: string
  snapshot: {
    model_name: string
    model_version: number
    artifacts: Record<string, unknown>
    adapter: { api_name: string; ontology_id: string; version: string }
  }
  archivedAt: string | null
  submittedAt: string
}

export interface Check {
  id: string
  name: string
  description: string
  metricName: string | null
  metricOp: string | null
  metricThreshold: number | null
}

export interface Review {
  id: string
  submissionId: string
  decision: string
  body: string
  createdAt: string
}

export interface Release {
  id: string
  submissionId: string
  versionLabel: string
  releaseNote: string
  createdAt: string
  promotedAt: string | null
}

export interface Deployment {
  id: string
  name: string
  deploymentType: 'batch' | 'live'
  environment: 'staging' | 'production'
  inputDatasetId: string | null
  outputDatasetId: string | null
}

export interface BatchRun {
  id: string
  deploymentId: string
  releaseId: string
  rowCount: number
  status: string
  ranAt: string
}

const keys = {
  models: ['ml-models'] as const,
  model: (id: string) => ['ml-model', id] as const,
  objectives: ['ml-objectives'] as const,
  objective: (id: string) => ['ml-objective', id] as const,
}

export function useModels() {
  return useQuery({
    queryKey: keys.models,
    staleTime: 30_000,
    queryFn: async (): Promise<Model[]> => {
      const { data, error } = await supabase.from('models')
        .select('id, rid, project_id, name').is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as { id: string; rid: string; project_id: string; name: string }[])
        .map((r) => ({ id: r.id, rid: r.rid, projectId: r.project_id, name: r.name }))
    },
  })
}

export interface ModelContents {
  versions: ModelVersion[]
  directDeploymentId: string | null
}

export function useModelContents(id: string | null) {
  return useQuery({
    queryKey: keys.model(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<ModelContents> => {
      const [vs, dd] = await Promise.all([
        supabase.from('model_versions')
          .select('id, version, source, artifacts, api, adapter_version_id, created_at')
          .eq('model_id', id ?? '').order('version', { ascending: false }),
        supabase.from('model_direct_deployments').select('id').eq('model_id', id ?? ''),
      ])
      if (vs.error) throw new Error(vs.error.message)
      if (dd.error) throw new Error(dd.error.message)
      return {
        versions: (vs.data as {
          id: string; version: number; source: string
          artifacts: Record<string, unknown>
          api: { inputs: Record<string, unknown>; outputs: Record<string, unknown> }
          adapter_version_id: string; created_at: string
        }[]).map((r) => ({
          id: r.id, version: r.version, source: r.source, artifacts: r.artifacts,
          api: r.api, adapterVersionId: r.adapter_version_id, createdAt: r.created_at,
        })),
        directDeploymentId: (dd.data as { id: string }[])[0]?.id ?? null,
      }
    },
  })
}

export function useObjectives() {
  return useQuery({
    queryKey: keys.objectives,
    staleTime: 30_000,
    queryFn: async (): Promise<Objective[]> => {
      const { data, error } = await supabase.from('modeling_objectives')
        .select('id, rid, project_id, name, description').is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; rid: string; project_id: string; name: string; description: string
      }[]).map((r) => ({
        id: r.id, rid: r.rid, projectId: r.project_id, name: r.name, description: r.description,
      }))
    },
  })
}

export interface ObjectiveContents {
  submissions: Submission[]
  checks: Check[]
  reviews: Review[]
  releases: Release[]
  deployments: Deployment[]
  runs: BatchRun[]
}

export function useObjectiveContents(id: string | null) {
  return useQuery({
    queryKey: keys.objective(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<ObjectiveContents> => {
      const [su, ch, re, de] = await Promise.all([
        supabase.from('objective_submissions')
          .select('id, model_id, model_version_id, snapshot, archived_at, submitted_at')
          .eq('objective_id', id ?? '').order('submitted_at', { ascending: false }),
        supabase.from('objective_checks')
          .select('id, name, description, metric_name, metric_op, metric_threshold')
          .eq('objective_id', id ?? '').is('archived_at', null),
        supabase.from('objective_releases')
          .select('id, submission_id, version_label, release_note, created_at, promoted_at')
          .eq('objective_id', id ?? '').order('created_at', { ascending: false }),
        supabase.from('objective_deployments')
          .select('id, name, deployment_type, environment, input_dataset_id, output_dataset_id')
          .eq('objective_id', id ?? '').order('created_at'),
      ])
      for (const r of [su, ch, re, de]) if (r.error) throw new Error(r.error.message)
      const submissions = (su.data as {
        id: string; model_id: string; model_version_id: string
        snapshot: Submission['snapshot']; archived_at: string | null; submitted_at: string
      }[]).map((r) => ({
        id: r.id, modelId: r.model_id, modelVersionId: r.model_version_id,
        snapshot: r.snapshot, archivedAt: r.archived_at, submittedAt: r.submitted_at,
      }))
      const [rv, ru] = await Promise.all([
        submissions.length === 0
          ? Promise.resolve({ data: [], error: null })
          : supabase.from('submission_reviews')
              .select('id, submission_id, decision, body, created_at')
              .in('submission_id', submissions.map((s) => s.id)),
        supabase.from('batch_deployment_runs')
          .select('id, deployment_id, release_id, row_count, status, ran_at')
          .in('deployment_id', (de.data as { id: string }[]).map((d) => d.id))
          .order('ran_at', { ascending: false }),
      ])
      if (rv.error !== null) throw new Error(rv.error.message)
      if (ru.error !== null) throw new Error(ru.error.message)
      return {
        submissions,
        checks: (ch.data as {
          id: string; name: string; description: string
          metric_name: string | null; metric_op: string | null; metric_threshold: number | null
        }[]).map((r) => ({
          id: r.id, name: r.name, description: r.description,
          metricName: r.metric_name, metricOp: r.metric_op, metricThreshold: r.metric_threshold,
        })),
        reviews: (rv.data as {
          id: string; submission_id: string; decision: string; body: string; created_at: string
        }[]).map((r) => ({
          id: r.id, submissionId: r.submission_id, decision: r.decision,
          body: r.body, createdAt: r.created_at,
        })),
        releases: (re.data as {
          id: string; submission_id: string; version_label: string; release_note: string
          created_at: string; promoted_at: string | null
        }[]).map((r) => ({
          id: r.id, submissionId: r.submission_id, versionLabel: r.version_label,
          releaseNote: r.release_note, createdAt: r.created_at, promotedAt: r.promoted_at,
        })),
        deployments: (de.data as {
          id: string; name: string; deployment_type: 'batch' | 'live'
          environment: 'staging' | 'production'
          input_dataset_id: string | null; output_dataset_id: string | null
        }[]).map((r) => ({
          id: r.id, name: r.name, deploymentType: r.deployment_type, environment: r.environment,
          inputDatasetId: r.input_dataset_id, outputDatasetId: r.output_dataset_id,
        })),
        runs: (ru.data as {
          id: string; deployment_id: string; release_id: string
          row_count: number; status: string; ran_at: string
        }[]).map((r) => ({
          id: r.id, deploymentId: r.deployment_id, releaseId: r.release_id,
          rowCount: r.row_count, status: r.status, ranAt: r.ran_at,
        })),
      }
    },
  })
}

/** The page's PASS / REJECT / PENDING (automatic) and APPROVED / PENDING
 *  (manual), computed server-side so it is always current. */
export function useCheckStatus(checkId: string, submissionId: string) {
  return useQuery({
    queryKey: ['ml-check-status', checkId, submissionId],
    queryFn: () => client(submissionCheckStatus)
      .executeFunction({ p_check: checkId, p_submission: submissionId }),
  })
}

export function useTrainers() {
  return useQuery({
    queryKey: ['ml-trainers'],
    staleTime: Infinity,
    queryFn: () => client(modelStudioTrainers).executeFunction({}),
  })
}

function invalidator(qc: ReturnType<typeof useQueryClient>, ...qks: readonly (readonly string[])[]) {
  return () => { for (const qk of qks) void qc.invalidateQueries({ queryKey: qk }) }
}

export function useCreateModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string }) =>
      client(createModel).applyAction({ p_project: i.projectId, p_name: i.name }),
    onSuccess: () => { invalidator(qc, keys.models)(); toast.success('Model created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function usePublishVersion(modelId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { artifacts: unknown; adapterVersionId: string; api?: unknown }) =>
      client(publishModelVersion).applyAction({
        p_model: modelId, p_artifacts: i.artifacts as never,
        p_adapter_version: i.adapterVersionId, p_api: (i.api ?? null) as never }),
    onSuccess: () => {
      invalidator(qc, keys.model(modelId))()
      toast.success('Version published — a direct deployment upgrades to it automatically')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useCreateObjective() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string; description: string }) =>
      client(createModelingObjective).applyAction({
        p_project: i.projectId, p_name: i.name, p_description: i.description }),
    onSuccess: () => { invalidator(qc, keys.objectives)(); toast.success('Objective created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSubmitModel(objectiveId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { modelVersionId: string }) =>
      client(submitModel).applyAction({
        p_objective: objectiveId, p_model_version: i.modelVersionId, p_metadata: {} }),
    onSuccess: () => {
      invalidator(qc, keys.objective(objectiveId))()
      toast.success('Submitted — an immutable copy of the version now sits in the objective')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

function useObjectiveMutation<T>(objectiveId: string, fn: (i: T) => Promise<void>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidator(qc, keys.objective(objectiveId))()
      void qc.invalidateQueries({ queryKey: ['ml-check-status'] })
      if (done !== undefined) toast.success(done)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useReview(objectiveId: string) {
  return useObjectiveMutation<{ submissionId: string; decision: string; body: string }>(
    objectiveId, async (i) => {
      const { data: u } = await supabase.auth.getUser()
      const { error } = await supabase.from('submission_reviews')
        .insert({ submission_id: i.submissionId, decision: i.decision, body: i.body,
                  created_by: u.user?.id })
      if (error) throw new Error(error.message)
    }, 'Review submitted')
}

export function useCreateCheck(objectiveId: string) {
  return useObjectiveMutation<{
    name: string; description: string
    metricName?: string; metricOp?: string; metricThreshold?: number; inputDatasetId?: string
  }>(objectiveId, async (i) => {
    const { error } = await supabase.from('objective_checks').insert({
      objective_id: objectiveId, name: i.name, description: i.description,
      metric_name: i.metricName ?? null, metric_op: i.metricOp ?? null,
      metric_threshold: i.metricThreshold ?? null, input_dataset_id: i.inputDatasetId ?? null,
    })
    if (error) throw new Error(error.message)
  }, 'Check added')
}

export function useCreateRelease(objectiveId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { submissionId: string; versionLabel: string; note: string }) =>
      client(createRelease).applyAction({
        p_submission: i.submissionId, p_version_label: i.versionLabel, p_note: i.note }),
    onSuccess: () => {
      invalidator(qc, keys.objective(objectiveId))()
      toast.success('Released to staging')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function usePromote(objectiveId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (releaseId: string) =>
      client(markReleaseAsProduction).applyAction({ p_release: releaseId }),
    onSuccess: () => {
      invalidator(qc, keys.objective(objectiveId))()
      toast.success('Marked as production — deployments in that environment pick it up')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useCreateDeployment(objectiveId: string) {
  return useObjectiveMutation<{
    name: string; deploymentType: 'batch' | 'live'; environment: 'staging' | 'production'
    inputDatasetId?: string; outputDatasetId?: string
  }>(objectiveId, async (i) => {
    const { error } = await supabase.from('objective_deployments').insert({
      objective_id: objectiveId, name: i.name, deployment_type: i.deploymentType,
      environment: i.environment,
      input_dataset_id: i.inputDatasetId ?? null, output_dataset_id: i.outputDatasetId ?? null,
    })
    if (error) throw new Error(error.message)
  }, 'Deployment created')
}

export function useStartDirectDeployment(modelId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('model_direct_deployments')
        .insert({ model_id: modelId, started_at: new Date().toISOString() })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidator(qc, keys.model(modelId))()
      toast.success('Direct deployment started — it follows the latest version')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

interface AdapterAddress { api_name: string; ontology_id: string; version: string }

/** One predict call in the isolate: the adapter is predict(artifacts, input)
 *  returning a JSON string — JSON.parse of the artifacts is its load() step. */
async function predict(adapter: AdapterAddress, artifacts: unknown, input: unknown):
  Promise<unknown> {
  const res = await supabase.functions.invoke<{ value: unknown }>('function-run', {
    body: {
      ontologyId: adapter.ontology_id,
      apiName: adapter.api_name,
      version: adapter.version,
      inputs: { artifacts: JSON.stringify(artifacts), input: JSON.stringify(input) },
    },
  })
  if (res.error) {
    const err = res.error as { message: string; context?: Response }
    const body = err.context ? await err.context.json()
      .then((b: unknown) => b as { error?: string; detail?: string }).catch(() => null) : null
    throw new Error(body?.error ?? err.message)
  }
  return JSON.parse(res.data?.value as string) as unknown
}

/** Live inference through a deployment: resolve the release (objective) or
 *  the latest version (direct), then one predict call. */
export function useLiveRun() {
  return useMutation({
    mutationFn: async (i: {
      kind: 'objective' | 'direct'; deploymentId: string; input: unknown
    }): Promise<unknown> => {
      const resolved: unknown = i.kind === 'objective'
        ? await client(resolveObjectiveDeployment).executeFunction({ p_deployment: i.deploymentId })
        : await client(resolveDirectDeployment).executeFunction({ p_deployment: i.deploymentId })
      const r = resolved as { artifacts: unknown; adapter: AdapterAddress }
      return predict(r.adapter, r.artifacts, i.input)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The batch loop: read the input view, one predict call with all rows,
 *  record the predictions as a committed transaction on the output dataset. */
export function useBatchRun(objectiveId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (deploymentId: string) => {
      const resolved = await client(resolveObjectiveDeployment)
        .executeFunction({ p_deployment: deploymentId }) as unknown as {
          artifacts: unknown; adapter: AdapterAddress
        }
      const inputRaw: unknown = await client(batchRunInput)
        .executeFunction({ p_deployment: deploymentId })
      const input = inputRaw as { input_transaction_id: string; rows: unknown[] }
      const out = await predict(resolved.adapter, resolved.artifacts, input.rows)
      return client(recordBatchRun).applyAction({
        p_deployment: deploymentId,
        p_input_transaction: input.input_transaction_id,
        p_output_rows: out as never,
      })
    },
    onSuccess: () => {
      invalidator(qc, keys.objective(objectiveId))()
      toast.success('Batch run complete — the output dataset has a new committed transaction')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export interface AdapterFn {
  id: string
  displayName: string
}

export interface AdapterVersion {
  id: string
  semver: string
  uniform: boolean
}

/** Candidate adapter functions for the publish picker. */
export function useAdapterFunctions() {
  return useQuery({
    queryKey: ['ml-adapter-functions'],
    staleTime: 30_000,
    queryFn: async (): Promise<AdapterFn[]> => {
      const { data, error } = await supabase.from('functions')
        .select('id, display_name').order('display_name')
      if (error) throw new Error(error.message)
      return (data as { id: string; display_name: string }[])
        .map((r) => ({ id: r.id, displayName: r.display_name }))
    },
  })
}

const UNIFORM = JSON.stringify([
  { name: 'artifacts', type: 'string', required: true },
  { name: 'input', type: 'string', required: true },
])

/** Versions of one function, flagged by whether they are the uniform
 *  predict(artifacts, input) shape publish_model_version accepts. */
export function useAdapterVersions(fnId: string | null) {
  return useQuery({
    queryKey: ['ml-adapter-versions', fnId ?? ''],
    enabled: fnId !== null,
    queryFn: async (): Promise<AdapterVersion[]> => {
      const { data, error } = await supabase.from('function_versions')
        .select('id, major, minor, patch, prerelease, signature')
        .eq('function_id', fnId ?? '')
        .order('major', { ascending: false }).order('minor', { ascending: false })
        .order('patch', { ascending: false })
      if (error) throw new Error(error.message)
      return (data as {
        id: string; major: number; minor: number; patch: number; prerelease: string | null
        signature: { parameters: unknown; returns: string }
      }[]).map((r) => ({
        id: r.id,
        semver: `${String(r.major)}.${String(r.minor)}.${String(r.patch)}`
          + (r.prerelease === null ? '' : `-${r.prerelease}`),
        uniform: JSON.stringify(r.signature.parameters) === UNIFORM
          && r.signature.returns === 'string',
      }))
    },
  })
}

/** The deployments capture's UPGRADE column: is a deployment's latest run on
 *  the release its tag currently resolves to? */
export function useLatestTagged(objectiveId: string, environment: string) {
  return useQuery({
    queryKey: ['ml-latest-tagged', objectiveId, environment],
    queryFn: () => client(latestTaggedRelease).executeFunction({
      p_objective: objectiveId, p_environment: environment }),
  })
}
