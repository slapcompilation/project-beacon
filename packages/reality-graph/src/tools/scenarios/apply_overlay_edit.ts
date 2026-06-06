import { z } from 'zod'
import type { LogicTool } from '../index'
import type { ScenarioGateway } from '../../scenarios/gateway'

const inputSchema = z.object({
  scenarioId: z.string().uuid(),
  /** JSON path into graph_overlay, e.g.
   *  ['policy','auto_execution','thresholds','REQUEST_RESTOCK']. */
  path:       z.array(z.string()).min(1),
  /** New value at the path. Pass null to remove the key entirely. */
  value:      z.unknown(),
  /** Where this edit came from. The LLM passes 'llm'; the UI passes 'operator'. */
  source:     z.enum(['llm', 'operator']).default('llm'),
})

const outputSchema = z.object({
  scenarioId:        z.string().uuid(),
  appliedPath:       z.array(z.string()),
  /** Echoes the new overlay so the next tool call can reason about it. */
  graphOverlay:      z.unknown(),
  updatedAt:         z.string(),
})

export type ApplyOverlayEditInput  = z.infer<typeof inputSchema>
export type ApplyOverlayEditOutput = z.infer<typeof outputSchema>

export function makeApplyOverlayEditTool(
  gateway: ScenarioGateway,
): LogicTool<ApplyOverlayEditInput, ApplyOverlayEditOutput> {
  return {
    name:        'apply_overlay_edit',
    category:    'mutation',
    kind:        'inproc',
    version:     '1.0.0',
    description:
      'Edit a single value inside a scenario\'s graph_overlay. The path is a list of keys into ' +
      'the typed overlay (variants / policy / constraints / actions). Passing value=null removes ' +
      'the key. Writes are atomic — the DB simultaneously updates graph_overlay AND records a ' +
      'provenance row in scenario_overlay_edits. Use to apply hypothetical changes the operator ' +
      'wants to explore in the sandbox.',
    inputSchema,
    outputSchema,
    examples: [
      {
        input: {
          scenarioId: '00000000-0000-0000-0000-000000000000',
          path:       ['policy', 'auto_execution', 'thresholds', 'REQUEST_RESTOCK'],
          value:      0.95,
          source:     'llm',
        },
        output: {
          scenarioId:   '00000000-0000-0000-0000-000000000000',
          appliedPath:  ['policy', 'auto_execution', 'thresholds', 'REQUEST_RESTOCK'],
          graphOverlay: { policy: { auto_execution: { thresholds: { REQUEST_RESTOCK: 0.95 } } } },
          updatedAt:    '2026-06-06T12:00:00Z',
        },
      },
    ],
    invoke: async (input) => {
      const row = await gateway.applyOverlayEdit({
        scenarioId: input.scenarioId,
        path:       input.path,
        value:      input.value === null ? undefined : input.value,
        source:     input.source,
      })
      return {
        scenarioId:   row.id,
        appliedPath:  input.path,
        graphOverlay: row.graph_overlay,
        updatedAt:    row.updated_at,
      }
    },
  }
}
