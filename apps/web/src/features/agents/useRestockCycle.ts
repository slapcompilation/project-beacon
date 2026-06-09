// Browser adapter for the unattended intelligence cycle. The loop itself —
// scan → run agent → gate → dispatch-or-queue — lives in @beacon/reality-graph
// (runIntelligenceCycle), tested in isolation. Here we just inject the browser
// implementations of its dependencies: the Supabase reader, proposal
// persistence, and the dispatchAction write path. A cron edge function injects
// service-role versions of the same seams.
//
// Runs each agent with the heuristic LLM client — the variant is already known
// from the scan, so no extraction call (and no LLM spend) is needed; the
// reasoning block's tool calls are deterministic.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  buildRestockAdvisorAgent,
  runIntelligenceCycle,
  orgPolicyToAutoExecPolicy,
  type BeaconAction,
  type CycleVariant,
} from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import { fetchActiveConstraints, rowToConstraintRecord } from '@/features/constraints/api'
import { useProducts } from '@/features/inventory/hooks'
import { makeSupabaseGraphReader } from './graphReader'
import { HeuristicLLMClient } from './heuristicLLM'
import { createProposal, decideProposal } from './proposalsApi'
import { attachProposalToCase, caseTitleFor, createCase, fetchOpenCaseForVariant } from '@/features/cases/api'
import { useActiveForecastAdapter } from '@/features/modelingObjectives/activeAdapter'
import { useCurrentAgentReleases } from '@/features/agentStudio/hooks'
import { useOrgPolicy } from '@/features/mind/policy'

export type { CycleOutcome, CycleItem, CycleResult } from '@beacon/reality-graph'

export function useRestockCycle() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const { data: products = [] } = useProducts()
  const forecastAdapter = useActiveForecastAdapter()
  const { data: releases = [] } = useCurrentAgentReleases()
  const { data: policyData } = useOrgPolicy()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!hotelId) throw new Error('No active hotel selected')
      if (!userId)  throw new Error('Not signed in')

      // At-risk = at or below par. Deterministic scan over the loaded catalogue.
      const variants: CycleVariant[] = []
      for (const p of products) {
        for (const v of p.product_variants) {
          if (v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold) {
            variants.push({ id: v.id, name: v.name !== 'Standard' ? `${p.name} — ${v.name}` : p.name })
          }
        }
      }

      const reader = makeSupabaseGraphReader()
      const constraints = (await safeFetchConstraints(hotelId)).map(rowToConstraintRecord)

      const buildAgent = (variant: CycleVariant) =>
        buildRestockAdvisorAgent({
          reader,
          llm: new HeuristicLLMClient({ variantId: variant.id, variantName: variant.name }),
          forecastAdapter,
        })
      const meta = buildAgent(variants[0] ?? { id: '', name: '' })

      const productionReleases = releases
        .filter((r) => r.stage === 'production')
        .map((r) => ({ agentName: r.agent_name, version: r.version }))

      // Phase E2: operator-tunable policy. Falls back to DEFAULT_ORG_POLICY
      // until the operator saves overrides via Mind → Policy.
      const orgPolicy = policyData?.merged
      const autoExecPolicy = orgPolicy ? orgPolicyToAutoExecPolicy(orgPolicy) : undefined
      const maxVariants    = orgPolicy?.caps.max_variants_per_cycle
      const agentOverrides = orgPolicy?.auto_execution.agent_overrides

      // One case per variant-situation, reused within the run (an agent can
      // emit TRANSFER + RESTOCK for one variant a few ms apart, faster than a
      // DB read-after-write sees the first case).
      const caseByVariant = new Map<string, string>()

      const result = await runIntelligenceCycle({
        variants,
        constraints,
        agent:    { agentName: meta.name, agentVersion: meta.version },
        releases: { production: productionReleases },
        policy:   autoExecPolicy,
        agentOverrides,
        maxVariants,
        runAgent: async (variant) => {
          const run = await buildAgent(variant).run({ prompt: `restock ${variant.name}`, userId, scope: { hotelId } })
          return run.proposals
        },
        persistProposal: async (_variant, proposal) => {
          const row = await createProposal({
            hotelId,
            agentName: meta.name,
            agentVersion: meta.version,
            proposal,
            createdByUserId: userId,
          })
          return row.id
        },
        dispatch: async (action) => {
          const res = await dispatchAction(
            { ...action, triggeredBy: 'ai_auto_approved' } as BeaconAction,
            { hotelId, actorId: userId, triggeredBy: 'ai_auto_approved' },
          )
          return res.success
        },
        markApproved: async (proposalId) => {
          await decideProposal({ proposalId, status: 'approved', decidedByUserId: userId })
        },
        openCase: async (variant, proposalId, action) => {
          let caseId = caseByVariant.get(variant.id)
          if (!caseId) {
            const existing = await fetchOpenCaseForVariant(hotelId, variant.id)
            caseId = existing?.id
          }
          if (caseId) {
            caseByVariant.set(variant.id, caseId)
            await attachProposalToCase(caseId, proposalId)
            return
          }
          const created = await createCase({
            hotelId,
            title:       caseTitleFor(action.type, variant.name),
            inputRefs:   [{ kind: 'variant', ref: variant.id }, { kind: 'agent_run', ref: meta.name }],
            proposalIds: [proposalId],
            openedByUserId: userId,
          })
          caseByVariant.set(variant.id, created.id)
        },
      })

      // Refresh the surfaces the cycle just changed.
      void queryClient.invalidateQueries({ queryKey: ['proposals'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })

      return result
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
