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

// ─── Result types ─────────────────────────────────────────────────────────────

export type ActionSuccess<T = Record<string, unknown>> = {
  success: true
  type: BeaconAction['type']
  data: T
  edgesWritten: number
}

export type ActionFailure = {
  success: false
  type: BeaconAction['type']
  error: string
}

export type ActionResult<T = Record<string, unknown>> = ActionSuccess<T> | ActionFailure

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
}
