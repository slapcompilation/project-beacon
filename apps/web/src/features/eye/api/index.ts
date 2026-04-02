// Layer: Eye — API calls for Eye Layer intelligence RPCs

import { supabase } from '@/lib/supabase/client'
import type { WasteRadarRow, ConsumptionStatRow, ConsumptionForecastRow, DeadStockRow, ConsumptionSpikeRow, OccupancyLog, SupplierWasteRow, BookingForecast, PMSHealthRow, VariantIntelligence, StockPressureItem, AnomalyExplanation, CausalTraceStep, SimulationScenarioType, SimulationResult, OptimalPARRow, TeamPerformanceRow, StocktakeSessionSummary, StocktakeVarianceRow } from '@beacon/types'

// ─── Shift Intelligence ────────────────────────────────────────────────────────

export interface ShiftIntelligenceRow {
  signal_type:     'depletion_risk' | 'waste_spike' | 'dead_stock' | 'cost_at_risk'
  variant_id:      string
  product_name:    string
  variant_name:    string
  sku:             string
  current_stock:   number
  urgency_score:   number   // 0–1
  confidence:      number   // 0–1
  days_until_zero: number | null
  days_band:       number | null  // ±uncertainty in days
  cost_at_risk:    number
  avg_daily:       number
  signal_note:     string
  basis:           string
}

