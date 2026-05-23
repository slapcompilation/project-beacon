// LLM adapter — single boundary every block uses to call a model.
// Phase 1 ships with StubLLMClient (deterministic responses for tests + eval).
// Swap for an Anthropic/OpenAI implementation by satisfying the same interface.

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMToolSpec {
  name: string
  description: string
  inputSchema: unknown
}

export interface LLMToolCall {
  toolName: string
  input: unknown
  /** Optional 'Thought: …' the model emits before the call. */
  thought?: string
}

export interface LLMResponse<T = unknown> {
  /** Final structured output the block was asked to produce. May be undefined if `toolCalls` is non-empty. */
  output?: T
  /** Tool calls the model wants to make before producing output. */
  toolCalls: ReadonlyArray<LLMToolCall>
  /** Tokens consumed by this call. */
  tokensUsed: number
}

export interface LLMCallInput<T = unknown> {
  systemPrompt: string
  messages: ReadonlyArray<LLMMessage>
  tools?: ReadonlyArray<LLMToolSpec>
  /** zod schema or equivalent the model must produce. */
  outputSchema?: unknown
  /** Hint when block expects strict structured output. */
  expectsOutput?: T extends infer _ ? true : false
}

export interface LLMClient {
  call<T = unknown>(input: LLMCallInput<T>): Promise<LLMResponse<T>>
}

/**
 * Deterministic stub used by evals + integration tests. Configured with a list
 * of scripted responses; consumes them in order. Throws if exhausted.
 *
 * Real provider impl plugs in by satisfying LLMClient with a single class
 * that maps LLMCallInput → provider SDK call.
 */
export class StubLLMClient implements LLMClient {
  private scripted: LLMResponse[]
  private cursor = 0

  constructor(scripted: LLMResponse[]) {
    this.scripted = scripted
  }

  call<T>(_input: LLMCallInput<T>): Promise<LLMResponse<T>> {
    const next = this.scripted[this.cursor]
    if (!next) {
      throw new Error(`StubLLMClient exhausted: requested call ${String(this.cursor + 1)} but only ${String(this.scripted.length)} responses scripted`)
    }
    this.cursor++
    return Promise.resolve(next as LLMResponse<T>)
  }

  get callsConsumed(): number {
    return this.cursor
  }
}
