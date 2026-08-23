// Automate: fifteen functions, three tables, a cron heartbeat — and until now
// nothing on any screen.
//
// "Automate is an application for setting up business automation. You can
// define conditions and effects." — automate/getting-started
//
// Read-only in this slice. The creation wizard is five pages over
// condition-settings, effect-actions and effect-function, none of which are
// read, so nothing here writes an automation.
import { useQuery } from '@tanstack/react-query'
import { automationEffectKinds } from '@beacon/platform'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'

/** The condition grammar automation_condition_valid() enforces. */
export type ConditionKind = 'time' | 'objects_added' | 'objects_removed' | 'run_on_all'
export interface Condition {
  type: ConditionKind
  cron?: string
  crons?: string[]
  timezone?: string
  object_set_id?: string
  /** How often the object set condition is evaluated (617). Absent means
   *  daily — "We keep the default of daily evaluation". Not for time
   *  conditions, which carry their own cron above. */
  schedule?: { cron: string; timezone?: string }
}

export type RunOutcome = 'started' | 'succeeded' | 'failed' | 'skipped' | 'awaiting_retry'

export interface AutomationRun {
  id: string
  automation_id: string
  effect_id: string | null
  outcome: RunOutcome
  error: string | null
  ran_at: string
  attempt: number
  next_attempt_at: string | null
  /** Which object a per-object execution was for (630); null when the
   *  effect ran once for the whole event. */
  object_key: string | null
}

export interface AutomationEffect {
  id: string
  position: number
  kind: string
  action_type_id: string | null
  function_id: string | null
  retry_count: number | null
  retry_interval: string | null
  fallback_for: string | null
}

export interface Automation {
  id: string
  display_name: string
  description: string
  owner_id: string | null
  condition: Condition
  scope: 'user' | 'project'
  paused: boolean
  muted: boolean
  /** "Otherwise, effects execute in parallel" — parallel is the fallback
   *  whenever sequential is not configurable, so it is the default. */
  execution: 'sequential' | 'parallel'
  /** "Auto-mute this automation" — mutes when all effects fail for at least
   *  80% of the past 30 events (624). Off by default. */
  auto_mute: boolean
  expires_at: string | null
  last_run_at: string | null
  created_at: string
  automation_effects: AutomationEffect[]
}

/** The five the filter pane enumerates. All five answerable since 609 gave
 *  `muted` and `expires_at` their columns — the two #745 had to draw disabled. */
export const STATUSES = ['active', 'error', 'muted', 'paused', 'expired'] as const
export type AutomationStatus = typeof STATUSES[number]

export const STATUS_META: Record<AutomationStatus, {
  label: string; icon: string; hint: string
}> = {
  active:  { label: 'Active',  icon: 'tick-circle',
             hint: 'Evaluated on the minute hand; effects run when the condition is met.' },
  error:   { label: 'Error',   icon: 'error',
             hint: 'The most recent run failed.' },
  muted:   { label: 'Muted',   icon: 'disable',
             hint: 'The condition is still evaluated and activity is still recorded. No effects are triggered.' },
  paused:  { label: 'Paused',  icon: 'pause',
             hint: 'Scheduled and live triggers do not run.' },
  expired: { label: 'Expired', icon: 'ban-circle',
             hint: 'Past its expiration date. Blocks all execution, including manual runs.' },
}

export const CONDITION_META: Record<ConditionKind, { label: string; icon: string }> = {
  time:            { label: 'Time', icon: 'time' },
  objects_added:   { label: 'Objects added', icon: 'add-to-artifact' },
  objects_removed: { label: 'Objects removed', icon: 'remove' },
  run_on_all:      { label: 'Run on all', icon: 'layers' },
}

/** The Condition cell: the same glyph as the tile, and the condition in words.
 *  A cron is not rendered into English — "At 09:00 AM" is Foundry parsing an
 *  expression, and a half-done parser would mislabel the ones it cannot read. */
