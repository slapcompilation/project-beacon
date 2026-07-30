// Cohorts — named object sets. The audit (§6.2) found investigation logic living
// in useMonitorCaseSweep, which re-derives its group on every sweep and keeps no
// record of it. A cohort is that group, named and stored, so an automation, a
// tool or an operator can all refer to the same one.
//
// Membership is never materialised: selectObjectSet answers it live against the
// records, so a cohort is always current rather than as-of-last-sweep.

import { useMemo, useState } from 'react'
import { Button, Card, Icon, InputGroup, Intent, Tag } from '@blueprintjs/core'
import {
  describeSetFilters, selectObjectSet, subjectProperties, toSlug, validateObjectSet,
  type ObjectSetDef, type SetFilter,
} from '@beacon/reality-graph'
import { useObjectSets, useCreateObjectSet, useDeleteObjectSet } from './hooks'
import { rowToObjectSet } from './api'
import { decodeSubject, encodeSubject, useSetSubject, type SubjectRef } from './subject'
import { Field, FilterRow, SubjectSelect } from './FilterRow'

export default function Cohorts() {
  const sets = useObjectSets()
  const [composing, setComposing] = useState(false)
  const rows = sets.data ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon="group-objects" size={14} />
        <h2 className="text-sm font-semibold">Cohorts</h2>
        <span className="text-[11px] text-muted-foreground">
          A named group of records. Define it once; automations, tools and reports point at the same one.
        </span>
        {!composing && (
          <Button size="small" icon="add" className="ml-auto" onClick={() => { setComposing(true) }}>
            New cohort
          </Button>
        )}
      </div>

      {composing && <CohortComposer taken={rows.map((r) => r.api_name)} onDone={() => { setComposing(false) }} />}

      {sets.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!sets.isLoading && rows.length === 0 && !composing && (
        <Card className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">No cohorts yet.</p>
          <p>
            A cohort answers &ldquo;which records&rdquo; without saying what to do with them — &ldquo;batches expiring
            inside a week&rdquo;, &ldquo;suppliers below 80% reliability&rdquo;. Name one, and it becomes something an
            automation can act on and a tool can count.
          </p>
        </Card>
      )}

      {rows.map((r) => <CohortCard key={r.id} def={rowToObjectSet(r)} />)}
    </div>
  )
}

function CohortCard({ def }: { def: ObjectSetDef }) {
  const del = useDeleteObjectSet()
  const { subject, targets, groups } = useSetSubject(def)

  const selection = useMemo(
    () => (groups ? selectObjectSet(def, groups) : null),
    [groups, def],
  )
  const where = describeSetFilters(def, subject)

  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon="group-objects" size={13} className="text-violet-500" />
        <span className="text-sm font-medium">{def.name}</span>
        <Tag minimal className="!text-[10px] font-mono">{def.apiName}</Tag>
        {subject?.kind === 'interface' && (
          <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">
            across {targets.length} type{targets.length === 1 ? '' : 's'}
          </Tag>
        )}
        <Button size="small" variant="minimal" icon="trash" className="ml-auto" loading={del.isPending}
          onClick={() => { del.mutate(def.id) }} />
      </div>

      <p className="text-xs text-muted-foreground italic">
        {subject ? `Every ${subject.kind === 'interface' ? subject.iface.label : subject.type.label}` : 'Records'}
        {where ? ` where ${where}` : ''}
      </p>

      {selection === null ? (
        <span className="text-[11px] text-muted-foreground">Resolving members…</span>
      ) : (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-lg font-semibold tabular-nums">{selection.records.length}</span>
          <span className="text-muted-foreground">
            member{selection.records.length === 1 ? '' : 's'} of {selection.scanned} scanned
          </span>
          {selection.byType.length > 1 && (
            <span className="text-[11px] text-muted-foreground">
              {selection.byType.filter((b) => b.matched > 0).map((b) => `${b.label} ${String(b.matched)}`).join(' · ')}
            </span>
          )}
        </div>
      )}

      {def.parameters.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          Takes {def.parameters.map((p) => p.label || p.key).join(', ')} — counts above use the authored defaults.
        </div>
      )}
    </Card>
  )
}

