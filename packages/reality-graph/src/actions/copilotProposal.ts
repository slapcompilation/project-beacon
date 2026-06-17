// Maps a copilot tool proposal (snake_case params from the LLM) to the typed
// BeaconAction the constraint engine + dispatch read. Single source of truth:
// the copilot edge function imports this from the reality-graph bundle so its
// suggest-time guardrail (corrections #7) evaluates exactly what dispatch would.
//
// Only the fields the rules + dispatch key on are populated; the operator's
// confirm fills user/requestor context. Returns null for proposals with no
// typed action to gate (e.g. BATCH_APPROVE).

import type { BeaconAction } from './types'

export function copilotProposalToAction(
  actionType: string,
  params: Record<string, unknown>,
  hotelId: string,
): BeaconAction | null {
  const variantId = typeof params.variant_id === 'string' ? params.variant_id
    : typeof params.variantId === 'string' ? params.variantId : ''
  const qty = typeof params.quantity === 'number' ? params.quantity : 0
  const reason = typeof params.reason === 'string' ? params.reason : ''

  switch (actionType) {
    case 'REQUEST_RESTOCK':
      return { type: 'REQUEST_RESTOCK', variantId, quantityNeeded: qty, hotelId, requestorId: '' }
    case 'WRITE_OFF':
      return { type: 'WRITE_OFF', variantId, quantity: qty, wasteReason: reason, hotelId, userId: '' }
    case 'ADJUST_STOCK': {
      const delta = params.action === 'subtract' ? -qty : qty
      return { type: 'ADJUST_STOCK', variantId, delta, reason, hotelId, userId: '' }
    }
    default:
      return null
  }
}