export async function fetchShiftIntelligence(windowDays = 30): Promise<ShiftIntelligenceRow[]> {
  const result = await supabase.rpc('get_shift_intelligence', { p_window_days: windowDays }) as unknown as { data: ShiftIntelligenceRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

/** All variants with write-off spikes ≥50% above their 4-week baseline, ranked by anomaly_score. */
export async function fetchWasteRadar(): Promise<WasteRadarRow[]> {
  const result = await supabase.rpc('get_waste_radar') as unknown as { data: WasteRadarRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchConsumptionStats(days: number): Promise<ConsumptionStatRow[]> {
  const result = await supabase.rpc('get_consumption_stats', { p_days: days }) as unknown as { data: ConsumptionStatRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchConsumptionForecast(days: number): Promise<ConsumptionForecastRow[]> {
  const result = await supabase.rpc('get_consumption_forecast', { p_days: days }) as unknown as { data: ConsumptionForecastRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchDeadStock(idleDays: number): Promise<DeadStockRow[]> {
  const result = await supabase.rpc('get_dead_stock', { p_idle_days: idleDays }) as unknown as { data: DeadStockRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchConsumptionSpikes(windowDays: number, multiplier: number): Promise<ConsumptionSpikeRow[]> {
  const result = await supabase.rpc('get_consumption_spikes', { p_window_days: windowDays, p_multiplier: multiplier }) as unknown as { data: ConsumptionSpikeRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Occupancy sensing ────────────────────────────────────────────────────────

export async function fetchOccupancyLogs(fromDate: string, toDate: string): Promise<OccupancyLog[]> {
  const { data, error } = (await supabase
    .from('occupancy_logs')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })) as unknown as {
    data: OccupancyLog[] | null
    error: { message: string } | null
  }
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertOccupancyDay(
  date: string,
  occupancyPct: number,
): Promise<string> {
  const result = await supabase.rpc('upsert_occupancy', {
    p_date: date,
    p_occupancy_pct: occupancyPct,
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? ''
}

export async function deleteOccupancyDay(date: string): Promise<void> {
  const result = await supabase.rpc('delete_occupancy', {
    p_date: date,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

// ─── Booking forecasts + PMS health ──────────────────────────────────────────

export async function fetchPMSHealth(): Promise<PMSHealthRow[]> {
  const result = await supabase.rpc('get_pms_health') as unknown as {
    data: PMSHealthRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchBookingForecasts(fromDate: string, toDate: string): Promise<BookingForecast[]> {
  const { data, error } = (await supabase
    .from('booking_forecasts')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })) as unknown as {
    data: BookingForecast[] | null
    error: { message: string } | null
  }
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertBookingForecast(
  date: string,
  expectedOccupancyPct: number,
): Promise<string> {
  const result = await supabase.rpc('upsert_booking_forecast', {
    p_date:               date,
    p_expected_occupancy: expectedOccupancyPct,
    p_horizon_source:     'manual',
  }) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? ''
}

export async function deleteBookingForecast(date: string): Promise<void> {
  const result = await supabase.rpc('delete_booking_forecast', {
    p_date: date,
  }) as unknown as { data: null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}

// ─── Inventory intelligence ────────────────────────────────────────────────────

export interface InventoryIntelligenceRow {
  variant_id:             string
  last_received_at:       string | null
  last_received_days_ago: number | null
  curr_week_consumed:     number
  prev_week_consumed:     number
  trend_pct:              number | null
}

export async function fetchSupplierWasteAnalytics(days = 90): Promise<SupplierWasteRow[]> {
  const result = await supabase.rpc('get_supplier_waste_analytics', { p_days: days }) as unknown as { data: SupplierWasteRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchInventoryIntelligence(): Promise<InventoryIntelligenceRow[]> {
  const result = await supabase.rpc('get_inventory_intelligence') as unknown as {
    data: InventoryIntelligenceRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Variant intelligence + stock pressure (Sprint 13) ────────────────────────

// ─── Root Cause Attribution (Sprint 4) ────────────────────────────────────────

/**
 * Returns a structured cross-domain explanation for the dominant anomaly on this variant.
 * anomalyType: 'auto' | 'waste_spike' | 'stock_depletion'
 * Returns null when the variant is not found or belongs to another hotel.
 */
export async function fetchAnomalyExplanation(
  variantId:   string,
  anomalyType: string = 'auto',
): Promise<AnomalyExplanation | null> {
  const result = await supabase.rpc('explain_anomaly', {
    p_variant_id:   variantId,
    p_anomaly_type: anomalyType,
  }) as unknown as { data: AnomalyExplanation | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data
}

/**
 * Returns the ordered causal chain from the existing get_causal_trace() RPC.
 * rootType: 'variant' | 'notification' | 'restock_request'
 */
export async function fetchCausalTrace(
  rootType: 'variant' | 'notification' | 'restock_request',
  rootId:   string,
  maxDepth  = 6,
): Promise<CausalTraceStep[]> {
  const result = await supabase.rpc('get_causal_trace', {
    p_root_type: rootType,
    p_root_id:   rootId,
    p_max_depth: maxDepth,
  }) as unknown as { data: CausalTraceStep[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

/** Fire-and-forget: log that a causal trace was viewed (for accuracy tracking). */
export async function logCausalTrace(
  rootType: string,
  rootId:   string,
): Promise<void> {
  await supabase.rpc('log_causal_trace', {
    p_root_type: rootType,
    p_root_id:   rootId,
  })
}

/** Full cross-layer context for a single variant. Returns null if variant not found. */
export async function fetchVariantIntelligence(variantId: string): Promise<VariantIntelligence | null> {
  const result = await supabase.rpc('get_variant_intelligence', { p_variant_id: variantId }) as unknown as {
    data: VariantIntelligence[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? [])[0] ?? null
}

/**
 * Returns per-variant optimal PAR levels computed from actual consumption variance,
 * supplier delivery history, and upcoming occupancy forecast.
 * p_service_level: 0.80 – 0.999 (e.g. 0.95 = 95% in-stock guarantee)
 */
export async function fetchOptimalPAR(serviceLevel = 0.95): Promise<OptimalPARRow[]> {
  const result = await supabase.rpc('compute_optimal_par', {
    p_service_level: serviceLevel,
  }) as unknown as { data: OptimalPARRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

/**
 * Runs what-if scenario simulation against current stockout probability baseline.
 * Returns null when the session has no hotel context.
 */
export async function fetchSimulation(
  scenarioType: SimulationScenarioType,
  paramValue:   number,
  variantIds?:  string[],
): Promise<SimulationResult | null> {
  const result = await supabase.rpc('simulate_scenario', {
    p_scenario_type: scenarioType,
    p_param_value:   paramValue,
    p_variant_ids:   variantIds ?? null,
  }) as unknown as { data: SimulationResult | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data
}

// ─── Team Performance Intelligence (Sprint 7) ─────────────────────────────────

export async function fetchTeamPerformance(windowDays = 30): Promise<TeamPerformanceRow[]> {
  const result = await supabase.rpc('get_team_performance', { p_window_days: windowDays }) as unknown as {
    data: TeamPerformanceRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Stocktake Variance Intelligence (Sprint 10) ──────────────────────────────

export async function fetchStocktakeSessions(limit = 10): Promise<StocktakeSessionSummary[]> {
  const result = await supabase.rpc('get_stocktake_sessions', { p_limit: limit }) as unknown as {
    data: StocktakeSessionSummary[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function fetchStocktakeVariance(sessionId: string): Promise<StocktakeVarianceRow[]> {
  const result = await supabase.rpc('get_stocktake_variance', { p_session_id: sessionId }) as unknown as {
    data: StocktakeVarianceRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

/** All variants with measurable consumption running out within 14 days, sorted by days_until_zero ASC. */
export async function fetchStockPressure(): Promise<StockPressureItem[]> {
  const result = await supabase.rpc('get_stock_pressure') as unknown as {
    data: StockPressureItem[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}
