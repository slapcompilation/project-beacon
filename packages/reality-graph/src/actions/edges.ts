// Reality Graph — Edge computation for BeaconActions
// Layer: meta
//
// Pure function — no async, no side effects.
// Given a BeaconAction and the mutation result, returns the semantic
// EdgeInsert[] records to be written to relationship_edges.
//
// Rule: every action that creates or binds nodes must declare its edges here.
// The dispatchAction() executor calls this after the mutation succeeds.

import type { EdgeType, NodeType } from '../types'
import type { BeaconAction, TriggeredBy } from './types'

// ─── EdgeInsert — what we write to relationship_edges ─────────────────────────

export interface EdgeInsert {
  edge_type: EdgeType
  source_type: NodeType
  source_id: string
  target_type: NodeType
  target_id: string
  hotel_id: string
  triggered_by: TriggeredBy
  actor_id?: string | null
  metadata?: Record<string, unknown>
}

// ─── Mutation result — typed output from each action's executor ───────────────

export interface RestockRequestResult   { restockId: string }
export interface StockLogResult         { logId: string }
export interface ReceiveStockResult     { logId: string; receiveId?: string; fulfilled: boolean; newBalance: number }
export interface RevertActionResult     { newLogId: string }
export interface SupplierCreateResult   { supplierId: string }
export interface POCreateResult         { poId: string }
export interface InvoiceSubmitResult    { invoiceId: string }
export interface TransferCreateResult   { transferId: string }
export interface TransferApproveResult  { fromLogId: string; toLogId: string; fromBalance: number; toBalance: number }
export interface DeliveryLogResult      { deliveryId: string }
/** Shared result shape for create-row taxonomy ops (location/category/reason). */
export interface TaxonomyCreateResult   { nodeId: string }
/** Returned when an action hit a SOFT constraint violation and was routed to
 *  the pending_action_approvals queue instead of executing. */
export interface PendingApprovalResult  { pendingApprovalId: string }

export type MutationResult =
  | SupplierCreateResult
  | RestockRequestResult
  | StockLogResult
  | ReceiveStockResult
  | RevertActionResult
  | POCreateResult
  | InvoiceSubmitResult
  | TransferCreateResult
  | TransferApproveResult
  | PendingApprovalResult
  | DeliveryLogResult
  | TaxonomyCreateResult
  | Record<string, never>  // actions that return no IDs

// ─── Context threaded from the hook into the dispatcher ──────────────────────

export interface EdgeContext {
  hotelId: string
  actorId?: string | null
  triggeredBy?: TriggeredBy
}

// ─── Core function ────────────────────────────────────────────────────────────

