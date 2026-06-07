// Phase H5 — server-side scenario simulation.
//
// Mirrors the web ScenarioGateway.buildSimulationDeps (apps/web/.../scenarios/
// gateway.ts) on the edge so the copilot can run a scenario simulation itself,
// rather than the operator clicking Simulate. Builds the overlay-adjusted
// at-risk scan + merged policy/constraints, runs the same
// simulateCycleWithOverlay loop with no-op persistence, and caches the result
// via record_simulation_result.
//
// Uses the caller's (user-scoped) Supabase client — RLS already constrains the
// operator to their hotel, so no service-role hop is needed. The graph reader
// is the same one the unattended cycle uses.

import {
  simulateCycleWithOverlay,
  mergeOrgPolicy,
  mergePolicyOverlay,
  mergeConstraintOverlay,
  applyVariantOverlay,
  orgPolicyToAutoExecPolicy,
  buildRestockAdvisorAgent,
} from './reality-graph.bundle.mjs'
import { makeServiceRoleGraphReader } from '../intelligence-cycle/reader.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000'

// Deterministic LLM stub: the variant is known from the scan, so the extract
// blocks are scripted and the reason+propose block never calls the LLM. Mirrors
// the web HeuristicLLMClient + intelligence-cycle's makeDeterministicLLM — zero
// LLM spend per simulated variant.
function makeDeterministicLLM(variant: { id: string; name: string }) {
  const responses = [
    { output: { variantId: variant.id, variantName: variant.name, confidence: 0.95 }, toolCalls: [], tokensUsed: 0 },
    { output: { supplierName: null, confidence: 0.8 }, toolCalls: [], tokensUsed: 0 },
  ]
  let cursor = 0
  return { call() {
    if (cursor >= responses.length) throw new Error('Deterministic LLM exhausted')
    return Promise.resolve(responses[cursor++])
  } }
}

export interface ScenarioSimSummary {
  scenarioId:   string
  scanned:      number
  proposed:     number
  autoExecuted: number
  queued:       number
  ranAt:        string
}

/** Runs the intelligence cycle against a scenario's graph_overlay with no-op
 *  persistence, caches the result on the scenario row, and returns a summary.
 *  Throws if the scenario isn't found / not visible to the caller. */
export async function runScenarioSimulation(
  supabase: SupabaseClient,
  scenarioId: string,
): Promise<ScenarioSimSummary> {
  const { data: scenario, error: sErr } = await supabase
    .from('scenarios')
    .select('id, hotel_id, graph_overlay')
    .eq('id', scenarioId)
    .maybeSingle() as unknown as {
      data: { id: string; hotel_id: string | null; graph_overlay: Record<string, unknown> } | null
      error: { message: string } | null
    }
  if (sErr) throw new Error(sErr.message)
  if (!scenario) throw new Error(`scenario ${scenarioId} not found`)
  if (!scenario.hotel_id) throw new Error('scenario is org-scoped; per-hotel simulation requires a hotel_id')

  const hotelId = scenario.hotel_id
  const overlay = (scenario.graph_overlay ?? {}) as {
    variants?: Record<string, { current_stock?: number; par_level?: number }>
    policy?: unknown
    constraints?: { disabled?: string[]; added?: unknown[] }
  }

  // Policy: org default merged with the overlay.
  const { data: policyRow } = await supabase
    .from('org_policy').select('policy').is('organization_id', null).maybeSingle() as unknown as {
      data: { policy: unknown } | null
    }
  const basePolicy = mergeOrgPolicy(policyRow?.policy)
  const policy     = mergePolicyOverlay(basePolicy, overlay.policy)

  // Overlay-adjusted at-risk scan.
  const { data: vRows, error: vErr } = await supabase
    .from('product_variants')
    .select('id, name, current_stock, low_stock_threshold, products!inner(hotel_id, name)')
    .eq('products.hotel_id', hotelId)
    .eq('enabled', true)
    .gt('low_stock_threshold', 0)
  if (vErr) throw new Error(vErr.message)

  const variants: Array<{ id: string; name: string }> = []
  for (const v of (vRows ?? []) as Array<Record<string, unknown>>) {
    const adj = applyVariantOverlay(
      { id: v.id as string, current_stock: v.current_stock as number, par_level: v.low_stock_threshold as number },
      overlay.variants,
    )
    if (adj.par_level > 0 && adj.current_stock <= adj.par_level) {
      const p = v.products as { name: string } | { name: string }[] | null
      const product = Array.isArray(p) ? p[0] : p
      const productName = product?.name ?? 'item'
      variants.push({ id: v.id as string, name: v.name !== 'Standard' ? `${productName} — ${String(v.name)}` : productName })
    }
  }

  // Constraints (real active set merged with overlay disable/add).
  const { data: cRows } = await supabase
    .from('constraints')
    .select('id, body, bucket, typed_rule, severity, applies_to_action_types, active')
    .eq('hotel_id', hotelId).eq('active', true)
  const baseConstraints = ((cRows ?? []) as Array<Record<string, unknown>>).map((c) => ({
    id: c.id as string, body: c.body as string, bucket: c.bucket as string,
    typedRule: c.typed_rule, severity: c.severity as string,
    appliesToActionTypes: (c.applies_to_action_types as string[] | null) ?? [], active: c.active as boolean,
  }))
  const constraints = mergeConstraintOverlay(baseConstraints, overlay.constraints)

  // Production releases (NULL-org default).
  const { data: relRows } = await supabase
    .from('agent_releases').select('agent_name, version').is('organization_id', null).eq('stage', 'production')
  const productionReleases = ((relRows ?? []) as Array<Record<string, unknown>>).map((r) => ({
    agentName: r.agent_name as string, version: r.version as string,
  }))

  const reader    = makeServiceRoleGraphReader(supabase, hotelId)
  const agentMeta = buildRestockAdvisorAgent({ reader, llm: makeDeterministicLLM({ id: '', name: '' }) })

  const result = await simulateCycleWithOverlay({
    variants,
    constraints,
    policy:         orgPolicyToAutoExecPolicy(policy),
    agentOverrides: policy.auto_execution.agent_overrides,
    agent:          { agentName: agentMeta.name, agentVersion: agentMeta.version },
    releases:       { production: productionReleases },
    maxVariants:    policy.caps.max_variants_per_cycle,
    runAgent: async (variant: { id: string; name: string }) => {
      const agent = buildRestockAdvisorAgent({ reader, llm: makeDeterministicLLM(variant) })
      const run = await agent.run({ prompt: `restock ${variant.name}`, userId: SYSTEM_ACTOR, scope: { hotelId } })
      return run.proposals
    },
  })

  await supabase.rpc('record_simulation_result', {
    p_scenario_id: scenarioId,
    p_result: {
      ran_at: result.ranAt,
      result: {
        scanned: result.scanned, proposed: result.proposed,
        autoExecuted: result.autoExecuted, queued: result.queued,
        ranAt: result.ranAt,
        items: result.items.map((i: Record<string, unknown>) => ({
          variantId: i.variantId, variantName: i.variantName,
          outcome: i.outcome, actionType: i.actionType, reason: i.reason,
        })),
      },
      delta: null,
    },
  })

  return {
    scenarioId, scanned: result.scanned, proposed: result.proposed,
    autoExecuted: result.autoExecuted, queued: result.queued, ranAt: result.ranAt,
  }
}
