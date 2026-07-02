// Action Chain Object View — list of steps + add/remove + commit/discard.
// Uniform anatomy: header → metric strip → action bar → body sections → audit rail.

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Callout, Card, HTMLSelect,
  Icon, Intent, NonIdealState, Spinner, Tag, TextArea,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { actionDescriptors, type BeaconAction } from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import {
  useActionChain,
  useAppendActionChainStep,
  useCommitActionChain,
  useDiscardActionChain,
  useRemoveActionChainStep,
  useUpdateActionChainNotes,
} from '@/features/actionChains/hooks'
import { AuditRail } from '@/components/AuditRail'
import { ObjectHeaderBand } from '@/components/ObjectHeaderBand'
import { ActionFormModal } from '@/features/actions/ActionFormModal'

const PICKABLE_ACTIONS = Object.keys(actionDescriptors).map((type) => ({
  type: type as BeaconAction['type'],
  title: actionDescriptors[type as BeaconAction['type']].title,
}))

export default function ActionChainObjectPage() {
  const { chainId = '' } = useParams<{ chainId: string }>()
  const navigate    = useNavigate()
  const hotelId     = useActiveHotelId()
  const userId      = useAuthStore((s) => s.userId)
  const { data: row, isLoading } = useActionChain(chainId)

  const append     = useAppendActionChainStep()
  const remove     = useRemoveActionChainStep()
  const commit     = useCommitActionChain()
  const discard    = useDiscardActionChain()
  const updateNotes = useUpdateActionChainNotes()

  const [actionType, setActionType] = useState<BeaconAction['type']>(PICKABLE_ACTIONS[0]?.type ?? 'REQUEST_RESTOCK')
  const [addOpen, setAddOpen]       = useState(false)
  const [notes, setNotes]           = useState<string | null>(null)

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner intent={Intent.PRIMARY} /></div>
  }
  if (!row) {
    return (
      <NonIdealState
        icon="search-template"
        title="Scenario not found"
        action={<Button onClick={() => { void navigate('/action-chains') }}>Back to Action Chains</Button>}
      />
    )
  }

  const isDraft  = row.status === 'draft'
  const isFork   = !!row.base_proposal_id
  const noteText = notes ?? row.notes ?? ''

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ObjectHeaderBand
        breadcrumb={{ label: 'Action Chains', to: '/action-chains' }}
        icon="link"
        title={row.title}
        star={{ id: `action_chain:${row.id}`, label: row.title, subtitle: 'Action chain', path: `/action-chains/${chainId}`, icon: 'link' }}
        tags={
          <>
            <Tag minimal intent={statusIntent(row.status)}>{row.status}</Tag>
            {isFork && <Tag minimal icon="git-branch">forked</Tag>}
          </>
        }
        id={row.id}
      />

      {/* Metric strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border shrink-0">
        <Metric label="Status" value={row.status} />
        <Metric label="Steps"  value={String(row.simulated_actions.length)} />
        <Metric label="Source" value={isFork ? 'forked' : 'clean slate'} />
        <Metric label="Age"    value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-2 px-6 py-3 border-b shrink-0 flex-wrap">
        {isDraft && (
          <>
            <HTMLSelect
              value={actionType}
              onChange={(e) => { setActionType(e.currentTarget.value as BeaconAction['type']) }}
              options={PICKABLE_ACTIONS.map((a) => ({ value: a.type, label: a.title }))}
              minimal
            />
            <Button
              variant="minimal"
              icon="add"
              onClick={() => { setAddOpen(true) }}
            >
              Try {actionType}
            </Button>

            <Button
              intent={Intent.DANGER}
              variant="minimal"
              icon="trash"
              loading={discard.isPending}
              onClick={() => { discard.mutate(row.id) }}
            >
              Discard
            </Button>
            <Button
              intent={Intent.SUCCESS}
              icon="confirm"
              loading={commit.isPending}
              disabled={row.simulated_actions.length === 0}
              onClick={() => { commit.mutate(row) }}
            >
              Commit {row.simulated_actions.length} action(s)
            </Button>
          </>
        )}
        {!isDraft && row.committed_at && (
          <span className="text-[11px] text-muted-foreground">
            Committed {formatDistanceToNow(new Date(row.committed_at), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex gap-4">
       <div className="flex-1 min-w-0 space-y-4">
        {isFork && row.base_proposal_id && (
          <Callout intent={Intent.NONE} icon="git-branch">
            Forked from{' '}
            <Link to={`/proposals/${row.base_proposal_id}`} className="font-mono underline">
              proposal {row.base_proposal_id.slice(0, 8)}
            </Link>. Commit dispatches every step below as if the operator had run them by hand; the base proposal stays unchanged.
          </Callout>
        )}

        <Section title="Steps" icon="cog" subtitle={isDraft ? 'Draft — nothing is dispatched until you click Commit.' : 'Snapshot at commit time.'}>
          {row.simulated_actions.length === 0 ? (
            <Card className="text-xs italic text-muted-foreground">
              No steps yet. Pick an action type above and click Try {actionType} to add one.
            </Card>
          ) : (
            <div className="space-y-1.5">
              {row.simulated_actions.map((action, idx) => {
                const result = row.commit_results?.[idx]
                return (
                  <Card key={idx} className="flex items-start gap-2 border-l-2 border-l-violet-500">
                    <Tag minimal intent={Intent.PRIMARY} className="font-mono text-[10px] shrink-0">{action.type}</Tag>
                    <div className="flex-1 min-w-0">
                      <pre className="text-[11px] font-mono whitespace-pre-wrap">{JSON.stringify(action, null, 2)}</pre>
                      {result?.error && (
                        <div className="text-[10px] text-red-600 dark:text-red-400 mt-1">
                          <Icon icon="warning-sign" size={10} className="mr-1" />
                          {result.error}
                        </div>
                      )}
                      {result?.result != null && !result.error && (
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">
                          <Icon icon="tick" size={10} className="mr-1" />
                          dispatched · {JSON.stringify(result.result)}
                        </div>
                      )}
                    </div>
                    {isDraft && (
                      <Button
                        variant="minimal"
                        size="small"
                        icon="cross"
                        intent={Intent.DANGER}
                        disabled={remove.isPending}
                        onClick={() => { remove.mutate({ chainId: row.id, index: idx }) }}
                      />
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </Section>

        <Section title="Notes" icon="annotation">
          <Card>
            <TextArea
              fill
              rows={3}
              value={noteText}
              disabled={!isDraft}
              placeholder="Why you forked, what you're testing, what to watch for…"
              onChange={(e) => { setNotes(e.target.value) }}
              onBlur={() => {
                if (!isDraft) return
                if ((notes ?? '') !== (row.notes ?? '')) {
                  updateNotes.mutate({ id: row.id, notes: notes ?? '' })
                }
              }}
            />
          </Card>
        </Section>

        <Section title="Audit" icon="time">
          <Card className="text-xs space-y-1">
            <div>Opened by user <span className="font-mono">{row.opened_by_user_id}</span></div>
            <div>Created {new Date(row.created_at).toISOString()}</div>
            {row.committed_at && (
              <div>Committed {new Date(row.committed_at).toISOString()} by <span className="font-mono">{row.committed_by_user_id ?? '—'}</span></div>
            )}
          </Card>
        </Section>
       </div>
       <AuditRail nodeType="action_chain" nodeId={row.id} />
      </div>

      {/* Add-step modal: ActionFormModal in capture mode. The same renderer
          the Review Queue + copilot proposal cards use, except onCapture
          (instead of dispatchContext) routes the built action into the chain
          without touching the Action Registry. */}
      {isDraft && hotelId && userId && (
        <ActionFormModal
          open={addOpen}
          onClose={() => { setAddOpen(false) }}
          actionType={actionType}
          context={{ hotelId, userId, requestorId: userId, fromHotelId: hotelId }}
          titleOverride={`Add to chain · ${actionDescriptors[actionType].title}`}
          submitLabelOverride="Add to chain"
          onCapture={(action) => {
            append.mutate(
              { chainId: row.id, action },
              { onSuccess: () => { setAddOpen(false) } },
            )
          }}
        />
      )}
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-semibold capitalize">{value}</div>
    </div>
  )
}

function Section({ title, icon, subtitle, children }: { title: string; icon: 'cog' | 'annotation' | 'time'; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground -mt-1.5 ml-6">{subtitle}</p>}
      {children}
    </section>
  )
}

function statusIntent(status: string): Intent {
  switch (status) {
    case 'draft':     return Intent.WARNING
    case 'committed': return Intent.SUCCESS
    case 'discarded': return Intent.NONE
    default:          return Intent.NONE
  }
}
