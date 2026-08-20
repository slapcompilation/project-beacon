// The Ontology cleanup queue — `ontology-manager/cleanup`.
//
// The shape is `cleanup-filter-example.png`: a table of object types with
// NAME · GROUPS · PRIORITY · FLAGS · READS · ACTION, a toolbar carrying the
// three verbs, and a filter popover offering the enabled flags, the three
// priorities and the actions already taken.
//
// Two things this page deliberately does NOT do.
//
// It does not recompute on load. "When you opt to **Start cleanup**, the tool
// may take time to find cleanup candidates based on the size of your Ontology",
// and saving flag settings "will reset previous Cleanup results" — Foundry
// prompts to recalculate rather than doing it silently, so the queue here is
// whatever was last stored and the button is the only thing that runs it.
//
// It does not implement Deprecate or Delete. "Deprecation and deletion are
// staged the same way as normal Ontology modifications" — the same Review edits
// modal as any other change — so those route to the object type where the
// status control already lives. Snooze is the only verb this page owns, because
// it is the only state cleanup adds.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button, Callout, Checkbox, Dialog, DialogBody, DialogFooter, HTMLTable,
  InputGroup, NonIdealState, Popover, Spinner, Tag,
} from '@blueprintjs/core'
import { useAppStore } from '@/stores/app.store'
import {
  FLAG_LABEL, useCandidates, useCleanupConfig, useEffectiveFlags, useRunCleanup, useSnooze,
  useSnoozed, useUnsnooze, useDeprecateCandidates, useDeleteCandidates,
} from '@/features/cleanup/api'

const PRIORITY_RANK: Record<string, number> = { high: 1, medium: 2, low: 3 }
const PRIORITY_INTENT: Record<string, 'danger' | 'warning' | 'none'> = {
  high: 'danger', medium: 'warning', low: 'none',
}

