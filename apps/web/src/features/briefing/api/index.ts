// Layer: Cross-layer — Briefing action feed API
import { supabase } from '@/lib/supabase/client'
import type { BriefingAction, SituationScore, IntelligenceHistoryRow } from '@beacon/types'

export async function fetchBriefingActions(): Promise<BriefingAction[]> {
  const result = await supabase.rpc('get_briefing_actions') as unknown as {
    data: BriefingAction[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchSituationScore(): Promise<SituationScore> {
  const result = await supabase.rpc('get_situation_score') as unknown as {
    data: SituationScore | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? { level: 'nominal', score: 0, incidents: [] }
}

/** Idempotent — server no-ops if a snapshot already exists for today. */
export async function captureIntelligenceSnapshot(): Promise<void> {
  const result = await supabase.rpc('capture_intelligence_snapshot') as unknown as {
    data: null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
}

export async function fetchIntelligenceHistory(days = 30): Promise<IntelligenceHistoryRow[]> {
  const result = await supabase.rpc('get_intelligence_history', { p_days: days }) as unknown as {
    data: IntelligenceHistoryRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export interface ApproveRestockProposalParams {
  variantId:    string
  qty:          number
  supplierId:   string
  supplierName: string
  unitCost:     number
  leadDays:     number
}

/** Creates an approved restock request + draft PO in one atomic RPC call. */
export async function approveRestockProposal(
  params: ApproveRestockProposalParams,
): Promise<string> {
  const result = await supabase.rpc('auto_create_restock_po', {
    p_variant_id:    params.variantId,
    p_qty:           params.qty,
    p_supplier_id:   params.supplierId,
    p_supplier_name: params.supplierName,
    p_unit_cost:     params.unitCost,
    p_lead_days:     params.leadDays,
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? ''
}
