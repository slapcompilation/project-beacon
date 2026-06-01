// Org-scope overstock sweep — operator-triggered from Portfolio Command.
//
// Composes the existing overstock_rebalancer agent across every hotel in the
// org. For each hotel, scans variants with current_stock > low_stock_threshold × 2
// (the simple overstock heuristic), then runs the agent per variant with the
// HeuristicLLMClient (zero LLM spend — variant is known + reasoning is tool-driven)
// and persists each proposal as `agent_name = 'org_overstock_balancer'` so the
// review queue + AgentHealth surface it separately from per-hotel runs.
//
// V1: operator-triggered only; no auto-execute (proposals always land queued).
// The decideAutoExecution release gate refuses anyway since org_overstock_balancer
// has no production release in the ledger — by design.

import { useMutation } from '@tanstack/react-query'
import { buildOverstockRebalancerAgent } from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth.store'
import { makeSupabaseGraphReader } from './graphReader'
import { HeuristicLLMClient } from './heuristicLLM'
import { createProposal } from './proposalsApi'
import { useActiveForecastAdapter } from '@/features/modelingObjectives/activeAdapter'
import { usePortfolioSignals } from '@/features/mind/portfolio'
import { useOrgPolicy } from '@/features/mind/policy'

export interface OrgSweepItem {
  hotelId:       string
  hotelName:     string
  variantId:     string
  variantName:   string
  outcome:       'proposed' | 'no-proposal' | 'error'
  actionType?:   string
  confidence?:   number
  proposalId?:   string
  reason?:       string
}

export interface OrgSweepResult {
  hotelsScanned:   number
  variantsScanned: number
  proposalsCreated: number
  ranAt:           string
  items:           OrgSweepItem[]
}

interface OverstockedVariant {
  variantId:   string
  variantName: string
  hotelId:     string
  hotelName:   string
  productName: string
}

async function scanOverstocked(hotelId: string, hotelName: string, factor: number): Promise<OverstockedVariant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, name, current_stock, low_stock_threshold, products!inner(hotel_id, name)')
    .eq('products.hotel_id', hotelId)
    .eq('enabled', true)
    .gt('low_stock_threshold', 0)
  if (error) throw new Error(error.message)

  return data
    .filter((v) => (v.current_stock as number) > (v.low_stock_threshold as number) * factor)
    .map((v) => {
      const p = v.products as { name: string } | { name: string }[] | null
      const product = Array.isArray(p) ? p[0] : p
      const productName = product?.name ?? 'item'
      return {
        variantId:   v.id as string,
        variantName: v.name !== 'Standard' ? `${productName} — ${String(v.name)}` : productName,
        hotelId,
        hotelName,
        productName,
      }
    })
}

export function useOrgOverstockSweep() {
  const userId = useAuthStore((s) => s.userId)
  const forecastAdapter = useActiveForecastAdapter()
  const { data: portfolioHotels = [] } = usePortfolioSignals()
  const { data: policyData } = useOrgPolicy()

  return useMutation<OrgSweepResult>({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in')
      if (portfolioHotels.length === 0) throw new Error('No hotels in scope (admin/owner required)')

      // Phase E2: operator-tunable factor + cap. Fallback to bundled defaults.
      const policy = policyData?.merged
      const factor = policy?.overstock.factor              ?? 2
      const cap    = policy?.caps.max_proposals_per_sweep  ?? 25

      const reader = makeSupabaseGraphReader()
      const items: OrgSweepItem[] = []
      let variantsScanned = 0
      let proposalsCreated = 0

      for (const h of portfolioHotels) {
        const overstocked = await scanOverstocked(h.hotel_id, h.hotel_name, factor)
        variantsScanned += overstocked.length

        for (const v of overstocked) {
          if (proposalsCreated >= cap) break
          try {
            const agent = buildOverstockRebalancerAgent({
              reader,
              llm: new HeuristicLLMClient({ variantId: v.variantId, variantName: v.variantName }),
              forecastAdapter,
            })
            const run = await agent.run({
              prompt: `rebalance ${v.variantName}`,
              userId,
              scope:  { hotelId: v.hotelId },
            })

            if (run.proposals.length === 0) {
              items.push({ ...rowOf(v), outcome: 'no-proposal' })
              continue
            }

            for (const p of run.proposals) {
              const row = await createProposal({
                hotelId:        v.hotelId,
                agentName:      'org_overstock_balancer',
                agentVersion:   '1.0.0',
                proposal:       p,
                createdByUserId: userId,
              })
              proposalsCreated++
              items.push({
                ...rowOf(v),
                outcome:    'proposed',
                actionType: p.action.type,
                confidence: p.confidence,
                proposalId: row.id,
              })
            }
          } catch (err) {
            items.push({ ...rowOf(v), outcome: 'error', reason: err instanceof Error ? err.message : String(err) })
          }
        }
        if (proposalsCreated >= cap) break
      }

      return {
        hotelsScanned: portfolioHotels.length,
        variantsScanned,
        proposalsCreated,
        ranAt:  new Date().toISOString(),
        items,
      }
    },
  })
}

function rowOf(v: OverstockedVariant) {
  return {
    hotelId:     v.hotelId,
    hotelName:   v.hotelName,
    variantId:   v.variantId,
    variantName: v.variantName,
  }
}