function CohortComposer({ taken, onDone }: { taken: string[]; onDone: () => void }) {
  const create = useCreateObjectSet()
  const [name, setName] = useState('')
  const [ref, setRef] = useState<SubjectRef>({ subjectTypeId: null, subjectInterfaceId: null })
  const [filters, setFilters] = useState<SetFilter[]>([])

  const { subject, targets, groups, types, interfaces } = useSetSubject(ref)
  const props = subject ? subjectProperties(subject) : []

  // Parameters are a tool concern until something calls a cohort with arguments;
  // a cohort is a fixed group by definition.
  const draft = { name, apiName: toSlug(name), ...ref, parameters: [], filters }
  const errors = validateObjectSet(draft, subject, taken)
  const where = describeSetFilters(draft, subject)

  const preview = useMemo(
    () => (errors.length > 0 || !groups ? null : selectObjectSet(draft, groups)),
    [errors.length, groups, filters],   // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon="group-objects" size={14} />
        <h3 className="text-sm font-semibold">New cohort</h3>
        <Button size="small" variant="minimal" icon="cross" className="ml-auto" onClick={onDone} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Name">
          <InputGroup value={name} placeholder="Batches expiring this week" style={{ width: 220 }}
            onChange={(e) => { setName(e.target.value) }} />
        </Field>
        <Field label="Drawn from">
          <SubjectSelect value={encodeSubject(ref)}
            types={types.data ?? []} interfaces={interfaces.data ?? []}
            onChange={(v) => { setRef(decodeSubject(v)); setFilters([]) }} />
        </Field>
      </div>

      {subject?.kind === 'interface' && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Icon icon="layers" size={11} className="text-violet-500" />
          {targets.length === 0
            ? <span className="text-amber-600">No type implements {subject.iface.label} yet — this cohort is empty until one does.</span>
            : <span>Spans {targets.map((t) => t.label).join(', ')} — and any type implementing {subject.iface.label} later.</span>}
        </div>
      )}

      {subject && (
        <div className="space-y-1.5">
          {filters.map((f, i) => (
            <FilterRow
              key={i} filter={f} props={props} parameters={[]}
              onChange={(next) => { setFilters(filters.map((x, j) => (j === i ? next : x))) }}
              onRemove={() => { setFilters(filters.filter((_, j) => j !== i)) }}
            />
          ))}
          <Button size="small" variant="minimal" icon="filter" disabled={props.length === 0}
            onClick={() => {
              const p = props[0]   // the button is disabled when there are none
              setFilters([...filters, {
                property: p.key,
                op: p.type === 'number' ? 'gte' : 'eq',
                value: p.type === 'number' ? 0 : p.type === 'boolean' ? true : '',
              }])
            }}>
            Add filter
          </Button>
        </div>
      )}

      {subject && (
        <p className="text-xs text-muted-foreground italic">
          Every {subject.kind === 'interface' ? subject.iface.label : subject.type.label}
          {where ? ` where ${where}` : ''}
        </p>
      )}

      {preview && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs flex items-center gap-3">
          <Icon icon="group-objects" size={12} className="text-primary" />
          <span className="text-lg font-semibold tabular-nums">{preview.records.length}</span>
          <span className="text-muted-foreground">of {preview.scanned} records match right now</span>
        </div>
      )}

      {name.trim() !== '' && errors.length > 0 && (
        <ul className="text-[11px] text-amber-600 list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}

      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} icon="floppy-disk" loading={create.isPending} disabled={errors.length > 0}
          onClick={() => {
            create.mutate({
              name: name.trim(), apiName: toSlug(name),
              description: where ? `Every ${subject ? (subject.kind === 'interface' ? subject.iface.label : subject.type.label) : 'record'} where ${where}` : '',
              ...ref, parameters: [], filters,
            }, { onSuccess: onDone })
          }}>
          Create cohort
        </Button>
        {name.trim() !== '' && <span className="text-[11px] text-muted-foreground">api name: <code>{toSlug(name)}</code></span>}
      </div>
    </Card>
  )
}
