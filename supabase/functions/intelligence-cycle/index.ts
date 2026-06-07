// Unattended intelligence cycle — the cron-driven twin of the operator's
// "Run cycle" button. For each hotel it scans at-risk stock, runs the typed
// restock_advisor agent per variant, and routes each proposal through the
// SAME gate the web path uses (decideAutoExecution, in the reality-graph
// bundle): confident + uncontested REQUEST_RESTOCKs auto-execute as
// ai_auto_approved; everything else is queued for the operator.
//
// Auth: x-beacon-secret (verifySharedSecret) — only pg_cron (via pg_net) calls
// this; there is no end-user JWT, so it runs under the service role.
//
// The agent runs with a deterministic LLM stub: the variant is already known
// from the scan, so no extraction LLM call is needed and the reasoning block
// is purely tool-driven — zero LLM spend per variant.

// runIntelligenceCycle applies the decideAutoExecution gate + evaluateConstraints
// internally (both live in the bundle); the handler only needs these two.
import {
  runIntelligenceCycle,
  buildRestockAdvisorAgent,
  buildOverstockRebalancerAgent,
  mergeOrgPolicy,
  orgPolicyToAutoExecPolicy,
} from '../_shared/reality-graph.bundle.mjs'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json, preflight } from '../_shared/http.ts'
import { verifySharedSecret, isAuthError } from '../_shared/auth.ts'
import { makeServiceRoleGraphReader } from './reader.ts'
// Recorded on the agent's trace; persistence attributes rows to no user
// (created_by_user_id / requestor_id are NULL for system-authored rows).
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000'

// Deterministic LLM: scripts the two extract blocks against the known variant;
// the reason+propose block never calls the LLM. Mirrors apps/web HeuristicLLMClient.
function makeDeterministicLLM(variant: { id: string; name: string }) {
  const responses = [
    { output: { variantId: variant.id, variantName: variant.name, confidence: 0.95 }, toolCalls: [], tokensUsed: 0 },
    { output: { supplierName: null, confidence: 0.8 }, toolCalls: [], tokensUsed: 0 },
  ]
  let cursor = 0
  return {
    call() {
      if (cursor >= responses.length) throw new Error('Deterministic LLM exhausted')
      return Promise.resolve(responses[cursor++])
    },
  }
}

