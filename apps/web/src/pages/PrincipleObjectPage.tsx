// Principle Object View — operator NL feedback injected into agent prompts.

import { useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Icon, Intent, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { fetchPrinciple, setPrincipleActive } from '@/features/principles/api'
import { AuditRail } from '@/components/AuditRail'
import { ObjectHeaderBand } from '@/components/ObjectHeaderBand'

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
    <div className="flex h-full flex-col overflow-hidden">
      <ObjectHeaderBand
        breadcrumb={{ label: 'Principles', to: '/settings?section=principles' }}
        icon="learning"
        title="Principle"
        star={{ id: `principle:${row.id}`, label: row.body, subtitle: `Principle · ${row.category}`, path: `/principles/${principleId}`, icon: 'learning' }}
        tags={
          <>
            <Tag minimal intent={CATEGORY_INTENT[row.category] ?? Intent.NONE}>{row.category}</Tag>
            <Tag minimal intent={row.active ? Intent.SUCCESS : Intent.NONE}>{row.active ? 'active' : 'retired'}</Tag>
          </>
        }
        id={row.id}
      />

      {/* Metric strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border shrink-0">
        <Metric label="Category" value={row.category} />
        <Metric label="Status"   value={row.active ? 'Active' : 'Retired'} />
        <Metric label="Created"  value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} />
        <Metric label="Scope"    value={row.applies_to_node_ids.length > 0 ? `${String(row.applies_to_node_ids.length)} node(s)` : 'global'} />
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

        {row.applies_to_node_ids.length > 0 && (
          <Section title="Applies to" icon="cube" subtitle="Specific nodes this principle narrows to. When empty, the principle applies globally to the hotel.">
            <Card>
              <ul className="text-[11px] font-mono space-y-0.5">
                {row.applies_to_node_ids.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </Card>
          </Section>
        )}

        <Section title="Audit" icon="time">
          <Card className="text-xs space-y-1">
            <div>Authored by user <span className="font-mono">{row.authored_by_user_id}</span></div>
            <div>Created {new Date(row.created_at).toISOString()}</div>
            {row.deactivated_at && <div>Retired {new Date(row.deactivated_at).toISOString()}</div>}
          </Card>
        </Section>
       </div>
       <AuditRail nodeType="principle" nodeId={row.id} />
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

function Section({ title, icon, subtitle, children }: { title: string; icon: 'lightbulb' | 'cube' | 'time'; subtitle?: string; children: React.ReactNode }) {
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
