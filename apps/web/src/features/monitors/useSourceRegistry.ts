// The source registry (Tier 5.5/5.6) — sources as configuration rather than as
// edge functions, with the two readings Foundry separates:
//
//   dataset freshness  when did we last RUN            (last_run_at)
//   data freshness     when did the data last CHANGE   (max watermark)
//
// A source polling happily over data nobody has touched for a week is green on
// every liveness check and broken in the only way that matters.
//
// Both RPCs are SECURITY INVOKER, so what comes back is already scoped to what
// the caller may see — no role gate here.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

export interface SourceFreshnessRow {
  api_name:        string
  label:           string
  last_run_at:     string | null
  data_changed_at: string | null
  run_age_hours:   number | null
  data_age_hours:  number | null
  /** Landed rows the pipeline has not processed. NULL for a source with no
   *  backlog column — "not applicable", distinct from a backlog of zero. */
  pending_count:     number | null
  oldest_pending_at: string | null
  verdict:         string
}

/** What PostgREST actually sends: a pg numeric arrives as a string. Declaring
 *  it as number was the lie, not the conversion below. */
type RawFreshnessRow = Omit<SourceFreshnessRow, 'run_age_hours' | 'data_age_hours' | 'pending_count'> & {
  run_age_hours:  number | string | null
  data_age_hours: number | string | null
  pending_count:  number | string | null
}

export interface SourceReconciliationRow {
  api_name:     string
  label:        string
  staging_rows: number | null
  landed_rows:  number | null
  dead_letters: number
  ontologized:  boolean
  verdict:      string
}

export interface RegisteredSource extends SourceFreshnessRow {
  reconciliation: string | null
  deadLetters:    number
  ontologized:    boolean
}

async function fetchRegistry(): Promise<RegisteredSource[]> {
  const [fresh, recon] = await Promise.all([
    supabase.rpc('source_freshness') as unknown as Promise<{ data: RawFreshnessRow[] | null; error: { message: string } | null }>,
    supabase.rpc('source_reconciliation') as unknown as Promise<{ data: SourceReconciliationRow[] | null; error: { message: string } | null }>,
  ])
  if (fresh.error) throw new Error(fresh.error.message)
  if (recon.error) throw new Error(recon.error.message)

  const byName = new Map((recon.data ?? []).map((r) => [r.api_name, r]))
  return (fresh.data ?? []).map((f) => {
    const r = byName.get(f.api_name)
    return {
      ...f,
      run_age_hours:  f.run_age_hours  === null ? null : Number(f.run_age_hours),
      data_age_hours: f.data_age_hours === null ? null : Number(f.data_age_hours),
      pending_count:  f.pending_count  === null ? null : Number(f.pending_count),
      reconciliation: r?.verdict ?? null,
      deadLetters:    r?.dead_letters ?? 0,
      ontologized:    r?.ontologized ?? false,
    }
  })
}

export function useSourceRegistry() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['source-registry', hotelId],
    queryFn:   fetchRegistry,
    enabled:   !!hotelId,
    staleTime: 60_000,
  })
}

/** Verdict → how loudly to say it. 'RUNNING BUT STALE' is the one the old
 *  liveness checks could not see, so it reads as the most severe. */
export function freshnessIntent(verdict: string): 'danger' | 'warning' | 'success' | 'none' {
  if (verdict.startsWith('RUNNING BUT STALE')) return 'danger'
  if (verdict === 'never run' || verdict === 'data stale') return 'warning'
  if (verdict === 'fresh') return 'success'
  return 'none'
}
