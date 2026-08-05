// Ontology gap surface data. Supplies the reality-graph OntologyReader from
// Supabase, then runs the detect_ontology_gaps Logic Tool — same dual-callable
// boundary the copilot would use. RLS scopes rows to the caller's hotel.
//
// Detection stays live (re-derived each scan); only DECISIONS persist in
// ontology_proposals. An approved row is a recognized typed extension — the
// ontology grew — and is fed back as a "known category" so the detector stops
// proposing it. Rejected rows are suppressed the same way but don't count as
// growth.

import { supabase } from '@/lib/supabase/client'
import {
  makeDetectOntologyGapsTool,
  type DetectOntologyGapsOutput,
  type OntologyGap,
  type OntologyReader,
  type RemovalReasonRow,
} from '@beacon/reality-graph'

export interface OntologyProposalRow {
  id: string
  hotel_id: string
  organization_id: string | null
  kind: string
  target_type: string
  target_field: string
  proposed: string
  rationale: string
  evidence: { occurrences: number; totalConsidered: number; coverage: number; examples: string[] }
  confidence: number
  status: 'approved' | 'rejected' | 'superseded'
  decided_by_user_id: string | null
  decided_at: string
  created_at: string
}

// null hotelId = portfolio scope: drop the hotel filter and let RLS scope the
// rows to every property the caller can read (see useActiveHotelId). Applied
// inline (a generic helper trips tsc's deep-instantiation limit on Postgrest).

function makeSupabaseOntologyReader(): OntologyReader {
  return {
    async getRemovalReasons(hotelId, sinceDays) {
      // Physical column is `category` now (one sign-agnostic column); alias it
      // back to the removal-direction logical field the detector reads.
      let q = supabase
        .from('stock_logs')
        .select('reason, removal_category:category')
        .lt('quantity_change', 0)
        .not('reason', 'is', null)
        .limit(5000)
      if (hotelId) q = q.eq('hotel_id', hotelId)
      if (typeof sinceDays === 'number') {
        q = q.gte('timestamp', new Date(Date.now() - sinceDays * 86_400_000).toISOString())
      }
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return data as RemovalReasonRow[]
    },

    // "Known" = anything the operator has already decided (approved OR rejected),
    // plus categories already present on the data. Both suppress re-proposal.
    async getKnownRemovalCategories(hotelId) {
      let logsQ = supabase.from('stock_logs').select('removal_category:category')
        .lt('quantity_change', 0).not('category', 'is', null).limit(1000)
      let decidedQ = supabase.from('ontology_proposals').select('proposed')
        .eq('target_field', 'removal_category').in('status', ['approved', 'rejected'])
      if (hotelId) { logsQ = logsQ.eq('hotel_id', hotelId); decidedQ = decidedQ.eq('hotel_id', hotelId) }
      const [logs, decided] = await Promise.all([logsQ, decidedQ])
      if (logs.error) throw new Error(logs.error.message)
      if (decided.error) throw new Error(decided.error.message)
      const set = new Set<string>()
      for (const r of logs.data) {
        const c = (r as { removal_category: string | null }).removal_category
        if (c) set.add(c)
      }
      for (const r of decided.data) set.add((r as { proposed: string }).proposed)
      return [...set]
    },

    async getAdditionReasons(hotelId, sinceDays) {
      let q = supabase
        .from('stock_logs')
        .select('reason, movement_category:category')
        .gt('quantity_change', 0)
        .not('reason', 'is', null)
        .limit(5000)
      if (hotelId) q = q.eq('hotel_id', hotelId)
      if (typeof sinceDays === 'number') {
        q = q.gte('timestamp', new Date(Date.now() - sinceDays * 86_400_000).toISOString())
      }
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return data as { reason: string | null; movement_category: string | null }[]
    },

    // "Known" = decided proposals + categories already stamped on additions.
    async getKnownMovementCategories(hotelId) {
      let logsQ = supabase.from('stock_logs').select('movement_category:category')
        .gt('quantity_change', 0).not('category', 'is', null).limit(1000)
      let decidedQ = supabase.from('ontology_proposals').select('proposed')
        .eq('target_field', 'movement_category').in('status', ['approved', 'rejected'])
      if (hotelId) { logsQ = logsQ.eq('hotel_id', hotelId); decidedQ = decidedQ.eq('hotel_id', hotelId) }
      const [logs, decided] = await Promise.all([logsQ, decidedQ])
      if (logs.error) throw new Error(logs.error.message)
      if (decided.error) throw new Error(decided.error.message)
      const set = new Set<string>()
      for (const r of logs.data) {
        const c = (r as { movement_category: string | null }).movement_category
        if (c) set.add(c)
      }
      for (const r of decided.data) set.add((r as { proposed: string }).proposed)
      return [...set]
    },
  }
}

