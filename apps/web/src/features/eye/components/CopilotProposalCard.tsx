// Renders one action proposal the copilot emitted as a typed BeaconAction.
// Two paths: "Apply" dispatches directly with the params the agent provided;
// "Edit & apply" opens ActionFormModal pre-filled so the operator can tweak
// any field before dispatch.

import { useState } from 'react'
import { Button, Card, Icon, Intent, Tag } from '@blueprintjs/core'
import { toast } from 'sonner'
import { actionDescriptors, type BeaconAction } from '@beacon/reality-graph'
import { ActionFormModal } from '@/features/actions/ActionFormModal'
import { dispatchAction } from '@/lib/actions/dispatch'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import type { ActionProposal } from '@/features/eye/hooks/useCopilotChat'

interface Props {
  proposal: ActionProposal
}

export function CopilotProposalCard({ proposal }: Props) {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const [editOpen, setEditOpen]   = useState(false)
  const [applying, setApplying]   = useState(false)
  const [done, setDone]           = useState<'applied' | null>(null)

  // proposal.action arrives as a plain string from the edge function. Verify
  // it's actually one of our typed BeaconAction['type']s before narrowing.
  const recognized = proposal.action in actionDescriptors
  const actionType = proposal.action as BeaconAction['type']
  const descriptor = recognized ? actionDescriptors[actionType] : null

  // Suggest-time constraint check (#7). A hard violation blocks Apply outright —
  // the same rule would reject it at dispatch, surfaced here so the operator
  // doesn't click Apply only to be turned away. Soft violations just warn.
  const violations = proposal.violations ?? []
  const hardViolations = violations.filter((v) => v.severity === 'hard')
  const blocked = hardViolations.length > 0

  const handleApply = () => {
    if (!recognized || !hotelId || !userId || blocked) return
    setApplying(true)
    void (async () => {
      try {
        const merged: Record<string, unknown> = {
          type:    actionType,
          ...proposal.params,
          hotelId: hotelId,
          userId,
          requestorId: userId,
        }
        const result = await dispatchAction(
          merged as unknown as BeaconAction,
          { hotelId, actorId: userId, triggeredBy: 'ai_proposal_accepted' },
        )
        if (!result.success) {
          toast.error(result.error.message)
          return
        }
        setDone('applied')
        toast.success(`${actionType} applied`)
      } finally {
        setApplying(false)
      }
    })()
  }

  return (
    <Card className="flex flex-col gap-2 border-l-2 border-l-violet-500">
      <header className="flex items-center gap-2 flex-wrap">
        <Icon icon="cog" size={12} className="text-violet-500" />
        <Tag minimal intent={Intent.PRIMARY} className="font-mono text-[10px]">{actionType}</Tag>
        {!recognized && <Tag minimal intent={Intent.WARNING}>unrecognized action</Tag>}
        {blocked && <Tag minimal intent={Intent.DANGER} icon="ban-circle">blocked by constraint</Tag>}
        {!blocked && violations.length > 0 && <Tag minimal intent={Intent.WARNING} icon="warning-sign">needs approval</Tag>}
        {done === 'applied' && <Tag minimal intent={Intent.SUCCESS} icon="tick">Applied</Tag>}
        <span className="text-[10px] text-muted-foreground ml-auto">copilot proposal</span>
      </header>

      {violations.length > 0 && (
        <ul className="space-y-1 rounded bg-muted/50 px-2 py-1.5">
          {violations.map((v) => (
            <li key={v.constraintId} className="flex items-start gap-1.5 text-[11px] leading-snug">
              <Icon
                icon={v.severity === 'hard' ? 'ban-circle' : 'warning-sign'}
                size={11}
                className={v.severity === 'hard' ? 'text-red-600 mt-0.5' : 'text-amber-600 mt-0.5'}
              />
              <span>
                <span className="font-medium">{v.body}</span>
                <span className="text-muted-foreground"> — {v.message}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {proposal.message && (
        <p className="text-xs text-muted-foreground leading-relaxed">{proposal.message}</p>
      )}

      {Object.keys(proposal.params).length > 0 && (
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {Object.entries(proposal.params).map(([k, v]) => (
            <div key={k} className="font-mono">
              <span className="text-foreground/80">{k}</span>
              <span className="opacity-60"> · </span>
              <span>{formatValue(v)}</span>
            </div>
          ))}
        </div>
      )}

      <footer className="flex items-center justify-end gap-2 flex-wrap">
        {blocked && (
          <span className="mr-auto text-[10px] text-red-600">Blocked — resolve the constraint or adjust the request.</span>
        )}
        {recognized && hotelId && userId && (
          <Button
            variant="minimal"
            size="small"
            icon="edit"
            disabled={applying || done === 'applied' || blocked}
            onClick={() => { setEditOpen(true) }}
          >
            Edit &amp; apply
          </Button>
        )}
        <Button
          intent={Intent.PRIMARY}
          size="small"
          icon="tick"
          loading={applying}
          disabled={!recognized || !hotelId || !userId || done === 'applied' || blocked}
          onClick={handleApply}
        >
          {done === 'applied' ? 'Applied' : 'Apply'}
        </Button>
      </footer>

      {recognized && descriptor && hotelId && userId && (
        <ActionFormModal
          open={editOpen}
          onClose={() => { setEditOpen(false) }}
          actionType={actionType}
          context={{ hotelId, userId, requestorId: userId, ...proposal.params }}
          initialValues={proposal.params}
          dispatchContext={{ hotelId, actorId: userId, triggeredBy: 'ai_proposal_accepted' }}
          titleOverride={`Edit &amp; apply · ${descriptor.title}`}
          onSuccess={() => { setDone('applied') }}
        />
      )}
    </Card>
  )
}

function formatValue(v: unknown): string {
  if (v == null) return 'null'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}
