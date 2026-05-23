// Logic Tool Registry.
// Same signature whether a human, automation, or LLM calls it.
// See CLAUDE.md → "Compute layer — Logic Tool Registry".

/** AIP-parity tool categories. Only `mutation` may write — and only via the Action Registry. */
export type ToolCategory =
  | 'data'        // fetch / filter / aggregate ontology nodes
  | 'logic'       // pure computation over inputs (forecasting, scoring, ranking)
  | 'search'      // semantic / vector search over nodes or documents
  | 'mutation'    // wraps an Apply Action — the only category allowed to write
  | 'utility'     // format dates, parse text, sanitize strings
  | 'predefined'  // framework helpers (think_step_by_step, request_clarification)
  | 'ui-control'  // surface-level helpers exposed to the operator copilot

/** Where the implementation runs. In-process is the default; remote/container for adapter-backed or heavy compute. */
export type ToolKind = 'inproc' | 'remote' | 'container'

export type ToolScope = 'hotel' | 'organization'

/**
 * Standard envelope for tool outputs that carry derived values. Tools whose
 * results are computed (not directly retrieved) must populate `basis` and
 * `confidence` so the transparency layer can surface them.
 */
export interface ToolResultMeta {
  /** Short identifier of the computation basis (e.g. 'rolling-30d-avg' | 'prophet-v1'). */
  basis: string
  /** Confidence in the result, 0–1. */
  confidence: number
}

export interface LogicTool<TInput = unknown, TOutput = unknown> {
  /** Stable, snake_case identifier the LLM sees in its tool list. */
  name: string

  /** AIP-parity category. Determines what the tool is allowed to do. */
  category: ToolCategory

  /** How the tool runs. `inproc` is the default; `remote`/`container` for adapter-backed work. */
  kind: ToolKind

  /** Semantic version. Bump when input/output shape or `basis` changes. */
  version: string

  /**
   * Natural-language description the LLM uses to decide when to call this tool.
   * Describe *what it returns* and *when to use it*, not how it works internally.
   */
  description: string

  /**
   * Edges this tool may traverse. Surfaced to the LLM so it can reason about
   * which traversals the tool will (and won't) follow. Ad-hoc traversal is rejected.
   */
  traversableLinks?: ReadonlyArray<string>

  /** Typed input schema (zod or equivalent at impl time). */
  inputSchema: unknown

  /** Typed output schema. Computed results should embed `ToolResultMeta`. */
  outputSchema: unknown

  /** Optional few-shot examples. */
  examples?: ReadonlyArray<{ input: TInput; output: TOutput }>

  /** Default scope inheritance — `'hotel'` unless declared otherwise. */
  scope?: ToolScope

  /** Pure unless `category === 'mutation'`. Mutation tools must dispatch via the Action Registry. */
  invoke: (input: TInput) => Promise<TOutput>
}

export const toolRegistry: Map<string, LogicTool> = new Map()

export function registerTool<TInput, TOutput>(tool: LogicTool<TInput, TOutput>): void {
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

export function listToolsByCategory(category: ToolCategory): ReadonlyArray<LogicTool> {
  return [...toolRegistry.values()].filter((t) => t.category === category)
}

// ── Concrete tools — Phase 1: restock_advisor toolset ─────────────────────────

export type { GraphReader, VariantRow, RestockRequestRow, StockLogRow, SupplierRow, HotelRow } from './graph_reader'
export {
  makeQueryOpenRestockRequestsTool,
  type QueryOpenRestockRequestsInput,
  type QueryOpenRestockRequestsOutput,
} from './data/query_open_restock_requests'
export {
  makeQuerySisterPropertyInventoryTool,
  type QuerySisterPropertyInventoryInput,
  type QuerySisterPropertyInventoryOutput,
} from './data/query_sister_property_inventory'
export {
  makeForecastConsumptionTool,
  type ForecastConsumptionInput,
  type ForecastConsumptionOutput,
} from './logic/forecast_consumption'
export {
  makeRankAlternativeSuppliersTool,
  type RankAlternativeSuppliersInput,
  type RankAlternativeSuppliersOutput,
} from './logic/rank_alternative_suppliers'
export {
  requestClarificationTool,
  type RequestClarificationInput,
  type RequestClarificationOutput,
} from './predefined/request_clarification'
