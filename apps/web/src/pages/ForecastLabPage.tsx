// Forecast Lab — the bench for the consumption_forecast objective. Backtests
// every candidate adapter against the held-out last 7 days (overall + by eval
// cohort), shows per-variant predicted-vs-actual, runs any adapter live, and
// releases the winner in place: the backtest that proved it becomes the eval
// row on the release. Seeing which model wins and shipping it is one surface.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button, Card, HTMLSelect, Icon, Intent, NonIdealState, NumericInput, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { FORECAST_ADAPTERS, HOLDOUT_DAYS, useForecastLab } from '@/features/forecastLab/hooks'
import { useReleases, useReleaseBacktestWinner } from '@/features/modelingObjectives/hooks'
import { CONSUMPTION_FORECAST_OBJECTIVE_NAME } from '@/features/modelingObjectives/registry'
import type { ReleaseStage } from '@/features/modelingObjectives/api'

const pct = (x: number) => `${String(Math.round(x * 100))}%`
const signed = (x: number) => `${x >= 0 ? '+' : ''}${String(Math.round(x * 100))}%`

function mapeIntent(mape: number): Intent {
  return mape <= 0.15 ? Intent.SUCCESS : mape <= 0.35 ? Intent.WARNING : Intent.DANGER
}

interface LiveOut { adapter: string; projectedUnits: number; confidence: number }

