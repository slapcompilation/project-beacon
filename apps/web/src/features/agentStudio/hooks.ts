import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import type { ProposalRow } from '@/features/agents/proposalsApi'

export interface AgentRecentRunsSummary {
  agentName:     string
  totalRuns:     number
  pending:       number
  approved:      number
  rejected:      number
  superseded:    number
  avgConfidence: number
  lastRunAt:     string | null
  lastRunStatus: string | null
}

interface AgentRunSummaryRow {
  hotel_id:         string
  agent_name:       string
  total_runs:       number
  pending:          number
  approved:         number
  rejected:         number
  superseded:       number
  avg_confidence:   number | null
  last_run_at:      string | null
  last_run_status:  string | null
}

/** Per-agent stats hosted in the agent_run_summary view. RLS-scoped server-side. */
export function useAgentRunSummaries() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['agent-studio', 'summaries', hotelId ?? ''],
    queryFn:  async (): Promise<AgentRecentRunsSummary[]> => {
      if (!hotelId) return []
      const { data, error } = await supabase
        .from('agent_run_summary')
        .select('agent_name, total_runs, pending, approved, rejected, superseded, avg_confidence, last_run_at, last_run_status')
        .eq('hotel_id', hotelId)
        .order('agent_name')
        .overrideTypes<AgentRunSummaryRow[], { merge: false }>()
      if (error) throw new Error(error.message)
      return data.map((r) => ({
        agentName:     r.agent_name,
        totalRuns:     r.total_runs,
        pending:       r.pending,
        approved:      r.approved,
        rejected:      r.rejected,
        superseded:    r.superseded,
        avgConfidence: r.avg_confidence ?? 0,
        lastRunAt:     r.last_run_at,
        lastRunStatus: r.last_run_status,
      }))
    },
    enabled:   !!hotelId,
    staleTime: 60_000,
  })
}

export type AgentReleaseStage = 'sandbox' | 'staging' | 'production'

export interface CurrentAgentRelease {
  agent_name:      string
  stage:           AgentReleaseStage
  version:         string
  tag:             string | null
  eval_pass_rate:  number | null
  eval_case_count: number | null
  released_at:     string
  notes:           string | null
}

/**
 * Current active release per (agent, stage), scoped to caller's org with the
 * NULL-org rows as a global fallback. Backed by `get_current_agent_releases()`.
 * The DB ledger is the source of truth; the static `releaseStage` in the agent
 * registry is a default only.
 */
export function useCurrentAgentReleases() {
  return useQuery({
    queryKey: ['agent-studio', 'current-releases'] as const,
    queryFn:  async (): Promise<CurrentAgentRelease[]> => {
      const result = await supabase.rpc('get_current_agent_releases') as unknown as {
        data: CurrentAgentRelease[] | null
        error: { message: string } | null
      }
      if (result.error) throw new Error(result.error.message)
      return result.data ?? []
    },
    staleTime: 5 * 60_000,  // releases change infrequently
  })
}

/**
 * Find the production-stage release for an agent if any. Lets the UI prefer
 * the DB-backed stage over the registry's static value.
 */
export function pickProductionRelease(releases: CurrentAgentRelease[], agentName: string): CurrentAgentRelease | undefined {
  return releases.find((r) => r.agent_name === agentName && r.stage === 'production')
}

/**
 * The highest stage an agent has been promoted to ('production' > 'staging' > 'sandbox').
 * Returns undefined if the agent has no DB releases at all (caller falls back to the registry static).
 */
export function highestStageFor(releases: CurrentAgentRelease[], agentName: string): CurrentAgentRelease | undefined {
  const rows = releases.filter((r) => r.agent_name === agentName)
  if (rows.length === 0) return undefined
  const order: Record<AgentReleaseStage, number> = { production: 3, staging: 2, sandbox: 1 }
  return rows.slice().sort((a, b) => order[b.stage] - order[a.stage])[0]
}

/** Last N proposals for one agent. */
export function useRecentProposalsForAgent(agentName: string, limit = 10) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['agent-studio', 'recent', hotelId ?? '', agentName, limit],
    queryFn:  async (): Promise<ProposalRow[]> => {
      if (!hotelId) return []
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('agent_name', agentName)
        .order('created_at', { ascending: false })
        .limit(limit)
        .overrideTypes<ProposalRow[], { merge: false }>()
      if (error) throw new Error(error.message)
      return data
    },
    enabled:   !!hotelId,
    staleTime: 30_000,
  })
}
