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
  buildWasteTriageAgent,
  mergeOrgPolicy,
  orgPolicyToAutoExecPolicy,
  computeCalibration,
  HONEST_LABEL_OPTIONS,
  selectExpiryTriggers,
  expiryHitToWriteOff,
} from '../_shared/reality-graph.bundle.mjs'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json, preflight } from '../_shared/http.ts'
import { verifySharedSecret, isAuthError } from '../_shared/auth.ts'
import { makeServiceRoleGraphReader } from './reader.ts'
// Recorded on the agent's trace; persistence attributes rows to no user
// (created_by_user_id / requestor_id are NULL for system-authored rows).
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000'

// Mirror of caseTitleFor in apps/web/src/features/cases/api.ts (the web bundle
// can't be imported here). Keep the two in sync.
function caseTitle(actionType: string, variantName: string): string {
  switch (actionType) {
    case 'REQUEST_RESTOCK': return `${variantName} — restock review`
    case 'TRANSFER_STOCK':  return `${variantName} — rebalance review`
    case 'WRITE_OFF':       return `${variantName} — waste review`
    default:                return `${variantName} — review`
  }
}

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
  const wasteMeta = buildWasteTriageAgent({ reader: dummyReader, llm: makeDeterministicLLM({ id: '', name: '' }) })

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
  const requireCalibration    = policy.auto_execution.require_calibration
  const minCalibrationSamples = policy.auto_execution.min_calibration_samples

  // Calibration trust budget applies to the only auto-exec-eligible agent here
  // (restock_advisor → REQUEST_RESTOCK). Overstock/waste always queue, so their
  // gate short-circuits on eligibility before calibration is ever consulted.
  const shared = { productionReleases, autoExecPolicy, maxVariants, agentOverrides, requireCalibration, minCalibrationSamples }
  const perHotel: Array<Record<string, unknown>> = []
  let totalAuto = 0
  let totalQueued = 0

  for (const hotel of (hotels ?? []) as HotelRow[]) {
    try {
      // Dedup: skip re-proposing what an open proposal already covers — without
      // it every daily run re-creates the same proposals and the queue fills up.
      const openProposalKeys = await openProposalKeysFor(supabase, hotel.id)
      const hotelShared = { ...shared, openProposalKeys }

      // restock_advisor on at-risk stock, then overstock_rebalancer on surplus.
      // Both route through the same decideAutoExecution gate; TRANSFER_STOCK
      // isn't auto-exec-eligible so overstock proposals always queue for review.
      const restockCalibration = await agentCalibration(supabase, hotel.id, restockMeta.name, minCalibrationSamples)
      const restock = await runAgentCycle(supabase, hotel, {
        agentName: restockMeta.name, agentVersion: restockMeta.version,
        scan: 'at-risk', buildAgent: (reader, v) => buildRestockAdvisorAgent({ reader, llm: makeDeterministicLLM(v) }),
        promptVerb: 'restock', ...hotelShared, calibration: restockCalibration,
      })
      const overstock = await runAgentCycle(supabase, hotel, {
        agentName: overstockMeta.name, agentVersion: overstockMeta.version,
        scan: 'overstock', overstockFactor,
        buildAgent: (reader, v) => buildOverstockRebalancerAgent({ reader, llm: makeDeterministicLLM(v) }),
        promptVerb: 'rebalance', ...hotelShared,
      })
      // waste_triage on perishables (shelf_life_days set) — proposes redirecting
      // soon-to-spoil surplus to a needy sister, else WRITE_OFF. Both queue.
      const waste = await runAgentCycle(supabase, hotel, {
        agentName: wasteMeta.name, agentVersion: wasteMeta.version,
        scan: 'waste',
        buildAgent: (reader, v) => buildWasteTriageAgent({ reader, llm: makeDeterministicLLM(v) }),
        promptVerb: 'triage waste for', ...hotelShared,
      })
      // Expiry monitor: a batch-expiry-date detector (distinct from waste_triage's
      // shelf_life heuristic). Only runs when the operator has enabled auto-propose
      // on the expiry monitor — default off, so this is a no-op until opted in.
      const expiry = await runExpiryMonitorCycle(supabase, hotel, { rule: policy.monitors.expiry, ...hotelShared })
      totalAuto   += restock.autoExecuted + overstock.autoExecuted + waste.autoExecuted + expiry.autoExecuted
      totalQueued += restock.queued + overstock.queued + waste.queued + expiry.queued
      perHotel.push({
        hotelId: hotel.id,
        restock:   { scanned: restock.scanned, autoExecuted: restock.autoExecuted, queued: restock.queued },
        overstock: { scanned: overstock.scanned, autoExecuted: overstock.autoExecuted, queued: overstock.queued },
        waste:     { scanned: waste.scanned, autoExecuted: waste.autoExecuted, queued: waste.queued },
        expiry:    { scanned: expiry.scanned, autoExecuted: expiry.autoExecuted, queued: expiry.queued },
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
    confidence_basis: 'restock_advisor (at-risk) + overstock_rebalancer (surplus) + waste_triage (perishables) per variant; decideAutoExecution gate. REQUEST_RESTOCK auto-execs >= floor; TRANSFER_STOCK + WRITE_OFF always queue.',
  })

  return json({ ok: true, autoExecuted: totalAuto, queued: totalQueued, hotels: perHotel })
})

