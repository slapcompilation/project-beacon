// Layer: Mind — Modeling Objectives & Adapters (Predictive Layer)
//
// A Modeling Objective is a container, not a model. It owns N candidate model
// assets (trained-in-platform, imported file, containerized, or externally-
// hosted endpoint), one eval config, one release lifecycle, and N deployments.
//
// A Model Adapter is the typed boundary between the objective and the
// implementation. No code anywhere talks to a model directly — it talks to the
// adapter, which is wrapped by a Logic Tool.
//
// This layer is deferred until we ship our first real (non-baseline) model.
// The types live here so that when a Prophet / sklearn / hosted-LLM
// implementation lands, it has a contract to satisfy.
//
// See CLAUDE.md → "Modeling Objectives and Adapters (Predictive Layer —
// Deferred)" for the full pattern and the 6-step instantiation procedure.

// ── Adapter ──────────────────────────────────────────────────────────────────

/**
 * The typed boundary between an objective and an implementation. Adapters
 * normalize Prophet / sklearn / containerized / external-API models behind
 * one consumable shape so that callers (pipelines, Logic Tools, agents)
 * don't know which underlying framework runs.
 *
 * Declare `inputSchema` and `outputSchema` as named typed shapes — the AIP
 * adapter pattern uses Tabular columns + Parameters. Until we adopt zod
 * here, use plain TypeScript generics and narrow at call sites.
 */
export interface ModelAdapter<TInput = unknown, TOutput = unknown> {
  /** Stable identifier; pairs with the Modeling Objective. */
  name: string
  /** Semantic version. New deployments declare a release tag pinning a version. */
  version: string

  /** Input schema; future-zod placeholder. */
  inputSchema: unknown
  /** Output schema; future-zod placeholder. */
  outputSchema: unknown

  /** Pure inference. Implementations call the underlying framework here. */
  runInference: (input: TInput) => Promise<TOutput>
}

// ── Modeling Objective ───────────────────────────────────────────────────────

export interface ModelingObjective {
  /** Stable identifier (e.g. 'consumption_forecast'). */
  name: string
  /** One-paragraph description of the business goal. */
  description: string

  /**
   * The currently-active adapter for this objective. Pointed to by the
   * production release. Logic Tools delegate here.
   */
  defaultAdapter: string

  /** All registered adapter names that target this objective. */
  candidates: ReadonlyArray<string>
}

// ── Eval suite ───────────────────────────────────────────────────────────────

/**
 * Bound to the objective, not the adapter. Every submission is scored on the
 * same datasets + metrics, so the eval dashboard compares candidates
 * apples-to-apples.
 */
export interface EvalSuite {
  objective: string
  datasets: ReadonlyArray<string>
  /** Metric library names (e.g. 'regression', 'binary_classification'). */
  metrics: ReadonlyArray<string>
  /** Optional cohort slices (e.g. per-hotel, per-org). */
  subsets?: ReadonlyArray<string>
  /** At least 10 historical cases per AIP convention. */
  cases: ReadonlyArray<{
    id: string
    input: unknown
    expectedOutput?: unknown
  }>
}

// ── Release lifecycle ────────────────────────────────────────────────────────

export type ReleaseStage = 'sandbox' | 'staging' | 'production'

export interface Release {
  objective: string
  adapter: string
  adapterVersion: string
  stage: ReleaseStage
  /** Human-readable release tag (e.g. 'production-2.2'). */
  tag: string
  releasedAt: Date
  releasedBy: string
  /** Compatibility check result snapshot. */
  compatibilityPassed: boolean
}

// ── Deployment ───────────────────────────────────────────────────────────────

export type DeploymentKind =
  /** Real-time endpoint, user-facing. */
  | 'live'
  /** Pipeline-driven; populates computed properties on nodes. */
  | 'batch'

export interface Deployment {
  /** Release tag this deployment serves. */
  release: string
  kind: DeploymentKind
  /** Resource profile identifier (e.g. 'low-cpu-low-memory'). */
  resourceProfile: string
  /**
   * Dataset path that records every input + output of this deployment.
   * The inference history is the auditable trace — agents that called this
   * deployment can be traced back row-by-row.
   */
  inferenceHistory?: string
}

// ── Registries ───────────────────────────────────────────────────────────────

export const objectiveRegistry: Map<string, ModelingObjective> = new Map()
export const adapterRegistry: Map<string, ModelAdapter> = new Map()
/** Eval suite per objective (bound to the objective, not the adapter). */
export const evalSuiteRegistry: Map<string, EvalSuite> = new Map()

export function registerObjective(objective: ModelingObjective): void {
  if (objectiveRegistry.has(objective.name)) {
    throw new Error(`Objective '${objective.name}' already registered`)
  }
  objectiveRegistry.set(objective.name, objective)
}

export function registerEvalSuite(suite: EvalSuite): void {
  evalSuiteRegistry.set(suite.objective, suite)
}

export function getEvalSuite(objective: string): EvalSuite | undefined {
  return evalSuiteRegistry.get(objective)
}

export function registerAdapter<TInput, TOutput>(
  adapter: ModelAdapter<TInput, TOutput>,
): void {
  const key = `${adapter.name}@${adapter.version}`
  if (adapterRegistry.has(key)) {
    throw new Error(`Adapter '${key}' already registered`)
  }
  adapterRegistry.set(key, adapter as ModelAdapter)
}

export function getObjective(name: string): ModelingObjective | undefined {
  return objectiveRegistry.get(name)
}

export function getAdapter(
  name: string,
  version: string,
): ModelAdapter | undefined {
  return adapterRegistry.get(`${name}@${version}`)
}

export { recommendAdapterPromotion } from './promotion'
export type { AdapterEval, PromotionRecommendation } from './promotion'
