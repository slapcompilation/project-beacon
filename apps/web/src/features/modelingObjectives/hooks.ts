import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveOrgId } from '@/hooks/useActiveOrgId'
import {
  createDeployment,
  createRelease,
  fetchDeployment,
  fetchDeployments,
  fetchEvalRuns,
  fetchGradeableVariants,
  fetchRelease,
  fetchReleases,
  recordEvalRun,
  stopDeployment,
  type DeploymentKind,
  type ForecastAccuracyRow,
  type ReleaseStage,
} from './api'
import { runEvalSuite } from './runEval'
import { runRealBacktestEval } from './runRealEval'
import {
  makeScoreForecastAccuracyTool,
  makeComputeDecisionQualityTool,
  scoreDecisionQuality,
  type EvalSuite,
  type ModelAdapter,
} from '@beacon/reality-graph'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

export const moKeys = {
  evalRuns:    (objective: string, orgId: string) => ['mo', 'evalRuns',    objective, orgId] as const,
  releases:    (objective: string, orgId: string) => ['mo', 'releases',    objective, orgId] as const,
  deployments: (orgId: string)                    => ['mo', 'deployments', orgId]            as const,
}

export function useEvalRuns(objectiveName: string) {
  const orgId = useActiveOrgId()
  return useQuery({
    queryKey: moKeys.evalRuns(objectiveName, orgId ?? ''),
    queryFn:  () => fetchEvalRuns(objectiveName, orgId),
    enabled:  true,
    staleTime: 30_000,
  })
}

export function useReleases(objectiveName: string) {
  const orgId = useActiveOrgId()
  return useQuery({
    queryKey: moKeys.releases(objectiveName, orgId ?? ''),
    queryFn:  () => fetchReleases(objectiveName, orgId),
    enabled:  true,
    staleTime: 30_000,
  })
}

