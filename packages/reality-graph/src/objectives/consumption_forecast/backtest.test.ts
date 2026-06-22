import { describe, it, expect } from 'vitest'
import { backtestForecastAdapters, type BacktestCase } from './backtest'
import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'
import type { StockLogRow } from '../../tools/graph_reader'
import { baselineRolling30dAdapter } from './baseline_rolling_30d'
import { seasonalNaiveV1Adapter } from './seasonal_naive_v1'

const NOW = new Date('2026-06-22T12:00:00Z')

function log(daysAgo: number, delta: number): StockLogRow {
  return {
    id: `l-${String(daysAgo)}-${String(delta)}-${String(Math.random())}`,
    variant_id: 'v1', hotel_id: 'h1', delta,
    created_at: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  }
}

/** Fixed-prediction adapter so error math is exact. */
function fake(name: string, predict: number): ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> {
  return {
    name, version: '1.0.0', inputSchema: {}, outputSchema: {},
    runInference: () => Promise.resolve({ projectedUnits: predict, basis: name, confidence: 0.5, sampleSize: 0 }),
  }
}

// 10 distinct training days (8..17d ago) + holdout consumption of 30 (1,3,5d ago).
function caseWith(cohort: string, trainDays: number, actual: number): BacktestCase {
  const logs: StockLogRow[] = []
  for (let d = 8; d < 8 + trainDays; d++) logs.push(log(d, -5))
  if (actual > 0) { logs.push(log(1, -actual / 2)); logs.push(log(3, -actual / 2)) }
  return { variantId: 'v1', label: 'Cola', cohort, logs }
}

describe('backtestForecastAdapters', () => {
  it('computes APE and signed bias against the holdout actual', async () => {
    const r = await backtestForecastAdapters([fake('A', 33), fake('B', 24)], [caseWith('all', 10, 30)], { holdoutDays: 7, now: NOW })
    const a = r.scores.find((s) => s.adapter === 'A')!
    const b = r.scores.find((s) => s.adapter === 'B')!
    expect(a.mape).toBeCloseTo(0.1, 5)   // |33-30|/30
    expect(a.bias).toBeCloseTo(0.1, 5)   // over-forecast
    expect(b.mape).toBeCloseTo(0.2, 5)   // |24-30|/30
    expect(b.bias).toBeCloseTo(-0.2, 5)  // under-forecast
  })

  it('names the lowest-MAPE adapter the winner', async () => {
    const r = await backtestForecastAdapters([fake('A', 33), fake('B', 24)], [caseWith('all', 10, 30)], { holdoutDays: 7, now: NOW })
    expect(r.winner).toBe('A')
  })

  it('excludes cases with too little training history', async () => {
    const r = await backtestForecastAdapters([fake('A', 33)], [caseWith('all', 3, 30)], { holdoutDays: 7, now: NOW, minTrainDays: 7 })
    expect(r.scores[0].cases).toBe(0)
    expect(r.winner).toBeNull()
  })

  it('excludes cases with no actual consumption in the holdout', async () => {
    const r = await backtestForecastAdapters([fake('A', 33)], [caseWith('all', 10, 0)], { holdoutDays: 7, now: NOW })
    expect(r.scores[0].cases).toBe(0)
  })

  it('breaks scores down by cohort', async () => {
    const r = await backtestForecastAdapters(
      [fake('A', 30)],
      [caseWith('Perishable', 10, 30), caseWith('Shelf-stable', 10, 20)],
      { holdoutDays: 7, now: NOW },
    )
    const a = r.scores.find((s) => s.adapter === 'A')!
    expect(a.byCohort.map((c) => c.cohort)).toEqual(['Perishable', 'Shelf-stable'])
    expect(a.byCohort.every((c) => c.cases === 1)).toBe(true)
  })

  it('runs the real baseline + seasonal adapters and picks a winner', async () => {
    // Weekly-patterned series: heavy Fri/Sat, light midweek — favours seasonal.
    const logs: StockLogRow[] = []
    for (let d = 1; d <= 35; d++) {
      const dow = new Date(NOW.getTime() - d * 86_400_000).getUTCDay()
      const heavy = dow === 5 || dow === 6
      logs.push(log(d, -(heavy ? 20 : 5)))
    }
    const r = await backtestForecastAdapters(
      [baselineRolling30dAdapter, seasonalNaiveV1Adapter],
      [{ variantId: 'v1', label: 'Cola', cohort: 'Mixers', logs }],
      { holdoutDays: 7, now: NOW },
    )
    expect(r.scores.every((s) => s.cases === 1)).toBe(true)
    expect(['baseline-rolling-30d-avg', 'seasonal-naive-v1']).toContain(r.winner)
  })
})