interface AgentCycleOpts {
  agentName: string
  agentVersion: string
  scan: 'at-risk' | 'overstock' | 'waste'
  overstockFactor?: number
  buildAgent: (reader: ReturnType<typeof makeServiceRoleGraphReader>, variant: { id: string; name: string }) => { run: (args: unknown) => Promise<{ proposals: ReadonlyArray<unknown> }> }
  promptVerb: string
  productionReleases: ReadonlyArray<{ agentName: string; version: string }>
  autoExecPolicy: { thresholds: Record<string, number> }
  maxVariants: number
  agentOverrides: Record<string, number>
  requireCalibration?: boolean
  minCalibrationSamples?: number
  calibration?: unknown
  openProposalKeys?: ReadonlySet<string>
}

// Keys (`${actionType}:${variantId}`) of this hotel's still-open proposals, so a
// cron run doesn't re-create what's already awaiting review.
async function openProposalKeysFor(supabase: SupabaseClient, hotelId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('proposals')
    .select('action_type, action_payload')
    .eq('hotel_id', hotelId)
    .eq('status', 'pending')
    .limit(5000)
  if (error || !data) return new Set()
  const keys = new Set<string>()
  for (const r of data as { action_type: string; action_payload: { variantId?: string } | null }[]) {
    const vid = r.action_payload?.variantId
    if (vid) keys.add(`${r.action_type}:${vid}`)
  }
  return keys
}

// This agent's reliability report from its own resolved proposals in this hotel.
// Best-effort: a query failure leaves calibration undefined → static-floor gate.
async function agentCalibration(supabase: SupabaseClient, hotelId: string, agentName: string, minSamples: number) {
  const { data, error } = await supabase
    .from('proposals')
    .select('confidence, status, decided_at, edited_before_approval')
    .eq('hotel_id', hotelId)
    .eq('agent_name', agentName)
    .neq('status', 'pending')
    .limit(5000)
  if (error || !data) return undefined
  const samples = (data as { confidence: number; status: string; decided_at: string | null; edited_before_approval: boolean | null }[])
    .map((r) => ({ confidence: Number(r.confidence), status: r.status, decidedAt: r.decided_at, edited: r.edited_before_approval === true }))
  // Honest labels (A4): the unattended gate must read the same reality the
  // Studio page shows — edited approvals score partial credit, old evidence decays.
  return computeCalibration(samples, { minSamples, ...HONEST_LABEL_OPTIONS })
}

