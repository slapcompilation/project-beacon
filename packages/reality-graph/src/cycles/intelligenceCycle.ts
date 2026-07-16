// The unattended intelligence cycle, decoupled from any runtime. Scan a scope
// for candidates, run an agent on each, then route every proposal through the
// shared auto-execution gate: confident + uncontested ones dispatch themselves;
// everything else is queued for the operator. Callers inject the agent runner,
// persistence, and dispatch — so the browser (operator-triggered) and a cron
// edge function (unattended) drive the exact same tested loop.

import type { BeaconAction } from '../actions/index'
import type { AgentProposal } from '../agents/index'
import {
  evaluateConstraints,
  decideAutoExecution,
  DEFAULT_AUTO_EXEC_POLICY,
  type ConstraintRecord,
  type AutoExecutionPolicy,
  type ActiveAgentReleases,
} from '../constraints/index'
import type { CalibrationReport } from '../calibration/index'

export interface CycleVariant {
  id: string
  name: string
}

export type CycleOutcome = 'auto-executed' | 'queued' | 'duplicate' | 'no-proposal' | 'error'

export interface CycleItem {
  variantId: string
  variantName: string
  outcome: CycleOutcome
  actionType?: BeaconAction['type']
  proposalId?: string
  reason?: string
}

export interface CycleResult {
  scanned: number
  proposed: number
  autoExecuted: number
  queued: number
  /** Proposals skipped because an open proposal already covered the variant+action. */
  deduped: number
  ranAt: string
  items: CycleItem[]
}

export interface IntelligenceCycleDeps {
  /** At-risk candidates, already scanned + scoped by the caller. */
  variants: ReadonlyArray<CycleVariant>
  /** Run the agent for one variant; returns the proposals it emitted. */
  runAgent: (variant: CycleVariant) => Promise<ReadonlyArray<AgentProposal>>
  /** Persist a proposal; resolves to its stored id. */
  persistProposal: (variant: CycleVariant, proposal: AgentProposal) => Promise<string>
  /** Constraint records active for the scope, evaluated per proposed action. */
  constraints: ReadonlyArray<ConstraintRecord>
  /** Dispatch an auto-approved action; resolves true only on a successful write. */
  dispatch: (action: BeaconAction) => Promise<boolean>
  /** Mark a persisted proposal approved after its action dispatched. */
  markApproved: (proposalId: string) => Promise<void>
  /** Group a *queued* proposal under a Case envelope (open or reuse one per
   *  variant-situation) so the operator decision has a home: trigger →
   *  proposals → outcome. Not called for auto-executed actions — those are
   *  audited via StockLog, not Cases. Best-effort; a failure never drops the
   *  proposal. */
  openCase?: (variant: CycleVariant, proposalId: string, action: BeaconAction) => Promise<void>
  /** Per-action-type confidence floors. Defaults to the conservative V1 policy. */
  policy?: AutoExecutionPolicy
  /** The agent producing the proposals. When set together with `releases`,
   *  the release gate in decideAutoExecution enforces a production release. */
  agent?: { agentName: string; agentVersion: string }
  /** Releases visible in scope (typically from get_current_agent_releases()).
   *  Required for auto-execution — the gate is fail-closed (Gap C). */
  releases?: ActiveAgentReleases
  /** Opt out of the fail-closed release gate. Default false: without a
   *  production release every proposal queues. Only the no-write scenario
   *  sandbox + gate-agnostic tests set this; production callers never do. */
  allowUnreleased?: boolean
  /** Keys (`${actionType}:${variantId}`) of proposals already open/pending in
   *  scope. The cycle skips re-proposing any of these — without it every run
   *  re-creates the same proposals and the review queue fills with duplicates. */
  openProposalKeys?: ReadonlySet<string>
  /** Phase E3 — per-agent confidence floor overrides. Threaded into the
   *  auto-execution gate; supersedes the per-action-type threshold when the
   *  proposing agent's name appears here. */
  agentOverrides?: Record<string, number>
  /** Phase P2 — calibration trust budget. The proposing agent's reliability
   *  report, computed once by the caller from its resolved proposals. Passed to
   *  every auto-execution decision: a proven-overconfident agent is queued, and
   *  (with requireCalibration) auto-execution needs proven calibration at all. */
  calibration?: CalibrationReport
  requireCalibration?: boolean
  minCalibrationSamples?: number
  /** Q3 — forecast-accuracy trust budget. Realized MAPE per forecast basis
   *  (from scored forecast_observations), computed once by the caller. A proposal
   *  sized by a basis running above the ceiling is queued even if the agent is
   *  well-calibrated. Absent → no forecast veto (behaviour unchanged). */
  forecastAccuracyByBasis?: ReadonlyMap<string, { mape: number; n: number }>
  /** MAPE ceiling for the forecast veto. Default 0.4. */
  maxForecastMape?: number
  /** Cap per cycle so a large catalogue can't trigger a request storm. */
  maxVariants?: number
  /** Injected for deterministic constraint evaluation + timestamps in tests. */
  now?: () => Date
}