export async function fetchOntologyGaps(hotelId: string | null): Promise<DetectOntologyGapsOutput> {
  const tool = makeDetectOntologyGapsTool(makeSupabaseOntologyReader())
  return tool.invoke({ hotelId })
}

/** Readable hotel ids (RLS-scoped). In portfolio scope, an ontology decision
 *  fans out to each of these so per-hotel suppression holds chain-wide. */
export async function fetchScopedHotelIds(): Promise<string[]> {
  const { data, error } = await supabase.from('hotels').select('id')
  if (error) throw new Error(error.message)
  return data.map((r) => (r as { id: string }).id)
}

/** Records an operator decision on a detected gap for each target hotel. Upsert
 *  keyed on the concept, so re-deciding flips the status in place. Approving
 *  makes the value a recognized typed extension; both states stop the detector
 *  re-surfacing it. `hotel_id` is NOT NULL, so a portfolio decision writes one
 *  row per readable hotel. */
export async function decideOntologyGap(input: {
  hotelIds: string[]
  userId: string
  gap: OntologyGap
  status: 'approved' | 'rejected'
}): Promise<void> {
  const { gap } = input
  const rows = input.hotelIds.map((hotel_id) => ({
    hotel_id,
    kind:               gap.kind,
    target_type:        gap.targetType,
    target_field:       gap.targetField,
    proposed:           gap.proposed,
    rationale:          gap.rationale,
    evidence:           gap.evidence,
    confidence:         gap.confidence,
    status:             input.status,
    decided_by_user_id: input.userId,
    decided_at:         new Date().toISOString(),
  }))
  if (rows.length === 0) throw new Error('No hotel in scope to record the decision against')
  const { error } = await supabase
    .from('ontology_proposals')
    .upsert(rows, { onConflict: 'hotel_id,target_field,proposed' })
  if (error) throw new Error(error.message)
}

/** Approved removal_category values — the typed vocabulary the write-off /
 *  adjust-stock forms suggest. Consuming the grown ontology. */
export async function fetchApprovedRemovalCategories(hotelId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ontology_proposals')
    .select('proposed')
    .eq('hotel_id', hotelId)
    .eq('status', 'approved')
    .eq('target_field', 'removal_category')
    .order('proposed', { ascending: true })
  if (error) throw new Error(error.message)
  return [...new Set(data.map((r) => (r as { proposed: string }).proposed))]
}

/** Approved movement_category values — suggested on stock additions. */
export async function fetchApprovedMovementCategories(hotelId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ontology_proposals')
    .select('proposed')
    .eq('hotel_id', hotelId)
    .eq('status', 'approved')
    .eq('target_field', 'movement_category')
    .order('proposed', { ascending: true })
  if (error) throw new Error(error.message)
  return [...new Set(data.map((r) => (r as { proposed: string }).proposed))]
}

/** The grown ontology: approved typed extensions, newest first. null hotelId =
 *  portfolio (RLS-scoped). Portfolio fan-out means one row per hotel per
 *  concept, so de-dupe by the concept for display. */
export async function fetchApprovedExtensions(hotelId: string | null): Promise<OntologyProposalRow[]> {
  let q = supabase.from('ontology_proposals').select('*').eq('status', 'approved')
  if (hotelId) q = q.eq('hotel_id', hotelId)
  const { data, error } = await q.order('decided_at', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = data as OntologyProposalRow[]
  if (hotelId) return rows
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = `${r.target_field}:${r.proposed}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
