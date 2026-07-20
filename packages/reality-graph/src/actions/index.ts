export type {
  BeaconAction,
  TriggeredBy,
  ActionResult,
  ActionSuccess,
  ActionFailure,
  ValidationResult,
} from './types'

export { validateAction } from './criteria'

export { copilotProposalToAction, evaluateBatchApprovals } from './copilotProposal'

export { SYSTEM_ACTOR, isSystemActor, resolveActor } from './actor'

export type {
  ActionField,
  ActionFieldKind,
  ActionDescriptor,
  InvocationMode,
} from './descriptors'
export { actionDescriptors, getActionDescriptor } from './descriptors'

export type {
  EdgeInsert,
  EdgeContext,
  MutationResult,
  SupplierCreateResult,
  RestockRequestResult,
  StockLogResult,
  ReceiveStockResult,
  RevertActionResult,
  POCreateResult,
  InvoiceSubmitResult,
  TransferCreateResult,
  TransferApproveResult,
  PendingApprovalResult,
  DeliveryLogResult,
  TaxonomyCreateResult,
} from './edges'
export { edgesForAction } from './edges'
