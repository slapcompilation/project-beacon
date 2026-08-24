// The dataset's Health panel, drawn from the tab capture
// (data-health/images/health-checks-overview.png): count chips by state, each
// row a check type with its column as a chip, a STATUS that shows the measured
// value or Passed/Failed/Error, REPORTED AT, a history dot-strip of recent
// results, and a Watch menu. The rule form shows the same components per type
// that health_check_config_valid enforces — the CHECK is the guard, this is
// the pencil.
import { useState } from 'react'
import {
  Button, Card, HTMLSelect, Icon, InputGroup, Intent, Switch, Tag,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import {
  checkTypeLabel, useAddCheck, useCheckTypes, useDeleteCheck, useHealthChecks,
  usePauseCheck, useSetWatch, WATCH_LEVEL_LABEL,
  type HealthCheck, type ResultStatus, type Severity, type WatchLevel,
} from './api'

const STATUS_INTENT: Record<ResultStatus, Intent> = {
  passed: Intent.SUCCESS, failed: Intent.DANGER, error: Intent.WARNING,
}
const STATUS_LABEL: Record<ResultStatus, string> = {
  passed: 'Passed', failed: 'Failed', error: 'Error',
}

// Which rule components each type's form shows — the mirror of
// health_check_config_valid's table, presentation-side.
interface TypeForm {
  column?: boolean
  threshold?: 'count' | 'time' | 'percent'
  values?: boolean
  regex?: boolean
  minMax?: boolean
  count?: boolean
  columnType?: boolean
  schemaComparison?: boolean
}
const TYPE_FORM: Record<string, TypeForm> = {
  build_status: {}, job_status: {},
  build_duration: { threshold: 'time' },
  time_since_last_updated: { threshold: 'time' },
  data_freshness: { column: true, threshold: 'time' },
  row_count: { threshold: 'count' },
  dataset_file_count: { threshold: 'count' },
  transaction_file_count: { threshold: 'count' },
  allowed_column_values: { column: true, values: true },
  column_regex: { column: true, regex: true },
  null_percentage: { column: true, threshold: 'percent' },
  numeric_mean: { column: true, threshold: 'count' },
  numeric_median: { column: true, threshold: 'count' },
  numeric_range: { column: true, minMax: true },
  date_range: { column: true, minMax: true },
  approximate_unique_percentage: { column: true, threshold: 'percent' },
  primary_key: { column: true },
  column: { column: true, columnType: true },
  column_count: { count: true },
  schema: { schemaComparison: true },
}

// "Between, Greater than or equal to, Less than or equal to, Equal to" is how
// the reading renders every threshold row's four options.
const THRESHOLD_OPS = [
  { value: 'between', label: 'Between' },
  { value: 'gte', label: 'Greater than or equal to' },
  { value: 'lte', label: 'Less than or equal to' },
  { value: 'eq', label: 'Equal to' },
]
const TIME_UNITS = ['minutes', 'hours', 'days']

// The manual picker's intervals (data-health/images/Manual-checks.png), plus
// Automatic — commit-triggered, threshold-resetting — as the default.
const INTERVALS = [
  { value: '', label: 'Automatic' },
  { value: '5 minutes', label: 'Every 5 minutes' },
  { value: '10 minutes', label: 'Every 10 minutes' },
  { value: '30 minutes', label: 'Every 30 minutes' },
  { value: '1 hour', label: 'Hourly' },
  { value: '2 hours', label: 'Every 2 hours' },
  { value: '6 hours', label: 'Every 6 hours' },
  { value: '1 day', label: 'Daily' },
  { value: '7 days', label: 'Weekly' },
]

const SCHEMA_COMPARISONS = [
  'EXACT_MATCH_ORDERED_COLUMNS', 'EXACT_MATCH_UNORDERED_COLUMNS',
  'COLUMN_ADDITIONS_ALLOWED', 'COLUMN_ADDITIONS_ALLOWED_STRICT',
]

export function HealthPanel({ datasetId, columns }: { datasetId: string; columns: string[] }) {
  const { data: checks = [] } = useHealthChecks(datasetId)
  const [adding, setAdding] = useState(false)

  const latest = checks.map((c) => c.results.at(0)?.status).filter((s): s is ResultStatus => s !== undefined)
  const counts = { passed: 0, failed: 0, error: 0 }
  for (const s of latest) counts[s] += 1

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="pulse" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Health</span>
        {counts.passed > 0 && <Tag minimal intent={Intent.SUCCESS} className="!text-[10px]">{counts.passed} passed</Tag>}
        {counts.failed > 0 && <Tag minimal intent={Intent.DANGER} className="!text-[10px]">{counts.failed} failed</Tag>}
        {counts.error > 0 && <Tag minimal intent={Intent.WARNING} className="!text-[10px]">{counts.error} error</Tag>}
        <Button size="small" variant="minimal" icon={adding ? 'cross' : 'add'} className="ml-auto"
          onClick={() => { setAdding(!adding) }}>
          {adding ? 'Cancel' : 'Add check'}
        </Button>
      </div>
      {adding && <AddCheckForm datasetId={datasetId} columns={columns} onDone={() => { setAdding(false) }} />}
      {checks.length === 0 && !adding ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          No health checks yet. A check watches this dataset for the failures nobody notices
          until a consumer does — stale data, shrunken row counts, schema drift.
        </p>
      ) : (
        <ul className="divide-y divide-border/30">
          {checks.map((c) => <CheckRow key={c.id} check={c} />)}
        </ul>
      )}
    </Card>
  )
}

