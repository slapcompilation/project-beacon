// Statistical reorder point for a variant — computed through the
// compute_reorder_point Logic Tool (the sanctioned UI→tool path), so the UI
// stays free of predictive math.

import { useQuery } from '@tanstack/react-query'
import { makeComputeReorderPointTool, type ComputeReorderPointOutput } from '@beacon/reality-graph'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'

export function useReorderPoint(variantId: string | null, serviceLevel = 0.95) {
  return useQuery({
    queryKey: ['reorder-point', variantId ?? '', serviceLevel],
    queryFn:  async (): Promise<ComputeReorderPointOutput | null> => {
      if (!variantId) return null
      return makeComputeReorderPointTool(makeSupabaseGraphReader()).invoke({ variantId, serviceLevel })
    },
    enabled:   !!variantId,
    staleTime: 60_000,
  })
}
