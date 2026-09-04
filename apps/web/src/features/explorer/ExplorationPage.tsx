// One exploration: the Explore perspective (charts as filters) and the Results
// perspective (the table), over the E1 engine. The shape is the reading's —
// "Each chart represents an aggregation of a property field", one chart per
// prominent property by default, an Add chart card, a preview rail of up to 20
// results, and a count badge that always agrees with the rows.

import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  Button, ButtonGroup, HTMLSelect, Icon, InputGroup, Menu, MenuItem,
  NonIdealState, Popover, Spinner, Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useObjectTypes, useLinkTypes } from '@/features/objectTypes/hooks'
import { rowToLinkType, type PropertyRow } from '@/features/objectTypes/api'
import {
  useObjectSetAggregate, useObjectSetCount, useObjectSetHistogram, useObjectSetRows,
  type ExplorerFilter, type SortSpec,
} from './api'
import { SaveDialog } from './SaveDialog'
import { ActionsMenu } from './ActionsMenu'
import { ExportMenu } from './ExportMenu'
import { FormattedValue, valueText } from '@/features/formatting/FormattedValue'

/** A jsonb cell as bare text — the primary key, the export, anywhere a string
 *  is what is wanted. A cell a user READS goes through FormattedValue, which
 *  applies the property's base formatter and its rule set binding. */
const cell = (v: unknown): string => valueText(v, undefined)

const NUMERIC = new Set(['byte', 'short', 'integer', 'long', 'float', 'double', 'decimal', 'number'])
const isNumeric = (p: PropertyRow) => NUMERIC.has(p.base_type)
const isTemporal = (p: PropertyRow) => p.base_type === 'date' || p.base_type === 'timestamp'

/** One sentence per pill, in the filter's own vocabulary. */
function describe(f: ExplorerFilter): string {
  if (f.type === 'linkFilter') {
    return `${f.value.matchType === 'MUST_HAVE' ? 'Has' : 'Has no'} ${f.linkType}`
  }
  const v = f.value
  switch (v.type) {
    case 'textFilter': return `${f.propertyType} has keywords ${v.text}`
    case 'valuesFilter': return `${f.propertyType} is ${v.values.join(', ')}`
    case 'numberRangeFilter':
      return `${f.propertyType} ${v.min !== undefined ? `≥ ${v.min}` : ''}${v.min !== undefined && v.max !== undefined ? ' and ' : ''}${v.max !== undefined ? `≤ ${v.max}` : ''}`
    case 'dateRangeFilter': {
      const r = v.dateRangeFilter
      return `${f.propertyType} ${r.start ? `from ${r.start}` : ''}${r.start && r.end ? ' ' : ''}${r.end ? `to ${r.end}` : ''}`
    }
  }
}

