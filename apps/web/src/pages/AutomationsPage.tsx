// Automations composer (Studio P1) — author a new monitor as data: "when a
// bounded ontology condition holds → propose a typed action → gate." Typed
// dropdowns keep it auditable; a live preview runs the draft against the active
// hotel's variants before you save. Firing (when promoted to production) goes
// through the same gate as every proposal.

import { useMemo, useState } from 'react'
import {
  Button, Card, HTMLSelect, InputGroup, Intent, NonIdealState, NumericInput, Spinner, SpinnerSize, Switch, Tag,
} from '@blueprintjs/core'
import {
  AUTOMATION_METRICS, AUTOMATION_EFFECTS, COMPARISON_LABELS,
  evaluateAutomation, validateAutomation, describeAutomation,
  type Automation, type AutomationEffect, type AutomationGate, type AutomationStage, type ComparisonOp,
} from '@beacon/reality-graph'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  useAutomations, useVariantReadings, useCreateAutomation, useToggleAutomation,
  usePromoteAutomation, useDeleteAutomation,
} from '@/features/automations/hooks'
import { rowToAutomation } from '@/features/automations/api'
import { useObjectSets, useCohortMembers } from '@/features/objectSets/hooks'

const OPS: ComparisonOp[] = ['lt', 'lte', 'gt', 'gte']
const STAGE_INTENT: Record<AutomationStage, Intent> = { sandbox: Intent.NONE, staging: Intent.WARNING, production: Intent.SUCCESS }
const nextStage: Record<AutomationStage, AutomationStage | null> = { sandbox: 'staging', staging: 'production', production: null }

