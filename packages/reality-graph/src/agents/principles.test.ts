import { describe, expect, it } from 'vitest'
import {
  principleProvenance,
  principleReasoningSuffix,
  selectApplicablePrinciples,
} from './principles'
import type { PrincipleRecord } from '../tools/graph_reader'

const VAR_A = 'v-a'
const VAR_B = 'v-b'

const hotelWide: PrincipleRecord = { id: 'p-1', body: 'Prefer lateral transfers before external orders', category: 'inventory-policy' }
const scopedToA: PrincipleRecord = { id: 'p-2', body: 'Never over-order tomatoes past par x1.5', category: 'inventory-policy', appliesToNodeIds: [VAR_A] }
const scopedToB: PrincipleRecord = { id: 'p-3', body: 'Dairy: Sysco only', category: 'supplier-preference', appliesToNodeIds: [VAR_B] }
const emptyScope: PrincipleRecord = { id: 'p-4', body: 'Budget cap applies', category: 'budget', appliesToNodeIds: [] }

describe('selectApplicablePrinciples', () => {
  it('always includes hotel-wide principles (no appliesToNodeIds)', () => {
    const r = selectApplicablePrinciples([hotelWide], VAR_A)
    expect(r).toEqual([hotelWide])
  })

  it('treats an empty appliesToNodeIds as hotel-wide', () => {
    const r = selectApplicablePrinciples([emptyScope], VAR_A)
    expect(r).toEqual([emptyScope])
  })

  it('includes variant-scoped principles only for the matching variant', () => {
    expect(selectApplicablePrinciples([scopedToA, scopedToB], VAR_A)).toEqual([scopedToA])
    expect(selectApplicablePrinciples([scopedToA, scopedToB], VAR_B)).toEqual([scopedToB])
  })

  it('mixes hotel-wide + variant-scoped, preserving order', () => {
    const r = selectApplicablePrinciples([hotelWide, scopedToA, scopedToB], VAR_A)
    expect(r).toEqual([hotelWide, scopedToA])
  })

  it('returns empty when nothing applies', () => {
    expect(selectApplicablePrinciples([scopedToB], VAR_A)).toEqual([])
    expect(selectApplicablePrinciples([], VAR_A)).toEqual([])
  })
})

describe('principleProvenance', () => {
  it('maps each principle to a principle-kind provenance entry with body as detail', () => {
    expect(principleProvenance([hotelWide, scopedToA])).toEqual([
      { kind: 'principle', ref: 'p-1', detail: hotelWide.body },
      { kind: 'principle', ref: 'p-2', detail: scopedToA.body },
    ])
  })
  it('is empty for no principles', () => {
    expect(principleProvenance([])).toEqual([])
  })
})

describe('principleReasoningSuffix', () => {
  it('lists honored principle bodies', () => {
    const s = principleReasoningSuffix([hotelWide])
    expect(s).toContain('Honored operator principle')
    expect(s).toContain(hotelWide.body)
  })
  it('returns empty string when none apply (safe to concatenate)', () => {
    expect(principleReasoningSuffix([])).toBe('')
  })
})
