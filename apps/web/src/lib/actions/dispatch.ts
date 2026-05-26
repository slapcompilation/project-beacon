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
  evaluateConstraints,
  validationFailed,
  constraintRejected,
  mapPostgrestError,
} from '@beacon/reality-graph'
import { fetchActiveConstraints, rowToConstraintRecord } from '@/features/constraints/api'
import type {
  BeaconAction,
  ActionResult,
  TriggeredBy,
  SupplierCreateResult,
  RestockRequestResult,
  StockLogResult,
  ReceiveStockResult,
  RevertActionResult,
  POCreateResult,
  InvoiceSubmitResult,
  TransferApproveResult,
  PendingApprovalResult,
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
import {
  createPurchaseOrder,
  submitPOInvoice,
} from '@/features/mind/api'
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  logDeliveryEvent,
} from '@/features/suppliers/api'
import {
  createStockTransfer,
  approveStockTransfer,
} from '@/features/agents/transfersApi'
import {
  createPendingApproval,
} from '@/features/pendingApprovals/api'

// ─── Context ──────────────────────────────────────────────────────────────────

export interface DispatchContext {
  hotelId: string
  actorId?: string | null
  triggeredBy?: TriggeredBy
  organizationId?: string | null
  /** Bypass the constraint check (used when an admin approves a previously
   *  soft-rejected action — the original check already ran and the violation
   *  is being explicitly accepted). */
  skipConstraintCheck?: boolean
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
    return { success: false, type, error: validationFailed(validation.errors) }
  }

  // 1b. Evaluate constraint engine.
  //     Hard violations short-circuit the dispatch.
  //     Soft violations pause the action: a row is written to
  //     pending_action_approvals and the dispatcher returns a special
  //     `pendingApprovalId` result so the caller can surface the pause.
  //     A subsequent approval calls dispatchAction with
  //     skipConstraintCheck=true to replay the original payload.
  if (!ctx.skipConstraintCheck) {
    try {
      const rows = await fetchActiveConstraints(ctx.hotelId)
      if (rows.length > 0) {
        const violations = evaluateConstraints(
          action,
          rows.map(rowToConstraintRecord),
          { now: new Date() },
        )
        const hard = violations.filter((v) => v.severity === 'hard')
        if (hard.length > 0) {
          return {
            success: false,
            type,
            error: constraintRejected(
              hard.map((v) => ({ constraintId: v.constraintId, message: v.message, severity: v.severity })),
            ),
          }
        }

        const soft = violations.filter((v) => v.severity === 'soft')
        if (soft.length > 0 && ctx.actorId) {
          try {
            const pending = await createPendingApproval({
              hotelId:              ctx.hotelId,
              organizationId:       ctx.organizationId ?? null,
              actionType:           type,
              actionPayload:        action as unknown as Record<string, unknown>,
              violations:           soft.map((v) => ({
                constraintId: v.constraintId,
                message:      v.message,
                severity:     v.severity,
                ruleType:     v.bucket,
              })),
              originalTriggeredBy:  ctx.triggeredBy ?? 'user',
              originalActorId:      ctx.actorId,
              requestedByUserId:    ctx.actorId,
            })
            return {
              success:      true,
              type,
              data:         { pendingApprovalId: pending.id } satisfies PendingApprovalResult as unknown as T,
              edgesWritten: 0,
            }
          } catch {
            // Persistence failed — fall through to dispatch so we don't lose
            // the action; soft routing is best-effort, not a hard gate.
          }
        }
      }
    } catch {
      // Constraint fetch failed — don't block writes on the engine itself being down.
      // Surface to telemetry in a follow-up; for now fail-open keeps existing flows.
    }
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

      // ── Suppliers ─────────────────────────────────────────────────────────

      case 'CREATE_SUPPLIER': {
        const supplier = await createSupplier(action.hotelId, {
          name:         action.name,
          contact_name: action.contactName ?? null,
          email:        action.email ?? null,
          phone:        action.phone ?? null,
          notes:        action.notes ?? null,
        })
        mutationResult = { supplierId: supplier.id } satisfies SupplierCreateResult
        break
      }

      case 'UPDATE_SUPPLIER': {
        await updateSupplier(action.supplierId, {
          name:         action.name,
          contact_name: action.contactName,
          email:        action.email,
          phone:        action.phone,
          notes:        action.notes,
        })
        break
      }

      case 'DELETE_SUPPLIER': {
        await deleteSupplier(action.supplierId)
        break
      }

      case 'LOG_DELIVERY': {
        const delivery = await logDeliveryEvent(action.hotelId, {
          supplier_id:         action.supplierId,
          restock_request_id:  action.restockRequestId ?? null,
          ordered_qty:         action.orderedQty,
          received_qty:        action.receivedQty,
          expected_date:       action.expectedDate,
          actual_date:         action.actualDate ?? null,
          unit_cost_expected:  action.unitCostExpected ?? null,
          unit_cost_actual:    action.unitCostActual ?? null,
          notes:               action.notes ?? null,
        })
        mutationResult = { deliveryId: delivery.id }
        break
      }

      // ── Procurement ───────────────────────────────────────────────────────

      case 'CREATE_PO': {
        const poId = await createPurchaseOrder({
          supplierId:           action.supplierId,
          supplierName:         action.supplierName,
          poNumber:             action.poNumber,
          expectedDeliveryDate: action.expectedDeliveryDate,
          notes:                action.notes,
          lines:                action.lines,
        })
        mutationResult = { poId } satisfies POCreateResult
        break
      }

      case 'UPDATE_PO_STATUS': {
        const { error } = await supabase
          .from('purchase_orders')
          .update({ status: action.status })
          .eq('id', action.poId)
        if (error) throw new Error(error.message)
        break
      }

      case 'SUBMIT_PO_INVOICE': {
        const invoiceId = await submitPOInvoice(
          action.poId,
          action.invoiceNumber,
          action.invoiceDate,
          action.invoiceAmount,
          action.notes,
        )
        mutationResult = { invoiceId } satisfies InvoiceSubmitResult
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

      // ── Lateral transfers ─────────────────────────────────────────────────

      case 'TRANSFER_STOCK': {
        if (!ctx.actorId) throw new Error('TRANSFER_STOCK requires actorId')
        const transfer = await createStockTransfer({
          fromHotelId:       action.fromHotelId,
          toHotelId:         action.toHotelId,
          variantId:         action.variantId,
          quantity:          action.quantity,
          reason:            action.reason,
          requestedByUserId: ctx.actorId,
        })
        mutationResult = { transferId: transfer.id } as MutationResult
        break
      }

      case 'APPROVE_TRANSFER': {
        if (!ctx.actorId) throw new Error('APPROVE_TRANSFER requires actorId')
        const res = await approveStockTransfer({
          transferId:     action.transferId,
          approverUserId: ctx.actorId,
        })
        mutationResult = {
          fromLogId:   res.fromLogId,
          toLogId:     res.toLogId,
          fromBalance: res.fromBalance,
          toBalance:   res.toBalance,
        } satisfies TransferApproveResult
        break
      }
    }
  } catch (err) {
    return { success: false, type, error: mapPostgrestError(err) }
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

  // 5. Fire outbound webhooks — non-fatal, never blocks the action
  if (ctx.hotelId) {
    void supabase.functions.invoke('fire-webhooks', {
      body: {
        hotelId:     ctx.hotelId,
        actionType:  action.type,
        payload:     { action, result: mutationResult },
        triggeredBy: ctx.triggeredBy ?? 'user',
        actorId:     ctx.actorId ?? null,
      },
    }).catch((err: unknown) => {
      console.warn('[beacon:action] Webhook invocation failed:', err)
    })
  }

  return {
    success:      true,
    type,
    data:         mutationResult as T,
    edgesWritten,
  }
}
