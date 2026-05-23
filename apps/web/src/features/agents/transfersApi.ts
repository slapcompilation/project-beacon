// stock_transfers — create + approve writers used by the dispatcher.
// Approval is a single SECURITY DEFINER RPC that decrements source, increments
// destination, writes both stock_logs rows, and flips the transfer to completed.

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

export interface ApproveStockTransferResult {
  fromLogId:   string
  toLogId:     string
  fromBalance: number
  toBalance:   number
}

interface ApproveRpcRow {
  from_log_id:  string
  to_log_id:    string
  from_balance: number
  to_balance:   number
}

/**
 * Completes the transfer via approve_stock_transfer RPC. Atomically:
 *  - decrements source variant + writes a stock_logs row in the source hotel
 *  - resolves destination variant by product+variant name, increments + logs
 *  - flips status to 'completed' with both log ids + approver stamp
 */
export async function approveStockTransfer(
  input: ApproveStockTransferInput,
): Promise<ApproveStockTransferResult> {
  const result = await supabase.rpc('approve_stock_transfer', {
    p_transfer_id: input.transferId,
  }) as { data: ApproveRpcRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  const row = result.data?.[0]
  if (!row) throw new Error('approve_stock_transfer returned no row')
  return {
    fromLogId:   row.from_log_id,
    toLogId:     row.to_log_id,
    fromBalance: row.from_balance,
    toBalance:   row.to_balance,
  }
}
