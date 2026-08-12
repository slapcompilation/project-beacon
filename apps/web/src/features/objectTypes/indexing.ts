// The index, which is what makes a saved object type LIVE.
//
// "Only once this indexing pipeline completes successfully will you be able to
// see your new objects… you can refresh the page to see an object count in top
// left of your screen: 183,999 objects."
//
// The status vocabulary is the page's: success, failed, or not started. An
// absent row is also not started — the type has never been indexed.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { indexObjectType } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'

export interface IndexStatus {
  objectTypeId: string
  status: 'not started' | 'success' | 'failed'
  /** The job details a failure points at. */
  error: string | null
  objectCount: number | null
  indexedAt: string | null
}

interface Row {
  object_type_id: string; status: IndexStatus['status']
  error: string | null; object_count: number | null; indexed_at: string | null
}

export function useIndexStatuses() {
  return useQuery({
    queryKey: ['object-type-indexes'],
    queryFn: async (): Promise<Map<string, IndexStatus>> => {
      const { data, error } = await supabase
        .from('object_type_indexes')
        .select('object_type_id, status, error, object_count, indexed_at')
      if (error) throw new Error(error.message)
      return new Map((data as Row[]).map((r) => [r.object_type_id, {
        objectTypeId: r.object_type_id, status: r.status, error: r.error,
        objectCount: r.object_count, indexedAt: r.indexed_at,
      }]))
    },
  })
}

/** A full reindex — the documented user-triggered case. The spinner is the
 *  pending call; failure comes back as a recorded status, not a thrown error. */
export function useReindex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (objectTypeId: string) =>
      client(indexObjectType).applyAction({ p_object_type: objectTypeId }),
    onSuccess: (row, objectTypeId) => {
      void qc.invalidateQueries({ queryKey: ['object-type-indexes'] })
      const r = row as { status: string; object_count: number | null; error: string | null }
      if (r.status === 'success') {
        toast.success(`Indexed — ${r.object_count ?? 0} object${r.object_count === 1 ? '' : 's'}`)
        // The search index is derived from this one; it follows, fire-and-forget.
        void supabase.functions.invoke('search-index', { body: { objectTypeId } })
      } else {
        toast.error(`Index failed: ${r.error ?? 'see job details'}`)
      }
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
