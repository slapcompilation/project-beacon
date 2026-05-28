// Slide-over for overstock_rebalancer. Mirrors WasteAdviceSlideOver shape.
// Approve dispatches via dispatchAction (triggered_by = 'ai_proposal_accepted')
// for the TRANSFER_STOCK proposal; refine reruns the agent with an NL note.

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
import { useOverstockRebalancer, type PersistedOverstockProposal, type RunOverstockResult } from './useOverstockRebalancer'
import { decideProposal } from './proposalsApi'
import { ProposalCard } from './ProposalCard'

interface Props {
  open: boolean
  onClose: () => void
  variantId: string
  variantName: string
}

export function OverstockAdviceSlideOver({ open, onClose, variantId, variantName }: Props) {
  const rebalance   = useOverstockRebalancer()
  const hotelId     = useActiveHotelId()
  const userId      = useAuthStore((s) => s.userId)
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState(`${variantName} is overstocked`)
  const [history, setHistory] = useState<PersistedOverstockProposal[]>([])
  const [trace, setTrace] = useState<RunOverstockResult['trace'] | null>(null)

  useEffect(() => {
    setPrompt(`${variantName} is overstocked`)
    setHistory([])
    setTrace(null)
  }, [variantName])

  const applyRun = (result: RunOverstockResult, refinedFromId?: string) => {
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
    rebalance.mutate(
      { variantId, variantName, prompt: prompt.trim() },
      { onSuccess: (result) => { applyRun(result) } },
    )
  }

  const onRefine = async (parentProposalId: string, note: string): Promise<void> => {
    const result = await rebalance.mutateAsync({
      variantId, variantName,
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
      status:             'approved',
      decidedByUserId:    userId,
      resultingNodeId,
      resultingNodeType:  'stock_transfer',
    })
    setHistory((prev) =>
      prev.map((p) => p.row.id === proposalId
        ? { ...p, row: { ...p.row, status: 'approved' as const } }
        : p),
    )
    toast.success('TRANSFER_STOCK applied')
    void queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }

  const parentLookup = new Map(history.map((p) => [p.row.id, p.proposal.action]))

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Rebalance overstock"
      icon="swap-horizontal"
      size="440px"
      position="right"
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-border p-4 space-y-3">
          <FormGroup label="Your concern" helperText="Why does this look overstocked?">
            <InputGroup
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value) }}
              placeholder={`e.g. too much ${variantName} on hand`}
              onKeyDown={(e) => { if (e.key === 'Enter' && !rebalance.isPending && prompt.trim()) run() }}
            />
          </FormGroup>
          <Button
            intent={Intent.PRIMARY}
            icon="play"
            fill
            loading={rebalance.isPending}
            disabled={!prompt.trim() || rebalance.isPending}
            onClick={run}
          >
            {history.length > 0 ? 'Re-run' : 'Get rebalance advice'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rebalance.isError && (
            <Callout intent={Intent.DANGER} icon="error" title="Agent error">
              {rebalance.error.message}
            </Callout>
          )}

          {rebalance.data?.paused && (
            <Callout intent={Intent.WARNING} icon="help" title="Agent paused for clarification">
              <p className="mb-2 text-sm font-medium">{rebalance.data.paused.question}</p>
              <p className="text-xs text-muted-foreground">{rebalance.data.paused.contextSummary}</p>
            </Callout>
          )}

          {history.length === 0 && !rebalance.isPending && !rebalance.isError && (
            <NonIdealState
              icon={<Icon icon="swap-horizontal" size={32} className="text-muted-foreground/40" />}
              title="No advice yet"
              description="Describe the excess above. The agent checks the 30-day forecast (is it really surplus?), then whether a sister property below par needs the stock — proposing a transfer that never drops this property below its own need."
            />
          )}

          {history.length === 0 && rebalance.isPending && (
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

          {rebalance.isPending && history.length > 0 && (
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
  for (const key of ['transferId', 'logId', 'newLogId']) {
    const v = d[key]
    if (typeof v === 'string') return v
  }
  return undefined
}
