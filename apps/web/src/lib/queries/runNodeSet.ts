// Layer: meta — graph query execution against Supabase
//
// `runNodeSet()` is the apps/web bridge that takes a frozen `NodeSetQuery`
// from `@beacon/reality-graph` and runs it via the `get_node_set` Postgres RPC
// (migration 120). The package itself stays platform-agnostic — execution
// lives here.
//
// Returns a `BeaconResult<NodeSetEdge[]>` so callers can branch on the tagged
// failure variant (`SCOPE_DENIED`, `NOT_FOUND`, `RPC_TIMEOUT`, …) introduced
// in PR #1, instead of catching raw thrown Errors.
//
// Usage
// ─────
//
//   const query = nodeSet('variant')
//     .forIds([variantId])
//     .forHotel(hotelId)
//     .via('consumes')
//     .in()
//     .to('stock_log')
//     .build()
//
//   const result = await runNodeSet(query)
//   if (result.ok) {
//     const linkedStockLogIds = linkedIds(query, result.value)
//     // hydrate via existing feature APIs
//   } else if (result.error.code === 'SCOPE_DENIED') {
//     // route to login or show "you don't have access to this hotel" banner
//   }

import { supabase } from '@/lib/supabase/client'
import {
  err,
  mapPostgrestError,
  ok,
  type BeaconResult,
  type NodeSetEdge,
  type NodeSetQuery,
} from '@beacon/reality-graph'

interface RpcResponse {
  data:  NodeSetEdge[] | null
  error: { message: string; code?: string; details?: string; hint?: string } | null
}

export async function runNodeSet(
  query: NodeSetQuery,
): Promise<BeaconResult<NodeSetEdge[]>> {
  // Empty input → empty output, short-circuit before the round trip.
  if (query.ids.length === 0) return ok([])

  const result = (await supabase.rpc('get_node_set', {
    p_node_type:     query.nodeType,
    p_node_ids:      query.ids,
    p_hotel_id:      query.hotelId,
    p_via_edge_type: query.viaEdgeType ?? null,
    p_to_node_type:  query.toNodeType  ?? null,
    p_direction:     query.direction,
  })) as unknown as RpcResponse

  if (result.error) return err(mapPostgrestError(result.error))
  return ok(result.data ?? [])
}
