import { describe, expect, it } from 'vitest'
import {
  ACCESS_LEVEL_META, MARKING_KINDS, MARKING_KIND_META, MARKING_ORIGIN_META,
  MARKING_PERMISSION_META, accessLevel, satisfiesAll,
} from './index'
import type { ResourceMarking } from './index'

const mk = (over: Partial<ResourceMarking> = {}): ResourceMarking => ({
  markingId: 'm', name: 'PII', category: 'Information',
  kind: 'file', origin: 'direct', satisfied: true, ...over,
})

describe('the vocabulary', () => {
  it('has the three origins Foundry distinguishes by icon', () => {
    expect(Object.keys(MARKING_ORIGIN_META).sort())
      .toEqual(['data_dependency', 'direct', 'file_hierarchy'])
    // The two inherited ones must not share an icon — telling them apart at a
    // glance is the entire job of the sidecar.
    expect(MARKING_ORIGIN_META.file_hierarchy.icon)
      .not.toBe(MARKING_ORIGIN_META.data_dependency.icon)
  })

  it('has the two cards, file first', () => {
    expect([...MARKING_KINDS]).toEqual(['file', 'data'])
    expect(Object.keys(MARKING_KIND_META).sort()).toEqual(['data', 'file'])
  })

  it('has the three permissions, none of which is membership', () => {
    expect(Object.keys(MARKING_PERMISSION_META).sort()).toEqual(['apply', 'manage', 'remove'])
    expect(MARKING_PERMISSION_META.apply.help).toMatch(/does not grant membership/i)
  })
})

describe('satisfiesAll', () => {
  // "a user must be a member of all the Markings… since Markings are conjunctive"
  it('is conjunctive', () => {
    expect(satisfiesAll([mk(), mk({ markingId: 'n' })])).toBe(true)
    expect(satisfiesAll([mk(), mk({ markingId: 'n', satisfied: false })])).toBe(false)
  })

  // An unmarked resource is not thereby restricted.
  it('passes on an empty set', () => {
    expect(satisfiesAll([])).toBe(true)
  })
})

describe('accessLevel', () => {
  it('is full when everything is satisfied', () => {
    expect(accessLevel([mk(), mk({ kind: 'data', origin: 'data_dependency' })])).toBe('full')
    expect(accessLevel([])).toBe('full')
  })

  // The documented middle state: "the user can detect the presence of the derived
  // dataset and view the file metadata, but cannot access the data within."
  it('is metadata_only when a data marking is unmet but file markings pass', () => {
    expect(accessLevel([
      mk(),
      mk({ markingId: 'n', kind: 'data', origin: 'data_dependency', satisfied: false }),
    ])).toBe('metadata_only')
  })

  it('is none when a file marking is unmet, whatever the data markings say', () => {
    expect(accessLevel([mk({ satisfied: false })])).toBe('none')
    expect(accessLevel([
      mk({ satisfied: false }),
      mk({ markingId: 'n', kind: 'data', origin: 'data_dependency', satisfied: true }),
    ])).toBe('none')
  })

  it('describes metadata_only without promising the schema is hidden', () => {
    // marking-file-inheritance.png shows a denied user reading `credit_card` and
    // `passport_id` column names. Saying otherwise in the UI would be a lie.
    expect(ACCESS_LEVEL_META.metadata_only.help).toMatch(/column names are metadata/i)
  })
})
