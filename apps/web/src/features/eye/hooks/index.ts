// Layer: Eye — TanStack Query hooks for Eye Layer intelligence
export { useCopilotChat } from './useCopilotChat'
export type { ChatMessage, ToolTraceEntry, ActionProposal } from './useCopilotChat'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { addDays } from 'date-fns'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchWasteRadar, fetchConsumptionStats, fetchConsumptionForecast, fetchDeadStock,
  fetchConsumptionSpikes, fetchShiftIntelligence, fetchInventoryIntelligence,
  fetchOccupancyLogs, upsertOccupancyDay, deleteOccupancyDay,
  fetchSupplierWasteAnalytics,
  fetchPMSHealth, fetchBookingForecasts, upsertBookingForecast, deleteBookingForecast,
  fetchVariantIntelligence, fetchStockPressure,
  fetchAnomalyExplanation, fetchCausalTrace, logCausalTrace, fetchSimulation, fetchOptimalPAR,
  fetchTeamPerformance,
  fetchProductPerformance,
  fetchActiveIncidents,
  fetchStocktakeSessions, fetchStocktakeVariance,
  fetchSupplierReliability,
  fetchOccupancyAdjustedForecast,
  fetchProposalQualitySummary,
} from '../api'
import type { InventoryIntelligenceRow } from '../api'
import type { ConsumptionForecastRow, ProductWithVariants, ProductVariant, Supplier, SimulationScenarioType } from '@beacon/types'

// ─── Predictive Restock Engine ─────────────────────────────────────────────────
// Eye Layer · Move from reactive (alert when low) to predictive (flag before the
// order window closes). Computes order deadlines from burn rate + lead time.

export interface PredictiveRestockRow {
  variantId: string
  productName: string
  variantName: string
  currentStock: number
  avgDaily: number
  daysUntilZero: number
  stockoutDate: Date
  leadTimeDays: number
  /** Days from today until order must be placed. ≤0 = missed window. */
  orderDeadlineDays: number
  orderDeadlineDate: Date
  urgency: 'critical' | 'warning' | 'watch'
  hasOpenRequest: boolean
  parLevel: number
  /** Quantity covering par + consumption during lead time */
  recommendedQty: number
}

/**
 * Pure computation — no hooks. Call from any component that already has the
 * three data sources. TanStack Query deduplicates the underlying fetches.
 */
export function computePredictiveRestocks(
  forecast: ConsumptionForecastRow[],
  products: ProductWithVariants[],
  suppliersMap: Map<string, Supplier>,
  openRequestVariantIds: Set<string>,
  today: Date = new Date(),
): PredictiveRestockRow[] {
  // Build variant-id → {default_supplier_id, low_stock_threshold} in one pass
  const variantMeta = new Map<string, { supplierId: string | null; parLevel: number }>()
  for (const product of products) {
    for (const v of product.product_variants) {
      variantMeta.set(v.id, {
        supplierId: (v as ProductVariant & { default_supplier_id?: string | null }).default_supplier_id ?? null,
        parLevel: v.low_stock_threshold,
      })
    }
  }

  const results: PredictiveRestockRow[] = []

  for (const row of forecast) {
    if (row.days_until_zero === null || row.days_until_zero > 60) continue
    const meta = variantMeta.get(row.variant_id)
    if (!meta?.supplierId) continue
    const supplier = suppliersMap.get(meta.supplierId)
    const leadTimeDays = (supplier as (Supplier & { lead_time_days?: number | null }) | undefined)?.lead_time_days ?? null
    if (!leadTimeDays) continue

    const daysUntilZero = Math.round(row.days_until_zero)
    const orderDeadlineDays = daysUntilZero - leadTimeDays
    if (orderDeadlineDays > 14) continue // not urgent enough yet

    const urgency: PredictiveRestockRow['urgency'] =
      orderDeadlineDays <= 0 ? 'critical' :
      orderDeadlineDays <= 3 ? 'warning'  : 'watch'

    const avgDaily = row.avg_daily
    const parLevel = meta.parLevel
    const recommendedQty = parLevel > 0
      ? Math.max(Math.ceil(parLevel - row.current_stock + avgDaily * leadTimeDays), parLevel)
      : Math.max(Math.ceil(avgDaily * leadTimeDays * 1.5), row.recommended_order_qty)

    results.push({
      variantId:         row.variant_id,
      productName:       row.product_name,
      variantName:       row.variant_name,
      currentStock:      row.current_stock,
      avgDaily,
      daysUntilZero,
      stockoutDate:      addDays(today, daysUntilZero),
      leadTimeDays,
      orderDeadlineDays,
      orderDeadlineDate: addDays(today, Math.max(orderDeadlineDays, 0)),
      urgency,
      hasOpenRequest:    openRequestVariantIds.has(row.variant_id),
      parLevel,
      recommendedQty,
    })
  }

  return results.sort((a, b) => a.orderDeadlineDays - b.orderDeadlineDays)
}

