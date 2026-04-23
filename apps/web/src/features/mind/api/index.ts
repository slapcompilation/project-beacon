// Layer: Mind — API calls for Mind Layer strategy RPCs

import { supabase } from '@/lib/supabase/client'
import type {
  ProcurementInsightRow, ChainBenchmarkRow, ChainPropertyRow, ChainHealthTrendRow, WasteCostRow, CostVarianceRow,
  PurchaseOrder, POLine, POInvoice, POSummaryRow,
  PriceDriftRow, SpendConcentrationRow, SupplierExpiryRateRow,
  PriceVarianceBySupplierRow, SpendForecastRow,
  GLAccountMapping, GLExportRow, GLExportSummary,
  POMatchRow, PODiscrepancy,
  InvoiceIntelligenceRow, SupplierSynthesisRow,
  SmartProposalRow,
  CPORPeriodRow, CostByCategoryRow,
  BudgetVsActualRow, BudgetTrendRow,
  SupplierContract,
} from '@beacon/types'

export async function fetchProcurementInsights(days: number): Promise<ProcurementInsightRow[]> {
  const result = await supabase.rpc('get_procurement_insights', { p_days: days }) as unknown as { data: ProcurementInsightRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchChainBenchmarks(days: number): Promise<ChainBenchmarkRow[]> {
  const result = await supabase.rpc('get_chain_benchmarks', { p_days: days }) as unknown as { data: ChainBenchmarkRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchChainOverview(days: number): Promise<ChainPropertyRow[]> {
  const result = await supabase.rpc('get_chain_overview', { p_days: days }) as unknown as { data: ChainPropertyRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchChainHealthTrend(monthsBack = 6): Promise<ChainHealthTrendRow[]> {
  const result = await supabase.rpc('get_chain_health_trend', { p_months_back: monthsBack }) as unknown as { data: ChainHealthTrendRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchWasteCost(days: number): Promise<WasteCostRow[]> {
  const result = await supabase.rpc('get_waste_cost', { p_days: days }) as unknown as { data: WasteCostRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchCostVarianceReport(days: number): Promise<CostVarianceRow[]> {
  const result = await supabase.rpc('get_cost_variance_report', { p_days: days }) as unknown as { data: CostVarianceRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Supplier Intelligence ────────────────────────────────────────────────────

export async function fetchSupplierSynthesis(days: number): Promise<SupplierSynthesisRow[]> {
  const result = await supabase.rpc('get_supplier_synthesis', { p_days: days }) as unknown as { data: SupplierSynthesisRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchInvoiceIntelligence(days: number): Promise<InvoiceIntelligenceRow[]> {
  const result = await supabase.rpc('get_invoice_intelligence', { p_days: days }) as unknown as { data: InvoiceIntelligenceRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchPriceDrift(windowMonths: number, thresholdPct: number): Promise<PriceDriftRow[]> {
  const result = await supabase.rpc('get_price_drift', { p_window_months: windowMonths, p_threshold_pct: thresholdPct }) as unknown as { data: PriceDriftRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchSpendConcentration(months: number): Promise<SpendConcentrationRow[]> {
  const result = await supabase.rpc('get_spend_concentration', { p_months: months }) as unknown as { data: SpendConcentrationRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchSupplierExpiryRates(days: number): Promise<SupplierExpiryRateRow[]> {
  const result = await supabase.rpc('get_supplier_expiry_rates', { p_days: days }) as unknown as { data: SupplierExpiryRateRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchPriceVarianceBySupplier(days: number): Promise<PriceVarianceBySupplierRow[]> {
  const result = await supabase.rpc('get_price_variance_by_supplier', { p_days: days }) as unknown as { data: PriceVarianceBySupplierRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchSpendForecast(): Promise<SpendForecastRow[]> {
  const result = await supabase.rpc('get_spend_forecast') as unknown as { data: SpendForecastRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export interface CreatePOInput {
  supplierId:           string | null
  supplierName:         string
  poNumber:             string
  expectedDeliveryDate?: string | null
  notes?:               string | null
  lines: {
    variantId:   string
    requestId?:  string | null
    orderedQty:  number
    unitCost:    number
    notes?:      string | null
  }[]
}

export async function createPurchaseOrder(input: CreatePOInput): Promise<string> {
  const result = await supabase.rpc('create_purchase_order', {
    p_supplier_id:             input.supplierId,
    p_supplier_name:           input.supplierName,
    p_po_number:               input.poNumber,
    p_expected_delivery_date:  input.expectedDeliveryDate ?? null,
    p_notes:                   input.notes ?? null,
    p_lines: input.lines.map((l) => ({
      variant_id:   l.variantId,
      request_id:   l.requestId ?? null,
      ordered_qty:  l.orderedQty,
      unit_cost:    l.unitCost,
      notes:        l.notes ?? null,
    })),
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? ''
}

export async function updatePOStatus(poId: string, status: PurchaseOrder['status'], expectedDeliveryDate?: string | null): Promise<void> {
  const result = await supabase.rpc('update_po_status', {
    p_po_id:                   poId,
    p_status:                  status,
    p_expected_delivery_date:  expectedDeliveryDate ?? null,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

export async function fetchPOSummary(): Promise<POSummaryRow[]> {
  const result = await supabase.rpc('get_po_summary') as unknown as { data: POSummaryRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchPOLines(poId: string): Promise<(POLine & { variant_name: string; sku: string; product_name: string })[]> {
  const { data, error } = await supabase
    .from('purchase_order_lines')
    .select('*, product_variants(name, sku, products(name))')
    .eq('po_id', poId)
    .order('id')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    ...r,
    variant_name: (r.product_variants as { name: string } | null)?.name ?? '',
    sku:          (r.product_variants as { sku: string } | null)?.sku ?? '',
    product_name: ((r.product_variants as { products?: { name: string } | null } | null)?.products?.name) ?? '',
  }))
}

export async function fetchPOInvoices(poId: string): Promise<POInvoice[]> {
  const { data, error } = await supabase
    .from('po_invoices')
    .select('*')
    .eq('po_id', poId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as POInvoice[]
}

export async function submitPOInvoice(
  poId: string,
  invoiceNumber: string,
  invoiceDate: string,
  invoiceAmount: number,
  notes?: string | null,
): Promise<string> {
  const result = await supabase.rpc('submit_po_invoice', {
    p_po_id:          poId,
    p_invoice_number: invoiceNumber,
    p_invoice_date:   invoiceDate,
    p_invoice_amount: invoiceAmount,
    p_notes:          notes ?? null,
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? ''
}

export async function updateInvoiceStatus(invoiceId: string, status: POInvoice['status'], notes?: string | null): Promise<void> {
  const result = await supabase.rpc('update_invoice_status', {
    p_invoice_id: invoiceId,
    p_status:     status,
    p_notes:      notes ?? null,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

// ─── GL Export (Sprint 11a) ───────────────────────────────────────────────────

export async function fetchGLAccountMappings(): Promise<GLAccountMapping[]> {
  const { data, error } = await supabase
    .from('gl_account_mappings')
    .select('*')
    .order('mapping_type')
    .order('mapping_key')
  if (error) throw new Error(error.message)
  return (data ?? []) as GLAccountMapping[]
}

export async function upsertGLMapping(
  mappingType: string,
  mappingKey: string,
  glAccountCode: string,
  glAccountName: string,
): Promise<void> {
  const result = await supabase.rpc('upsert_gl_mapping', {
    p_mapping_type:    mappingType,
    p_mapping_key:     mappingKey,
    p_gl_account_code: glAccountCode,
    p_gl_account_name: glAccountName,
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

export async function deleteGLMapping(mappingType: string, mappingKey: string): Promise<void> {
  const result = await supabase.rpc('delete_gl_mapping', {
    p_mapping_type: mappingType,
    p_mapping_key:  mappingKey,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

export async function fetchGLExport(
  from: string,
  to: string,
  includeWriteOffs = true,
): Promise<GLExportRow[]> {
  const result = await supabase.rpc('get_gl_export', {
    p_from:               from,
    p_to:                 to,
    p_include_write_offs: includeWriteOffs,
  }) as unknown as { data: GLExportRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchGLExportSummary(from: string, to: string): Promise<GLExportSummary | null> {
  const result = await supabase.rpc('get_gl_export_summary', {
    p_from: from,
    p_to:   to,
  }) as unknown as { data: GLExportSummary[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data?.[0] ?? null
}

// ─── 3-Way Match (Sprint 11b) ─────────────────────────────────────────────────

export async function fetchPOMatch(poId: string): Promise<POMatchRow | null> {
  const result = await supabase.rpc('get_po_match', { p_po_id: poId }) as unknown as { data: POMatchRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data?.[0] ?? null
}

export async function fetchPOMatchSummary(days = 90): Promise<POMatchRow[]> {
  const result = await supabase.rpc('get_po_match_summary', { p_days: days }) as unknown as { data: POMatchRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchPODiscrepancies(): Promise<PODiscrepancy[]> {
  const { data, error } = await supabase
    .from('po_discrepancies')
    .select('*')
    .order('detected_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PODiscrepancy[]
}

export async function reviewPODiscrepancy(
  discrepancyId: string,
  status: 'approved' | 'rejected',
  notes?: string | null,
): Promise<void> {
  const result = await supabase.rpc('review_po_discrepancy', {
    p_discrepancy_id: discrepancyId,
    p_status:         status,
    p_notes:          notes ?? null,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

// ─── CPOR Intelligence (Sprint 9) ────────────────────────────────────────────

export async function fetchCPORByPeriod(windowMonths: number): Promise<CPORPeriodRow[]> {
  const result = await supabase.rpc('get_cpor_by_period', { p_window_months: windowMonths }) as unknown as {
    data: CPORPeriodRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchCostByCategory(windowDays: number): Promise<CostByCategoryRow[]> {
  const result = await supabase.rpc('get_cost_by_category', { p_window_days: windowDays }) as unknown as {
    data: CostByCategoryRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Smart Restock Proposals (Sprint 8) ──────────────────────────────────────

export async function fetchSmartProposals(): Promise<SmartProposalRow[]> {
  const result = await supabase.rpc('get_smart_proposals') as unknown as {
    data: SmartProposalRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

/**
 * Approve a proposal that has a known preferred supplier.
 * Atomically creates an approved restock_request + draft PO,
 * then clears any dismissal snooze for this variant.
 * Returns the new purchase_order.id.
 */
export async function approveProposalWithPO(
  variantId:    string,
  qty:          number,
  supplierId:   string,
  supplierName: string,
  unitCost:     number,
  leadDays:     number,
): Promise<string> {
  const result = await supabase.rpc('auto_create_restock_po', {
    p_variant_id:    variantId,
    p_qty:           qty,
    p_supplier_id:   supplierId,
    p_supplier_name: supplierName,
    p_unit_cost:     unitCost,
    p_lead_days:     leadDays,
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  // Clear dismissal so the variant surfaces correctly if stock drops again
  await supabase.rpc('clear_proposal_dismissal', { p_variant_id: variantId })
  return result.data ?? ''
}

/**
 * Approve a proposal without a known supplier.
 * Creates a pending restock_request only — operator assigns supplier later.
 * Returns the new restock_request.id.
 */
export async function approveProposalNoSupplier(
  variantId: string,
  qty:       number,
): Promise<string> {
  const result = await supabase.rpc('create_restock_request_only', {
    p_variant_id: variantId,
    p_qty:        qty,
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  await supabase.rpc('clear_proposal_dismissal', { p_variant_id: variantId })
  return result.data ?? ''
}

// ─── Budget vs Actual (Sprint 11) ─────────────────────────────────────────────

export async function fetchBudgetVsActual(year?: number, month?: number): Promise<BudgetVsActualRow[]> {
  const result = await supabase.rpc('get_budget_vs_actual', {
    p_year:  year  ?? null,
    p_month: month ?? null,
  }) as unknown as { data: BudgetVsActualRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchBudgetTrend(monthsBack = 6): Promise<BudgetTrendRow[]> {
  const result = await supabase.rpc('get_budget_trend', { p_months_back: monthsBack }) as unknown as {
    data: BudgetTrendRow[] | null; error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function upsertBudgetAllocation(
  categoryId: string | null,
  periodMonth: Date,
  allocatedAmount: number,
): Promise<string> {
  const result = await supabase.rpc('upsert_budget_allocation', {
    p_category_id:      categoryId,
    p_period_month:     periodMonth.toISOString().slice(0, 10),
    p_allocated_amount: allocatedAmount,
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? ''
}

export async function deleteBudgetAllocation(
  categoryId: string | null,
  periodMonth: Date,
): Promise<void> {
  const result = await supabase.rpc('delete_budget_allocation', {
    p_category_id:  categoryId,
    p_period_month: periodMonth.toISOString().slice(0, 10),
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

// ─── Supplier Contracts (Sprint 24) ──────────────────────────────────────────

export async function fetchSupplierContracts(): Promise<SupplierContract[]> {
  const result = await supabase.rpc('get_supplier_contracts') as unknown as { data: SupplierContract[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function upsertSupplierContract(input: {
  id?:               string
  supplier_id?:      string | null
  supplier_name:     string
  variant_id:        string
  contracted_price:  number
  min_order_qty?:    number | null
  contract_start:    string
  contract_end?:     string | null
  notes?:            string | null
}): Promise<string> {
  const result = await supabase.rpc('upsert_supplier_contract', {
    p_id:               input.id               ?? null,
    p_supplier_id:      input.supplier_id       ?? null,
    p_supplier_name:    input.supplier_name,
    p_variant_id:       input.variant_id,
    p_contracted_price: input.contracted_price,
    p_min_order_qty:    input.min_order_qty     ?? null,
    p_contract_start:   input.contract_start,
    p_contract_end:     input.contract_end      ?? null,
    p_notes:            input.notes             ?? null,
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? ''
}

export async function deactivateSupplierContract(id: string): Promise<void> {
  const result = await supabase.rpc('deactivate_supplier_contract', { p_id: id }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

/** Snooze a proposal for N hours (default 48). It re-surfaces after that. */
export async function dismissProposal(variantId: string, hours = 48): Promise<void> {
  const result = await supabase.rpc('dismiss_proposal', {
    p_variant_id: variantId,
    p_hours:      hours,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}
