// Blueprint Drawer that invokes restock_advisor for one variant and renders
// the proposals it returns. Approve flows through dispatchAction so audit edges
// land with triggered_by = 'ai_proposal_accepted'. Refine re-runs the agent
// with a NL note; the new proposal supersedes the parent.

import { useEffect, useState } from 'react'
import {
  Button, Callout, Drawer, FormGroup,
  Icon, InputGroup, Intent, NonIdealState, Spinner, SpinnerSize,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { dispatchAction } from '@/lib/actions/dispatch'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import type { BeaconAction } from '@beacon/reality-graph'
import { useRestockAdvisor, type PersistedProposal, type RunRestockAdvisorResult } from './useRestockAdvisor'
import { decideProposal, fetchProposal, rowToAgentProposal } from './proposalsApi'
import { ProposalCard } from './ProposalCard'

interface Props {
  open: boolean
  onClose: () => void
  variantId: string
  variantName: string
  /** When set (e.g. /variant/<id>?refine=<proposalId>), the slide-over opens
   *  with that proposal pre-loaded so the operator can refine it inline. */
  refineFromProposalId?: string | null
}

export function AdviceSlideOver({ open, onClose, variantId, variantName, refineFromProposalId }: Props) {
  const advisor    = useRestockAdvisor()
  const hotelId    = useActiveHotelId()
  const userId     = useAuthStore((s) => s.userId)
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState(`${variantName} running low`)
  /** Persisted proposals from this session, in arrival order. Refinement appends; supersession is on-row. */
  const [history, setHistory] = useState<PersistedProposal[]>([])
  const [trace, setTrace] = useState<RunRestockAdvisorResult['trace'] | null>(null)

  useEffect(() => {
    setPrompt(`${variantName} running low`)
    setHistory([])
    setTrace(null)
  }, [variantName])

  // When opened with ?refine=<id>, load that parent proposal so ProposalCard
  // renders it + the operator can type a NL refinement note inline. The new
  // (refined) proposal will land in history via useRestockAdvisor's refinement
  // path and supersede this one — same flow as in-session refinement.
  useEffect(() => {
    if (!open || !refineFromProposalId) return
    let cancelled = false
    void fetchProposal(refineFromProposalId).then((row) => {
      if (cancelled || !row) return
      setHistory([{ row, proposal: rowToAgentProposal(row) }])
    }).catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to load proposal for refinement')
    })
    return () => { cancelled = true }
  }, [open, refineFromProposalId])

  const applyRun = (result: RunRestockAdvisorResult, refinedFromId?: string) => {
    setTrace(result.trace)
    setHistory((prev) => {
      const updated = refinedFromId
        ? prev.map((p) => p.row.id === refinedFromId
            ? { ...p, row: { ...p.row, status: 'superseded' as const } }
            : p)
        : prev
      return [...updated, ...result.proposals]
    })
  }

  const run = () => {
    advisor.mutate(
      { variantId, variantName, prompt: prompt.trim() },
      { onSuccess: (result) => { applyRun(result) } },
    )
  }

  const onRefine = async (parentProposalId: string, note: string): Promise<void> => {
    const result = await advisor.mutateAsync({
      variantId,
      variantName,
      prompt: prompt.trim(),
      refinement: { parentProposalId, note },
    })
    applyRun(result, parentProposalId)
  }

  const onApprove = async (proposalId: string, action: BeaconAction): Promise<void> => {
    if (!hotelId || !userId) throw new Error('Missing hotel or user context')
    const result = await dispatchAction(
      { ...action, triggeredBy: 'ai_proposal_accepted' } as BeaconAction,
      { hotelId, actorId: userId, triggeredBy: 'ai_proposal_accepted' },
    )
    if (!result.success) throw new Error(result.error.message)
    const resultingNodeId = extractResultId(result.data)
    await decideProposal({
      proposalId,
      status: 'approved',
      decidedByUserId: userId,
      resultingNodeId,
      resultingNodeType: resultingNodeTypeFor(action.type),
    })
    setHistory((prev) =>
      prev.map((p) => p.row.id === proposalId
        ? { ...p, row: { ...p.row, status: 'approved' as const } }
        : p),
    )
    toast.success(`${action.type} applied`)
    void queryClient.invalidateQueries({ queryKey: ['restock'] })
  }

  const parentLookup = new Map(history.map((p) => [p.row.id, p.proposal.action]))

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Restock advice"
      icon="predictive-analysis"
      size="440px"
      position="right"
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-border p-4 space-y-3">
          <FormGroup label="Your concern" helperText="Describe what's running low or under stress.">
            <InputGroup
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value) }}
              placeholder={`e.g. ${variantName} won't last the weekend`}
              onKeyDown={(e) => { if (e.key === 'Enter' && !advisor.isPending && prompt.trim()) run() }}
            />
          </FormGroup>
          <Button
            intent={Intent.PRIMARY}
            icon="play"
            fill
            loading={advisor.isPending}
            disabled={!prompt.trim() || advisor.isPending}
            onClick={run}
          >
            {history.length > 0 ? 'Re-run' : 'Get advice'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {advisor.isError && (
            <Callout intent={Intent.DANGER} icon="error" title="Agent error">
              {advisor.error.message}
            </Callout>
          )}

          {advisor.data?.paused && (
            <Callout intent={Intent.WARNING} icon="help" title="Agent paused for clarification">
              <p className="mb-2 text-sm font-medium">{advisor.data.paused.question}</p>
              <p className="text-xs text-muted-foreground">{advisor.data.paused.contextSummary}</p>
            </Callout>
          )}

          {history.length === 0 && !advisor.isPending && !advisor.isError && (
            <NonIdealState
              icon={<Icon icon="search-template" size={32} className="text-muted-foreground/40" />}
              title="No advice yet"
              description="Describe the concern above and the agent will analyze stock, consumption, sister-property inventory, and supplier options."
            />
          )}

          {history.length === 0 && advisor.isPending && (
            <div className="flex items-center justify-center py-12">
              <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
            </div>
          )}

          {trace && history.map((persisted) => (
            <ProposalCard
              key={persisted.row.id}
              persisted={persisted}
              trace={trace}
              onApprove={onApprove}
              onRefine={onRefine}
              parentAction={persisted.row.parent_version_id
                ? parentLookup.get(persisted.row.parent_version_id)
                : undefined}
              compact
            />
          ))}

          {advisor.isPending && history.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
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
    case 'REQUEST_RESTOCK': return 'restock_request'
    case 'TRANSFER_STOCK':  return 'stock_transfer'
    case 'ADJUST_STOCK':
    case 'WRITE_OFF':
    case 'REVERT_ACTION':   return 'stock_log'
    case 'CREATE_SUPPLIER': return 'supplier'
    case 'CREATE_PO':       return 'purchase_order'
    case 'SUBMIT_PO_INVOICE': return 'po_invoice'
    default:                return actionType
  }
}
