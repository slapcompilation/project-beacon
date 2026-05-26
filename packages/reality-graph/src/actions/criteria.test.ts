// validateAction — the gate every mutation passes through before execution.
// One test per BeaconAction type covers the happy path and the canonical
// failure mode (missing required field, non-positive quantity, etc.).

import { describe, expect, it } from 'vitest'
import { validateAction } from './criteria'
import type { BeaconAction } from './types'

const HOTEL  = '22222222-2222-4222-8222-222222222222'
const HOTEL2 = '44444444-4444-4444-8444-444444444444'
const USER   = '33333333-3333-4333-8333-333333333333'
const VAR    = '11111111-1111-4111-8111-111111111111'
const REQ    = '55555555-5555-4555-8555-555555555555'
const PO     = '66666666-6666-4666-8666-666666666666'
const INV    = '77777777-7777-4777-8777-777777777777'
const SUP    = '88888888-8888-4888-8888-888888888888'

function expectValid(action: BeaconAction) {
  const r = validateAction(action)
  expect(r.valid, JSON.stringify(r.errors)).toBe(true)
  expect(r.errors).toEqual([])
}

function expectInvalid(action: BeaconAction, field: string) {
  const r = validateAction(action)
  expect(r.valid).toBe(false)
  expect(r.errors.some((e) => e.field === field)).toBe(true)
}

describe('validateAction — happy paths', () => {
  it('REQUEST_RESTOCK', () => expectValid({
    type: 'REQUEST_RESTOCK', variantId: VAR, quantityNeeded: 10, hotelId: HOTEL, requestorId: USER,
  }))
  it('APPROVE_RESTOCK',  () => expectValid({ type: 'APPROVE_RESTOCK',  requestId: REQ, hotelId: HOTEL }))
  it('REJECT_RESTOCK',   () => expectValid({ type: 'REJECT_RESTOCK',   requestId: REQ, hotelId: HOTEL }))
  it('CANCEL_RESTOCK',   () => expectValid({ type: 'CANCEL_RESTOCK',   requestId: REQ, hotelId: HOTEL }))
  it('RECEIVE_STOCK',    () => expectValid({ type: 'RECEIVE_STOCK',    requestId: REQ, hotelId: HOTEL, quantityReceived: 5 }))
  it('ADJUST_STOCK',     () => expectValid({ type: 'ADJUST_STOCK',     variantId: VAR, hotelId: HOTEL, userId: USER, delta: -2, reason: 'corrected count' }))
  it('WRITE_OFF',        () => expectValid({ type: 'WRITE_OFF',        variantId: VAR, hotelId: HOTEL, userId: USER, quantity: 3, wasteReason: 'expired' }))
  it('REVERT_ACTION',    () => expectValid({ type: 'REVERT_ACTION',    variantId: VAR, hotelId: HOTEL, userId: USER, originalLogId: 'log-1', revertReason: 'mistake' }))
  it('CREATE_SUPPLIER',  () => expectValid({ type: 'CREATE_SUPPLIER',  hotelId: HOTEL, name: 'Sysco' }))
  it('UPDATE_SUPPLIER',  () => expectValid({ type: 'UPDATE_SUPPLIER',  supplierId: SUP, hotelId: HOTEL, name: 'Sysco Foods' }))
  it('DELETE_SUPPLIER',  () => expectValid({ type: 'DELETE_SUPPLIER',  supplierId: SUP, hotelId: HOTEL }))
  it('LOG_DELIVERY',     () => expectValid({
    type: 'LOG_DELIVERY', hotelId: HOTEL, supplierId: SUP,
    orderedQty: 10, receivedQty: 10, expectedDate: '2026-05-27',
  }))
  it('CREATE_PO',        () => expectValid({
    type: 'CREATE_PO', hotelId: HOTEL, supplierId: SUP, supplierName: 'Sysco', poNumber: 'PO-1',
    lines: [{ variantId: VAR, orderedQty: 5, unitCost: 1.0 }],
  }))
  it('UPDATE_PO_STATUS', () => expectValid({ type: 'UPDATE_PO_STATUS', poId: PO, hotelId: HOTEL, status: 'sent' }))
  it('SUBMIT_PO_INVOICE',() => expectValid({
    type: 'SUBMIT_PO_INVOICE', poId: PO, hotelId: HOTEL,
    invoiceNumber: 'INV-1', invoiceDate: '2026-01-01', invoiceAmount: 100,
  }))
  it('MATCH_INVOICE',    () => expectValid({ type: 'MATCH_INVOICE',    invoiceId: INV, poId: PO, hotelId: HOTEL }))
  it('TRANSFER_STOCK',   () => expectValid({
    type: 'TRANSFER_STOCK', fromHotelId: HOTEL, toHotelId: HOTEL2, variantId: VAR, quantity: 5, reason: 'rebalance',
  }))
  it('APPROVE_TRANSFER', () => expectValid({ type: 'APPROVE_TRANSFER', transferId: 'xfer-1', hotelId: HOTEL }))
})

