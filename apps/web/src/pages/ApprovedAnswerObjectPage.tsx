// Approved Answer Object View — the tier-1 cache served before any fresh LLM
// call. Its metrics are the flywheel's cheapest evidence: an answer with a high
// hit count is a question the operator stopped paying a model to answer.

import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Intent, NonIdealState, Spinner, Tag } from '@blueprintjs/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { fetchApprovedAnswer, retireApprovedAnswer } from '@/features/approvedAnswers/api'
import { AuditRail } from '@/components/AuditRail'
import { ObjectViewFrame } from '@/components/ObjectViewFrame'
import { OBJECT_PRESENTATION } from '@/lib/objectPresentation'
import { Metric } from '@/components/MetricStrip'
import { ObjectSection } from '@/components/ObjectSection'

export default function ApprovedAnswerObjectPage() {
  const { answerId = '' } = useParams<{ answerId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: row, isLoading } = useQuery({
    queryKey: ['approved-answer', answerId],
    queryFn: () => fetchApprovedAnswer(answerId),
    enabled: !!answerId,
  })

  const retire = useMutation({
    mutationFn: () => retireApprovedAnswer(answerId),
    onSuccess: () => {
      toast.success('Answer retired')
      void qc.invalidateQueries({ queryKey: ['approved-answer', answerId] })
    },
    onError: (err: Error) => { toast.error(err.message) },
  })

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner intent={Intent.PRIMARY} /></div>
  }
  if (!row) {
    return (
      <NonIdealState
        icon="search-template"
        title="Approved answer not found"
        action={<Button onClick={() => { void navigate('/mind?aip=answers') }}>Back to Approved Answers</Button>}
      />
    )
  }

  const active = row.retired_at === null
  return (
    <ObjectViewFrame
      header={{
        breadcrumb: OBJECT_PRESENTATION.approved_answer.home,
        icon: OBJECT_PRESENTATION.approved_answer.icon,
        title: 'Approved Answer',
        star: {
          id: `approved_answer:${row.id}`, label: row.question, subtitle: 'Approved Answer',
          path: `/answers/${answerId}`, icon: 'bookmark',
        },
        tags: <Tag minimal intent={active ? Intent.SUCCESS : Intent.NONE}>{active ? 'active' : 'retired'}</Tag>,
        id: row.id,
      }}
      metrics={
        <>
        <Metric label="Times served" value={String(row.hit_count)} capitalize />
        <Metric label="Last served"
          value={row.last_served_at ? formatDistanceToNow(new Date(row.last_served_at), { addSuffix: true }) : 'never'}
          capitalize />
        <Metric label="Status" value={active ? 'Active' : 'Retired'} capitalize />
        <Metric label="Curated" value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} capitalize />
        </>
      }
      actions={
        active ? (
          <Button intent={Intent.DANGER} variant="minimal" icon="disable" loading={retire.isPending}
            onClick={() => { retire.mutate() }}>
            Retire
          </Button>
        ) : null
      }
      rail={<AuditRail nodeType="approved_answer" nodeId={row.id} />}
    >
      <ObjectSection title="Question" icon="help">
        <Card><p className="text-sm leading-relaxed">{row.question}</p></Card>
      </ObjectSection>

      <ObjectSection title="Answer" icon="bookmark"
        subtitle="Served verbatim when a question matches — before any fresh LLM call.">
        <Card><p className="text-sm leading-relaxed whitespace-pre-wrap">{row.answer}</p></Card>
      </ObjectSection>

      <ObjectSection title="Audit" icon="time">
        <Card className="text-xs space-y-1">
          <div>Curated by user <span className="font-mono">{row.curated_by_user_id}</span></div>
          <div>Created {new Date(row.created_at).toISOString()}</div>
          {row.source_message_id && <div>From message <span className="font-mono">{row.source_message_id}</span></div>}
          {row.retired_at && <div>Retired {new Date(row.retired_at).toISOString()}</div>}
        </Card>
      </ObjectSection>
    </ObjectViewFrame>
  )
}
