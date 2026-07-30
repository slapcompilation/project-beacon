// The filter editor. Shared by every composer that defines a set — the tool
// composer aggregates over one, the cohort composer just names one. Two editors
// would drift the moment the grammar grows.

import { Button, HTMLSelect, InputGroup, NumericInput } from '@blueprintjs/core'
import { OP_LABELS, type PropertyDef, type SetFilter, type SetParamDef } from '@beacon/reality-graph'

export function FilterRow({ filter, props, parameters, onChange, onRemove }: {
  filter: SetFilter
  props: PropertyDef[]
  parameters: SetParamDef[]
  onChange: (f: SetFilter) => void
  onRemove: () => void
}) {
  const prop = props.find((p) => p.key === filter.property)
  const isNumber = prop?.type === 'number'
  const isBool   = prop?.type === 'boolean'
  const ops: SetFilter['op'][] = isNumber ? ['gte', 'gt', 'lte', 'lt', 'eq', 'neq'] : ['eq', 'neq']

  // Only parameters of the property's own type can supply its value.
  const usable = parameters.filter((p) => p.key !== '' && p.type === prop?.type)
  const bound = parameters.find((p) => p.key === filter.param)
  // A required parameter always supplies the value, so the literal is dead.
  const literalIsRead = filter.param === undefined || bound?.required === false

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
      <HTMLSelect value={filter.op} onChange={(e) => { onChange({ ...filter, op: e.currentTarget.value as SetFilter['op'] }) }}
        options={ops.map((o) => ({ value: o, label: OP_LABELS[o] }))} />
      {usable.length > 0 && (
        <HTMLSelect value={filter.param ?? ''}
          onChange={(e) => { onChange({ ...filter, param: e.currentTarget.value || undefined }) }}
          options={[{ value: '', label: 'a value' }, ...usable.map((p) => ({ value: p.key, label: `{${p.key}}` }))]} />
      )}
      {literalIsRead && (isNumber ? (
        <NumericInput value={typeof filter.value === 'number' ? filter.value : 0} style={{ width: 90 }} buttonPosition="none"
          onValueChange={(v) => { onChange({ ...filter, value: Number.isFinite(v) ? v : 0 }) }} />
      ) : isBool ? (
        <HTMLSelect value={String(filter.value)} onChange={(e) => { onChange({ ...filter, value: e.currentTarget.value === 'true' }) }}
          options={[{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }]} />
      ) : (
        <InputGroup value={String(filter.value)} style={{ width: 140 }}
          onChange={(e) => { onChange({ ...filter, value: e.target.value }) }} />
      ))}
      {filter.param !== undefined && bound?.required === false && (
        <span className="text-[10px] text-muted-foreground">fallback</span>
      )}
      <Button size="small" variant="minimal" icon="cross" onClick={onRemove} />
    </div>
  )
}

/** The subject dropdown: one control offering types and interfaces, because a
 *  set is drawn from exactly one of them. */
export function SubjectSelect({ value, types, interfaces, onChange }: {
  value: string
  types: ReadonlyArray<{ id: string; label: string }>
  interfaces: ReadonlyArray<{ id: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <HTMLSelect value={value} onChange={(e) => { onChange(e.currentTarget.value) }}>
      <option value="">Pick an object type or interface…</option>
      <optgroup label="Object types">
        {types.map((t) => <option key={t.id} value={`type:${t.id}`}>{t.label}</option>)}
      </optgroup>
      {interfaces.length > 0 && (
        <optgroup label="Interfaces — runs across every implementer">
          {interfaces.map((i) => <option key={i.id} value={`iface:${i.id}`}>{i.label}</option>)}
        </optgroup>
      )}
    </HTMLSelect>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
