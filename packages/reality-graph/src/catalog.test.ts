// Guards the Studio's single source of truth: the catalog must list every
// shipped tool + agent, and agent toolsets must reflect what the agent actually
// builds (this is the drift that hid compute_reorder_point from the Studio).

import { describe, expect, it } from 'vitest'
import { listAllToolDescriptors, listAllAgentSpecs, listAllObjectiveDescriptors } from './catalog'

describe('Studio catalog', () => {
  it('lists every shipped Logic Tool with unique names + real metadata', () => {
    const tools = listAllToolDescriptors()
    const names = tools.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)   // no dups
    // A representative slice, incl. the tool that was missing from the old list.
    for (const n of ['forecast_consumption', 'compute_reorder_point', 'detect_ontology_gaps', 'occupancy_adjusted_forecast', 'request_clarification']) {
      expect(names).toContain(n)
    }
    for (const t of tools) {
      expect(t.name).toBeTruthy()
      expect(t.category).toBeTruthy()
      expect(t.version).toBeTruthy()
      expect(t.description.length).toBeGreaterThan(10)
    }
  })

  it('derives agent toolsets from the live agents (compute_reorder_point included)', () => {
    const agents = listAllAgentSpecs()
    expect(agents.map((a) => a.name).sort()).toEqual(['overstock_rebalancer', 'restock_advisor', 'waste_triage'])
    const restock = agents.find((a) => a.name === 'restock_advisor')
    expect(restock?.toolset).toContain('compute_reorder_point')
  })

  it('every tool a catalog agent declares actually exists in the catalog', () => {
    const toolNames = new Set(listAllToolDescriptors().map((t) => t.name))
    for (const agent of listAllAgentSpecs()) {
      for (const name of agent.toolset) {
        expect(toolNames.has(name), `${agent.name} declares unknown tool ${name}`).toBe(true)
      }
    }
  })

  it('lists objectives with all candidate adapters resolved + an eval suite', () => {
    const objectives = listAllObjectiveDescriptors()
    const forecast = objectives.find((o) => o.objective.name === 'consumption_forecast')
    expect(forecast).toBeDefined()
    // Every candidate name resolves to a real adapter object (drift-free).
    expect(forecast?.adapters.map((a) => a.name)).toEqual([...(forecast?.objective.candidates ?? [])])
    expect(forecast?.adapters.length).toBe(5)
    expect(forecast?.evalSuite?.cases.length).toBeGreaterThanOrEqual(10)
  })
})
