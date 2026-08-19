// The aggregation vocabulary, read from the database rather than restated.
//
// `derived_aggregations()` returns nine rows of (name, needs_property,
// takes_limit) with the two rules already encoded — "For Count aggregation, you
// do not need to select a property as objects are automatically counted", and
// "If you selected Collect list or Collect set as your aggregation, you can
// optionally set a limit". A second copy in TypeScript would be a second thing
// to keep true.

import { useQuery } from '@tanstack/react-query'
import { client } from '@/lib/supabase/ontologyClient'
import { derivedAggregations } from '@beacon/platform'

export interface Aggregation {
  name: string
  label: string
  needsProperty: boolean
  takesLimit: boolean
}

/** `collect_list` reads as "Collect list" — the panel's own casing. */
const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export function useDerivedAggregations() {
  return useQuery({
    queryKey: ['derived-aggregations'],
    staleTime: Infinity,
    queryFn: async (): Promise<Aggregation[]> => {
      const rows = await client(derivedAggregations).executeFunction({}) as unknown as {
        name: string; needs_property: boolean; takes_limit: boolean
      }[]
      return rows.map((r) => ({
        name: r.name,
        label: titleCase(r.name),
        needsProperty: r.needs_property,
        takesLimit: r.takes_limit,
      }))
    },
  })
}