export const conditionSummary = (c: Condition): string => {
  if (c.type === 'time') {
    const list = c.crons ?? (c.cron ? [c.cron] : [])
    const zone = c.timezone ? ` · ${c.timezone}` : ''
    return list.length === 0 ? 'No schedule' : `${list.join('  ·  ')}${zone}`
  }
  if (!c.object_set_id) return 'No object set'
  // The cadence is the second half of an object set condition and the screen
  // said nothing about it until it existed.
  const cadence = c.schedule?.cron ?? '0 0 * * *'
  return `On an object set  ·  ${cadence}${c.schedule?.timezone ? ` · ${c.schedule.timezone}` : ''}`
}

/** Order follows what blocks what. Expiry "blocks all execution, including
 *  manual runs", so it outranks pause; pause stops the triggers; a muted
 *  automation still evaluates, so it is only muted once it is neither.
 *
 *  Error is the inference: no page states the derivation, and Foundry's filter
 *  treats it as an automation status while ours records `failed` on a run. */
export function statusOf(a: Automation, latest: AutomationRun | undefined): AutomationStatus {
  if (a.expires_at !== null && new Date(a.expires_at).getTime() <= Date.now()) return 'expired'
  if (a.paused) return 'paused'
  if (a.muted) return 'muted'
  if (latest?.outcome === 'failed') return 'error'
  return 'active'
}

/** Active carries prose rather than the word: "Running on schedule" in the
 *  screenshot, on a time condition. An object-set trigger is not a schedule. */
export const statusTag = (s: AutomationStatus, c: Condition): string =>
  s === 'active' ? (c.type === 'time' ? 'Running on schedule' : 'Running on changes')
    : STATUS_META[s].label

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: async (): Promise<Automation[]> => {
      const { data, error } = await supabase.from('automations')
        .select('*, automation_effects(*)').order('display_name')
      if (error) throw new Error(error.message)
      return data as Automation[]
    },
  })
}

/** Every run of every visible automation, newest first. One query rather than
 *  one per row: the list needs only the latest per automation, and the History
 *  tab needs the rest. */
/** Foundry's Event log. `history` enumerates ten types; we admit the seven
 *  this engine can actually cause (622) — the three omitted need a threshold
 *  condition or a subscriber, neither of which exists here. */
export type AutomationEventType =
  | 'automation_triggered' | 'evaluation_failed' | 'condition_edited'
  | 'paused' | 'resumed' | 'muted' | 'unmuted'

export interface AutomationEvent {
  id: string
  automation_id: string
  event_type: AutomationEventType
  occurred_at: string
  detail: string | null
  /** NULL while the event is still waiting in the execution queue (625). */
  executed_at: string | null
  /** Who pressed Execute. NULL is the scheduler. */
  requested_by: string | null
}

/** The label Foundry prints, which is not the token we store. */
export const EVENT_LABEL: Record<AutomationEventType, string> = {
  automation_triggered: 'Automation triggered',
  evaluation_failed: 'Evaluation failed',
  condition_edited: 'Condition edited',
  paused: 'Paused',
  resumed: 'Resumed',
  muted: 'Muted',
  unmuted: 'Unmuted',
}

export function useAutomationEvents() {
  return useQuery({
    queryKey: ['automation-events'],
    queryFn: async (): Promise<AutomationEvent[]> => {
      const { data, error } = await supabase.from('automation_events')
        .select('id, automation_id, event_type, occurred_at, detail, executed_at, requested_by')
        .order('occurred_at', { ascending: false }).limit(200)
      if (error) throw new Error(error.message)
      return data as AutomationEvent[]
    },
  })
}

export function useAutomationRuns() {
  return useQuery({
    queryKey: ['automation-runs'],
    queryFn: async (): Promise<AutomationRun[]> => {
      const { data, error } = await supabase.from('automation_runs')
        .select('*').order('ran_at', { ascending: false }).limit(500)
      if (error) throw new Error(error.message)
      return data as AutomationRun[]
    },
  })
}

export function useEffectKinds() {
  return useQuery({
    queryKey: ['automation-effect-kinds'],
    staleTime: Infinity,
    queryFn: () => client(automationEffectKinds).executeFunction({}),
  })
}

/** The newest run per automation, which is what the Status column reads. */
export const latestByAutomation = (runs: AutomationRun[]): Map<string, AutomationRun> => {
  const out = new Map<string, AutomationRun>()
  for (const r of runs) if (!out.has(r.automation_id)) out.set(r.automation_id, r)
  return out
}
