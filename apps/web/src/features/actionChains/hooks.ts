import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import type { BeaconAction } from '@beacon/reality-graph'
import {
  appendActionChainStep,
  createActionChain,
  discardActionChain,
  fetchActionChain,
  fetchActionChains,
  recordActionChainCommit,
  removeActionChainStep,
  updateActionChainNotes,
  type ActionChainRow,
  type ActionChainStatus,
} from './api'

export const actionChainKeys = {
  list:   (hotelId: string, status: string) => ['action-chains', 'list',   hotelId, status] as const,
  detail: (id: string)                      => ['action-chains', 'detail', id]              as const,
}

export function useActionChains(statusFilter?: ActionChainStatus | null) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: actionChainKeys.list(hotelId ?? '', statusFilter ?? 'all'),
    queryFn:  () => (hotelId ? fetchActionChains(hotelId, statusFilter ?? null) : Promise.resolve([] as ActionChainRow[])),
    enabled:  !!hotelId,
    staleTime: 30_000,
  })
}

export function useActionChain(id: string) {
  return useQuery({
    queryKey: actionChainKeys.detail(id),
    queryFn:  () => fetchActionChain(id),
    enabled:  !!id,
    staleTime: 30_000,
  })
}

export function useCreateActionChain() {
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
      return createActionChain({
        hotelId,
        title:            args.title,
        description:      args.description,
        baseProposalId:   args.baseProposalId,
        simulatedActions: args.simulatedActions,
        openedByUserId:   userId,
      })
    },
    onSuccess: () => {
      toast.success('Action chain opened')
      void qc.invalidateQueries({ queryKey: ['action-chains'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateActionChainNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; notes: string }) => updateActionChainNotes(args.id, args.notes),
    onSuccess: (_void, args) => {
      void qc.invalidateQueries({ queryKey: actionChainKeys.detail(args.id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useAppendActionChainStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { chainId: string; action: BeaconAction }) =>
      appendActionChainStep(args.chainId, args.action),
    onSuccess: (_void, args) => {
      toast.success('Step added')
      void qc.invalidateQueries({ queryKey: actionChainKeys.detail(args.chainId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRemoveActionChainStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { chainId: string; index: number }) =>
      removeActionChainStep(args.chainId, args.index),
    onSuccess: (_void, args) => {
      void qc.invalidateQueries({ queryKey: actionChainKeys.detail(args.chainId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDiscardActionChain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => discardActionChain(id),
    onSuccess: (_void, id) => {
      toast.success('Action chain discarded')
      void qc.invalidateQueries({ queryKey: ['action-chains'] })
      void qc.invalidateQueries({ queryKey: actionChainKeys.detail(id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Commits the chain: dispatches every step through the regular Action
 *  Registry, captures per-step results, marks the row committed. Stops on
 *  first failure (so the user can fix and retry without duplicate dispatches). */
export function useCommitActionChain() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: async (chain: ActionChainRow) => {
      if (!hotelId || !userId) throw new Error('Missing context')

      const results: NonNullable<ActionChainRow['commit_results']> = []
      for (const action of chain.simulated_actions) {
        try {
          const dispatched = await dispatchAction(action, {
            hotelId,
            actorId:        userId,
            triggeredBy:    'user',
            organizationId: chain.organization_id,
          })
          if (!dispatched.success) {
            results.push({ actionType: action.type, error: dispatched.error.message })
            await recordActionChainCommit(chain.id, userId, results)
            throw new Error(`Aborted at ${action.type}: ${dispatched.error.message}`)
          }
          results.push({ actionType: action.type, result: dispatched.data })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Dispatch failed'
          results.push({ actionType: action.type, error: msg })
          await recordActionChainCommit(chain.id, userId, results)
          throw err instanceof Error ? err : new Error(msg)
        }
      }
      await recordActionChainCommit(chain.id, userId, results)
      return results
    },
    onSuccess: (_results, chain) => {
      toast.success(`Action chain committed — ${String(chain.simulated_actions.length)} step(s) dispatched`)
      void qc.invalidateQueries({ queryKey: ['action-chains'] })
      void qc.invalidateQueries({ queryKey: actionChainKeys.detail(chain.id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
