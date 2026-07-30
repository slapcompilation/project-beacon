// Resolving a SET's subject to the records it draws from.
//
// One place, because "every type implementing this interface" has to mean the
// same thing in a composer's preview and in the saved set's membership. The
// select value is encoded as `type:<id>` / `iface:<id>` so one dropdown can
// offer both without a second piece of state.
//
// Both KINDS of type, too. Authored records live in object_records; a built-in
// type's live in the table its registration names (migration 223). Sets read
// them identically — before this, a set could only see authored records, which
// is 13 rows against an operational graph of thousands.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ObjectTypeDef, SetRecord, RecordGroup, SetSubject } from '@beacon/reality-graph'
import { useOntologyTypes } from '@/features/objectTypes/hooks'
import { fetchBuiltinRecords, fetchObjectRecordsForTypes, rowToObjectType } from '@/features/objectTypes/api'
import { useInterfaces, useImplementations } from '@/features/interfaces/hooks'
import { rowToInterface } from '@/features/interfaces/api'

export type SubjectRef = { subjectTypeId: string | null; subjectInterfaceId: string | null }

export const encodeSubject = (r: SubjectRef): string =>
  r.subjectTypeId ? `type:${r.subjectTypeId}` : r.subjectInterfaceId ? `iface:${r.subjectInterfaceId}` : ''

export function decodeSubject(v: string): SubjectRef {
  const [kind, id] = v.split(':')
  if (kind === 'type')  return { subjectTypeId: id, subjectInterfaceId: null }
  if (kind === 'iface') return { subjectTypeId: null, subjectInterfaceId: id }
  return { subjectTypeId: null, subjectInterfaceId: null }
}

/** Records for a mixed set of types, each read from wherever it actually lives.
 *  `truncated` names the types that hit the read ceiling, so a partial count is
 *  never reported as a whole one. */
function useSetRecords(targets: ObjectTypeDef[]) {
  const key = targets.map((t) => t.id).sort().join(',')
  return useQuery({
    queryKey: ['set-records', key] as const,
    enabled: targets.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const authored = targets.filter((t) => t.kind !== 'builtin')
      const builtin  = targets.filter((t) => t.kind === 'builtin')

      const authoredRows = authored.length > 0 ? await fetchObjectRecordsForTypes(authored.map((t) => t.id)) : []
      const builtinResults = await Promise.all(builtin.map(async (t) => ({ type: t, ...(await fetchBuiltinRecords(t)) })))

      const byType = new Map<string, SetRecord[]>(targets.map((t) => [t.id, []]))
      for (const r of authoredRows) byType.get(r.object_type_id)?.push(r.data)
      for (const b of builtinResults) byType.set(b.type.id, b.rows.map((r) => r.data))

      return { byType, truncated: builtinResults.filter((b) => b.truncated).map((b) => b.type.label) }
    },
  })
}

export function useSetSubject(ref: SubjectRef) {
  // The WHOLE ontology: a cohort of variants is the obvious first cohort, and
  // variant is a built-in registration.
  const types      = useOntologyTypes()
  const interfaces = useInterfaces()
  const impls      = useImplementations()

  const all = useMemo(() => (types.data ?? []).map(rowToObjectType), [types.data])

  const subject: SetSubject | undefined = useMemo(() => {
    if (ref.subjectTypeId) {
      const t = all.find((x) => x.id === ref.subjectTypeId)
      return t ? { kind: 'type', type: t } : undefined
    }
    if (ref.subjectInterfaceId) {
      const row = (interfaces.data ?? []).find((i) => i.id === ref.subjectInterfaceId)
      return row ? { kind: 'interface', iface: rowToInterface(row) } : undefined
    }
    return undefined
  }, [ref.subjectTypeId, ref.subjectInterfaceId, all, interfaces.data])

  // The types the set actually draws from — one, or every implementer.
  const targets: ObjectTypeDef[] = useMemo(() => {
    if (!subject) return []
    if (subject.kind === 'type') return [subject.type]
    const ids = new Set(
      (impls.data ?? []).filter((i) => i.interface_id === subject.iface.id).map((i) => i.object_type_id),
    )
    return all.filter((t) => ids.has(t.id))
  }, [subject, impls.data, all])

  const records = useSetRecords(targets)

  const groups: RecordGroup[] | null = useMemo(() => {
    if (!records.data) return null
    return targets.map((t) => ({ type: t, records: records.data.byType.get(t.id) ?? [] }))
  }, [records.data, targets])

  return { subject, targets, groups, types, interfaces, truncated: records.data?.truncated ?? [] }
}
