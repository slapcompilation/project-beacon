// Authoring an automation — the wizard's vocabulary and its one write.
//
// The condition picker's cards. `getting-started-add-condition.png` shows
// eight and is cut off; `branching-automations` ENUMERATES the whole picker as
// five supported on a branch plus five not, so the set is TEN. The page that
// lists wins over the capture that was cropped.
//
// We support four. The other six are shown with the reason they are not
// offered, because hiding them makes the vocabulary look smaller than the page
// that enumerates it — the shape action_rule_kinds() set.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { Condition, ConditionKind } from '@/features/automate/api'

export interface ConditionCard {
  kind: string
  label: string
  blurb: string
  icon: string
  /** The `(x) …` chip: what the condition hands to its effects. We have no
   *  effect inputs at all, so it is shown and not offered. */
  exposes: string | null
  supported: boolean
  why?: string
}

/** All ten, in the order the picker lists them. */
export const CONDITION_CARDS: ConditionCard[] = [
  { kind: 'time', label: 'Time', icon: 'time', exposes: null, supported: true,
    blurb: 'Triggers when a specific time is reached. E.g., "Every Monday at 9am."' },
  { kind: 'objects_added', label: 'Objects added to set', icon: 'add-to-artifact',
    exposes: 'Added objects', supported: true,
    blurb: 'Triggers when a new object appears in a pre-defined object set.' },
  { kind: 'objects_removed', label: 'Objects removed from set', icon: 'remove',
    exposes: 'Removed objects', supported: true,
    blurb: 'Triggers when an object leaves a pre-defined object set.' },
  { kind: 'objects_modified', label: 'Objects modified in a set', icon: 'edit',
    exposes: 'Modified objects', supported: false,
    why: 'Live monitoring only, and evaluation here is scheduled on the minute hand.',
    blurb: 'Triggers when an object is modified in a pre-defined object set.' },
  { kind: 'run_on_all', label: 'Run on all objects', icon: 'layers',
    exposes: 'Objects from set', supported: true,
    blurb: 'Periodically run effects on all objects in a given set.' },
  { kind: 'metric_changed', label: 'Metric changed', icon: 'trending-up',
    exposes: null, supported: false,
    why: 'Sunset upstream, with Objects modified in set recommended instead.',
    blurb: 'Triggers when an aggregated object set metric increases or decreases.' },
  { kind: 'threshold_crossed', label: 'Threshold crossed', icon: 'horizontal-bar-chart',
    exposes: null, supported: false,
    why: 'Needs a threshold condition and a metric, neither of which the condition grammar has.',
    blurb: 'Triggers and remains in triggering state when a metric threshold is crossed.' },
  { kind: 'automation_dependency', label: 'Automation dependency', icon: 'flows',
    exposes: null, supported: false,
    why: 'Runs when a parent automation completes. No automation can depend on another here.',
    blurb: 'Evaluates when a linked automation completes.' },
  { kind: 'time_series', label: 'Time series', icon: 'timeline-line-chart',
    exposes: null, supported: false,
    why: 'time_series_properties is an orphan of the deleted product: zero rows, no surface, and no datasource kind backs a series.',
    blurb: 'Triggers when a time series threshold is crossed.' },
  { kind: 'stream', label: 'Stream', icon: 'flow-linear',
    exposes: null, supported: false,
    why: 'Beta upstream, and there is no stream datasource kind here — one_backing admits a dataset, a restricted view or a media set.',
    blurb: 'Triggers on any new records in a stream.' },
]

/** "hourly, daily, weekly, and monthly" — the builder's four, each of which is
 *  a cron with a fixed minute, which is what 613 requires. */
export type Frequency = 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface ScheduleDraft {
  frequency: Frequency
  minute: number
  hour: number
  /** 0 = Sunday, matching the cron field. */
  weekday: number
  dayOfMonth: number
}

export const EMPTY_SCHEDULE: ScheduleDraft = {
  frequency: 'daily', minute: 0, hour: 9, weekday: 1, dayOfMonth: 1,
}

/** The builder writes a cron, because the advanced toggle DISABLES the builder
 *  rather than replacing the condition — one stored shape, two editing modes. */
export function scheduleToCron(s: ScheduleDraft): string {
  switch (s.frequency) {
    case 'hourly':  return `${s.minute} * * * *`
    case 'daily':   return `${s.minute} ${s.hour} * * *`
    case 'weekly':  return `${s.minute} ${s.hour} * * ${s.weekday}`
    case 'monthly': return `${s.minute} ${s.hour} ${s.dayOfMonth} * *`
  }
}

/** The rule 613 enforces, mirrored here so the wizard refuses before the
 *  database does. The database is still the one that decides. */
export const automateCronLooksValid = (cron: string): boolean => {
  const f = cron.trim().split(/\s+/)
  return f.length === 5 && /^\d{1,2}$/.test(f[0]) && Number(f[0]) <= 59
}

export interface EffectDraft {
  kind: 'action' | 'function'
  actionTypeId: string | null
}

export interface AutomationDraft {
  displayName: string
  description: string
  projectId: string
  condition: Condition
  execution: 'sequential' | 'parallel'
  scope: 'user' | 'project'
  expiresAt: string | null
  effects: EffectDraft[]
}

/** One write, in one transaction's worth of statements: the automation, then
 *  its effects. Every guard the wizard mirrors is still enforced underneath —
 *  the cron rule, the Automate consumer toggle, and sequential's two-effect
 *  rule, which is why the error surfaces rather than being pre-empted. */
export function useCreateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: AutomationDraft) => {
      const { data: me } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('automations').insert({
        project_id: d.projectId,
        display_name: d.displayName,
        description: d.description,
        owner_id: me.user?.id ?? null,
        condition: d.condition as unknown as Record<string, unknown>,
        scope: d.scope,
        expires_at: d.expiresAt,
      }).select('id').single()
      if (error) throw new Error(error.message)
      const id = (data as { id: string }).id

      const rows = d.effects
        .filter((e) => e.kind === 'action' && e.actionTypeId)
        .map((e, i) => ({ automation_id: id, position: i, kind: e.kind,
          action_type_id: e.actionTypeId }))
      if (rows.length > 0) {
        const { error: ee } = await supabase.from('automation_effects').insert(rows)
        if (ee) throw new Error(ee.message)
      }
      // Sequential is set AFTER the effects exist, because its guard counts
      // them and would refuse an automation that has none yet.
      if (d.execution === 'sequential') {
        const { error: xe } = await supabase.from('automations')
          .update({ execution: 'sequential' }).eq('id', id)
        if (xe) throw new Error(xe.message)
      }
      return id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automation created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** An object set condition carries a cadence of its own — a second schedule,
 *  separate from the Time condition, that says how often the set is checked.
 *  The wizard always writes one rather than leaning on the daily default, so
 *  what the summary shows is what the runner reads. */
export const conditionOf = (kind: string, s: ScheduleDraft, cron: string | null,
  timezone: string, objectSetId: string | null): Condition =>
  kind === 'time'
    ? { type: 'time', cron: cron ?? scheduleToCron(s), timezone }
    : { type: kind as ConditionKind, object_set_id: objectSetId ?? undefined,
        schedule: { cron: cron ?? scheduleToCron(s), timezone } }
