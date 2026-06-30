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
  fetchForecastAccuracy,
  fetchRelease,
  fetchReleases,
  stopDeployment,
  type DeploymentKind,
  type ReleaseStage,
} from './api'
import { runEvalSuite } from './runEval'
import type { EvalSuite, ModelAdapter } from '@beacon/reality-graph'

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
    queryFn:  () => (hotelId ? fetchForecastAccuracy(hotelId, horizon, windows) : Promise.resolve([])),
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