export function edgesForAction(
  action: BeaconAction,
  result: MutationResult,
  ctx: EdgeContext,
): EdgeInsert[] {
  const { hotelId, actorId = null, triggeredBy = 'user' } = ctx
  const base: Pick<EdgeInsert, 'hotel_id' | 'triggered_by' | 'actor_id'> = {
    hotel_id:     hotelId,
    triggered_by: triggeredBy,
    actor_id:     actorId,
  }

  const edges: EdgeInsert[] = []

  // Helper: push only if value is non-null
  const push = (e: EdgeInsert) => edges.push(e)

  switch (action.type) {
    case 'CREATE_SUPPLIER': {
      const { supplierId } = result as SupplierCreateResult
      if (!supplierId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'supplier', source_id: supplierId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'supplier', source_id: supplierId, target_type: 'user', target_id: actorId })
      break
    }

    case 'UPDATE_SUPPLIER': {
      if (actorId) push({ ...base, edge_type: 'modified_by', source_type: 'supplier', source_id: action.supplierId, target_type: 'user', target_id: actorId })
      break
    }

    case 'DELETE_SUPPLIER':
      // Row removal — no new edges. Existing edges referencing this supplier
      // remain in relationship_edges as historical context.
      break

    case 'LOG_DELIVERY': {
      const { deliveryId } = result as DeliveryLogResult
      if (!deliveryId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'delivery_event', source_id: deliveryId, target_type: 'hotel', target_id: hotelId })
      push({ ...base, edge_type: 'sourced_from',     source_type: 'delivery_event', source_id: deliveryId, target_type: 'supplier', target_id: action.supplierId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'delivery_event', source_id: deliveryId, target_type: 'user', target_id: actorId })
      break
    }

    case 'REQUEST_RESTOCK': {
      const { restockId } = result as RestockRequestResult
      if (!restockId) break

      // variant --restocks--> restock_request
      push({ ...base, edge_type: 'restocks', source_type: 'variant', source_id: action.variantId, target_type: 'restock_request', target_id: restockId })
      // restock_request --belongs_to_hotel--> hotel
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'restock_request', source_id: restockId, target_type: 'hotel', target_id: hotelId })
      // restock_request --created_by--> user  (only if actor known)
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'restock_request', source_id: restockId, target_type: 'user', target_id: actorId })
      break
    }

    case 'APPROVE_RESTOCK': {
      if (!actorId) break
      // restock_request --approved_by--> user
      push({ ...base, edge_type: 'approved_by', source_type: 'restock_request', source_id: action.requestId, target_type: 'user', target_id: actorId })
      break
    }

    case 'REJECT_RESTOCK': {
      if (!actorId) break
      // restock_request --rejected_by--> user
      push({ ...base, edge_type: 'rejected_by', source_type: 'restock_request', source_id: action.requestId, target_type: 'user', target_id: actorId })
      break
    }

    case 'CANCEL_RESTOCK':
      // Status change only — no new relationship created
      break

    case 'RECEIVE_STOCK': {
      const { logId, receiveId } = result as ReceiveStockResult
      if (logId) {
        // stock_log --fulfills--> restock_request
        push({ ...base, edge_type: 'fulfills', source_type: 'stock_log', source_id: logId, target_type: 'restock_request', target_id: action.requestId })
        push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'stock_log', source_id: logId, target_type: 'hotel', target_id: hotelId })
        if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'stock_log', source_id: logId, target_type: 'user', target_id: actorId })
      }
      if (receiveId && action.supplierId) {
        // restock_receive --sourced_from--> supplier
        push({ ...base, edge_type: 'sourced_from', source_type: 'restock_receive', source_id: receiveId, target_type: 'supplier', target_id: action.supplierId })
      }
      break
    }

    case 'ADJUST_STOCK': {
      const { logId } = result as StockLogResult
      if (!logId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'stock_log', source_id: logId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'stock_log', source_id: logId, target_type: 'user', target_id: actorId })
      break
    }

    case 'WRITE_OFF': {
      const { logId } = result as StockLogResult
      if (!logId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'stock_log', source_id: logId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'stock_log', source_id: logId, target_type: 'user', target_id: actorId })
      // stock_log --discarded_via--> variant (write-offs are a specific removal reason)
      push({ ...base, edge_type: 'discarded_via', source_type: 'stock_log', source_id: logId, target_type: 'variant', target_id: action.variantId, metadata: { waste_reason: action.wasteReason } })
      break
    }

    case 'REVERT_ACTION': {
      const { newLogId } = result as RevertActionResult
      if (!newLogId) break
      // new stock_log --reverts--> original stock_log
      push({ ...base, edge_type: 'reverts', triggered_by: 'revert', source_type: 'stock_log', source_id: newLogId, target_type: 'stock_log', target_id: action.originalLogId })
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'stock_log', source_id: newLogId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'stock_log', source_id: newLogId, target_type: 'user', target_id: actorId })
      break
    }

    case 'CREATE_PO': {
      const { poId } = result as POCreateResult
      if (!poId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'purchase_order', source_id: poId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'purchase_order', source_id: poId, target_type: 'user', target_id: actorId })
      if (action.supplierId) {
        push({ ...base, edge_type: 'sourced_from', source_type: 'purchase_order', source_id: poId, target_type: 'supplier', target_id: action.supplierId })
      }
      for (const line of action.lines) {
        // variant --linked_to_po--> purchase_order
        push({ ...base, edge_type: 'linked_to_po', source_type: 'variant', source_id: line.variantId, target_type: 'purchase_order', target_id: poId })
        // restock_request --linked_to_po--> purchase_order
        if (line.requestId) {
          push({ ...base, edge_type: 'linked_to_po', source_type: 'restock_request', source_id: line.requestId, target_type: 'purchase_order', target_id: poId })
        }
      }
      break
    }

    case 'UPDATE_PO_STATUS':
      // State change only — purchase_order edges were written when PO was created
      break

    case 'SUBMIT_PO_INVOICE': {
      const { invoiceId } = result as InvoiceSubmitResult
      if (!invoiceId) break
      push({ ...base, edge_type: 'invoiced_by', source_type: 'purchase_order', source_id: action.poId, target_type: 'po_invoice', target_id: invoiceId })
      break
    }

    case 'MATCH_INVOICE': {
      // purchase_order --invoiced_by--> po_invoice
      push({ ...base, edge_type: 'invoiced_by', source_type: 'purchase_order', source_id: action.poId, target_type: 'po_invoice', target_id: action.invoiceId })
      break
    }

    case 'TRANSFER_STOCK': {
      const { transferId } = result as TransferCreateResult
      if (!transferId) break
      // stock_transfer --transfers--> variant
      push({ ...base, edge_type: 'transfers', source_type: 'stock_transfer', source_id: transferId, target_type: 'variant', target_id: action.variantId })
      // stock_transfer --belongs_to_hotel--> hotel (destination)
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'stock_transfer', source_id: transferId, target_type: 'hotel', target_id: action.toHotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'stock_transfer', source_id: transferId, target_type: 'user', target_id: actorId })
      break
    }

    case 'APPROVE_TRANSFER': {
      if (actorId) {
        push({ ...base, edge_type: 'approved_by', source_type: 'stock_transfer', source_id: action.transferId, target_type: 'user', target_id: actorId })
      }
      const approve = result as Partial<TransferApproveResult>
      if (approve.fromLogId) {
        push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'stock_log', source_id: approve.fromLogId, target_type: 'hotel', target_id: hotelId })
        if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'stock_log', source_id: approve.fromLogId, target_type: 'user', target_id: actorId })
      }
      if (approve.toLogId) {
        // toLog lives in the destination hotel — its belongs_to_hotel edge would be in the dest hotel scope,
        // not the dispatch context's hotelId, so we leave that to a server-side trigger if/when added.
        if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'stock_log', source_id: approve.toLogId, target_type: 'user', target_id: actorId })
      }
      break
    }

    // ── Taxonomy CRUD ───────────────────────────────────────────────────────
    case 'CREATE_LOCATION': {
      const { nodeId } = result as Partial<TaxonomyCreateResult>
      if (!nodeId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'location', source_id: nodeId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'location', source_id: nodeId, target_type: 'user', target_id: actorId })
      break
    }
    case 'UPDATE_LOCATION': {
      if (actorId) push({ ...base, edge_type: 'modified_by', source_type: 'location', source_id: action.locationId, target_type: 'user', target_id: actorId })
      break
    }
    case 'DELETE_LOCATION': break

    case 'CREATE_CATEGORY': {
      const { nodeId } = result as Partial<TaxonomyCreateResult>
      if (!nodeId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'category', source_id: nodeId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'category', source_id: nodeId, target_type: 'user', target_id: actorId })
      break
    }
    case 'UPDATE_CATEGORY': {
      if (actorId) push({ ...base, edge_type: 'modified_by', source_type: 'category', source_id: action.categoryId, target_type: 'user', target_id: actorId })
      break
    }
    case 'DELETE_CATEGORY': break

    case 'CREATE_REMOVAL_REASON': {
      const { nodeId } = result as Partial<TaxonomyCreateResult>
      if (!nodeId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'removal_reason', source_id: nodeId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'removal_reason', source_id: nodeId, target_type: 'user', target_id: actorId })
      break
    }
    case 'UPDATE_REMOVAL_REASON': {
      if (actorId) push({ ...base, edge_type: 'modified_by', source_type: 'removal_reason', source_id: action.reasonId, target_type: 'user', target_id: actorId })
      break
    }
    case 'DELETE_REMOVAL_REASON': break

    // ── Pick lists ──────────────────────────────────────────────────────────
    case 'CREATE_PICK_LIST': {
      const { nodeId } = result as Partial<TaxonomyCreateResult>
      if (!nodeId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'pick_list', source_id: nodeId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'pick_list', source_id: nodeId, target_type: 'user', target_id: actorId })
      break
    }
    case 'UPDATE_PICK_LIST': {
      if (actorId) push({ ...base, edge_type: 'modified_by', source_type: 'pick_list', source_id: action.pickListId, target_type: 'user', target_id: actorId })
      break
    }
    case 'DELETE_PICK_LIST': break

    case 'ADD_PICK_LIST_ITEM': {
      const { nodeId } = result as Partial<TaxonomyCreateResult>
      if (!nodeId) break
      // pick_list_item --belongs_to_session--> pick_list (re-using the
      // belongs_to_session edge type; semantically: line item belongs to
      // its parent batch). variant --consumes--> pick_list_item ties the
      // item to the inventory it'll deduct on commit.
      push({ ...base, edge_type: 'belongs_to_session', source_type: 'pick_list_item', source_id: nodeId, target_type: 'pick_list', target_id: action.pickListId })
      push({ ...base, edge_type: 'consumes', source_type: 'pick_list_item', source_id: nodeId, target_type: 'variant', target_id: action.variantId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'pick_list_item', source_id: nodeId, target_type: 'user', target_id: actorId })
      break
    }
    case 'UPDATE_PICK_LIST_ITEM': {
      if (actorId) push({ ...base, edge_type: 'modified_by', source_type: 'pick_list_item', source_id: action.itemId, target_type: 'user', target_id: actorId })
      break
    }
    case 'REMOVE_PICK_LIST_ITEM': break

    // ── F&B menu items + ingredients ────────────────────────────────────────
    case 'CREATE_MENU_ITEM': {
      const { nodeId } = result as Partial<TaxonomyCreateResult>
      if (!nodeId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'menu_item', source_id: nodeId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'menu_item', source_id: nodeId, target_type: 'user', target_id: actorId })
      break
    }
    case 'UPDATE_MENU_ITEM':
    case 'ARCHIVE_MENU_ITEM': {
      if (actorId) push({ ...base, edge_type: 'modified_by', source_type: 'menu_item', source_id: action.menuItemId, target_type: 'user', target_id: actorId })
      break
    }

    case 'ADD_MENU_INGREDIENT': {
      const { nodeId } = result as Partial<TaxonomyCreateResult>
      if (!nodeId) break
      // ingredient --belongs_to_session--> parent menu_item (the recipe row),
      // variant --consumes--> ingredient ties the menu item to its inventory cost.
      push({ ...base, edge_type: 'belongs_to_session', source_type: 'menu_item_ingredient', source_id: nodeId, target_type: 'menu_item', target_id: action.menuItemId })
      push({ ...base, edge_type: 'consumes',           source_type: 'menu_item_ingredient', source_id: nodeId, target_type: 'variant',   target_id: action.variantId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'menu_item_ingredient', source_id: nodeId, target_type: 'user', target_id: actorId })
      break
    }
    case 'UPDATE_MENU_INGREDIENT': {
      if (actorId) push({ ...base, edge_type: 'modified_by', source_type: 'menu_item_ingredient', source_id: action.ingredientId, target_type: 'user', target_id: actorId })
      break
    }
    case 'REMOVE_MENU_INGREDIENT': break

    // ── Demand-planner events ───────────────────────────────────────────────
    case 'CREATE_EVENT': {
      const { nodeId } = result as Partial<TaxonomyCreateResult>
      if (!nodeId) break
      push({ ...base, edge_type: 'belongs_to_hotel', source_type: 'event', source_id: nodeId, target_type: 'hotel', target_id: hotelId })
      if (actorId) push({ ...base, edge_type: 'created_by', source_type: 'event', source_id: nodeId, target_type: 'user', target_id: actorId })
      break
    }
    case 'UPDATE_EVENT': {
      if (actorId) push({ ...base, edge_type: 'modified_by', source_type: 'event', source_id: action.eventId, target_type: 'user', target_id: actorId })
      break
    }
    case 'DELETE_EVENT': break
  }

  return edges
}
