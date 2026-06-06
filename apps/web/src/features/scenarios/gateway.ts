// Web implementation of the reality-graph ScenarioGateway. Wires Supabase +
// the browser agent stack (graph reader + heuristic LLM) into the abstract
// simulation contract. buildSimulationDeps materializes real at-risk state,
// applies the scenario's overlay, and hands the shape to
// simulateCycleWithOverlay — which runs the cycle with no-op persistence.

import {
  mergePolicyOverlay,
  mergeConstraintOverlay,
  applyVariantOverlay,
  orgPolicyToAutoExecPolicy,
  DEFAULT_ORG_POLICY,
  buildRestockAdvisorAgent,
  type ScenarioGateway,
  type ScenarioRow as RGScenarioRow,
  type SimulationDeps,
  type CycleVariant,
  type OrgPolicy,
  type ConstraintRecord,
} from '@beacon/reality-graph'
import {
  applyOverlayEdit as apiApplyOverlayEdit,
  fetchScenario,
  recordSimulationResult,
} from './api'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'
import { HeuristicLLMClient } from '@/features/agents/heuristicLLM'
import { fetchActiveConstraints, rowToConstraintRecord } from '@/features/constraints/api'
import type { useActiveForecastAdapter } from '@/features/modelingObjectives/activeAdapter'
import type { CurrentAgentRelease } from '@/features/agentStudio/hooks'
import type { ProductWithVariants } from '@beacon/types'

export interface WebGatewayDeps {
  hotelId:         string
  userId:          string
  products:        ProductWithVariants[]
  orgPolicy:       OrgPolicy | undefined
  releases:        CurrentAgentRelease[]
  forecastAdapter: ReturnType<typeof useActiveForecastAdapter>
}

/** Builds a ScenarioGateway bound to the current operator's session + the
 *  React-loaded catalogue/policy/releases. Recreate it when those change. */
export function makeWebScenarioGateway(deps: WebGatewayDeps): ScenarioGateway {
  return {
    fetchScenario: (id) => fetchScenario(id) as Promise<RGScenarioRow | null>,

    applyOverlayEdit: (args) =>
      apiApplyOverlayEdit(args) as Promise<RGScenarioRow>,

    recordSimulation: (scenarioId, cache) => recordSimulationResult(scenarioId, cache),

    buildSimulationDeps: async (scenario): Promise<SimulationDeps> => {
      const overlay = scenario.graph_overlay
      const policy  = mergePolicyOverlay(deps.orgPolicy ?? DEFAULT_ORG_POLICY, overlay.policy)

      // At-risk scan with the variant overlay applied first — a hypothetical
      // current_stock/par_level can move a variant in or out of "at risk".
      const variants: CycleVariant[] = []
      for (const p of deps.products) {
        for (const v of p.product_variants) {
          const adjusted = applyVariantOverlay(
            { id: v.id, current_stock: v.current_stock, par_level: v.low_stock_threshold },
            overlay.variants,
          )
          const par = adjusted.par_level
          if (par > 0 && adjusted.current_stock <= par) {
            variants.push({ id: v.id, name: v.name !== 'Standard' ? `${p.name} — ${v.name}` : p.name })
          }
        }
      }

      // Constraints: real active set merged with the overlay's disable/add list.
      let baseConstraints: ConstraintRecord[] = []
      try {
        baseConstraints = (await fetchActiveConstraints(deps.hotelId)).map(rowToConstraintRecord)
      } catch {
        baseConstraints = []
      }
      const constraints = mergeConstraintOverlay(baseConstraints, overlay.constraints)

      const reader = makeSupabaseGraphReader()
      const buildAgent = (variant: CycleVariant) =>
        buildRestockAdvisorAgent({
          reader,
          llm: new HeuristicLLMClient({ variantId: variant.id, variantName: variant.name }),
          forecastAdapter: deps.forecastAdapter,
        })
      const meta = buildAgent(variants[0] ?? { id: '', name: '' })

      const productionReleases = deps.releases
        .filter((r) => r.stage === 'production')
        .map((r) => ({ agentName: r.agent_name, version: r.version }))

      return {
        variants,
        constraints,
        policy:         orgPolicyToAutoExecPolicy(policy),
        agentOverrides: policy.auto_execution.agent_overrides,
        agent:          { agentName: meta.name, agentVersion: meta.version },
        releases:       { production: productionReleases },
        maxVariants:    policy.caps.max_variants_per_cycle,
        runAgent: async (variant) => {
          const run = await buildAgent(variant).run({
            prompt: `restock ${variant.name}`,
            userId: deps.userId,
            scope:  { hotelId: deps.hotelId },
          })
          return run.proposals
        },
      }
    },
  }
}