export const eyeKeys = {
  wasteRadar:       (hotelId: string)                                        => ['eye', 'waste-radar', hotelId] as const,
  consumptionStats: (hotelId: string, days: number)                         => ['eye', 'consumption-stats', hotelId, days] as const,
  forecast:         (hotelId: string, days: number)                         => ['eye', 'forecast', hotelId, days] as const,
  deadStock:        (hotelId: string, idleDays: number)                     => ['eye', 'dead-stock', hotelId, idleDays] as const,
  spikes:           (hotelId: string, windowDays: number, mult: number)     => ['eye', 'spikes', hotelId, windowDays, mult] as const,
  intelligence:     (hotelId: string, windowDays: number)                   => ['eye', 'intelligence', hotelId, windowDays] as const,
  supplierWaste:    (hotelId: string, days: number)                         => ['eye', 'supplier-waste', hotelId, days] as const,
  all:              (hotelId: string)                                        => ['eye', hotelId] as const,
}

/** Variants with write-off spikes ≥50% above their 4-week baseline, ranked by anomaly_score. */
export function useWasteRadar() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: eyeKeys.wasteRadar(hotelId ?? ''),
    queryFn: fetchWasteRadar,
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

export function useConsumptionStats(days = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: eyeKeys.consumptionStats(hotelId ?? '', days),
    queryFn: () => fetchConsumptionStats(days),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useConsumptionForecast(days = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: eyeKeys.forecast(hotelId ?? '', days),
    queryFn: () => fetchConsumptionForecast(days),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useDeadStock(idleDays = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: eyeKeys.deadStock(hotelId ?? '', idleDays),
    queryFn: () => fetchDeadStock(idleDays),
    enabled: !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

export function useConsumptionSpikes(windowDays = 7, multiplier = 3.0) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: eyeKeys.spikes(hotelId ?? '', windowDays, multiplier),
    queryFn: () => fetchConsumptionSpikes(windowDays, multiplier),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

// Returns a Map<variantId, row> for O(1) lookup in Inventory/Restock pages
export function useInventoryIntelligence() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'inventory-intelligence', hotelId],
    queryFn: fetchInventoryIntelligence,
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
    select: (rows: InventoryIntelligenceRow[]) =>
      new Map(rows.map((r) => [r.variant_id, r])),
  })
}

export function useShiftIntelligence(windowDays = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: eyeKeys.intelligence(hotelId ?? '', windowDays),
    queryFn: () => fetchShiftIntelligence(windowDays),
    enabled: !!hotelId,
    staleTime: 3 * 60 * 1000, // 3 min — near real-time for shift use
  })
}

// ─── Occupancy sensing ────────────────────────────────────────────────────────

export function useOccupancyLogs(fromDate: string, toDate: string) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['occupancy', hotelId, fromDate, toDate],
    queryFn: () => fetchOccupancyLogs(fromDate, toDate),
    enabled: !!hotelId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useUpsertOccupancy() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ date, pct }: { date: string; pct: number }) =>
      upsertOccupancyDay(date, pct),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['occupancy', hotelId] })
    },
  })
}

export function useDeleteOccupancy() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (date: string) => deleteOccupancyDay(date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['occupancy', hotelId] })
    },
  })
}

// ─── Supplier waste analytics ──────────────────────────────────────────────────
// Eye Layer · Which suppliers correlate with the most write-offs and expiry waste?

export function useSupplierWasteAnalytics(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: eyeKeys.supplierWaste(hotelId ?? '', days),
    queryFn: () => fetchSupplierWasteAnalytics(days),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── PMS health + Booking forecasts ──────────────────────────────────────────
// Eye Layer · Occupancy Automation (Sprint 9)

export function usePMSHealth() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'pms-health', hotelId],
    queryFn: fetchPMSHealth,
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,        // match refetch interval to avoid stale-window double-fetches
    refetchInterval: 5 * 60 * 1000,  // poll every 5 min for live indicator
  })
}

export function useBookingForecasts(fromDate: string, toDate: string) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'booking-forecasts', hotelId, fromDate, toDate],
    queryFn: () => fetchBookingForecasts(fromDate, toDate),
    enabled: !!hotelId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useUpsertBookingForecast() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ date, pct }: { date: string; pct: number }) =>
      upsertBookingForecast(date, pct),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['eye', 'booking-forecasts', hotelId] })
    },
  })
}

export function useDeleteBookingForecast() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (date: string) => deleteBookingForecast(date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['eye', 'booking-forecasts', hotelId] })
    },
  })
}

// ─── Variant intelligence + stock pressure (Sprint 13) ────────────────────────

/** Cross-layer intelligence context for one variant. Pass null to disable. */
export function useVariantIntelligence(variantId: string | null) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'variant-intelligence', hotelId, variantId],
    queryFn:  () => fetchVariantIntelligence(variantId ?? ''),
    enabled:  !!hotelId && !!variantId,
    staleTime: 2 * 60 * 1000,
  })
}

// ─── Root Cause Attribution (Sprint 4) ────────────────────────────────────────