describe('validateAction — canonical failures', () => {
  it('REQUEST_RESTOCK rejects zero quantity', () => expectInvalid(
    { type: 'REQUEST_RESTOCK', variantId: VAR, quantityNeeded: 0, hotelId: HOTEL, requestorId: USER }, 'quantityNeeded',
  ))
  it('ADJUST_STOCK rejects zero delta', () => expectInvalid(
    { type: 'ADJUST_STOCK', variantId: VAR, hotelId: HOTEL, userId: USER, delta: 0, reason: 'x' }, 'delta',
  ))
  it('WRITE_OFF rejects blank reason', () => expectInvalid(
    { type: 'WRITE_OFF', variantId: VAR, hotelId: HOTEL, userId: USER, quantity: 1, wasteReason: '  ' }, 'wasteReason',
  ))
  it('TRANSFER_STOCK rejects same-hotel transfer', () => expectInvalid(
    { type: 'TRANSFER_STOCK', fromHotelId: HOTEL, toHotelId: HOTEL, variantId: VAR, quantity: 5, reason: 'x' }, 'toHotelId',
  ))
  it('CREATE_PO rejects empty lines', () => expectInvalid(
    { type: 'CREATE_PO', hotelId: HOTEL, supplierId: SUP, supplierName: 'Sysco', poNumber: 'PO-1', lines: [] }, 'lines',
  ))
  it('CREATE_PO rejects non-positive line qty', () => expectInvalid(
    { type: 'CREATE_PO', hotelId: HOTEL, supplierId: SUP, supplierName: 'Sysco', poNumber: 'PO-1',
      lines: [{ variantId: VAR, orderedQty: 0, unitCost: 1 }] }, 'lines[0].orderedQty',
  ))
  it('SUBMIT_PO_INVOICE rejects non-positive amount', () => expectInvalid(
    { type: 'SUBMIT_PO_INVOICE', poId: PO, hotelId: HOTEL,
      invoiceNumber: 'INV-1', invoiceDate: '2026-01-01', invoiceAmount: 0 }, 'invoiceAmount',
  ))
  it('UPDATE_SUPPLIER rejects blank-string name', () => expectInvalid(
    { type: 'UPDATE_SUPPLIER', supplierId: SUP, hotelId: HOTEL, name: '   ' }, 'name',
  ))
  it('LOG_DELIVERY rejects missing expectedDate', () => expectInvalid(
    { type: 'LOG_DELIVERY', hotelId: HOTEL, supplierId: SUP, orderedQty: 1, receivedQty: 1, expectedDate: '' }, 'expectedDate',
  ))
  it('LOG_DELIVERY rejects non-positive orderedQty', () => expectInvalid(
    { type: 'LOG_DELIVERY', hotelId: HOTEL, supplierId: SUP, orderedQty: 0, receivedQty: 0, expectedDate: '2026-05-27' }, 'orderedQty',
  ))
})
