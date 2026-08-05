import { describe, expect, it } from 'vitest'
import {
  makeDetectOntologyGapsTool,
  type OntologyReader,
} from './detect_ontology_gaps'
import type { AdditionReasonRow, RemovalReasonRow } from '../../ontology/index'

const HOTEL = '00000000-0000-0000-0000-000000000000'

function readerOf(
  rows: RemovalReasonRow[],
  known: string[] = [],
  additions: AdditionReasonRow[] = [],
  knownMovement: string[] = [],
): OntologyReader {
  return {
    getRemovalReasons: async () => rows,
    getKnownRemovalCategories: async () => known,
    getAdditionReasons: async () => additions,
    getKnownMovementCategories: async () => knownMovement,
  }
}

describe('detect_ontology_gaps tool', () => {
  it('is a versioned logic tool', () => {
    const t = makeDetectOntologyGapsTool(readerOf([]))
    expect(t.name).toBe('detect_ontology_gaps')
    expect(t.category).toBe('logic')
    expect(t.version).toBe('1.0.0')
  })

  it('proposes a category and stamps basis + meta confidence from the top gap', async () => {
    const rows: RemovalReasonRow[] = Array.from({ length: 50 }, () => ({ reason: 'pos: daily consumption', removal_category: null }))
    const out = await makeDetectOntologyGapsTool(readerOf(rows)).invoke({ hotelId: HOTEL })
    expect(out.gaps).toHaveLength(1)
    expect(out.gaps[0].proposed).toBe('Consumed')
    expect(out.scanned).toBe(50)
    expect(out.basis).toBe('reason-lexicon-v1')
    expect(out.confidence).toBe(out.gaps[0].confidence)
  })

  it('passes known categories through so they are not re-proposed', async () => {
    const rows: RemovalReasonRow[] = Array.from({ length: 10 }, () => ({ reason: 'expired', removal_category: null }))
    const out = await makeDetectOntologyGapsTool(readerOf(rows, ['spoilage'])).invoke({ hotelId: HOTEL })
    expect(out.gaps).toHaveLength(0)
    expect(out.confidence).toBe(0)
  })

  it('returns no gaps + zero confidence on an empty hotel', async () => {
    const out = await makeDetectOntologyGapsTool(readerOf([])).invoke({ hotelId: HOTEL })
    expect(out.gaps).toEqual([])
    expect(out.scanned).toBe(0)
    expect(out.confidence).toBe(0)
  })

  it('runs both detectors and ranks gaps across removals + additions', async () => {
    const removals  = Array.from({ length: 20 }, () => ({ reason: 'pos: daily consumption', removal_category: null }))
    const additions = Array.from({ length: 30 }, () => ({ reason: 'restock received' }))
    const out = await makeDetectOntologyGapsTool(readerOf(removals, [], additions, [])).invoke({ hotelId: HOTEL })
    expect(out.scanned).toBe(50)
    const fields = out.gaps.map((g) => `${g.targetField}:${g.proposed}`)
    expect(fields).toContain('removal_category:Consumed')
    expect(fields).toContain('movement_category:Receipt')
    // additions (30) outrank removals (20) by support
    expect(out.gaps[0].targetField).toBe('movement_category')
  })
})
