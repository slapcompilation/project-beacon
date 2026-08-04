// Object View widget (G2). Foundry: "provides detailed information about a
// single object by displaying an embedded object view within a Workshop
// module... Choose between the full or panel object view."
//
// We render the PANEL view. The full view owns a page — header, metric strip,
// action bar, right rail — and a module already has one; embedding it would put
// two page frames on one screen.

import { Card, Icon, Tag } from '@blueprintjs/core'

/** Keys that are plumbing rather than content — an operator reading a panel
 *  wants the object, not its foreign keys. */
const HIDDEN = /^(id|.*_id|organization_id|hotel_id|created_by_user_id|embedding)$/

function label(key: string): string {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function display(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number' || typeof v === 'string') return String(v)
  return JSON.stringify(v)
}

export function EmbeddedObjectView({
  record, title, showHeader, extra,
}: {
  record: Record<string, unknown>
  title?: string
  showHeader: boolean
  /** How many other objects are in the set — the widget shows one. */
  extra: number
}) {
  const heading = title
    || display(record.title ?? record.name ?? record.label ?? '')
  const rows = Object.entries(record).filter(([k]) => !HIDDEN.test(k))

  return (
    <Card className="space-y-2">
      {showHeader && (
        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <Icon icon="cube" size={13} className="text-violet-500" />
          <span className="text-sm font-semibold truncate">{heading === '—' ? 'Object' : heading}</span>
          {extra > 0 && (
            <Tag minimal className="!text-[9px]" title="This widget shows one object from the set">
              +{extra} more in set
            </Tag>
          )}
        </div>
      )}
      <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground truncate">{label(k)}</dt>
            <dd className="truncate tabular-nums">{display(v)}</dd>
          </div>
        ))}
      </dl>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">This object has no displayable properties.</p>}
    </Card>
  )
}
