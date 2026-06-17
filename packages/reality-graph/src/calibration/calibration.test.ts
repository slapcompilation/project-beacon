import { describe, expect, it } from 'vitest'
import {
  calibratedConfidence, computeCalibration, outcomeLabel,
  DEFAULT_CALIBRATION_HALF_LIFE_DAYS, type CalibrationSample,
} from './index'

// Builds n samples at a fixed confidence with a given hit count.
function band(confidence: number, hits: number, misses: number): CalibrationSample[] {
  return [
    ...Array.from({ length: hits },   () => ({ confidence, status: 'approved' as const })),
    ...Array.from({ length: misses }, () => ({ confidence, status: 'rejected' as const })),
  ]
}

describe('outcomeLabel', () => {
  it('scores approved as a hit, rejected/superseded as a miss', () => {
    expect(outcomeLabel('approved')).toBe(1)
    expect(outcomeLabel('rejected')).toBe(0)
    expect(outcomeLabel('superseded')).toBe(0)
  })
  it('returns null for statuses with no operator judgment', () => {
    expect(outcomeLabel('pending')).toBeNull()
    expect(outcomeLabel('expired')).toBeNull()
  })
})

describe('computeCalibration', () => {
  it('reports insufficient-data on an empty population', () => {
    const r = computeCalibration([])
    expect(r.verdict).toBe('insufficient-data')
    expect(r.resolved).toBe(0)
    expect(r.confidence).toBe(0)
  })

  it('excludes pending + expired from the scoreable denominator', () => {
    const r = computeCalibration([
      { confidence: 0.8, status: 'approved' },
      { confidence: 0.8, status: 'pending' },
      { confidence: 0.8, status: 'expired' },
    ])
    expect(r.resolved).toBe(1)
    expect(r.excluded).toEqual({ pending: 1, expired: 1 })
  })

  it('flags overconfidence: claims 0.9, only right half the time', () => {
    // 40 samples in the 0.9 band, 20 hits → accuracy 0.5 vs confidence 0.9.
    const r = computeCalibration(band(0.9, 20, 20), { minSamples: 20 })
    expect(r.sufficientData).toBe(true)
    expect(r.verdict).toBe('overconfident')
    expect(r.accuracy).toBeCloseTo(0.5, 5)
    expect(r.meanConfidence).toBeCloseTo(0.9, 5)
    expect(r.ece).toBeCloseTo(0.4, 5)
    // Brier: (0.9-1)^2 and (0.9-0)^2 averaged = (0.01 + 0.81)/2 = 0.41
    expect(r.brier).toBeCloseTo(0.41, 5)
  })

  it('flags underconfidence: claims 0.5 but is right far more often', () => {
    const r = computeCalibration(band(0.5, 36, 4), { minSamples: 20 })
    expect(r.verdict).toBe('underconfident')
    expect(r.accuracy).toBeCloseTo(0.9, 5)
  })

  it('calls a matched population well-calibrated within tolerance', () => {
    // 0.75 band, 30 hits / 40 → accuracy 0.75, gap 0.
    const r = computeCalibration(band(0.75, 30, 10), { minSamples: 20 })
    expect(r.verdict).toBe('well-calibrated')
    expect(r.ece).toBeCloseTo(0, 5)
  })

  it('treats a single outcome class as not assessable, even with many samples', () => {
    // 50 approved, zero misses — looks perfect but tells us nothing.
    const r = computeCalibration(band(0.7, 50, 0), { minSamples: 20 })
    expect(r.sufficientData).toBe(false)
    expect(r.verdict).toBe('insufficient-data')
    expect(r.confidence).toBeLessThan(0.31)  // discounted for missing class
  })

  it('bins samples by confidence and keeps only non-empty bins ascending', () => {
    const r = computeCalibration(
      [...band(0.15, 1, 1), ...band(0.85, 1, 1)],
      { bins: 10, minSamples: 1 },
    )
    expect(r.bins.map((b) => b.lower)).toEqual([0.1, 0.8])
    expect(r.bins.every((b) => b.count === 2)).toBe(true)
  })

  it('self-confidence scales with sample size up to a cap of 1', () => {
    const small = computeCalibration(band(0.7, 5, 5), { minSamples: 20 })
    const large = computeCalibration(band(0.7, 60, 40), { minSamples: 20 })
    expect(small.confidence).toBeLessThan(large.confidence)
    expect(large.confidence).toBe(1)
  })

  it('clamps out-of-range confidence into [0,1]', () => {
    const r = computeCalibration([
      { confidence: 1.5, status: 'approved' },
      { confidence: -0.2, status: 'rejected' },
    ], { minSamples: 1 })
    expect(r.meanConfidence).toBeCloseTo(0.5, 5)  // (1 + 0) / 2
  })
})