/**
 * Fetches the structured anomaly explanation for one variant.
 * Only fires when `enabled` is true — keep false until operator explicitly requests it.
 * Logs the trace view as a side effect on first successful fetch.
 */
export function useAnomalyExplanation(
  variantId:   string | null,
  anomalyType: string = 'auto',
  enabled      = false,
) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['eye', 'anomaly-explanation', hotelId, variantId, anomalyType],
    queryFn:   async () => {
      const result = await fetchAnomalyExplanation(variantId ?? '', anomalyType)
      // Fire-and-forget usage log — does not affect the return value
      if (result && variantId) {
        void logCausalTrace('variant', variantId)
      }
      return result
    },
    enabled:   !!hotelId && !!variantId && enabled,
    staleTime: 5 * 60 * 1000,
    retry:     1,
  })
}

/**
 * Fetches the ordered causal chain for any graph node.
 * Only fires when `enabled` is true.
 */
export function useCausalTrace(
  rootType: 'variant' | 'notification' | 'restock_request',
  rootId:   string | null,
  enabled   = false,
) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['eye', 'causal-trace', hotelId, rootType, rootId],
    queryFn:   () => fetchCausalTrace(rootType, rootId ?? '', 8),
    enabled:   !!hotelId && !!rootId && enabled,
    staleTime: 5 * 60 * 1000,
    retry:     1,
  })
}

// ─── Probabilistic PAR Engine (Sprint 6) ─────────────────────────────────────

/**
 * Returns optimal PAR recommendations for all active variants.
 * Re-fetches automatically when service level changes (included in query key).
 */
export function useOptimalPAR(serviceLevel = 0.95) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['eye', 'optimal-par', hotelId, serviceLevel],
    queryFn:   () => fetchOptimalPAR(serviceLevel),
    enabled:   !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Simulation Cockpit (Sprint 5) ────────────────────────────────────────────

/**
 * Runs what-if scenario. Only fires when `runTrigger` is non-null.
 * Include `runTrigger` in the query key so changing it forces a fresh fetch
 * without the operator having to wait for cache expiry.
 */
export function useSimulation(
  scenarioType: SimulationScenarioType | null,
  paramValue:   number,
  runTrigger:   number | null,  // increment to re-run with the same params
) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['eye', 'simulation', hotelId, scenarioType, paramValue, runTrigger],
    queryFn:   () => fetchSimulation(scenarioType!, paramValue),
    enabled:   !!hotelId && !!scenarioType && runTrigger !== null,
    staleTime: 0,       // always re-fetch — simulation result depends on exact params
    retry:     1,
  })
}

// ─── Team Performance Intelligence (Sprint 7) ─────────────────────────────────

/**
 * Per-member waste attribution, outlier detection, and team benchmarking.
 * Mind Layer · admin/owner only.
 */
export function useTeamPerformance(windowDays = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['mind', 'team-performance', hotelId, windowDays],
    queryFn:  () => fetchTeamPerformance(windowDays),
    enabled:  !!hotelId,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

/** Forward-looking pressure list: all variants running out within 14 days, sorted by urgency. */
export function useStockPressure() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'stock-pressure', hotelId],
    queryFn:  fetchStockPressure,
    enabled:  !!hotelId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

// ─── Stocktake Variance Intelligence (Sprint 10) ──────────────────────────────

export function useStocktakeSessions(limit = 10) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'stocktake-sessions', hotelId, limit],
    queryFn:  () => fetchStocktakeSessions(limit),
    enabled:  !!hotelId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

export function useStocktakeVariance(sessionId: string | null) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'stocktake-variance', hotelId, sessionId],
    queryFn:  () => fetchStocktakeVariance(sessionId ?? ''),
    enabled:  !!hotelId && !!sessionId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Product Performance Intelligence (Sprint 12) ─────────────────────────────

export function useProductPerformance(windowDays = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'product-performance', hotelId, windowDays],
    queryFn:  () => fetchProductPerformance(windowDays),
    enabled:  !!hotelId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// ─── Cross-Domain Incident Correlation (Sprint 13) ────────────────────────────

export function useActiveIncidents(windowDays = 7) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'active-incidents', hotelId, windowDays],
    queryFn:  () => fetchActiveIncidents(windowDays),
    enabled:  !!hotelId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

// ─── Occupancy-Adjusted Forecast (Phase C) ───────────────────────────────────

export function useOccupancyAdjustedForecast(forecastDays = 14, lookbackDays = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'occupancy-forecast', hotelId, forecastDays, lookbackDays],
    queryFn: () => fetchOccupancyAdjustedForecast(forecastDays, lookbackDays),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

// ─── Proposal Quality Summary (Phase D — Feedback Flywheel) ─────────────────

export function useProposalQualitySummary(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'proposal-quality', hotelId, days],
    queryFn: () => fetchProposalQualitySummary(days),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

// ─── Supplier Reliability Scorecard (Sprint 28) ───────────────────────────────

export function useSupplierReliability(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['eye', 'supplier-reliability', hotelId, days],
    queryFn:  () => fetchSupplierReliability(days),
    enabled:  !!hotelId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
