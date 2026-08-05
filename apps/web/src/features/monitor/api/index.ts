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

export interface AgentCycleHotelOutcome {
  hotelId:      string
  scanned:      number
  autoExecuted: number
  queued:       number
}

export interface AgentCycleRun {
  ran_at:        string
  auto_executed: number
  queued:        number
  hotels:        AgentCycleHotelOutcome[]
}

export interface AgentCycleHistory {
  evaluated_at: string
  runs:         AgentCycleRun[]
}

export async function fetchAgentCycleHistory(limit = 5): Promise<AgentCycleHistory> {
  const result = await supabase.rpc('get_agent_cycle_history', { p_limit: limit }) as unknown as {
    data: AgentCycleHistory | null
    error: { message: string; code?: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Error('Empty agent cycle history')
  return result.data
}

// ── Adoption — is anyone driving ─────────────────────────────────────────────
// The Flywheel answers "is it getting better". This answers whether operators
// are USING it, which for a product about operators authoring the system is the
// blind spot that matters more. Counts and shares, never a composite score: an
// index would hide exactly the thing worth seeing — decisions concentrated in
// one person, or a property gone quiet.

