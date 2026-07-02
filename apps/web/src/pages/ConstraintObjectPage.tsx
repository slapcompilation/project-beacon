// Constraint Object View — operator NL rule the dispatcher gates actions on.

import { useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Icon, Intent, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { fetchConstraint, setConstraintActive } from '@/features/constraints/api'
import { AuditRail } from '@/components/AuditRail'
import { ObjectHeaderBand } from '@/components/ObjectHeaderBand'

const BUCKET_INTENT: Record<string, Intent> = {
  'scope':       Intent.PRIMARY,
  'threshold':   Intent.WARNING,
  'time-window': Intent.NONE,
  'actor-role':  Intent.DANGER,
}

export default function ConstraintObjectPage() {
  const { constraintId = '' } = useParams<{ constraintId: string }>()
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const { data: row, isLoading } = useQuery({
    queryKey: ['constraint', constraintId],
    queryFn:  () => fetchConstraint(constraintId),
    enabled:  !!constraintId,
  })

  const toggle = useMutation({
    mutationFn: (active: boolean) => setConstraintActive(constraintId, active),
    onSuccess: () => {
      toast.success('Constraint updated')
      void qc.invalidateQueries({ queryKey: ['constraint', constraintId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner intent={Intent.PRIMARY} /></div>
  }
  if (!row) {
    return (
      <NonIdealState
        icon="search-template"
        title="Constraint not found"
        action={<Button onClick={() => { void navigate('/settings?section=constraints') }}>Back to Constraints</Button>}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ObjectHeaderBand
        breadcrumb={{ label: 'Constraints', to: '/settings?section=constraints' }}
        icon="shield"
        title="Constraint"
        star={{ id: `constraint:${row.id}`, label: row.body, subtitle: `Constraint · ${row.bucket}`, path: `/constraints/${constraintId}`, icon: 'shield' }}
        tags={
          <>
            <Tag minimal intent={BUCKET_INTENT[row.bucket] ?? Intent.NONE}>{row.bucket}</Tag>
            <Tag minimal intent={row.severity === 'hard' ? Intent.DANGER : Intent.WARNING}>{row.severity}</Tag>
            <Tag minimal intent={row.active ? Intent.SUCCESS : Intent.NONE}>{row.active ? 'active' : 'retired'}</Tag>
          </>
        }
        id={row.id}
      />

      {/* Metric strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border shrink-0">
        <Metric label="Bucket"   value={row.bucket} />
        <Metric label="Severity" value={row.severity} />
        <Metric label="Scope"    value={row.applies_to_action_types.length > 0 ? `${String(row.applies_to_action_types.length)} action(s)` : 'all actions'} />
        <Metric label="Created"  value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-2 px-6 py-3 border-b shrink-0">
        <Button
          intent={row.active ? Intent.DANGER : Intent.PRIMARY}
          variant={row.active ? 'minimal' : undefined}
          icon={row.active ? 'disable' : 'tick'}
          loading={toggle.isPending}
          onClick={() => { toggle.mutate(!row.active) }}
        >
          {row.active ? 'Retire' : 'Reactivate'}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex gap-4">
       <div className="flex-1 min-w-0 space-y-4">
        <Section title="Body" icon="lightbulb">
          <Card><p className="text-sm leading-relaxed">{row.body}</p></Card>
        </Section>

        <Section title="Typed rule" icon="cog" subtitle="Categorized payload the evaluator runs against incoming actions.">
          <Card>
            <pre className="text-[11px] font-mono whitespace-pre-wrap">{JSON.stringify(row.typed_rule, null, 2)}</pre>
          </Card>
        </Section>

        {row.applies_to_action_types.length > 0 && (
          <Section title="Applies to action types" icon="cube" subtitle="When empty, the constraint applies to every dispatched action.">
            <Card>
              <div className="flex items-center gap-2 flex-wrap">
                {row.applies_to_action_types.map((t) => (
                  <Tag key={t} minimal className="font-mono text-[10px]">{t}</Tag>
                ))}
              </div>
            </Card>
          </Section>
        )}

        <Section title="Effect" icon="warning-sign">
          <Card className="text-xs space-y-1">
            {row.severity === 'hard' ? (
              <p>
                <span className="font-semibold text-red-600 dark:text-red-400">Hard:</span> actions matching this rule are <em>rejected at submission</em>.
              </p>
            ) : (
              <p>
                <span className="font-semibold text-amber-600 dark:text-amber-400">Soft:</span> actions matching this rule are <em>paused</em> for higher-tier review on the Pending Approvals queue.
              </p>
            )}
          </Card>
        </Section>

        <Section title="Audit" icon="time">
          <Card className="text-xs space-y-1">
            <div>Authored by user <span className="font-mono">{row.authored_by_user_id}</span></div>
            <div>Created {new Date(row.created_at).toISOString()}</div>
            {row.deactivated_at && <div>Retired {new Date(row.deactivated_at).toISOString()}</div>}
          </Card>
        </Section>
       </div>
       <AuditRail nodeType="constraint" nodeId={row.id} />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-semibold capitalize">{value}</div>
    </div>
  )
}

function Section({ title, icon, subtitle, children }: { title: string; icon: 'lightbulb' | 'cog' | 'cube' | 'warning-sign' | 'time'; subtitle?: string; children: React.ReactNode }) {
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
