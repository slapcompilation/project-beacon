// Slide-over for waste_triage. Mirrors AdviceSlideOver shape.
// Approve dispatches via dispatchAction (triggered_by = 'ai_proposal_accepted')
// for WRITE_OFF or TRANSFER_STOCK proposals; refine reruns the agent with an NL note.

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
import { useWasteTriage, type PersistedWasteProposal, type RunWasteTriageResult } from './useWasteTriage'
import { decideProposal } from './proposalsApi'
import { ProposalCard } from './ProposalCard'

interface Props {
  open: boolean
  onClose: () => void
  variantId: string
  variantName: string
}

export function WasteAdviceSlideOver({ open, onClose, variantId, variantName }: Props) {
  const triage      = useWasteTriage()
  const hotelId     = useActiveHotelId()
  const userId      = useAuthStore((s) => s.userId)
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState(`${variantName} at risk of spoilage`)
  const [history, setHistory] = useState<PersistedWasteProposal[]>([])
  const [trace, setTrace] = useState<RunWasteTriageResult['trace'] | null>(null)

  useEffect(() => {
    setPrompt(`${variantName} at risk of spoilage`)
    setHistory([])
    setTrace(null)
  }, [variantName])

  const applyRun = (result: RunWasteTriageResult, refinedFromId?: string) => {
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
    triage.mutate(
      { variantId, variantName, prompt: prompt.trim() },
      { onSuccess: (result) => { applyRun(result) } },
    )
  }

  const onRefine = async (parentProposalId: string, note: string): Promise<void> => {
    const result = await triage.mutateAsync({
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
      resultingNodeType:  resultingNodeTypeFor(action.type),
    })
    setHistory((prev) =>
      prev.map((p) => p.row.id === proposalId
        ? { ...p, row: { ...p.row, status: 'approved' as const } }
        : p),
    )
    toast.success(`${action.type} applied`)
    void queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }

  const parentLookup = new Map(history.map((p) => [p.row.id, p.proposal.action]))

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Waste triage"
      icon="trash"
      size="440px"
      position="right"
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-border p-4 space-y-3">
          <FormGroup label="Your concern" helperText="What's nearing expiry or at risk of spoilage?">
            <InputGroup
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value) }}
              placeholder={`e.g. ${variantName} expires Friday`}
              onKeyDown={(e) => { if (e.key === 'Enter' && !triage.isPending && prompt.trim()) run() }}
            />
          </FormGroup>
          <Button
            intent={Intent.PRIMARY}
            icon="play"
            fill
            loading={triage.isPending}
            disabled={!prompt.trim() || triage.isPending}
            onClick={run}
          >
            {history.length > 0 ? 'Re-run' : 'Get triage'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {triage.isError && (
            <Callout intent={Intent.DANGER} icon="error" title="Agent error">
              {triage.error.message}
            </Callout>
          )}

          {triage.data?.paused && (
            <Callout intent={Intent.WARNING} icon="help" title="Agent paused for clarification">
              <p className="mb-2 text-sm font-medium">{triage.data.paused.question}</p>
              <p className="text-xs text-muted-foreground">{triage.data.paused.contextSummary}</p>
            </Callout>
          )}

          {history.length === 0 && !triage.isPending && !triage.isError && (
            <NonIdealState
              icon={<Icon icon="trash" size={32} className="text-muted-foreground/40" />}
              title="No triage yet"
              description="Describe the spoilage risk above. The agent will check the safe-window forecast, recent waste pattern, and whether a sister property needs the stock before suggesting a write-off."
            />
          )}

          {history.length === 0 && triage.isPending && (
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

          {triage.isPending && history.length > 0 && (
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
  for (const key of ['logId', 'transferId', 'restockId', 'newLogId']) {
    const v = d[key]
    if (typeof v === 'string') return v
  }
  return undefined
}

function resultingNodeTypeFor(actionType: BeaconAction['type']): string {
  switch (actionType) {
    case 'WRITE_OFF':         return 'stock_log'
    case 'TRANSFER_STOCK':    return 'stock_transfer'
    case 'ADJUST_STOCK':      return 'stock_log'
    default:                  return actionType
  }
}
