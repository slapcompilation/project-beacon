// Ontology gap surface data. Supplies the reality-graph OntologyReader from
// Supabase, then runs the detect_ontology_gaps Logic Tool — same dual-callable
// boundary the copilot would use. RLS scopes rows to the caller's hotel.

import { supabase } from '@/lib/supabase/client'
import {
  makeDetectOntologyGapsTool,
  type DetectOntologyGapsOutput,
  type OntologyReader,
  type RemovalReasonRow,
} from '@beacon/reality-graph'

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

    async getKnownRemovalCategories(hotelId) {
      const { data, error } = await supabase
        .from('stock_logs')
        .select('removal_category')
        .eq('hotel_id', hotelId)
        .not('removal_category', 'is', null)
        .limit(1000)
      if (error) throw new Error(error.message)
      return [...new Set(data.map((r) => (r as { removal_category: string }).removal_category))]
    },
  }
}

export async function fetchOntologyGaps(hotelId: string): Promise<DetectOntologyGapsOutput> {
  const tool = makeDetectOntologyGapsTool(makeSupabaseOntologyReader())
  return tool.invoke({ hotelId })
}
