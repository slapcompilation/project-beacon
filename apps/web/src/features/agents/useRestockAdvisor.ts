import { useMutation } from '@tanstack/react-query'
import {
  buildRestockAdvisorAgent,
  evaluateConstraints,
  decideAutoExecution,
  DEFAULT_AUTO_EXEC_POLICY,
  orgPolicyToAutoExecPolicy,
  type AgentProposal,
  type AgentRunResult,
  type BeaconAction,
} from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import { fetchActiveConstraints, rowToConstraintRecord } from '@/features/constraints/api'
import { makeSupabaseGraphReader } from './graphReader'
import { HeuristicLLMClient } from './heuristicLLM'
import { AnthropicLLMClient } from './anthropicLLM'
import { createProposal, decideProposal, type ProposalRow } from './proposalsApi'
import { useActivePrinciples } from '@/features/principles/hooks'
import { useActiveForecastAdapter } from '@/features/modelingObjectives/activeAdapter'
import { useCurrentAgentReleases } from '@/features/agentStudio/hooks'
import { useOrgPolicy } from '@/features/mind/policy'

export interface RunRestockAdvisorInput {
  variantId: string
  variantName: string
  /** Free-text operator concern, e.g. "tomatoes running low". */
  prompt: string
  /** When refining a prior proposal, supply its id + the refinement note. */
  refinement?: {
    parentProposalId: string
    note: string
  }
}

/** Persisted proposal alongside its in-memory AgentProposal. */
export interface PersistedProposal {
  row: ProposalRow
  proposal: AgentProposal
}

export interface RunRestockAdvisorResult {
  /** Persisted proposals, in original agent-emitted order. */
  proposals: PersistedProposal[]
  /** Mirrors AgentRunResult.paused — agent may pause without proposals. */
  paused?: AgentRunResult['paused']
  trace: AgentRunResult['trace']
}

/** Flip to false to force the heuristic stub (useful for local dev without
 *  the agent-llm edge function deployed). Defaults to true. */
const USE_REAL_LLM = (import.meta.env.VITE_AGENT_USE_REAL_LLM ?? 'true') !== 'false'

export function useRestockAdvisor() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const { data: principles = [] } = useActivePrinciples()
  const forecastAdapter = useActiveForecastAdapter()
  const { data: releases = [] } = useCurrentAgentReleases()
  const { data: policyData } = useOrgPolicy()

  return useMutation<RunRestockAdvisorResult, Error, RunRestockAdvisorInput>({
    mutationFn: async (input) => {
      if (!hotelId) throw new Error('No active hotel selected')
      if (!userId)  throw new Error('Not signed in')

      const reader = makeSupabaseGraphReader()
      const llm    = USE_REAL_LLM
        ? new AnthropicLLMClient()
        : new HeuristicLLMClient({ variantId: input.variantId, variantName: input.variantName })
      const agent  = buildRestockAdvisorAgent({ reader, llm, forecastAdapter })

      const principleBlock = principles.length > 0
        ? `\n\n[Active operator principles to respect]:\n${principles.map((p) => `- ${p.body}`).join('\n')}`
        : ''
      const refinementBlock = input.refinement
        ? `\n\n[Refinement note from operator]: ${input.refinement.note}`
        : ''
      const promptWithContext = `${input.prompt}${principleBlock}${refinementBlock}`

      const run = await agent.run({
        prompt: promptWithContext,
        userId,
        scope: { hotelId },
      })

      const persisted: PersistedProposal[] = await Promise.all(
        run.proposals.map(async (p) => {
          const row = await createProposal({
            hotelId,
            agentName: agent.name,
            agentVersion: agent.version,
            proposal: p,
            createdByUserId: userId,
            parentVersionId: input.refinement?.parentProposalId,
            refinementNote: input.refinement?.note,
          })
          return { row, proposal: p }
        }),
      )

      // Mark the parent as superseded when refinement produced any new proposals.
      if (input.refinement && persisted.length > 0) {
        await decideProposal({
          proposalId: input.refinement.parentProposalId,
          status: 'superseded',
          decidedByUserId: userId,
        })
      }

      // Auto-execution: confidence × constraint criteria above per-type threshold
      // → dispatch immediately as 'ai_auto_approved' instead of waiting for the
      // operator. Skipped during refinement runs (the operator is already
      // engaged).
      if (!input.refinement) {
        const constraintRows = await safeFetchConstraints(hotelId)
        const constraintRecords = constraintRows.map(rowToConstraintRecord)
        for (let i = 0; i < persisted.length; i++) {
          const p = persisted[i]
          const violations = evaluateConstraints(p.proposal.action, constraintRecords, { now: new Date() })
          const productionReleases = releases
            .filter((r) => r.stage === 'production')
            .map((r) => ({ agentName: r.agent_name, version: r.version }))
          // Phase E2: honour the operator's saved policy; fall back to code default.
          const autoExecPolicy = policyData?.merged
            ? orgPolicyToAutoExecPolicy(policyData.merged)
            : DEFAULT_AUTO_EXEC_POLICY
          const decision = decideAutoExecution({
            action: p.proposal.action,
            confidence: p.proposal.confidence,
            violations,
            policy: autoExecPolicy,
            agent: { agentName: agent.name, agentVersion: agent.version },
            releases: { production: productionReleases },
            agentOverrides: policyData?.merged.auto_execution.agent_overrides,
          })
          if (!decision.autoExecute) continue

          try {
            const result = await dispatchAction(
              { ...p.proposal.action, triggeredBy: 'ai_auto_approved' } as BeaconAction,
              { hotelId, actorId: userId, triggeredBy: 'ai_auto_approved' },
            )
            if (!result.success) continue
            await decideProposal({
              proposalId: p.row.id,
              status: 'approved',
              decidedByUserId: userId,
            })
            persisted[i] = {
              ...p,
              row: { ...p.row, status: 'approved', decided_at: new Date().toISOString(), decided_by_user_id: userId },
            }
          } catch {
            // Don't fail the run on auto-exec error — leave proposal pending for operator.
          }
        }
      }

      return {
        proposals: persisted,
        paused: run.paused,
        trace: run.trace,
      }
    },
  })
}

async function safeFetchConstraints(hotelId: string) {
  try {
    return await fetchActiveConstraints(hotelId)
  } catch {
    return []
  }
}
