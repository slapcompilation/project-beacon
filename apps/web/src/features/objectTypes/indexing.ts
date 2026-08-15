// The index, which is what makes a saved object type LIVE.
//
// "Only once this indexing pipeline completes successfully will you be able to
// see your new objects… you can refresh the page to see an object count in top
// left of your screen: 183,999 objects."
//
// The vocabulary is the pipeline's, not Phonograph's. OSv2 has no Index status
// scalar — "a dedicated pipeline graph that shows the status of various jobs in
// a Funnel pipeline" is the surface, and a green tick on the Object Storage v2
// node means ready. So a type's index reads as one of the seven job states, and
// a type that has never been built has no job and answers null.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { objectTypeIndexReport, runIndexBuild } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'

export interface IndexStatus {
  objectTypeId: string
  /** A build job state, or null for a type no pipeline has run. */
  state: string | null
  /** What the failing job reported. */
  error: string | null
  objectCount: number | null
  indexedAt: string | null
}

export function useIndexStatuses() {
  return useQuery({
    queryKey: ['object-type-indexes'],
    queryFn: async (): Promise<Map<string, IndexStatus>> => {
      const rows = await client(objectTypeIndexReport).executeFunction({})
      return new Map(rows.map((r) => [r.object_type_id, {
        objectTypeId: r.object_type_id, state: r.state, error: r.error,
        objectCount: r.object_count, indexedAt: r.indexed_at,
      }]))
    },
  })
}

/** Is this type queryable? "A green tick in the Object Storage v2 node in the
 *  graph indicates that the indexing is complete and the object type is ready
 *  to be queried from OSv2" — one state, of the seven, means ready. */
export const indexReady = (ix?: IndexStatus): ix is IndexStatus => ix?.state === 'COMPLETED'

/** Where a type is in its pipeline, for a tag. `null` means no job has run. */
export function indexPhase(ix?: IndexStatus): 'ready' | 'running' | 'failed' | 'none' {
  if (!ix?.state) return 'none'
  if (ix.state === 'COMPLETED') return 'ready'
  if (ix.state === 'FAILED' || ix.state === 'ABORTED') return 'failed'
  return 'running'
}

/** A full reindex — the documented user-triggered case, run as a build.
 *
 *  "The Funnel service is responsible for orchestrating Funnel pipelines that
 *  create and modify object instances in the Ontology" (object-indexing/
 *  overview): a reindex is a build job, so the button starts one and reads the
 *  job it produced. Forced, because the user asked for it — the freshness
 *  check is for the scheduler, not for a person clicking Reindex. */
export function useReindex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (objectTypeId: string) => {
      const build = await client(runIndexBuild)
        .applyAction({ p_types: [objectTypeId], p_force: true })
      const { data, error } = await supabase
        .from('build_jobs').select('state, error').eq('build_id', build).single()
      if (error) throw new Error(error.message)
      return data as { state: string; error: string | null }
    },
    onSuccess: (job, objectTypeId) => {
      void qc.invalidateQueries({ queryKey: ['object-type-indexes'] })
      if (job.state === 'COMPLETED') {
        toast.success('Indexed')
        // The search index is derived from this one; it follows, fire-and-forget.
        void supabase.functions.invoke('search-index', { body: { objectTypeId } })
      } else {
        toast.error(`Index ${job.state.toLowerCase()}: ${job.error ?? 'see job details'}`)
      }
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
