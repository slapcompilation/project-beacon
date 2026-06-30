import { describe, expect, it } from 'vitest'
import { buildDailySeries } from './daily_series'
import type { StockLogRow } from '../../tools/graph_reader'

const DAY = 86_400_000
const NOW = new Date('2026-06-01T12:00:00.000Z').getTime()
const at = (k: number) => new Date(NOW - k * DAY).toISOString()
const log = (k: number, delta: number, balance: number | null): StockLogRow =>
  ({ id: `l-${k}`, variant_id: 'v1', hotel_id: 'h1', delta, created_at: at(k), balance_after: balance })

describe('buildDailySeries — censoring uplift', () => {
  it('leaves the series untouched when no day hit zero stock', () => {
    const logs = Array.from({ length: 10 }, (_, k) => log(k, -10, 50))
    expect(buildDailySeries(logs, NOW, 30)).toEqual(Array.from({ length: 10 }, () => 10))
  })

  it('lifts a stock-out day to the uncensored mean (demand was truncated)', () => {
    // 9 days at 10/day with stock; 1 day sold only 2 then hit zero (censored).
    const logs = [
      ...Array.from({ length: 9 }, (_, i) => log(i, -10, 50)),
      log(9, -2, 0),   // oldest day: sold 2, stock hit 0 → true demand was ~10
    ]
    const series = buildDailySeries(logs, NOW, 30)
    expect(series[0]).toBe(10)                 // the censored day lifted from 2 → 10
    expect(series.every((v) => v >= 10)).toBe(true)
  })

  it('never lowers an observation above the uncensored mean', () => {
    // The stock-out day actually moved MORE than typical before selling out.
    const logs = [
      ...Array.from({ length: 9 }, (_, i) => log(i, -5, 50)),
      log(9, -12, 0),  // censored day sold 12 (> mean 5) → keep 12, don't lower
    ]
    expect(buildDailySeries(logs, NOW, 30)[0]).toBe(12)
  })
})
