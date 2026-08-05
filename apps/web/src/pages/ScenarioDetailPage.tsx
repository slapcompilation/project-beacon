// Scenario detail (H3) — operator-driven sandbox surface. Left: overlay editor
// (policy knobs that write to graph_overlay via apply_overlay_edit) + the
// provenance timeline. Right: simulation result pane (run the cycle against the
// overlay, no persistence). Promote / archive in the header.

import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Button, Callout, Card, Icon, Intent, NonIdealState, NumericInput, Spinner, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import {
  useScenario, useScenarioOverlayEdits, useApplyOverlayEdit,
  useSimulateScenario, useSetScenarioStatus,
} from '@/features/scenarios/hooks'
import type { ScenarioRow, OverlayEditRow } from '@/features/scenarios/api'

export default function ScenarioDetailPage() {
  const { scenarioId = '' } = useParams<{ scenarioId: string }>()
  const navigate = useNavigate()
  const { data: row, isLoading } = useScenario(scenarioId)
  const { data: edits = [] }     = useScenarioOverlayEdits(scenarioId)
  const simulate   = useSimulateScenario()
  const setStatus  = useSetScenarioStatus()

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner intent={Intent.PRIMARY} /></div>
  }
  if (!row) {
    return (
      <NonIdealState
        icon="search-template"
        title="Scenario not found"
        action={<Button onClick={() => { void navigate('/scenarios') }}>Back to Scenarios</Button>}
      />
    )
  }

  const isDraft = row.status === 'draft'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link to="/scenarios" className="text-xs text-muted-foreground hover:text-foreground">Scenarios</Link>
          <Icon icon="chevron-right" size={10} className="text-muted-foreground" />
          <Icon icon="lab-test" size={14} className="text-violet-500" />
          <h1 className="text-sm font-semibold">{row.title}</h1>
          <Tag minimal intent={statusIntent(row.status)}>{row.status}</Tag>
          <div className="ml-auto flex items-center gap-2">
            <Button
              intent={Intent.PRIMARY} icon="play" size="small"
              loading={simulate.isPending}
              onClick={() => { simulate.mutate(row) }}
            >
              Simulate
            </Button>
            {isDraft && (
              <>
                <Button
                  intent={Intent.SUCCESS} icon="confirm" variant="minimal" size="small"
                  loading={setStatus.isPending}
                  disabled={!row.last_simulation}
                  title={row.last_simulation ? 'Mark this scenario promoted' : 'Simulate before promoting'}
                  onClick={() => { setStatus.mutate({ id: row.id, status: 'promoted' }) }}
                >
                  Promote
                </Button>
                <Button
                  icon="archive" variant="minimal" size="small"
                  loading={setStatus.isPending}
                  onClick={() => { setStatus.mutate({ id: row.id, status: 'archived' }) }}
                >
                  Archive
                </Button>
              </>
            )}
          </div>
        </div>
        {row.description && <p className="text-xs text-muted-foreground leading-relaxed">{row.description}</p>}
        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{row.id}</p>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {/* Left: overlay editor + provenance */}
        <div className="w-[420px] shrink-0 border-r overflow-y-auto p-4 space-y-4">
          <PolicyOverlayEditor row={row} disabled={!isDraft} />
          <ProvenanceTimeline edits={edits} />
        </div>

        {/* Right: simulation result */}
        <div className="flex-1 overflow-y-auto p-4">
          <SimulationPane row={row} pending={simulate.isPending} />
        </div>
      </div>
    </div>
  )
}

// ─── Overlay editor ──────────────────────────────────────────────────────────
// V1 covers the auto-exec REQUEST_RESTOCK floor, overstock factor, par
// window/service level, and the per-cycle cap. Each writes to graph_overlay
// via apply_overlay_edit. Blank input = no override (inherits org policy).

function PolicyOverlayEditor({ row, disabled }: { row: ScenarioRow; disabled: boolean }) {
  const apply = useApplyOverlayEdit()
  const policy = row.graph_overlay.policy

  const edit = (path: ReadonlyArray<string>, value: unknown) => {
    apply.mutate({ scenarioId: row.id, path, value })
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon="cog" size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">Policy overlay</h2>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1 mb-1">
        Blank = inherit the org policy. Set a value to override it for this scenario only.
      </p>

      <Card className="space-y-3">
        <OverlayNumber
          label="auto_execution.thresholds.REQUEST_RESTOCK"
          hint="Confidence floor for auto-executing a restock (0–1)."
          value={policy?.auto_execution?.thresholds?.REQUEST_RESTOCK}
          min={0} max={1} step={0.05}
          disabled={disabled || apply.isPending}
          onCommit={(v) => { edit(['policy', 'auto_execution', 'thresholds', 'REQUEST_RESTOCK'], v) }}
        />
        <OverlayNumber
          label="overstock.factor"
          hint="current_stock > par × factor counts as overstock."
          value={policy?.overstock?.factor}
          min={1} step={0.5}
          disabled={disabled || apply.isPending}
          onCommit={(v) => { edit(['policy', 'overstock', 'factor'], v) }}
        />
        <OverlayNumber
          label="par.service_level"
          hint="Fill rate the par engine targets (0–1)."
          value={policy?.par?.service_level}
          min={0} max={1} step={0.05}
          disabled={disabled || apply.isPending}
          onCommit={(v) => { edit(['policy', 'par', 'service_level'], v) }}
        />
        <OverlayNumber
          label="caps.max_variants_per_cycle"
          hint="Hard cap on at-risk variants scanned per run."
          value={policy?.caps?.max_variants_per_cycle}
          min={1} step={1} integer
          disabled={disabled || apply.isPending}
          onCommit={(v) => { edit(['policy', 'caps', 'max_variants_per_cycle'], v) }}
        />
      </Card>
    </section>
  )
}

