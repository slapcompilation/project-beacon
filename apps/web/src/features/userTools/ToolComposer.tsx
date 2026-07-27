// Author a Logic Tool as a bounded question over the ontology, and see the
// answer against real records before saving — the same preview-before-commit
// the automations composer uses. Nothing here computes: evaluateUserTool does.

import { useMemo, useState } from 'react'
import {
  Button, Card, HTMLSelect, Icon, InputGroup, Intent, NumericInput, Tag,
} from '@blueprintjs/core'
import {
  AGGREGATIONS, OP_LABELS, subjectProperties, describeUserTool, evaluateUserToolAcross, validateUserTool, toSlug,
  type AggregationFn, type PropertyDef, type ToolFilter,
} from '@beacon/reality-graph'
import { shippedAgentToolNames } from '@beacon/reality-graph'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'
import { useCreateUserTool } from './hooks'
import Breakdown from './Breakdown'
import { decodeSubject, encodeSubject, useToolSubject, type SubjectRef } from './subject'

/** An authored tool taking a shipped tool's name would be silently ignored in an
 *  agent's registry, where the shipped one wins. Catch it at authoring time. */
const SHIPPED_TOOL_NAMES = shippedAgentToolNames(makeSupabaseGraphReader())

export default function ToolComposer({ onDone }: { onDone: () => void }) {
  const create = useCreateUserTool()

  const [name, setName] = useState('')
  const [ref, setRef] = useState<SubjectRef>({ subjectTypeId: null, subjectInterfaceId: null })
  const [filters, setFilters] = useState<ToolFilter[]>([])
  const [fn, setFn] = useState<AggregationFn>('count')
  const [aggProp, setAggProp] = useState('')

  const { subject, targets, groups, types, interfaces } = useToolSubject(ref)

  const props = subject ? subjectProperties(subject) : []
  const numericProps = props.filter((p) => p.type === 'number')

  const draft = { name, apiName: toSlug(name), ...ref, filters, aggregation: { fn, property: aggProp || undefined } }
  const errors = validateUserTool(draft, subject, SHIPPED_TOOL_NAMES)
  const sentence = describeUserTool(draft, subject)

  // Answer it against the real record set as the operator builds it.
  const preview = useMemo(() => {
    if (errors.length > 0 || !groups) return null
    return evaluateUserToolAcross(draft, groups)
  }, [errors.length, groups, filters, fn, aggProp])   // eslint-disable-line react-hooks/exhaustive-deps

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
          <HTMLSelect value={encodeSubject(ref)}
            onChange={(e) => { setRef(decodeSubject(e.currentTarget.value)); setFilters([]); setAggProp('') }}>
            <option value="">Pick an object type or interface…</option>
            <optgroup label="Object types">
              {(types.data ?? []).map((t) => <option key={t.id} value={`type:${t.id}`}>{t.label}</option>)}
            </optgroup>
            {(interfaces.data ?? []).length > 0 && (
              <optgroup label="Interfaces — runs across every implementer">
                {(interfaces.data ?? []).map((i) => <option key={i.id} value={`iface:${i.id}`}>{i.label}</option>)}
              </optgroup>
            )}
          </HTMLSelect>
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
              key={i} filter={f} props={props}
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

      {subject && <p className="text-xs text-muted-foreground italic">{sentence}</p>}

      {preview && (
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
          {preview.byType.length > 1 && <Breakdown byType={preview.byType} />}
        </div>
      )}

      {name.trim() !== '' && errors.length > 0 && (
        <ul className="text-[11px] text-amber-600 list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}

      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} icon="floppy-disk" loading={create.isPending}
          disabled={errors.length > 0}
          onClick={() => {
            create.mutate(
              { name: name.trim(), apiName: toSlug(name), description: sentence, ...ref, filters, aggregation: { fn, property: aggProp || undefined } },
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

function FilterRow({ filter, props, onChange, onRemove }: {
  filter: ToolFilter
  props: PropertyDef[]
  onChange: (f: ToolFilter) => void
  onRemove: () => void
}) {
  const prop = props.find((p) => p.key === filter.property)
  const isNumber = prop?.type === 'number'
  const isBool   = prop?.type === 'boolean'
  const ops: ToolFilter['op'][] = isNumber ? ['gte', 'gt', 'lte', 'lt', 'eq', 'neq'] : ['eq', 'neq']

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground w-10">where</span>
      <HTMLSelect value={filter.property} onChange={(e) => {
        const p = props.find((x) => x.key === e.currentTarget.value)
        onChange({
          property: e.currentTarget.value,
          op: p?.type === 'number' ? 'gte' : 'eq',
          value: p?.type === 'number' ? 0 : p?.type === 'boolean' ? true : '',
        })
      }} options={props.map((p) => ({ value: p.key, label: p.label }))} />
      <HTMLSelect value={filter.op} onChange={(e) => { onChange({ ...filter, op: e.currentTarget.value as ToolFilter['op'] }) }}
        options={ops.map((o) => ({ value: o, label: OP_LABELS[o] }))} />
      {isNumber ? (
        <NumericInput value={typeof filter.value === 'number' ? filter.value : 0} style={{ width: 90 }} buttonPosition="none"
          onValueChange={(v) => { onChange({ ...filter, value: Number.isFinite(v) ? v : 0 }) }} />
      ) : isBool ? (
        <HTMLSelect value={String(filter.value)} onChange={(e) => { onChange({ ...filter, value: e.currentTarget.value === 'true' }) }}
          options={[{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }]} />
      ) : (
        <InputGroup value={String(filter.value)} style={{ width: 140 }}
          onChange={(e) => { onChange({ ...filter, value: e.target.value }) }} />
      )}
      <Button size="small" variant="minimal" icon="cross" onClick={onRemove} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