export default function AutomationsPage() {
  const role = useAuthStore((s) => s.role)
  const hotelId = useActiveHotelId()
  const readingsQ = useVariantReadings()
  const listQ = useAutomations()
  const create = useCreateAutomation()
  const toggle = useToggleAutomation()
  const promote = usePromoteAutomation()
  const del = useDeleteAutomation()

  const metrics = AUTOMATION_METRICS.variant
  const [name, setName] = useState('')
  const [metric, setMetric] = useState(metrics[2].key) // units_below_par
  const [op, setOp] = useState<ComparisonOp>('gt')
  const [value, setValue] = useState(0)
  const [effect, setEffect] = useState<AutomationEffect>('REQUEST_RESTOCK')
  const [gate, setGate] = useState<AutomationGate>('review')
  const [confidence, setConfidence] = useState(0.7)
  // '' = the welded metric condition; otherwise the cohort the rule fires on.
  const [objectSetId, setObjectSetId] = useState('')

  const cohorts = useObjectSets()
  const membersQ = useCohortMembers(objectSetId || null)
  const members = membersQ.data
  const cohortRows = (cohorts.data ?? []).filter((c) => c.subject_type_id !== null)
  const when = objectSetId === '' ? { subject: 'variant' as const, metric, op, value } : null
  const draft = { name, when, objectSetId: objectSetId || null,
    objectSetName: cohortRows.find((c) => c.id === objectSetId)?.name, effect, gate, confidence }
  const validation = validateAutomation(draft)
  const sentence = describeAutomation(draft)

  const preview = useMemo(() => {
    const readings = readingsQ.data ?? []
    const probe: Automation = {
      id: 'preview', name: name || 'preview', organizationId: '', hotelId: null,
      when, objectSetId: objectSetId || null, objectSetName: draft.objectSetName,
      effect, gate, confidence, enabled: true, stage: 'sandbox', version: 1,
    }
    return { total: readings.length, hits: evaluateAutomation(probe, readings, members) }
  }, [readingsQ.data, name, metric, op, value, effect, gate, confidence, objectSetId, members])   // eslint-disable-line react-hooks/exhaustive-deps

  if (role !== 'owner' && role !== 'admin') {
    return <NonIdealState icon="shield" title="Automations authoring is available to admin and owner roles" />
  }

  const submit = () => {
    if (!validation.ok) return
    create.mutate(
      { hotelId, name: name.trim(), subject: 'variant',
        when: objectSetId === '' ? { metric, op, value } : null,
        objectSetId: objectSetId || null, effect, gate, confidence, stage: 'sandbox' },
      { onSuccess: () => { setName(''); setValue(0) } },
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-3xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Automations</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Create a monitor without code: pick a condition over your ontology, a typed action to propose,
            and how it's gated. New automations start in <b>sandbox</b> — preview them, then promote to staging
            and production. Firing always goes through the same gate as every proposal.
          </p>
        </header>

        {/* Composer */}
        <Card className="space-y-4">
          <InputGroup placeholder="Name this automation (e.g. Low OJ → restock)" value={name} onChange={(e) => { setName(e.currentTarget.value) }} />

          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Fires on</span>
              <HTMLSelect value={objectSetId} onChange={(e) => { setObjectSetId(e.currentTarget.value) }}>
                <option value="">a stock condition</option>
                {cohortRows.length > 0 && (
                  <optgroup label="Cohorts — a named group, reusable by tools and reports">
                    {cohortRows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
              </HTMLSelect>
            </div>

            {objectSetId === '' ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">When a variant's</span>
                <HTMLSelect value={metric} onChange={(e) => { setMetric(e.currentTarget.value) }}>
                  {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </HTMLSelect>
                <HTMLSelect value={op} onChange={(e) => { setOp(e.currentTarget.value as ComparisonOp) }}>
                  {OPS.map((o) => <option key={o} value={o}>{COMPARISON_LABELS[o]}</option>)}
                </HTMLSelect>
                <NumericInput value={value} onValueChange={(v) => { setValue(Number.isFinite(v) ? v : 0) }} style={{ width: 90 }} buttonPosition="none" />
                <span className="text-muted-foreground">{metrics.find((m) => m.key === metric)?.unit === '%' ? '%' : 'units'}</span>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">
                {membersQ.isLoading
                  ? 'Resolving members…'
                  : `${String(members?.get(objectSetId)?.size ?? 0)} variants are in this cohort right now. Edit the cohort to change who it fires on.`}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">then propose to</span>
              <HTMLSelect value={effect} onChange={(e) => { setEffect(e.currentTarget.value as AutomationEffect) }}>
                {AUTOMATION_EFFECTS.filter((e) => e.subjects.includes('variant')).map((e) => <option key={e.effect} value={e.effect}>{e.label}</option>)}
              </HTMLSelect>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground">gate</span>
              <HTMLSelect value={gate} onChange={(e) => { setGate(e.currentTarget.value as AutomationGate) }}>
                <option value="review">Queue for review</option>
                <option value="auto">Auto-execute if confident</option>
              </HTMLSelect>
              <span className="text-muted-foreground">confidence</span>
              <NumericInput value={confidence} min={0} max={1} stepSize={0.05} minorStepSize={0.05}
                onValueChange={(v) => { setConfidence(Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))) }} style={{ width: 90 }} />
            </div>
          </div>

          <p className="text-xs italic text-muted-foreground border-l-2 border-l-violet-400 pl-2">{sentence}</p>

          {/* Live preview against real data */}
          <div className="rounded border bg-muted/30 p-3 text-xs">
            {readingsQ.isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground"><Spinner size={SpinnerSize.SMALL} />Loading variants…</span>
            ) : !hotelId ? (
              <span className="text-muted-foreground">Enter a property (hotel scope) to preview against live stock.</span>
            ) : (
              <>
                <span className="font-medium">Right now this would fire on {preview.hits.length} of {preview.total} variants.</span>
                {preview.hits.length > 0 && (
                  <span className="text-muted-foreground"> — {preview.hits.slice(0, 6).map((h) => h.subjectName).join(', ')}{preview.hits.length > 6 ? '…' : ''}</span>
                )}
              </>
            )}
          </div>

          {!validation.ok && <ul className="text-[11px] text-red-600 list-disc pl-4">{validation.errors.map((e) => <li key={e}>{e}</li>)}</ul>}

          <Button intent={Intent.PRIMARY} icon="add" disabled={!validation.ok} loading={create.isPending} onClick={submit}>
            Create automation
          </Button>
        </Card>

        {/* Existing automations */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your automations</h2>
          {listQ.isLoading ? (
            <Card compact className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} />Loading…</Card>
          ) : (listQ.data ?? []).length === 0 ? (
            <Card compact className="text-xs text-muted-foreground">No automations yet. Author one above — it'll start in sandbox.</Card>
          ) : (
            <Card compact className="!p-0 overflow-hidden divide-y divide-border">
              {(listQ.data ?? []).map((row) => {
                const a = rowToAutomation(row)
                const to = nextStage[a.stage]
                return (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <Switch checked={a.enabled} onChange={() => { toggle.mutate({ id: a.id, enabled: !a.enabled }) }} className="mt-0.5 mb-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{a.name}</span>
                        <Tag minimal intent={STAGE_INTENT[a.stage]} className="!text-[10px]">{a.stage}</Tag>
                        {a.hotelId === null && <Tag minimal className="!text-[10px]">org-wide</Tag>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{describeAutomation(a)}</p>
                    </div>
                    {to && (
                      <Button variant="minimal" size="small" icon="double-chevron-up" loading={promote.isPending}
                        onClick={() => { promote.mutate({ id: a.id, stage: to }) }}>
                        {to}
                      </Button>
                    )}
                    <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER}
                      onClick={() => { del.mutate(a.id) }} />
                  </div>
                )
              })}
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
