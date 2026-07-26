// Flywheel — "is the system getting better?" A Studio control surface: it composes
// existing signals (decision calibration, the autonomous loop's recent runs, per-agent
// reliability) and lets the operator set loop goals and, when one slips, apply a
// bounded governed remediation. Reuses the calibration + monitor hooks + set_org_policy.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button, Card, HTMLSelect, Icon, Intent, NonIdealState, NumericInput, ProgressBar, Spinner, SpinnerSize, Tag, Tooltip } from '@blueprintjs/core'
import { format, formatDistanceToNow } from 'date-fns'
import { computeCalibration, recommendAutonomy, recommendGoalIntervention, DEFAULT_CALIBRATION_EDIT_PENALTY, LOOP_GOALS, goalProgress, type AutonomyRecommendation, type AgentActionContext, type CalibrationReport, type OrgPolicy } from '@beacon/reality-graph'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useDecisionCalibration, type CalibrationWindow } from '@/features/calibration/hooks'
import { useAgentCycleHistory, useCronHealthSummary } from '@/features/monitor/hooks'
import { useOrgPolicy, useSetOrgPolicy } from '@/features/mind/policy'
import { useCurrentAgentReleases, pickProductionRelease } from '@/features/agentStudio/hooks'
import { AGENT_ACTION } from '@/features/mind/agentActions'

// ── Learning loop (A6): rules taught → vocabulary grown → decisions shaped ──

interface LearningRow { id: string; confidence: number; status: string; decided_at: string | null; edited_before_approval: boolean | null }
interface LearningData {
  principles: { id: string; body: string; active: boolean }[]
  extensionsCount: number
  latestExtension: string | null
  influence: Map<string, number>
  influencedIds: Set<string>
  proposals: LearningRow[]
}

async function fetchLearning(hotelId: string | null): Promise<LearningData> {
  let principlesQ = supabase.from('principles').select('id, body, active').order('created_at', { ascending: false })
  let extensionsQ = supabase.from('ontology_proposals').select('proposed').eq('status', 'approved').order('decided_at', { ascending: false })
  let edgesQ      = supabase.from('relationship_edges').select('source_id, target_id').eq('edge_type', 'influenced_by').eq('target_type', 'principle').limit(5000)
  let proposalsQ  = supabase.from('proposals').select('id, confidence, status, decided_at, edited_before_approval').neq('status', 'pending').limit(5000)
  if (hotelId) {
    principlesQ = principlesQ.eq('hotel_id', hotelId)
    extensionsQ = extensionsQ.eq('hotel_id', hotelId)
    edgesQ      = edgesQ.eq('hotel_id', hotelId)
    proposalsQ  = proposalsQ.eq('hotel_id', hotelId)
  }
  const [principles, extensions, edges, proposals] = await Promise.all([principlesQ, extensionsQ, edgesQ, proposalsQ])
  for (const r of [principles, extensions, edges, proposals]) if (r.error) throw new Error(r.error.message)
  const edgeRows = (edges.data ?? []) as { source_id: string; target_id: string }[]
  const influence = new Map<string, number>()
  for (const e of edgeRows) influence.set(e.target_id, (influence.get(e.target_id) ?? 0) + 1)
  const ext = (extensions.data ?? []) as { proposed: string }[]
  return {
    principles: (principles.data ?? []) as LearningData['principles'],
    extensionsCount: ext.length,
    latestExtension: ext[0]?.proposed ?? null,
    influence,
    influencedIds: new Set(edgeRows.map((e) => e.source_id)),
    proposals: (proposals.data ?? []) as LearningRow[],
  }
}

/** Monthly ECE buckets. Edit penalty applies (honest labels); no half-life
 *  inside a bucket — the bucket IS the time slice. */
function monthlyCalibration(proposals: LearningRow[], months = 6): { label: string; report: CalibrationReport }[] {
  const now = new Date()
  const out: { label: string; report: CalibrationReport }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const slice = proposals.filter((p) => p.decided_at && new Date(p.decided_at) >= start && new Date(p.decided_at) < end)
    out.push({
      label: start.toLocaleString('en', { month: 'short' }),
      report: computeCalibration(
        slice.map((p) => ({ confidence: p.confidence, status: p.status as Parameters<typeof computeCalibration>[0][number]['status'], edited: p.edited_before_approval === true })),
        { minSamples: 5, editPenalty: DEFAULT_CALIBRATION_EDIT_PENALTY },
      ),
    })
  }
  return out
}

