// Logic Tool: compute_decision_calibration.
// Reads resolved proposals for a scope and returns a reliability report — does
// the agent's stated confidence match its observed hit rate? The math lives in
// ../../calibration; this tool is the typed, dual-callable boundary around it.
//
// 1. Layer: compute (category 'logic').
// 2. Ontology fit: Proposal {confidence, status}. No writes, no traversal.
// 3. Scope: hotel by default; org-wide when the reader is given org membership.

import { z } from 'zod'
import type { LogicTool } from '../index'
import type { ProposalStatus } from '../../nodes/aip'
import { computeCalibration } from '../../calibration/index'

/** One resolved proposal the calibration math scores. */
export interface CalibrationProposalRef {
  confidence: number
  status: ProposalStatus
}

/** Narrow reader for the resolved-proposal population. apps/web supplies a
 *  Supabase-backed impl; evals/tests supply an in-memory one. Kept separate
 *  from GraphReader (which is variant-centric) so neither bloats the other. */
export interface CalibrationReader {
  getResolvedProposals(filter: {
    hotelId: string
    agentName?: string
    actionType?: string
    /** Only proposals raised within the last N days. Omit for all-time. */
    windowDays?: number
  }): Promise<CalibrationProposalRef[]>
}

const inputSchema = z.object({
  hotelId: z.string().uuid(),
  agentName: z.string().optional(),
  actionType: z.string().optional(),
  windowDays: z.number().int().min(1).max(365).optional(),
  bins: z.number().int().min(2).max(20).optional(),
  minSamples: z.number().int().min(1).max(1000).optional(),
})

const binSchema = z.object({
  lower: z.number(),
  upper: z.number(),
  count: z.number().int().nonnegative(),
  meanConfidence: z.number(),
  accuracy: z.number(),
  gap: z.number(),
})

const outputSchema = z.object({
  bins: z.array(binSchema),
  resolved: z.number().int().nonnegative(),
  excluded: z.object({ pending: z.number().int(), expired: z.number().int() }),
  meanConfidence: z.number(),
  accuracy: z.number(),
  ece: z.number(),
  brier: z.number(),
  verdict: z.enum(['well-calibrated', 'overconfident', 'underconfident', 'insufficient-data']),
  sufficientData: z.boolean(),
  basis: z.string(),
  confidence: z.number().min(0).max(1),
})

export type ComputeDecisionCalibrationInput = z.infer<typeof inputSchema>
export type ComputeDecisionCalibrationOutput = z.infer<typeof outputSchema>

export function makeComputeDecisionCalibrationTool(
  reader: CalibrationReader,
): LogicTool<ComputeDecisionCalibrationInput, ComputeDecisionCalibrationOutput> {
  return {
    name: 'compute_decision_calibration',
    category: 'logic',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Returns a reliability report for past proposals in a scope: per-confidence-band hit rate, ' +
      'Expected Calibration Error, Brier score, and a verdict (well-calibrated / over / under / ' +
      'insufficient-data). Operator disposition is the label — approved = hit, rejected or refined = ' +
      'miss. Use to judge whether an agent\'s stated confidence can be trusted before raising its ' +
      'auto-execution floor.',
    inputSchema,
    outputSchema,
    examples: [
      {
        input: { hotelId: '00000000-0000-0000-0000-000000000000', agentName: 'restock_advisor' },
        output: {
          bins: [{ lower: 0.8, upper: 0.9, count: 40, meanConfidence: 0.85, accuracy: 0.6, gap: -0.25 }],
          resolved: 40,
          excluded: { pending: 0, expired: 3 },
          meanConfidence: 0.85,
          accuracy: 0.6,
          ece: 0.25,
          brier: 0.28,
          verdict: 'overconfident',
          sufficientData: true,
          basis: 'reliability-bins-v1',
          confidence: 1,
        },
      },
    ],
    invoke: async (input) => {
      const samples = await reader.getResolvedProposals({
        hotelId: input.hotelId,
        agentName: input.agentName,
        actionType: input.actionType,
        windowDays: input.windowDays,
      })
      const report = computeCalibration(samples, { bins: input.bins, minSamples: input.minSamples })
      return { ...report, basis: 'reliability-bins-v1' }
    },
  }
}
