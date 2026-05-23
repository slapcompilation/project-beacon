// HeuristicLLMClient: deterministic stand-in until @anthropic-ai/sdk plugs in.
// Resolves the two extract blocks (variant + supplier) by name matching against
// the variant the operator chose to start the agent against. Reason+propose
// block never calls the LLM (its run is purely tool-driven), so two scripted
// responses are enough.

import type { LLMClient, LLMResponse, LLMCallInput } from '@beacon/reality-graph'

export interface HeuristicLLMContext {
  variantId: string
  variantName: string
}

export class HeuristicLLMClient implements LLMClient {
  private responses: LLMResponse[]
  private cursor = 0

  constructor(ctx: HeuristicLLMContext) {
    this.responses = [
      {
        output: { variantId: ctx.variantId, variantName: ctx.variantName, confidence: 0.95 },
        toolCalls: [],
        tokensUsed: 0,
      },
      {
        output: { supplierName: null, confidence: 0.8 },
        toolCalls: [],
        tokensUsed: 0,
      },
    ]
  }

  call<T>(_input: LLMCallInput<T>): Promise<LLMResponse<T>> {
    const next = this.responses[this.cursor]
    if (!next) {
      throw new Error('HeuristicLLMClient exhausted — Phase 2 only handles 2 scripted calls')
    }
    this.cursor++
    return Promise.resolve(next as LLMResponse<T>)
  }
}
