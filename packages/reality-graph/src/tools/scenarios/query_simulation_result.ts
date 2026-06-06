import { z } from 'zod'
import type { LogicTool } from '../index'
import type { ScenarioGateway } from '../../scenarios/gateway'

const inputSchema = z.object({
  scenarioId: z.string().uuid(),
})

const outputSchema = z.object({
  scenarioId:        z.string().uuid(),
  /** Empty when the scenario has never been simulated. */
  cachedAt:          z.string().nullable(),
  scanned:           z.number().int().nonnegative().nullable(),
  proposed:          z.number().int().nonnegative().nullable(),
  autoExecuted:      z.number().int().nonnegative().nullable(),
  queued:            z.number().int().nonnegative().nullable(),
  itemCount:         z.number().int().nonnegative(),
  hasDelta:          z.boolean(),
})

export type QuerySimulationResultInput  = z.infer<typeof inputSchema>
export type QuerySimulationResultOutput = z.infer<typeof outputSchema>

export function makeQuerySimulationResultTool(
  gateway: ScenarioGateway,
): LogicTool<QuerySimulationResultInput, QuerySimulationResultOutput> {
  return {
    name:        'query_simulation_result',
    category:    'data',
    kind:        'inproc',
    version:     '1.0.0',
    description:
      'Returns the cached most-recent simulation result for a scenario without rerunning it. ' +
      'Use this to summarize a scenario in conversation ("you last simulated 5 minutes ago — ' +
      '4 of 12 would queue") before deciding whether to rerun.',
    inputSchema,
    outputSchema,
    examples: [
      {
        input: { scenarioId: '00000000-0000-0000-0000-000000000000' },
        output: {
          scenarioId:   '00000000-0000-0000-0000-000000000000',
          cachedAt:     '2026-06-06T12:00:00Z',
          scanned:      12,
          proposed:     12,
          autoExecuted: 8,
          queued:       4,
          itemCount:    12,
          hasDelta:     false,
        },
      },
    ],
    invoke: async (input) => {
      const row = await gateway.fetchScenario(input.scenarioId)
      if (!row) throw new Error(`scenario ${input.scenarioId} not found`)
      const cache = row.last_simulation
      if (!cache) {
        return {
          scenarioId:   row.id,
          cachedAt:     null,
          scanned:      null,
          proposed:     null,
          autoExecuted: null,
          queued:       null,
          itemCount:    0,
          hasDelta:     false,
        }
      }
      return {
        scenarioId:   row.id,
        cachedAt:     cache.ran_at,
        scanned:      cache.result.scanned,
        proposed:     cache.result.proposed,
        autoExecuted: cache.result.autoExecuted,
        queued:       cache.result.queued,
        itemCount:    cache.result.items.length,
        hasDelta:     cache.delta != null,
      }
    },
  }
}
