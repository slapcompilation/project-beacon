// Builds — "the mechanism used to compute new versions of datasets"
// (data-integration/builds). The database owns the engine (493); these hooks
// carry JobSpecs, the two ledgers, and the run.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { runWithCheckpoint } from '@/features/checkpoints/gate'
import { client } from '@/lib/supabase/ontologyClient'
import { jobSpecFresh, runBuild } from '@beacon/platform'
import type { Json } from '@beacon/platform'

export interface JobSpec {
  id: string
  outputDatasetId: string
  logicSql: string
  version: number
  publishedAt: string
}

export interface Build {
  id: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ABORTED'
  force: boolean
  startedAt: string
  finishedAt: string | null
}

export interface BuildJob {
  id: string
  outputDatasetId: string
  outputDatasetName: string
  state: string
  error: string | null
  startedAt: string | null
  finishedAt: string | null
}

const keys = {
  spec: (ds: string) => ['job-spec', ds] as const,
  fresh: (ds: string) => ['job-spec-fresh', ds] as const,
  builds: ['builds'] as const,
  jobs: (b: string) => ['build-jobs', b] as const,
  inputs: (ds: string) => ['dataset-inputs', ds] as const,
}

export function useJobSpec(datasetId: string | null) {
  return useQuery({
    queryKey: keys.spec(datasetId ?? ''),
    enabled: !!datasetId,
    queryFn: async (): Promise<JobSpec | null> => {
      const { data, error } = await supabase.from('job_specs')
        .select('id, output_dataset_id, logic_sql, version, published_at')
        .eq('output_dataset_id', datasetId ?? '').maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return null
      const r = data as { id: string; output_dataset_id: string; logic_sql: string; version: number; published_at: string }
      return { id: r.id, outputDatasetId: r.output_dataset_id, logicSql: r.logic_sql, version: r.version, publishedAt: r.published_at }
    },
  })
}

/** "If an output dataset is fresh, it will not be recomputed." */
export function useJobSpecFresh(specId: string | null) {
  return useQuery({
    queryKey: keys.fresh(specId ?? ''),
    enabled: !!specId,
    queryFn: async () => client(jobSpecFresh).executeFunction({ p_spec: specId as string }),
    staleTime: 10_000,
  })
}

export function useDatasetInputs(datasetId: string | null) {
  return useQuery({
    queryKey: keys.inputs(datasetId ?? ''),
    enabled: !!datasetId,
    queryFn: async () => {
      const { data, error } = await supabase.from('dataset_inputs')
        .select('input_dataset_id, datasets!dataset_inputs_input_dataset_id_fkey(name, api_name)')
        .eq('dataset_id', datasetId ?? '')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        input_dataset_id: string; datasets: { name: string; api_name: string } | null
      }[]).map((r) => ({
        inputDatasetId: r.input_dataset_id,
        name: r.datasets?.name ?? '', apiName: r.datasets?.api_name ?? '',
      }))
    },
  })
}

