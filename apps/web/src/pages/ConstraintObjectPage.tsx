// Constraint Object View — operator NL rule the dispatcher gates actions on.

import { useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Intent, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { fetchConstraint, setConstraintActive } from '@/features/constraints/api'
import { AuditRail } from '@/components/AuditRail'
import { ObjectViewFrame } from '@/components/ObjectViewFrame'
import { OBJECT_PRESENTATION } from '@/lib/objectPresentation'
import { Metric } from '@/components/MetricStrip'
import { ObjectSection } from '@/components/ObjectSection'

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
    <ObjectViewFrame
      header={{
        breadcrumb: OBJECT_PRESENTATION.constraint.home,
        icon: OBJECT_PRESENTATION.constraint.icon,
        title: 'Constraint',
        star: { id: `constraint:${row.id}`, label: row.body, subtitle: `Constraint · ${row.bucket}`, path: `/constraints/${constraintId}`, icon: 'shield' },
        tags: (
          <>
            <Tag minimal intent={BUCKET_INTENT[row.bucket] ?? Intent.NONE}>{row.bucket}</Tag>
            <Tag minimal intent={row.severity === 'hard' ? Intent.DANGER : Intent.WARNING}>{row.severity}</Tag>
            <Tag minimal intent={row.active ? Intent.SUCCESS : Intent.NONE}>{row.active ? 'active' : 'retired'}</Tag>
          </>
        ),
        id: row.id,
      }}

      metrics={
        <>
        <Metric label="Bucket"   value={row.bucket} capitalize />
        <Metric label="Severity" value={row.severity} capitalize />
        <Metric label="Scope"    value={row.applies_to_action_types.length > 0 ? `${String(row.applies_to_action_types.length)} action(s)` : 'all actions'} capitalize />
        <Metric label="Created"  value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} capitalize />
        </>
      }
      actions={
        <>
        <Button
          intent={row.active ? Intent.DANGER : Intent.PRIMARY}
          variant={row.active ? 'minimal' : undefined}
          icon={row.active ? 'disable' : 'tick'}
          loading={toggle.isPending}
          onClick={() => { toggle.mutate(!row.active) }}
        >
          {row.active ? 'Retire' : 'Reactivate'}
        </Button>
        </>
      }
      rail={<AuditRail nodeType="constraint" nodeId={row.id} />}
    >

      {/* Body */}
        <ObjectSection title="Body" icon="lightbulb">
          <Card><p className="text-sm leading-relaxed">{row.body}</p></Card>
        </ObjectSection>

        <ObjectSection title="Typed rule" icon="cog" subtitle="Categorized payload the evaluator runs against incoming actions.">
          <Card>
            <pre className="text-[11px] font-mono whitespace-pre-wrap">{JSON.stringify(row.typed_rule, null, 2)}</pre>
          </Card>
        </ObjectSection>

        {row.applies_to_action_types.length > 0 && (
          <ObjectSection title="Applies to action types" icon="cube" subtitle="When empty, the constraint applies to every dispatched action.">
            <Card>
              <div className="flex items-center gap-2 flex-wrap">
                {row.applies_to_action_types.map((t) => (
                  <Tag key={t} minimal className="font-mono text-[10px]">{t}</Tag>
                ))}
              </div>
            </Card>
          </ObjectSection>
        )}

        <ObjectSection title="Effect" icon="warning-sign">
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
        </ObjectSection>

        <ObjectSection title="Audit" icon="time">
          <Card className="text-xs space-y-1">
            <div>Authored by user <span className="font-mono">{row.authored_by_user_id}</span></div>
            <div>Created {new Date(row.created_at).toISOString()}</div>
            {row.deactivated_at && <div>Retired {new Date(row.deactivated_at).toISOString()}</div>}
          </Card>
        </ObjectSection>
    </ObjectViewFrame>
  )
}

