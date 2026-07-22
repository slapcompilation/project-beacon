// Layer: Mind — TanStack Query hooks for Mind Layer strategy

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import {
  fetchProcurementInsights, fetchChainBenchmarks, fetchChainOverview, fetchChainHealthTrend, fetchWasteCost, fetchCostVarianceReport,
  updatePOStatus, fetchPOSummary, fetchPOLines, fetchPOInvoices,
  updateInvoiceStatus,
  fetchSupplierSynthesis,
  fetchPriceDrift, fetchSpendConcentration, fetchSupplierExpiryRates,
  fetchPriceVarianceBySupplier, fetchSpendForecast,
  fetchGLAccountMappings, upsertGLMapping, deleteGLMapping,
  fetchGLExport, fetchGLExportSummary,
  fetchPOMatch, fetchPOMatchSummary, fetchPODiscrepancies, reviewPODiscrepancy,
  fetchInvoiceIntelligence,
  fetchSmartProposals, approveProposalWithPO, approveProposalNoSupplier, dismissProposal,
  fetchCPORByPeriod, fetchCostByCategory,
  fetchBudgetVsActual, fetchBudgetTrend, upsertBudgetAllocation, deleteBudgetAllocation,
  fetchSupplierContracts, upsertSupplierContract, deactivateSupplierContract,
} from '../api'
import type { CreatePOInput } from '../api'
import type { PurchaseOrder, POInvoice } from '@beacon/types'

export const mindKeys = {
  contracts:            (hotelId: string)                             => ['mind', 'contracts', hotelId] as const,
  supplierSynthesis:    (hotelId: string, days: number)               => ['mind', 'supplier-synthesis', hotelId, days] as const,
  procurement:          (hotelId: string, days: number)               => ['mind', 'procurement', hotelId, days] as const,
  invoiceIntelligence:  (hotelId: string, days: number)               => ['mind', 'invoice-intelligence', hotelId, days] as const,
  chainBenchmarks:      (hotelId: string, days: number)               => ['mind', 'chain-benchmarks', hotelId, days] as const,
  chainOverview:      (hotelId: string, days: number)               => ['mind', 'chain-overview', hotelId, days] as const,
  wasteCost:          (hotelId: string, days: number)               => ['mind', 'waste-cost', hotelId, days] as const,
  costVariance:       (hotelId: string, days: number)               => ['mind', 'cost-variance', hotelId, days] as const,
  chainHealthTrend:   (hotelId: string, months: number)             => ['mind', 'chain-health-trend', hotelId, months] as const,
  poSummary:          (hotelId: string)                             => ['mind', 'po-summary', hotelId] as const,
  poLines:            (poId: string)                                => ['mind', 'po-lines', poId] as const,
  poInvoices:         (poId: string)                                => ['mind', 'po-invoices', poId] as const,
  priceDrift:         (hotelId: string, months: number, pct: number) => ['mind', 'price-drift', hotelId, months, pct] as const,
  spendConcentration: (hotelId: string, months: number)             => ['mind', 'spend-concentration', hotelId, months] as const,
  expiryRates:        (hotelId: string, days: number)               => ['mind', 'expiry-rates', hotelId, days] as const,
  priceVariance:      (hotelId: string, days: number)               => ['mind', 'price-variance', hotelId, days] as const,
  spendForecast:      (hotelId: string)                             => ['mind', 'spend-forecast', hotelId] as const,
  glMappings:         (hotelId: string)                             => ['mind', 'gl-mappings', hotelId] as const,
  glExport:           (hotelId: string, from: string, to: string, wo: boolean) => ['mind', 'gl-export', hotelId, from, to, wo] as const,
  glSummary:          (hotelId: string, from: string, to: string)  => ['mind', 'gl-summary', hotelId, from, to] as const,
  poMatch:            (poId: string)                                => ['mind', 'po-match', poId] as const,
  poMatchSummary:     (hotelId: string, days: number)               => ['mind', 'po-match-summary', hotelId, days] as const,
  poDiscrepancies:    (hotelId: string)                             => ['mind', 'po-discrepancies', hotelId] as const,
  smartProposals:     (hotelId: string)                             => ['mind', 'smart-proposals', hotelId] as const,
  cpor:               (hotelId: string, months: number)             => ['mind', 'cpor', hotelId, months] as const,
  costByCategory:     (hotelId: string, days: number)               => ['mind', 'cost-by-category', hotelId, days] as const,
  budgetVsActual:     (hotelId: string, y: number, m: number)       => ['mind', 'budget-vs-actual', hotelId, y, m] as const,
  budgetTrend:        (hotelId: string, months: number)             => ['mind', 'budget-trend', hotelId, months] as const,
  all:                (hotelId: string)                             => ['mind', hotelId] as const,
}

