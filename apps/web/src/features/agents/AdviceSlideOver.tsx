// Blueprint Drawer that invokes restock_advisor for one variant and renders
// the proposals it returns. Approve flows through dispatchAction so audit edges
// land with triggered_by = 'ai_proposal_accepted'.

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
import { useRestockAdvisor } from './useRestockAdvisor'
import { ProposalCard } from './ProposalCard'

interface Props {
  open: boolean
  onClose: () => void
  variantId: string
  variantName: string
}

export function AdviceSlideOver({ open, onClose, variantId, variantName }: Props) {
  const advisor    = useRestockAdvisor()
  const hotelId    = useActiveHotelId()
  const userId     = useAuthStore((s) => s.userId)
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState(`${variantName} running low`)

  // Reset prompt when the variant changes.
  useEffect(() => {
    setPrompt(`${variantName} running low`)
  }, [variantName])

  const run = () => {
    advisor.mutate({ variantId, variantName, prompt: prompt.trim() })
  }

  const onApprove = async (action: BeaconAction): Promise<void> => {
    if (!hotelId) throw new Error('No active hotel')
    const result = await dispatchAction(
      { ...action, triggeredBy: 'ai_proposal_accepted' } as BeaconAction,
      { hotelId, actorId: userId ?? null, triggeredBy: 'ai_proposal_accepted' },
    )
    if (!result.success) throw new Error(result.error.message)
    toast.success(`${action.type} applied`)
    void queryClient.invalidateQueries({ queryKey: ['restock'] })
  }

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Restock advice"
      icon="predictive-analysis"
      size="420px"
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
            {advisor.data ? 'Re-run with new concern' : 'Get advice'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {advisor.isPending && (
            <div className="flex items-center justify-center py-12">
              <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
            </div>
          )}

          {advisor.isError && (
            <Callout intent={Intent.DANGER} icon="error" title="Agent error">
              {advisor.error.message}
            </Callout>
          )}

          {advisor.data && !advisor.isPending && (
            <Results
              data={advisor.data}
              onApprove={onApprove}
            />
          )}

          {!advisor.data && !advisor.isPending && !advisor.isError && (
            <NonIdealState
              icon={<Icon icon="search-template" size={32} className="text-muted-foreground/40" />}
              title="No advice yet"
              description="Describe the concern above and the agent will analyze stock, consumption, sister-property inventory, and supplier options."
            />
          )}
        </div>
      </div>
    </Drawer>
  )
}

function Results({
  data,
  onApprove,
}: {
  data: NonNullable<ReturnType<typeof useRestockAdvisor>['data']>
  onApprove: (action: BeaconAction) => Promise<void>
}) {
  if (data.paused) {
    return (
      <Callout intent={Intent.WARNING} icon="help" title="Agent paused for clarification">
        <p className="mb-2 text-sm font-medium">{data.paused.question}</p>
        <p className="text-xs text-muted-foreground">{data.paused.contextSummary}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Confidence: {String(Math.round(data.paused.currentConfidence * 100))}%
        </p>
      </Callout>
    )
  }

  if (data.proposals.length === 0) {
    return (
      <Callout intent={Intent.SUCCESS} icon="tick-circle" title="No action needed">
        Current stock plus open requests cover the projected consumption window.
      </Callout>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {data.proposals.map((p, i) => (
        <ProposalCard
          key={`${p.action.type}-${String(i)}`}
          proposal={p}
          trace={data.trace}
          onApprove={onApprove}
          compact
        />
      ))}
    </div>
  )
}
