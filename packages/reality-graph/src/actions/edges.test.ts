// edgesForAction — every action's semantic edge fan-out. Pure function;
// each test names the edge_type + endpoints we expect to land in
// relationship_edges. The dispatcher writes whatever this returns.

import { describe, expect, it } from 'vitest'
import { edgesForAction } from './edges'
import type { EdgeContext } from './edges'

const HOTEL  = 'h-1'
const HOTEL2 = 'h-2'
const USER   = 'u-1'
const VAR    = 'v-1'

const ctx: EdgeContext = { hotelId: HOTEL, actorId: USER, triggeredBy: 'user' }

describe('edgesForAction', () => {
  it('REQUEST_RESTOCK fans out restocks + belongs_to_hotel + created_by', () => {
    const edges = edgesForAction(
      { type: 'REQUEST_RESTOCK', variantId: VAR, quantityNeeded: 5, hotelId: HOTEL, requestorId: USER },
      { restockId: 'r-1' },
      ctx,
    )
    const types = edges.map((e) => e.edge_type).sort()
    expect(types).toEqual(['belongs_to_hotel', 'created_by', 'restocks'])
    const restocks = edges.find((e) => e.edge_type === 'restocks')
    expect(restocks).toMatchObject({ source_type: 'variant', source_id: VAR, target_type: 'restock_request', target_id: 'r-1' })
  })

  it('REQUEST_RESTOCK without actorId skips created_by', () => {
    const edges = edgesForAction(
      { type: 'REQUEST_RESTOCK', variantId: VAR, quantityNeeded: 5, hotelId: HOTEL, requestorId: USER },
      { restockId: 'r-1' },
      { hotelId: HOTEL, actorId: null, triggeredBy: 'system' },
    )
    expect(edges.some((e) => e.edge_type === 'created_by')).toBe(false)
    expect(edges.every((e) => e.triggered_by === 'system')).toBe(true)
  })

  it('REVERT_ACTION marks itself triggered_by="revert" regardless of ctx', () => {
    const edges = edgesForAction(
      { type: 'REVERT_ACTION', variantId: VAR, hotelId: HOTEL, userId: USER, originalLogId: 'log-old', revertReason: 'x' },
      { newLogId: 'log-new' },
      ctx,
    )
    const reverts = edges.find((e) => e.edge_type === 'reverts')
    expect(reverts).toMatchObject({
      triggered_by: 'revert',
      source_type:  'stock_log', source_id: 'log-new',
      target_type:  'stock_log', target_id: 'log-old',
    })
  })

  it('TRANSFER_STOCK belongs_to_hotel targets the DESTINATION hotel', () => {
    const edges = edgesForAction(
      { type: 'TRANSFER_STOCK', fromHotelId: HOTEL, toHotelId: HOTEL2, variantId: VAR, quantity: 3, reason: 'x' },
      { transferId: 'xfer-1' },
      ctx,
    )
    const owner = edges.find((e) => e.edge_type === 'belongs_to_hotel')
    expect(owner?.target_id).toBe(HOTEL2)
  })

  it('WRITE_OFF stamps discarded_via with waste_reason metadata', () => {
    const edges = edgesForAction(
      { type: 'WRITE_OFF', variantId: VAR, hotelId: HOTEL, userId: USER, quantity: 2, wasteReason: 'expired' },
      { logId: 'log-1' },
      ctx,
    )
    const discarded = edges.find((e) => e.edge_type === 'discarded_via')
    expect(discarded?.metadata).toEqual({ waste_reason: 'expired' })
  })

  it('APPROVE_RESTOCK without actorId produces no edges (audit-only)', () => {
    const edges = edgesForAction(
      { type: 'APPROVE_RESTOCK', requestId: 'r-1', hotelId: HOTEL },
      {},
      { hotelId: HOTEL, actorId: null, triggeredBy: 'user' },
    )
    expect(edges).toEqual([])
  })

  it('CREATE_PO fans out one linked_to_po edge per line', () => {
    const edges = edgesForAction(
      {
        type: 'CREATE_PO', hotelId: HOTEL, supplierId: 's-1', supplierName: 'Sysco', poNumber: 'PO-1',
        lines: [
          { variantId: 'v-a', orderedQty: 1, unitCost: 1 },
          { variantId: 'v-b', orderedQty: 2, unitCost: 1, requestId: 'r-99' },
        ],
      },
      { poId: 'po-1' },
      ctx,
    )
    const variantLinks = edges.filter((e) => e.edge_type === 'linked_to_po' && e.source_type === 'variant')
    const reqLinks     = edges.filter((e) => e.edge_type === 'linked_to_po' && e.source_type === 'restock_request')
    expect(variantLinks).toHaveLength(2)
    expect(reqLinks).toHaveLength(1)
    expect(reqLinks[0].source_id).toBe('r-99')
  })
})
