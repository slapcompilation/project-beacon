import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import type { ProposalRow } from '@/features/agents/proposalsApi'

export interface AgentRecentRunsSummary {
  agentName:   string
  totalRuns:   number
  pending:     number
  approved:    number
  rejected:    number
  superseded:  number
  avgConfidence: number
}

/** Aggregate counts per agent_name from the proposals table. */
export function useAgentRunSummaries() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['agent-studio', 'summaries', hotelId ?? ''],
    queryFn:  async (): Promise<AgentRecentRunsSummary[]> => {
      if (!hotelId) return []
      const { data, error } = await supabase
        .from('proposals')
        .select('agent_name, status, confidence')
        .eq('hotel_id', hotelId)
        .limit(2000)
      if (error) throw new Error(error.message)
      const rows = data as Array<{ agent_name: string; status: string; confidence: number }>
      const byAgent = new Map<string, AgentRecentRunsSummary>()
      for (const r of rows) {
        let s = byAgent.get(r.agent_name)
        if (!s) {
          s = { agentName: r.agent_name, totalRuns: 0, pending: 0, approved: 0, rejected: 0, superseded: 0, avgConfidence: 0 }
          byAgent.set(r.agent_name, s)
        }
        s.totalRuns++
        if (r.status === 'pending')     s.pending++
        if (r.status === 'approved')    s.approved++
        if (r.status === 'rejected')    s.rejected++
        if (r.status === 'superseded')  s.superseded++
        s.avgConfidence += r.confidence
      }
      const out: AgentRecentRunsSummary[] = []
      byAgent.forEach((s) => {
        s.avgConfidence = s.totalRuns > 0 ? Number((s.avgConfidence / s.totalRuns).toFixed(2)) : 0
        out.push(s)
      })
      return out.sort((a, b) => a.agentName.localeCompare(b.agentName))
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
