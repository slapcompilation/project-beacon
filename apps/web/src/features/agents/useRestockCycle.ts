// Phase 1 — the unattended intelligence cycle (operator-triggered for now,
// cron-callable later). Instead of one variant at a time, it scans the hotel
// for at-risk stock, runs restock_advisor on each, and routes every proposal
// through the shared auto-execution gate: confident + uncontested ones apply
// themselves (triggered_by 'ai_auto_approved'); everything else lands in the
// review queue. Returns a structured summary the Command home renders.
//
// Runs the agent with the heuristic LLM client — the variant is already known
// from the scan, so no extraction call (and no LLM spend) is needed; the
// reasoning block's tool calls are deterministic.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  buildRestockAdvisorAgent,
  evaluateConstraints,
  decideAutoExecution,
  DEFAULT_AUTO_EXEC_POLICY,
  type BeaconAction,
} from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import { fetchActiveConstraints, rowToConstraintRecord } from '@/features/constraints/api'
import { useProducts } from '@/features/inventory/hooks'
import { makeSupabaseGraphReader } from './graphReader'
import { HeuristicLLMClient } from './heuristicLLM'
import { createProposal, decideProposal } from './proposalsApi'
import { useActiveForecastAdapter } from '@/features/modelingObjectives/activeAdapter'

/** Cap per cycle so a large catalogue can't trigger a request storm in V1. */
const MAX_VARIANTS_PER_CYCLE = 25

export type CycleOutcome = 'auto-executed' | 'queued' | 'no-proposal' | 'error'

export interface CycleItem {
  variantId:   string
  variantName: string
  outcome:     CycleOutcome
  actionType?: BeaconAction['type']
  proposalId?: string
  reason?:     string
}

export interface CycleResult {
  scanned:      number
  proposed:     number
  autoExecuted: number
  queued:       number
  ranAt:        string
  items:        CycleItem[]
}

export function useRestockCycle() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const { data: products = [] } = useProducts()
  const forecastAdapter = useActiveForecastAdapter()
  const queryClient = useQueryClient()

  return useMutation<CycleResult>({
    mutationFn: async () => {
      if (!hotelId) throw new Error('No active hotel selected')
      if (!userId)  throw new Error('Not signed in')

      // At-risk = at or below par. Deterministic scan over the loaded catalogue.
      const atRisk: { id: string; name: string }[] = []
      for (const p of products) {
        for (const v of p.product_variants) {
          if (v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold) {
            atRisk.push({ id: v.id, name: v.name !== 'Standard' ? `${p.name} — ${v.name}` : p.name })
          }
        }
      }
      const scope = atRisk.slice(0, MAX_VARIANTS_PER_CYCLE)

      const reader = makeSupabaseGraphReader()
      const constraintRecords = (await safeFetchConstraints(hotelId)).map(rowToConstraintRecord)

      const items: CycleItem[] = []
      let proposed = 0, autoExecuted = 0, queued = 0

      for (const variant of scope) {
        try {
          const agent = buildRestockAdvisorAgent({
            reader,
            llm: new HeuristicLLMClient({ variantId: variant.id, variantName: variant.name }),
            forecastAdapter,
          })
          const run = await agent.run({
            prompt: `restock ${variant.name}`,
            userId,
            scope: { hotelId },
          })

          if (run.proposals.length === 0) {
            items.push({ variantId: variant.id, variantName: variant.name, outcome: 'no-proposal' })
            continue
          }

          for (const p of run.proposals) {
            const row = await createProposal({
              hotelId,
              agentName: agent.name,
              agentVersion: agent.version,
              proposal: p,
              createdByUserId: userId,
            })
            proposed++

            const violations = evaluateConstraints(p.action, constraintRecords, { now: new Date() })
            const decision = decideAutoExecution({
              action: p.action,
              confidence: p.confidence,
              violations,
              policy: DEFAULT_AUTO_EXEC_POLICY,
            })

            if (decision.autoExecute) {
              const result = await dispatchAction(
                { ...p.action, triggeredBy: 'ai_auto_approved' } as BeaconAction,
                { hotelId, actorId: userId, triggeredBy: 'ai_auto_approved' },
              )
              if (result.success) {
                await decideProposal({ proposalId: row.id, status: 'approved', decidedByUserId: userId })
                autoExecuted++
                items.push({ variantId: variant.id, variantName: variant.name, outcome: 'auto-executed', actionType: p.action.type, proposalId: row.id, reason: decision.reason })
                continue
              }
            }
            queued++
            items.push({ variantId: variant.id, variantName: variant.name, outcome: 'queued', actionType: p.action.type, proposalId: row.id, reason: decision.reason })
          }
        } catch {
          items.push({ variantId: variant.id, variantName: variant.name, outcome: 'error' })
        }
      }

      // Refresh the surfaces the cycle just changed.
      void queryClient.invalidateQueries({ queryKey: ['proposals'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })

      return {
        scanned: scope.length,
        proposed,
        autoExecuted,
        queued,
        ranAt: new Date().toISOString(),
        items,
      }
    },
  })
}

async function safeFetchConstraints(hotelId: string) {
  try {
    return await fetchActiveConstraints(hotelId)
  } catch {
    return []
  }
}
