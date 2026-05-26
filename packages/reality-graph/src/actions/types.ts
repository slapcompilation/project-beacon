// Reality Graph — BeaconAction type registry
// Layer: meta — used by all four layers
//
// Every mutation in the system is a named, typed BeaconAction.
// Raw Supabase .insert() / .update() calls are forbidden in application code.
// All writes flow through dispatchAction() in apps/web/src/lib/actions/dispatch.ts
// which validates submission criteria, executes the mutation, and writes
// semantic edges to the relationship_edges table.
//
// Rule: when you need a new mutation, add it here first.

// Who triggered this action — written into the audit edge
export type TriggeredBy =
  | 'user'                    // direct human action
  | 'ai_proposal_accepted'    // human accepted an AI proposal
  | 'ai_auto_approved'        // confidence × constraints cleared the auto-execution threshold
  | 'automation_threshold'    // rule-based automation (e.g. auto_propose_restocks)
  | 'revert'                  // compensating transaction
  | 'system'                  // background job / migration

// ─── The complete action union ────────────────────────────────────────────────

export type BeaconAction =
  // ── Flow Layer: Restock lifecycle ─────────────────────────────────────────
  | {
      type: 'REQUEST_RESTOCK'
      variantId: string
      quantityNeeded: number
      urgency?: 'low' | 'medium' | 'high'
      supplier?: string | null
      notes?: string | null
      hotelId: string
      requestorId: string
      triggeredBy?: TriggeredBy
    }
  | {
      type: 'APPROVE_RESTOCK'
      requestId: string
      hotelId: string
      notes?: string | null
      variantId?: string   // optional — used for traceability if available at call site
    }
  | {
      type: 'REJECT_RESTOCK'
      requestId: string
      hotelId: string
      reason?: string | null
      variantId?: string   // optional — used for traceability if available at call site
    }
  | {
      type: 'CANCEL_RESTOCK'
      requestId: string
      hotelId: string
      variantId?: string   // optional — used for traceability if available at call site
    }
  | {
      type: 'RECEIVE_STOCK'
      requestId: string
      variantId?: string
      quantityReceived: number
      hotelId: string
      lotNumber?: string | null
      notes?: string | null
      unitCost?: number | null
      expiryDate?: string | null
      supplierId?: string | null
    }

  // ── Floor Layer: Stock adjustments ────────────────────────────────────────
  | {
      type: 'ADJUST_STOCK'
      variantId: string
      delta: number
      reason: string
      hotelId: string
      userId: string
      removalCategory?: string | null
      // photoFile is browser-only — pass via DispatchExtras in dispatchAction()
    }
  | {
      type: 'WRITE_OFF'
      variantId: string
      quantity: number
      wasteReason: string
      hotelId: string
      userId: string
    }
  | {
      type: 'REVERT_ACTION'
      originalLogId: string
      revertReason: string
      variantId: string
      hotelId: string
      userId: string
    }

  // ── Mind Layer: Suppliers ────────────────────────────────────────────────
  | {
      type: 'CREATE_SUPPLIER'
      hotelId:      string
      name:         string
      contactName?: string | null
      email?:       string | null
      phone?:       string | null
      notes?:       string | null
      leadTimeDays?: number | null
    }
  | {
      type: 'UPDATE_SUPPLIER'
      supplierId:    string
      hotelId:       string
      name?:         string
      contactName?:  string | null
      email?:        string | null
      phone?:        string | null
      notes?:        string | null
      leadTimeDays?: number | null
    }
  | {
      type: 'DELETE_SUPPLIER'
      supplierId: string
      hotelId:    string
    }
  | {
      type: 'LOG_DELIVERY'
      hotelId:           string
      supplierId:        string
      restockRequestId?: string | null
      orderedQty:        number
      receivedQty:       number
      expectedDate:      string
      actualDate?:       string | null
      unitCostExpected?: number | null
      unitCostActual?:   number | null
      notes?:            string | null
    }

  // ── Mind Layer: Procurement ───────────────────────────────────────────────
  | {
      type: 'CREATE_PO'
      supplierId:           string | null
      supplierName:         string
      poNumber:             string
      hotelId:              string
      expectedDeliveryDate?: string | null
      notes?:               string | null
      lines: {
        variantId:  string
        requestId?: string | null
        orderedQty: number
        unitCost:   number
        notes?:     string | null
      }[]
    }
  | {
      type: 'UPDATE_PO_STATUS'
      poId: string
      status: 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'closed' | 'cancelled'
      hotelId: string
    }
  | {
      type: 'SUBMIT_PO_INVOICE'
      poId:          string
      hotelId:       string
      invoiceNumber: string
      invoiceDate:   string
      invoiceAmount: number
      notes?:        string | null
    }
  | {
      type: 'MATCH_INVOICE'
      invoiceId: string
      poId: string
      hotelId: string
    }

  // ── Network: lateral-before-external transfers ─────────────────────────────
  | {
      type: 'TRANSFER_STOCK'
      fromHotelId: string
      toHotelId:   string
      variantId:   string
      quantity:    number
      reason:      string
      triggeredBy?: TriggeredBy
    }
  | {
      type: 'APPROVE_TRANSFER'
      transferId: string
      hotelId:    string
    }

// ─── Result types ─────────────────────────────────────────────────────────────
//
// `ActionFailure.error` is now a tagged `BeaconError` (per the osdk-ts audit
// punch-list). Every variant carries `.message: string`, so display sites can
// keep doing `result.error.message`. UI sites that want to switch on the
// failure mode (retry vs. validation banner vs. force re-login) match on
// `result.error.code`.

import type { BeaconError, ValidationError } from '../errors'

export type ActionSuccess<T = Record<string, unknown>> = {
  success: true
  type: BeaconAction['type']
  data: T
  edgesWritten: number
}

export type ActionFailure = {
  success: false
  type: BeaconAction['type']
  error: BeaconError
}

export type ActionResult<T = Record<string, unknown>> = ActionSuccess<T> | ActionFailure

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  /** Field-tagged errors. Empty when `valid: true`. */
  errors: ValidationError[]
}
