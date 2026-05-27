// Layer: Flow/Eye — TanStack Query hooks for Reality Graph edge data
// Includes Causal Trace Engine (cross-layer graph traversal)

import { useQuery } from '@tanstack/react-query'
import { fetchVariantFlow, fetchCausalTrace, logCausalTrace } from '../api'

export const graphKeys = {
  variantFlow:  (variantId: string) => ['graph-flow', variantId] as const,
  causalTrace:  (rootType: string, rootId: string) => ['graph-trace', rootType, rootId] as const,
}

/**
 * Returns all relationship edges for a variant.
 * Enabled only when variantId is provided and the drawer/panel is open.
 */
export function useVariantFlow(variantId: string | null | undefined) {
  return useQuery({
    queryKey: graphKeys.variantFlow(variantId ?? ''),
    queryFn: () => fetchVariantFlow(variantId ?? ''),
    enabled: !!variantId,
    staleTime: 30 * 1000,
  })
}

// ─── Causal Trace ─────────────────────────────────────────────────────────────
// Enabled only when both rootType and rootId are provided (i.e., the panel is open).
// Fires logCausalTrace in the background after first successful fetch.

export type TraceRootType = 'notification' | 'variant' | 'restock_request'

export function useCausalTrace(
  rootType: TraceRootType | null,
  rootId: string | null,
  maxDepth = 6,
) {
  const key = graphKeys.causalTrace(rootType ?? '', rootId ?? '')

  return useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!rootType || !rootId) throw new Error('useCausalTrace called without root')
      const steps = await fetchCausalTrace(rootType, rootId, maxDepth)
      // Fire-and-forget log — do not await
      void logCausalTrace(rootType, rootId).catch(() => { /* best-effort */ })
      return steps
    },
    enabled: !!rootType && !!rootId,
    staleTime: 2 * 60 * 1000,   // 2 min — operational data; refresh on re-open
    gcTime:    5 * 60 * 1000,
  })
}
