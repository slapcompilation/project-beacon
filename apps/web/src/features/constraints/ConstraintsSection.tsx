// AIP constraint engine — operator-facing management surface inside Settings.
// Authoring: NL text → heuristic categorizer (Phase 5 swaps in LLM) → row.
// Toggle to deactivate; deactivated rows linger for audit but stop firing.

import { useState } from 'react'
import {
  Button, Callout, Card, FormGroup, HTMLSelect, Icon, Intent,
  NonIdealState, Spinner, SpinnerSize, Switch, Tag, TextArea,
} from '@blueprintjs/core'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAllConstraints, useCreateConstraint, useSetConstraintActive } from './hooks'
import { categorizeConstraint } from './categorizer'
import type { ConstraintRow } from './api'

const ACTION_TYPE_OPTIONS = [
  { value: '',                 label: 'All action types' },
  { value: 'REQUEST_RESTOCK',  label: 'REQUEST_RESTOCK' },
  { value: 'TRANSFER_STOCK',   label: 'TRANSFER_STOCK' },
  { value: 'ADJUST_STOCK',     label: 'ADJUST_STOCK' },
  { value: 'WRITE_OFF',        label: 'WRITE_OFF' },
]

const BUCKET_INTENT: Record<string, Intent> = {
  'scope':       Intent.PRIMARY,
  'threshold':   Intent.WARNING,
  'time-window': Intent.NONE,
  'actor-role':  Intent.DANGER,
}

export function ConstraintsSection() {
  const { data: rows = [], isLoading } = useAllConstraints()
  const create = useCreateConstraint()
  const setActive = useSetConstraintActive()
  const [body, setBody] = useState('')
  const [appliesTo, setAppliesTo] = useState('')
  const [severity, setSeverity] = useState<'hard' | 'soft'>('hard')

  const preview = body.trim().length > 0 ? categorizeConstraint(body.trim()) : null

  const handleCreate = () => {
    if (!preview || !body.trim()) return
    create.mutate(
      {
        body: body.trim(),
        bucket: preview.bucket,
        typedRule: preview.typedRule,
        severity,
        appliesToActionTypes: appliesTo ? [appliesTo] : preview.appliesToActionTypes,
      },
      {
        onSuccess: () => {
          setBody('')
          setAppliesTo('')
          setSeverity('hard')
        },
      },
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-semibold">Constraints</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Natural-language rules the action registry checks before every mutation. Hard violations reject the action; soft violations require higher approval.
        </p>
      </div>

      <Card className="mb-4 space-y-3">
        <FormGroup
          label="New constraint"
          helperText="e.g. “no restock above 500 units”, “only admins can write off”, “no transfers after 6pm”"
        >
          <TextArea
            value={body}
            onChange={(e) => { setBody(e.target.value) }}
            placeholder="Describe the rule in plain language"
            fill
            rows={2}
          />
        </FormGroup>

        {preview && (
          <Callout intent={preview.confident ? Intent.PRIMARY : Intent.WARNING} icon="lightbulb">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wider opacity-70">Categorized as</span>
              <Tag minimal intent={BUCKET_INTENT[preview.bucket]}>{preview.bucket}</Tag>
              {!preview.confident && (
                <span className="text-muted-foreground italic">
                  low confidence — review before saving
                </span>
              )}
            </div>
            <pre className="text-[10px] text-muted-foreground mt-1 font-mono whitespace-pre-wrap">
              {JSON.stringify(preview.typedRule, null, 2)}
            </pre>
          </Callout>
        )}

        <div className="flex items-end gap-3">
          <FormGroup label="Applies to action type" className="flex-1 mb-0">
            <HTMLSelect
              value={appliesTo}
              onChange={(e) => { setAppliesTo(e.target.value) }}
              options={ACTION_TYPE_OPTIONS}
              fill
            />
          </FormGroup>
          <FormGroup label="Severity" className="mb-0">
            <HTMLSelect
              value={severity}
              onChange={(e) => { setSeverity(e.target.value as 'hard' | 'soft') }}
              options={[
                { value: 'hard', label: 'Hard — rejects' },
                { value: 'soft', label: 'Soft — flags' },
              ]}
            />
          </FormGroup>
          <Button
            intent={Intent.PRIMARY}
            icon="add"
            disabled={!preview || !body.trim() || create.isPending}
            loading={create.isPending}
            onClick={handleCreate}
          >
            Save constraint
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <NonIdealState
            icon="shield"
            title="No constraints yet"
            description="Add a rule above. Constraints are evaluated on every mutation, including AI-proposed actions."
          />
        )}

        {rows.map((row) => (
          <ConstraintRowCard
            key={row.id}
            row={row}
            onToggle={(active) => { setActive.mutate({ id: row.id, active }) }}
            toggleDisabled={setActive.isPending}
          />
        ))}
      </div>
    </div>
  )
}

interface RowCardProps {
  row: ConstraintRow
  onToggle: (active: boolean) => void
  toggleDisabled: boolean
}

function ConstraintRowCard({ row, onToggle, toggleDisabled }: RowCardProps) {
  return (
    <Card className={cn('flex items-start justify-between gap-4', !row.active && 'opacity-50')}>
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={BUCKET_INTENT[row.bucket]}>{row.bucket}</Tag>
          <Tag minimal intent={row.severity === 'hard' ? Intent.DANGER : Intent.WARNING}>
            {row.severity}
          </Tag>
          {row.applies_to_action_types.length > 0 && (
            <Tag minimal>{row.applies_to_action_types.join(', ')}</Tag>
          )}
          <Link
            to={`/constraints/${row.id}`}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          >
            <Icon icon="document-open" size={10} />
            Open
          </Link>
        </div>
        <p className="text-sm">{row.body}</p>
        <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap">
          {JSON.stringify(row.typed_rule)}
        </pre>
      </div>
      <Switch
        checked={row.active}
        disabled={toggleDisabled}
        onChange={(e) => { onToggle(e.currentTarget.checked) }}
        labelElement={<span className="text-xs">{row.active ? 'Active' : 'Off'}</span>}
        large
      />
    </Card>
  )
}
