// Full Object View for ANY ontology record — the page form factor. Header + the
// shared RecordBody (metric strip → sections → links). Clicking a linked record
// opens its Panel Object View (slide-over) so the graph is walkable in place.
//
// G1: this now serves built-in types too. Their records live in `source_table`
// rather than object_records, which is the only difference — the view itself is
// generated from the type either way, so a built-in with no hand-written page
// stops being invisible.

import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { rowToObjectType } from '@/features/objectTypes/api'
import { useOntologyTypes, useOntologyRecord, useRecordLinks } from '@/features/objectTypes/hooks'
import { RecordBody } from '@/features/objectTypes/RecordBody'
import { RecordPanel } from '@/features/objectTypes/RecordPanel'

export default function CustomRecordPage() {
  const { type: typeId = '', recordId = '' } = useParams<{ type: string; recordId: string }>()
  // The WHOLE ontology, not just authored types — a built-in registration is a
  // legitimate destination now that its records are readable.
  const { data: typeRows = [], isLoading: typesLoading } = useOntologyTypes()
  const type = typeRows.map(rowToObjectType).find((t) => t.id === typeId)
  const { data: record, isLoading: recordLoading } = useOntologyRecord(type, recordId)
  const { data: links = [] } = useRecordLinks(recordId)
  const [panelId, setPanelId] = useState<string | null>(null)

  if (typesLoading || recordLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }
  if (!type || !record || record.object_type_id !== type.id) {
    return <Navigate to={type ? `/objects/${type.id}` : '/objects'} replace />
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Link to="/objects" className="hover:underline">Objects</Link>
          <Icon icon="chevron-right" size={10} />
          <Link to={`/objects/${type.id}`} className="hover:underline">{type.label}</Link>
          <Icon icon="chevron-right" size={10} />
          <span className="truncate max-w-[240px]">{record.title}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Icon icon={type.icon as IconName} size={16} className="text-violet-500" />
          <h1 className="text-sm font-semibold">{record.title}</h1>
          <Tag minimal className="!text-[10px] font-mono">{type.apiName}</Tag>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl">
          <RecordBody type={type} record={record} links={links} onOpenRecord={(id) => { setPanelId(id) }} />
        </div>
      </div>

      <RecordPanel recordId={panelId} onClose={() => { setPanelId(null) }} />
    </div>
  )
}
