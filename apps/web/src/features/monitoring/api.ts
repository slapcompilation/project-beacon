// Monitoring views — the data layer for the Data Health app's Monitoring
// View tab (661-663). Reads ride RLS: a view follows its location, children
// follow the view. The evaluator is never callable from here; the heartbeat
// is the only clock, and the caller-facing writes are exactly what the
// policies admit — views/rules/conditions/subscribers for editors, and the
// three snooze columns on alerts.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { monitoringRuleTypes } from '@beacon/platform'
import { useAuthStore } from '@/stores/auth.store'

export type MonitorSeverity = 'low' | 'medium' | 'high'
export const SEVERITIES: MonitorSeverity[] = ['low', 'medium', 'high']

export interface MonitoringView {
  id: string
  name: string
  description: string
  project_id: string
  rid: string
  created_at: string
}

export interface RuleCondition {
  severity: MonitorSeverity
  threshold: number
}

export interface MonitoringRule {
  id: string
  view_id: string
  resource_type: 'schedule' | 'dataset' | 'automation'
  rule_type: string
  scope_kind: 'single' | 'folder' | 'project'
  target_id: string | null
  scope_folder_id: string | null
  scope_project_id: string | null
  time_window: string | null
  snoozed_until: string | null
  snooze_reason: string | null
  conditions: RuleCondition[]
}

export interface MonitorAlert {
  id: string
  rule_id: string
  target_id: string
  status: 'failing' | 'passing'
  severity: MonitorSeverity | null
  measured: string | null
  fired_at: string | null
  last_evaluated_at: string
  snoozed_until: string | null
  snoozed_by: string | null
  snooze_reason: string | null
  rule_type: string
  resource_type: string
}

export interface Subscriber {
  id: string
  user_id: string | null
  group_id: string | null
  min_severity: MonitorSeverity
  label: string
}

/** Presentation metadata for the five rule types — labels from the reference
 *  headings, the comparator sentence each table prints, and which unit the
 *  threshold is in. The type LIST comes from the database
 *  (monitoring_rule_types); this map only knows how to draw its members, and
 *  the CHECKs stay the guard. */
export const RULE_META: Partial<Record<string, {
  label: string
  family: 'schedule' | 'dataset' | 'automation'
  comparator: string
  unit: 'count' | 'seconds'
  windowed?: boolean
}>> = {
  consecutive_schedule_failures: {
    label: 'Consecutive schedule failures', family: 'schedule',
    comparator: 'If value is greater than or equal to', unit: 'count',
  },
  schedule_duration: {
    label: 'Schedule duration', family: 'schedule',
    comparator: 'If value is greater than or equal to', unit: 'seconds',
  },
  time_since_job_last_succeeded: {
    label: 'Time since job last succeeded', family: 'dataset',
    comparator: 'If value is greater than', unit: 'seconds',
  },
  automation_has_no_new_triggers: {
    label: 'Automation has no new triggers', family: 'automation',
    comparator: 'If value is greater than or equal to', unit: 'seconds',
  },
  automation_had_repeated_evaluation_failures_in_a_window: {
    label: 'Automation had repeated evaluation failures in a window',
    family: 'automation',
    comparator: 'If value is greater than', unit: 'count', windowed: true,
  },
}

export function useMonitoringRuleTypes() {
  return useQuery({
    queryKey: ['monitoring', 'rule-types'],
    queryFn: async () =>
      await client(monitoringRuleTypes).executeFunction({}) as unknown as string[],
  })
}

export function useMonitoringViews() {
  return useQuery({
    queryKey: ['monitoring', 'views'],
    queryFn: async (): Promise<MonitoringView[]> => {
      const { data, error } = await supabase.from('monitoring_views')
        .select('id, name, description, project_id, rid, created_at')
        .is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return data as MonitoringView[]
    },
  })
}

export function useMonitoringRules(viewId: string | null) {
  return useQuery({
    queryKey: ['monitoring', 'rules', viewId],
    enabled: viewId !== null,
    queryFn: async (): Promise<MonitoringRule[]> => {
      const { data, error } = await supabase.from('monitoring_rules')
        .select('id, view_id, resource_type, rule_type, scope_kind, target_id, '
          + 'scope_folder_id, scope_project_id, time_window, snoozed_until, snooze_reason, '
          + 'monitoring_rule_conditions(severity, threshold)')
        .eq('view_id', viewId ?? '').order('created_at')
      if (error) throw new Error(error.message)
      const rows = data as unknown as (Omit<MonitoringRule, 'conditions'>
        & { monitoring_rule_conditions: RuleCondition[] })[]
      return rows.map(({ monitoring_rule_conditions, ...r }) => ({
        ...r,
        conditions: [...monitoring_rule_conditions].sort((a, b) =>
          SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity)),
      }))
    },
  })
}

