// automations table — CRUD + variant readings for the composer's live preview.
// Config-as-data (like constraints): written directly under RLS, not through the
// Action Registry (that's for graph mutations). org + author come from column
// defaults (auth_org_id / auth.uid), so the client sends only the rule.

import { supabase } from '@/lib/supabase/client'
import type {
  Automation, AutomationReading, AutomationSubject, AutomationEffect,
  AutomationGate, AutomationStage, ComparisonOp,
} from '@beacon/reality-graph'

export interface AutomationRow {
  id: string
  organization_id: string
  hotel_id: string | null
  name: string
  subject: AutomationSubject
  /** NULL when the automation fires on a cohort instead (migration 249). */
  when_metric: string | null
  when_op: ComparisonOp | null
  when_value: number | null
  object_set_id: string | null
  effect: AutomationEffect
  gate: AutomationGate
  confidence: number
  enabled: boolean
  stage: AutomationStage
  version: number
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export function rowToAutomation(r: AutomationRow, setNames?: ReadonlyMap<string, string>): Automation {
  return {
    id: r.id, name: r.name, organizationId: r.organization_id, hotelId: r.hotel_id,
    when: r.when_metric !== null && r.when_op !== null && r.when_value !== null
      ? { subject: r.subject, metric: r.when_metric, op: r.when_op, value: r.when_value }
      : null,
    objectSetId: r.object_set_id,
    objectSetName: r.object_set_id ? setNames?.get(r.object_set_id) : undefined,
    effect: r.effect, gate: r.gate, confidence: r.confidence,
    enabled: r.enabled, stage: r.stage, version: r.version,
  }
}

export async function fetchAutomations(): Promise<AutomationRow[]> {
  const { data, error } = await supabase.from('automations').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as AutomationRow[]
}

export interface CreateAutomationInput {
  hotelId: string | null
  name: string
  subject: AutomationSubject
  /** Exactly one of these. The DB enforces it too (migration 249). */
  when: { metric: string; op: ComparisonOp; value: number } | null
  objectSetId: string | null
  effect: AutomationEffect
  gate: AutomationGate
  confidence: number
  stage: AutomationStage
}

export async function createAutomation(i: CreateAutomationInput): Promise<AutomationRow> {
  const { data, error } = await supabase
    .from('automations')
    .insert({
      hotel_id:    i.hotelId,
      name:        i.name,
      subject:     i.subject,
      when_metric: i.when?.metric  ?? null,
      when_op:     i.when?.op      ?? null,
      when_value:  i.when?.value   ?? null,
      object_set_id: i.objectSetId,
      effect:      i.effect,
      gate:        i.gate,
      confidence:  i.confidence,
      stage:       i.stage,
    })
    .select('*')
    .single<AutomationRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function setAutomationEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('automations').update({ enabled, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setAutomationStage(id: string, stage: AutomationStage): Promise<void> {
  const { error } = await supabase.from('automations').update({ stage, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteAutomation(id: string): Promise<void> {
  const { error } = await supabase.from('automations').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// Live-preview readings: the active hotel's variants as AutomationReadings, with
// the same metrics the reality-graph evaluator expects (computed from columns).
export async function fetchVariantReadings(hotelId: string): Promise<AutomationReading[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, current_stock, low_stock_threshold, products!inner(name, hotel_id)')
    .eq('products.hotel_id', hotelId)
  if (error) throw new Error(error.message)
  interface Row { id: string; current_stock: number | null; low_stock_threshold: number | null; products: { name: string } | { name: string }[] | null }
  return (data as unknown as Row[]).map((r) => {
    const stock = Number(r.current_stock) || 0
    const par = Number(r.low_stock_threshold) || 0
    const prod = Array.isArray(r.products) ? r.products[0] : r.products
    return {
      subject: 'variant' as const,
      subjectId: r.id,
      subjectName: prod?.name ?? 'Variant',
      metrics: {
        current_stock:    stock,
        par_level:        par,
        units_below_par:  Math.max(0, par - stock),
        stock_vs_par_pct: par > 0 ? Math.round((stock / par) * 100) : (stock > 0 ? 100 : 0),
      },
    }
  })
}
