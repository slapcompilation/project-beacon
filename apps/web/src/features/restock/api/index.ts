import { supabase } from '@/lib/supabase/client'
import type { RestockRequest, RestockReceive, Hotel, ApprovalVelocityRow, SpendTrendRow } from '@beacon/types'

// ─── Joined display type ──────────────────────────────────────────────────────

export interface RestockRequestRow extends RestockRequest {
  product_variants: {
    name: string
    sku: string
    cost: number | null
    products: { name: string } | null
  } | null
  /** PO line(s) linked to this request — used to show PO-agreed unit cost at receive time */
  purchase_order_lines: { unit_cost: number }[] | null
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function fetchRestockRequests(hotelId: string): Promise<RestockRequestRow[]> {
  const { data, error } = await supabase
    .from('restock_requests')
    .select('*, product_variants(name, sku, cost, products(name)), purchase_order_lines(unit_cost)')
    .eq('hotel_id', hotelId)
    .order('date', { ascending: false })
    .limit(300)

  if (error) throw new Error(error.message)
  return data as RestockRequestRow[]
}

export async function createRestockRequest(
  hotelId: string,
  requestorId: string,
  variantId: string,
  quantityNeeded: number,
  supplier?: string | null,
  notes?: string | null
): Promise<RestockRequest> {
  const result = await supabase
    .from('restock_requests')
    .insert({
      hotel_id: hotelId,
      requestor_id: requestorId,
      variant_id: variantId,
      quantity_needed: quantityNeeded,
      supplier: supplier ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()
  const { error } = result
  const data = result.data as RestockRequest

  if (error) throw new Error(error.message)
  return data
}

export async function updateRestockStatus(
  id: string,
  status: RestockRequest['status']
): Promise<void> {
  const { error } = await supabase
    .from('restock_requests')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function approveRestock(requestId: string, notes?: string | null): Promise<void> {
  const result = await supabase.rpc('approve_restock', {
    p_request_id: requestId,
    p_notes: notes ?? null,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

export async function rejectRestock(requestId: string, reason?: string | null): Promise<void> {
  const result = await supabase.rpc('reject_restock', {
    p_request_id: requestId,
    p_reason: reason ?? null,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

export async function fetchApprovalThresholds(hotelId: string): Promise<Pick<Hotel, 'manager_approval_threshold' | 'director_approval_threshold' | 'escalation_timeout_hours'>> {
  const { data, error } = await supabase
    .from('hotels')
    .select('manager_approval_threshold, director_approval_threshold, escalation_timeout_hours')
    .eq('id', hotelId)
    .single()
  if (error) throw new Error(error.message)
  return data as Pick<Hotel, 'manager_approval_threshold' | 'director_approval_threshold' | 'escalation_timeout_hours'>
}

export async function updateApprovalThresholds(
  managerThreshold: number,
  directorThreshold: number,
  escalationTimeoutHours: number,
): Promise<void> {
  const result = await supabase.rpc('update_approval_thresholds', {
    p_manager_threshold:          managerThreshold,
    p_director_threshold:         directorThreshold,
    p_escalation_timeout_hours:   escalationTimeoutHours,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

// ─── Approval analytics ────────────────────────────────────────────────────────

export async function fetchApprovalVelocity(days = 30): Promise<ApprovalVelocityRow[]> {
  const result = await supabase.rpc('get_approval_velocity', { p_days: days }) as unknown as { data: ApprovalVelocityRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchSpendTrend(months = 6): Promise<SpendTrendRow[]> {
  const result = await supabase.rpc('get_spend_trend', { p_months: months }) as unknown as { data: SpendTrendRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Receiving ────────────────────────────────────────────────────────────────

export interface ReceiveResult {
  logId: string
  newBalance: number
  fulfilled: boolean
}

export async function receiveRestock(
  requestId: string,
  quantityReceived: number,
  lotNumber?: string | null,
  notes?: string | null,
  unitCost?: number | null,
  expiryDate?: string | null,
  supplierId?: string | null,
): Promise<ReceiveResult> {
  type ReceiveRestockRow = { log_id: string; new_balance: number; fulfilled: boolean }
  const result = await supabase.rpc('receive_restock', {
    p_request_id: requestId,
    p_quantity_received: quantityReceived,
    p_lot_number: lotNumber ?? null,
    p_notes: notes ?? null,
    p_unit_cost: unitCost ?? null,
    p_expiry_date: expiryDate ?? null,
    p_supplier_id: supplierId ?? null,
  }) as { data: ReceiveRestockRow[] | null; error: { message: string } | null }
  const { data, error } = result

  if (error) throw new Error(error.message)
  const row = (data as ReceiveRestockRow[])[0]
  return { logId: row.log_id, newBalance: row.new_balance, fulfilled: row.fulfilled }
}

export async function autoPropose(thresholdDays = 7, restockDays = 14): Promise<number> {
  const result = await supabase.rpc('auto_propose_restocks', {
    p_threshold_days: thresholdDays,
    p_restock_days:   restockDays,
  }) as unknown as { data: number | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? 0
}

export async function fetchReceives(requestId: string): Promise<RestockReceive[]> {
  const { data, error } = await supabase
    .from('restock_receives')
    .select('*')
    .eq('request_id', requestId)
    .order('received_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as RestockReceive[]
}
