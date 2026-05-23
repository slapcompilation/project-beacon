import { useMutation } from '@tanstack/react-query'
import { buildRestockAdvisorAgent, type AgentRunResult } from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { makeSupabaseGraphReader } from './graphReader'
import { HeuristicLLMClient } from './heuristicLLM'

export interface RunRestockAdvisorInput {
  variantId: string
  variantName: string
  /** Free-text operator concern, e.g. "tomatoes running low". */
  prompt: string
}

export function useRestockAdvisor() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)

  return useMutation<AgentRunResult, Error, RunRestockAdvisorInput>({
    mutationFn: async (input) => {
      if (!hotelId) throw new Error('No active hotel selected')
      if (!userId)  throw new Error('Not signed in')

      const reader = makeSupabaseGraphReader()
      const llm    = new HeuristicLLMClient({ variantId: input.variantId, variantName: input.variantName })
      const agent  = buildRestockAdvisorAgent({ reader, llm })

      return agent.run({
        prompt: input.prompt,
        userId,
        scope: { hotelId },
      })
    },
  })
}
