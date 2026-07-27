// Supabase-backed AuthoredToolReader — the fetch half of running an authored tool.
// Resolution (which types an interface spans) stays in reality-graph; this only
// reads. RLS scopes every query to the caller's org.

import { authoredToolAsLogicTool, type LogicTool, type AuthoredToolReader } from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'
import { fetchObjectTypes, fetchObjectRecordsForTypes, rowToObjectType } from '@/features/objectTypes/api'
import { fetchUserTools, rowToUserToolDef } from './api'

export function makeAuthoredToolReader(): AuthoredToolReader {
  return {
    objectTypes: async () => (await fetchObjectTypes()).map(rowToObjectType),

    interfaceImplementers: async (interfaceId) => {
      const { data, error } = await supabase
        .from('object_type_interfaces').select('object_type_id').eq('interface_id', interfaceId)
      if (error) throw new Error(error.message)
      return (data as { object_type_id: string }[]).map((r) => r.object_type_id)
    },

    objectRecords: async (typeIds) => (await fetchObjectRecordsForTypes([...typeIds]))
      .map((r) => ({ objectTypeId: r.object_type_id, data: r.data })),
  }
}

/** The org's enabled authored tools as Logic Tools an agent can call. A failed
 *  read means no authored tools this run, not a failed cycle. */
export async function fetchAuthoredLogicTools(): Promise<LogicTool[]> {
  const rows = await fetchUserTools().catch(() => [])
  const reader = makeAuthoredToolReader()
  return rows.filter((r) => r.enabled).map((r) => authoredToolAsLogicTool(rowToUserToolDef(r), reader))
}
