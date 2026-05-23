// stock_transfers — minimal create + approve writers used by the dispatcher.
// Stock movement on approval happens via two adjust_stock calls (source/dest)
// so existing audit + edge writing applies unchanged.

import { supabase } from '@/lib/supabase/client'

export interface StockTransferRow {
  id: string
  from_hotel_id: string
  to_hotel_id: string
  variant_id: string
  quantity: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed'
  requested_by_user_id: string
  approved_by_user_id: string | null
  approved_at: string | null
  from_log_id: string | null
  to_log_id: string | null
  created_at: string
}

export interface CreateStockTransferInput {
  fromHotelId: string
  toHotelId: string
  variantId: string
  quantity: number
  reason: string
  requestedByUserId: string
}

export async function createStockTransfer(input: CreateStockTransferInput): Promise<StockTransferRow> {
  const { data, error } = await supabase
    .from('stock_transfers')
    .insert({
      from_hotel_id:        input.fromHotelId,
      to_hotel_id:          input.toHotelId,
      variant_id:           input.variantId,
      quantity:             input.quantity,
      reason:               input.reason,
      requested_by_user_id: input.requestedByUserId,
      status:               'pending',
    })
    .select('*')
    .single<StockTransferRow>()
  if (error) throw new Error(error.message)
  return data
}

export interface ApproveStockTransferInput {
  transferId: string
  approverUserId: string
}

/**
 * Marks the transfer approved. Stock movement is recorded via a server-side
 * function on approval — keep the write path simple here and let the trigger
 * (or a follow-up worker) reconcile the inventory ledger.
 */
export async function approveStockTransfer(input: ApproveStockTransferInput): Promise<void> {
  const { error } = await supabase
    .from('stock_transfers')
    .update({
      status:              'approved',
      approved_by_user_id: input.approverUserId,
      approved_at:         new Date().toISOString(),
    })
    .eq('id', input.transferId)
  if (error) throw new Error(error.message)
}