function CheckRow({ check }: { check: HealthCheck }) {
  const pause = usePauseCheck()
  const del = useDeleteCheck()
  const watch = useSetWatch()
  const latest = check.results.at(0) ?? null
  const column = typeof check.config.column === 'string' ? check.config.column : null

  return (
    <li className="px-3 py-2 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium">{checkTypeLabel(check.check_type)}</span>
        {column !== null && <Tag minimal className="!text-[9px] font-mono">{column}</Tag>}
        {check.severity === 'critical' && <Tag minimal intent={Intent.DANGER} className="!text-[9px]">Critical</Tag>}
        {check.escalate && <Tag minimal className="!text-[9px]" title="Escalates severity after consecutive failures">Escalates</Tag>}
        {check.paused_at !== null && <Tag minimal intent={Intent.WARNING} className="!text-[9px]">Paused</Tag>}
        {check.refresh_interval !== null && <Tag minimal className="!text-[9px]" icon="time">{check.refresh_interval}</Tag>}
        <span className="ml-auto flex items-center gap-1">
          <HTMLSelect minimal value={check.myWatch ?? ''}
            onChange={(e) => {
              watch.mutate({ checkId: check.id, level: e.currentTarget.value === '' ? null : e.currentTarget.value as WatchLevel })
            }}>
            <option value="">Not watching</option>
            {(Object.keys(WATCH_LEVEL_LABEL) as WatchLevel[]).map((l) => (
              <option key={l} value={l}>{WATCH_LEVEL_LABEL[l]}</option>
            ))}
          </HTMLSelect>
          <Button variant="minimal" size="small" icon={check.paused_at === null ? 'pause' : 'play'}
            aria-label={check.paused_at === null ? 'Pause check' : 'Resume check'}
            title={check.paused_at === null ? 'Pause — snoozes alerts for all watchers' : 'Resume'}
            onClick={() => { pause.mutate({ checkId: check.id, paused: check.paused_at === null }) }} />
          <Button variant="minimal" size="small" icon="cross" aria-label="Delete check"
            onClick={() => { del.mutate({ checkId: check.id }) }} />
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {latest === null ? (
          <span className="text-[11px] text-muted-foreground">Not yet run</span>
        ) : (
          <>
            <Tag minimal intent={STATUS_INTENT[latest.status]} className="!text-[9px]"
              title={latest.detail ?? undefined}>
              {latest.measured ?? STATUS_LABEL[latest.status]}
            </Tag>
            <span className="text-[10px] text-muted-foreground">
              {new Date(latest.reported_at).toLocaleString()}
            </span>
          </>
        )}
        <span className="health-strip ml-auto" aria-label="Recent results, newest last">
          {[...check.results].reverse().map((r) => (
            <span key={r.id} className={`health-dot health-dot-${r.status}`}
              title={`${STATUS_LABEL[r.status]}${r.measured !== null ? ` — ${r.measured}` : ''} · ${new Date(r.reported_at).toLocaleString()}`} />
          ))}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground truncate" title={check.rid}>{check.rid}</span>
      </div>
    </li>
  )
}

