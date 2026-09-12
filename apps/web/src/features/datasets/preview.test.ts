// The preview table's pure helpers, against what the captures show.
//
// `dataset-preview/images/dataset-preview.png` renders a filter as the chip
// `end_borough: "Manhattan"` and a null cell as the italic word; the History
// rail (`dataset-app-history-page.png`) prints durations as `9m 32s` and the
// Summary's fifth card as a median. None of this touches the Supabase client.

import { describe, it, expect } from 'vitest'
import { duration, filterLabel, formatCell, medianDurationSeconds, summaryBucket } from './preview'

describe('filterLabel', () => {
  it('quotes strings the way the chip does', () => {
    expect(filterLabel({ column: 'end_borough', op: 'include', value: 'Manhattan' })).toBe('end_borough: "Manhattan"')
  })
  it('marks an exclude and spells the null', () => {
    expect(filterLabel({ column: 'seats', op: 'exclude', value: 2 })).toBe('seats ≠ 2')
    expect(filterLabel({ column: 'seats', op: 'include', value: null })).toBe('seats: null')
  })
})

describe('formatCell', () => {
  it('tells null from an empty string', () => {
    expect(formatCell(null)).toEqual({ text: 'null', isNull: true })
    expect(formatCell('')).toEqual({ text: '', isNull: false })
  })
  it('prints nested values as JSON rather than [object Object]', () => {
    expect(formatCell({ a: 1 }).text).toBe('{"a":1}')
    expect(formatCell([1, 2]).text).toBe('[1,2]')
  })
})

describe('duration', () => {
  it('renders the rail forms', () => {
    expect(duration('2026-09-12T10:00:00Z', '2026-09-12T10:09:32Z')).toBe('9m 32s')
    expect(duration('2026-09-12T10:00:00Z', '2026-09-12T10:00:41Z')).toBe('41s')
    expect(duration('2026-09-12T10:00:00Z', '2026-09-12T11:05:00Z')).toBe('1h 5m')
  })
  it('measures a running job against now', () => {
    const now = new Date('2026-09-12T10:05:00Z').getTime()
    expect(duration('2026-09-12T10:00:00Z', null, now)).toBe('5m 0s')
  })
})

describe('medianDurationSeconds', () => {
  it('is null with nothing finished, and the middle otherwise', () => {
    expect(medianDurationSeconds([{ startedAt: '2026-01-01T00:00:00Z', finishedAt: null }])).toBeNull()
    const at = (s: number) => new Date(s * 1000).toISOString()
    expect(medianDurationSeconds([
      { startedAt: at(0), finishedAt: at(10) },
      { startedAt: at(0), finishedAt: at(30) },
      { startedAt: at(0), finishedAt: at(20) },
    ])).toBe(20)
    expect(medianDurationSeconds([
      { startedAt: at(0), finishedAt: at(10) },
      { startedAt: at(0), finishedAt: at(30) },
    ])).toBe(20)
  })
})

describe('summaryBucket', () => {
  it('folds the job tokens into the four cards', () => {
    expect(summaryBucket('COMPLETED')).toBe('Succeeded')
    expect(summaryBucket('FAILED')).toBe('Failed')
    expect(summaryBucket('ABORTED')).toBe('Canceled')
    expect(summaryBucket('WAITING')).toBe('Running')
    expect(summaryBucket('RUNNING')).toBe('Running')
  })
})