export function useForecastAccuracy(hotelId: string | null, horizon = 7, windows = 4) {
  return useQuery({
    queryKey: ['mo', 'forecastAccuracy', hotelId ?? '', horizon, windows],
    queryFn:  async (): Promise<ForecastAccuracyRow[]> => {
      if (!hotelId) return []
      const variants = await fetchGradeableVariants(hotelId)
      const tool = makeScoreForecastAccuracyTool(makeSupabaseGraphReader())
      // Score each variant through the actual production model (auto-select, the
      // tool's default). Per-variant so the surface can show which adapter won.
      const graded = await Promise.all(variants.map(async (v) => {
        const r = await tool.invoke({ variantId: v.variant_id, horizonDays: horizon, windows })
        return {
          variant_id: v.variant_id, variant_name: v.variant_name,
          n: r.n, mape: r.mape, bias_pct: r.biasPct, basis: r.basis,
        }
      }))
      return graded.filter((r) => r.n > 0).sort((a, b) => b.mape - a.mape)
    },
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

/** The decision-quality north-star (roadmap Q0): realized outcomes per gradeable
 *  variant — stock-out days (under-order cost) + waste (over-order cost) — scored
 *  through the compute_decision_quality Logic Tool, the same production math. */
export interface DecisionQualityRow {
  variant_id:        string
  variant_name:      string
  stockout_days:     number
  availability_rate: number
  waste_units:       number
  consumed_units:    number
  waste_rate:        number
}

export function useDecisionQuality(hotelId: string | null, windowDays = 30) {
  return useQuery({
    queryKey: ['mo', 'decisionQuality', hotelId ?? '', windowDays],
    queryFn:  async (): Promise<DecisionQualityRow[]> => {
      if (!hotelId) return []
      const variants = await fetchGradeableVariants(hotelId)
      const tool = makeComputeDecisionQualityTool(makeSupabaseGraphReader())
      const graded = await Promise.all(variants.map(async (v) => {
        const r = await tool.invoke({ variantId: v.variant_id, windowDays })
        return {
          variant_id:        v.variant_id,
          variant_name:      v.variant_name,
          stockout_days:     r.stockoutDays,
          availability_rate: r.availabilityRate,
          waste_units:       r.wasteUnits,
          consumed_units:    r.consumedUnits,
          waste_rate:        r.wasteRate,
        }
      }))
      // Worst decisions first: most stockout-days, then most waste.
      return graded.sort((a, b) => b.stockout_days - a.stockout_days || b.waste_units - a.waste_units)
    },
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

/** Q5 — the decision-quality north-star OVER TIME, not a snapshot. A promotion
 *  decision reads one point in time; this is what says whether the decisions are
 *  actually getting better. scoreDecisionQuality is a pure function of logs, so
 *  every past month is derivable from history already on hand — no new storage,
 *  no backfill. Fetch each variant's logs once, then score a 30d window per month. */
export interface DecisionQualityPoint {
  label:        string
  stockoutDays: number
  wasteUnits:   number
  availability: number
  variants:     number
}

export function useDecisionQualityTrend(hotelId: string | null, months = 6) {
  return useQuery({
    queryKey: ['mo', 'decisionQualityTrend', hotelId ?? '', months],
    queryFn:  async (): Promise<DecisionQualityPoint[]> => {
      if (!hotelId) return []
      const variants = await fetchGradeableVariants(hotelId)
      const reader = makeSupabaseGraphReader()
      const logs = await Promise.all(variants.map((v) => reader.getStockLogs(v.variant_id, months * 31 + 31)))

      const now = new Date()
      const points: DecisionQualityPoint[] = []
      for (let m = months - 1; m >= 0; m--) {
        // End of each month back from today; the newest bucket ends now.
        const end = m === 0 ? now : new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59)
        const scored = logs.map((l) => scoreDecisionQuality(l, end.getTime(), 30))
        const withSignal = scored.filter((s) => s.daysWithBalance > 0 || s.consumedUnits > 0)
        if (withSignal.length === 0) continue
        points.push({
          label:        end.toLocaleString('en', { month: 'short' }),
          stockoutDays: withSignal.reduce((s, x) => s + x.stockoutDays, 0),
          wasteUnits:   withSignal.reduce((s, x) => s + x.wasteUnits, 0),
          availability: withSignal.reduce((s, x) => s + x.availabilityRate, 0) / withSignal.length,
          variants:     withSignal.length,
        })
      }
      return points
    },
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

export function useDeployments() {
  const orgId = useActiveOrgId()
  return useQuery({
    queryKey: moKeys.deployments(orgId ?? ''),
    queryFn:  () => fetchDeployments(orgId),
    enabled:  true,
    staleTime: 30_000,
  })
}

export function useDeployment(id: string) {
  return useQuery({
    queryKey: ['mo', 'deployment', id],
    queryFn:  () => fetchDeployment(id),
    enabled:  !!id,
    staleTime: 30_000,
  })
}

export function useRelease(id: string | null | undefined) {
  return useQuery({
    queryKey: ['mo', 'release', id ?? ''],
    queryFn:  () => (id ? fetchRelease(id) : Promise.resolve(null)),
    enabled:  !!id,
    staleTime: 60_000,
  })
}

export function usePromoteRelease(objectiveName: string) {
  const orgId  = useActiveOrgId()
  const userId = useAuthStore((s) => s.userId)
  const qc     = useQueryClient()

  return useMutation({
    mutationFn: async (args: { adapterName: string; adapterVersion: string; stage: ReleaseStage; tag?: string }) => {
      // Promotion gate: production requires at least one eval row for this
      // exact adapter version. Sandbox/staging are unrestricted.
      if (args.stage === 'production') {
        const allRuns = await fetchEvalRuns(objectiveName, orgId)
        const hasEval = allRuns.some(
          (r) => r.adapter_name === args.adapterName && r.adapter_version === args.adapterVersion,
        )
        if (!hasEval) {
          throw new Error(
            `Cannot promote ${args.adapterName}@${args.adapterVersion} to production: no eval runs recorded. Run the eval suite first.`,
          )
        }
      }

      return createRelease({
        organizationId:    orgId,
        objectiveName,
        adapterName:       args.adapterName,
        adapterVersion:    args.adapterVersion,
        stage:             args.stage,
        tag:               args.tag ?? `${args.stage}-${args.adapterName}-${args.adapterVersion}`,
        releasedByUserId:  userId,
      })
    },
    onSuccess: (rel) => {
      toast.success(`Released ${rel.adapter_name}@${rel.adapter_version} → ${rel.stage}`)
      void qc.invalidateQueries({ queryKey: moKeys.releases(objectiveName, orgId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Ships a backtested adapter from the bench that scored it: the holdout result
 *  is persisted as an eval run — real evidence on real stock logs, and what the
 *  production gate checks — then the release is cut. One step, because seeing a
 *  winner and shipping it shouldn't be two disconnected surfaces. */
export function useReleaseBacktestWinner(objectiveName: string) {
  const orgId  = useActiveOrgId()
  const userId = useAuthStore((s) => s.userId)
  const qc     = useQueryClient()

  return useMutation({
    mutationFn: async (args: {
      adapterName: string; adapterVersion: string; stage: ReleaseStage
      mape: number; cases: number; holdoutDays: number
    }) => {
      await recordEvalRun({
        organizationId:    orgId,
        objectiveName,
        adapterName:       args.adapterName,
        adapterVersion:    args.adapterVersion,
        dataset:           `stock_logs:holdout-${String(args.holdoutDays)}d`,
        metric:            'mape',
        value:             args.mape,
        caseCount:         args.cases,
        subset:            'overall',
        triggeredByUserId: userId,
      })
      return createRelease({
        organizationId:   orgId,
        objectiveName,
        adapterName:      args.adapterName,
        adapterVersion:   args.adapterVersion,
        stage:            args.stage,
        tag:              `${args.stage}-${args.adapterName}-${args.adapterVersion}`,
        releasedByUserId: userId,
      })
    },
    onSuccess: (rel) => {
      toast.success(`Released ${rel.adapter_name}@${rel.adapter_version} → ${rel.stage} (backtest recorded)`)
      void qc.invalidateQueries({ queryKey: moKeys.releases(objectiveName, orgId ?? '') })
      void qc.invalidateQueries({ queryKey: moKeys.evalRuns(objectiveName, orgId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCreateDeployment() {
  const orgId = useActiveOrgId()
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (args: { releaseId: string; kind: DeploymentKind }) =>
      createDeployment({ organizationId: orgId, releaseId: args.releaseId, kind: args.kind }),
    onSuccess: () => {
      toast.success('Deployment started')
      void qc.invalidateQueries({ queryKey: moKeys.deployments(orgId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useStopDeployment() {
  const orgId = useActiveOrgId()
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (deploymentId: string) => stopDeployment(deploymentId),
    onSuccess: () => {
      toast.success('Deployment stopped')
      void qc.invalidateQueries({ queryKey: moKeys.deployments(orgId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Q5 — grade every candidate adapter on REAL production demand (held-out days
 *  scored against what actually got consumed), so the promotion loop recommends
 *  from reality instead of the synthetic suite's "how close are you to the flat
 *  mean" score, which would have demoted the better model. */
export function useRunRealEval(objectiveName: string) {
  const orgId   = useActiveOrgId()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: (args: { adapters: ReadonlyArray<ModelAdapter>; holdoutDays?: number }) => {
      if (!hotelId) throw new Error('Select a hotel to grade adapters on its real demand')
      return runRealBacktestEval({
        adapters: args.adapters, objectiveName, hotelId,
        organizationId: orgId, userId, holdoutDays: args.holdoutDays,
      })
    },
    onSuccess: (s) => {
      toast.success(
        s.winner
          ? `Real backtest on ${String(s.cases)} variants — winner: ${s.winner}`
          : `Real backtest ran but nothing was scoreable (needs closed ${String(s.holdoutDays)}-day windows)`,
      )
      void qc.invalidateQueries({ queryKey: moKeys.evalRuns(objectiveName, orgId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRunEvalForAdapter(objectiveName: string) {
  const orgId  = useActiveOrgId()
  const userId = useAuthStore((s) => s.userId)
  const qc     = useQueryClient()

  return useMutation({
    mutationFn: (args: { adapter: ModelAdapter; suite: EvalSuite }) =>
      runEvalSuite({
        adapter:        args.adapter,
        suite:          args.suite,
        organizationId: orgId,
        userId,
      }),
    onSuccess: (summary) => {
      toast.success(`Eval ran on ${String(summary.caseCount)} cases — MAE ${String(summary.mae)} · RMSE ${String(summary.rmse)}`)
      void qc.invalidateQueries({ queryKey: moKeys.evalRuns(objectiveName, orgId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
