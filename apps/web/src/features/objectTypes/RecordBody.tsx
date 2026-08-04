// The resolved Object View body for a user-authored record — metric strip →
// sections → links. Shared by the full page (CustomRecordPage) and the panel
// slide-over (RecordPanel), differing only by `dense`. When onOpenRecord is
// given, linked records become clickable (opens their panel — the graph is
// navigable). Foundry's standard-vs-configured view is resolved by
// resolveViewConfig; nothing is ever hidden (unplaced keys sweep to Details).

import { Card, Icon, NonIdealState, Tooltip } from '@blueprintjs/core'
import { evaluateComputed, resolveViewConfig, type ObjectTypeDef } from '@beacon/reality-graph'

export interface RecordShape { id: string; title: string; data: Record<string, unknown>; created_at: string }
export interface LinkShape { id: string; linkTypeLabel: string; targetRecordId: string; targetTitle: string }

export function RecordBody({ type, record, links, dense = false, onOpenRecord }: {
  type: ObjectTypeDef
  record: RecordShape
  links: LinkShape[]
  dense?: boolean
  onOpenRecord?: (recordId: string) => void
}) {
  const view = resolveViewConfig(type, type.viewConfig)
  const labelOf = (key: string) =>
    type.properties.find((p) => p.key === key)?.label ?? type.computedProperties.find((c) => c.key === key)?.label ?? key
  const isComputed = (key: string) => type.computedProperties.some((c) => c.key === key)
  const describes = (key: string) => type.properties.find((p) => p.key === key)?.description

  /** Foundry's "property mouseover reveals its definition" — the ontology
   *  answering what a field means, rather than a colleague. */
  const Label = ({ k, className }: { k: string; className: string }) => {
    const hint = describes(k)
    const el = <span className={hint ? `${className} cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2` : className}>{labelOf(k)}</span>
    return hint ? <Tooltip content={hint} placement="top" compact>{el}</Tooltip> : el
  }
  const valueOf = (key: string): string => {
    const computed = type.computedProperties.find((c) => c.key === key)
    return fmt(computed ? evaluateComputed(computed, record.data) : record.data[key])
  }

  return (
    <div className="space-y-4">
      {view.prominent.length > 0 && (
        <div className={`grid gap-3 ${dense ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
          {view.prominent.map((key) => (
            <Card key={key} compact>
              <Label k={key} className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" />
              <p className={`text-lg font-semibold tabular-nums mt-0.5 ${isComputed(key) ? 'text-violet-600' : ''}`}>{valueOf(key)}</p>
            </Card>
          ))}
        </div>
      )}

      {view.sections.map((section) => (
        <Card key={section.title} compact>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{section.title}</p>
          <div className="divide-y divide-border">
            {section.keys.map((key) => (
              <div key={key} className="flex items-center justify-between py-1.5 gap-4">
                <Label k={key} className="text-xs text-muted-foreground" />
                <span className={`text-xs font-medium tabular-nums text-right ${isComputed(key) ? 'text-violet-600' : ''}`}>{valueOf(key)}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card compact>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Links</p>
        {links.length === 0 ? (
          <NonIdealState icon="link" title="No links" className="!py-4" />
        ) : (
          <div className="divide-y divide-border">
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2 py-1.5 text-xs">
                <Icon icon="link" size={11} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">{l.linkTypeLabel}:</span>
                {onOpenRecord ? (
                  <button type="button" className="font-medium text-primary hover:underline truncate text-left"
                    onClick={() => { onOpenRecord(l.targetRecordId) }}>
                    {l.targetTitle}
                  </button>
                ) : (
                  <span className="font-medium truncate">{l.targetTitle}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {!dense && <p className="text-[11px] text-muted-foreground">Created {new Date(record.created_at).toLocaleString()}</p>}
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