export function useAddDatasetInput(datasetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inputDatasetId: string) => {
      const { error } = await supabase.from('dataset_inputs')
        .insert({ dataset_id: datasetId, input_dataset_id: inputDatasetId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.inputs(datasetId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRemoveDatasetInput(datasetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inputDatasetId: string) => {
      const { error } = await supabase.from('dataset_inputs').delete()
        .eq('dataset_id', datasetId).eq('input_dataset_id', inputDatasetId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.inputs(datasetId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "JobSpecs are published when changes are made to data transformation
 *  logic" — an upsert IS the publication; the database bumps the version. */
export function usePublishJobSpec(datasetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (logicSql: string) => {
      const { error } = await supabase.from('job_specs')
        .upsert({ output_dataset_id: datasetId, logic_sql: logicSql },
                { onConflict: 'output_dataset_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.spec(datasetId) })
      toast.success('JobSpec published')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRunBuild() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { targets: string[]; force?: boolean; buildType?: 'single' | 'full' }) =>
      await runWithCheckpoint(async () =>
        await client(runBuild).applyAction({
          p_targets: i.targets, p_force: i.force ?? false, p_build_type: i.buildType ?? 'single',
        }) as string | null),
    onSuccess: (buildId) => {
      void qc.invalidateQueries()
      if (buildId === null) toast.info('Everything is fresh — no build was created')
      else toast.success('Build finished')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useBuilds() {
  return useQuery({
    queryKey: keys.builds,
    queryFn: async (): Promise<Build[]> => {
      const { data, error } = await supabase.from('builds')
        .select('id, status, force, started_at, finished_at')
        .order('started_at', { ascending: false }).limit(50)
      if (error) throw new Error(error.message)
      return (data as { id: string; status: Build['status']; force: boolean; started_at: string; finished_at: string | null }[])
        .map((r) => ({ id: r.id, status: r.status, force: r.force, startedAt: r.started_at, finishedAt: r.finished_at }))
    },
    staleTime: 10_000,
  })
}

export function useBuildJobs(buildId: string | null) {
  return useQuery({
    queryKey: keys.jobs(buildId ?? ''),
    enabled: !!buildId,
    queryFn: async (): Promise<BuildJob[]> => {
      const { data, error } = await supabase.from('build_jobs')
        .select('id, output_dataset_id, state, error, started_at, finished_at, datasets(name)')
        .eq('build_id', buildId ?? '')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; output_dataset_id: string; state: string; error: string | null
        started_at: string | null; finished_at: string | null; datasets: { name: string } | null
      }[]).map((r) => ({
        id: r.id, outputDatasetId: r.output_dataset_id, outputDatasetName: r.datasets?.name ?? '',
        state: r.state, error: r.error, startedAt: r.started_at, finishedAt: r.finished_at,
      }))
    },
    staleTime: 10_000,
  })
}

// ── schedules ───────────────────────────────────────────────────────────────
// "Schedules can be edited, managed, and updated in the schedule sidebar of
// the Data lineage application." (data-integration/schedules)

export interface ScheduleTrigger {
  type: 'time' | 'event' | 'and' | 'or'
  cron?: string
  timezone?: string
  event?: string
  dataset_id?: string
  schedule_id?: string
  triggers?: ScheduleTrigger[]
}

export interface Schedule {
  id: string
  name: string
  targetDatasetIds: string[]
  buildType: 'single' | 'full'
  trigger: ScheduleTrigger
  paused: boolean
  lastRunAt: string | null
}

export interface ScheduleRun {
  id: string
  ranAt: string
  outcome: 'Succeeded' | 'Ignored' | 'Failed'
  error: string | null
}

const scheduleKeys = {
  all: ['schedules'] as const,
  runs: (id: string) => ['schedule-runs', id] as const,
}

export function useSchedules() {
  return useQuery({
    queryKey: scheduleKeys.all,
    queryFn: async (): Promise<Schedule[]> => {
      const { data, error } = await supabase.from('schedules')
        .select('id, name, target_dataset_ids, build_type, trigger, paused, last_run_at')
        .order('name')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; name: string; target_dataset_ids: string[]; build_type: 'single' | 'full'
        trigger: ScheduleTrigger; paused: boolean; last_run_at: string | null
      }[]).map((r) => ({
        id: r.id, name: r.name, targetDatasetIds: r.target_dataset_ids,
        buildType: r.build_type, trigger: r.trigger, paused: r.paused, lastRunAt: r.last_run_at,
      }))
    },
    staleTime: 15_000,
  })
}

export function useScheduleRuns(scheduleId: string | null) {
  return useQuery({
    queryKey: scheduleKeys.runs(scheduleId ?? ''),
    enabled: !!scheduleId,
    queryFn: async (): Promise<ScheduleRun[]> => {
      const { data, error } = await supabase.from('schedule_runs')
        .select('id, ran_at, outcome, error')
        .eq('schedule_id', scheduleId ?? '')
        .order('ran_at', { ascending: false }).limit(20)
      if (error) throw new Error(error.message)
      return (data as { id: string; ran_at: string; outcome: ScheduleRun['outcome']; error: string | null }[])
        .map((r) => ({ id: r.id, ranAt: r.ran_at, outcome: r.outcome, error: r.error }))
    },
    staleTime: 10_000,
  })
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      name: string; targetDatasetIds: string[]
      buildType: 'single' | 'full'; trigger: ScheduleTrigger
      /** "By default, a schedule does not start a new run while another run of
       *  the same schedule is in progress. Enable this setting to allow runs to
       *  overlap." — off unless asked, which 572 attests twice. */
      allowOverlappingRuns: boolean
    }) => {
      await runWithCheckpoint(async () => {
        const { error } = await supabase.from('schedules').insert({
          name: i.name, target_dataset_ids: i.targetDatasetIds,
          build_type: i.buildType, trigger: i.trigger as unknown as Json,
          allow_overlapping_runs: i.allowOverlappingRuns,
        })
        if (error) throw new Error(error.message)
      })
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: scheduleKeys.all }); toast.success('Schedule saved') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSetSchedulePaused() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id: string; paused: boolean }) => {
      await runWithCheckpoint(async () => {
        const { error } = await supabase.from('schedules').update({ paused: i.paused }).eq('id', i.id)
        if (error) throw new Error(error.message)
      }, [{ kind: 'schedule', ref_id: i.id, name: '' }])
    },
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: scheduleKeys.all })
      toast.success(i.paused ? 'Schedule paused — observed events forgotten' : 'Schedule resumed')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await runWithCheckpoint(async () => {
        const { error } = await supabase.from('schedules').delete().eq('id', id)
        if (error) throw new Error(error.message)
      }, [{ kind: 'schedule', ref_id: id, name: '' }])
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: scheduleKeys.all }); toast.success('Schedule deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