export function useProcurementInsights(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.procurement(hotelId ?? '', days),
    queryFn: () => fetchProcurementInsights(days),
    enabled: !!hotelId,
    staleTime: 10 * 60 * 1000, // 10 min — strategy data doesn't need to be live
  })
}

export function useInvoiceIntelligence(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.invoiceIntelligence(hotelId ?? '', days),
    queryFn:  () => fetchInvoiceIntelligence(days),
    enabled:  !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

export function useChainBenchmarks(days = 30, enabled = true) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.chainBenchmarks(hotelId ?? '', days),
    queryFn: () => fetchChainBenchmarks(days),
    staleTime: 10 * 60 * 1000,
    enabled: !!hotelId && enabled,
  })
}

export function useChainOverview(days = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.chainOverview(hotelId ?? '', days),
    queryFn: () => fetchChainOverview(days),
    staleTime: 5 * 60 * 1000,
    enabled: !!hotelId,
  })
}

// Org-scope variant for the portfolio Home. get_chain_overview is org-wide
// (server reads auth_org_id), so it must fire without a single active hotel —
// unlike useChainOverview, which gates on the active property. Owner only.
export function useChainOverviewOrg(days = 30) {
  const role = useAuthStore((s) => s.role)
  return useQuery({
    queryKey: mindKeys.chainOverview('org', days),
    queryFn: () => fetchChainOverview(days),
    staleTime: 5 * 60 * 1000,
    enabled: role === 'owner',
  })
}

/** Monthly waste_cost + activity per property for sparklines (last N months). */
export function useChainHealthTrend(monthsBack = 6) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.chainHealthTrend(hotelId ?? '', monthsBack),
    queryFn:  () => fetchChainHealthTrend(monthsBack),
    staleTime: 15 * 60 * 1000, // 15 min — historical data changes slowly
    enabled:  !!hotelId,
  })
}

export function useWasteCost(days = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.wasteCost(hotelId ?? '', days),
    queryFn: () => fetchWasteCost(days),
    enabled: !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

export function useCostVarianceReport(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.costVariance(hotelId ?? '', days),
    queryFn: () => fetchCostVarianceReport(days),
    enabled: !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

// ─── Purchase Order hooks ──────────────────────────────────────────────────────

export function usePOSummary() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.poSummary(hotelId ?? ''),
    queryFn: fetchPOSummary,
    enabled: !!hotelId,
    staleTime: 30 * 1000,
  })
}

export function usePOLines(poId: string | null) {
  return useQuery({
    queryKey: mindKeys.poLines(poId ?? ''),
    queryFn: () => fetchPOLines(poId ?? ''),
    enabled: !!poId,
    staleTime: 60 * 1000,
  })
}

export function usePOInvoices(poId: string | null) {
  return useQuery({
    queryKey: mindKeys.poInvoices(poId ?? ''),
    queryFn: () => fetchPOInvoices(poId ?? ''),
    enabled: !!poId,
    staleTime: 30 * 1000,
  })
}

