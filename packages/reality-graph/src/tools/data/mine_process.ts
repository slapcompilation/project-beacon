import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'
import { legalNext } from '../../lifecycles'
import { selectBottleneckTriggers, type BottleneckReading } from '../../monitors/index'
import { DEFAULT_ORG_POLICY } from '../../policy/index'

const NODE_TYPES = ['restock_request', 'purchase_order', 'case', 'proposal'] as const

const inputSchema = z.object({
  nodeType: z.enum(NODE_TYPES),
  hotelId:  z.string().uuid(),
})

const outputSchema = z.object({
  states: z.array(z.object({
    state:              z.string(),
    enteredCount:       z.number().int().nonnegative(),
    currentCount:       z.number().int().nonnegative(),
    exitedCount:        z.number().int().nonnegative(),
    avgDurationSeconds: z.number().nullable(),
  })),
  transitions: z.array(z.object({
    from:               z.string(),
    to:                 z.string(),
    count:              z.number().int().nonnegative(),
    avgLeadTimeSeconds: z.number().nullable(),
  })),
  bottlenecks: z.array(z.object({
    state:     z.string(),
    exitRatio: z.number(),
    urgency:   z.number().int(),
  })),
})

export type MineProcessInput = z.infer<typeof inputSchema>
export type MineProcessOutput = z.infer<typeof outputSchema>

export function makeMineProcessTool(reader: GraphReader): LogicTool<MineProcessInput, MineProcessOutput> {
  return {
    name: 'mine_process',
    category: 'data',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Mines the lifecycle transition log for a process (restock_request, purchase_order, case, ' +
      'or proposal) into per-state counts + durations and per-transition lead times, and flags ' +
      'bottlenecks — non-terminal states where far more objects entered than exited. Use to answer ' +
      '"where is this process getting stuck?" before proposing a fix.',
    inputSchema,
    outputSchema,
    traversableLinks: [],
    examples: [
      {
        input: { nodeType: 'restock_request', hotelId: '00000000-0000-0000-0000-000000000000' },
        output: { states: [], transitions: [], bottlenecks: [] },
      },
    ],
    invoke: async (input) => {
      if (!reader.mineProcess) return { states: [], transitions: [], bottlenecks: [] }
      const mined = await reader.mineProcess(input.nodeType, input.hotelId)

      const readings: BottleneckReading[] = mined.states.map((s) => ({
        nodeType:     input.nodeType,
        state:        s.state,
        isTerminal:   legalNext(input.nodeType, s.state).length === 0,
        enteredCount: s.enteredCount,
        exitedCount:  s.exitedCount,
        currentCount: s.currentCount,
      }))
      const hits = selectBottleneckTriggers(readings, DEFAULT_ORG_POLICY.monitors.bottleneck)

      return {
        states:      mined.states,
        transitions: mined.transitions,
        bottlenecks: hits.map((h) => ({ state: h.state, exitRatio: h.exitRatio, urgency: h.urgency })),
      }
    },
  }
}