interface HotelRow { id: string; organization_id: string | null }

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const auth = verifySharedSecret(req)
  if (isAuthError(auth)) return auth
  const { supabase } = auth

  // Built once only to read name/version (both constant); the dummy llm is
  // never invoked here.
  const dummyReader = makeServiceRoleGraphReader(supabase, '')
  const restockMeta = buildRestockAdvisorAgent({ reader: dummyReader, llm: makeDeterministicLLM({ id: '', name: '' }) })
  const overstockMeta = buildOverstockRebalancerAgent({ reader: dummyReader, llm: makeDeterministicLLM({ id: '', name: '' }) })

  const { data: hotels, error: hotelsErr } = await supabase
    .from('hotels')
    .select('id, organization_id')
  if (hotelsErr) return json({ error: `hotels query failed: ${hotelsErr.message}` }, 500)

  // Release gate (Phase C step 2b): the runtime gate in decideAutoExecution
  // refuses to auto-execute unless the agent has a production release. Query
  // the global-default (NULL-org) production rows once per cron run; service
  // role bypasses RLS, so we filter explicitly.
  const { data: releaseRows } = await supabase
    .from('agent_releases')
    .select('agent_name, version')
    .is('organization_id', null)
    .eq('stage', 'production')
  const productionReleases = (releaseRows ?? []).map((r: Record<string, unknown>) => ({
    agentName: r.agent_name as string,
    version:   r.version as string,
  }))

  // Phase E2: operator-tunable policy. Cron is currently global (no per-org
  // schedule), so we read the NULL-org default row. When per-org cron lands
  // this becomes a per-hotel lookup.
  const { data: policyRow } = await supabase
    .from('org_policy')
    .select('policy')
    .is('organization_id', null)
    .maybeSingle()
  const policy = mergeOrgPolicy(policyRow?.policy)
  const autoExecPolicy = orgPolicyToAutoExecPolicy(policy)
  const maxVariants    = policy.caps.max_variants_per_cycle
  const agentOverrides = policy.auto_execution.agent_overrides
  const overstockFactor = policy.overstock.factor

  const shared = { productionReleases, autoExecPolicy, maxVariants, agentOverrides }
  const perHotel: Array<Record<string, unknown>> = []
  let totalAuto = 0
  let totalQueued = 0

  for (const hotel of (hotels ?? []) as HotelRow[]) {
    try {
      // restock_advisor on at-risk stock, then overstock_rebalancer on surplus.
      // Both route through the same decideAutoExecution gate; TRANSFER_STOCK
      // isn't auto-exec-eligible so overstock proposals always queue for review.
      const restock = await runAgentCycle(supabase, hotel, {
        agentName: restockMeta.name, agentVersion: restockMeta.version,
        scan: 'at-risk', buildAgent: (reader, v) => buildRestockAdvisorAgent({ reader, llm: makeDeterministicLLM(v) }),
        promptVerb: 'restock', ...shared,
      })
      const overstock = await runAgentCycle(supabase, hotel, {
        agentName: overstockMeta.name, agentVersion: overstockMeta.version,
        scan: 'overstock', overstockFactor,
        buildAgent: (reader, v) => buildOverstockRebalancerAgent({ reader, llm: makeDeterministicLLM(v) }),
        promptVerb: 'rebalance', ...shared,
      })
      totalAuto   += restock.autoExecuted + overstock.autoExecuted
      totalQueued += restock.queued + overstock.queued
      perHotel.push({
        hotelId: hotel.id,
        restock:   { scanned: restock.scanned, autoExecuted: restock.autoExecuted, queued: restock.queued },
        overstock: { scanned: overstock.scanned, autoExecuted: overstock.autoExecuted, queued: overstock.queued },
      })
    } catch (err) {
      perHotel.push({ hotelId: hotel.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // Observability: the agent cron's work is recorded next to the SQL cycle's
  // (system_health_events), so a "ran but did nothing" cycle is visible.
  await supabase.from('system_health_events').insert({
    event_type: 'intelligence_cycle_agent_run',
    severity: 'info',
    source: 'intelligence-cycle',
    summary: `Agent cycle: ${String(totalAuto)} auto-executed, ${String(totalQueued)} queued across ${String(perHotel.length)} hotel(s)`,
    details: { auto_executed: totalAuto, queued: totalQueued, hotels: perHotel },
    confidence_basis: 'restock_advisor (at-risk) + overstock_rebalancer (surplus) per variant; decideAutoExecution gate. REQUEST_RESTOCK auto-execs >= floor; TRANSFER_STOCK always queues.',
  })

  return json({ ok: true, autoExecuted: totalAuto, queued: totalQueued, hotels: perHotel })
})

interface AgentCycleOpts {
  agentName: string
  agentVersion: string
  scan: 'at-risk' | 'overstock'
  overstockFactor?: number
  buildAgent: (reader: ReturnType<typeof makeServiceRoleGraphReader>, variant: { id: string; name: string }) => { run: (args: unknown) => Promise<{ proposals: ReadonlyArray<unknown> }> }
  promptVerb: string
  productionReleases: ReadonlyArray<{ agentName: string; version: string }>
  autoExecPolicy: { thresholds: Record<string, number> }
  maxVariants: number
  agentOverrides: Record<string, number>
}

// Runs one agent over its scan of a hotel through the shared cycle gate.
// scan='at-risk' → variants at/below par (restock); scan='overstock' →
// variants above par × factor (rebalance).
async function runAgentCycle(supabase: SupabaseClient, hotel: HotelRow, opts: AgentCycleOpts) {
  const { data: variantRows, error: scanErr } = await supabase
    .from('product_variants')
    .select('id, name, current_stock, low_stock_threshold, products!inner(hotel_id, name)')
    .eq('products.hotel_id', hotel.id)
    .eq('enabled', true)
    .gt('low_stock_threshold', 0)
  if (scanErr) throw new Error(scanErr.message)

  const factor = opts.overstockFactor ?? 2
  const variants = (variantRows ?? [])
    .filter((v: Record<string, unknown>) => {
      const stock = v.current_stock as number
      const par   = v.low_stock_threshold as number
      return opts.scan === 'at-risk' ? stock <= par : stock > par * factor
    })
    .map((v: Record<string, unknown>) => {
      const p = v.products as { name: string } | { name: string }[] | null
      const product = Array.isArray(p) ? p[0] : p
      const productName = product?.name ?? 'item'
      return { id: v.id as string, name: v.name !== 'Standard' ? `${productName} — ${String(v.name)}` : productName }
    })

  const { data: constraintRows } = await supabase
    .from('constraints')
    .select('id, body, bucket, typed_rule, severity, applies_to_action_types, active')
    .eq('hotel_id', hotel.id)
    .eq('active', true)
  const constraints = (constraintRows ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    body: c.body as string,
    bucket: c.bucket as string,
    typedRule: c.typed_rule,
    severity: c.severity as string,
    appliesToActionTypes: (c.applies_to_action_types as string[] | null) ?? [],
    active: c.active as boolean,
  }))

  const reader = makeServiceRoleGraphReader(supabase, hotel.id)

  return await runIntelligenceCycle({
    variants,
    constraints,
    maxVariants: opts.maxVariants,
    policy:   opts.autoExecPolicy,
    agentOverrides: opts.agentOverrides,
    agent:    { agentName: opts.agentName, agentVersion: opts.agentVersion },
    releases: { production: opts.productionReleases },
    runAgent: async (variant: { id: string; name: string }) => {
      const agent = opts.buildAgent(reader, variant)
      const run = await agent.run({ prompt: `${opts.promptVerb} ${variant.name}`, userId: SYSTEM_ACTOR, scope: { hotelId: hotel.id } })
      return run.proposals
    },
    persistProposal: async (_variant: unknown, proposal: { action: { type: string }; confidence: number; reasoning: string; provenance: unknown }) => {
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          hotel_id: hotel.id,
          organization_id: hotel.organization_id,
          agent_name: opts.agentName,
          agent_version: opts.agentVersion,
          action_type: proposal.action.type,
          action_payload: proposal.action,
          confidence: proposal.confidence,
          reasoning: proposal.reasoning,
          provenance: proposal.provenance,
          status: 'pending',
          created_by_user_id: null,
        })
        .select('id')
        .single()
      if (error) throw new Error(`proposal insert failed: ${error.message}`)
      return data.id as string
    },
    dispatch: async (action: { type: string; variantId?: string; quantityNeeded?: number }) => {
      // Only REQUEST_RESTOCK is auto-exec-eligible. TRANSFER_STOCK (overstock)
      // never reaches dispatch — decideAutoExecution queues it — but guard anyway.
      if (action.type !== 'REQUEST_RESTOCK') return false
      const { error } = await supabase.from('restock_requests').insert({
        hotel_id: hotel.id,
        variant_id: action.variantId,
        quantity_needed: action.quantityNeeded,
        requestor_id: null,
        is_auto_proposed: true,
        notes: 'Auto-executed by restock_advisor (ai_auto_approved)',
      })
      return !error
    },
    markApproved: async (proposalId: string) => {
      await supabase
        .from('proposals')
        .update({ status: 'approved', decided_at: new Date().toISOString() })
        .eq('id', proposalId)
    },
  })
}
