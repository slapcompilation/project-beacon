// Layer: Flow — stocktake session API (begin, count lines, commit/cancel)
import { supabase } from '@/lib/supabase/client'
import type { StocktakeSession, StocktakeLine } from '@beacon/types'

export async function fetchActiveDraftSession(hotelId: string): Promise<StocktakeSession | null> {
  const { data, error } = (await supabase
    .from('stocktake_sessions')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('status', 'draft')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as unknown as { data: StocktakeSession | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return data
}

export async function fetchSessionLines(sessionId: string): Promise<StocktakeLine[]> {
  const { data, error } = (await supabase
    .from('stocktake_lines')
    .select('*, product_variants(name, sku, barcode, cost, products(name))')
    .eq('session_id', sessionId)
    .order('id')) as unknown as { data: StocktakeLine[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function beginStocktake(note?: string): Promise<string> {
  const { data, error } = (await supabase.rpc('begin_stocktake', {
    p_note: note ?? null,
  })) as unknown as { data: string | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data as string // session id
}

export async function updateStocktakeLine(lineId: string, countedQty: number | null): Promise<void> {
  const { error } = await supabase
    .from('stocktake_lines')
    .update({ counted_qty: countedQty })
    .eq('id', lineId)

  if (error) throw new Error(error.message)
}

export async function commitStocktake(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('commit_stocktake', { p_session_id: sessionId })
  if (error) throw new Error(error.message)
}

export async function cancelStocktake(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_stocktake', { p_session_id: sessionId })
  if (error) throw new Error(error.message)
}
