// Phase G1 — eval pass-rate strip for one agent. Reads model_eval_runs via
// useRecentEvalRuns; the autoPersistReporter populates these from CI when
// EVAL_PERSIST_URL + EVAL_PERSIST_TOKEN are set. Empty state explains the
// pipeline so the operator knows CI isn't reporting (not that evals haven't
// run).

import { Callout, Card, Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { useRecentEvalRuns, type EvalRunRow } from './hooks'

export function EvalRunStrip({ objectiveName }: { objectiveName: string }) {
  const { data: runs = [], isLoading, isError, error } = useRecentEvalRuns(objectiveName, 25)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
        <Spinner size={SpinnerSize.SMALL} />Loading eval history…
      </div>
    )
  }
  if (isError) {
    return <Callout intent={Intent.WARNING} icon="warning-sign">{error.message}</Callout>
  }
  if (runs.length === 0) {
    return (
      <Callout intent={Intent.NONE} icon="info-sign" title="No eval runs recorded">
        CI posts here via the <code>eval-record</code> edge function when{' '}
        <code>EVAL_PERSIST_URL</code> + <code>EVAL_PERSIST_TOKEN</code> env vars are set on the
        GitHub Action. Run <code>pnpm --filter @beacon/reality-graph test</code> locally to see
        results in the terminal in the meantime.
      </Callout>
    )
  }

  const latest = runs[0]
  const sparkValues = runs.slice(0, 12).reverse().map((r) => r.value)
  const versions = new Set(runs.map((r) => r.adapter_version))

  return (
    <div className="space-y-3">
      <Card className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest</span>
          <span className={`text-lg font-semibold tabular-nums ${passRateColor(latest.value)}`}>
            {Math.round(latest.value * 100)}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Cases</span>
          <span className="text-sm font-semibold tabular-nums">{latest.case_count}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Version</span>
          <Tag minimal className="font-mono">@ {latest.adapter_version}</Tag>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Versions seen</span>
          <span className="text-sm font-semibold tabular-nums">{versions.size}</span>
        </div>
        <Sparkline values={sparkValues} />
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(latest.run_at), { addSuffix: true })}
        </span>
      </Card>

      <div className="space-y-1">
        {runs.slice(0, 10).map((row) => <RunRow key={row.id} row={row} />)}
      </div>
    </div>
  )
}

function RunRow({ row }: { row: EvalRunRow }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded border border-border/40 text-[11px]">
      <Icon icon="confirm" size={11} className="text-muted-foreground" />
      <Tag minimal className="font-mono text-[10px]">@ {row.adapter_version}</Tag>
      <Tag minimal intent={passRateIntent(row.value)} className="tabular-nums">
        {Math.round(row.value * 100)}%
      </Tag>
      <span className="text-muted-foreground">{row.case_count} cases</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground truncate">{row.subset}</span>
      <span className="flex-1" />
      <span className="text-muted-foreground shrink-0">
        {formatDistanceToNow(new Date(row.run_at), { addSuffix: true })}
      </span>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null
  const w = 120
  const h = 22
  const max = 1
  const min = Math.min(0.6, ...values, 0)
  const range = Math.max(max - min, 0.01)
  const step = values.length > 1 ? w / (values.length - 1) : 0
  const pts = values.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="text-[var(--bp6-intent-primary)]" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth={1.5} points={pts} />
    </svg>
  )
}

function passRateColor(rate: number): string {
  if (rate >= 0.85) return 'text-emerald-600 dark:text-emerald-400'
  if (rate >= 0.7)  return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function passRateIntent(rate: number): Intent {
  if (rate >= 0.85) return Intent.SUCCESS
  if (rate >= 0.7)  return Intent.WARNING
  return Intent.DANGER
}
