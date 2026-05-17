// Layer: Compute — Logic Tool Registry
//
// A Logic Tool is a named function with a typed input schema, a typed output
// schema, a natural-language description, optional few-shot examples, a
// semantic version, and a pure `invoke(input)` implementation.
//
// Tools are dual-callable: the same signature is invoked by hooks (UI) and by
// the agent orchestrator (LLM). UI code calls `tool.invoke(...)` directly;
// agent blocks pick from a registered list.
//
// See CLAUDE.md → "The Logic Tool Registry (Compute Layer)" for full rules.

/**
 * A typed Logic Tool. Tools are pure: they may read the graph, never mutate.
 * Mutations go through the Action Registry.
 */
export interface LogicTool<TInput = unknown, TOutput = unknown> {
  /** Stable, snake_case identifier the LLM sees in its tool list. */
  name: string

  /** Semantic version. Bump when input/output shape or `basis` changes. */
  version: string

  /**
   * Natural-language description the LLM uses to decide when to call this
   * tool. Should describe *what it returns* and *when to use it*, not how
   * it works internally.
   */
  description: string

  /**
   * Typed input schema. Placeholder type until we adopt zod (or similar)
   * at first-tool implementation time. Until then, implementations should
   * narrow `TInput` themselves.
   */
  inputSchema: unknown

  /** Typed output schema. Same caveat as `inputSchema`. */
  outputSchema: unknown

  /**
   * Optional few-shot examples teaching the LLM when/how to call this tool.
   * Useful for tools whose call sites depend on reasoning rather than
   * obvious entity references.
   */
  examples?: ReadonlyArray<{ input: TInput; output: TOutput }>

  /** Pure invocation. Must not mutate the graph. */
  invoke: (input: TInput) => Promise<TOutput>
}

/**
 * Standard envelope for tool outputs that carry derived values. Tools whose
 * results are computed (not directly retrieved) must populate `basis` and
 * `confidence` so the transparency layer can surface them.
 */
export interface ToolResultMeta {
  /** Short identifier of the computation basis (e.g. 'rolling-30d-avg'). */
  basis: string
  /** Confidence in the result, 0–1. */
  confidence: number
}

/** Scope of a tool's reads. Mirrors the multi-echelon ontology tiers. */
export type ToolScope = 'hotel' | 'organization'

/**
 * The tool registry. Tools self-register on import. Future surface:
 * `import { registry } from '@beacon/reality-graph/tools'`
 * `await registry.get('forecast_consumption').invoke({ ... })`.
 *
 * Empty for now — Phase A populates this.
 */
export const toolRegistry: Map<string, LogicTool> = new Map()

export function registerTool<TInput, TOutput>(
  tool: LogicTool<TInput, TOutput>,
): void {
  if (toolRegistry.has(tool.name)) {
    throw new Error(`Logic tool '${tool.name}' already registered`)
  }
  toolRegistry.set(tool.name, tool as LogicTool)
}

export function getTool(name: string): LogicTool | undefined {
  return toolRegistry.get(name)
}

export function listTools(): ReadonlyArray<LogicTool> {
  return [...toolRegistry.values()]
}
