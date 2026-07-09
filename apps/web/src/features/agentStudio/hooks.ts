import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export interface PromoteAgentInput {
  agentName:     string
  version:       string
  targetStage:   AgentReleaseStage
  evalPassRate?: number    // required when targetStage === 'production' (DB enforces >= 0.7)
  evalCaseCount?: number
  notes?:        string
}

/**
 * Promote (or demote) an agent to a target stage. Admin/owner only — the
 * RPC raises 42501 for other roles. The mutation invalidates the releases
 * query on success so every surface re-fetches.
 */
export function usePromoteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PromoteAgentInput): Promise<CurrentAgentRelease> => {
      const result = await supabase.rpc('promote_agent', {
        p_agent_name:      input.agentName,
        p_version:         input.version,
        p_target_stage:    input.targetStage,
        p_eval_pass_rate:  input.evalPassRate ?? null,
        p_eval_case_count: input.evalCaseCount ?? null,
        p_notes:           input.notes ?? null,
      }) as unknown as { data: CurrentAgentRelease | null; error: { message: string; code?: string } | null }
      if (result.error) throw new Error(result.error.message)
      if (!result.data) throw new Error('Empty promote_agent response')
      return result.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agent-studio', 'current-releases'] })
    },
  })
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

// ── Release history (Phase G1) ───────────────────────────────────────────────

export interface AgentReleaseHistoryRow {
  id:                  string
  organization_id:     string | null
  agent_name:          string
  version:             string
  stage:               AgentReleaseStage
  tag:                 string | null
  eval_pass_rate:      number | null
  eval_case_count:     number | null
  notes:               string | null
  released_by_user_id: string | null
  released_at:         string
  superseded_at:       string | null
  is_current:          boolean
}

/** Full chronological release timeline for one agent (oldest → newest).
 *  Backed by get_agent_release_history(). Migration 153 made promote_agent
 *  insert-only, so older rows accumulate with superseded_at set. */
export function useAgentReleaseHistory(agentName: string) {
  return useQuery({
    queryKey: ['agent-studio', 'release-history', agentName] as const,
    queryFn:  async (): Promise<AgentReleaseHistoryRow[]> => {
      const result = await supabase.rpc('get_agent_release_history', { p_agent_name: agentName }) as unknown as {
        data: AgentReleaseHistoryRow[] | null
        error: { message: string } | null
      }
      if (result.error) throw new Error(result.error.message)
      return result.data ?? []
    },
    enabled:   agentName.length > 0,
    staleTime: 60_000,
  })
}

// ── Eval runs (Phase G1) ─────────────────────────────────────────────────────

export interface EvalRunRow {
  id:               string
  objective_name:   string
  adapter_name:     string
  adapter_version:  string
  dataset:          string
  metric:           string
  value:            number
  case_count:       number
  subset:           string
  run_at:           string
  /** Per-test results; null on aggregate-only rows recorded before migration 196. */
  cases:            { name: string; passed: boolean }[] | null
}

/** Recent rows from model_eval_runs for one objective (the agent's name when
 *  the suite is co-located with an agent). The autoPersistReporter posts here
 *  from CI; missing data shows up as an empty state. */
export function useRecentEvalRuns(objectiveName: string, limit = 25) {
  return useQuery({
    queryKey: ['agent-studio', 'eval-runs', objectiveName, limit] as const,
    queryFn:  async (): Promise<EvalRunRow[]> => {
      const { data, error } = await supabase
        .from('model_eval_runs')
        .select('id, objective_name, adapter_name, adapter_version, dataset, metric, value, case_count, subset, run_at, cases')
        .eq('objective_name', objectiveName)
        .order('run_at', { ascending: false })
        .limit(limit)
        .overrideTypes<EvalRunRow[], { merge: false }>()
      if (error) throw new Error(error.message)
      return data
    },
    enabled:   objectiveName.length > 0,
    staleTime: 60_000,
  })
}

/** Latest model_eval_runs row for (objective, version), or null if none.
 *  Powers the PromoteDialog auto-fill + production submit gate (G2). */
export function useLatestEvalRun(objectiveName: string, adapterVersion: string) {
  return useQuery({
    queryKey: ['agent-studio', 'latest-eval-run', objectiveName, adapterVersion] as const,
    queryFn:  async (): Promise<EvalRunRow | null> => {
      const { data, error } = await supabase
        .from('model_eval_runs')
        .select('id, objective_name, adapter_name, adapter_version, dataset, metric, value, case_count, subset, run_at, cases')
        .eq('objective_name',  objectiveName)
        .eq('adapter_version', adapterVersion)
        .order('run_at', { ascending: false })
        .limit(1)
        .overrideTypes<EvalRunRow[], { merge: false }>()
      if (error) throw new Error(error.message)
      return data[0] ?? null
    },
    enabled:   objectiveName.length > 0 && adapterVersion.length > 0,
    staleTime: 30_000,
  })
}

/** Distinct adapter_versions seen for an objective, newest run first.
 *  Powers the diff-view version pickers. */
export function useEvalRunVersions(objectiveName: string) {
  return useQuery({
    queryKey: ['agent-studio', 'eval-versions', objectiveName] as const,
    queryFn:  async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('model_eval_runs')
        .select('adapter_version, run_at')
        .eq('objective_name', objectiveName)
        .order('run_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(error.message)
      const seen = new Set<string>()
      const out: string[] = []
      for (const row of data as { adapter_version: string }[]) {
        if (seen.has(row.adapter_version)) continue
        seen.add(row.adapter_version)
        out.push(row.adapter_version)
      }
      return out
    },
    enabled:   objectiveName.length > 0,
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
