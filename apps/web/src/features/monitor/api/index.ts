// Layer: Eye — Live Operations Monitor API

import { supabase } from '@/lib/supabase/client'
import type { ActivityEvent } from '@beacon/types'

export async function fetchRecentActivity(limit: number): Promise<ActivityEvent[]> {
  const result = await supabase.rpc('get_recent_activity', { p_limit: limit }) as unknown as {
    data: ActivityEvent[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Cron health (Phase A self-observability) ────────────────────────────────

export interface CronJobHealth {
  jobname:               string
  schedule:              string
  last_status:           'succeeded' | 'failed' | null
  last_run_at:           string | null
  consecutive_failures:  number
  consecutive_successes: number
  failure_rate_24h:      number
  runs_24h:              number
}

export interface CronHealthSummary {
  evaluated_at:  string
  open_critical: number
  jobs:          CronJobHealth[]
}

export async function fetchCronHealthSummary(): Promise<CronHealthSummary> {
  const result = await supabase.rpc('get_cron_health_summary') as unknown as {
    data: CronHealthSummary | null
    error: { message: string; code?: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Error('Empty health summary')
  return result.data
}
