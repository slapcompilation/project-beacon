// Principle Object View — operator NL feedback injected into agent prompts.

import { useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Intent, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { fetchPrinciple, setPrincipleActive } from '@/features/principles/api'
import { AuditRail } from '@/components/AuditRail'
import { ObjectViewFrame } from '@/components/ObjectViewFrame'
import { OBJECT_PRESENTATION } from '@/lib/objectPresentation'
import { Metric } from '@/components/MetricStrip'
import { ObjectSection } from '@/components/ObjectSection'

const CATEGORY_INTENT: Record<string, Intent> = {
  'inventory-policy':    Intent.PRIMARY,
  'supplier-preference': Intent.NONE,
  'time-window':         Intent.WARNING,
  'budget':              Intent.SUCCESS,
  'compliance':          Intent.DANGER,
  'other':               Intent.NONE,
}

export default function PrincipleObjectPage() {
  const { principleId = '' } = useParams<{ principleId: string }>()
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const { data: row, isLoading } = useQuery({
    queryKey: ['principle', principleId],
    queryFn:  () => fetchPrinciple(principleId),
    enabled:  !!principleId,
  })

  const toggle = useMutation({
    mutationFn: (active: boolean) => setPrincipleActive(principleId, active),
    onSuccess: () => {
      toast.success('Principle updated')
      void qc.invalidateQueries({ queryKey: ['principle', principleId] })
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
        title="Principle not found"
        action={<Button onClick={() => { void navigate('/settings?section=principles') }}>Back to Principles</Button>}
      />
    )
  }

  return (
    <ObjectViewFrame
      header={{
        breadcrumb: OBJECT_PRESENTATION.principle.home,
        icon: OBJECT_PRESENTATION.principle.icon,
        title: 'Principle',
        star: { id: `principle:${row.id}`, label: row.body, subtitle: `Principle · ${row.category}`, path: `/principles/${principleId}`, icon: 'learning' },
        tags: (
          <>
            <Tag minimal intent={CATEGORY_INTENT[row.category] ?? Intent.NONE}>{row.category}</Tag>
            <Tag minimal intent={row.active ? Intent.SUCCESS : Intent.NONE}>{row.active ? 'active' : 'retired'}</Tag>
          </>
        ),
        id: row.id,
      }}

      metrics={
        <>
        <Metric label="Category" value={row.category} capitalize />
        <Metric label="Status"   value={row.active ? 'Active' : 'Retired'} capitalize />
        <Metric label="Created"  value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} capitalize />
        <Metric label="Scope"    value={row.applies_to_node_ids.length > 0 ? `${String(row.applies_to_node_ids.length)} node(s)` : 'global'} capitalize />
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
      rail={<AuditRail nodeType="principle" nodeId={row.id} />}
    >

      {/* Body */}
        <ObjectSection title="Body" icon="lightbulb">
          <Card><p className="text-sm leading-relaxed">{row.body}</p></Card>
        </ObjectSection>

        {row.applies_to_node_ids.length > 0 && (
          <ObjectSection title="Applies to" icon="cube" subtitle="Specific nodes this principle narrows to. When empty, the principle applies globally to the hotel.">
            <Card>
              <ul className="text-[11px] font-mono space-y-0.5">
                {row.applies_to_node_ids.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </Card>
          </ObjectSection>
        )}

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

