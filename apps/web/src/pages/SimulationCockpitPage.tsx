// Layer: Mind → Eye cross-layer
// Palantir principle: operators must be able to stress-test reality before committing.
//
// SimulationCockpitPage lets operators model four types of supply-chain shocks and
// immediately see how the outcome changes across all tracked variants:
//
//   1. Scenario selector — choose the stress event type
//   2. Parameter lever   — magnitude slider + precise numeric input
//   3. Impact summary    — baseline vs projected at-risk / critical counts
//   4. Variant table     — per-variant before/after with probability delta + action tag
//   5. Apply action      — one-click navigate to restock queue for flagged variants

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FlaskConical, TrendingUp, Truck, Trash2, BarChart3,
  Play, ChevronRight, AlertTriangle, ArrowDown, ArrowUp, Minus,
  ShieldAlert, Package2, Loader2, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSimulation } from '@/features/eye/hooks'
import type { SimulationScenarioType, SimulationVariantRow } from '@beacon/types'

// ─── Scenario definitions ─────────────────────────────────────────────────────

interface ScenarioDef {
  type:        SimulationScenarioType
  label:       string
  description: string
  icon:        React.ElementType
  color:       string
  bg:          string
  paramLabel:  string
  paramUnit:   string
  paramMin:    number
  paramMax:    number
  paramStep:   number
  paramDefault: number
  paramTip:    string
}

const SCENARIOS: ScenarioDef[] = [
  {
    type:         'demand_shock',
    label:        'Demand Shock',
    description:  'Consumption rises or falls — event, season, or rate change',
    icon:         TrendingUp,
    color:        'text-orange-600 dark:text-orange-400',
    bg:           'bg-orange-50 dark:bg-orange-950/30',
    paramLabel:   'Demand change',
    paramUnit:    '%',
    paramMin:     -50,
    paramMax:     200,
    paramStep:    5,
    paramDefault: 30,
    paramTip:     '+30% means 30% more daily consumption than the 30-day average',
  },
  {
    type:         'supplier_delay',
    label:        'Supplier Delay',
    description:  'Incoming supply arrives later than expected',
    icon:         Truck,
    color:        'text-blue-600 dark:text-blue-400',
    bg:           'bg-blue-50 dark:bg-blue-950/30',
    paramLabel:   'Delay duration',
    paramUnit:    'days',
    paramMin:     1,
    paramMax:     60,
    paramStep:    1,
    paramDefault: 7,
    paramTip:     'Applies to variants with open restock requests — stock is debited by delay × daily consumption',
  },
  {
    type:         'writeoff_spike',
    label:        'Write-off Spike',
    description:  'Breakage, spoilage, or theft rises above normal rate',
    icon:         Trash2,
    color:        'text-red-600 dark:text-red-400',
    bg:           'bg-red-50 dark:bg-red-950/30',
    paramLabel:   'Spike above baseline',
    paramUnit:    '%',
    paramMin:     10,
    paramMax:     300,
    paramStep:    10,
    paramDefault: 50,
    paramTip:     '+50% write-off spike increases effective depletion rate; waste modelled as ~35% of total removals',
  },
  {
    type:         'par_change',
    label:        'PAR Change',
    description:  'Adjust PAR levels — see the order quantity impact',
    icon:         BarChart3,
    color:        'text-violet-600 dark:text-violet-400',
    bg:           'bg-violet-50 dark:bg-violet-950/30',
    paramLabel:   'New PAR as % of current',
    paramUnit:    '%',
    paramMin:     50,
    paramMax:     300,
    paramStep:    10,
    paramDefault: 150,
    paramTip:     '150% means raise all PAR levels by 50%; shows the incremental units that must be ordered',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deltaColor(delta: number, invert = false): string {
  const worse = invert ? delta < 0 : delta > 0
  const better = invert ? delta > 0 : delta < 0
  if (worse)  return 'text-red-600 dark:text-red-400'
  if (better) return 'text-green-600 dark:text-green-400'
  return 'text-muted-foreground'
}

function DeltaIcon({ delta, invert = false }: { delta: number; invert?: boolean }) {
  const worse = invert ? delta < 0 : delta > 0
  const better = invert ? delta > 0 : delta < 0
  if (worse)  return <ArrowUp   className="h-3 w-3 shrink-0" />
  if (better) return <ArrowDown className="h-3 w-3 shrink-0" />
  return <Minus className="h-3 w-3 shrink-0" />
}

function probColor(prob: number): string {
  if (prob >= 70) return 'text-red-600 dark:text-red-400'
  if (prob >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-green-600 dark:text-green-400'
}

function actionBadge(action: SimulationVariantRow['recommended_action']) {
  if (action === 'request_restock')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
        <ShieldAlert className="h-2.5 w-2.5" />
        Restock
      </span>
    )
  if (action === 'monitor')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
        <AlertTriangle className="h-2.5 w-2.5" />
        Monitor
      </span>
    )
  return null
}

// ─── Scenario card ────────────────────────────────────────────────────────────

function ScenarioCard({
  def,
  selected,
  onSelect,
}: {
  def:      ScenarioDef
  selected: boolean
  onSelect: () => void
}) {
  const Icon = def.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border text-left transition-all w-full',
        selected
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border hover:border-border/80 hover:bg-muted/30',
      )}
    >
      <span className={cn('mt-0.5 h-8 w-8 rounded-md flex items-center justify-center shrink-0', def.bg)}>
        <Icon className={cn('h-4 w-4', def.color)} />
      </span>
      <div className="min-w-0">
        <p className={cn('text-sm font-semibold leading-tight', selected && 'text-primary')}>
          {def.label}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
          {def.description}
        </p>
      </div>
      {selected && <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-1 ml-auto" />}
    </button>
  )
}