// Runs one agent over its scan of a hotel through the shared cycle gate.
// scan='at-risk' → at/below par (restock); 'overstock' → above par × factor
// (rebalance); 'waste' → perishable products (shelf_life_days set), the agent
// decides what's at-risk of spoiling internally.
async function runAgentCycle(supabase: SupabaseClient, hotel: HotelRow, opts: AgentCycleOpts) {
  let variants: { id: string; name: string }[]

  if (opts.scan === 'overstock') {
    // Forecast-aware scan: variants holding >= factor x their trailing-30-day
    // burn (get_overstock_candidates), aligned with the agent's own overstock
    // test. The old `stock > par x factor` proxy both over-selected (invisible
    // no-ops) and under-selected (missed genuine overstock when par != burn).
    const { data, error } = await supabase.rpc('get_overstock_candidates', {
      p_hotel_id: hotel.id,
      p_factor:   opts.overstockFactor ?? 2,
    })
    if (error) throw new Error(error.message)
    variants = (data ?? []).map((r: Record<string, unknown>) => ({
      id:   r.variant_id as string,
      name: r.display_name as string,
    }))
  } else {
    const { data: variantRows, error: scanErr } = await supabase
      .from('product_variants')
      .select('id, name, current_stock, low_stock_threshold, products!inner(hotel_id, name, shelf_life_days)')
      .eq('products.hotel_id', hotel.id)
      .eq('enabled', true)
      .gt('low_stock_threshold', 0)
    if (scanErr) throw new Error(scanErr.message)

    variants = (variantRows ?? [])
      .filter((v: Record<string, unknown>) => {
        const stock = v.current_stock as number
        const par   = v.low_stock_threshold as number
        const prod  = (Array.isArray(v.products) ? v.products[0] : v.products) as { shelf_life_days: number | null } | null
        if (opts.scan === 'at-risk') return stock <= par
        return prod?.shelf_life_days != null   // waste: perishables only
      })
      .map((v: Record<string, unknown>) => {
        const p = v.products as { name: string } | { name: string }[] | null
        const product = Array.isArray(p) ? p[0] : p
        const productName = product?.name ?? 'item'
        return { id: v.id as string, name: v.name !== 'Standard' ? `${productName} — ${String(v.name)}` : productName }
      })
  }

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

  // Cache cases opened within this run. An agent can emit two proposals for one
  // variant (e.g. TRANSFER + RESTOCK) microseconds apart; a DB select won't yet
  // see the case inserted on the previous pooled connection, so it would create
  // a duplicate. The in-run map serializes that; the DB select below still
  // dedupes across runs.
  const caseByVariant = new Map<string, string>()

  return await runIntelligenceCycle({
    variants,
    constraints,
    maxVariants: opts.maxVariants,
    policy:   opts.autoExecPolicy,
    agentOverrides: opts.agentOverrides,
    agent:    { agentName: opts.agentName, agentVersion: opts.agentVersion },
    releases: { production: opts.productionReleases },
    calibration: opts.calibration,
    requireCalibration: opts.requireCalibration,
    minCalibrationSamples: opts.minCalibrationSamples,
    openProposalKeys: opts.openProposalKeys,
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
    // Queued proposals get a Case home (system-authored — opened_by_user_id
    // NULL, migration 162). Reuse one open case per variant-situation across
    // runs. Service role bypasses RLS; raw read-modify-write keeps it self
    // contained (no RPC dependency).
    openCase: async (variant: { id: string; name: string }, proposalId: string, action: { type: string }) => {
      let caseId = caseByVariant.get(variant.id)
      if (!caseId) {
        const { data: existing } = await supabase
          .from('cases')
          .select('id')
          .eq('hotel_id', hotel.id)
          .in('status', ['open', 'in_review'])
          .contains('input_refs', [{ kind: 'variant', ref: variant.id }])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        caseId = existing?.id as string | undefined
      }
      if (caseId) {
        caseByVariant.set(variant.id, caseId)
        const { data } = await supabase.from('cases').select('proposal_ids').eq('id', caseId).maybeSingle()
        const ids = (data?.proposal_ids as string[] | null) ?? []
        if (!ids.includes(proposalId)) {
          await supabase.from('cases').update({ proposal_ids: [...ids, proposalId] }).eq('id', caseId)
        }
        return
      }
      const { data: created } = await supabase.from('cases').insert({
        hotel_id:        hotel.id,
        organization_id: hotel.organization_id,
        title:           caseTitle(action.type, variant.name),
        status:          'open',
        input_refs:      [{ kind: 'variant', ref: variant.id }, { kind: 'agent_run', ref: opts.agentName }],
        proposal_ids:    [proposalId],
        opened_by_user_id: null,
      }).select('id').single()
      if (created) caseByVariant.set(variant.id, created.id as string)
    },
  })
}

interface ExpiryRule { enabled: boolean; threshold_days: number; min_cost_at_risk: number; auto_propose: boolean }

