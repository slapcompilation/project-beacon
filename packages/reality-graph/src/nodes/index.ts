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
} from './aip'
export type {
  DocumentPayload,
  DocumentSource,
  IngestionStage,
  ProposalPayload,
  ProposalStatus,
} from './aip'