// ─── Parameter lever ──────────────────────────────────────────────────────────

function ParameterLever({
  def,
  value,
  onChange,
}: {
  def:      ScenarioDef
  value:    number
  onChange: (v: number) => void
}) {
  const displayValue = def.paramUnit === '%' && value >= 0 ? `+${value}` : `${value}`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {def.paramLabel}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            min={def.paramMin}
            max={def.paramMax}
            step={def.paramStep}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!isNaN(v)) onChange(Math.min(def.paramMax, Math.max(def.paramMin, v)))
            }}
            className="w-20 h-7 text-right text-sm font-bold tabular-nums rounded-md border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-sm font-semibold text-muted-foreground w-8">{def.paramUnit}</span>
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={def.paramMin}
        max={def.paramMax}
        step={def.paramStep}
        value={value}
        onChange={(e) => { onChange(Number(e.target.value)); }}
        className="w-full accent-primary"
      />

      {/* Range labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{def.paramMin}{def.paramUnit}</span>
        <span className="font-semibold text-foreground">{displayValue}{def.paramUnit}</span>
        <span>{def.paramMax}{def.paramUnit}</span>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded-md px-2.5 py-2">
        <Info className="h-3 w-3 shrink-0 mt-0.5" />
        <span>{def.paramTip}</span>
      </div>
    </div>
  )
}

// ─── Impact summary strip ─────────────────────────────────────────────────────

function ImpactSummary({
  baseline,
  projected,
  confidence,
  paramLabel,
}: {
  baseline:   { variants_at_risk: number; critical_in_7d: number }
  projected:  { variants_at_risk: number; critical_in_7d: number; restock_needed: number }
  confidence: number
  paramLabel: string
}) {
  const atRiskDelta   = projected.variants_at_risk - baseline.variants_at_risk
  const criticalDelta = projected.critical_in_7d   - baseline.critical_in_7d

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Projected impact · <span className="text-foreground">{paramLabel}</span>
        </p>
        <span className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
          confidence >= 0.7
            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
            : confidence >= 0.4
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
            : 'bg-muted text-muted-foreground',
        )}>
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Variants at risk */}
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">At risk</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums">{projected.variants_at_risk}</span>
            <span className={cn(
              'flex items-center gap-0.5 text-xs font-semibold',
              deltaColor(atRiskDelta, false),
            )}>
              <DeltaIcon delta={atRiskDelta} invert={false} />
              {atRiskDelta > 0 ? '+' : ''}{atRiskDelta}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">was {baseline.variants_at_risk}</p>
        </div>

        {/* Critical in 7d */}
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Critical 7d</p>
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              'text-lg font-bold tabular-nums',
              projected.critical_in_7d > 0 ? 'text-red-600 dark:text-red-400' : '',
            )}>
              {projected.critical_in_7d}
            </span>
            <span className={cn(
              'flex items-center gap-0.5 text-xs font-semibold',
              deltaColor(criticalDelta, false),
            )}>
              <DeltaIcon delta={criticalDelta} invert={false} />
              {criticalDelta > 0 ? '+' : ''}{criticalDelta}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">was {baseline.critical_in_7d}</p>
        </div>

        {/* Restock actions */}
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Restocks needed</p>
          <span className={cn(
            'text-lg font-bold tabular-nums',
            projected.restock_needed > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
          )}>
            {projected.restock_needed}
          </span>
          <p className="text-[10px] text-muted-foreground">immediate action</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Model confidence</span>
          <span>{Math.round(confidence * 100)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              confidence >= 0.7 ? 'bg-green-500' : confidence >= 0.4 ? 'bg-amber-500' : 'bg-muted-foreground/50',
            )}
            style={{ width: `${Math.round(confidence * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Based on 30-day consumption baseline · normal distribution model ·
          confidence rises with active data days (full at ≥14 days)
        </p>
      </div>
    </div>
  )
}

// ─── Variant impact table ─────────────────────────────────────────────────────

function SimVariantRow({ row }: { row: SimulationVariantRow }) {
  const probWorse = row.delta_prob_7d > 5
  const daysWorse = row.delta_days < -1

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0 text-xs',
      (row.recommended_action === 'request_restock') && 'bg-red-50/20 dark:bg-red-950/5',
    )}>
      {/* Product + SKU */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="font-semibold text-sm truncate">{row.product_name}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{row.sku}</p>
      </div>

      {/* Days until zero: before → after */}
      <div className="text-center w-28 shrink-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Days left</p>
        <div className="flex items-center justify-center gap-1">
          <span className="tabular-nums font-medium text-muted-foreground">
            {row.baseline_days_zero >= 999 ? '∞' : row.baseline_days_zero.toFixed(0)}d
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <span className={cn(
            'tabular-nums font-bold',
            daysWorse ? 'text-red-600 dark:text-red-400' : 'text-foreground',
          )}>
            {row.projected_days_zero >= 999 ? '∞' : row.projected_days_zero.toFixed(0)}d
          </span>
          {row.delta_days !== 0 && (
            <span className={cn('flex items-center gap-0.5 text-[10px] font-semibold', deltaColor(row.delta_days, true))}>
              <DeltaIcon delta={row.delta_days} invert={true} />
              {Math.abs(row.delta_days).toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* P(stockout 7d): before → after */}
      <div className="text-center w-36 shrink-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">7d stockout risk</p>
        <div className="flex items-center justify-center gap-1">
          <span className="tabular-nums font-medium text-muted-foreground">
            {row.baseline_prob_7d.toFixed(0)}%
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <span className={cn('tabular-nums font-bold', probColor(row.projected_prob_7d))}>
            {row.projected_prob_7d.toFixed(0)}%
          </span>
          {row.delta_prob_7d !== 0 && (
            <span className={cn('flex items-center gap-0.5 text-[10px] font-semibold', deltaColor(row.delta_prob_7d, false))}>
              <DeltaIcon delta={row.delta_prob_7d} invert={false} />
              {Math.abs(row.delta_prob_7d).toFixed(0)}pp
            </span>
          )}
        </div>
        {/* Mini probability bar */}
        <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full',
              probWorse ? 'bg-red-500' : row.projected_prob_7d >= 40 ? 'bg-amber-500' : 'bg-green-500',
            )}
            style={{ width: `${Math.min(100, row.projected_prob_7d)}%` }}
          />
        </div>
      </div>

      {/* Recommended qty (if any) */}
      {row.recommended_qty > 0 ? (
        <div className="text-center w-20 shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Order</p>
          <div className="flex items-center justify-center gap-1">
            <Package2 className="h-3 w-3 text-muted-foreground" />
            <span className="font-bold tabular-nums">{row.recommended_qty}</span>
          </div>
        </div>
      ) : (
        <div className="w-20 shrink-0" />
      )}

      {/* Action badge */}
      <div className="w-20 shrink-0 flex justify-end">
        {actionBadge(row.recommended_action)}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SimulationCockpitPage() {
  const navigate = useNavigate()

  const [selectedType, setSelectedType] = useState<SimulationScenarioType>('demand_shock')
  const [paramValue,   setParamValue]   = useState(30)
  const [runTrigger,   setRunTrigger]   = useState<number | null>(null)

  const selectedDef = SCENARIOS.find((s) => s.type === selectedType)!

  const { data: result, isLoading, isError } = useSimulation(
    selectedType,
    paramValue,
    runTrigger,
  )

  const handleScenarioChange = useCallback((type: SimulationScenarioType) => {
    const def = SCENARIOS.find((s) => s.type === type)!
    setSelectedType(type)
    setParamValue(def.paramDefault)
    setRunTrigger(null)   // clear results when scenario changes
  }, [])

  const handleRun = useCallback(() => {
    setRunTrigger((prev) => (prev ?? 0) + 1)
  }, [])

  const restockVariants = result?.affected_variants.filter(
    (v) => v.recommended_action === 'request_restock',
  ) ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/30">
            <FlaskConical className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Simulation Cockpit</h1>
            <p className="text-xs text-muted-foreground">
              Mind · Eye Layer · stress-test supply chain scenarios before they happen
            </p>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* Left: scenario controls */}
        <div className="w-80 shrink-0 border-r overflow-y-auto p-5 space-y-5">
          {/* Scenario selector */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Scenario type
            </p>
            {SCENARIOS.map((def) => (
              <ScenarioCard
                key={def.type}
                def={def}
                selected={selectedType === def.type}
                onSelect={() => { handleScenarioChange(def.type) }}
              />
            ))}
          </div>

          {/* Parameter lever */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Parameter
            </p>
            <ParameterLever
              def={selectedDef}
              value={paramValue}
              onChange={(v) => {
                setParamValue(v)
                setRunTrigger(null)  // clear stale results on param change
              }}
            />
          </div>

          {/* Run button */}
          <Button
            className="w-full gap-2"
            onClick={handleRun}
            disabled={isLoading}
          >
            {isLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Play className="h-4 w-4" />
            }
            {isLoading ? 'Running simulation…' : 'Run Simulation'}
          </Button>

          {runTrigger === null && (
            <p className="text-[10px] text-muted-foreground text-center">
              Select a scenario, set the parameter, and click Run to see projected impact.
            </p>
          )}
        </div>

        {/* Right: results */}
        <div className="flex-1 overflow-y-auto">
          {runTrigger === null ? (
            /* Idle state */
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="h-16 w-16 rounded-full bg-violet-50 dark:bg-violet-950/20 flex items-center justify-center">
                <FlaskConical className="h-8 w-8 text-violet-400" />
              </div>
              <div className="max-w-sm">
                <p className="text-sm font-semibold">Ready to simulate</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Choose a scenario on the left, set the magnitude, then click{' '}
                  <strong>Run Simulation</strong> to see how this event would cascade
                  across all tracked variants.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2 text-left max-w-sm w-full">
                {SCENARIOS.map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.type} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                      <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', s.color)} />
                      <div>
                        <p className="text-xs font-medium">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground">{s.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Traversing scenario graph…
            </div>
          ) : isError || !result ? (
            <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="h-4 w-4" />
              Simulation failed — insufficient baseline data
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Impact summary */}
              <ImpactSummary
                baseline={result.baseline_summary}
                projected={result.projected_summary}
                confidence={result.confidence}
                paramLabel={result.param_label}
              />

              {/* Apply action */}
              {restockVariants.length > 0 && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                      {restockVariants.length} variant{restockVariants.length > 1 ? 's' : ''} need immediate restocking
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Under this scenario these variants reach critical risk within 7 days
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="shrink-0 gap-1.5"
                    onClick={() => {
                      navigate('/flow?panel=restock', {
                        state: {
                          simulationVariantIds: restockVariants.map((v) => v.variant_id),
                          simulationScenario:   result.param_label,
                        },
                      })
                    }}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Go to Restock Queue
                  </Button>
                </div>
              )}

              {/* Affected variants table */}
              <div className="rounded-lg border overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Affected variants
                    <span className="ml-2 font-bold text-foreground">
                      {result.affected_variants.length}
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Sorted by projected 7d risk · highest first
                  </p>
                </div>

                {result.affected_variants.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    No variants have sufficient consumption data for this simulation
                  </div>
                ) : (
                  result.affected_variants.map((row) => (
                    <SimVariantRow key={row.variant_id} row={row} />
                  ))
                )}
              </div>

              {/* Footer */}
              <p className="text-[10px] text-muted-foreground pb-2">
                Simulation basis: 30-day zero-padded consumption baseline ·
                Normal distribution P(stockout) via CDF ·
                Scenario adjusts effective mean_daily and/or stock ·
                Confidence = avg data coverage across variants (full at ≥14 active days) ·
                Results are projections, not guarantees
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
