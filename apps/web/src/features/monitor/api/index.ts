// Layer: Eye — Autonomous-loop health API
// Self-observability for our own cron jobs — surfaces in Settings.

import { supabase } from '@/lib/supabase/client'

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
