import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import {
  attachProposalToCase,
  createCase,
  detachProposalFromCase,
  fetchCase,
  fetchCases,
  fetchCasesForProposal,
  transitionCase,
  type CaseInputRef,
  type CaseOutcome,
  type CaseRow,
  type CaseStatus,
} from './api'

export const caseKeys = {
  list:      (hotelId: string, status: string)  => ['cases', 'list', hotelId, status] as const,
  detail:    (id: string)                       => ['cases', 'detail', id]              as const,
  byProposal:(proposalId: string)               => ['cases', 'by-proposal', proposalId] as const,
}

export function useCases(statusFilter?: CaseStatus | null) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: caseKeys.list(hotelId ?? '', statusFilter ?? 'all'),
    queryFn:  () => (hotelId ? fetchCases(hotelId, statusFilter ?? null) : Promise.resolve([] as CaseRow[])),
    enabled:  !!hotelId,
    staleTime: 30_000,
  })
}

export function useCase(id: string) {
  return useQuery({
    queryKey: caseKeys.detail(id),
    queryFn:  () => fetchCase(id),
    enabled:  !!id,
    staleTime: 30_000,
  })
}

export function useCasesForProposal(proposalId: string) {
  return useQuery({
    queryKey: caseKeys.byProposal(proposalId),
    queryFn:  () => fetchCasesForProposal(proposalId),
    enabled:  !!proposalId,
    staleTime: 60_000,
  })
}

export function useCreateCase() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: async (args: { title: string; inputRefs?: CaseInputRef[]; proposalIds?: string[] }) => {
      if (!hotelId || !userId) throw new Error('Missing context')
      return createCase({
        hotelId,
        title:          args.title,
        inputRefs:      args.inputRefs,
        proposalIds:    args.proposalIds,
        openedByUserId: userId,
      })
    },
    onSuccess: () => {
      toast.success('Case opened')
      void qc.invalidateQueries({ queryKey: ['cases'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useTransitionCase() {
  const userId = useAuthStore((s) => s.userId)
  const qc     = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; status: CaseStatus; outcome?: CaseOutcome | null }) =>
      transitionCase({ id: args.id, status: args.status, outcome: args.outcome, resolvedByUserId: userId }),
    onSuccess: (_void, args) => {
      toast.success(`Case → ${args.status}`)
      void qc.invalidateQueries({ queryKey: ['cases'] })
      void qc.invalidateQueries({ queryKey: caseKeys.detail(args.id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useAttachProposalToCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { caseId: string; proposalId: string }) =>
      attachProposalToCase(args.caseId, args.proposalId),
    onSuccess: (_void, args) => {
      toast.success('Proposal attached')
      void qc.invalidateQueries({ queryKey: caseKeys.detail(args.caseId) })
      void qc.invalidateQueries({ queryKey: caseKeys.byProposal(args.proposalId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDetachProposalFromCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { caseId: string; proposalId: string }) =>
      detachProposalFromCase(args.caseId, args.proposalId),
    onSuccess: (_void, args) => {
      toast.success('Proposal detached')
      void qc.invalidateQueries({ queryKey: caseKeys.detail(args.caseId) })
      void qc.invalidateQueries({ queryKey: caseKeys.byProposal(args.proposalId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