export default function ExplorationPage() {
  const { typeId = '' } = useParams()
  const location = useLocation()
  const { data: types = [] } = useObjectTypes()
  const type = types.find((t) => t.id === typeId) ?? null

  // A saved exploration reopens with its filters (SavedSetPage passes them).
  const initial = (location.state as { filters?: ExplorerFilter[] } | null)?.filters ?? []
  const [filters, setFilters] = useState<ExplorerFilter[]>(initial)
  const [sort, setSort] = useState<SortSpec[]>([])
  const [perspective, setPerspective] = useState<'explore' | 'results'>('explore')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const props = useMemo(() => (type?.object_type_properties ?? [])
    .filter((p) => p.visibility !== 'hidden')
    .sort((a, b) => a.position - b.position), [type])

  // The LINKED OBJECT TYPES rows of the search menu (filter-results): one
  // relation per link on this type, named by the far type the way the
  // capture's left panel names them.
  const { data: linkRows } = useLinkTypes()
  const relations = useMemo(() => linkRows.map(rowToLinkType)
    .filter((lt) => lt.sourceTypeId === typeId || lt.targetTypeId === typeId)
    .map((lt) => {
      const farId = lt.sourceTypeId === typeId ? lt.targetTypeId : lt.sourceTypeId
      return { linkApi: lt.apiName, linkLabel: lt.label,
        farLabel: types.find((t) => t.id === farId)?.label ?? lt.label }
    }), [linkRows, typeId, types])

  // "one chart shown for each prominent property on the selected object type".
  const [charts, setCharts] = useState<string[] | null>(null)
  const chartProps = useMemo(() => {
    const chosen = charts ?? props.filter((p) => p.visibility === 'prominent').map((p) => p.property_id)
    return chosen
      .map((id) => props.find((p) => p.property_id === id))
      // a derived property has no computed value to chart yet (757)
      .filter((p): p is PropertyRow => p !== undefined && p.source !== 'linked_objects')
  }, [charts, props])

  const { data: count } = useObjectSetCount(type?.id ?? null, filters)
  const pkProp = props.find((p) => p.is_primary_key)?.property_id ?? ''
  // "The current set of selected objects ... (or all objects, if none are
  // selected) is passed directly to the form."
  const { data: loadedRows = [] } = useObjectSetRows(type?.id ?? null, filters, [], 1001)
  const loadedPks = loadedRows.map((r) => cell(r[pkProp])).filter((k) => k !== '—')
  const actionTargets = selected.size > 0 ? [...selected] : loadedPks
  // the one selected row, for object-property default prefills
  const selectedRow = actionTargets.length === 1
    ? loadedRows.find((r) => cell(r[pkProp]) === actionTargets[0]) ?? null
    : null

  if (!type) return <NonIdealState icon="search" title="No such object type" />

  const addFilter = (f: ExplorerFilter) => { setFilters((fs) => [...fs, f]) }
  const removeFilter = (i: number) => { setFilters((fs) => fs.filter((_, x) => x !== i)) }

  return (
    <div className="explorer-page">
      <div className="exploration-header">
        <Link to="/explorer" className="text-muted-foreground"><Icon icon="arrow-left" /></Link>
        <Icon icon={(type.icon || 'cube') as IconName} size={18} color="#7961db" />
        <h1 className="exploration-title">{type.label}</h1>
        {selected.size > 0
          ? <Tag round intent="primary" onRemove={() => { setSelected(new Set()) }}>{selected.size} Selected</Tag>
          : <Tag minimal round intent="primary">{count ?? '…'} Results</Tag>}
        <span className="flex-1" />
        <ButtonGroup>
          <Button icon="timeline-bar-chart" active={perspective === 'explore'}
            onClick={() => { setPerspective('explore') }}>Explore</Button>
          <Button icon="th" active={perspective === 'results'}
            onClick={() => { setPerspective('results') }}>Results</Button>
        </ButtonGroup>
        <ActionsMenu ontologyId={type.ontology_id} objectTypeId={type.id} targets={actionTargets}
          selectedRow={selectedRow} />
        <ExportMenu rows={loadedRows} pks={actionTargets} typeLabel={type.label} props={props} />
        <Button intent="primary" icon="floppy-disk" onClick={() => { setSaving(true) }}>Save</Button>
      </div>
      <SaveDialog isOpen={saving} onClose={() => { setSaving(false) }}
        subjectTypeId={type.id} filters={filters} selectedPks={[...selected]} />

      <div className="exploration-filterbar">
        {filters.map((f, i) => (
          <Tag key={i} onRemove={() => { removeFilter(i) }} minimal round className="!text-xs">
            {/* the pill speaks the far type's label, the way the capture's
                "Has Flight Delay Event" does */}
            {f.type === 'linkFilter'
              ? `${f.value.matchType === 'MUST_HAVE' ? 'Has' : 'Has no'} ${
                relations.find((r) => r.linkApi === f.linkType)?.farLabel ?? f.linkType}`
              : describe(f)}
          </Tag>
        ))}
        {/* A derived property has no computed value yet (757): it cannot be
            filtered, charted or sorted, so the affordances exclude it. */}
        <AddFilter props={props.filter((p) => p.source !== 'linked_objects')}
          typeLabel={type.label} relations={relations}
          hasLinkFilter={filters.some((f) => f.type === 'linkFilter')} onAdd={addFilter} />
        {filters.length > 0 && (
          <Button variant="minimal" size="small" onClick={() => { setFilters([]) }}>Clear</Button>
        )}
      </div>

      {perspective === 'explore' ? (
        <div className="exploration-body">
          <div className="exploration-charts">
            {chartProps.map((p) => (
              <ChartCard key={p.property_id} type={type.id} property={p} filters={filters}
                onKeep={(values) => {
                  addFilter({ type: 'propertyFilter', propertyType: p.property_id,
                    value: { type: 'valuesFilter', values } })
                }}
                onRange={(min, max) => {
                  addFilter({ type: 'propertyFilter', propertyType: p.property_id,
                    value: { type: 'numberRangeFilter', min, max } })
                }}
                onRemove={() => {
                  setCharts(chartProps.filter((x) => x.property_id !== p.property_id).map((x) => x.property_id))
                }} />
            ))}
            <AddChart props={props.filter((p) => p.source !== 'linked_objects')}
              charted={chartProps.map((p) => p.property_id)}
              onAdd={(id) => { setCharts([...chartProps.map((p) => p.property_id), id]) }} />
          </div>
          <PreviewRail type={type.id} filters={filters}
            titleKey={props.find((p) => p.is_title_key)?.property_id ?? props.at(0)?.property_id ?? ''} />
        </div>
      ) : (
        <ResultsTable type={type.id} props={props} filters={filters} sort={sort} setSort={setSort}
          pkProp={pkProp} selected={selected} setSelected={setSelected} />
      )}
    </div>
  )
}

