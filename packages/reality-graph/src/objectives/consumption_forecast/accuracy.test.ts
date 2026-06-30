import { describe, expect, it } from 'vitest'
import { reconstructObservations, scoreForecastAccuracy, rollingCutoffs, type ForecastObservation } from './accuracy'
import { baselineRolling30dAdapter } from './baseline_rolling_30d'
import type { StockLogRow } from '../../tools/graph_reader'

const DAY = 86_400_000
const NOW = new Date('2026-06-01T12:00:00.000Z').getTime()
const at = (k: number) => new Date(NOW - k * DAY).toISOString()

function log(k: number, delta: number, balance: number | null = 100): StockLogRow {
  return { id: `l-${k}-${delta}`, variant_id: 'v1', hotel_id: 'h1', delta, created_at: at(k), balance_after: balance }
}

describe('rollingCutoffs', () => {
  it('tiles closed realized windows back from now', () => {
    const cs = rollingCutoffs(NOW, 7, 4)
    expect(cs).toHaveLength(4)
    expect(cs[0]).toBe(NOW - 7 * DAY)        // newest window ends exactly at now
    expect(cs[1] - cs[0]).toBe(-7 * DAY)     // spaced one horizon apart
  })
})

describe('reconstructObservations + scoreForecastAccuracy', () => {
  it('a stable series scores ~zero error and is not censored', async () => {
    // 2/day for 60 days, stock always positive.
    const logs = Array.from({ length: 60 }, (_, k) => log(k, -2))
    const obs = await reconstructObservations(logs, {
      horizonDays: 7, adapter: baselineRolling30dAdapter, cutoffs: rollingCutoffs(NOW, 7, 4),
    })
    expect(obs).toHaveLength(4)
    const score = scoreForecastAccuracy(obs)
    expect(score.mape).toBeLessThan(0.05)
    expect(Math.abs(score.biasPct)).toBeLessThan(0.05)
    expect(score.censoredBiasPct).toBeNull()          // no censored window
    expect(obs.every((o) => o.censored === false)).toBe(true)
  })

  it('training-period censoring shows up as a negative (under-forecast) bias', async () => {
    // Old window: stock kept hitting zero, only 5/day got sold (true demand was
    // higher). Recent realized window: restocked, 10/day actually sold. The
    // forecast trains on the censored 5/day and under-projects what then sells.
    const censoredTraining = Array.from({ length: 37 }, (_, i) => log(8 + i, -5, 0))   // k=8..44, balance 0
    const realized        = Array.from({ length: 7 },  (_, k) => log(k, -10, 50))      // k=0..6, balance 50
    const logs = [...censoredTraining, ...realized]

    const obs = await reconstructObservations(logs, {
      horizonDays: 7, adapter: baselineRolling30dAdapter, cutoffs: [NOW - 7 * DAY],
    })
    expect(obs).toHaveLength(1)
    expect(obs[0].projectedUnits).toBeLessThan(obs[0].realizedUnits)   // under-forecast
    expect(obs[0].censored).toBe(true)                                 // training window hit zero

    const score = scoreForecastAccuracy(obs)
    expect(score.biasPct).toBeLessThan(0)            // systematic under-forecast
    expect(score.censoredBiasPct).toBeLessThan(0)    // and it's the censored cohort
  })

  it('aggregates MAPE / bias / per-basis exactly', () => {
    const obs: ForecastObservation[] = [
      { asOf: 0, horizonDays: 7, projectedUnits: 10, realizedUnits: 10, basis: 'b1', confidence: 0.8, sampleSize: 5, signedError: 0,  absPctError: 0,   censored: false },
      { asOf: 0, horizonDays: 7, projectedUnits: 8,  realizedUnits: 10, basis: 'b1', confidence: 0.8, sampleSize: 5, signedError: -2, absPctError: 0.2, censored: true },
    ]
    const s = scoreForecastAccuracy(obs)
    expect(s.n).toBe(2)
    expect(s.mape).toBeCloseTo(0.1, 10)
    expect(s.meanSignedError).toBeCloseTo(-1, 10)
    expect(s.biasPct).toBeCloseTo(-0.1, 10)          // (0/10 + -2/10) / 2
    expect(s.censoredBiasPct).toBeCloseTo(-0.2, 10)  // censored obs only
    expect(s.byBasis).toEqual([{ basis: 'b1', n: 2, mape: 0.1, biasPct: -0.1 }])
  })

  it('skips unscoreable cutoffs (too little history / no realized consumption)', async () => {
    const logs = [log(2, -2), log(1, -2)]   // 2 days only
    const obs = await reconstructObservations(logs, {
      horizonDays: 7, adapter: baselineRolling30dAdapter, cutoffs: rollingCutoffs(NOW, 7, 4),
    })
    expect(obs).toHaveLength(0)
  })
})