export function useCreatePO() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (input: CreatePOInput) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'CREATE_PO', hotelId, ...input },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
      return result
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.poSummary(hotelId ?? '') })
      toast.success('Purchase order saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdatePOStatus() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ poId, status, expectedDeliveryDate }: { poId: string; status: PurchaseOrder['status']; expectedDeliveryDate?: string | null }) =>
      updatePOStatus(poId, status, expectedDeliveryDate),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.poSummary(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSubmitPOInvoice() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async ({ poId, invoiceNumber, invoiceDate, invoiceAmount, notes }: {
      poId: string; invoiceNumber: string; invoiceDate: string; invoiceAmount: number; notes?: string | null
    }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'SUBMIT_PO_INVOICE', poId, hotelId, invoiceNumber, invoiceDate, invoiceAmount, notes },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
      return result
    },
    onSuccess: (_res, vars) => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.poSummary(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: mindKeys.poInvoices(vars.poId) })
      toast.success('Invoice submitted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Supplier Intelligence hooks ──────────────────────────────────────────────

export function useSupplierSynthesis(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.supplierSynthesis(hotelId ?? '', days),
    queryFn:  () => fetchSupplierSynthesis(days),
    enabled:  !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

export function usePriceDrift(windowMonths = 6, thresholdPct = 5) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.priceDrift(hotelId ?? '', windowMonths, thresholdPct),
    queryFn: () => fetchPriceDrift(windowMonths, thresholdPct),
    enabled: !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

export function useSpendConcentration(months = 6) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.spendConcentration(hotelId ?? '', months),
    queryFn: () => fetchSpendConcentration(months),
    enabled: !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

export function useSupplierExpiryRates(days = 180) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.expiryRates(hotelId ?? '', days),
    queryFn: () => fetchSupplierExpiryRates(days),
    enabled: !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

export function usePriceVarianceBySupplier(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.priceVariance(hotelId ?? '', days),
    queryFn: () => fetchPriceVarianceBySupplier(days),
    enabled: !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

export function useSpendForecast() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.spendForecast(hotelId ?? ''),
    queryFn: fetchSpendForecast,
    enabled: !!hotelId,
    staleTime: 15 * 60 * 1000,
  })
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ invoiceId, status, notes }: { invoiceId: string; status: POInvoice['status']; poId: string; notes?: string | null }) =>
      updateInvoiceStatus(invoiceId, status, notes),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.poSummary(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: mindKeys.poInvoices(vars.poId) })
      const label = vars.status === 'approved' ? 'Invoice approved' : vars.status === 'disputed' ? 'Invoice marked disputed' : 'Invoice updated'
      toast.success(label)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── GL Export (Sprint 11a) ───────────────────────────────────────────────────

export function useGLAccountMappings() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.glMappings(hotelId ?? ''),
    queryFn:  fetchGLAccountMappings,
    enabled:  !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpsertGLMapping() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: ({ mappingType, mappingKey, code, name }: {
      mappingType: string; mappingKey: string; code: string; name: string
    }) => upsertGLMapping(mappingType, mappingKey, code, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.glMappings(hotelId ?? '') })
    },
  })
}

export function useDeleteGLMapping() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: ({ mappingType, mappingKey }: { mappingType: string; mappingKey: string }) =>
      deleteGLMapping(mappingType, mappingKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.glMappings(hotelId ?? '') })
    },
  })
}

export function useGLExport(from: string, to: string, includeWriteOffs: boolean, enabled: boolean) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.glExport(hotelId ?? '', from, to, includeWriteOffs),
    queryFn:  () => fetchGLExport(from, to, includeWriteOffs),
    enabled:  !!hotelId && enabled,
    staleTime: 2 * 60 * 1000,
  })
}

export function useGLExportSummary(from: string, to: string) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.glSummary(hotelId ?? '', from, to),
    queryFn:  () => fetchGLExportSummary(from, to),
    enabled:  !!hotelId,
    staleTime: 2 * 60 * 1000,
  })
}

// ─── 3-Way Match (Sprint 11b) ─────────────────────────────────────────────────

export function usePOMatch(poId: string | null) {
  return useQuery({
    queryKey: mindKeys.poMatch(poId ?? ''),
    queryFn:  () => fetchPOMatch(poId ?? ''),
    enabled:  !!poId,
    staleTime: 60 * 1000,
  })
}

export function usePOMatchSummary(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.poMatchSummary(hotelId ?? '', days),
    queryFn:  () => fetchPOMatchSummary(days),
    enabled:  !!hotelId,
    staleTime: 2 * 60 * 1000,
  })
}

export function usePODiscrepancies() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.poDiscrepancies(hotelId ?? ''),
    queryFn:  fetchPODiscrepancies,
    enabled:  !!hotelId,
    staleTime: 30 * 1000,
  })
}

