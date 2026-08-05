import { describe, it, expect } from 'vitest'
import { PROJECT_ROLES, roleAtLeast, canGrant, grantableRoles } from './roles'

describe('project roles', () => {
  it('is ordered most to least powerful, as Foundry states them', () => {
    expect([...PROJECT_ROLES]).toEqual(['owner', 'editor', 'viewer', 'discoverer'])
  })

  it('satisfies any lesser requirement', () => {
    expect(roleAtLeast('owner', 'discoverer')).toBe(true)
    expect(roleAtLeast('editor', 'viewer')).toBe(true)
    expect(roleAtLeast('viewer', 'editor')).toBe(false)
    expect(roleAtLeast('discoverer', 'viewer')).toBe(false)
    expect(roleAtLeast(null, 'discoverer')).toBe(false)
  })

  it('lets a role assign the same or a lesser one, and no more', () => {
    // "An Owner can grant any other user the Owner, Editor, Viewer, or
    // Discoverer role, while the Discoverer can only grant other users the
    // Discoverer role."
    expect(grantableRoles('owner')).toEqual(['owner', 'editor', 'viewer', 'discoverer'])
    expect(grantableRoles('discoverer')).toEqual(['discoverer'])
    expect(grantableRoles('editor')).toEqual(['editor', 'viewer', 'discoverer'])
    expect(canGrant('editor', 'owner')).toBe(false)
    expect(canGrant('editor', 'editor')).toBe(true)
  })

  it('gives someone with no role nothing to grant', () => {
    expect(grantableRoles(null)).toEqual([])
    expect(canGrant(undefined, 'discoverer')).toBe(false)
  })
})
