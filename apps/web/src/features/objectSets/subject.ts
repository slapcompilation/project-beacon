// Resolving a SET's subject to the records it draws from.
//
// One place, because "every type implementing this interface" has to mean the
// same thing in a composer's preview and in the saved set's membership. The
// select value is encoded as `type:<id>` / `iface:<id>` so one dropdown can
// offer both without a second piece of state.

import { useMemo } from 'react'
import type { ObjectTypeDef, SetRecord, RecordGroup, SetSubject } from '@beacon/reality-graph'
import { useObjectTypes, useObjectRecordsForTypes } from '@/features/objectTypes/hooks'
import { rowToObjectType } from '@/features/objectTypes/api'
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

export function useSetSubject(ref: SubjectRef) {
  const types      = useObjectTypes()
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

  // The types the tool actually runs over — one, or every implementer.
  const targets: ObjectTypeDef[] = useMemo(() => {
    if (!subject) return []
    if (subject.kind === 'type') return [subject.type]
    const ids = new Set(
      (impls.data ?? []).filter((i) => i.interface_id === subject.iface.id).map((i) => i.object_type_id),
    )
    return all.filter((t) => ids.has(t.id))
  }, [subject, impls.data, all])

  const records = useObjectRecordsForTypes(targets.map((t) => t.id))

  const groups: RecordGroup[] | null = useMemo(() => {
    if (!records.data) return null
    const byType = new Map(targets.map((t) => [t.id, [] as SetRecord[]]))
    for (const r of records.data) byType.get(r.object_type_id)?.push(r.data)
    return targets.map((t) => ({ type: t, records: byType.get(t.id) ?? [] }))
  }, [records.data, targets])

  return { subject, targets, groups, types, interfaces }
}
