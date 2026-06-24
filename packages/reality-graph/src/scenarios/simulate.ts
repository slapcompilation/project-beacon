// Phase H step 2 — scenario simulation runner.
//
// Wraps runIntelligenceCycle with no-op persistence: persistProposal returns
// fake ids, dispatch returns true without writing, markApproved is a no-op.
// The CycleResult comes back unchanged in shape — items[] still reports
// outcomes — but nothing reached the real DB. The caller folds the result
// into the cached `last_simulation` on the scenario row.
//
// The caller is responsible for:
//   - Materializing the overlay-adjusted variant list (applyVariantOverlay
//     per row, prepended with any hypothetical "actions" the overlay queues)
//   - Loading constraints (base + overlay via mergeConstraintOverlay)
//   - Loading the merged policy (mergePolicyOverlay over org_policy)
//   - Optionally running a baseline cycle (same scope, no overlay) and
//     computing the delta — diffSimulations helps with that

import type { BeaconAction } from '../actions/index'
import type { AgentProposal } from '../agents/index'
import { runIntelligenceCycle, type CycleResult, type CycleVariant, type IntelligenceCycleDeps } from '../cycles/intelligenceCycle'

export interface SimulationDeps {
  /** Overlay-adjusted variant list to scan. */
  variants: ReadonlyArray<CycleVariant>
  /** Run the agent for one variant; SAME signature as production. */
  runAgent: (variant: CycleVariant) => Promise<ReadonlyArray<AgentProposal>>
  /** Constraint records (already merged with the overlay disabled/added set). */
  constraints: IntelligenceCycleDeps['constraints']
  /** Policy + caps + overrides (already merged with overlay). */
  policy?:          IntelligenceCycleDeps['policy']
  agentOverrides?:  IntelligenceCycleDeps['agentOverrides']
  agent?:           IntelligenceCycleDeps['agent']
  releases?:        IntelligenceCycleDeps['releases']
  maxVariants?:     number
  now?:             () => Date
}

/**
 * Runs the intelligence cycle with no-op persistence + dispatch. The returned
 * CycleResult tells the operator what WOULD have happened; nothing reached
 * the real graph.
 *
 * The persistProposal id is synthetic ('sim:<idx>') so the caller can attribute
 * dispatched-vs-queued items back to specific proposals if needed.
 */
export async function simulateCycleWithOverlay(deps: SimulationDeps): Promise<CycleResult> {
  let counter = 0
  return runIntelligenceCycle({
    variants:       deps.variants,
    runAgent:       deps.runAgent,
    constraints:    deps.constraints,
    policy:         deps.policy,
    agentOverrides: deps.agentOverrides,
    agent:          deps.agent,
    releases:       deps.releases,
    // A scenario is a no-write what-if — its preview reflects threshold,
    // constraint, and calibration logic, not production-release readiness, so it
    // opts out of the fail-closed release gate.
    allowUnreleased: true,
    maxVariants:    deps.maxVariants,
    now:            deps.now,

    persistProposal: () => Promise.resolve(`sim:${String(counter++)}`),
    dispatch:        (_action: BeaconAction) => Promise.resolve(true),
    markApproved:    () => Promise.resolve(),
  })
}

/**
 * Computes the delta between a baseline run (same scope, no overlay) and an
 * overlay run. Per-item flips show where the overlay changed an outcome.
 */
export function diffSimulations(baseline: CycleResult, overlay: CycleResult): {
  autoExecutedDelta: number
  queuedDelta:       number
  flips: Array<{
    variantId:   string
    variantName: string
    baseline:    string
    overlay:     string
  }>
} {
  const baselineByVariant = new Map<string, string>()
  for (const item of baseline.items) baselineByVariant.set(item.variantId, item.outcome)

  const flips: Array<{ variantId: string; variantName: string; baseline: string; overlay: string }> = []
  for (const item of overlay.items) {
    const baseOutcome = baselineByVariant.get(item.variantId)
    if (baseOutcome != null && baseOutcome !== item.outcome) {
      flips.push({
        variantId:   item.variantId,
        variantName: item.variantName,
        baseline:    baseOutcome,
        overlay:     item.outcome,
      })
    }
  }

  return {
    autoExecutedDelta: overlay.autoExecuted - baseline.autoExecuted,
    queuedDelta:       overlay.queued       - baseline.queued,
    flips,
  }
}
