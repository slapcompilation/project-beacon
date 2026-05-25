import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'

const inputSchema = z.object({
  variantId: z.string().uuid(),
})

const documentSchema = z.object({
  id:             z.string().uuid(),
  title:          z.string(),
  mime_type:      z.string(),
  ingestion_stage: z.string(),
  chunks:         z.array(
    z.object({
      chunk_id:     z.string(),
      page:         z.number().int(),
      text_preview: z.string(),
    }),
  ),
})

const outputSchema = z.object({
  documents:   z.array(documentSchema),
  totalChunks: z.number().int().nonnegative(),
})

export type QueryVariantDocumentsInput  = z.infer<typeof inputSchema>
export type QueryVariantDocumentsOutput = z.infer<typeof outputSchema>

/**
 * Returns every document the operator has linked to this variant via a
 * `describes_entity` edge, with chunk-level text previews so the agent can
 * cite specific pages in its reasoning + provenance.
 *
 * Agents should include any cited document as a `{ kind: 'document', ref:
 * <doc_id>, detail: 'page N: "<snippet>"' }` provenance entry — the
 * proposal persister picks those up and writes corresponding `cited_in`
 * edges into relationship_edges automatically.
 */
export function makeQueryVariantDocumentsTool(
  reader: GraphReader,
): LogicTool<QueryVariantDocumentsInput, QueryVariantDocumentsOutput> {
  return {
    name: 'query_variant_documents',
    category: 'data',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Returns documents linked to a variant via describes_entity edges, including per-page chunk previews. ' +
      'Use to cite contracts, specs, or supplier sheets in your reasoning. Include any cited document in ' +
      'the proposal\'s provenance with kind="document" and ref=<doc_id> so cited_in edges land automatically.',
    inputSchema,
    outputSchema,
    traversableLinks: ['describes_entity'],
    examples: [
      {
        input:  { variantId: '00000000-0000-0000-0000-000000000000' },
        output: { documents: [], totalChunks: 0 },
      },
    ],
    invoke: async (input) => {
      const docs = await reader.getDocumentsForEntity('variant', input.variantId)
      const out  = docs.map((d) => ({
        id:              d.id,
        title:           d.title,
        mime_type:       d.mime_type,
        ingestion_stage: d.ingestion_stage,
        chunks:          (d.chunks ?? []).map((c) => ({
          chunk_id:     c.chunk_id,
          page:         c.page,
          text_preview: c.text_preview,
        })),
      }))
      const totalChunks = out.reduce((s, d) => s + d.chunks.length, 0)
      return { documents: out, totalChunks }
    },
  }
}