function OverlayNumber({
  label, hint, value, min, max, step, integer, disabled, onCommit,
}: {
  label: string; hint: string; value: number | undefined
  min?: number; max?: number; step?: number; integer?: boolean
  disabled: boolean; onCommit: (value: number | undefined) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Tag minimal className="font-mono !text-[10px]">{label}</Tag>
          {value != null ? <Tag minimal intent={Intent.PRIMARY}>override</Tag> : <Tag minimal>inherit</Tag>}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
      </div>
      <NumericInput
        min={min} max={max} stepSize={step} minorStepSize={step}
        value={value ?? ''}
        placeholder="inherit"
        disabled={disabled}
        className="w-24"
        onValueChange={(n) => {
          if (!Number.isFinite(n)) { onCommit(undefined); return }
          const clamped = integer ? Math.round(n) : n
          if (min != null && clamped < min) return
          if (max != null && clamped > max) return
          onCommit(clamped)
        }}
      />
    </div>
  )
}

// ─── Provenance timeline ─────────────────────────────────────────────────────

function ProvenanceTimeline({ edits }: { edits: OverlayEditRow[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon="history" size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">Overlay history</h2>
      </div>
      {edits.length === 0 ? (
        <Card className="text-xs italic text-muted-foreground">No overlay edits yet.</Card>
      ) : (
        <div className="space-y-1">
          {edits.map((e) => (
            <Card key={e.id} className="text-[11px] py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag minimal intent={e.source === 'llm' ? Intent.PRIMARY : Intent.NONE} className="!text-[9px]">{e.source}</Tag>
                <span className="font-mono">{e.path.join('.')}</span>
              </div>
              <div className="text-muted-foreground mt-0.5">
                {fmtVal(e.before)} <Icon icon="arrow-right" size={9} /> {fmtVal(e.after)}
                <span className="ml-2 opacity-60">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Simulation pane ─────────────────────────────────────────────────────────

function SimulationPane({ row, pending }: { row: ScenarioRow; pending: boolean }) {
  const sim = row.last_simulation

  if (pending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Spinner size={20} />Running the cycle against the overlay…
      </div>
    )
  }
  if (!sim) {
    return (
      <Callout intent={Intent.NONE} icon="play" title="Not simulated yet">
        Click <strong>Simulate</strong> to run the intelligence cycle against this scenario's overlay.
        Nothing is written to real state — you'll see what the cycle <em>would</em> propose.
      </Callout>
    )
  }

  const r = sim.result
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-px bg-border rounded overflow-hidden">
        <Metric label="Scanned"      value={r.scanned} />
        <Metric label="Proposed"     value={r.proposed} />
        <Metric label="Auto-exec"    value={r.autoExecuted} intent={Intent.SUCCESS} />
        <Metric label="Queued"       value={r.queued} intent={Intent.WARNING} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Simulated {formatDistanceToNow(new Date(sim.ran_at), { addSuffix: true })}. No-op persistence — real state untouched.
      </p>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold">Per-variant outcomes</h3>
        {r.items.length === 0 ? (
          <Card className="text-xs italic text-muted-foreground">No at-risk variants under this overlay.</Card>
        ) : (
          <div className="space-y-1">
            {r.items.map((item) => (
              <Card key={item.variantId} className="text-[11px] py-2 flex items-center gap-2">
                <Tag minimal intent={outcomeIntent(item.outcome)} className="!text-[9px]">{item.outcome}</Tag>
                <span className="font-medium truncate flex-1">{item.variantName}</span>
                {item.actionType && <Tag minimal className="font-mono !text-[9px]">{item.actionType}</Tag>}
                {item.reason && <span className="text-muted-foreground truncate max-w-[40%]">{item.reason}</span>}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function Metric({ label, value, intent }: { label: string; value: number; intent?: Intent }) {
  const color =
    intent === Intent.SUCCESS ? 'text-emerald-600 dark:text-emerald-400' :
    intent === Intent.WARNING ? 'text-amber-600 dark:text-amber-400' : ''
  return (
    <div className="bg-background px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-0.5">{label}</p>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

function fmtVal(v: unknown): string {
  if (v == null) return '∅'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function statusIntent(status: string): Intent {
  switch (status) {
    case 'draft':    return Intent.WARNING
    case 'promoted': return Intent.SUCCESS
    case 'archived': return Intent.NONE
    default:         return Intent.NONE
  }
}

function outcomeIntent(outcome: string): Intent {
  switch (outcome) {
    case 'auto-executed': return Intent.SUCCESS
    case 'queued':        return Intent.WARNING
    case 'error':         return Intent.DANGER
    default:              return Intent.NONE
  }
}
