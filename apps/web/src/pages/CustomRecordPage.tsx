// Object View for a user-authored record (Studio P3.1) — Foundry's standard
// Object View, derived from the type's schema + its authored view config:
// header → metric strip (prominent keys) → body sections → links. Empty config
// falls back to the standard derived view (resolveViewConfig).

import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { evaluateComputed, resolveViewConfig, type ObjectTypeDef } from '@beacon/reality-graph'
import { rowToObjectType } from '@/features/objectTypes/api'
import { useObjectTypes, useObjectRecord, useRecordLinks } from '@/features/objectTypes/hooks'

export default function CustomRecordPage() {
  const { type: typeId = '', recordId = '' } = useParams<{ type: string; recordId: string }>()
  const { data: typeRows = [], isLoading: typesLoading } = useObjectTypes()
  const type = typeRows.map(rowToObjectType).find((t) => t.id === typeId)
  const { data: record, isLoading: recordLoading } = useObjectRecord(recordId)
  const { data: links = [] } = useRecordLinks(recordId)

  if (typesLoading || recordLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }
  if (!type || !record || record.object_type_id !== type.id) {
    return <Navigate to={type ? `/objects/${type.id}` : '/objects'} replace />
  }

  return <RecordView type={type} record={record} links={links} />
}

function RecordView({ type, record, links }: {
  type: ObjectTypeDef
  record: { id: string; title: string; data: Record<string, unknown>; created_at: string }
  links: { id: string; linkTypeLabel: string; targetRecordId: string; targetTitle: string }[]
}) {
  const view = useMemo(() => resolveViewConfig(type, type.viewConfig), [type])

  const labelOf = (key: string) =>
    type.properties.find((p) => p.key === key)?.label ?? type.computedProperties.find((c) => c.key === key)?.label ?? key
  const valueOf = (key: string): string => {
    const computed = type.computedProperties.find((c) => c.key === key)
    return fmt(computed ? evaluateComputed(computed, record.data) : record.data[key])
  }
  const isComputed = (key: string) => type.computedProperties.some((c) => c.key === key)

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
        <div className="max-w-3xl space-y-4">
          {/* Metric strip — the type's prominent keys */}
          {view.prominent.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {view.prominent.map((key) => (
                <Card key={key} compact>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{labelOf(key)}</p>
                  <p className={`text-lg font-semibold tabular-nums mt-0.5 ${isComputed(key) ? 'text-violet-600' : ''}`}>{valueOf(key)}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Body sections */}
          {view.sections.map((section) => (
            <Card key={section.title} compact>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{section.title}</p>
              <div className="divide-y divide-border">
                {section.keys.map((key) => (
                  <div key={key} className="flex items-center justify-between py-1.5 gap-4">
                    <span className="text-xs text-muted-foreground">{labelOf(key)}</span>
                    <span className={`text-xs font-medium tabular-nums text-right ${isComputed(key) ? 'text-violet-600' : ''}`}>{valueOf(key)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {/* Links */}
          <Card compact>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Links</p>
            {links.length === 0 ? (
              <NonIdealState icon="link" title="No links" className="!py-4" />
            ) : (
              <div className="divide-y divide-border">
                {links.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 py-1.5 text-xs">
                    <Icon icon="link" size={11} className="text-muted-foreground" />
                    <span className="text-muted-foreground">{l.linkTypeLabel}:</span>
                    <span className="font-medium">{l.targetTitle}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="text-[11px] text-muted-foreground">Created {new Date(record.created_at).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v
  return '—'
}
