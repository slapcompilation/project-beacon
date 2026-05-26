import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'

const inputSchema = z.object({
  hotelId:   z.string().uuid(),
  query:     z.string().min(2),
  /** Cosine similarity threshold; default 0.70. */
  threshold: z.number().min(0).max(1).optional(),
  /** Max chunks returned; default 8. */
  limit:     z.number().int().min(1).max(50).optional(),
})

const matchSchema = z.object({
  id:           z.string().uuid(),
  document_id:  z.string().uuid(),
  chunk_key:    z.string(),
  page:         z.number().int(),
  text_preview: z.string(),
  similarity:   z.number(),
})

const outputSchema = z.object({
  matches:       z.array(matchSchema),
  query:         z.string(),
  totalMatches:  z.number().int().nonnegative(),
})

export type QueryDocumentChunksInput  = z.infer<typeof inputSchema>
export type QueryDocumentChunksOutput = z.infer<typeof outputSchema>

/**
 * Semantic search over every document chunk in a hotel via the
 * match_document_chunks pgvector RPC. Use when the operator's concern
 * may be answered by something written in a contract, spec, scanned
 * invoice, or transcribed call rather than something in the operational
 * graph (stock levels, supplier reliability, etc.).
 *
 * Cite any chunk you use in the proposal's provenance with
 * { kind: 'document', ref: <document_id>, detail: 'page N: "<snippet>"' }
 * — createProposal writes the cited_in edges automatically (Phase 16.c).
 */
export function makeQueryDocumentChunksTool(
  reader: GraphReader,
): LogicTool<QueryDocumentChunksInput, QueryDocumentChunksOutput> {
  return {
    name: 'query_document_chunks',
    category: 'search',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Semantic search across all uploaded documents in the hotel. Returns the best-matching chunks (page + preview + similarity) for a natural-language query. ' +
      'Use to surface contractual clauses, supplier specs, expiry policies, or recorded conversations relevant to the current decision.',
    inputSchema,
    outputSchema,
    traversableLinks: ['describes_entity', 'cited_in'],
    examples: [
      {
        input: { hotelId: '00000000-0000-0000-0000-000000000000', query: 'late delivery penalty' },
        output: { matches: [], query: 'late delivery penalty', totalMatches: 0 },
      },
    ],
    invoke: async (input) => {
      const matches = await reader.searchDocumentChunks(input.hotelId, input.query, {
        threshold: input.threshold,
        limit:     input.limit,
      })
      return {
        matches:      matches.slice(0, input.limit ?? 8),
        query:        input.query,
        totalMatches: matches.length,
      }
    },
  }
}
