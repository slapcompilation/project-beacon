// Author a Logic Tool as a bounded question over the ontology, and see the
// answer against real records before saving — the same preview-before-commit
// the automations composer uses. Nothing here computes: evaluateUserTool does.

import { useMemo, useState } from 'react'
import {
  Button, Card, Checkbox, HTMLSelect, Icon, InputGroup, Intent, NumericInput, Tag,
} from '@blueprintjs/core'
import { emptyGraphReader,
  AGGREGATIONS, subjectProperties, describeUserTool, evaluateUserToolAcross, validateUserTool, toSlug,
  bindToolArgs, shippedAgentToolNames,
  type AggregationFn, type PropertyType, type ToolArgs, type ToolFilter, type ToolParamDef,
} from '@beacon/reality-graph'
import { BUILTIN_SET_LIMIT } from '@/features/objectTypes/api'
import { useCreateUserTool } from './hooks'
import Breakdown from './Breakdown'
import { decodeSubject, encodeSubject, useSetSubject, type SubjectRef } from '@/features/objectSets/subject'
import { Field, FilterRow, SubjectSelect } from '@/features/objectSets/FilterRow'

/** An authored tool taking a shipped tool's name would be silently ignored in an
 *  agent's registry, where the shipped one wins. Catch it at authoring time. */
const SHIPPED_TOOL_NAMES = shippedAgentToolNames(emptyGraphReader)