export function useMonitorAlerts(viewId: string | null) {
  return useQuery({
    queryKey: ['monitoring', 'alerts', viewId],
    enabled: viewId !== null,
    // the heartbeat is per-minute, so the list keeps itself fresh
    refetchInterval: 60_000,
    queryFn: async (): Promise<MonitorAlert[]> => {
      const { data, error } = await supabase.from('monitoring_alerts')
        .select('id, rule_id, target_id, status, severity, measured, fired_at, '
          + 'last_evaluated_at, snoozed_until, snoozed_by, snooze_reason, '
          + 'monitoring_rules!inner(view_id, rule_type, resource_type)')
        .eq('monitoring_rules.view_id', viewId ?? '')
      if (error) throw new Error(error.message)
      const rows = data as unknown as (Omit<MonitorAlert, 'rule_type' | 'resource_type'>
        & { monitoring_rules: { rule_type: string; resource_type: string } })[]
      return rows.map(({ monitoring_rules, ...a }) => ({
        ...a, rule_type: monitoring_rules.rule_type, resource_type: monitoring_rules.resource_type,
      }))
    },
  })
}

export function useSubscribers(viewId: string | null) {
  return useQuery({
    queryKey: ['monitoring', 'subscribers', viewId],
    enabled: viewId !== null,
    queryFn: async (): Promise<Subscriber[]> => {
      const { data, error } = await supabase.from('monitoring_subscribers')
        .select('id, user_id, group_id, min_severity, users(email), groups(name)')
        .eq('view_id', viewId ?? '')
      if (error) throw new Error(error.message)
      const rows = data as unknown as {
        id: string
        user_id: string | null
        group_id: string | null
        min_severity: MonitorSeverity
        users: { email: string } | { email: string }[] | null
        groups: { name: string } | { name: string }[] | null
      }[]
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
      return rows.map((r) => ({
        id: r.id, user_id: r.user_id, group_id: r.group_id, min_severity: r.min_severity,
        label: one(r.users)?.email ?? one(r.groups)?.name ?? '—',
      }))
    },
  })
}

/** Names for alert targets and scope pickers, one round trip per kind. */
export function useTargetCatalog() {
  return useQuery({
    queryKey: ['monitoring', 'targets'],
    queryFn: async () => {
      const [ds, sc, au, pr, fo] = await Promise.all([
        supabase.from('datasets').select('id, name').is('trashed_at', null).order('name'),
        supabase.from('schedules').select('id, name').order('name'),
        supabase.from('automations').select('id, display_name').order('display_name'),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('folders').select('id, name').is('trashed_at', null).order('name'),
      ])
      for (const r of [ds, sc, au, pr, fo]) if (r.error) throw new Error(r.error.message)
      const names = new Map<string, string>()
      const list = (rows: { id: string; name?: string; display_name?: string }[] | null) =>
        (rows ?? []).map((r) => {
          const label = r.name ?? r.display_name ?? r.id
          names.set(r.id, label)
          return { id: r.id, label }
        })
      return {
        names,
        dataset: list(ds.data), schedule: list(sc.data), automation: list(au.data),
        project: list(pr.data), folder: list(fo.data),
      }
    },
  })
}

/** The view's linked health checks (663), with their latest result. */
export function useViewChecks(viewId: string | null) {
  return useQuery({
    queryKey: ['monitoring', 'view-checks', viewId],
    enabled: viewId !== null,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('health_checks')
        .select('id, check_type, config, severity, paused_at, dataset_id, datasets(name), '
          + 'health_check_results(status, measured, detail, severity, reported_at)')
        .eq('monitoring_view_id', viewId ?? '')
        .order('reported_at', { referencedTable: 'health_check_results', ascending: false })
        .limit(1, { referencedTable: 'health_check_results' })
      if (error) throw new Error(error.message)
      const rows = data as unknown as {
        id: string
        check_type: string
        config: Record<string, unknown>
        severity: string
        paused_at: string | null
        dataset_id: string
        datasets: { name: string } | { name: string }[] | null
        health_check_results: {
          status: 'passed' | 'failed' | 'error'
          measured: string | null
          detail: string | null
          severity: string | null
          reported_at: string
        }[]
      }[]
      return rows.map((r) => ({
        id: r.id, check_type: r.check_type, config: r.config, severity: r.severity,
        paused_at: r.paused_at, dataset_id: r.dataset_id,
        datasetName: (Array.isArray(r.datasets) ? r.datasets[0]?.name : r.datasets?.name) ?? '—',
        latest: r.health_check_results.at(0) ?? null,
      }))
    },
  })
}

