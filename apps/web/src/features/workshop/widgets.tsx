// The six widget kinds this arc built. The catalogue records ~56 more
// against the pages that would build them (workshop_widget_kinds), so a
// kind that is not here is refused by the database, not silently blank.
//
// Each renders from its own jsonb config — "how the current widget's setup
// is stored in JSON" (workshop/concepts-widgets).

import { Button, Card, HTMLTable, Icon, Intent, NonIdealState, Tag, type IconName } from '@blueprintjs/core'
import { DocMarkdown } from '@/features/compass/DocMarkdown'
import { useObjectSetRows, type WorkshopWidget } from './api'

/** An object property renders as text; a nested value renders as its JSON
 *  rather than as [object Object]. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

/** A widget's bound object set, when it has one. Variables carry the
 *  binding; a widget with no set yet says so rather than rendering empty. */
function boundSet(w: WorkshopWidget): string | null {
  const v = w.config.objectSetId
  return typeof v === 'string' && v !== '' ? v : null
}

function ObjectTable({ widget }: { widget: WorkshopWidget }) {
  const setId = boundSet(widget)
  const { data: rows = [], isLoading } = useObjectSetRows(setId)
  const columns = Array.isArray(widget.config.columns)
    ? (widget.config.columns as string[]) : []
  if (setId === null) {
    return <Unbound what="an object set" />
  }
  if (isLoading) return <p className="ws-empty">Loading…</p>
  const shown = columns.length > 0
    ? columns
    : [...new Set(rows.flatMap((r) => Object.keys(r as Record<string, unknown>)))].slice(0, 8)
  return (
    <div className="ws-scroll">
      <HTMLTable compact interactive className="w-full text-xs">
        <thead>
          <tr>{shown.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(i)}>
              {shown.map((c) => (
                <td key={c}>{cell((r as Record<string, unknown>)[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </HTMLTable>
      {rows.length === 0 && <p className="ws-empty">No objects in this set.</p>}
    </div>
  )
}

/** "Visualize a high-level summary of objects data … to allow filtering."
 *  The counts come from the bound set; toggling writes the widget's filter
 *  output variable, which this arc records but does not yet propagate. */
function FilterList({ widget }: { widget: WorkshopWidget }) {
  const setId = boundSet(widget)
  const { data: rows = [] } = useObjectSetRows(setId)
  const properties = Array.isArray(widget.config.filters)
    ? (widget.config.filters as string[]) : []
  if (setId === null) return <Unbound what="an object set" />
  if (properties.length === 0) return <Unbound what="filters to show" />
  return (
    <div className="ws-filters">
      {properties.map((p) => {
        const counts = new Map<string, number>()
        for (const r of rows) {
          const v = cell((r as Record<string, unknown>)[p])
          if (v !== '') counts.set(v, (counts.get(v) ?? 0) + 1)
        }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        const max = top.at(0)?.[1] ?? 1
        return (
          <div key={p} className="ws-filter">
            <p className="ws-filter-name">{p}</p>
            {top.map(([value, n]) => (
              <div key={value} className="ws-filter-row">
                <span className="flex-1 truncate">{value}</span>
                <span className="ws-filter-count">{n}</span>
                <span className="ws-filter-bar" style={{ width: `${String((n / max) * 60)}px` }} />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** "Render a card to highlight key metrics or statistics." */
function MetricCard({ widget }: { widget: WorkshopWidget }) {
  const setId = boundSet(widget)
  const { data: rows = [] } = useObjectSetRows(setId)
  const label = typeof widget.config.label === 'string' ? widget.config.label : widget.name
  if (setId === null) return <Unbound what="an object set" />
  return (
    <div className="ws-metric">
      <span className="ws-metric-value">{rows.length}</span>
      <span className="ws-metric-label">{label}</span>
    </div>
  )
}

/** "Shows the object view of a single object" — the active object of
 *  another widget, which this arc renders as its properties. */
function ObjectView({ widget }: { widget: WorkshopWidget }) {
  const setId = boundSet(widget)
  const { data: rows = [] } = useObjectSetRows(setId, 1)
  if (setId === null) return <Unbound what="an object" />
  const row = rows.at(0) as Record<string, unknown> | undefined
  if (row === undefined) return <p className="ws-empty">Nothing selected.</p>
  return (
    <dl className="ws-properties">
      {Object.entries(row).map(([k, v]) => (
        <div key={k} className="ws-property">
          <dt>{k}</dt>
          <dd>{cell(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** "Embed one or more buttons that can trigger Actions, Workshop Events,
 *  URLs to be opened". Events are ordered rows on the widget; running them
 *  is the next arc, so a button says what it would do. */
function ButtonGroup({ widget }: { widget: WorkshopWidget }) {
  const buttons = Array.isArray(widget.config.buttons)
    ? (widget.config.buttons as { text?: string; intent?: string; icon?: string }[]) : []
  if (buttons.length === 0) return <Unbound what="buttons" />
  return (
    <div className="ws-buttons">
      {buttons.map((b, i) => (
        <Button key={String(i)} size="small"
          icon={(b.icon ?? undefined) as IconName | undefined}
          intent={(b.intent ?? 'none') as Intent}>
          {b.text ?? 'Button'}
        </Button>
      ))}
    </div>
  )
}

function Markdown({ widget }: { widget: WorkshopWidget }) {
  const text = typeof widget.config.text === 'string' ? widget.config.text : ''
  if (text === '') return <Unbound what="text" />
  return <DocMarkdown text={text} />
}

function Unbound({ what }: { what: string }) {
  return <p className="ws-empty">Not configured — this widget needs {what}.</p>
}

const RENDERERS: Partial<Record<string, (p: { widget: WorkshopWidget }) => React.ReactElement>> = {
  object_table: ObjectTable,
  filter_list: FilterList,
  metric_card: MetricCard,
  object_view: ObjectView,
  button_group: ButtonGroup,
  markdown: Markdown,
}

export function WidgetBody({ widget }: { widget: WorkshopWidget }) {
  const Renderer = RENDERERS[widget.kind]
  if (Renderer === undefined) {
    // The database refuses an unbuilt kind, so this is only reachable if a
    // kind is built in SQL before its renderer lands — say which.
    return (
      <NonIdealState icon="widget" title={widget.kind}
        description="This widget kind has no renderer yet." />
    )
  }
  return <Renderer widget={widget} />
}

export function WidgetFrame({ widget, editing, onRemove, onSelect, selected }: {
  widget: WorkshopWidget
  editing: boolean
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  return (
    <Card compact className={`ws-widget ${selected ? 'ws-widget-selected' : ''}`}
      onClick={editing ? onSelect : undefined}>
      {editing && (
        <div className="ws-widget-bar">
          <Icon icon="widget" size={11} className="text-muted-foreground" />
          <span className="ws-widget-name">{widget.name}</span>
          <Tag minimal className="!text-[9px]">{widget.kind.replace(/_/g, ' ')}</Tag>
          <Button variant="minimal" size="small" icon="cross" title="Remove widget"
            onClick={(e) => { e.stopPropagation(); onRemove() }} />
        </div>
      )}
      <WidgetBody widget={widget} />
    </Card>
  )
}
