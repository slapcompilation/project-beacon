// The expiry monitor as a proposal SOURCE, not a writer.
//
// It used to call createProposal directly, which meant a second write path that
// never saw decideAutoExecution — safe only because WRITE_OFF happens not to be
// auto-executable, which nothing enforces. Now it hands proposals to the cycle
// and takes the same gate, constraints and audit as everything else.
//
// The monitor's own good idea survives untouched: the METRIC is deterministic
// (expiry batches from the DB) and the TRIGGER is the operator's tunable
// threshold in org_policy.

import {
  selectExpiryTriggers, expiryHitToWriteOff,
  type AgentProposal, type CycleVariant, type ExpiryBatch, type OrgPolicy,
} from '@beacon/reality-graph'
import { fetchExpiryBatches } from '@/features/inventory/api'

export interface ExpiryProposal {
  variant: CycleVariant
  proposal: AgentProposal
}

/** One proposal per variant — its most urgent batch leads (hits are sorted).
 *  Returns [] when the monitor is off, so the caller needs no special case. */
export async function buildExpiryProposals(args: {
  policy: OrgPolicy | undefined
  hotelId: string
  userId: string
  /** Variants this cycle is allowed to touch; anything else is dropped. */
  scope: ReadonlyArray<CycleVariant>
}): Promise<ExpiryProposal[]> {
  const rule = args.policy?.monitors.expiry
  if (!rule?.enabled) return []

  const rows = await fetchExpiryBatches(Math.max(rule.threshold_days, 1))
  const batches: ExpiryBatch[] = rows.map((r) => ({
    variantId: r.variant_id,
    variantLabel: r.variant_name && r.variant_name !== 'Standard'
      ? `${r.product_name} · ${r.variant_name}`
      : r.product_name,
    quantity: r.quantity,
    daysUntilExpiry: r.days_until_expiry,
    costAtRisk: r.cost_at_risk,
    hotelId: args.hotelId,
  }))

  const inScope = new Map(args.scope.map((v) => [v.id, v]))
  const out: ExpiryProposal[] = []
  const seen = new Set<string>()

  for (const hit of selectExpiryTriggers(batches, rule)) {
    if (seen.has(hit.variantId)) continue
    const variant = inScope.get(hit.variantId)
    if (!variant) continue          // outside what this cycle scanned
    seen.add(hit.variantId)

    const when = hit.daysUntilExpiry <= 0 ? 'has expired' : `expires in ${String(hit.daysUntilExpiry)}d`
    out.push({
      variant,
      proposal: {
        action: expiryHitToWriteOff(hit, args.userId),
        confidence: Math.min(0.95, 0.5 + hit.urgency / 20),
        reasoning: `Expiry monitor fired: ${hit.variantLabel} ${when}, €${hit.costAtRisk.toFixed(0)} at risk. Trigger: days_until_expiry ≤ ${String(rule.threshold_days)}.`,
        // The `monitor:` prefix is what the cycle reads to label the source.
        provenance: [{ kind: 'tool', ref: 'monitor:expiry', detail: `days_until_expiry=${String(hit.daysUntilExpiry)} ≤ ${String(rule.threshold_days)}` }],
      } as AgentProposal,
    })
  }
  return out
}
