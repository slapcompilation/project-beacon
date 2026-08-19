// Health issues — the Ontology Manager's list of what is wrong with the
// ontology, as opposed to Cleanup's list of what is probably dead.
//
// The sidebar entry is documented twice, with a count and grouped beside
// Cleanup: "Value types 45 … Functions 5,423 … Health issues … Cleanup"
// (readings/home-and-navigation.md §6.3, from `oma-discover-view.png`), and it
// keeps its count even when search facets every other row.
//
// `ontology_violations()` has backed it since the linter existed and nothing
// rendered it, which OmaLayout's own header comment has been saying for months.
// Four arms feed it now — the core linter, derived properties (576), media
// properties (582) and datasource mapping (586-588) — so three of the four have
// never been visible anywhere.

import { useQuery } from '@tanstack/react-query'
import { client } from '@/lib/supabase/ontologyClient'
import { ontologyViolations, ontologyWarnings } from '@beacon/platform'

/** One problem: which type, which part of it, which thing, what is wrong.
 *  The four columns are the three-level grouping the Review edits dialog
 *  draws — object type → PROPERTIES → Seat Number → the message. */
export interface Violation {
  object_type: string
  scope: string
  subject: string
  problem: string
}

export function useViolations() {
  return useQuery({
    queryKey: ['ontology-violations'],
    queryFn: async () =>
      await client(ontologyViolations).executeFunction({}) as unknown as Violation[],
  })
}

/** The advisory list. Two lists rather than one list with a severity, because
 *  the difference is behavioural: "errors need to be handled in order to save,
 *  warnings will not prevent you from saving", and `save_working_state` only
 *  ever consults the blocking one. */
export function useWarnings() {
  return useQuery({
    queryKey: ['ontology-warnings'],
    queryFn: async () =>
      await client(ontologyWarnings).executeFunction({}) as unknown as Violation[],
  })
}
