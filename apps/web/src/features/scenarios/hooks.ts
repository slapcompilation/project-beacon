import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import type { BeaconAction } from '@beacon/reality-graph'
import {
  appendSimulatedAction,
  createScenario,
  discardScenario,
  fetchScenario,
  fetchScenarios,
  recordScenarioCommit,
  removeSimulatedAction,
  updateScenarioNotes,
  type ScenarioRow,
  type ScenarioStatus,
} from './api'

export const scenarioKeys = {
  list:   (hotelId: string, status: string) => ['scenarios', 'list',   hotelId, status] as const,
  detail: (id: string)                      => ['scenarios', 'detail', id]              as const,
}

export function useScenarios(statusFilter?: ScenarioStatus | null) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: scenarioKeys.list(hotelId ?? '', statusFilter ?? 'all'),
    queryFn:  () => (hotelId ? fetchScenarios(hotelId, statusFilter ?? null) : Promise.resolve([] as ScenarioRow[])),
    enabled:  !!hotelId,
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

export function useCreateScenario() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      title: string
      description?: string | null
      baseProposalId?: string | null
      simulatedActions?: BeaconAction[]
    }) => {
      if (!hotelId || !userId) throw new Error('Missing context')
      return createScenario({
        hotelId,
        title:            args.title,
        description:      args.description,
        baseProposalId:   args.baseProposalId,
        simulatedActions: args.simulatedActions,
        openedByUserId:   userId,
      })
    },
    onSuccess: () => {
      toast.success('Scenario opened')
      void qc.invalidateQueries({ queryKey: ['scenarios'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateScenarioNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; notes: string }) => updateScenarioNotes(args.id, args.notes),
    onSuccess: (_void, args) => {
      void qc.invalidateQueries({ queryKey: scenarioKeys.detail(args.id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useAppendSimulatedAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { scenarioId: string; action: BeaconAction }) =>
      appendSimulatedAction(args.scenarioId, args.action),
    onSuccess: (_void, args) => {
      toast.success('Simulated action added')
      void qc.invalidateQueries({ queryKey: scenarioKeys.detail(args.scenarioId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRemoveSimulatedAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { scenarioId: string; index: number }) =>
      removeSimulatedAction(args.scenarioId, args.index),
    onSuccess: (_void, args) => {
      void qc.invalidateQueries({ queryKey: scenarioKeys.detail(args.scenarioId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDiscardScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => discardScenario(id),
    onSuccess: (_void, id) => {
      toast.success('Scenario discarded')
      void qc.invalidateQueries({ queryKey: ['scenarios'] })
      void qc.invalidateQueries({ queryKey: scenarioKeys.detail(id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Commits the scenario: dispatches every simulated action through the
 *  regular Action Registry, captures per-action results, marks the row
 *  committed. Stops on first failure (so the user can fix and retry without
 *  duplicate dispatches). */
export function useCommitScenario() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: async (scenario: ScenarioRow) => {
      if (!hotelId || !userId) throw new Error('Missing context')

      const results: NonNullable<ScenarioRow['commit_results']> = []
      for (const action of scenario.simulated_actions) {
        try {
          const dispatched = await dispatchAction(action, {
            hotelId,
            actorId:        userId,
            triggeredBy:    'user',
            organizationId: scenario.organization_id,
          })
          if (!dispatched.success) {
            results.push({ actionType: action.type, error: dispatched.error.message })
            await recordScenarioCommit(scenario.id, userId, results)
            throw new Error(`Aborted at ${action.type}: ${dispatched.error.message}`)
          }
          results.push({ actionType: action.type, result: dispatched.data })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Dispatch failed'
          results.push({ actionType: action.type, error: msg })
          await recordScenarioCommit(scenario.id, userId, results)
          throw err instanceof Error ? err : new Error(msg)
        }
      }
      await recordScenarioCommit(scenario.id, userId, results)
      return results
    },
    onSuccess: (_results, scenario) => {
      toast.success(`Scenario committed — ${String(scenario.simulated_actions.length)} action(s) dispatched`)
      void qc.invalidateQueries({ queryKey: ['scenarios'] })
      void qc.invalidateQueries({ queryKey: scenarioKeys.detail(scenario.id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
