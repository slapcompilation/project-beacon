export type { BeaconAction, TriggeredBy, ValidationResult } from './types'

export { SYSTEM_ACTOR, isSystemActor, resolveActor } from './actor'

export type {
  ActionField,
  ActionFieldKind,
  ActionDescriptor,
  InvocationMode,
} from './descriptors'
export { actionDescriptors, getActionDescriptor } from './descriptors'