export default function ForecastLabPage() {
  const { data, isLoading, isError, error } = useForecastLab()
  const releases = useReleases(CONSUMPTION_FORECAST_OBJECTIVE_NAME)
  const release  = useReleaseBacktestWinner(CONSUMPTION_FORECAST_OBJECTIVE_NAME)
  const [lrVariant, setLrVariant] = useState('')
  const [lrHorizon, setLrHorizon] = useState(7)
  const [lrOut, setLrOut] = useState<LiveOut[] | null>(null)
  const [lrBusy, setLrBusy] = useState(false)

  const result = data?.result
  const cases = data?.cases ?? []
  const scored = useMemo(() => (result?.scores ?? []).filter((s) => s.cases > 0), [result])
  const cohorts = useMemo(
    () => [...new Set(scored.flatMap((s) => s.byCohort.map((c) => c.cohort)))].sort(),
    [scored],
  )

  // Per-variant: actual + each adapter's prediction, worst error first.
  const perVariant = useMemo(() => {
    const preds = (result?.predictions ?? []).filter((p) => p.scored)
    const byVariant = new Map<string, { label: string; actual: number; preds: Record<string, { predicted: number; ape: number }> }>()
    for (const p of preds) {
      const row = byVariant.get(p.variantId) ?? { label: p.label, actual: p.actual, preds: {} }
      row.preds[p.adapter] = { predicted: p.predicted, ape: p.ape }
      byVariant.set(p.variantId, row)
    }
    return [...byVariant.values()].sort((a, b) =>
      Math.max(...Object.values(b.preds).map((x) => x.ape), 0) - Math.max(...Object.values(a.preds).map((x) => x.ape), 0))
  }, [result])

  const runLive = () => {
    const c = cases.find((x) => x.variantId === lrVariant)
    if (!c) return
    setLrBusy(true); setLrOut(null)
    void Promise.all(FORECAST_ADAPTERS.map(async (a) => {
      const out = await a.runInference({ logs: c.logs, horizonDays: lrHorizon })
      return { adapter: a.name, projectedUnits: out.projectedUnits, confidence: out.confidence }
    })).then((outs) => { setLrOut(outs) }).finally(() => { setLrBusy(false) })
  }

  if (isLoading) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Backtesting adapters…</div>
  if (isError) return <div className="p-8 text-sm text-red-500">{error.message}</div>
  if (!result || scored.length === 0) {
    return <NonIdealState icon="lab-test" title="Not enough history to backtest"
      description={`Each variant needs >${String(HOLDOUT_DAYS)}d of training data plus consumption in the held-out last ${String(HOLDOUT_DAYS)} days.`} />
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-5">
        <header>
          <h1 className="text-xl font-semibold">Forecast Lab</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Backtest of the <code>consumption_forecast</code> adapters — held out the last {HOLDOUT_DAYS} days, predicted from the prior window, scored vs actual. Lower MAPE wins.
          </p>
        </header>

        {/* ── Adapter comparison ── */}
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Icon icon="comparison" size={14} /> Adapters</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-widest text-muted-foreground text-left">
              <th className="font-bold pb-1">Adapter</th><th className="font-bold pb-1 tabular-nums">Cases</th>
              <th className="font-bold pb-1 tabular-nums">MAPE</th><th className="font-bold pb-1 tabular-nums">Bias</th>
              <th className="font-bold pb-1">Stage</th><th className="font-bold pb-1 text-right">Release</th>
            </tr></thead>
            <tbody>
              {scored.sort((a, b) => a.mape - b.mape).map((s) => {
                const adapter = FORECAST_ADAPTERS.find((a) => a.name === s.adapter)
                const stage = (releases.data ?? []).find(
                  (r) => r.adapter_name === s.adapter && r.adapter_version === adapter?.version,
                )?.stage
                return (
                  <tr key={s.adapter} className="border-t border-border/50">
                    <td className="py-1.5 font-mono text-xs">
                      {s.adapter}
                      {result.winner === s.adapter && <Tag intent={Intent.SUCCESS} icon="endorsed" className="!text-[10px] ml-1.5">winner</Tag>}
                    </td>
                    <td className="tabular-nums text-muted-foreground">{s.cases}</td>
                    <td className="tabular-nums"><Tag minimal intent={mapeIntent(s.mape)}>{pct(s.mape)}</Tag></td>
                    <td className="tabular-nums text-muted-foreground">{signed(s.bias)}</td>
                    <td>{stage ? <Tag minimal intent={stage === 'production' ? Intent.SUCCESS : Intent.NONE} className="!text-[10px]">{stage}</Tag> : <span className="text-muted-foreground text-xs">—</span>}</td>
                    <td className="text-right">
                      {adapter && (
                        <HTMLSelect
                          value=""
                          disabled={release.isPending}
                          onChange={(e) => {
                            const next = e.currentTarget.value as ReleaseStage | ''
                            if (!next) return
                            release.mutate({
                              adapterName: s.adapter, adapterVersion: adapter.version, stage: next,
                              mape: s.mape, cases: s.cases, holdoutDays: HOLDOUT_DAYS,
                            })
                          }}
                          options={[
                            { value: '', label: stage ? 'Re-release…' : 'Release…' },
                            { value: 'sandbox', label: '→ sandbox' },
                            { value: 'staging', label: '→ staging' },
                            // Production requires this adapter to be the current
                            // staging release — the server enforces it, so don't
                            // offer a click that can only fail.
                            ...(stage === 'staging' ? [{ value: 'production', label: '→ production' }] : []),
                          ]}
                          minimal
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground">
            Bias is signed: negative = systematic under-forecast. Releasing from here records this backtest as
            the eval that justifies it, then cuts the release. Production is offered once an adapter is the
            current staging release — stage it, watch it, then promote; that flips the tool's basis and callers
            don't change. Deployments live in <Link to="/mind?aip=objectives" className="text-primary hover:underline">Modeling Objectives</Link>.
          </p>
        </Card>

        {/* ── By cohort (eval subsets) ── */}
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Icon icon="grouped-bar-chart" size={14} /> By cohort</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-widest text-muted-foreground text-left">
              <th className="font-bold pb-1">Cohort</th>
              {scored.map((s) => <th key={s.adapter} className="font-bold pb-1 tabular-nums">{s.adapter.replace(/-/g, ' ')}</th>)}
            </tr></thead>
            <tbody>
              {cohorts.map((co) => (
                <tr key={co} className="border-t border-border/50">
                  <td className="py-1.5">{co}</td>
                  {scored.map((s) => {
                    const cs = s.byCohort.find((c) => c.cohort === co)
                    return <td key={s.adapter} className="tabular-nums">{cs ? <Tag minimal intent={mapeIntent(cs.mape)}>{pct(cs.mape)} <span className="opacity-60">({cs.cases})</span></Tag> : '—'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground">A cohort where the overall winner loses is a signal to keep both adapters or split the objective.</p>
        </Card>

        {/* ── Per-variant predicted vs actual ── */}
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Icon icon="th" size={14} /> Per-variant (worst error first)</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-widest text-muted-foreground text-left">
              <th className="font-bold pb-1">Variant</th><th className="font-bold pb-1 tabular-nums">Actual {HOLDOUT_DAYS}d</th>
              {scored.map((s) => <th key={s.adapter} className="font-bold pb-1 tabular-nums">{s.adapter.replace(/-/g, ' ')}</th>)}
            </tr></thead>
            <tbody>
              {perVariant.map((v) => (
                <tr key={v.label} className="border-t border-border/50">
                  <td className="py-1.5">{v.label}</td>
                  <td className="tabular-nums text-muted-foreground">{v.actual}</td>
                  {scored.map((s) => {
                    const p = v.preds[s.adapter]
                    return <td key={s.adapter} className="tabular-nums">{p.predicted} <span className={mapeIntent(p.ape) === Intent.DANGER ? 'text-red-500' : 'text-muted-foreground'}>({pct(p.ape)})</span></td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* ── Live runner ── */}
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Icon icon="play" size={14} /> Run a forecast</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Variant</span>
              <HTMLSelect value={lrVariant} onChange={(e) => { setLrVariant(e.currentTarget.value); setLrOut(null) }}
                options={[{ value: '', label: 'Select…' }, ...cases.map((c) => ({ value: c.variantId, label: c.label }))]} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Horizon (days)</span>
              <NumericInput value={lrHorizon} min={1} max={90} stepSize={1} style={{ width: 80 }}
                onValueChange={(v) => { if (!Number.isNaN(v)) setLrHorizon(Math.max(1, Math.min(90, Math.round(v)))) }} />
            </label>
            <Button text="Run" icon="play" intent={Intent.PRIMARY} disabled={!lrVariant || lrBusy} loading={lrBusy} onClick={runLive} />
          </div>
          {lrOut && (
            <div className="flex flex-wrap gap-3 pt-1">
              {lrOut.map((o) => (
                <div key={o.adapter} className="rounded border border-border px-3 py-2 text-xs">
                  <div className="font-mono text-[11px] text-muted-foreground">{o.adapter}</div>
                  <div className="text-lg font-semibold tabular-nums">{o.projectedUnits} <span className="text-xs font-normal text-muted-foreground">units / {lrHorizon}d</span></div>
                  <div className="text-[11px] text-muted-foreground">confidence {pct(o.confidence)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
