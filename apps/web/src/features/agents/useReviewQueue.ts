import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BeaconAction } from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import {
  decideProposal,
  fetchPendingProposals,
  rejectProposal,
  type ProposalRow,
} from './proposalsApi'

export const reviewQueueKeys = {
  pending: (hotelId: string) => ['proposals', 'pending', hotelId] as const,
}

/** Pending proposals for triage. Refetches every 30s so the queue stays live. */
export function usePendingProposals() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: reviewQueueKeys.pending(hotelId ?? ''),
    queryFn:  () => fetchPendingProposals({ hotelId: hotelId ?? '' }),
    enabled:  !!hotelId,
    staleTime:         30_000,
    refetchInterval:   30_000,
  })
}

export interface ConfidenceBands {
  green:  ProposalRow[]
  yellow: ProposalRow[]
  red:    ProposalRow[]
}

/** Splits rows into green ≥0.85, yellow 0.6–0.85, red <0.6 (AIP convention). */
export function bandByConfidence(rows: ProposalRow[]): ConfidenceBands {
  const bands: ConfidenceBands = { green: [], yellow: [], red: [] }
  for (const r of rows) {
    if (r.confidence >= 0.85) bands.green.push(r)
    else if (r.confidence >= 0.6) bands.yellow.push(r)
    else bands.red.push(r)
  }
  return bands
}

export function useUniqueFilters(rows: ProposalRow[]) {
  return useMemo(() => {
    const agents = new Set<string>()
    const types  = new Set<string>()
    for (const r of rows) {
      agents.add(r.agent_name)
      types.add(r.action_type)
    }
    return {
      agentNames:  [...agents].sort((a, b) => a.localeCompare(b)),
      actionTypes: [...types].sort((a, b) => a.localeCompare(b)),
    }
  }, [rows])
}

/** Approve = dispatch the action, then mark the proposal approved. */
export function useApproveProposalFromQueue() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: async (row: ProposalRow) => {
      if (!hotelId || !userId) throw new Error('Missing hotel or user context')
      const action = row.action_payload as unknown as BeaconAction
      const result = await dispatchAction(
        { ...action, triggeredBy: 'ai_proposal_accepted' } as BeaconAction,
        { hotelId, actorId: userId, triggeredBy: 'ai_proposal_accepted' },
      )
      if (!result.success) throw new Error(result.error.message)
      const resultingNodeId = extractResultId(result.data)
      await decideProposal({
        proposalId:         row.id,
        status:             'approved',
        decidedByUserId:    userId,
        resultingNodeId,
        resultingNodeType:  resultingNodeTypeFor(action.type),
      })
      return result
    },
    onSuccess: () => {
      toast.success('Proposal approved')
      void qc.invalidateQueries({ queryKey: reviewQueueKeys.pending(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRejectProposalFromQueue() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: async (proposalId: string) => {
      if (!userId) throw new Error('Not signed in')
      await rejectProposal({ proposalId, decidedByUserId: userId })
    },
    onSuccess: () => {
      toast.success('Proposal rejected')
      void qc.invalidateQueries({ queryKey: reviewQueueKeys.pending(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

function extractResultId(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const d = data as Record<string, unknown>
  for (const key of ['restockId', 'transferId', 'logId', 'newLogId', 'supplierId', 'poId', 'invoiceId']) {
    const v = d[key]
    if (typeof v === 'string') return v
  }
  return undefined
}

function resultingNodeTypeFor(actionType: BeaconAction['type']): string {
  switch (actionType) {
    case 'REQUEST_RESTOCK':   return 'restock_request'
    case 'TRANSFER_STOCK':    return 'stock_transfer'
    case 'ADJUST_STOCK':
    case 'WRITE_OFF':
    case 'REVERT_ACTION':     return 'stock_log'
    case 'CREATE_SUPPLIER':   return 'supplier'
    case 'CREATE_PO':         return 'purchase_order'
    case 'SUBMIT_PO_INVOICE': return 'po_invoice'
    default:                  return actionType
  }
}
