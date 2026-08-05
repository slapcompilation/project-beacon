// Generic action modal — renders from the action descriptor registry so we
// don't hand-roll one component per BeaconAction. Add a new action, declare
// its descriptor, and the modal renders automatically.
//
// On submit: merges form values + context bindings into a typed BeaconAction,
// runs validateAction, and dispatches via dispatchAction. Field-tagged errors
// from validation surface inline.

import { useEffect, useMemo, useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, DialogFooter,
  FormGroup, HTMLSelect, InputGroup, Intent, NumericInput, TextArea,
} from '@blueprintjs/core'
import {
  getActionDescriptor,
  validateAction,
  type ActionDescriptor,
  type ActionField,
  type BeaconAction,
  type ValidationResult,
} from '@beacon/reality-graph'
import { dispatchAction, type DispatchContext } from '@/lib/actions/dispatch'

type FormValue = string | number | boolean | null

export interface ActionFormModalProps {
  open: boolean
  onClose: () => void
  actionType: BeaconAction['type']
  /** Hidden bindings the operator never sees — passed straight through into the dispatched action. */
  context: Record<string, unknown>
  /** Optional preset values for visible fields (e.g. proposal payload when editing). */
  initialValues?: Record<string, unknown>
  /** Required when in dispatch mode (default). Ignored in capture mode. */
  dispatchContext?: DispatchContext
  /** Triggered after a successful dispatch. Receives the dispatch result and the
   *  built action, so callers can tell whether the operator edited it. */
  onSuccess?: (result: unknown, action: BeaconAction) => void
  /** When provided, the modal captures the built BeaconAction instead of
   *  dispatching it. Used by Action Chains for draft-safe step building —
   *  the operator's form input becomes a step in simulated_actions; nothing
   *  hits the Action Registry until the chain commits. */
  onCapture?: (action: BeaconAction) => void
  /** Fields shown read-only. Foundry's third parameter state ("disabled" —
   *  prefilled, visible, not editable), used by module Button Groups. */
  disabledFields?: ReadonlyArray<string>
  /** Custom modal title; defaults to descriptor.title. */
  titleOverride?: string
  /** Custom submit button label; defaults to descriptor.submitLabel or 'Submit'. */
  submitLabelOverride?: string
  /** Where the form is drawn. `inline` is Workshop's Inline Action widget (G3):
   *  the same fields, validation, dispatch and audit entry, rendered in the page
   *  instead of a Dialog. A second implementation of this form is the last thing
   *  the Action Registry needs. */
  chrome?: 'dialog' | 'inline'
}

