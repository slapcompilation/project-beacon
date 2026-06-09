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

export interface CycleVariant {
  id: string
  name: string
}

export type CycleOutcome = 'auto-executed' | 'queued' | 'no-proposal' | 'error'

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
   *  Enables the release gate when set together with `agent`. */
  releases?: ActiveAgentReleases
  /** Phase E3 — per-agent confidence floor overrides. Threaded into the
   *  auto-execution gate; supersedes the per-action-type threshold when the
   *  proposing agent's name appears here. */
  agentOverrides?: Record<string, number>
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

  for (const variant of scope) {
    try {
      const proposals = await deps.runAgent(variant)
      if (proposals.length === 0) {
        items.push({ variantId: variant.id, variantName: variant.name, outcome: 'no-proposal' })
        continue
      }

      for (const proposal of proposals) {
        const proposalId = await deps.persistProposal(variant, proposal)
        proposed++

        const violations = evaluateConstraints(proposal.action, deps.constraints, { now: now() })
        const decision = decideAutoExecution({
          action: proposal.action,
          confidence: proposal.confidence,
          violations,
          policy,
          agent: deps.agent,
          releases: deps.releases,
          agentOverrides: deps.agentOverrides,
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
    ranAt: now().toISOString(),
    items,
  }
}
