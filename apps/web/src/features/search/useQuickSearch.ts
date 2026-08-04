// Jump-to search over the ontology, the applications and the documents —
// the half of ⌘K that was missing. The palette already found products,
// variants and suppliers client-side; it could not find an object type someone
// authored, a Workshop app, or a document.
//
// Titles only, per Foundry's jump-to mode. Ranking and the deprecated/hidden
// exclusion live in the RPC (migration 325), because that is where the object
// type's status and visibility are.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export type QuickHitKind = 'object_type' | 'object_record' | 'module' | 'document'

export interface QuickHit {
  kind: QuickHitKind
  id: string
  /** What the hit is addressed by — api_name for a type or module, the PARENT
   *  type's api_name for a record. Documents route by id. */
  slug: string
  title: string
  subtitle: string
  icon: string
  /** Curated by an admin — ranks higher and carries a checkmark. */
  promoted: boolean
}

interface Row extends QuickHit { rank: number }

export function quickHitPath(h: QuickHit): string {
  switch (h.kind) {
    case 'object_type':   return `/objects/${h.slug}`
    case 'object_record': return `/objects/${h.slug}/${h.id}`
    case 'module':        return `/modules/${h.slug}`
    case 'document':      return `/documents/${h.id}`
  }
}

export const QUICK_HIT_GROUP: Record<QuickHitKind, string> = {
  object_type:   'Objects',
  object_record: 'Objects',
  module:        'Apps',
  document:      'Files',
}

export function useQuickSearch(query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: ['quicksearch', q],
    queryFn: async (): Promise<QuickHit[]> => {
      const res = await supabase.rpc('quicksearch', { p_query: q, p_limit: 20 }) as unknown as
        { data: Row[] | null; error: { message: string } | null }
      if (res.error) throw new Error(res.error.message)
      return (res.data ?? []).map(({ rank: _rank, ...hit }) => hit)
    },
    // Two characters is where a title search stops matching everything. An
    // EMPTY query is not idle — it returns the promoted-items catalog, which is
    // what an operator should see on opening the palette with nothing typed.
    enabled: q.length === 0 || q.length >= 2,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })
}
