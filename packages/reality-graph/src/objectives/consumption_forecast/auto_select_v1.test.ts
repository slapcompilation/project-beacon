import { describe, expect, it } from 'vitest'
import { autoSelectV1Adapter } from './auto_select_v1'
import { holtLinearV1Adapter } from './holt_linear_v1'
import type { StockLogRow } from '../../tools/graph_reader'

const DAY = 86_400_000
const NOW = new Date('2026-06-01T12:00:00.000Z').getTime()
const at = (k: number) => new Date(NOW - k * DAY).toISOString()
const mk = (k: number, units: number): StockLogRow => ({ id: `l-${k}`, variant_id: 'v1', hotel_id: 'h1', delta: -units, created_at: at(k) })

describe('auto-select-v1 — per-variant model selection', () => {
  it('switches to Holt on a clearly trending variant', async () => {
    // 85 days rising steeply (+1/day) from ~4 (oldest) to ~88 (recent). EWMA and
    // the flat baseline both lag a steep trend; Holt extrapolates it → Holt wins.
    const logs = Array.from({ length: 85 }, (_, i) => {
      const k = 84 - i
      return mk(k, Math.max(1, Math.round(4 + 1.0 * (84 - k))))
    })
    const r = await autoSelectV1Adapter.runInference({ logs, horizonDays: 7, asOf: NOW })
    expect(r.basis).toBe('auto:holt-linear-v1')
    // and it actually forecasts with the chosen adapter
    const holt = await holtLinearV1Adapter.runInference({ logs, horizonDays: 7, asOf: NOW })
    expect(r.projectedUnits).toBe(holt.projectedUnits)
  })

  it('keeps EWMA on flat demand (no challenger beats it by the margin)', async () => {
    const logs = Array.from({ length: 60 }, (_, i) => mk(59 - i, 5))
    const r = await autoSelectV1Adapter.runInference({ logs, horizonDays: 7, asOf: NOW })
    expect(r.basis).toBe('auto:ewma-v1')
  })

  it('falls back to EWMA when history is too sparse to select on', async () => {
    const logs = [mk(2, 4), mk(9, 4), mk(15, 4)]   // 3 events, < min scoreable windows
    const r = await autoSelectV1Adapter.runInference({ logs, horizonDays: 7, asOf: NOW })
    expect(r.basis).toBe('auto:ewma-v1')
  })

  it('returns a floor result on no history', async () => {
    const r = await autoSelectV1Adapter.runInference({ logs: [], horizonDays: 7, asOf: NOW })
    expect(r.projectedUnits).toBe(0)
    expect(r.basis).toBe('auto:ewma-v1')
  })
})
