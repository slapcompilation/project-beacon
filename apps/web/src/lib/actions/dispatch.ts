// Layer: meta — used by all four layers
//
// dispatchAction — the single write path for all mutations in Beacon.
//
// Every mutation flows through here:
//   1. validateAction()    — submission criteria, throws if invalid
//   2. executeMutation()   — calls the appropriate Supabase RPC / API function
//   3. edgesForAction()    — computes semantic edges to write
//   4. writeEdges()        — inserts into relationship_edges (non-fatal on failure)
//
// This function lives in apps/web, not in packages/reality-graph, because it
// depends on the Supabase client. The pure logic (validation, edge computation)
// lives in reality-graph and is imported here.

import { supabase } from '@/lib/supabase/client'
import {
  validateAction,
  edgesForAction,
} from '@beacon/reality-graph'
import type {
  BeaconAction,
  ActionResult,
  TriggeredBy,
  RestockRequestResult,
  StockLogResult,
  ReceiveStockResult,
  RevertActionResult,
  MutationResult,
} from '@beacon/reality-graph'

// ── API functions — existing implementations, called by the executor ──────────
import {
  createRestockRequest,
  approveRestock,
  rejectRestock,
  updateRestockStatus,
  receiveRestock,
} from '@/features/restock/api'
import {
  adjustStock,
  undoStockAdjustment,
} from '@/features/inventory/api'

// ─── Context ──────────────────────────────────────────────────────────────────

export interface DispatchContext {
  hotelId: string
  actorId?: string | null
  triggeredBy?: TriggeredBy
}

// Browser-only extras that can't live in the platform-agnostic BeaconAction type
export interface DispatchExtras {
  photoFile?: File | null  // ADJUST_STOCK: uploaded before the RPC call
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function dispatchAction<T extends MutationResult = MutationResult>(
  action: BeaconAction,
  ctx: DispatchContext,
  extras?: DispatchExtras,
): Promise<ActionResult<T>> {
  const { type } = action

  // 1. Validate submission criteria
  const validation = validateAction(action)
  if (!validation.valid) {
    return { success: false, type, error: validation.errors.join('; ') }
  }

  let mutationResult: MutationResult = {}

  try {
    // 2. Execute mutation via existing API/RPC functions
    switch (action.type) {
      // ── Restock lifecycle ─────────────────────────────────────────────────

      case 'REQUEST_RESTOCK': {
        const req = await createRestockRequest(
          action.hotelId,
          action.requestorId,
          action.variantId,
          action.quantityNeeded,
          action.supplier,
          action.notes,
        )
        mutationResult = { restockId: req.id } satisfies RestockRequestResult
        break
      }

      case 'APPROVE_RESTOCK': {
        await approveRestock(action.requestId, action.notes)
        break
      }

      case 'REJECT_RESTOCK': {
        await rejectRestock(action.requestId, action.reason)
        break
      }

      case 'CANCEL_RESTOCK': {
        await updateRestockStatus(action.requestId, 'cancelled')
        break
      }

      case 'RECEIVE_STOCK': {
        const res = await receiveRestock(
          action.requestId,
          action.quantityReceived,
          action.lotNumber,
          action.notes,
          action.unitCost,
          action.expiryDate,
          action.supplierId,
        )
        mutationResult = {
          logId:      res.logId,
          fulfilled:  res.fulfilled,
          newBalance: res.newBalance,
        } satisfies ReceiveStockResult
        break
      }

      // ── Stock adjustments ─────────────────────────────────────────────────

      case 'ADJUST_STOCK': {
        const res = await adjustStock(
          action.variantId,
          action.delta,
          action.reason,
          extras?.photoFile ?? null,
          action.removalCategory,
        )
        mutationResult = { logId: res.logId } satisfies StockLogResult
        break
      }

      case 'WRITE_OFF': {
        // WRITE_OFF is a negative adjust_stock with a waste removal category
        const res = await adjustStock(
          action.variantId,
          -action.quantity,
          action.wasteReason,
          null,
          'waste',
        )
        mutationResult = { logId: res.logId } satisfies StockLogResult
        break
      }

      case 'REVERT_ACTION': {
        const res = await undoStockAdjustment(action.originalLogId)
        mutationResult = { newLogId: res.newLogId } satisfies RevertActionResult
        break
      }

      // ── Procurement ───────────────────────────────────────────────────────

      case 'UPDATE_PO_STATUS': {
        const { error } = await supabase
          .from('purchase_orders')
          .update({ status: action.status })
          .eq('id', action.poId)
        if (error) throw new Error(error.message)
        break
      }

      case 'MATCH_INVOICE': {
        const { error } = await supabase
          .from('po_invoices')
          .update({ matched: true, matched_at: new Date().toISOString() })
          .eq('id', action.invoiceId)
        if (error) throw new Error(error.message)
        break
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, type, error: message }
  }

  // 3. Compute semantic edges
  const edges = edgesForAction(action, mutationResult, {
    hotelId:     ctx.hotelId,
    actorId:     ctx.actorId,
    triggeredBy: ctx.triggeredBy ?? 'user',
  })

  // 4. Write edges — non-fatal: a failed edge write must never fail the action
  let edgesWritten = 0
  if (edges.length > 0) {
    const { error: edgeError } = await supabase
      .from('relationship_edges')
      .insert(edges)

    if (edgeError) {
      console.warn('[beacon:action] Edge write failed — graph may be stale:', edgeError.message)
    } else {
      edgesWritten = edges.length
    }
  }

  return {
    success:      true,
    type,
    data:         mutationResult as T,
    edgesWritten,
  }
}
