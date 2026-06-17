// Logic Tool: detect_ontology_gaps.
// Scans a hotel's data for typed concepts the ontology is missing and returns
// reviewable proposals. The detection math lives in ../../ontology; this tool
// is the typed, dual-callable boundary around it (the operator copilot can ask
// "what's the ontology missing?" and get the same answer the surface shows).
//
// 1. Layer: compute (category 'logic'). No writes, no traversal.
// 2. Ontology fit: reads StockLog.{reason, removal_category}; proposes typed
//    removal_category members. No runtime schema mutation — output is advice.
// 3. Scope: hotel.

import { z } from 'zod'
import type { LogicTool } from '../index'
import { EDGE_TYPES } from '../../types'
import {
  detectAdditionCategoryGaps,
  detectRemovalCategoryGaps,
  detectUntypedEdgeGaps,
  type AdditionReasonRow,
  type EdgeTypeCount,
  type OntologyGap,
  type RemovalReasonRow,
} from '../../ontology/index'

/** Narrow reader for the ontology detectors. apps/web supplies a Supabase impl;
 *  evals/tests supply in-memory. Kept separate from GraphReader (variant-centric). */
export interface OntologyReader {
  /** Removal stock-logs (delta < 0) for the hotel within the window. */
  getRemovalReasons(hotelId: string, sinceDays?: number): Promise<RemovalReasonRow[]>
  /** removal_category values the ontology already recognizes (distinct, non-null). */
  getKnownRemovalCategories(hotelId: string): Promise<string[]>
  /** Addition stock-logs (delta > 0) for the hotel within the window. */
  getAdditionReasons(hotelId: string, sinceDays?: number): Promise<AdditionReasonRow[]>
  /** movement_category values already decided (approved/rejected). */
  getKnownMovementCategories(hotelId: string): Promise<string[]>
  /** Distinct relationship edge types + counts for the hotel. */
  getEdgeTypeCounts(hotelId: string): Promise<EdgeTypeCount[]>
}

const inputSchema = z.object({
  hotelId: z.string().uuid(),
  sinceDays: z.number().int().min(1).max(365).optional(),
  minSupport: z.number().int().min(1).max(10000).optional(),
})

const gapSchema = z.object({
  kind: z.enum(['new_category', 'new_edge_type']),
  targetType: z.string(),
  targetField: z.string(),
  proposed: z.string(),
  rationale: z.string(),
  evidence: z.object({
    occurrences: z.number().int().nonnegative(),
    totalConsidered: z.number().int().nonnegative(),
    coverage: z.number(),
    examples: z.array(z.string()),
  }),
  confidence: z.number().min(0).max(1),
})

const outputSchema = z.object({
  gaps: z.array(gapSchema),
  scanned: z.number().int().nonnegative(),
  basis: z.string(),
  confidence: z.number().min(0).max(1),
})

export type DetectOntologyGapsInput = z.infer<typeof inputSchema>
export type DetectOntologyGapsOutput = z.infer<typeof outputSchema>

export function makeDetectOntologyGapsTool(
  reader: OntologyReader,
): LogicTool<DetectOntologyGapsInput, DetectOntologyGapsOutput> {
  return {
    name: 'detect_ontology_gaps',
    category: 'logic',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Scans the hotel\'s stock-removal history for recurring free-text reasons that should be ' +
      'typed (a removal_category the ontology doesn\'t capture yet) and returns proposed typed ' +
      'extensions with evidence + confidence. Use for "what is the ontology missing", "should we ' +
      'add a category", "untyped patterns in our data". Proposals are advice — they never change ' +
      'the schema on their own.',
    inputSchema,
    outputSchema,
    examples: [
      {
        input: { hotelId: '00000000-0000-0000-0000-000000000000' },
        output: {
          gaps: [{
            kind: 'new_category', targetType: 'StockLog', targetField: 'removal_category',
            proposed: 'Consumed',
            rationale: '1820 of 1820 uncategorized removals (100%) read as "Consumed" but are stored only as free text — promote it to a typed removal_category.',
            evidence: { occurrences: 1820, totalConsidered: 1820, coverage: 1, examples: ['pos: daily consumption'] },
            confidence: 0.97,
          }],
          scanned: 1820,
          basis: 'reason-lexicon-v1',
          confidence: 0.97,
        },
      },
    ],
    invoke: async (input) => {
      const [removalRows, knownRemoval, additionRows, knownMovement, edgeCounts] = await Promise.all([
        reader.getRemovalReasons(input.hotelId, input.sinceDays),
        reader.getKnownRemovalCategories(input.hotelId),
        reader.getAdditionReasons(input.hotelId, input.sinceDays),
        reader.getKnownMovementCategories(input.hotelId),
        reader.getEdgeTypeCounts(input.hotelId),
      ])
      const gaps: OntologyGap[] = [
        ...detectRemovalCategoryGaps(removalRows,  { knownCategories: knownRemoval,  minSupport: input.minSupport }),
        ...detectAdditionCategoryGaps(additionRows, { knownCategories: knownMovement, minSupport: input.minSupport }),
        ...detectUntypedEdgeGaps(edgeCounts, { knownEdgeTypes: EDGE_TYPES }),
      ].sort((a, b) => b.evidence.occurrences - a.evidence.occurrences)
      const confidence = gaps.reduce((m, g) => Math.max(m, g.confidence), 0)
      return { gaps, scanned: removalRows.length + additionRows.length, basis: 'reason-lexicon-v1', confidence }
    },
  }
}
