import { useMutation } from '@tanstack/react-query'
import {
  buildWasteTriageAgent,
  type AgentProposal,
  type AgentRunResult,
} from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { makeSupabaseGraphReader } from './graphReader'
import { HeuristicLLMClient } from './heuristicLLM'
import { AnthropicLLMClient } from './anthropicLLM'
import { createProposal, decideProposal, type ProposalRow } from './proposalsApi'
import { useActivePrinciples } from '@/features/principles/hooks'
import { useActiveForecastAdapter } from '@/features/modelingObjectives/activeAdapter'

export interface RunWasteTriageInput {
  variantId:   string
  variantName: string
  prompt:      string
  refinement?: { parentProposalId: string; note: string }
}

export interface PersistedWasteProposal {
  row:      ProposalRow
  proposal: AgentProposal
}

export interface RunWasteTriageResult {
  proposals: PersistedWasteProposal[]
  paused?:   AgentRunResult['paused']
  trace:     AgentRunResult['trace']
}

const USE_REAL_LLM = (import.meta.env.VITE_AGENT_USE_REAL_LLM ?? 'true') !== 'false'

export function useWasteTriage() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const { data: principles = [] } = useActivePrinciples()
  const forecastAdapter = useActiveForecastAdapter()

  return useMutation<RunWasteTriageResult, Error, RunWasteTriageInput>({
    mutationFn: async (input) => {
      if (!hotelId) throw new Error('No active hotel selected')
      if (!userId)  throw new Error('Not signed in')

      const reader = makeSupabaseGraphReader()
      const llm    = USE_REAL_LLM
        ? new AnthropicLLMClient()
        : new HeuristicLLMClient({ variantId: input.variantId, variantName: input.variantName })
      // With the real model, let it orchestrate the tool loop (falls back to the
      // deterministic procedure on any failure). The heuristic stub can't drive
      // the loop, so it stays deterministic.
      const agent  = buildWasteTriageAgent({
        reader, llm, forecastAdapter,
        reasoning: USE_REAL_LLM ? 'llm' : 'deterministic',
      })

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
        scope:  { hotelId },
      })

      const persisted: PersistedWasteProposal[] = await Promise.all(
        run.proposals.map(async (p) => {
          const row = await createProposal({
            hotelId,
            agentName:        agent.name,
            agentVersion:     agent.version,
            proposal:         p,
            createdByUserId:  userId,
            parentVersionId:  input.refinement?.parentProposalId,
            refinementNote:   input.refinement?.note,
          })
          return { row, proposal: p }
        }),
      )

      if (input.refinement && persisted.length > 0) {
        await decideProposal({
          proposalId:      input.refinement.parentProposalId,
          status:          'superseded',
          decidedByUserId: userId,
        })
      }

      return { proposals: persisted, paused: run.paused, trace: run.trace }
    },
  })
}