// ── charts ─────────────────────────────────────────────────────────────────

function ChartCard({ type, property, filters, onKeep, onRange, onRemove }: {
  type: string
  property: PropertyRow
  filters: ExplorerFilter[]
  onKeep: (values: string[]) => void
  onRange: (min: number, max: number) => void
  onRemove: () => void
}) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="font-medium">{property.display_name}</span>
        <Button variant="minimal" size="small" icon="cross" title="Remove chart" onClick={onRemove} />
      </div>
      {isNumeric(property) || isTemporal(property)
        ? <Histogram type={type} property={property} filters={filters} onRange={onRange} />
        : <Listogram type={type} property={property} filters={filters} onKeep={onKeep} />}
    </div>
  )
}

/** Non-numeric aggregation: value, count, a bar — click a value to Keep it. */
function Listogram({ type, property, filters, onKeep }: {
  type: string; property: PropertyRow; filters: ExplorerFilter[]
  onKeep: (values: string[]) => void
}) {
  const [more, setMore] = useState(false)
  const { data: rows = [], isLoading } = useObjectSetAggregate(
    type, filters, property.property_id, null, more ? 20 : 5)
  if (isLoading) return <Spinner size={20} />
  const top = rows[0]?.object_count ?? 1
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <button key={r.group_value ?? '∅'} type="button" className="listogram-row"
          onClick={() => { if (r.group_value !== null) onKeep([r.group_value]) }}>
          <span className="listogram-value">{r.group_value ?? 'No value'}</span>
          <span className="listogram-count">{r.object_count.toLocaleString()}</span>
          <span className="listogram-bar" style={{ width: `${Math.max((r.object_count / top) * 90, 4)}px` }} />
        </button>
      ))}
      {rows.length >= 5 && (
        <Button variant="minimal" size="small" onClick={() => { setMore(!more) }}>
          {more ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  )
}

/** Numeric or date distribution — click a bucket to filter its range. */
function Histogram({ type, property, filters, onRange }: {
  type: string; property: PropertyRow; filters: ExplorerFilter[]
  onRange: (min: number, max: number) => void
}) {
  const { data: buckets = [], isLoading } = useObjectSetHistogram(
    type, filters, property.property_id, 20)
  if (isLoading) return <Spinner size={20} />
  if (buckets.length === 0) return <p className="text-xs text-muted-foreground">No values.</p>
  const top = Math.max(...buckets.map((b) => b.object_count))
  const numeric = isNumeric(property)
  const label = (v: number) => numeric
    ? Number(v.toFixed(2)).toLocaleString()
    : new Date(v * 1000).toISOString().slice(0, 10)
  return (
    <div>
      <div className="histogram">
        {buckets.map((b) => (
          <button key={b.bucket_min} type="button" className="histogram-bar"
            title={`${label(b.bucket_min)} – ${label(b.bucket_max)}: ${b.object_count}`}
            style={{ height: `${Math.max((b.object_count / top) * 100, 3)}%` }}
            onClick={() => { if (numeric) onRange(b.bucket_min, b.bucket_max) }} />
        ))}
      </div>
      <div className="histogram-axis">
        <span>{label(buckets[0].bucket_min)}</span>
        <span>{label(buckets[buckets.length - 1].bucket_max)}</span>
      </div>
    </div>
  )
}

function AddChart({ props, charted, onAdd }: {
  props: PropertyRow[]; charted: string[]; onAdd: (id: string) => void
}) {
  const addable = props.filter((p) => !charted.includes(p.property_id)
    && (p.selectable || isNumeric(p) || isTemporal(p)))
  if (addable.length === 0) return null
  return (
    <Popover content={
      <Menu>
        {addable.map((p) => (
          <MenuItem key={p.property_id} text={p.display_name}
            onClick={() => { onAdd(p.property_id) }} />
        ))}
      </Menu>
    }>
      <button type="button" className="chart-card chart-card-add">
        <Icon icon="plus" /> Add chart
      </button>
    </Popover>
  )
}

// ── the preview rail: up to 20 results, title first ────────────────────────

function PreviewRail({ type, filters, titleKey }: {
  type: string; filters: ExplorerFilter[]; titleKey: string
}) {
  const { data: rows = [] } = useObjectSetRows(type, filters, [], 20)
  return (
    <aside className="exploration-rail">
      <h3 className="explorer-preview-label">Results</h3>
      {rows.map((r, i) => (
        <div key={i} className="rail-card">
          <Icon icon="document" size={12} color="#7961db" />
          <span className="truncate">{cell(r[titleKey])}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No objects match.</p>}
    </aside>
  )
}

// ── the Results perspective ────────────────────────────────────────────────

function ResultsTable({ type, props, filters, sort, setSort, pkProp, selected, setSelected }: {
  type: string
  props: PropertyRow[]
  filters: ExplorerFilter[]
  sort: SortSpec[]
  setSort: (s: SortSpec[]) => void
  pkProp: string
  selected: Set<string>
  setSelected: (s: Set<string>) => void
}) {
  const { data: rows = [], isLoading } = useObjectSetRows(type, filters, sort, 100)
  // Strings sort only with the render hint; numeric and date always do.
  const sortable = (p: PropertyRow) =>
    p.source !== 'linked_objects' && (p.base_type !== 'string' || p.sortable)
  const cycle = (p: PropertyRow) => {
    const at = sort.find((s) => s.property === p.property_id)
    if (!at) setSort([...sort, { property: p.property_id, direction: 'asc' }])
    else if (at.direction === 'asc') {
      setSort(sort.map((s) => s.property === p.property_id ? { ...s, direction: 'desc' } : s))
    } else setSort(sort.filter((s) => s.property !== p.property_id))
  }
  if (isLoading) return <Spinner />
  return (
    <div className="results-scroll">
      <table className="results-table">
        <thead>
          <tr>
            <th />
            {props.map((p) => {
              const at = sort.findIndex((s) => s.property === p.property_id)
              return (
                <th key={p.property_id}>
                  <button type="button" disabled={!sortable(p)} className="results-th"
                    title={sortable(p) ? undefined : 'The Sortable render hint is not enabled'}
                    onClick={() => { cycle(p) }}>
                    {p.display_name}
                    {at >= 0 && (
                      <>
                        <Icon size={11} icon={sort[at].direction === 'asc' ? 'sort-asc' : 'sort-desc'} />
                        {sort.length > 1 && <sup>{at + 1}</sup>}
                      </>
                    )}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pk = cell(r[pkProp])
            return (
              <tr key={i}>
                <td>
                  <input type="checkbox" checked={selected.has(pk)}
                    onChange={(e) => {
                      const next = new Set(selected)
                      if (e.currentTarget.checked) next.add(pk); else next.delete(pk)
                      setSelected(next)
                    }} />
                </td>
                {props.map((p) => (
                  <td key={p.property_id}>
                    {/* "To open the object view for an object ... click the
                        Title column" — the consumption chain's last hop. */}
                    {p.is_title_key
                      ? <Link to={`/objects/${type}/${encodeURIComponent(pk)}`}
                          className="results-title-link">
                          <FormattedValue value={r[p.property_id]} property={p} row={r} />
                        </Link>
                      : <FormattedValue value={r[p.property_id]} property={p} row={r} />}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && <NonIdealState icon="th" title="No objects match these filters" />}
    </div>
  )
}

// ── the search menu: properties of the main type, and its relations ────────
//
// filter-results' one control: a left panel holding the main object type and
// a LINKED OBJECT TYPES list, a right panel for the selected row. For a
// relation the page names three filters — "Has Link", links to specific
// objects ("Filter by Airline"), and far-type properties. The engine speaks
// the first (the presence filter, the only kind generate-urls serialises);
// the other two are shown for what they are: not built yet. The capture
// shows one "Has X?" row whose editor offers both directions; ours offers
// both up front, which is the same capability with one less step.

function AddFilter({ props, typeLabel, relations, hasLinkFilter, onAdd }: {
  props: PropertyRow[]
  typeLabel: string
  relations: { linkApi: string; linkLabel: string; farLabel: string }[]
  hasLinkFilter: boolean
  onAdd: (f: ExplorerFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState('__main')
  const [propId, setPropId] = useState('')
  const [mode, setMode] = useState<'keyword' | 'exact'>('keyword')
  const [text, setText] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')

  const prop = props.find((p) => p.property_id === propId) ?? null
  const numeric = prop !== null && isNumeric(prop)
  const temporal = prop !== null && isTemporal(prop)

  const apply = () => {
    if (!prop) return
    if (numeric) {
      onAdd({ type: 'propertyFilter', propertyType: prop.property_id,
        value: { type: 'numberRangeFilter',
          ...(min !== '' ? { min: Number(min) } : {}), ...(max !== '' ? { max: Number(max) } : {}) } })
    } else if (temporal) {
      onAdd({ type: 'propertyFilter', propertyType: prop.property_id,
        value: { type: 'dateRangeFilter', dateRangeFilter: {
          ...(min !== '' ? { start: min } : {}), ...(max !== '' ? { end: max } : {}) } } })
    } else if (mode === 'keyword') {
      onAdd({ type: 'propertyFilter', propertyType: prop.property_id,
        value: { type: 'textFilter', text } })
    } else {
      onAdd({ type: 'propertyFilter', propertyType: prop.property_id,
        value: { type: 'valuesFilter', values: [text] } })
    }
    setOpen(false); setText(''); setMin(''); setMax('')
  }

  const rel = relations.find((r) => r.linkApi === pane) ?? null
  const addPresence = (matchType: 'MUST_HAVE' | 'MUST_NOT_HAVE') => {
    if (rel === null) return
    onAdd({ type: 'linkFilter', linkType: rel.linkApi,
      value: { type: 'presenceFilter', matchType } })
    setOpen(false); setPane('__main')
  }

  return (
    <Popover isOpen={open} onInteraction={setOpen} content={
      <div className="filter-menu">
        <div className="filter-menu-left">
          <button type="button" className={`filter-menu-row${pane === '__main' ? ' active' : ''}`}
            onClick={() => { setPane('__main') }}>
            <span>{typeLabel}</span>
          </button>
          {relations.length > 0 && <div className="filter-menu-head">Linked object types</div>}
          {relations.map((r) => (
            <button key={r.linkApi} type="button" title={r.linkLabel}
              className={`filter-menu-row${pane === r.linkApi ? ' active' : ''}`}
              onClick={() => { setPane(r.linkApi) }}>
              <span>{r.farLabel}</span>
              <Icon icon="chevron-right" size={10} />
            </button>
          ))}
        </div>
        <div className="filter-menu-right space-y-2">
          {rel === null ? (
            <>
              <HTMLSelect fill value={propId} onChange={(e) => { setPropId(e.currentTarget.value) }}>
                <option value="">Property…</option>
                {props.map((p) => <option key={p.property_id} value={p.property_id}>{p.display_name}</option>)}
              </HTMLSelect>
              {prop && (numeric || temporal) && (
                <div className="flex gap-2">
                  <InputGroup size="small" placeholder={numeric ? 'min' : 'start (YYYY-MM-DD)'}
                    value={min} onChange={(e) => { setMin(e.currentTarget.value) }} />
                  <InputGroup size="small" placeholder={numeric ? 'max' : 'end (YYYY-MM-DD)'}
                    value={max} onChange={(e) => { setMax(e.currentTarget.value) }} />
                </div>
              )}
              {prop && !numeric && !temporal && (
                <>
                  <HTMLSelect fill value={mode} onChange={(e) => { setMode(e.currentTarget.value as 'keyword' | 'exact') }}>
                    <option value="keyword">Has keywords</option>
                    <option value="exact">Is exactly</option>
                  </HTMLSelect>
                  <InputGroup size="small" placeholder={mode === 'keyword' ? 'keywords…' : 'value…'}
                    value={text} onChange={(e) => { setText(e.currentTarget.value) }} />
                </>
              )}
              <Button intent="primary" size="small" fill onClick={apply}
                disabled={!prop || (!numeric && !temporal && text.trim() === '') || ((numeric || temporal) && min === '' && max === '')}>
                Apply filter
              </Button>
            </>
          ) : hasLinkFilter ? (
            // "You can have many PROPERTY filters, but only 1 LINK filter."
            <p className="text-[11px] text-muted-foreground">
              You can have many property filters, but only 1 link filter.
            </p>
          ) : (
            <>
              <Button size="small" fill onClick={() => { addPresence('MUST_HAVE') }}>
                Has {rel.farLabel}?
              </Button>
              <Button size="small" fill onClick={() => { addPresence('MUST_NOT_HAVE') }}>
                Has no {rel.farLabel}?
              </Button>
              <Button size="small" fill disabled>Filter by {rel.farLabel}?</Button>
              <p className="text-[11px] text-muted-foreground">
                Filtering by specific objects and by linked properties is not built yet.
              </p>
            </>
          )}
        </div>
      </div>
    }>
      <Button variant="minimal" size="small" icon="filter">Add filter</Button>
    </Popover>
  )
}
