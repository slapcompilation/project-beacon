// What an action IS, with nothing about what any particular action does.
//
// This file used to hold the BeaconAction union — ADJUST_STOCK, REQUEST_RESTOCK,
// WRITE_OFF and the rest — plus a result type per action. Every one of those was
// inventory software and went with the domain.
//
// Action types are authored now: rows in user_action_types with parameters,
// submission criteria, an invocation mode and an approval tier. So an action at
// this layer is a type name and a payload, which is all the automations,
// constraint and authoring code ever needed to know.

/** A submitted action: the action type's api name, plus its parameter values. */
export interface BeaconAction {
  type: string
  [param: string]: unknown
}

/** Who or what submitted it. The audit trail branches on this. */
export type TriggeredBy =
  | 'user'
  | 'ai_proposal_accepted'
  | 'ai_auto_approved'
  | 'automation_threshold'
  | 'revert'

export interface ValidationResult {
  valid:  boolean
  errors: ReadonlyArray<string>
}
