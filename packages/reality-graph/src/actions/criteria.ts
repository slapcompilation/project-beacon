// Reality Graph — Submission criteria validators
// Layer: meta
//
// Every BeaconAction has declared submission criteria checked before execution.
// validateAction() is a pure function — no side effects, no async.
// dispatchAction() calls this first and throws if invalid.

import type { BeaconAction, ValidationResult } from './types'

export function validateAction(action: BeaconAction): ValidationResult {
  const errors: string[] = []

  switch (action.type) {
    case 'REQUEST_RESTOCK': {
      if (!action.variantId)     errors.push('variantId is required')
      if (!action.hotelId)       errors.push('hotelId is required')
      if (!action.requestorId)   errors.push('requestorId is required')
      if (action.quantityNeeded <= 0)
        errors.push('quantityNeeded must be greater than 0')
      break
    }

    case 'APPROVE_RESTOCK': {
      if (!action.requestId) errors.push('requestId is required')
      if (!action.hotelId)   errors.push('hotelId is required')
      break
    }

    case 'REJECT_RESTOCK': {
      if (!action.requestId) errors.push('requestId is required')
      if (!action.hotelId)   errors.push('hotelId is required')
      break
    }

    case 'CANCEL_RESTOCK': {
      if (!action.requestId) errors.push('requestId is required')
      if (!action.hotelId)   errors.push('hotelId is required')
      break
    }

    case 'RECEIVE_STOCK': {
      if (!action.requestId) errors.push('requestId is required')
      if (!action.hotelId)   errors.push('hotelId is required')
      if (action.quantityReceived <= 0)
        errors.push('quantityReceived must be greater than 0')
      break
    }

    case 'ADJUST_STOCK': {
      if (!action.variantId)   errors.push('variantId is required')
      if (!action.hotelId)     errors.push('hotelId is required')
      if (!action.userId)      errors.push('userId is required')
      if (action.delta === 0)  errors.push('delta cannot be zero — use WRITE_OFF for waste removal')
      if (!action.reason.trim()) errors.push('reason is required')
      break
    }

    case 'WRITE_OFF': {
      if (!action.variantId)   errors.push('variantId is required')
      if (!action.hotelId)     errors.push('hotelId is required')
      if (!action.userId)      errors.push('userId is required')
      if (action.quantity <= 0) errors.push('quantity must be greater than 0')
      if (!action.wasteReason.trim()) errors.push('wasteReason is required')
      break
    }

    case 'REVERT_ACTION': {
      if (!action.originalLogId)   errors.push('originalLogId is required')
      if (!action.variantId)       errors.push('variantId is required')
      if (!action.hotelId)         errors.push('hotelId is required')
      if (!action.userId)          errors.push('userId is required')
      if (!action.revertReason.trim()) errors.push('revertReason is required')
      break
    }

    case 'UPDATE_PO_STATUS': {
      if (!action.poId)    errors.push('poId is required')
      if (!action.hotelId) errors.push('hotelId is required')
      if (!action.status)  errors.push('status is required')
      break
    }

    case 'MATCH_INVOICE': {
      if (!action.invoiceId) errors.push('invoiceId is required')
      if (!action.poId)      errors.push('poId is required')
      if (!action.hotelId)   errors.push('hotelId is required')
      break
    }
  }

  return { valid: errors.length === 0, errors }
}