// The expiry monitor as an unattended sweep. Reads the deterministic metric
// (get_expiring_batches, now hotel-param-aware under the service role), applies
// the operator's tunable trigger, and routes one WRITE_OFF proposal per fired
// variant through the SAME gate — WRITE_OFF is never auto-exec-eligible, so each
// queues. Gated on auto_propose so it only runs when the operator opted in.
async function runExpiryMonitorCycle(
  supabase: SupabaseClient,
  hotel: HotelRow,
  opts: { rule: ExpiryRule } & Omit<AgentCycleOpts, 'agentName' | 'agentVersion' | 'scan' | 'buildAgent' | 'promptVerb'>,
) {
  const rule = opts.rule
  if (!rule?.enabled || !rule.auto_propose) return { scanned: 0, autoExecuted: 0, queued: 0 }

  const { data: batchRows, error } = await supabase.rpc('get_expiring_batches', {
    p_days_ahead: Math.max(rule.threshold_days, 1),
    p_hotel_id:   hotel.id,
  })
  if (error) throw new Error(`expiry batches query failed: ${error.message}`)

  const batches = ((batchRows ?? []) as Record<string, unknown>[]).map((r) => ({
    variantId:    r.variant_id as string,
    variantLabel: r.variant_name && r.variant_name !== 'Standard' ? `${String(r.product_name)} · ${String(r.variant_name)}` : String(r.product_name),
    quantity:     r.quantity as number,
    daysUntilExpiry: r.days_until_expiry as number,
    costAtRisk:   Number(r.cost_at_risk),
    hotelId:      hotel.id,
  }))

  const byVariant = new Map<string, ReturnType<typeof selectExpiryTriggers>[number]>()
  for (const hit of selectExpiryTriggers(batches, rule)) {
    if (!byVariant.has(hit.variantId)) byVariant.set(hit.variantId, hit)
  }
  const variants = [...byVariant.values()].map((h) => ({ id: h.variantId, name: h.variantLabel }))
  if (variants.length === 0) return { scanned: batches.length, autoExecuted: 0, queued: 0 }

  const { data: constraintRows } = await supabase
    .from('constraints')
    .select('id, body, bucket, typed_rule, severity, applies_to_action_types, active')
    .eq('hotel_id', hotel.id)
    .eq('active', true)
  const constraints = (constraintRows ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string, body: c.body as string, bucket: c.bucket as string,
    typedRule: c.typed_rule, severity: c.severity as string,
    appliesToActionTypes: (c.applies_to_action_types as string[] | null) ?? [], active: c.active as boolean,
  }))

  const caseByVariant = new Map<string, string>()
  const result = await runIntelligenceCycle({
    variants,
    constraints,
    maxVariants: opts.maxVariants,
    policy:   opts.autoExecPolicy,          // WRITE_OFF absent → always queues
    agentOverrides: opts.agentOverrides,
    agent:    { agentName: 'expiry_monitor', agentVersion: '1.0.0' },
    releases: { production: opts.productionReleases },
    openProposalKeys: opts.openProposalKeys,
    runAgent: (variant: { id: string; name: string }) => {
      const hit = byVariant.get(variant.id)
      if (!hit) return Promise.resolve([])
      const when = hit.daysUntilExpiry <= 0 ? 'has expired' : `expires in ${String(hit.daysUntilExpiry)}d`
      return Promise.resolve([{
        action: expiryHitToWriteOff(hit, SYSTEM_ACTOR),
        confidence: Math.min(0.95, 0.5 + hit.urgency / 20),
        reasoning: `Expiry monitor fired: ${hit.variantLabel} ${when}, €${hit.costAtRisk.toFixed(0)} at risk. Trigger: days_until_expiry <= ${String(rule.threshold_days)}.`,
        provenance: [{ kind: 'tool', ref: 'expiry_monitor', detail: `days_until_expiry=${String(hit.daysUntilExpiry)} <= ${String(rule.threshold_days)}` }],
      }])
    },
    persistProposal: async (_v: unknown, proposal: { action: { type: string }; confidence: number; reasoning: string; provenance: unknown }) => {
      const { data, error: insErr } = await supabase.from('proposals').insert({
        hotel_id: hotel.id, organization_id: hotel.organization_id,
        agent_name: 'expiry_monitor', agent_version: '1.0.0',
        action_type: proposal.action.type, action_payload: proposal.action,
        confidence: proposal.confidence, reasoning: proposal.reasoning, provenance: proposal.provenance,
        status: 'pending', created_by_user_id: null,
      }).select('id').single()
      if (insErr) throw new Error(`proposal insert failed: ${insErr.message}`)
      return data.id as string
    },
    dispatch: () => Promise.resolve(false),   // WRITE_OFF never auto-executes
    markApproved: () => Promise.resolve(),
    openCase: async (variant: { id: string; name: string }, proposalId: string, action: { type: string }) => {
      let caseId = caseByVariant.get(variant.id)
      if (!caseId) {
        const { data: existing } = await supabase.from('cases').select('id')
          .eq('hotel_id', hotel.id).in('status', ['open', 'in_review'])
          .contains('input_refs', [{ kind: 'variant', ref: variant.id }])
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        caseId = existing?.id as string | undefined
      }
      if (caseId) {
        caseByVariant.set(variant.id, caseId)
        const { data } = await supabase.from('cases').select('proposal_ids').eq('id', caseId).maybeSingle()
        const ids = (data?.proposal_ids as string[] | null) ?? []
        if (!ids.includes(proposalId)) await supabase.from('cases').update({ proposal_ids: [...ids, proposalId] }).eq('id', caseId)
        return
      }
      const { data: created } = await supabase.from('cases').insert({
        hotel_id: hotel.id, organization_id: hotel.organization_id,
        title: caseTitle(action.type, variant.name), status: 'open',
        input_refs: [{ kind: 'variant', ref: variant.id }, { kind: 'agent_run', ref: 'expiry_monitor' }],
        proposal_ids: [proposalId], opened_by_user_id: null,
      }).select('id').single()
      if (created) caseByVariant.set(variant.id, created.id as string)
    },
  })
  return { scanned: batches.length, autoExecuted: result.autoExecuted, queued: result.queued }
}
