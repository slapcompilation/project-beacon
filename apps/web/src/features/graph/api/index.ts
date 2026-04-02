// Layer: Flow/Eye — fetch graph edges from the Reality Graph
// Used by Flow Timeline (variant history), Eye Layer intelligence views,
// and the Causal Trace Engine (cross-layer graph traversal)

import { supabase } from '@/lib/supabase/client'
import type { RelationshipEdge, CausalTraceStep } from '@beacon/types'

/**
 * Fetches all relationship edges touching a specific variant.
 * Calls the get_variant_flow() RPC which returns edges where
 * the variant is either source or target, ordered by created_at DESC.
 */
export async function fetchVariantFlow(variantId: string): Promise<RelationshipEdge[]> {
  const { data, error } = (await supabase.rpc('get_variant_flow', {
    p_variant_id: variantId,
  })) as unknown as { data: RelationshipEdge[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Causal Trace Engine ──────────────────────────────────────────────────────

export async function fetchCausalTrace(
  rootType: 'notification' | 'variant' | 'restock_request',
  rootId: string,
  maxDepth = 6,
): Promise<CausalTraceStep[]> {
  const result = await supabase.rpc('get_causal_trace', {
    p_root_type: rootType,
    p_root_id:   rootId,
    p_max_depth: maxDepth,
  }) as unknown as { data: CausalTraceStep[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// Fire-and-forget — call after fetchCausalTrace succeeds to log the traversal.
// Callers should not await or block on this.
export async function logCausalTrace(rootType: string, rootId: string): Promise<void> {
  await supabase.rpc('log_causal_trace', {
    p_root_type: rootType,
    p_root_id:   rootId,
  })
}
