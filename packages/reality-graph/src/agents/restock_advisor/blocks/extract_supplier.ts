import { z } from 'zod'
import { createBlock, llmCallWithSchema } from '../../runtime'

const inputSchema = z.object({
  prompt: z.string().min(1),
})

const outputSchema = z.object({
  supplierName: z.string().nullable(),
  /** Confidence in the resolution. null supplier with high confidence = "none mentioned". */
  confidence: z.number().min(0).max(1),
})

export type ExtractSupplierInput = z.infer<typeof inputSchema>
export type ExtractSupplierOutput = z.infer<typeof outputSchema>

export const extractSupplierBlock = createBlock<ExtractSupplierInput, ExtractSupplierOutput>({
  name: 'extract_supplier',
  inputSchema,
  outputSchema,
  systemPrompt:
    'You identify whether the operator named a specific supplier in their concern. ' +
    'Return the supplier name verbatim if present, or null if not. Confidence reflects how unambiguous the mention is.',
  run: async (input, ctx) => {
    const { output } = await llmCallWithSchema(ctx.llm, {
      systemPrompt:
        'You identify whether the operator named a specific supplier in their concern. Return the name verbatim or null.',
      userPrompt: `Operator concern: "${input.prompt}"`,
      schema: outputSchema,
    })
    return output
  },
})
