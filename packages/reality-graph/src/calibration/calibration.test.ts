import { describe, expect, it } from 'vitest'
import { calibratedConfidence, computeCalibration, outcomeLabel, type CalibrationSample } from './index'

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
