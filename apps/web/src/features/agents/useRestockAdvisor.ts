import { useMutation } from '@tanstack/react-query'
import { buildRestockAdvisorAgent, type AgentProposal, type AgentRunResult } from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { makeSupabaseGraphReader } from './graphReader'
import { HeuristicLLMClient } from './heuristicLLM'
import { createProposal, decideProposal, type ProposalRow } from './proposalsApi'

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

export function useRestockAdvisor() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)

  return useMutation<RunRestockAdvisorResult, Error, RunRestockAdvisorInput>({
    mutationFn: async (input) => {
      if (!hotelId) throw new Error('No active hotel selected')
      if (!userId)  throw new Error('Not signed in')

      const reader = makeSupabaseGraphReader()
      const llm    = new HeuristicLLMClient({ variantId: input.variantId, variantName: input.variantName })
      const agent  = buildRestockAdvisorAgent({ reader, llm })

      const promptWithRefinement = input.refinement
        ? `${input.prompt}\n\n[Refinement note from operator]: ${input.refinement.note}`
        : input.prompt

      const run = await agent.run({
        prompt: promptWithRefinement,
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

      return {
        proposals: persisted,
        paused: run.paused,
        trace: run.trace,
      }
    },
  })
}
