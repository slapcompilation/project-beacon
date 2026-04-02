import { supabase } from '@/lib/supabase/client'
import type { Supplier, SupplierScorecard, DeliveryEvent, DeliveryEventInput, SupplierLeverageRow, SupplierPriceHistoryRow } from '@beacon/types'

export interface SupplierInput {
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  notes?: string | null
}

export async function fetchSuppliers(hotelId: string): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('name')

  if (error) throw new Error(error.message)
  return data as Supplier[]
}

export async function createSupplier(hotelId: string, input: SupplierInput): Promise<Supplier> {
  const result = await supabase
    .from('suppliers')
    .insert({ hotel_id: hotelId, ...input })
    .select()
    .single()
  const { error } = result
  const data = result.data as Supplier

  if (error) throw new Error(error.message)
  return data
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier> {
  const result = await supabase
    .from('suppliers')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  const { error } = result
  const data = result.data as Supplier

  if (error) throw new Error(error.message)
  return data
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchSupplierScorecard(hotelId: string): Promise<SupplierScorecard[]> {
  const { data, error } = await supabase
    .from('supplier_scorecard')
    .select('*')
    .eq('hotel_id', hotelId)

  if (error) throw new Error(error.message)
  return (data ?? []) as SupplierScorecard[]
}

export async function fetchSupplierLeverage(days: number): Promise<SupplierLeverageRow[]> {
  const result = await supabase.rpc('get_supplier_leverage', { p_days: days }) as unknown as {
    data: SupplierLeverageRow[] | null; error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchSupplierPriceHistory(supplierId: string, days: number): Promise<SupplierPriceHistoryRow[]> {
  const result = await supabase.rpc('get_supplier_price_history', {
    p_supplier_id: supplierId,
    p_days: days,
  }) as unknown as { data: SupplierPriceHistoryRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function logDeliveryEvent(hotelId: string, input: DeliveryEventInput): Promise<DeliveryEvent> {
  const result = await supabase
    .from('delivery_events')
    .insert({ hotel_id: hotelId, ...input })
    .select()
    .single()
  if (result.error) throw new Error(result.error.message)
  return result.data as DeliveryEvent
}
