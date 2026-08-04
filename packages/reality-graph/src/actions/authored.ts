// Operator-defined action types, as data.
//
// The third authored artifact, after tools (#416) and agents. Same shape as
// both: stored as rows, validated against a typed grammar, and composed with the
// code-defined ones through a wrapper — with a SHIPPED ACTION ALWAYS WINNING a
// name collision, because an organization must not be able to redefine what
// ADJUST_STOCK means.
//
// WHY THIS IS NOT A HOLE IN THE MUTATION LAYER. CLAUDE.md requires four things
// of every action, and each is a field on the definition rather than a property
// of the language it is written in — which is exactly how Foundry has it:
//
//   submission criteria  "the conditions that determine whether an action can be
//                         submitted"
//   side effects         declared per action type
//   audit entry          "action log object types map one-to-one with action
//                         types. Submitting an action generates a single new
//                         object of the corresponding action log object type"
//   invocation mode      open the form, or apply immediately with defaults
//
// The one thing the code union buys that data does not is compile-time
// exhaustiveness. That matters for the actions the ENGINE reasons about —
// revert chains, transfer approval, stock arithmetic — and those stay in code.
// An authored action edits `object_records`, which is the half of the ontology
// that is already data.

import { actionDescriptors, type ActionDescriptor, type ActionField, type InvocationMode } from './descriptors'
import type { PropertyType } from '../objectTypes/index'

export type AuthoredActionOperation = 'create' | 'modify' | 'delete'

export interface AuthoredActionParameter {
  key: string
  label: string
  type: PropertyType
  required: boolean
}

/** Foundry: "a condition is a single comparison check between two values."
 *  Every one must pass — "actions can only be submitted if all the submission
 *  criteria are met". */
export interface SubmissionCriterion {
  parameter: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'non_empty'
  /** Absent for `non_empty`, which compares against nothing. */
  value?: string | number | boolean
  /** Foundry: "add a failure message so users can see why an action has
   *  failed." Falls back to a generated one, which states the rule but not the
   *  reason behind it. */
  message?: string
}

export interface AuthoredActionDef {
  id: string
  organizationId: string
  hotelId: string | null
  name: string
  apiName: string
  description: string
  subjectTypeId: string
  operation: AuthoredActionOperation
  parameters: AuthoredActionParameter[]
  submissionCriteria: SubmissionCriterion[]
  invocationMode: InvocationMode
  approvalTier: ActionDescriptor['approvalTier']
  enabled: boolean
}

/** Code-defined action names. An authored action may not take one — the same
 *  collision rule authored tools use, refused at authoring time so it surfaces
 *  instead of silently losing at dispatch.
 *
 *  DERIVED, not listed. The first version of this was a hand-written array of
 *  twelve. The registry has forty-two, and two of the twelve were names that do
 *  not exist (`CREATE_PURCHASE_ORDER`, `SUBMIT_INVOICE` — the real ones are
 *  `CREATE_PO` and `SUBMIT_PO_INVOICE`), so the guard protected ten and left
 *  thirty-two takeable. A list that restates a registry drifts from it; this one
 *  cannot. */
export const SHIPPED_ACTION_NAMES: ReadonlyArray<string> = Object.keys(actionDescriptors)

const FIELD_KIND: Record<PropertyType, ActionField['kind']> = {
  text: 'string', number: 'number', boolean: 'enum', date: 'date',
  // Foundry renders a media reference parameter as a File picker with
  // drag-and-drop (`mirror/media-sets-advanced-formats/upload-media.md`). We have
  // no file field kind, so it takes a path as text — the divergence is recorded.
  media_reference: 'string',
  // Never reached: a vector is filtered out below. Present because the Record is
  // exhaustive, which is what made this decision surface at all.
  vector: 'string',
}

/** An embedding is written by the pipeline, never by a person, so it is not a
 *  form field at any width. Filtered rather than rendered read-only, because a
 *  disabled box of 1,536 floats is worse than no box. */
const isEnterable = (p: AuthoredActionParameter): boolean => p.type !== 'vector'

/** An authored action rendered as an ActionDescriptor, so `ActionFormModal`
 *  draws it with no idea it wasn't shipped in code — the same trick
 *  `authoredToolAsLogicTool` plays for the tool registry. */
export function authoredActionDescriptor(def: AuthoredActionDef): ActionDescriptor {
  return {
    invocationMode: def.invocationMode,
    title: def.name,
    description: def.description || `${def.operation} a ${'record'}`,
    approvalTier: def.approvalTier,
    // A delete needs no parameters — the record id is context.
    fields: def.operation === 'delete' ? [] : def.parameters.filter(isEnterable).map((p): ActionField => ({
      name: p.key,
      label: p.label,
      kind: FIELD_KIND[p.type],
      required: p.required,
      ...(p.type === 'boolean' ? { options: ['true', 'false'] } : {}),
    })),
    contextFields: ['hotelId', 'recordId'],
    submitLabel: def.name,
  }
}

