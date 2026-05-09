// Reality Graph — Submission criteria validators
// Layer: meta
//
// Every BeaconAction has declared submission criteria checked before execution.
// validateAction() is a pure function — no side effects, no async.
// dispatchAction() calls this first; on failure it wraps the result in a
// VALIDATION_FAILED BeaconError.
//
// Errors are now field-tagged (per osdk-ts audit) so UIs can associate each
// problem with the input that caused it instead of parsing concatenated
// strings.

import type { BeaconAction, ValidationResult } from './types'
import type { ValidationError } from '../errors'

export function validateAction(action: BeaconAction): ValidationResult {
  const errors: ValidationError[] = []
  const e = (field: string, message: string) => errors.push({ field, message })

  switch (action.type) {
    case 'REQUEST_RESTOCK': {
      if (!action.variantId)     e('variantId',   'variantId is required')
      if (!action.hotelId)       e('hotelId',     'hotelId is required')
      if (!action.requestorId)   e('requestorId', 'requestorId is required')
      if (action.quantityNeeded <= 0)
        e('quantityNeeded', 'quantityNeeded must be greater than 0')
      break
    }

    case 'APPROVE_RESTOCK': {
      if (!action.requestId) e('requestId', 'requestId is required')
      if (!action.hotelId)   e('hotelId',   'hotelId is required')
      break
    }

    case 'REJECT_RESTOCK': {
      if (!action.requestId) e('requestId', 'requestId is required')
      if (!action.hotelId)   e('hotelId',   'hotelId is required')
      break
    }

    case 'CANCEL_RESTOCK': {
      if (!action.requestId) e('requestId', 'requestId is required')
      if (!action.hotelId)   e('hotelId',   'hotelId is required')
      break
    }

    case 'RECEIVE_STOCK': {
      if (!action.requestId) e('requestId', 'requestId is required')
      if (!action.hotelId)   e('hotelId',   'hotelId is required')
      if (action.quantityReceived <= 0)
        e('quantityReceived', 'quantityReceived must be greater than 0')
      break
    }

    case 'ADJUST_STOCK': {
      if (!action.variantId)   e('variantId', 'variantId is required')
      if (!action.hotelId)     e('hotelId',   'hotelId is required')
      if (!action.userId)      e('userId',    'userId is required')
      if (action.delta === 0)
        e('delta', 'delta cannot be zero — use WRITE_OFF for waste removal')
      if (!action.reason.trim()) e('reason', 'reason is required')
      break
    }

    case 'WRITE_OFF': {
      if (!action.variantId)   e('variantId', 'variantId is required')
      if (!action.hotelId)     e('hotelId',   'hotelId is required')
      if (!action.userId)      e('userId',    'userId is required')
      if (action.quantity <= 0) e('quantity',  'quantity must be greater than 0')
      if (!action.wasteReason.trim()) e('wasteReason', 'wasteReason is required')
      break
    }

    case 'REVERT_ACTION': {
      if (!action.originalLogId)   e('originalLogId', 'originalLogId is required')
      if (!action.variantId)       e('variantId',     'variantId is required')
      if (!action.hotelId)         e('hotelId',       'hotelId is required')
      if (!action.userId)          e('userId',        'userId is required')
      if (!action.revertReason.trim()) e('revertReason', 'revertReason is required')
      break
    }

    case 'CREATE_SUPPLIER': {
      if (!action.hotelId)      e('hotelId', 'hotelId is required')
      if (!action.name.trim())  e('name',    'supplier name is required')
      break
    }

    case 'CREATE_PO': {
      if (!action.hotelId)             e('hotelId',      'hotelId is required')
      if (!action.supplierName.trim()) e('supplierName', 'supplierName is required')
      if (!action.poNumber.trim())     e('poNumber',     'poNumber is required')
      if (action.lines.length === 0)   e('lines',        'at least one line item is required')
      action.lines.forEach((line, idx) => {
        if (line.orderedQty <= 0) {
          e(`lines[${String(idx)}].orderedQty`, `line for ${line.variantId}: orderedQty must be > 0`)
        }
      })
      break
    }

    case 'UPDATE_PO_STATUS': {
      if (!action.poId)    e('poId',    'poId is required')
      if (!action.hotelId) e('hotelId', 'hotelId is required')
      if (!action.status)  e('status',  'status is required')
      break
    }

    case 'SUBMIT_PO_INVOICE': {
      if (!action.poId)              e('poId',           'poId is required')
      if (!action.hotelId)           e('hotelId',        'hotelId is required')
      if (!action.invoiceNumber.trim()) e('invoiceNumber', 'invoiceNumber is required')
      if (!action.invoiceDate)       e('invoiceDate',    'invoiceDate is required')
      if (action.invoiceAmount <= 0) e('invoiceAmount',  'invoiceAmount must be > 0')
      break
    }

    case 'MATCH_INVOICE': {
      if (!action.invoiceId) e('invoiceId', 'invoiceId is required')
      if (!action.poId)      e('poId',      'poId is required')
      if (!action.hotelId)   e('hotelId',   'hotelId is required')
      break
    }
  }

  return { valid: errors.length === 0, errors }
}
