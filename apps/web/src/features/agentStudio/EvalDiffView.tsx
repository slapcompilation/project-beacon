// Phase G2 — side-by-side comparison of two adapter_versions for one agent.
// Reads from model_eval_runs; lets the operator answer "did v1.1 improve over
// v1.0?" without leaving the Agent Detail page. Per-suite diff (per-case is
// G3 — requires the reporter to emit per-test rows).

import { useState, useMemo, useEffect } from 'react'
import { Callout, Card, HTMLSelect, Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { useEvalRunVersions, useLatestEvalRun, type EvalRunRow } from './hooks'

export function EvalDiffView({ objectiveName }: { objectiveName: string }) {
  const { data: versions = [], isLoading } = useEvalRunVersions(objectiveName)
  const [aVer, setAVer] = useState<string>('')
  const [bVer, setBVer] = useState<string>('')

  // First load: A = newest, B = second-newest (when present).
  useEffect(() => {
    if (versions.length === 0) return
    if (!aVer) setAVer(versions[0])
    if (!bVer && versions.length > 1) setBVer(versions[1])
    else if (!bVer) setBVer(versions[0])
  }, [versions, aVer, bVer])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
        <Spinner size={SpinnerSize.SMALL} />Loading versions…
      </div>
    )
  }
  if (versions.length === 0) {
    return (
      <Callout intent={Intent.NONE} icon="info-sign">
        No eval runs recorded yet. Once CI posts at least two suites for two different versions, the diff view lights up.
      </Callout>
    )
  }
  if (versions.length === 1) {
    return (
      <Callout intent={Intent.NONE} icon="info-sign">
        Only one version (<code>@ {versions[0]}</code>) has eval runs so far. The diff view activates after a second version's suite runs in CI.
      </Callout>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <VersionPicker label="A (baseline)" value={aVer} onChange={setAVer} options={versions} />
        <Icon icon="arrow-right" size={12} className="text-muted-foreground" />
        <VersionPicker label="B (candidate)" value={bVer} onChange={setBVer} options={versions} />
      </div>
      {aVer && bVer && <DiffCard objectiveName={objectiveName} aVer={aVer} bVer={bVer} />}
    </div>
  )
}

function VersionPicker({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span>{label}</span>
      <HTMLSelect value={value} onChange={(e) => { onChange(e.currentTarget.value) }} className="text-xs">
        {options.map((v) => <option key={v} value={v}>@ {v}</option>)}
      </HTMLSelect>
    </label>
  )
}

function DiffCard({ objectiveName, aVer, bVer }: { objectiveName: string; aVer: string; bVer: string }) {
  const a = useLatestEvalRun(objectiveName, aVer)
  const b = useLatestEvalRun(objectiveName, bVer)

  const sameVersion = aVer === bVer
  const delta = useMemo(() => {
    if (!a.data || !b.data) return null
    return b.data.value - a.data.value
  }, [a.data, b.data])

  if (a.isLoading || b.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
        <Spinner size={SpinnerSize.SMALL} />Loading runs…
      </div>
    )
  }

  return (
    <Card className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
      <RunPane label="A" version={aVer} run={a.data} />
      <DeltaPane delta={delta} sameVersion={sameVersion} />
      <RunPane label="B" version={bVer} run={b.data} />
    </Card>
  )
}

function RunPane({ label, version, run }: { label: string; version: string; run: EvalRunRow | null | undefined }) {
  return (
    <div className="flex flex-col gap-1.5 p-3 border border-border/40 rounded">
      <div className="flex items-center gap-2">
        <Tag minimal>{label}</Tag>
        <Tag minimal className="font-mono text-[10px]">@ {version}</Tag>
      </div>
      {run ? (
        <>
          <span className={`text-2xl font-semibold tabular-nums ${passRateColor(run.value)}`}>
            {Math.round(run.value * 100)}%
          </span>
          <span className="text-[11px] text-muted-foreground">{run.case_count} cases · {run.subset}</span>
        </>
      ) : (
        <span className="text-xs italic text-muted-foreground">no recorded run</span>
      )}
    </div>
  )
}

function DeltaPane({ delta, sameVersion }: { delta: number | null; sameVersion: boolean }) {
  if (sameVersion) {
    return (
      <div className="flex items-center justify-center text-[11px] text-muted-foreground italic">
        Pick two different versions
      </div>
    )
  }
  if (delta == null) {
    return (
      <div className="flex items-center justify-center text-[11px] text-muted-foreground italic">
        Missing run on one side
      </div>
    )
  }
  const pct = Math.round(delta * 100)
  const color =
    delta > 0.0001 ? 'text-emerald-600 dark:text-emerald-400' :
    delta < -0.0001 ? 'text-red-600 dark:text-red-400' :
    'text-muted-foreground'
  const arrow = delta > 0.0001 ? 'arrow-up' : delta < -0.0001 ? 'arrow-down' : 'minus'
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Delta</span>
      <div className={`flex items-center gap-1 text-xl font-semibold tabular-nums ${color}`}>
        <Icon icon={arrow} size={14} />
        <span>{pct >= 0 ? '+' : ''}{pct} pts</span>
      </div>
    </div>
  )
}

function passRateColor(rate: number): string {
  if (rate >= 0.85) return 'text-emerald-600 dark:text-emerald-400'
  if (rate >= 0.7)  return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}
