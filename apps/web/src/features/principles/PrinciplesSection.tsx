// Operator-facing surface for principles. NL textarea → LLM-as-categorizer
// via the agent-llm edge function → typed PrincipleCategory → persisted row.
// Active rows get injected into agent prompts (see useRestockAdvisor).

import { useState } from 'react'
import {
  Button, Card, FormGroup, Icon, Intent,
  NonIdealState, Spinner, SpinnerSize, Switch, Tag, TextArea,
} from '@blueprintjs/core'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { PrincipleCategory } from '@beacon/reality-graph'
import { useAllPrinciples, useCreatePrinciple, useSetPrincipleActive } from './hooks'
import type { PrincipleRow } from './api'

const CATEGORY_INTENT: Record<PrincipleCategory, Intent> = {
  'inventory-policy':    Intent.PRIMARY,
  'supplier-preference': Intent.NONE,
  'time-window':         Intent.WARNING,
  'budget':              Intent.SUCCESS,
  'compliance':          Intent.DANGER,
  'other':               Intent.NONE,
}

export function PrinciplesSection() {
  const { data: rows = [], isLoading } = useAllPrinciples()
  const create = useCreatePrinciple()
  const setActive = useSetPrincipleActive()
  const [body, setBody] = useState('')

  const handleCreate = () => {
    if (!body.trim()) return
    create.mutate(body.trim(), {
      onSuccess: () => { setBody('') },
    })
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-semibold">Principles</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Operator guidance the agent respects when reasoning. Plain-language rules — categorized automatically and injected into prompts so future runs reflect your feedback.
        </p>
      </div>

      <Card className="mb-4 space-y-3">
        <FormGroup
          label="New principle"
          helperText='e.g. "Prefer Sysco over BudgetCo for produce", "Never restock past 6pm on Fridays"'
        >
          <TextArea
            value={body}
            onChange={(e) => { setBody(e.target.value) }}
            placeholder="Describe the guidance in plain language"
            fill
            rows={2}
          />
        </FormGroup>
        <div className="flex items-center justify-end gap-2">
          <Button
            intent={Intent.PRIMARY}
            icon="add"
            disabled={!body.trim() || create.isPending}
            loading={create.isPending}
            onClick={handleCreate}
          >
            Save principle
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
            icon={<Icon icon="learning" size={32} className="text-muted-foreground/40" />}
            title="No principles yet"
            description="Add one above. Agents will inject active principles into their reasoning, so corrections propagate without retraining."
          />
        )}

        {rows.map((row) => (
          <PrincipleRowCard
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
  row: PrincipleRow
  onToggle: (active: boolean) => void
  toggleDisabled: boolean
}

function PrincipleRowCard({ row, onToggle, toggleDisabled }: RowCardProps) {
  return (
    <Card className={cn('flex items-start justify-between gap-4', !row.active && 'opacity-50')}>
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={CATEGORY_INTENT[row.category]}>{row.category}</Tag>
          <Link
            to={`/principles/${row.id}`}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          >
            <Icon icon="document-open" size={10} />
            Open
          </Link>
        </div>
        <p className="text-sm">{row.body}</p>
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
