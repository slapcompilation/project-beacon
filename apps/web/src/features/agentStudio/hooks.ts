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
