// Flywheel on-ramp: turn a proposal the operator is reviewing into a reusable
// rule, in context, without hunting for the Principles/Constraints tabs.
//
// Principle  → soft NL guidance injected into the agent's prompt next run.
// Constraint → a typed gate evaluated at action submission (hard/soft).
//
// Both pre-fill an editable suggestion derived from the proposal so the operator
// is one edit + click from teaching the system — the missing path that left
// Principles + Constraints empty.

import { useEffect, useState } from 'react'
import {
  Button, Callout, Dialog, DialogBody, DialogFooter, Intent,
  SegmentedControl, Tag, TextArea,
} from '@blueprintjs/core'
import { useCreatePrinciple } from '@/features/principles/hooks'
import { useCreateConstraint } from '@/features/constraints/hooks'
import { categorizeConstraint } from '@/features/constraints/categorizer'
import { resolveConstraintCategory } from '@/features/constraints/aiCategorizer'

export interface TeachRuleContext {
  actionType: string
  agentName:  string
  /** e.g. "Soda Water" — used to scope the suggested wording when known. */
  variantLabel?: string
  /** Quantity from the action, if the type carries one. */
  quantity?: number
}

type Mode = 'principle' | 'constraint'

export function TeachRuleDialog({
  open, onClose, context,
}: {
  open: boolean
  onClose: () => void
  context: TeachRuleContext
}) {
  const [mode, setMode] = useState<Mode>('principle')
  const [body, setBody] = useState('')
  const createPrinciple  = useCreatePrinciple()
  const createConstraint = useCreateConstraint()

  // Re-seed the suggestion whenever the dialog opens or the mode flips, but
  // never clobber edits the operator already made within a session.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!open) { setTouched(false); return }
    if (!touched) setBody(suggest(mode, context))
  }, [open, mode, touched, context])

  const preview = mode === 'constraint' && body.trim().length > 0
    ? categorizeConstraint(body.trim())
    : null

  const [resolving, setResolving] = useState(false)
  const pending  = createPrinciple.isPending || createConstraint.isPending
  const disabled = pending || resolving || body.trim().length === 0

  const submit = () => {
    const text = body.trim()
    if (mode === 'principle') {
      createPrinciple.mutate(text, { onSuccess: () => { onClose() } })
      return
    }
    if (!preview) return
    setResolving(true)
    // Heuristic preview is instant; LLM upgrades it at save when unsure.
    void resolveConstraintCategory(text)
      .then((cat) => {
        createConstraint.mutate(
          {
            body: text,
            bucket: cat.bucket,
            typedRule: cat.typedRule,
            appliesToActionTypes: cat.appliesToActionTypes.length > 0 ? cat.appliesToActionTypes : [context.actionType],
          },
          { onSuccess: () => { onClose() } },
        )
      })
      .finally(() => { setResolving(false) })
  }

  return (
    <Dialog isOpen={open} onClose={onClose} title="Teach the system a rule" icon="learning">
      <DialogBody>
        <SegmentedControl
          fill
          value={mode}
          onValueChange={(v) => { setMode(v as Mode) }}
          options={[
            { value: 'principle',  label: 'Principle (soft guidance)' },
            { value: 'constraint', label: 'Constraint (hard gate)' },
          ]}
        />

        <p className="text-[11px] text-muted-foreground mt-2 mb-3">
          {mode === 'principle'
            ? 'Injected into the agent’s prompt on its next run as soft guidance. Good for "prefer", "be cautious", "lean toward".'
            : 'Evaluated at action submission. A hard violation blocks the action; soft requires a higher approval tier. Good for "never", "no more than", "only after".'}
        </p>

        <TextArea
          fill
          rows={3}
          value={body}
          onChange={(e) => { setTouched(true); setBody(e.target.value) }}
          placeholder={mode === 'principle'
            ? 'e.g. Prefer lateral transfers over external purchase for mixers.'
            : 'e.g. Never auto-approve REQUEST_RESTOCK over 200 units.'}
        />

        {mode === 'constraint' && preview && (
          <div className="mt-2 text-[11px] space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Categorized as</span>
              <Tag minimal intent={Intent.PRIMARY}>{preview.bucket}</Tag>
              {!preview.confident && (
                <Tag minimal intent={Intent.WARNING} icon="warning-sign">low confidence — review</Tag>
              )}
            </div>
            <pre className="bg-surface-2 rounded p-2 border border-border/40 overflow-x-auto font-mono text-[10px]">
              {JSON.stringify(preview.typedRule, null, 2)}
            </pre>
          </div>
        )}

        <Callout intent={Intent.NONE} icon="info-sign" compact className="mt-3 !text-[11px]">
          From <span className="font-mono">{context.agentName}</span> ·{' '}
          <span className="font-mono">{context.actionType}</span>
          {context.variantLabel ? <> · {context.variantLabel}</> : null}
        </Callout>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={onClose} disabled={pending}>Cancel</Button>
            <Button intent={Intent.PRIMARY} icon="learning" onClick={submit} loading={pending} disabled={disabled}>
              Save {mode}
            </Button>
          </>
        }
      />
    </Dialog>
  )
}

function suggest(mode: Mode, c: TeachRuleContext): string {
  const where = c.variantLabel ? ` for ${c.variantLabel}` : ''
  if (mode === 'principle') {
    return `Be more conservative when ${c.agentName} proposes ${c.actionType}${where}.`
  }
  const cap = c.quantity ? ` over ${String(c.quantity)} units` : ''
  return `Never auto-approve ${c.actionType}${cap}${where}.`
}

/** Helper for callers: pull the quantity off whichever action carries one. */
export function actionQuantity(action: { quantityNeeded?: number; quantity?: number }): number | undefined {
  return action.quantityNeeded ?? action.quantity
}