export function ActionFormModal({
  open, onClose, actionType, context, initialValues,
  dispatchContext, onSuccess, onCapture, disabledFields,
  titleOverride, submitLabelOverride, chrome = 'dialog',
}: ActionFormModalProps) {
  const descriptor = useMemo(() => getActionDescriptor(actionType), [actionType])

  const [values, setValues]   = useState<Record<string, FormValue | undefined>>(() =>
    deriveInitial(descriptor, initialValues),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    // An inline form is always open, so `open` never transitions — reset on the
    // descriptor changing instead.
    if (open || chrome === 'inline') {
      setValues(deriveInitial(descriptor, initialValues))
      setFieldErrors({})
      setError(null)
    }
  }, [open, chrome, descriptor, initialValues])

  const handleSubmit = () => {
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    const action = buildAction(actionType, descriptor, values, context)
    const validation = validateAction(action)
    if (!validation.valid) {
      setFieldErrors(asFieldErrorMap(validation))
      setSubmitting(false)
      return
    }

    // Capture mode (draft): emit the typed action; never touch the
    // dispatcher. Used by Action Chains.
    if (onCapture) {
      try {
        onCapture(action)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Capture failed')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!dispatchContext) {
      setError('Internal: ActionFormModal needs either dispatchContext or onCapture')
      setSubmitting(false)
      return
    }

    void (async () => {
      try {
        const result = await dispatchAction(action, dispatchContext)
        if (!result.success) {
          setError(result.error.message)
          return
        }
        onSuccess?.(result.data, action)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Dispatch failed')
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const fields = (
    <>
      <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{descriptor.description}</p>
      {descriptor.fields.length === 0 && (
        <p className="text-xs italic text-muted-foreground">No editable fields — submit to apply.</p>
      )}
      <div className="space-y-3">
        {descriptor.fields.map((field) => (
          <FieldRenderer
            key={field.name}
            field={field}
            value={values[field.name]}
            error={fieldErrors[field.name]}
            disabled={disabledFields?.includes(field.name) ?? false}
            suggestions={
              field.optionsSource === 'approved_removal_categories' ? []
              : field.optionsSource === 'approved_movement_categories' ? []
              : undefined
            }
            onChange={(v) => { setValues((prev) => ({ ...prev, [field.name]: v })) }}
          />
        ))}
      </div>
      {error && (
        <Callout intent={Intent.DANGER} icon="error" className="mt-3">
          {error}
        </Callout>
      )}
    </>
  )

  const submitButton = (
    <Button intent={Intent.PRIMARY} loading={submitting} onClick={handleSubmit}>
      {submitLabelOverride ?? descriptor.submitLabel ?? 'Submit'}
    </Button>
  )

  // G3: the same form, drawn in the page. No Cancel — there is nothing to
  // dismiss when the form is the surface.
  if (chrome === 'inline') {
    return (
      <Card className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {titleOverride ?? descriptor.title}
        </div>
        {fields}
        <div className="flex justify-end pt-1">{submitButton}</div>
      </Card>
    )
  }

  return (
    <Dialog
      isOpen={open}
      onClose={() => { if (!submitting) onClose() }}
      title={titleOverride ?? descriptor.title}
      className="!w-[28rem]"
    >
      <DialogBody>{fields}</DialogBody>
      <DialogFooter
        actions={
          <>
            <Button variant="minimal" disabled={submitting} onClick={onClose}>Cancel</Button>
            {submitButton}
          </>
        }
      />
    </Dialog>
  )
}

// ─── Field renderer ──────────────────────────────────────────────────────────

function FieldRenderer({
  field, value, error, suggestions, disabled = false, onChange,
}: {
  field: ActionField
  value: FormValue | undefined
  error: string | undefined
  /** Dynamic type-or-pick options (e.g. approved removal categories). */
  suggestions?: ReadonlyArray<string>
  /** Prefilled and shown, but not editable. */
  disabled?: boolean
  onChange: (v: FormValue | undefined) => void
}) {
  const labelInfo = field.required ? `${field.label} *` : field.label
  const intent = error ? Intent.DANGER : Intent.NONE

  switch (field.kind) {
    case 'multiline':
      return (
        <FormGroup label={labelInfo} helperText={error ?? field.helper} intent={intent}>
          <TextArea
            value={(value as string | undefined) ?? ''}
            onChange={(e) => { onChange(e.target.value) }}
            placeholder={field.placeholder}
            disabled={disabled}
            fill
            rows={3}
          />
        </FormGroup>
      )
    case 'enum':
      return (
        <FormGroup label={labelInfo} helperText={error ?? field.helper} intent={intent}>
          <HTMLSelect
            value={(value as string | undefined) ?? ''}
            onChange={(e) => { onChange(e.currentTarget.value || undefined) }}
            options={[
              { label: '— select —', value: '' },
              ...(field.options ?? []).map((opt) => ({ label: opt, value: opt })),
            ]}
            disabled={disabled}
            fill
          />
        </FormGroup>
      )
    case 'number':
    case 'quantity':
    case 'currency': {
      const stepperButtons = field.kind === 'quantity'
      return (
        <FormGroup label={labelInfo} helperText={error ?? field.helper} intent={intent}>
          <NumericInput
            value={(value as number | undefined) ?? ''}
            onValueChange={(n) => { onChange(Number.isNaN(n) ? undefined : n) }}
            min={field.min}
            max={field.max}
            buttonPosition={stepperButtons ? 'right' : 'none'}
            disabled={disabled}
            fill
          />
        </FormGroup>
      )
    }
    case 'date':
      return (
        <FormGroup label={labelInfo} helperText={error ?? field.helper} intent={intent}>
          <InputGroup
            type="date"
            value={(value as string | undefined) ?? ''}
            onChange={(e) => { onChange(e.target.value || undefined) }}
            disabled={disabled}
          />
        </FormGroup>
      )
    case 'string':
    default: {
      // type-or-pick when the field carries dynamic suggestions (the grown
      // ontology) — picking reuses a typed category, typing keeps the flywheel
      // open (new free text → detected → approved → suggested next time).
      const opts = suggestions ?? []
      const listId = opts.length > 0 ? `opts-${field.name}` : undefined
      return (
        <FormGroup label={labelInfo} helperText={error ?? field.helper} intent={intent}>
          <InputGroup
            value={(value as string | undefined) ?? ''}
            onChange={(e) => { onChange(e.target.value) }}
            placeholder={field.placeholder}
            disabled={disabled}
            list={listId}
          />
          {listId && (
            <datalist id={listId}>
              {opts.map((opt) => <option key={opt} value={opt} />)}
            </datalist>
          )}
        </FormGroup>
      )
    }
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function deriveInitial(
  descriptor: ActionDescriptor,
  initialValues: ActionFormModalProps['initialValues'],
): Record<string, FormValue | undefined> {
  const out: Record<string, FormValue | undefined> = {}
  for (const f of descriptor.fields) {
    const v = initialValues?.[f.name]
    if (v == null) {
      out[f.name] = undefined
    } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[f.name] = v
    } else {
      out[f.name] = undefined
    }
  }
  return out
}

function buildAction(
  actionType: BeaconAction['type'],
  descriptor: ActionDescriptor,
  values: Record<string, FormValue | undefined>,
  context: ActionFormModalProps['context'],
): BeaconAction {
  const payload: Record<string, unknown> = { type: actionType }
  for (const field of descriptor.contextFields) {
    if (context[field] !== undefined) payload[field] = context[field]
  }
  for (const field of descriptor.fields) {
    const v = values[field.name]
    if (v !== undefined && v !== '') payload[field.name] = v
  }
  return payload as unknown as BeaconAction
}

function asFieldErrorMap(validation: ValidationResult): Record<string, string> {
  const map: Record<string, string> = {}
  for (const err of validation.errors) {
    if (!(err.field in map)) map[err.field] = err.message
  }
  return map
}
