import { describe, expect, it } from 'vitest'
import { authoredToolAsLogicTool, resolveToolGroups, type AuthoredToolReader } from './asLogicTool'
import type { UserToolDef } from './index'
import { buildAuthoredAgentTools } from '../authoredAgents/tools'
import { EMPTY_VIEW_CONFIG, type ObjectTypeDef } from '../objectTypes/index'
import type { GraphReader } from '../tools/graph_reader'
import type { LogicTool } from '../tools/index'

const mk = (id: string, apiName: string, label: string): ObjectTypeDef => ({
  id, organizationId: 'o1', hotelId: null, apiName, label, icon: 'box', description: '',
  properties: [{ key: 'cost', label: 'Cost', type: 'number', required: false }],
  computedProperties: [], viewConfig: EMPTY_VIEW_CONFIG, enabled: true, version: 1,
})

const types = [mk('t1', 'maintenance_request', 'Maintenance Request'), mk('t2', 'incident', 'Incident')]

const reader: AuthoredToolReader = {
  objectTypes: () => Promise.resolve(types),
  interfaceImplementers: () => Promise.resolve(['t1', 't2']),
  objectRecords: (ids) => Promise.resolve([
    { objectTypeId: 't1', data: { cost: 100 } },
    { objectTypeId: 't1', data: { cost: 50 } },
    { objectTypeId: 't2', data: { cost: 30 } },
  ].filter((r) => ids.includes(r.objectTypeId))),
}

const def = (over: Partial<UserToolDef> = {}): UserToolDef => ({
  id: 'u1', organizationId: 'o1', hotelId: null, name: 'Total cost', apiName: 'total_cost',
  description: 'Sum of Cost across every Roomed', subjectTypeId: null, subjectInterfaceId: 'i1', parameters: [],
  filters: [], aggregation: { fn: 'sum', property: 'cost' }, enabled: true, ...over,
})

describe('authored tool as a Logic Tool', () => {
  it('answers with the same value + basis + confidence contract a code tool does', async () => {
    const tool = authoredToolAsLogicTool(def(), reader)
    const out = await tool.invoke({}) as { value: number; basis: string; confidence: number }
    expect(tool.name).toBe('total_cost')
    expect(tool.category).toBe('logic')
    expect(out.value).toBe(180)
    expect(out.basis).toContain('across 2 types')
    expect(out.confidence).toBe(1)
  })

  it('spans every implementer for an interface subject, one type otherwise', async () => {
    expect(await resolveToolGroups({ subjectTypeId: null, subjectInterfaceId: 'i1' }, reader)).toHaveLength(2)
    const one = await resolveToolGroups({ subjectTypeId: 't2', subjectInterfaceId: null }, reader)
    expect(one).toHaveLength(1)
    expect(one[0].type?.label).toBe('Incident')
  })

  it('reports no confidence when nothing implements the interface yet', async () => {
    const empty: AuthoredToolReader = { ...reader, interfaceImplementers: () => Promise.resolve([]) }
    const out = await authoredToolAsLogicTool(def(), empty).invoke({}) as { value: number; confidence: number }
    expect(out.value).toBe(0)
    expect(out.confidence).toBe(0)
  })
})

describe('buildAuthoredAgentTools', () => {
  const graphReader = {} as GraphReader   // the factories only close over it

  it('offers authored tools alongside the shipped ones', () => {
    const authored = authoredToolAsLogicTool(def(), reader)
    const registry = buildAuthoredAgentTools(graphReader, [authored])
    expect(registry.has('total_cost')).toBe(true)
    expect(registry.has('request_clarification')).toBe(true)
  })

  it('never lets an authored tool redefine a shipped one', () => {
    const impostor = authoredToolAsLogicTool(def({ apiName: 'request_clarification' }), reader)
    const registry = buildAuthoredAgentTools(graphReader, [impostor as LogicTool])
    expect(registry.get('request_clarification')?.description).not.toContain('authored by this organization')
  })
})
