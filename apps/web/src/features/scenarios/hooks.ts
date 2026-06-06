import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  simulateCycleWithOverlay,
  type ScenarioSimulationCache,
} from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useActiveOrgId } from '@/hooks/useActiveOrgId'
import { useAuthStore } from '@/stores/auth.store'
import { useProducts } from '@/features/inventory/hooks'
import { useActiveForecastAdapter } from '@/features/modelingObjectives/activeAdapter'
import { useCurrentAgentReleases } from '@/features/agentStudio/hooks'
import { useOrgPolicy } from '@/features/mind/policy'
import { makeWebScenarioGateway } from './gateway'
import {
  applyOverlayEdit,
  createScenario,
  fetchOverlayEdits,
  fetchScenario,
  fetchScenarios,
  setScenarioStatus,
  updateScenarioMeta,
  type ScenarioRow,
  type ScenarioStatus,
} from './api'

export const scenarioKeys = {
  list:    (status: string)   => ['scenarios', 'list', status] as const,
  detail:  (id: string)       => ['scenarios', 'detail', id] as const,
  edits:   (id: string)       => ['scenarios', 'edits', id] as const,
}

export function useScenarios(statusFilter?: ScenarioStatus | null) {
  return useQuery({
    queryKey: scenarioKeys.list(statusFilter ?? 'all'),
    queryFn:  () => fetchScenarios(statusFilter ?? null),
    staleTime: 30_000,
  })
}

export function useScenario(id: string) {
  return useQuery({
    queryKey: scenarioKeys.detail(id),
    queryFn:  () => fetchScenario(id),
    enabled:  !!id,
    staleTime: 30_000,
  })
}

export function useScenarioOverlayEdits(id: string) {
  return useQuery({
    queryKey: scenarioKeys.edits(id),
    queryFn:  () => fetchOverlayEdits(id),
    enabled:  !!id,
    staleTime: 30_000,
  })
}

export function useCreateScenario() {
  const orgId   = useActiveOrgId()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: async (args: { title: string; description?: string }) => {
      if (!orgId || !userId) throw new Error('Missing org / user context')
      return createScenario({
        organizationId:  orgId,
        hotelId:         hotelId ?? null,
        title:           args.title,
        description:     args.description,
        createdByUserId: userId,
      })
    },
    onSuccess: () => {
      toast.success('Scenario created')
      void qc.invalidateQueries({ queryKey: ['scenarios'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useApplyOverlayEdit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { scenarioId: string; path: ReadonlyArray<string>; value: unknown }) =>
      applyOverlayEdit({ ...args, source: 'operator' }),
    onSuccess: (_row, args) => {
      void qc.invalidateQueries({ queryKey: scenarioKeys.detail(args.scenarioId) })
      void qc.invalidateQueries({ queryKey: scenarioKeys.edits(args.scenarioId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Runs the cycle against the scenario's overlay (no-op persistence) and
 *  caches the result. The web gateway materializes the simulation deps from
 *  the loaded catalogue + policy + releases. */
export function useSimulateScenario() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const { data: products = [] } = useProducts()
  const forecastAdapter = useActiveForecastAdapter()
  const { data: releases = [] } = useCurrentAgentReleases()
  const { data: policyData } = useOrgPolicy()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (scenario: ScenarioRow) => {
      if (!hotelId || !userId) throw new Error('No active hotel / user')
      const gateway = makeWebScenarioGateway({
        hotelId, userId, products,
        orgPolicy: policyData?.merged,
        releases, forecastAdapter,
      })
      const deps   = await gateway.buildSimulationDeps(scenario)
      const result = await simulateCycleWithOverlay(deps)
      const cache: ScenarioSimulationCache = {
        ran_at: result.ranAt,
        result: {
          scanned:      result.scanned,
          proposed:     result.proposed,
          autoExecuted: result.autoExecuted,
          queued:       result.queued,
          ranAt:        result.ranAt,
          items:        result.items.map((i) => ({
            variantId: i.variantId, variantName: i.variantName,
            outcome: i.outcome, actionType: i.actionType, reason: i.reason,
          })),
        },
        delta: null,
      }
      await gateway.recordSimulation(scenario.id, cache)
      return cache
    },
    onSuccess: (_cache, scenario) => {
      toast.success('Simulation complete')
      void qc.invalidateQueries({ queryKey: scenarioKeys.detail(scenario.id) })
      void qc.invalidateQueries({ queryKey: ['scenarios'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSetScenarioStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; status: ScenarioStatus }) => setScenarioStatus(args.id, args.status),
    onSuccess: (_void, args) => {
      toast.success(args.status === 'promoted' ? 'Scenario promoted' : `Scenario ${args.status}`)
      void qc.invalidateQueries({ queryKey: ['scenarios'] })
      void qc.invalidateQueries({ queryKey: scenarioKeys.detail(args.id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateScenarioMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; title?: string; description?: string }) =>
      updateScenarioMeta(args.id, { title: args.title, description: args.description }),
    onSuccess: (_void, args) => {
      void qc.invalidateQueries({ queryKey: scenarioKeys.detail(args.id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