export default function ToolComposer({ onDone }: { onDone: () => void }) {
  const create = useCreateUserTool()

  const [name, setName] = useState('')
  const [ref, setRef] = useState<SubjectRef>({ subjectTypeId: null, subjectInterfaceId: null })
  const [filters, setFilters] = useState<ToolFilter[]>([])
  const [parameters, setParameters] = useState<ToolParamDef[]>([])
  const [args, setArgs] = useState<ToolArgs>({})
  const [fn, setFn] = useState<AggregationFn>('count')
  const [aggProp, setAggProp] = useState('')

  const { subject, targets, groups, types, interfaces, truncated } = useSetSubject(ref)

  const props = subject ? subjectProperties(subject) : []
  const numericProps = props.filter((p) => p.type === 'number')

  const draft = { name, apiName: toSlug(name), ...ref, parameters, filters, aggregation: { fn, property: aggProp || undefined } }
  const errors = validateUserTool(draft, subject, SHIPPED_TOOL_NAMES)
  const sentence = describeUserTool(draft, subject)

  // Answer it against the real record set as the operator builds it — with the
  // arguments they're trying, so a parameterised tool is testable before saving.
  const preview = useMemo(() => {
    if (errors.length > 0 || !groups) return null
    const bound = bindToolArgs(draft, args)
    if (bound.errors.length > 0) return { pending: bound.errors[0] } as const
    return evaluateUserToolAcross({ ...draft, filters: bound.filters }, groups)
  }, [errors.length, groups, filters, parameters, args, fn, aggProp])   // eslint-disable-line react-hooks/exhaustive-deps

  const needsProperty = AGGREGATIONS.find((a) => a.fn === fn)?.needsProperty === true

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon="function" size={14} />
        <h3 className="text-sm font-semibold">New Logic Tool</h3>
        <Button size="small" variant="minimal" icon="cross" className="ml-auto" onClick={onDone} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Name">
          <InputGroup value={name} placeholder="Open urgent requests" onChange={(e) => { setName(e.target.value) }} style={{ width: 200 }} />
        </Field>
        <Field label="About">
          <SubjectSelect value={encodeSubject(ref)}
            types={types.data ?? []} interfaces={interfaces.data ?? []}
            onChange={(v) => { setRef(decodeSubject(v)); setFilters([]); setAggProp('') }} />
        </Field>
        <Field label="Answer">
          <HTMLSelect value={fn} onChange={(e) => { setFn(e.currentTarget.value as AggregationFn) }}
            options={AGGREGATIONS.map((a) => ({ value: a.fn, label: a.label }))} />
        </Field>
        {needsProperty && (
          <Field label="Property">
            <HTMLSelect value={aggProp} onChange={(e) => { setAggProp(e.currentTarget.value) }}
              options={[{ value: '', label: 'Pick a number…' }, ...numericProps.map((p) => ({ value: p.key, label: p.label }))]} />
          </Field>
        )}
      </div>

      {subject?.kind === 'interface' && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Icon icon="layers" size={11} className="text-violet-500" />
          {targets.length === 0
            ? <span className="text-amber-600">No type implements {subject.iface.label} yet — this tool will answer nothing until one does.</span>
            : <span>Runs across {targets.map((t) => t.label).join(', ')} — and any type that implements {subject.iface.label} later.</span>}
        </div>
      )}

      {subject && (
        <div className="space-y-1.5">
          {filters.map((f, i) => (
            <FilterRow
              key={i} filter={f} props={props} parameters={parameters}
              onChange={(next) => { setFilters(filters.map((x, j) => (j === i ? next : x))) }}
              onRemove={() => { setFilters(filters.filter((_, j) => j !== i)) }}
            />
          ))}
          <Button size="small" variant="minimal" icon="filter" disabled={props.length === 0}
            onClick={() => {
              const p = props[0]   // the button is disabled when there are none
              setFilters([...filters, { property: p.key, op: p.type === 'number' ? 'gte' : 'eq', value: p.type === 'number' ? 0 : p.type === 'boolean' ? true : '' }])
            }}>
            Add filter
          </Button>
        </div>
      )}

      {subject && (
        <div className="space-y-1.5 border-t pt-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Parameters — asked for each time the tool runs
          </span>
          {parameters.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <InputGroup size="small" placeholder="Label (e.g. Urgency)" value={p.label} style={{ width: 150 }}
                onChange={(e) => {
                  const label = e.target.value
                  setParameters(parameters.map((x, j) => (j === i ? { ...x, label, key: toSlug(label) } : x)))
                }} />
              {p.key !== '' && <Tag minimal className="!text-[10px] font-mono">{p.key}</Tag>}
              <HTMLSelect value={p.type} onChange={(e) => {
                setParameters(parameters.map((x, j) => (j === i ? { ...x, type: e.currentTarget.value as PropertyType } : x)))
              }} options={(['text', 'number', 'boolean', 'date'] as PropertyType[]).map((t) => ({ value: t, label: t }))} />
              <Checkbox checked={p.required} className="!mb-0"
                onChange={() => { setParameters(parameters.map((x, j) => (j === i ? { ...x, required: !x.required } : x))) }}
                labelElement={<span className="text-[11px]">required</span>} />
              <Button size="small" variant="minimal" icon="cross"
                onClick={() => {
                  setParameters(parameters.filter((_, j) => j !== i))
                  setFilters(filters.map((f) => (f.param === p.key ? { ...f, param: undefined } : f)))
                }} />
            </div>
          ))}
          <Button size="small" variant="minimal" icon="add"
            onClick={() => { setParameters([...parameters, { key: '', label: '', type: 'text', required: true }]) }}>
            Add parameter
          </Button>
        </div>
      )}

      {parameters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Try it with</span>
          {parameters.map((p) => (
            <ArgInput key={p.key} param={p} value={args[p.key]}
              onChange={(v) => { setArgs({ ...args, [p.key]: v }) }} />
          ))}
        </div>
      )}

      {subject && <p className="text-xs text-muted-foreground italic">{sentence}</p>}

      {preview && ('pending' in preview ? (
        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">{preview.pending}</div>
      ) : (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 space-y-1 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <Icon icon="calculator" size={12} className="text-primary" />
            <span className="text-lg font-semibold tabular-nums">{round(preview.value)}</span>
            <span className="text-muted-foreground">{preview.basis}</span>
            <Tag minimal intent={preview.confidence >= 0.85 ? Intent.SUCCESS : preview.confidence >= 0.6 ? Intent.WARNING : Intent.DANGER}
              className="!text-[10px]">
              confidence {Math.round(preview.confidence * 100)}%
            </Tag>
          </div>
          {truncated.length > 0 && (
            <div className="text-amber-600">
              Read the first {BUILTIN_SET_LIMIT} rows of {truncated.join(', ')} — this answer covers a sample, not the whole table.
            </div>
          )}
          {preview.byType.length > 1 && <Breakdown byType={preview.byType} />}
        </div>
      ))}

      {name.trim() !== '' && errors.length > 0 && (
        <ul className="text-[11px] text-amber-600 list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}

      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} icon="floppy-disk" loading={create.isPending}
          disabled={errors.length > 0}
          onClick={() => {
            create.mutate(
              { name: name.trim(), apiName: toSlug(name), description: sentence, ...ref, parameters, filters, aggregation: { fn, property: aggProp || undefined } },
              { onSuccess: onDone },
            )
          }}>
          Create tool
        </Button>
        {name.trim() !== '' && <span className="text-[11px] text-muted-foreground">api name: <code>{toSlug(name)}</code></span>}
      </div>
    </Card>
  )
}

/** One argument value, typed against its parameter. Shared by the composer's
 *  "try it with" row and the tool card. */
export function ArgInput({ param, value, onChange }: {
  param: ToolParamDef
  value: unknown
  onChange: (v: unknown) => void
}) {
  const label = <span className="text-[10px] text-muted-foreground">{param.label || param.key}</span>
  if (param.type === 'number') {
    return (
      <span className="flex items-center gap-1">{label}
        <NumericInput size="small" value={typeof value === 'number' ? value : ''} style={{ width: 80 }} buttonPosition="none"
          onValueChange={(v) => { onChange(Number.isFinite(v) ? v : undefined) }} />
      </span>
    )
  }
  if (param.type === 'boolean') {
    return (
      <span className="flex items-center gap-1">{label}
        <HTMLSelect value={value === undefined ? '' : value === true ? 'true' : 'false'}
          onChange={(e) => { onChange(e.currentTarget.value === '' ? undefined : e.currentTarget.value === 'true') }}
          options={[{ value: '', label: '—' }, { value: 'true', label: 'true' }, { value: 'false', label: 'false' }]} />
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1">{label}
      <InputGroup size="small" value={typeof value === 'string' ? value : ''} style={{ width: 110 }}
        onChange={(e) => { onChange(e.target.value || undefined) }} />
    </span>
  )
}

const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
