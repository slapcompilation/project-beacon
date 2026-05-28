import { z } from 'zod'
import { createBlock, llmCallWithSchema } from '../../runtime'

const inputSchema = z.object({
  prompt: z.string().min(1),
  hotelId: z.string().uuid(),
})

const outputSchema = z.object({
  variantId: z.string().uuid(),
  variantName: z.string().min(1),
  /** Confidence in the resolution; below 0.6 should trigger clarification at the caller. */
  confidence: z.number().min(0).max(1),
})

export type ExtractVariantInput = z.infer<typeof inputSchema>
export type ExtractVariantOutput = z.infer<typeof outputSchema>

export const extractVariantBlock = createBlock<ExtractVariantInput, ExtractVariantOutput>({
  name: 'extract_variant',
  inputSchema,
  outputSchema,
  systemPrompt:
    'You resolve a free-text operator overstock concern to exactly one inventory variant. ' +
    'Return the variant id, the variant name as written, and a confidence in [0, 1]. ' +
    'If the prompt mentions multiple candidate variants or is ambiguous, set confidence below 0.6.',
  run: async (input, ctx) => {
    const { output } = await llmCallWithSchema(ctx.llm, {
      systemPrompt:
        'You resolve a free-text operator overstock concern to exactly one inventory variant. ' +
        'Return the variant id, the variant name as written, and a confidence in [0, 1].',
      userPrompt: `Hotel: ${input.hotelId}\nOperator concern: "${input.prompt}"\nResolve to one variant.`,
      schema: outputSchema,
    })
    return output
  },
})
