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

// ── Batch approvals (A5/#336) — extracted pure so the behavior eval can grade
// it: each request is evaluated as its own APPROVE_RESTOCK (estimatedCost
// attached for threshold rules); hard violators drop out with reasons.

import { evaluateConstraints, type ConstraintRecord, type ConstraintViolation } from '../constraints/index'

export interface BatchApprovalRow {
  id: string
  variant_id?: string | null
  estimated_cost?: number | null
}

export interface BatchApprovalVerdict {
  eligible: BatchApprovalRow[]
  blocked: { row: BatchApprovalRow; violations: ConstraintViolation[] }[]
}

export function evaluateBatchApprovals(
  rows: ReadonlyArray<BatchApprovalRow>,
  constraints: ReadonlyArray<ConstraintRecord>,
  hotelId: string,
  now: Date = new Date(),
): BatchApprovalVerdict {
  const eligible: BatchApprovalRow[] = []
  const blocked: BatchApprovalVerdict['blocked'] = []
  for (const row of rows) {
    const action = {
      type: 'APPROVE_RESTOCK' as const,
      requestId: row.id,
      hotelId,
      variantId: row.variant_id ?? undefined,
      estimatedCost: row.estimated_cost ?? undefined,
    }
    const hard = hotelId && constraints.length > 0
      ? evaluateConstraints(action, constraints, { now }).filter((v) => v.severity === 'hard')
      : []
    if (hard.length > 0) blocked.push({ row, violations: hard })
    else eligible.push(row)
  }
  return { eligible, blocked }
}