const approvalRate = (rows: LearningRow[]) => {
  const scored = rows.filter((p) => p.status === 'approved' || p.status === 'rejected')
  return scored.length === 0 ? null : scored.filter((p) => p.status === 'approved').length / scored.length
}

const VERDICT: Record<string, { label: string; intent: Intent }> = {
  'well-calibrated':   { label: 'Well-calibrated', intent: Intent.SUCCESS },
  'overconfident':     { label: 'Overconfident',   intent: Intent.DANGER },
  'underconfident':    { label: 'Underconfident',  intent: Intent.WARNING },
  'insufficient-data': { label: 'Not enough data', intent: Intent.NONE },
}

// The Flywheel as a control surface: the operator sets what "getting better"
// means (target ECE ceiling, approval-rate floor), stored in org_policy, and the
// page tracks current-vs-target. When a goal slips, it surfaces the single
// bounded tightening lever that addresses it, applied through set_org_policy.
function GoalsSection({ policy, ece, approval, onSave, onApply, saving }: {
  policy: OrgPolicy
  ece: number | null
  approval: number | null
  onSave: (goals: OrgPolicy['goals']) => void
  onApply: (next: OrgPolicy) => void
  saving: boolean
}) {
  const savedEce = Math.round(policy.goals.max_calibration_error * 100)
  const savedApproval = Math.round(policy.goals.min_approval_rate * 100)
  const [maxEce, setMaxEce] = useState(savedEce)
  const [minApproval, setMinApproval] = useState(savedApproval)
  const dirty = maxEce !== savedEce || minApproval !== savedApproval

  const rows = [
    { def: LOOP_GOALS[0], target: maxEce / 100, actual: ece, val: maxEce, set: setMaxEce },
    { def: LOOP_GOALS[1], target: minApproval / 100, actual: approval, val: minApproval, set: setMinApproval },
  ]

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Icon icon="flag" size={14} /> Goals</h2>
        <Button size="small" intent={Intent.PRIMARY} icon="floppy-disk" disabled={!dirty} loading={saving}
          onClick={() => { onSave({ max_calibration_error: maxEce / 100, min_approval_rate: minApproval / 100 }) }}>
          Save goals
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">Set what "getting better" means for the loop, and track against it.</p>
      <div className="space-y-3">
        {rows.map(({ def, target, actual, val, set }) => {
          const { met, pct } = goalProgress(target, actual, def.lowerIsBetter)
          const actualPct = actual === null ? null : Math.round(actual * 100)
          const rec = met ? null : recommendGoalIntervention(def.key, actual, policy)
          return (
            <div key={def.key} className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium w-48 shrink-0">{def.label}</span>
                <span className="text-muted-foreground">{def.lowerIsBetter ? 'target ≤' : 'target ≥'}</span>
                <NumericInput value={val} min={0} max={100} stepSize={1} style={{ width: 70 }} buttonPosition="none"
                  onValueChange={(v) => { set(Math.round(Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0)))) }} />
                <span className="text-muted-foreground">%</span>
                <span className="ml-auto tabular-nums">
                  {actualPct === null ? <span className="text-muted-foreground">no data</span> : (
                    <><span className={met ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>{actualPct}%</span> now</>
                  )}
                </span>
                {actualPct !== null && <Tag minimal intent={met ? Intent.SUCCESS : Intent.WARNING} className="!text-[10px]">{met ? 'on track' : 'off target'}</Tag>}
              </div>
              <ProgressBar value={pct / 100} intent={met ? Intent.SUCCESS : Intent.PRIMARY} stripes={false} />
              {rec && (
                <div className="flex items-start gap-2 rounded border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 px-2 py-1.5">
                  <Icon icon="lightbulb" size={12} className="mt-0.5 text-amber-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{rec.title}</div>
                    <div className="text-[11px] text-muted-foreground">{rec.rationale}</div>
                  </div>
                  <Button size="small" intent={Intent.WARNING} loading={saving}
                    onClick={() => { onApply(rec.next) }} className="shrink-0">
                    {rec.applyLabel}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

export default function FlywheelPage() {
  const [windowDays, setWindowDays] = useState<CalibrationWindow>(90)
  const { calibration, isLoading: calLoading } = useDecisionCalibration(windowDays)
  const cycles = useAgentCycleHistory(8)
  const cron   = useCronHealthSummary()
  const hotelId = useActiveHotelId()
  const learning = useQuery({ queryKey: ['flywheel-learning', hotelId], queryFn: () => fetchLearning(hotelId), staleTime: 60_000 })

  const { data: policyData } = useOrgPolicy()
  const setPolicy = useSetOrgPolicy()
  const releases = useCurrentAgentReleases()
  const [applying, setApplying] = useState<string | null>(null)

  const overall = calibration?.overall
  const verdict = overall ? (VERDICT[overall.verdict] ?? VERDICT['insufficient-data']) : null
  const runs    = cycles.data?.runs ?? []
  const openCritical = cron.data?.open_critical ?? 0

  // Calibration → policy: observed reliability proposes per-agent floor edits.
  // Recommendations only; applying one is the human sign-off (set_org_policy is
  // admin/owner, and records who/when — autonomy is earned AND audited).
  const recs = useMemo(() => {
    if (!calibration) return []
    const ae = policyData?.merged.auto_execution
    const overrides = ae?.agent_overrides ?? {}
    const thresholds = (ae?.thresholds ?? {}) as Record<string, number | undefined>
    // Earned-trust context: action type, whether it's enabled, and production
    // release. Unlocks 'enable' recs for a proven agent whose type is queue-only.
    const ctx: Record<string, AgentActionContext> = {}
    for (const slice of calibration.byAgent) {
      const actionType = AGENT_ACTION[slice.key]
      if (!actionType) continue
      ctx[slice.key] = {
        actionType,
        enabled: thresholds[actionType] != null,
        hasProductionRelease: !!pickProductionRelease(releases.data ?? [], slice.key),
      }
    }
    return recommendAutonomy(calibration.byAgent, overrides, {}, ctx)
  }, [calibration, policyData, releases.data])

  const applyRec = (rec: AutonomyRecommendation) => {
    if (!policyData) return
    setApplying(rec.agentName)
    const p = policyData.merged
    const ae = { ...p.auto_execution }
    if (rec.kind === 'enable' && rec.actionType) {
      ae.thresholds = { ...ae.thresholds, [rec.actionType]: rec.proposedFloor }
    } else {
      ae.agent_overrides = { ...ae.agent_overrides, [rec.agentName]: rec.proposedFloor }
    }
    setPolicy.mutate({ ...p, auto_execution: ae }, { onSettled: () => { setApplying(null) } })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Flywheel</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Is the system getting better? Decision calibration, the autonomous loop, and per-agent reliability.
            </p>
          </div>
          <HTMLSelect
            value={windowDays}
            onChange={(e) => { setWindowDays(Number(e.currentTarget.value) as CalibrationWindow) }}
            options={[
              { value: 30, label: 'Last 30 days' },
              { value: 90, label: 'Last 90 days' },
              { value: 0,  label: 'All time' },
            ]}
          />
        </header>

        {/* ── Goals — set what "getting better" means, track against it ── */}
        {policyData && (
          <GoalsSection
            policy={policyData.merged}
            onApply={(next) => { setPolicy.mutate(next) }}
            ece={overall?.ece ?? null}
            approval={learning.data ? approvalRate(learning.data.proposals) : null}
            saving={setPolicy.isPending}
            onSave={(goals) => { setPolicy.mutate({ ...policyData.merged, goals }) }}
          />
        )}

        {/* ── Decision calibration ── */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Icon icon="timeline-line-chart" size={14} /> Decision calibration
            </h2>
            <Link to="/mind?aip=calibration" className="text-xs text-primary hover:underline">Full calibration →</Link>
          </div>
          {calLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Loading…</div>
          ) : !overall || !overall.sufficientData ? (
            <p className="text-xs text-muted-foreground">
              Not enough resolved decisions yet{overall ? ` (${String(overall.resolved)} scored)` : ''} — calibration sharpens as operators approve/reject more proposals.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-8">
              {verdict && <Tag size="large" intent={verdict.intent} minimal>{verdict.label}</Tag>}
              <Metric label="Decisions scored" value={String(overall.resolved)} />
              <Metric label="Calibration error (ECE)" value={`${String(Math.round(overall.ece * 100))}%`} sub="lower is better" />
              <Metric label="Brier" value={overall.brier.toFixed(3)} sub="lower is better" />
              <Metric label="Claimed vs actual" value={`${String(Math.round(overall.meanConfidence * 100))}% / ${String(Math.round(overall.accuracy * 100))}%`} sub="mean confidence / hit rate" />
            </div>
          )}
          {learning.data && (
            <div className="pt-2 border-t border-border/40">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Calibration error by month <span className="font-normal normal-case tracking-normal text-muted-foreground/70">— lower is better, honest labels</span>
              </div>
              <div className="flex items-end gap-3 h-24">
                {monthlyCalibration(learning.data.proposals).map(({ label, report }) => {
                  const thin = report.verdict === 'insufficient-data'
                  const h = thin ? 4 : Math.min(64, Math.max(4, Math.round(report.ece * 260)))
                  return (
                    <Tooltip
                      key={label}
                      content={thin
                        ? `${label}: ${String(report.resolved)} resolved — too few to score`
                        : `${label}: ECE ${report.ece.toFixed(2)} · accuracy ${String(Math.round(report.accuracy * 100))}% · ${String(report.resolved)} resolved`}
                      placement="top" compact
                    >
                      <div className="flex flex-col items-center gap-1 cursor-help">
                        <span className={cn('text-[10px] tabular-nums', thin ? 'text-muted-foreground/40' : 'text-muted-foreground')}>
                          {thin ? '·' : report.ece.toFixed(2)}
                        </span>
                        <div className={cn('w-8 rounded-t-[4px]', thin ? 'bg-border' : 'bg-violet-500/70')} style={{ height: `${String(h)}px` }} />
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        {/* ── Learning loop (O1/O2 payoff): taught → grown → shaping outcomes ── */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Icon icon="learning" size={14} className="text-violet-500" /> Learning loop
            </h2>
            <Link to="/mind?aip=ontology" className="text-xs text-primary hover:underline">Ontology →</Link>
          </div>
          {!learning.data ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Loading…</div>
          ) : (() => {
            const d = learning.data
            const withRules    = d.proposals.filter((p) => d.influencedIds.has(p.id))
            const withoutRules = d.proposals.filter((p) => !d.influencedIds.has(p.id))
            const rw = approvalRate(withRules)
            const ro = approvalRate(withoutRules)
            const lift = rw != null && ro != null ? Math.round((rw - ro) * 100) : null
            const topInfluence = [...d.influence.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
            const byId = new Map(d.principles.map((p) => [p.id, p]))
            return (
              <>
                <div className="flex flex-wrap items-end gap-8">
                  <Metric label="Rules taught" value={String(d.principles.length)} sub="reject → TeachRule grows this" />
                  <Metric label="Vocabulary grown" value={String(d.extensionsCount)} sub={d.latestExtension ? `latest: ${d.latestExtension}` : 'approve ontology gaps'} />
                  <Metric label="Decisions shaped by rules" value={String(d.influencedIds.size)} sub={`of ${String(d.proposals.length)} resolved`} />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Approval lift from rules</div>
                    <div className={cn('text-lg font-semibold tabular-nums',
                      lift != null && lift > 0 && 'text-emerald-600 dark:text-emerald-400',
                      lift != null && lift < 0 && 'text-amber-600 dark:text-amber-400')}>
                      {lift != null ? `${lift >= 0 ? '+' : ''}${String(lift)} pts` : '—'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {rw != null && ro != null ? `${String(Math.round(rw * 100))}% with · ${String(Math.round(ro * 100))}% without` : 'needs decisions on both sides'}
                    </div>
                  </div>
                </div>
                {topInfluence.length > 0 && (
                  <div className="divide-y divide-border/50 border-t border-border/40 pt-1">
                    {topInfluence.map(([pid, count]) => (
                      <div key={pid} className="flex items-center gap-2 py-1.5 text-xs">
                        <Tag minimal className="tabular-nums shrink-0">{String(count)}</Tag>
                        <span className="italic truncate text-muted-foreground">{byId.get(pid)?.body ?? pid}</span>
                        {byId.get(pid)?.active === false && <Tag minimal intent={Intent.WARNING} className="!text-[9px]">inactive</Tag>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </Card>

        {/* ── Autonomous loop ── */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Icon icon="pulse" size={14} /> Autonomous loop
              {openCritical > 0 && <Tag intent={Intent.DANGER} minimal>{String(openCritical)} critical</Tag>}
            </h2>
            <Link to="/monitor" className="text-xs text-primary hover:underline">Monitor →</Link>
          </div>
          {cycles.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Loading…</div>
          ) : runs.length === 0 ? (
            <p className="text-xs text-muted-foreground">The cycle hasn’t run yet. It sweeps at-risk stock, runs the agents, auto-executes confident proposals and queues the rest.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {runs.map((r) => (
                <div key={r.ran_at} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-muted-foreground">{format(new Date(r.ran_at), 'MMM d, HH:mm')}</span>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">{String(r.auto_executed)} auto</span>
                    <span className="text-amber-600 dark:text-amber-400">{String(r.queued)} queued</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Per-agent reliability ── */}
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Icon icon="predictive-analysis" size={14} /> Per-agent reliability
          </h2>
          {!calibration || calibration.byAgent.length === 0 ? (
            <p className="text-xs text-muted-foreground">No per-agent calibration yet in this window.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {calibration.byAgent.map((s) => {
                const v = VERDICT[s.report.verdict] ?? VERDICT['insufficient-data']
                return (
                  <div key={s.key} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="font-medium">{s.key}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground tabular-nums">{String(s.report.resolved)} scored</span>
                      {s.report.sufficientData && (
                        <span className="text-muted-foreground tabular-nums">ECE {String(Math.round(s.report.ece * 100))}%</span>
                      )}
                      <Tag intent={v.intent} minimal className={cn('!text-[10px]')}>{v.label}</Tag>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* ── Calibration → autonomy ── */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Icon icon="endorsed" size={14} /> Suggested autonomy changes
            </h2>
            <Link to="/mind?aip=policy" className="text-xs text-primary hover:underline">Policy →</Link>
          </div>
          {recs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No changes suggested — agents are within tolerance, or need more resolved decisions. Well-calibrated agents earn a lower auto-execution floor here; proven-overconfident ones get tightened.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {recs.map((rec) => (
                <div key={rec.agentName} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">{rec.agentName}</span>
                      <Tag minimal intent={rec.kind === 'tighten' ? Intent.WARNING : Intent.SUCCESS} icon={rec.kind === 'enable' ? 'unlock' : undefined} className="!text-[10px]">
                        {rec.kind === 'enable' ? `enable ${rec.actionType ?? ''}` : rec.kind === 'loosen' ? 'widen autonomy' : 'tighten'}
                      </Tag>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {rec.kind === 'enable'
                          ? `off → floor ${rec.proposedFloor.toFixed(2)}`
                          : `floor ${rec.currentFloor.toFixed(2)} → ${rec.proposedFloor.toFixed(2)}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{rec.rationale}</p>
                  </div>
                  <Button size="small" intent={Intent.PRIMARY} text="Apply"
                    loading={applying === rec.agentName} disabled={setPolicy.isPending}
                    onClick={() => { applyRec(rec) }} />
                </div>
              ))}
            </div>
          )}
          {setPolicy.isError && <p className="text-xs text-red-500">{setPolicy.error.message}</p>}
        </Card>

        {cron.data && (
          <p className="text-[11px] text-muted-foreground">
            Loop health evaluated {formatDistanceToNow(new Date(cron.data.evaluated_at), { addSuffix: true })}.
          </p>
        )}

        {!calibration && !calLoading && (
          <NonIdealState icon="pulse" title="No flywheel signal yet" description="Run the cycle and resolve some proposals to populate this view." />
        )}
      </div>
    </div>
  )
}