export default function CleanupPage() {
  const ontologyId = useAppStore((s) => s.omaOntologyId)
  const config = useCleanupConfig(ontologyId)
  const configId = config.data?.id ?? null
  const flags = useEffectiveFlags(configId)
  const candidates = useCandidates(configId)
  const run = useRunCleanup(configId)
  const snooze = useSnooze(configId)
  const { data: snoozed = [] } = useSnoozed(ontologyId)
  const unsnooze = useUnsnooze(ontologyId)
  const deprecate = useDeprecateCandidates(configId)
  const remove = useDeleteCandidates(configId)
  const [deprecating, setDeprecating] = useState(false)
  const [reason, setReason] = useState('')
  const [deadline, setDeadline] = useState('')

  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [flagFilter, setFlagFilter] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null)

  const rows = useMemo(() => {
    const all = candidates.data ?? []
    return all
      .filter((c) => !flagFilter || c.flags.includes(flagFilter))
      .filter((c) => !priorityFilter || c.priority === priorityFilter)
      // "By default, the table is sorted by the highest priority among the
      // flags that an object type triggers."
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9))
  }, [candidates.data, flagFilter, priorityFilter])

  // The filter panel lists only the flags that are ON, with their counts —
  // which is why `cleanup-filters.png` shows five and not seven.
  const facets = useMemo(() => {
    const enabled = (flags.data ?? []).filter((f) => f.enabled && f.computable)
    const all = candidates.data ?? []
    return enabled.map((f) => ({
      flag: f.flag,
      count: all.filter((c) => c.flags.includes(f.flag)).length,
    }))
  }, [flags.data, candidates.data])

  if (config.isLoading) return <Spinner size={20} />
  const neverRun = !config.data?.computed_at

  return (
    <section className="space-y-3 p-4">
      <header className="flex items-center gap-2">
        <h1 className="text-base font-semibold">Ontology Cleanup</h1>
        <Tag minimal round className="tabular-nums">{candidates.data?.length ?? 0}</Tag>
        <span className="flex-1" />
        <Link to="/ontology/cleanup/flags">
          <Button variant="minimal" size="small" icon="flag">Flag settings</Button>
        </Link>
        <Button intent="primary" size="small" icon="clean" loading={run.isPending}
          onClick={() => { run.mutate() }}>
          {neverRun ? 'Start cleanup' : 'Recalculate'}
        </Button>
      </header>

      <Callout intent="none" icon="info-sign" className="!text-xs">
        Cleanup asks whether an object type is <strong>probably dead</strong>, not
        whether it is malformed — that is Health issues. Snoozing affects only you.
      </Callout>

      {neverRun
        ? <NonIdealState icon="clean" title="No cleanup queue yet"
            description="Finding candidates can take a while on a large ontology, so it runs when you ask."
            action={<Button intent="primary" icon="clean" loading={run.isPending}
              onClick={() => { run.mutate() }}>Start cleanup</Button>} />
        : <>
            <div className="flex items-center gap-2">
              <Button size="small" icon="time" disabled={picked.size === 0}
                loading={snooze.isPending}
                onClick={() => {
                  snooze.mutate({ objectTypeIds: [...picked], days: 30 })
                  setPicked(new Set())
                }}>Snooze 30 days</Button>
              {/* The page's toolbar carries Snooze, Deprecate and a trash icon,
                  acting on the checkbox selection — "you can decide the most
                  appropriate way to handle resources individually or in bulk".
                  Deprecation and deletion are "staged the same way as normal
                  Ontology modifications", so these stage rather than write: the
                  save session is still what commits them. */}
              <Button size="small" icon="archive" disabled={picked.size === 0}
                loading={deprecate.isPending}
                onClick={() => { setDeprecating(true) }}>Deprecate</Button>
              <Button size="small" icon="trash" intent="danger" variant="minimal"
                disabled={picked.size === 0} loading={remove.isPending}
                onClick={() => {
                  remove.mutate([...picked], { onSuccess: () => { setPicked(new Set()) } })
                }} />
              <span className="flex-1" />
              <Popover placement="bottom-end" content={
                <div className="w-64 space-y-2 p-3 text-xs">
                  <p className="font-semibold">Flags</p>
                  {facets.map((f) => (
                    <label key={f.flag} className="flex items-center gap-2">
                      <Checkbox checked={flagFilter === f.flag} className="!mb-0"
                        onChange={() => { setFlagFilter(flagFilter === f.flag ? null : f.flag) }} />
                      <span className="flex-1">{FLAG_LABEL[f.flag] ?? f.flag}</span>
                      <span className="tabular-nums text-neutral-500">{f.count}</span>
                    </label>
                  ))}
                  <p className="pt-1 font-semibold">Priority</p>
                  {['high', 'medium', 'low'].map((p) => (
                    <label key={p} className="flex items-center gap-2">
                      <Checkbox checked={priorityFilter === p} className="!mb-0"
                        onChange={() => { setPriorityFilter(priorityFilter === p ? null : p) }} />
                      <span className="capitalize">{p}</span>
                    </label>
                  ))}
                </div>
              }>
                <Button variant="minimal" size="small" icon="filter"
                  active={Boolean(flagFilter) || Boolean(priorityFilter)} />
              </Popover>
            </div>

            {snoozed.length > 0 && (
              <details className="rounded border px-3 py-2">
                <summary className="cursor-pointer text-xs">
                  Snoozed <Tag minimal round className="tabular-nums">{snoozed.length}</Tag>
                  <span className="ml-2 text-[11px] text-neutral-500">
                    hidden from your queue until the date shown — yours only
                  </span>
                </summary>
                <HTMLTable compact className="mt-2 w-full !text-xs">
                  <thead><tr><th>Name</th><th>Snoozed until</th><th /></tr></thead>
                  <tbody>
                    {snoozed.map((sz) => (
                      <tr key={sz.object_type_id}>
                        <td>{sz.label}</td>
                        <td className="tabular-nums">{new Date(sz.until).toLocaleDateString()}</td>
                        <td className="text-right">
                          <Button variant="minimal" size="small" icon="undo" title="Un-snooze"
                            onClick={() => { unsnooze.mutate(sz.object_type_id) }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </HTMLTable>
              </details>
            )}

            {rows.length === 0
              ? <NonIdealState icon="tick-circle" title="Nothing flagged"
                  description="No object type in this ontology trips an enabled cleanup flag." />
              : <HTMLTable compact striped className="w-full !text-xs">
                  <thead>
                    <tr>
                      <th className="w-8" />
                      <th>Name</th><th>Priority</th><th>Flags</th>
                      <th className="text-right">Reads</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.object_type_id}>
                        <td>
                          <Checkbox className="!mb-0" checked={picked.has(c.object_type_id)}
                            onChange={() => {
                              const next = new Set(picked)
                              if (next.has(c.object_type_id)) next.delete(c.object_type_id)
                              else next.add(c.object_type_id)
                              setPicked(next)
                            }} />
                        </td>
                        <td>{c.label}</td>
                        <td>
                          <Tag minimal intent={PRIORITY_INTENT[c.priority] ?? 'none'}
                            className="capitalize">{c.priority}</Tag>
                        </td>
                        <td className="space-x-1">
                          {c.flags.map((f) => (
                            <Tag key={f} minimal className="!text-[10px]">{FLAG_LABEL[f] ?? f}</Tag>
                          ))}
                        </td>
                        {/* "READS", showing 1, 1 and 43 for the page's three
                            example types — and 43 is the one it deprecates
                            rather than deletes. Null is not zero: it means
                            metrics were not on for the whole window. */}
                        <td className="text-right tabular-nums"
                          title={c.reads === null ? 'Metrics were not on for the whole window' : undefined}>
                          {c.reads === null ? '—' : c.reads}
                        </td>
                        <td className="text-right">
                          <Link to={`/ontology/object-types?type=${c.object_type_id}`}>
                            <Button variant="minimal" size="small" icon="arrow-right" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </HTMLTable>}
          </>}

      {/* A deprecation carries a reason and a deadline or the database refuses
          it. Asked once for the whole selection, because the toolbar acts "in
          bulk" and one reason is what a bulk deprecation means. */}
      <Dialog isOpen={deprecating} onClose={() => { setDeprecating(false) }}
        title={`Deprecate ${picked.size} object type${picked.size === 1 ? '' : 's'}`}>
        <DialogBody>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Staged like any other ontology change — the save session commits it.
            </p>
            <label className="text-[11px] font-semibold">Why it is being deprecated</label>
            <InputGroup value={reason} onValueChange={setReason}
              placeholder="No longer used by any application" />
            <label className="text-[11px] font-semibold">When it is expected to be deleted</label>
            <InputGroup type="date" value={deadline} onValueChange={setDeadline} />
          </div>
        </DialogBody>
        <DialogFooter actions={
          <Button intent="primary" loading={deprecate.isPending}
            disabled={reason.trim() === '' || deadline === ''}
            onClick={() => {
              deprecate.mutate({ ids: [...picked], reason: reason.trim(), deadline }, {
                onSuccess: () => {
                  setDeprecating(false); setPicked(new Set()); setReason(''); setDeadline('')
                },
              })
            }}>Stage deprecation</Button>
        } />
      </Dialog>
    </section>
  )
}