export function useReviewPODiscrepancy() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: ({ discrepancyId, status, notes }: {
      discrepancyId: string; status: 'approved' | 'rejected'; notes?: string | null
    }) => reviewPODiscrepancy(discrepancyId, status, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.poDiscrepancies(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['mind', 'po-match-summary'] })
      toast.success('Discrepancy reviewed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Smart Restock Proposals (Sprint 8) ──────────────────────────────────────

/** Probabilistically-enriched restock proposals. Refetches on window focus. */
export function useSmartProposals() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.smartProposals(hotelId ?? ''),
    queryFn:  fetchSmartProposals,
    enabled:  !!hotelId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

/** Approve with supplier — creates approved restock_request + draft PO atomically. */
export function useApproveProposalWithPO() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({
      variantId, qty, supplierId, supplierName, unitCost, leadDays,
    }: {
      variantId: string; qty: number; supplierId: string
      supplierName: string; unitCost: number; leadDays: number
    }) => approveProposalWithPO(variantId, qty, supplierId, supplierName, unitCost, leadDays),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.smartProposals(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: mindKeys.poSummary(hotelId ?? '') })
      toast.success('Approved — restock request and draft PO created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Approve without supplier — creates pending restock_request only. */
export function useApproveProposalNoSupplier() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ variantId, qty }: { variantId: string; qty: number }) =>
      approveProposalNoSupplier(variantId, qty),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.smartProposals(hotelId ?? '') })
      toast.success('Restock request created — assign supplier in Procurement')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Snooze a proposal for N hours (default 48). Re-surfaces automatically. */
export function useDismissProposal() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ variantId, hours }: { variantId: string; hours?: number }) =>
      dismissProposal(variantId, hours),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.smartProposals(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── CPOR Intelligence (Sprint 9) ────────────────────────────────────────────

/** Monthly CPOR trend with MoM deltas. Stale after 10 min — financial data. */
export function useCPORByPeriod(windowMonths = 3) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.cpor(hotelId ?? '', windowMonths),
    queryFn:  () => fetchCPORByPeriod(windowMonths),
    enabled:  !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

/** Category cost breakdown. Stale after 10 min. */
export function useCostByCategory(windowDays = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.costByCategory(hotelId ?? '', windowDays),
    queryFn:  () => fetchCostByCategory(windowDays),
    enabled:  !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

// ─── Budget vs Actual (Sprint 11) ─────────────────────────────────────────────

export function useBudgetVsActual(year: number, month: number) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.budgetVsActual(hotelId ?? '', year, month),
    queryFn:  () => fetchBudgetVsActual(year, month),
    enabled:  !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBudgetTrend(monthsBack = 6) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.budgetTrend(hotelId ?? '', monthsBack),
    queryFn:  () => fetchBudgetTrend(monthsBack),
    enabled:  !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

export function useUpsertBudgetAllocation() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: ({ categoryId, periodMonth, amount }: { categoryId: string | null; periodMonth: Date; amount: number }) =>
      upsertBudgetAllocation(categoryId, periodMonth, amount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mind', 'budget-vs-actual', hotelId ?? ''] })
      void queryClient.invalidateQueries({ queryKey: ['mind', 'budget-trend',     hotelId ?? ''] })
    },
    onError: (err: Error) => { toast.error(err.message) },
  })
}

export function useDeleteBudgetAllocation() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: ({ categoryId, periodMonth }: { categoryId: string | null; periodMonth: Date }) =>
      deleteBudgetAllocation(categoryId, periodMonth),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mind', 'budget-vs-actual', hotelId ?? ''] })
      void queryClient.invalidateQueries({ queryKey: ['mind', 'budget-trend',     hotelId ?? ''] })
    },
    onError: (err: Error) => { toast.error(err.message) },
  })
}

// ─── Supplier Contracts (Sprint 24) ──────────────────────────────────────────

export function useSupplierContracts() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: mindKeys.contracts(hotelId ?? ''),
    queryFn:  fetchSupplierContracts,
    enabled:  !!hotelId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useUpsertSupplierContract() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: upsertSupplierContract,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.contracts(hotelId ?? '') })
      toast.success('Contract saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeactivateSupplierContract() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: (id: string) => deactivateSupplierContract(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mindKeys.contracts(hotelId ?? '') })
      toast.success('Contract deactivated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
