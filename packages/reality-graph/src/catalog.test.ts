// Guards the Studio's single source of truth: whatever ships must appear here
// with real metadata, and an agent must never declare a tool the catalog does
// not have. The old version asserted hospitality names (forecast_consumption,
// restock_advisor); those went with the teardown, so what is left is the shape
// invariant — which is the part that actually prevents Studio drift.

import { describe, expect, it } from 'vitest'
import { listAllToolDescriptors, listAllAgentSpecs, listAllObjectiveDescriptors } from './catalog'

describe('Studio catalog', () => {
  it('lists every shipped Logic Tool with unique names + real metadata', () => {
    const tools = listAllToolDescriptors()
    const names = tools.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)   // no dups
    for (const t of tools) {
      expect(t.name).toBeTruthy()
      expect(t.category).toBeTruthy()
      expect(t.version).toBeTruthy()
      expect(t.description.length).toBeGreaterThan(10)
    }
  })

  it('every tool a catalog agent declares actually exists in the catalog', () => {
    const toolNames = new Set(listAllToolDescriptors().map((t) => t.name))
    for (const agent of listAllAgentSpecs()) {
      for (const name of agent.toolset) {
        expect(toolNames.has(name), `${agent.name} declares unknown tool ${name}`).toBe(true)
      }
    }
  })

  it('resolves every objective candidate to a real adapter', () => {
    for (const d of listAllObjectiveDescriptors()) {
      expect(d.adapters.map((a) => a.name)).toEqual([...d.objective.candidates])
    }
  })
})
