// The SHAPE of an action type — parameters, invocation mode, approval tier —
// so a UI can render a form from a definition instead of a hand-written page.
//
// The map of shipped descriptors that used to live here described inventory
// actions (ADJUST_STOCK, REQUEST_RESTOCK, WRITE_OFF, …) and went with the rest
// of the domain. Action types are authored now: rows in user_action_types,
// rendered through authoredActionDescriptor().

export type ActionFieldKind =
  | 'string'
  | 'multiline'
  | 'number'
  | 'currency'
  | 'quantity'
  | 'enum'
  | 'date'

export interface ActionField {
  name:      string
  kind:      ActionFieldKind
  label:     string
  helper?:   string
  required?: boolean
  min?:      number
  max?:      number
  /** Required when kind === 'enum'. */
  options?:  ReadonlyArray<string>
  /** Dynamic option source resolved by the UI at form-open time (the hotel's
   *  grown ontology). Rendered as type-or-pick suggestions, so free entry still
   *  works when the set is empty. */
  optionsSource?: 'approved_removal_categories' | 'approved_movement_categories'
  placeholder?: string
}

export type InvocationMode = 'open-form' | 'apply-immediately'

export interface ActionDescriptor {
  invocationMode: InvocationMode
  title:          string
  description:    string
  /** Visible fields, in render order. */
  fields:         ReadonlyArray<ActionField>
  /** Hidden fields supplied by the caller (route, auth, parent context). */
  contextFields:  ReadonlyArray<string>
  /** Tier required to submit. Soft constraints can lift to org-level. */
  approvalTier:   'self' | 'hotel-admin' | 'org-director'
  /** When apply-immediately, the action runs with the carried payload. */
  submitLabel?:   string
}


/** No action type ships in code any more, so no authored name can collide with
 *  one. Kept as a registry rather than removed: the collision rule in
 *  authored.ts is real and reads from here. */
export const actionDescriptors: Record<string, ActionDescriptor> = {}

/** The descriptor for an action type, or undefined when nothing registers it.
 *  Authored types resolve through authoredActionDescriptor() instead. */
export function getActionDescriptor(type: string): ActionDescriptor | undefined {
  return actionDescriptors[type]
}
