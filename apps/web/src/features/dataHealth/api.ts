// Data Health — checks on datasets, their result history, and who watches
// (659/660). Reads ride RLS: a check follows its dataset's visibility, writes
// are editor-gated. Evaluation is never callable from here — the commit
// trigger and the heartbeat are the only clocks the pages give it.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { healthCheckTypes } from '@beacon/platform'
import { useAuthStore } from '@/stores/auth.store'

export type ResultStatus = 'passed' | 'failed' | 'error'
export type WatchLevel = 'nothing' | 'all_failures' | 'only_critical'
export type Severity = 'moderate' | 'critical'

// "Nothing will never notify you of a failure, regardless of severity" —
// the page's three levels, in its order.
export const WATCH_LEVEL_LABEL: Record<WatchLevel, string> = {
  nothing: 'Nothing',
  all_failures: 'All failures',
  only_critical: 'Only critical',
}

export interface HealthResult {
  id: string
  status: ResultStatus
  measured: string | null
  detail: string | null
  severity: Severity | null
  reported_at: string
}

export interface HealthCheck {
  id: string
  dataset_id: string
  check_type: string
  config: Record<string, unknown>
  severity: Severity
  escalate: boolean
  notes: string
  refresh_interval: string | null
  paused_at: string | null
  rid: string
  /** Newest first — [0] is what the STATUS column shows. */
  results: HealthResult[]
  myWatch: WatchLevel | null
}

/** The reference's own spelling is snake_case of its table's rows, so the
 *  label is the row read back: row_count → "Row count". */
export function checkTypeLabel(t: string): string {
  const s = t.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The set the evaluator executes, asked of the database rather than restated. */
export function useCheckTypes() {
  return useQuery({
    queryKey: ['data-health', 'types'],
    queryFn: async () =>
      await client(healthCheckTypes).executeFunction({}) as unknown as string[],
  })
}

interface CheckRow {
  id: string
  dataset_id: string
  check_type: string
  config: Record<string, unknown>
  severity: Severity
  escalate: boolean
  notes: string
  refresh_interval: string | null
  paused_at: string | null
  rid: string
  health_check_results: HealthResult[]
  health_check_watchers: { user_id: string; level: WatchLevel }[]
}

const CHECK_SELECT =
  'id, dataset_id, check_type, config, severity, escalate, notes, refresh_interval, paused_at, rid, ' +
  'health_check_results(id, status, measured, detail, severity, reported_at), ' +
  'health_check_watchers(user_id, level)'

function toCheck(r: CheckRow, uid: string | null): HealthCheck {
  return {
    id: r.id, dataset_id: r.dataset_id, check_type: r.check_type, config: r.config,
    severity: r.severity, escalate: r.escalate, notes: r.notes,
    refresh_interval: r.refresh_interval, paused_at: r.paused_at, rid: r.rid,
    results: r.health_check_results,
    myWatch: r.health_check_watchers.find((w) => w.user_id === uid)?.level ?? null,
  }
}

export function useHealthChecks(datasetId: string | null) {
  const uid = useAuthStore((s) => s.userId)
  return useQuery({
    queryKey: ['data-health', 'checks', datasetId],
    enabled: datasetId !== null,
    queryFn: async (): Promise<HealthCheck[]> => {
      const { data, error } = await supabase.from('health_checks')
        .select(CHECK_SELECT)
        .eq('dataset_id', datasetId ?? '')
        .order('created_at', { ascending: true })
        .order('reported_at', { referencedTable: 'health_check_results', ascending: false })
        .limit(12, { referencedTable: 'health_check_results' })
      if (error) throw new Error(error.message)
      return (data as unknown as CheckRow[]).map((r) => toCheck(r, uid))
    },
  })
}

export interface ListedCheck extends HealthCheck {
  datasetName: string
}

/** The platform-wide listing — every check the caller can see, one latest
 *  result each; "toggle to show only the datasets that you are watching" is
 *  the page's own filter and myWatch is what it filters on. */
export function useDataHealthListing() {
  const uid = useAuthStore((s) => s.userId)
  return useQuery({
    queryKey: ['data-health', 'listing'],
    queryFn: async (): Promise<ListedCheck[]> => {
      const { data, error } = await supabase.from('health_checks')
        .select(CHECK_SELECT + ', datasets(name)')
        .not('dataset_id', 'is', null)
        .order('reported_at', { referencedTable: 'health_check_results', ascending: false })
        .limit(1, { referencedTable: 'health_check_results' })
      if (error) throw new Error(error.message)
      const rows = data as unknown as (CheckRow & { datasets: { name: string } | { name: string }[] | null })[]
      return rows.map((r) => ({
        ...toCheck(r, uid),
        datasetName: (Array.isArray(r.datasets) ? r.datasets[0]?.name : r.datasets?.name) ?? '—',
      }))
    },
  })
}

function invalidating<A>(fn: (a: A) => Promise<void>, done: string) {
  return function useIt() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: fn,
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['data-health'] })
        toast.success(done)
      },
      onError: (e: Error) => { toast.error(e.message) },
    })
  }
}

export const useAddCheck = invalidating<{
  datasetId: string
  checkType: string
  config: Record<string, unknown>
  severity: Severity
  escalate: boolean
  refreshInterval: string | null
}>(async (a) => {
  const { error } = await supabase.from('health_checks').insert({
    dataset_id: a.datasetId, check_type: a.checkType, config: a.config,
    severity: a.severity, escalate: a.escalate, refresh_interval: a.refreshInterval,
  })
  if (error) throw new Error(error.message)
}, 'Check added — it evaluates on the next update')

// "will temporarily snooze its alerts"; deleting "removes configuration and
// schedule" — the page's own pair.
export const usePauseCheck = invalidating<{ checkId: string; paused: boolean }>(async (a) => {
  const { error } = await supabase.from('health_checks')
    .update({ paused_at: a.paused ? new Date().toISOString() : null }).eq('id', a.checkId)
  if (error) throw new Error(error.message)
}, 'Check updated')

export const useDeleteCheck = invalidating<{ checkId: string }>(async (a) => {
  const { error } = await supabase.from('health_checks').delete().eq('id', a.checkId)
  if (error) throw new Error(error.message)
}, 'Check deleted')

export const useSetWatch = invalidating<{ checkId: string; level: WatchLevel | null }>(async (a) => {
  const uid = useAuthStore.getState().userId
  if (uid === null) throw new Error('Not signed in')
  if (a.level === null) {
    const { error } = await supabase.from('health_check_watchers')
      .delete().eq('check_id', a.checkId).eq('user_id', uid)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('health_check_watchers')
      .upsert({ check_id: a.checkId, user_id: uid, level: a.level }, { onConflict: 'check_id,user_id' })
    if (error) throw new Error(error.message)
  }
}, 'Watch updated')