describe('time-decay (recency weighting)', () => {
  const NOW = Date.parse('2026-06-17T00:00:00Z')
  const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

  it('exports a 90-day default half-life', () => {
    expect(DEFAULT_CALIBRATION_HALF_LIFE_DAYS).toBe(90)
  })

  // 10 old hits (90d → weight 0.125 each) + 10 fresh misses (weight 1 each).
  const mixed: CalibrationSample[] = [
    ...Array.from({ length: 10 }, () => ({ confidence: 0.8, status: 'approved' as const, decidedAt: daysAgo(90) })),
    ...Array.from({ length: 10 }, () => ({ confidence: 0.8, status: 'rejected' as const, decidedAt: daysAgo(0) })),
  ]

  it('is unchanged when halfLifeDays is omitted (decay off by default)', () => {
    const r = computeCalibration(mixed, { minSamples: 1, now: NOW })
    expect(r.accuracy).toBeCloseTo(0.5, 5)  // 10/20, every sample weighs 1
  })

  it('pulls accuracy toward recent outcomes when decay is on', () => {
    const r = computeCalibration(mixed, { minSamples: 1, halfLifeDays: 30, now: NOW })
    // weighted = (1.25·hit + 10·miss)/(1.25+10) = 1.25/11.25
    expect(r.accuracy).toBeCloseTo(0.1111, 3)
    expect(r.meanConfidence).toBeCloseTo(0.8, 5)  // weighting doesn't move a constant
    expect(r.resolved).toBe(20)                   // raw count, not weighted
    expect(r.bins[0].count).toBe(20)
  })

  it('ignores decay for samples without a decidedAt', () => {
    const noDates = mixed.map(({ decidedAt: _d, ...s }) => s)
    const r = computeCalibration(noDates, { minSamples: 1, halfLifeDays: 30, now: NOW })
    expect(r.accuracy).toBeCloseTo(0.5, 5)
  })

  it('does not over-weight future-dated outcomes', () => {
    const future: CalibrationSample[] = [
      { confidence: 0.8, status: 'approved', decidedAt: daysAgo(-10) },
      { confidence: 0.8, status: 'rejected', decidedAt: daysAgo(-10) },
    ]
    const r = computeCalibration(future, { minSamples: 1, halfLifeDays: 30, now: NOW })
    expect(r.accuracy).toBeCloseTo(0.5, 5)  // both clamped to weight 1
  })
})

describe('calibratedConfidence', () => {
  it('returns the observed hit-rate for the band a confidence falls in', () => {
    // 0.9 band: 20 hits / 40 → accuracy 0.5. Asking about a 0.9 claim returns 0.5.
    const r = computeCalibration(band(0.9, 20, 20), { minSamples: 20 })
    expect(calibratedConfidence(r, 0.9)).toBeCloseTo(0.5, 5)
  })

  it('returns null when no resolved samples sit in the band', () => {
    const r = computeCalibration(band(0.3, 5, 5), { bins: 10, minSamples: 1 })
    expect(calibratedConfidence(r, 0.95)).toBeNull()  // nothing in the 0.9 band
  })

  it('maps a confidence of exactly 1 into the top populated band', () => {
    const r = computeCalibration(band(0.95, 8, 2), { bins: 10, minSamples: 1 })
    expect(calibratedConfidence(r, 1)).toBeCloseTo(0.8, 5)
  })
})
