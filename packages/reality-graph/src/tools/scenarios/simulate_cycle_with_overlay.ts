import { z } from 'zod'
import type { LogicTool } from '../index'
import type { ScenarioGateway } from '../../scenarios/gateway'
import { simulateCycleWithOverlay } from '../../scenarios/simulate'

const inputSchema = z.object({
  scenarioId: z.string().uuid(),
})

const itemSchema = z.object({
  variantId:   z.string(),
  variantName: z.string(),
  outcome:     z.string(),
  actionType:  z.string().optional(),
  reason:      z.string().optional(),
})

const outputSchema = z.object({
  scenarioId:   z.string().uuid(),
  scanned:      z.number().int().nonnegative(),
  proposed:     z.number().int().nonnegative(),
  autoExecuted: z.number().int().nonnegative(),
  queued:       z.number().int().nonnegative(),
  ranAt:        z.string(),
  items:        z.array(itemSchema),
  /** Empty when no baseline was taken (the V1 web caller skips the baseline
   *  on cycle-tool runs for speed; the H3 UI can opt in to a paired run). */
  delta: z.object({
    autoExecutedDelta: z.number(),
    queuedDelta:       z.number(),
    flips: z.array(z.object({
      variantId:   z.string(),
      variantName: z.string(),
      baseline:    z.string(),
      overlay:     z.string(),
    })),
  }).nullable(),
  basis:      z.string(),
  confidence: z.number(),
})

export type SimulateCycleWithOverlayInput  = z.infer<typeof inputSchema>
export type SimulateCycleWithOverlayOutput = z.infer<typeof outputSchema>

export function makeSimulateCycleWithOverlayTool(
  gateway: ScenarioGateway,
): LogicTool<SimulateCycleWithOverlayInput, SimulateCycleWithOverlayOutput> {
  return {
    name:        'simulate_cycle_with_overlay',
    category:    'logic',
    kind:        'inproc',
    version:     '1.0.0',
    description:
      'Runs the intelligence cycle against the scenario\'s graph_overlay with no-op persistence ' +
      '— nothing is written back to real state. Returns the CycleResult (scanned/proposed/' +
      'autoExecuted/queued + per-variant items) so the operator can see what WOULD have happened ' +
      'under the overlay. The result is also cached on the scenario row for the list view + ' +
      'follow-up tool calls. Use after applying overlay edits to see their effect.',
    inputSchema,
    outputSchema,
    examples: [
      {
        input: { scenarioId: '00000000-0000-0000-0000-000000000000' },
        output: {
          scenarioId:   '00000000-0000-0000-0000-000000000000',
          scanned:      12,
          proposed:     12,
          autoExecuted: 8,
          queued:       4,
          ranAt:        '2026-06-06T12:00:00Z',
          items:        [],
          delta:        null,
          basis:        'overlay-simulation:1.0.0',
          confidence:   1,
        },
      },
    ],
    invoke: async (input) => {
      const scenario = await gateway.fetchScenario(input.scenarioId)
      if (!scenario) throw new Error(`scenario ${input.scenarioId} not found`)

      const deps   = await gateway.buildSimulationDeps(scenario)
      const result = await simulateCycleWithOverlay(deps)

      // Cache the result (no delta on the V1 single-run path — the H3 UI
      // will call this twice and diffSimulations for a delta when needed).
      await gateway.recordSimulation(scenario.id, {
        ran_at: result.ranAt,
        result: {
          scanned:      result.scanned,
          proposed:     result.proposed,
          autoExecuted: result.autoExecuted,
          queued:       result.queued,
          ranAt:        result.ranAt,
          items:        result.items.map((i) => ({
            variantId:   i.variantId,
            variantName: i.variantName,
            outcome:     i.outcome,
            actionType:  i.actionType,
            reason:      i.reason,
          })),
        },
        delta: null,
      })

      return {
        scenarioId:   scenario.id,
        scanned:      result.scanned,
        proposed:     result.proposed,
        autoExecuted: result.autoExecuted,
        queued:       result.queued,
        ranAt:        result.ranAt,
        items:        result.items.map((i) => ({
          variantId:   i.variantId,
          variantName: i.variantName,
          outcome:     i.outcome,
          actionType:  i.actionType,
          reason:      i.reason,
        })),
        delta:        null,
        basis:        'overlay-simulation:1.0.0',
        confidence:   1,
      }
    },
  }
}
