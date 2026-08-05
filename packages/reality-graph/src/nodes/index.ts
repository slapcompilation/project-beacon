// Network tier — Phase R1
export {
  organizationNode,
  isMultiProperty,
  hotelCount,
  echelonLabel,
  canActAtOrgScope,
  effectiveScope,
  hasOrgMembership,
  orgRoleFor,
  ECHELON_RANK,
} from './organization'

// AIP-native nodes
export {
  documentNode,
  proposalNode,
  principleNode,
  approvedAnswerNode,
  caseNode,
  constraintNode,
} from './aip'
export type {
  DocumentPayload,
  DocumentSource,
  IngestionStage,
  ProposalPayload,
  ProposalStatus,
  PrinciplePayload,
  PrincipleCategory,
  ApprovedAnswerPayload,
  CasePayload,
  CaseStatus,
  ConstraintPayload,
  ConstraintBucket,
  ConstraintSeverity,
} from './aip'