/** Why the draft is not a valid action type, or an empty list. The database
 *  enforces the same rules; stating them here is what turns a thrown error into
 *  a disabled button with a reason. */
export function validateAuthoredAction(
  draft: Pick<AuthoredActionDef, 'name' | 'apiName' | 'operation' | 'parameters' | 'submissionCriteria'>,
): string[] {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Name is required')
  if (!/^[A-Z][A-Z0-9_]*$/.test(draft.apiName)) {
    errors.push('API name is SHOUTING_SNAKE_CASE, like CLOSE_TICKET')
  }
  if (SHIPPED_ACTION_NAMES.includes(draft.apiName)) {
    errors.push(`"${draft.apiName}" is a code-defined action — a shipped action always wins the name`)
  }
  if (draft.operation !== 'delete' && draft.parameters.length === 0) {
    errors.push('A create or modify needs at least one parameter — otherwise it edits nothing')
  }
  const keys = new Set<string>()
  for (const p of draft.parameters) {
    if (!/^[a-z][a-z0-9_]*$/.test(p.key)) errors.push(`Parameter "${p.key}" needs a slug key`)
    if (keys.has(p.key)) errors.push(`Parameter "${p.key}" is declared twice`)
    keys.add(p.key)
  }
  for (const c of draft.submissionCriteria) {
    if (!keys.has(c.parameter)) {
      errors.push(`A submission criterion tests "${c.parameter}", which is not a parameter of this action`)
    }
    if (c.operator !== 'non_empty' && c.value === undefined) {
      errors.push(`The criterion on "${c.parameter}" needs a value to compare against`)
    }
  }
  return errors
}

/** Foundry derives parameters from the rule: pick the properties an action
 *  modifies and "the parameters have already been created based by the Rule".
 *  So the composer picks properties, and this turns them into the action's
 *  typed input rather than making anyone retype keys and types. */
export function parametersFromProperties(
  properties: ReadonlyArray<{ key: string; label: string; type: PropertyType; required: boolean }>,
  chosenKeys: ReadonlyArray<string>,
): AuthoredActionParameter[] {
  return properties
    .filter((p) => chosenKeys.includes(p.key))
    .map((p) => ({ key: p.key, label: p.label, type: p.type, required: p.required }))
}

export interface CriterionFailure { parameter: string; message: string }

/** Foundry: "actions can only be submitted if ALL the submission criteria are
 *  met." Evaluated before the write, and the failures name the parameter so the
 *  form can put the message where the operator is looking. */
export function evaluateSubmissionCriteria(
  criteria: ReadonlyArray<SubmissionCriterion>,
  values: Record<string, unknown>,
): CriterionFailure[] {
  const out: CriterionFailure[] = []
  for (const c of criteria) {
    const v = values[c.parameter]
    if (c.operator === 'non_empty') {
      if (v === null || v === undefined || v === '') {
        out.push({ parameter: c.parameter, message: c.message?.trim() || `${c.parameter} must be filled in` })
      }
      continue
    }
    const target = c.value
    // A comparison against a missing value fails rather than passing silently —
    // an absent parameter is not evidence the condition holds.
    if (v === null || v === undefined) {
      out.push({
        parameter: c.parameter,
        message: c.message?.trim() || `${c.parameter} is required by a submission criterion`,
      })
      continue
    }
    const ok = compare(v, c.operator, target)
    if (!ok) {
      out.push({
        parameter: c.parameter,
        message: c.message?.trim() || `${c.parameter} must be ${readable(c.operator)} ${String(target)}`,
      })
    }
  }
  return out
}

function compare(v: unknown, op: SubmissionCriterion['operator'], target: unknown): boolean {
  if (op === 'eq')  return v === target
  if (op === 'neq') return v !== target
  const a = typeof v === 'number' ? v : Number(v)
  const b = typeof target === 'number' ? target : Number(target)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  switch (op) {
    case 'gt':  return a > b
    case 'gte': return a >= b
    case 'lt':  return a < b
    case 'lte': return a <= b
    default:    return false
  }
}

function readable(op: SubmissionCriterion['operator']): string {
  return { eq: 'exactly', neq: 'anything but', gt: 'greater than', gte: 'at least',
           lt: 'less than', lte: 'at most', non_empty: 'filled in' }[op]
}
