// Cohorts — named object sets. The audit (§6.2) found investigation logic living
// in useMonitorCaseSweep, which re-derives its group on every sweep and keeps no
// record of it. A cohort is that group, named and stored, so an automation, a
// tool or an operator can all refer to the same one.
//
// Membership is never materialised: selectObjectSet answers it live against the
// records, so a cohort is always current rather than as-of-last-sweep.

import { useMemo, useState } from 'react'
import { Button, Card, HTMLSelect, Icon, InputGroup, Intent, Tag } from '@blueprintjs/core'
import {
  MAX_TRAVERSAL_DEPTH, describeSetFilters, groupObjectSet, searchAround, selectObjectSet, subjectProperties, toSlug, validateObjectSet,
  type ObjectSetDef, type SetFilter, type SetTraversal,
} from '@beacon/reality-graph'
import { useObjectSets, useCreateObjectSet, useDeleteObjectSet, useDeclaredLinks, useLinkRows } from './hooks'
import { rowToObjectSet } from './api'
import { BUILTIN_SET_LIMIT } from '@/features/objectTypes/api'
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
  const { subject, targets, groups, truncated } = useSetSubject(def)

  const selection = useMemo(
    () => (groups ? selectObjectSet(def, groups) : null),
    [groups, def],
  )
  const where = describeSetFilters(def, subject)

  // Traversal changes the TYPE of the set, so the members shown are of the last
  // hop's type — not the subject's. Link rows come from the relationship_edges
  // view, which is the same query whatever backing owns each relationship.
  const linkRows = useLinkRows(def.traversals.map((t) => t.edgeType))
  const traversed = useMemo(() => {
    if (def.traversals.length === 0 || !selection || !linkRows.data) return null
    const start = new Set(selection.records.flatMap((r) => (typeof r.id === 'string' ? [r.id] : [])))
    return searchAround(start, linkRows.data, def.traversals)
  }, [def.traversals, selection, linkRows.data])

  // A cohort of 40 is a number; the same 40 split by supplier is a decision.
  const [groupBy, setGroupBy] = useState('')
  const groupable = subject ? subjectProperties(subject).filter((p) => p.type === 'text' || p.type === 'boolean') : []
  const grouped = useMemo(
    () => (selection && groupBy ? groupObjectSet(selection.records, groupBy, { fn: 'count' }) : null),
    [selection, groupBy],
  )

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

      {traversed && (
        <div className="rounded-md border border-violet-300/40 bg-violet-50/40 dark:bg-violet-950/20 px-3 py-2 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <Icon icon="flow-linear" size={12} className="text-violet-500" />
            <span className="text-lg font-semibold tabular-nums">{traversed.members.size}</span>
            <span className="text-muted-foreground">linked records after searching around</span>
          </div>
          {traversed.steps.map((st, i) => (
            <div key={i} className="text-[11px] text-muted-foreground">
              {st.direction === 'forward' ? '→' : '←'} {st.edgeType}: {st.from} → {st.to}
              {st.to === 0 && <span className="text-amber-600"> — chain ends here</span>}
            </div>
          ))}
        </div>
      )}

      {groupable.length > 0 && selection !== null && selection.records.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Break down by</span>
            <HTMLSelect value={groupBy} onChange={(e) => { setGroupBy(e.currentTarget.value) }}
              options={[{ value: '', label: '—' }, ...groupable.map((p) => ({ value: p.key, label: p.label }))]} />
          </div>
          {grouped && grouped.buckets.map((b) => (
            <div key={b.key} className="flex items-center gap-2 text-xs">
              <span className="w-40 truncate text-muted-foreground">{b.label}</span>
              <div className="h-1.5 rounded-sm bg-violet-500/70"
                style={{ width: `${String(Math.max(2, Math.round((b.value / (grouped.buckets[0]?.value || 1)) * 160)))}px` }} />
              <span className="tabular-nums">{b.value}</span>
            </div>
          ))}
        </div>
      )}

      {truncated.length > 0 && (
        <div className="text-[11px] text-amber-600">
          Counted the first {BUILTIN_SET_LIMIT} rows of {truncated.join(', ')} — this cohort is larger than shown.
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
  const [traversals, setTraversals] = useState<SetTraversal[]>([])

  const { subject, targets, groups, types, interfaces, truncated } = useSetSubject(ref)
  const props = subject ? subjectProperties(subject) : []
  const declared = useDeclaredLinks()
  const declaredSet = useMemo(() => new Set((declared.data ?? []).map((l) => l.edgeType)), [declared.data])

  // Parameters are a tool concern until something calls a cohort with arguments;
  // a cohort is a fixed group by definition.
  const draft = { name, apiName: toSlug(name), ...ref, parameters: [], filters, traversals }
  const errors = validateObjectSet(draft, subject, taken, declaredSet)
  const where = describeSetFilters(draft, subject)

  const previewLinks = useLinkRows(traversals.map((t) => t.edgeType))
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
        <div className="space-y-1.5 border-t pt-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Search around — each hop returns a set of the LINKED type (max {MAX_TRAVERSAL_DEPTH})
          </span>
          {traversals.map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground w-10">then</span>
              <HTMLSelect value={t.edgeType}
                onChange={(e) => { setTraversals(traversals.map((x, j) => (j === i ? { ...x, edgeType: e.currentTarget.value } : x))) }}
                options={(declared.data ?? []).map((l) => ({ value: l.edgeType, label: l.label }))} />
              <HTMLSelect value={t.direction}
                onChange={(e) => { setTraversals(traversals.map((x, j) => (j === i ? { ...x, direction: e.currentTarget.value as 'forward' | 'reverse' } : x))) }}
                options={[{ value: 'forward', label: 'forward' }, { value: 'reverse', label: 'reverse' }]} />
              <Button size="small" variant="minimal" icon="cross"
                onClick={() => { setTraversals(traversals.filter((_, j) => j !== i)) }} />
            </div>
          ))}
          {traversals.length < MAX_TRAVERSAL_DEPTH && (declared.data ?? []).length > 0 && (
            <Button size="small" variant="minimal" icon="flow-linear"
              onClick={() => { setTraversals([...traversals, { edgeType: (declared.data ?? [])[0].edgeType, direction: 'forward', filters: [] }]) }}>
              Search around
            </Button>
          )}
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
          {traversals.length > 0 && previewLinks.data && (() => {
            const start = new Set(preview.records.flatMap((r) => (typeof r.id === 'string' ? [r.id] : [])))
            const t = searchAround(start, previewLinks.data, traversals)
            return <span className="text-violet-600">→ {t.members.size} linked</span>
          })()}
          {truncated.length > 0 && (
            <span className="text-amber-600">first {BUILTIN_SET_LIMIT} of {truncated.join(', ')} only</span>
          )}
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
              ...ref, parameters: [], filters, traversals,
            }, { onSuccess: onDone })
          }}>
          Create cohort
        </Button>
        {name.trim() !== '' && <span className="text-[11px] text-muted-foreground">api name: <code>{toSlug(name)}</code></span>}
      </div>
    </Card>
  )
}