export function useUnlinkedChecks(viewId: string | null) {
  return useQuery({
    queryKey: ['monitoring', 'unlinked-checks', viewId],
    enabled: viewId !== null,
    queryFn: async () => {
      const { data, error } = await supabase.from('health_checks')
        .select('id, check_type, config, datasets(name)')
        .is('monitoring_view_id', null).not('dataset_id', 'is', null)
      if (error) throw new Error(error.message)
      const rows = data as unknown as {
        id: string
        check_type: string
        config: Record<string, unknown>
        datasets: { name: string } | { name: string }[] | null
      }[]
      return rows.map((r) => ({
        id: r.id, check_type: r.check_type, config: r.config,
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
        void qc.invalidateQueries({ queryKey: ['monitoring'] })
        toast.success(done)
      },
      onError: (e: Error) => { toast.error(e.message) },
    })
  }
}

export const useCreateView = invalidating<{ name: string; projectId: string }>(async (a) => {
  const { error } = await supabase.from('monitoring_views')
    .insert({ name: a.name, project_id: a.projectId })
  if (error) throw new Error(error.message)
}, 'Monitoring view created')

export const useAddRule = invalidating<{
  viewId: string
  resourceType: string
  ruleType: string
  scopeKind: 'single' | 'folder' | 'project'
  targetId: string | null
  scopeFolderId: string | null
  scopeProjectId: string | null
  timeWindow: string | null
  conditions: RuleCondition[]
}>(async (a) => {
  const { data, error } = await supabase.from('monitoring_rules').insert({
    view_id: a.viewId, resource_type: a.resourceType, rule_type: a.ruleType,
    scope_kind: a.scopeKind, target_id: a.targetId,
    scope_folder_id: a.scopeFolderId, scope_project_id: a.scopeProjectId,
    time_window: a.timeWindow,
  }).select('id').single()
  if (error) throw new Error(error.message)
  const ruleId = (data as { id: string }).id
  const { error: e2 } = await supabase.from('monitoring_rule_conditions')
    .insert(a.conditions.map((c) => ({ rule_id: ruleId, ...c })))
  if (e2) throw new Error(e2.message)
}, 'Monitoring rule added')

export const useDeleteRule = invalidating<{ ruleId: string }>(async (a) => {
  const { error } = await supabase.from('monitoring_rules').delete().eq('id', a.ruleId)
  if (error) throw new Error(error.message)
}, 'Rule removed')

// "any existing target-level snoozes for that rule will be replaced" — the
// clearing is 661's trigger, not ours.
export const useSnoozeRule = invalidating<{
  ruleId: string
  until: string | null
  reason: string | null
}>(async (a) => {
  const uid = useAuthStore.getState().userId
  const { error } = await supabase.from('monitoring_rules')
    .update({ snoozed_until: a.until, snoozed_by: a.until === null ? null : uid,
              snooze_reason: a.until === null ? null : a.reason })
    .eq('id', a.ruleId)
  if (error) throw new Error(error.message)
}, 'Rule updated')

export const useSnoozeAlert = invalidating<{
  alertId: string
  until: string | null
  reason: string | null
}>(async (a) => {
  const uid = useAuthStore.getState().userId
  const { error } = await supabase.from('monitoring_alerts')
    .update({ snoozed_until: a.until, snoozed_by: a.until === null ? null : uid,
              snooze_reason: a.until === null ? null : a.reason })
    .eq('id', a.alertId)
  if (error) throw new Error(error.message)
}, 'Alert updated')

export const useAddSubscriber = invalidating<{
  viewId: string
  userId: string | null
  groupId: string | null
  minSeverity: MonitorSeverity
}>(async (a) => {
  const { error } = await supabase.from('monitoring_subscribers').insert({
    view_id: a.viewId, user_id: a.userId, group_id: a.groupId, min_severity: a.minSeverity,
  })
  if (error) throw new Error(error.message)
}, 'Subscriber added')

export const useRemoveSubscriber = invalidating<{ id: string }>(async (a) => {
  const { error } = await supabase.from('monitoring_subscribers').delete().eq('id', a.id)
  if (error) throw new Error(error.message)
}, 'Subscriber removed')

export const useLinkCheck = invalidating<{ checkId: string; viewId: string | null }>(async (a) => {
  const { error } = await supabase.from('health_checks')
    .update({ monitoring_view_id: a.viewId }).eq('id', a.checkId)
  if (error) throw new Error(error.message)
}, 'Health checks updated')

export function usePrincipals() {
  return useQuery({
    queryKey: ['monitoring', 'principals'],
    queryFn: async () => {
      const [us, gs] = await Promise.all([
        supabase.from('users').select('id, email').order('email'),
        supabase.from('groups').select('id, name').order('name'),
      ])
      if (us.error) throw new Error(us.error.message)
      if (gs.error) throw new Error(gs.error.message)
      return {
        users: us.data as { id: string; email: string }[],
        groups: gs.data as { id: string; name: string }[],
      }
    },
  })
}
