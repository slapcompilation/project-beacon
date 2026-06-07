import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useActiveOrgId } from '@/hooks/useActiveOrgId'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
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

/** Runs the cycle against the scenario's overlay via the scenario-simulate
 *  edge fn — the single server-side simulation path (shared with the copilot's
 *  simulate_scenario tool). The edge fn caches the result on the row; we just
 *  invalidate so the detail page re-reads last_simulation. */
export function useSimulateScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scenario: ScenarioRow) => {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        'scenario-simulate',
        { body: { scenario_id: scenario.id } },
      ) as { data: { ok?: boolean; error?: string } | null; error: { message: string } | null }
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Simulation failed')
      return data
    },
    onSuccess: (_res, scenario) => {
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