function AddCheckForm({ datasetId, columns, onDone }: {
  datasetId: string
  columns: string[]
  onDone: () => void
}) {
  const { data: types = [] } = useCheckTypes()
  const add = useAddCheck()
  const [checkType, setCheckType] = useState('row_count')
  const [column, setColumn] = useState('')
  const [op, setOp] = useState('gte')
  const [value, setValue] = useState('')
  const [value2, setValue2] = useState('')
  const [unit, setUnit] = useState('hours')
  const [values, setValues] = useState('')
  const [regex, setRegex] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [count, setCount] = useState('')
  const [columnType, setColumnType] = useState('')
  const [comparison, setComparison] = useState(SCHEMA_COMPARISONS[0])
  const [severity, setSeverity] = useState<Severity>('moderate')
  const [escalate, setEscalate] = useState(false)
  const [interval, setInterval] = useState('')

  // schedule_status targets a schedule, which this panel is not.
  const offered = types.filter((t) => t !== 'schedule_status')
  const form = TYPE_FORM[checkType] ?? {}

  const submit = () => {
    const config: Record<string, unknown> = {}
    if (form.column === true) config.column = column
    if (form.threshold !== undefined) {
      const t: Record<string, unknown> = { op, value: Number(value) }
      if (op === 'between') t.value2 = Number(value2)
      if (form.threshold === 'time') t.unit = unit
      config.threshold = t
    }
    if (form.values === true) config.values = values.split(',').map((v) => v.trim()).filter((v) => v !== '')
    if (form.regex === true) config.regex = regex
    if (form.minMax === true) { config.min = min; config.max = max }
    if (form.count === true) config.count = Number(count)
    if (form.columnType === true) config.type = columnType
    if (form.schemaComparison === true) { config.columns = columns; config.comparison_type = comparison }
    add.mutate({
      datasetId, checkType, config, severity, escalate,
      refreshInterval: interval === '' ? null : interval,
    }, { onSuccess: onDone, onError: (e) => { toast.error(e.message) } })
  }

  return (
    <div className="px-3 py-2 border-b border-border space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <HTMLSelect value={checkType} onChange={(e) => { setCheckType(e.currentTarget.value) }}>
          {offered.map((t) => <option key={t} value={t}>{checkTypeLabel(t)}</option>)}
        </HTMLSelect>
        {form.column === true && (
          <HTMLSelect value={column} onChange={(e) => { setColumn(e.currentTarget.value) }}>
            <option value="">Column…</option>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </HTMLSelect>
        )}
        {form.threshold !== undefined && (
          <>
            <HTMLSelect value={op} options={THRESHOLD_OPS}
              onChange={(e) => { setOp(e.currentTarget.value) }} />
            <InputGroup className="health-num" placeholder="Value" value={value}
              onChange={(e) => { setValue(e.currentTarget.value) }} />
            {op === 'between' && (
              <InputGroup className="health-num" placeholder="and" value={value2}
                onChange={(e) => { setValue2(e.currentTarget.value) }} />
            )}
            {form.threshold === 'time' && (
              <HTMLSelect value={unit} options={TIME_UNITS}
                onChange={(e) => { setUnit(e.currentTarget.value) }} />
            )}
            {form.threshold === 'percent' && <span className="text-xs text-muted-foreground">%</span>}
          </>
        )}
        {form.values === true && (
          <InputGroup placeholder="Allowed values, comma-separated" value={values} fill
            onChange={(e) => { setValues(e.currentTarget.value) }} />
        )}
        {form.regex === true && (
          <InputGroup placeholder="Regular expression" value={regex} fill
            onChange={(e) => { setRegex(e.currentTarget.value) }} />
        )}
        {form.minMax === true && (
          <>
            <InputGroup className="health-num" placeholder="Min" value={min}
              onChange={(e) => { setMin(e.currentTarget.value) }} />
            <InputGroup className="health-num" placeholder="Max" value={max}
              onChange={(e) => { setMax(e.currentTarget.value) }} />
          </>
        )}
        {form.count === true && (
          <InputGroup className="health-num" placeholder="Count" value={count}
            onChange={(e) => { setCount(e.currentTarget.value) }} />
        )}
        {form.columnType === true && (
          <InputGroup className="health-num" placeholder="Expected type" value={columnType}
            onChange={(e) => { setColumnType(e.currentTarget.value) }} />
        )}
        {form.schemaComparison === true && (
          <HTMLSelect value={comparison} options={SCHEMA_COMPARISONS}
            onChange={(e) => { setComparison(e.currentTarget.value) }} />
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <HTMLSelect value={severity}
          options={[{ value: 'moderate', label: 'Moderate' }, { value: 'critical', label: 'Critical' }]}
          onChange={(e) => { setSeverity(e.currentTarget.value as Severity) }} />
        <Switch checked={escalate} label="Escalate after consecutive failures" className="!mb-0"
          onChange={(e) => { setEscalate(e.currentTarget.checked) }} />
        <HTMLSelect value={interval} options={INTERVALS}
          onChange={(e) => { setInterval(e.currentTarget.value) }} />
        <Button intent={Intent.PRIMARY} size="small" text="Add check"
          disabled={add.isPending || (form.column === true && column === '')}
          onClick={submit} />
      </div>
      {form.schemaComparison === true && (
        <p className="text-[10px] text-muted-foreground">
          The check snapshots the current {columns.length}-column schema and compares every
          future one against it.
        </p>
      )}
    </div>
  )
}