const DEFAULT_MAX_VARIANTS = 25

export async function runIntelligenceCycle(deps: IntelligenceCycleDeps): Promise<CycleResult> {
  const policy = deps.policy ?? DEFAULT_AUTO_EXEC_POLICY
  const maxVariants = deps.maxVariants ?? DEFAULT_MAX_VARIANTS
  const now = deps.now ?? (() => new Date())
  const scope = deps.variants.slice(0, maxVariants)

  const items: CycleItem[] = []
  let proposed = 0
  let autoExecuted = 0
  let queued = 0
  let deduped = 0
  // Open proposals already covering a variant+action — seeded from the caller,
  // then grown within the run so an agent can't emit the same proposal twice.
  const seen = new Set<string>(deps.openProposalKeys ?? [])

  for (const variant of scope) {
    try {
      const proposals = await deps.runAgent(variant)
      if (proposals.length === 0) {
        items.push({ variantId: variant.id, variantName: variant.name, outcome: 'no-proposal' })
        continue
      }

      for (const proposal of proposals) {
        const dedupKey = proposalDedupKey(proposal.action)
        if (dedupKey && seen.has(dedupKey)) {
          deduped++
          items.push({
            variantId: variant.id, variantName: variant.name, outcome: 'duplicate',
            actionType: proposal.action.type,
            reason: 'an open proposal already covers this variant + action',
          })
          continue
        }
        if (dedupKey) seen.add(dedupKey)
        const proposalId = await deps.persistProposal(variant, proposal)
        proposed++

        const violations = evaluateConstraints(proposal.action, deps.constraints, { now: now() })
        // Q3: the realized accuracy of the basis that sized this proposal.
        const faBasis = proposal.forecast?.basis
        const fa = faBasis ? deps.forecastAccuracyByBasis?.get(faBasis) : undefined
        const decision = decideAutoExecution({
          action: proposal.action,
          confidence: proposal.confidence,
          violations,
          policy,
          agent: deps.agent,
          releases: deps.releases,
          allowUnreleased: deps.allowUnreleased,
          agentOverrides: deps.agentOverrides,
          calibration: deps.calibration,
          requireCalibration: deps.requireCalibration,
          minCalibrationSamples: deps.minCalibrationSamples,
          forecastAccuracy: fa && faBasis ? { basis: faBasis, mape: fa.mape, n: fa.n } : undefined,
          maxForecastMape: deps.maxForecastMape,
        })

        if (decision.autoExecute && (await deps.dispatch(proposal.action))) {
          await deps.markApproved(proposalId)
          autoExecuted++
          items.push({
            variantId: variant.id,
            variantName: variant.name,
            outcome: 'auto-executed',
            actionType: proposal.action.type,
            proposalId,
            reason: decision.reason,
          })
          continue
        }

        // Queued for the operator → give the decision a Case home. Best-effort.
        if (deps.openCase) {
          try { await deps.openCase(variant, proposalId, proposal.action) } catch { /* non-fatal */ }
        }
        queued++
        items.push({
          variantId: variant.id,
          variantName: variant.name,
          outcome: 'queued',
          actionType: proposal.action.type,
          proposalId,
          reason: decision.reason,
        })
      }
    } catch {
      items.push({ variantId: variant.id, variantName: variant.name, outcome: 'error' })
    }
  }

  return {
    scanned: scope.length,
    proposed,
    autoExecuted,
    queued,
    deduped,
    ranAt: now().toISOString(),
    items,
  }
}

/** Dedup key for a proposing action — actionType + the variant it targets. Lets
 *  the cycle skip re-proposing what an open proposal already covers. */
function proposalDedupKey(action: BeaconAction): string | null {
  const variantId = (action as { variantId?: string }).variantId
  return variantId ? `${action.type}:${variantId}` : null
}
