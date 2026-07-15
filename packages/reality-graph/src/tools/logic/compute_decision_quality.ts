// Layer: compute (Logic Tool, category 'logic'). Ontology: reads a variant's
// StockLogs; no writes. Scope: hotel (inherits caller).
//
// The decision-quality north-star (roadmap Q0). A forecast is only as good as the
// decision it drives, and a restock decision fails in exactly two directions:
//   under-order  → stock hits zero → STOCKOUT-DAYS   (the cost of forecasting low)
//   over-order   → stock spoils     → WASTE-UNITS     (the cost of forecasting high)
// These are the real-world face of the forecast's signed bias. Every later phase
// (Q1 routing EWMA into sizing, Q3 governing autonomy) must move THIS number, not
// just MAPE — a model with great error feeding a decision nobody trusts is worth
// nothing. Pure + deterministic (now injected); the tool wraps it over the reader.

import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader, StockLogRow } from '../graph_reader'
import { isWasteLog } from './waste_classification'

const DAY = 86_400_000
const DEFAULT_WINDOW_DAYS = 30

export interface DecisionQualityScore {
  windowDays: number
  /** Distinct days on-hand balance was recorded at/below zero. */
  stockoutDays: number
  /** Distinct days a balance was recorded at all — the availability denominator. */
  daysWithBalance: number
  /** 1 − stockoutDays / windowDays. The share of the window stock was available.
   *  Only meaningful when daysWithBalance > 0 (else no balance signal → 1). */
  availabilityRate: number
  /** Units removed as waste/spoilage in the window. */
  wasteUnits: number
  /** Units consumed (sold/used) in the window — the non-waste negative deltas. */
  consumedUnits: number
  /** wasteUnits / (wasteUnits + consumedUnits). The share of throughput lost. */
  wasteRate: number
  basis: string
  /** Trust in this read, driven by how much of the window carried balance data. */
  confidence: number
}

/** Grades realized inventory outcomes over the window ending at `now`. Pure. */
export function scoreDecisionQuality(
  logs: ReadonlyArray<StockLogRow>,
  now: number,
  windowDays = DEFAULT_WINDOW_DAYS,
): DecisionQualityScore {
  const from = now - windowDays * DAY
  const inWindow = logs.filter((l) => {
    const t = new Date(l.created_at).getTime()
    return t > from && t <= now
  })

  const stockoutDaySet = new Set<string>()
  const balanceDaySet = new Set<string>()
  let wasteUnits = 0
  let consumedUnits = 0
  for (const l of inWindow) {
    const day = l.created_at.slice(0, 10)
    if (l.balance_after != null) {
      balanceDaySet.add(day)
      if (l.balance_after <= 0) stockoutDaySet.add(day)
    }
    if (l.delta < 0) {
      if (isWasteLog(l)) wasteUnits += Math.abs(l.delta)
      else consumedUnits += Math.abs(l.delta)
    }
  }

  const stockoutDays = stockoutDaySet.size
  const daysWithBalance = balanceDaySet.size
  const availabilityRate = daysWithBalance > 0 ? Math.max(0, 1 - stockoutDays / windowDays) : 1
  const throughput = wasteUnits + consumedUnits
  const wasteRate = throughput > 0 ? wasteUnits / throughput : 0
  // Availability is the headline and needs balance data; confidence tracks how
  // much of the window carried it. Waste metrics don't need balance and stay valid.
  const confidence = Number(Math.min(0.9, 0.2 + (daysWithBalance / windowDays) * 0.7).toFixed(2))

  return {
    windowDays,
    stockoutDays,
    daysWithBalance,
    availabilityRate: Number(availabilityRate.toFixed(4)),
    wasteUnits,
    consumedUnits,
    wasteRate: Number(wasteRate.toFixed(4)),
    basis: 'inventory-outcomes-v1',
    confidence,
  }
}

const inputSchema = z.object({
  variantId:  z.string().uuid(),
  windowDays: z.number().int().min(7).max(90).default(DEFAULT_WINDOW_DAYS),
})

const outputSchema = z.object({
  variantId:        z.string().uuid(),
  windowDays:       z.number().int().positive(),
  stockoutDays:     z.number().int().nonnegative(),
  daysWithBalance:  z.number().int().nonnegative(),
  availabilityRate: z.number().min(0).max(1),
  wasteUnits:       z.number().nonnegative(),
  consumedUnits:    z.number().nonnegative(),
  wasteRate:        z.number().min(0).max(1),
  basis:            z.string(),
  confidence:       z.number().min(0).max(1),
})

export type ComputeDecisionQualityInput = z.infer<typeof inputSchema>
export type ComputeDecisionQualityOutput = z.infer<typeof outputSchema>

export function makeComputeDecisionQualityTool(
  reader: GraphReader,
): LogicTool<ComputeDecisionQualityInput, ComputeDecisionQualityOutput> {
  return {
    name: 'compute_decision_quality',
    category: 'logic',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Grades realized inventory outcomes for a variant: stock-out days + availability rate (the cost ' +
      'of under-ordering) and waste units + waste rate (the cost of over-ordering). This is the ' +
      'decision-quality north-star a forecast is ultimately judged by — the real-world face of forecast ' +
      'bias. Use to check whether the pipeline is producing good decisions, not just low error.',
    inputSchema,
    outputSchema,
    traversableLinks: ['consumes'],
    examples: [
      {
        input:  { variantId: '00000000-0000-0000-0000-000000000000', windowDays: 30 },
        output: {
          variantId: '00000000-0000-0000-0000-000000000000', windowDays: 30,
          stockoutDays: 2, daysWithBalance: 28, availabilityRate: 0.9333,
          wasteUnits: 14, consumedUnits: 420, wasteRate: 0.0323,
          basis: 'inventory-outcomes-v1', confidence: 0.85,
        },
      },
    ],
    invoke: async (input) => {
      const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS
      const logs = await reader.getStockLogs(input.variantId, windowDays)
      const s = scoreDecisionQuality(logs, Date.now(), windowDays)
      return { variantId: input.variantId, ...s }
    },
  }
}
