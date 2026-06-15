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

function makeSupabaseOntologyReader(): OntologyReader {
  return {
    async getRemovalReasons(hotelId, sinceDays) {
      let q = supabase
        .from('stock_logs')
        .select('reason, removal_category')
        .eq('hotel_id', hotelId)
        .lt('quantity_change', 0)
        .not('reason', 'is', null)
        .limit(5000)
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
      const [logs, decided] = await Promise.all([
        supabase
          .from('stock_logs')
          .select('removal_category')
          .eq('hotel_id', hotelId)
          .not('removal_category', 'is', null)
          .limit(1000),
        supabase
          .from('ontology_proposals')
          .select('proposed')
          .eq('hotel_id', hotelId)
          .eq('target_field', 'removal_category')
          .in('status', ['approved', 'rejected']),
      ])
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
        .select('reason, movement_category')
        .eq('hotel_id', hotelId)
        .gt('quantity_change', 0)
        .not('reason', 'is', null)
        .limit(5000)
      if (typeof sinceDays === 'number') {
        q = q.gte('timestamp', new Date(Date.now() - sinceDays * 86_400_000).toISOString())
      }
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return data as { reason: string | null; movement_category: string | null }[]
    },

    // "Known" = decided proposals + categories already stamped on additions.
    async getKnownMovementCategories(hotelId) {
      const [logs, decided] = await Promise.all([
        supabase
          .from('stock_logs')
          .select('movement_category')
          .eq('hotel_id', hotelId)
          .not('movement_category', 'is', null)
          .limit(1000),
        supabase
          .from('ontology_proposals')
          .select('proposed')
          .eq('hotel_id', hotelId)
          .eq('target_field', 'movement_category')
          .in('status', ['approved', 'rejected']),
      ])
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

    // Tally edge types client-side (PostgREST has no group-by without an RPC).
    async getEdgeTypeCounts(hotelId) {
      const { data, error } = await supabase
        .from('relationship_edges')
        .select('edge_type')
        .eq('hotel_id', hotelId)
        .limit(20000)
      if (error) throw new Error(error.message)
      const tally = new Map<string, number>()
      for (const r of data) {
        const t = (r as { edge_type: string }).edge_type
        tally.set(t, (tally.get(t) ?? 0) + 1)
      }
      return [...tally.entries()].map(([edge_type, count]) => ({ edge_type, count }))
    },
  }
}

export async function fetchOntologyGaps(hotelId: string): Promise<DetectOntologyGapsOutput> {
  const tool = makeDetectOntologyGapsTool(makeSupabaseOntologyReader())
  return tool.invoke({ hotelId })
}

/** Records an operator decision on a detected gap. Upsert keyed on the concept,
 *  so re-deciding flips the status in place. Approving makes the value a
 *  recognized typed extension; both states stop the detector re-surfacing it. */
export async function decideOntologyGap(input: {
  hotelId: string
  userId: string
  gap: OntologyGap
  status: 'approved' | 'rejected'
}): Promise<void> {
  const { gap } = input
  const { error } = await supabase
    .from('ontology_proposals')
    .upsert({
      hotel_id:           input.hotelId,
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
    }, { onConflict: 'hotel_id,target_field,proposed' })
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

/** The grown ontology: approved typed extensions, newest first. */
export async function fetchApprovedExtensions(hotelId: string): Promise<OntologyProposalRow[]> {
  const { data, error } = await supabase
    .from('ontology_proposals')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('status', 'approved')
    .order('decided_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as OntologyProposalRow[]
}
