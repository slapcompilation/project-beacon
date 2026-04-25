export {
  variantNode,
  stockUrgency,
  daysUntilZero,
  consumptionUrgency,
  restockRecommendedQty,
  forecastForVariant,
} from './variant'
export type { StockUrgency, ConsumptionUrgency } from './variant'

export {
  restockRequestNode,
  fulfillmentPct as restockFulfillmentPct,
  totalReceived,
  remainingQty,
  restockUrgency,
  isStale,
  estimatedCost as restockEstimatedCost,
} from './restock_request'
export type { RestockUrgency } from './restock_request'

export {
  purchaseOrderNode,
  fulfillmentPct as poFulfillmentPct,
  fulfilledLineCount,
  costVariancePct,
  costVarianceAmount,
  isOverdue,
  daysOpenSinceSent,
  daysUntilDelivery,
} from './purchase_order'

export {
  supplierNode,
  riskLevel,
  riskLevelFromRow,
  leadTimeLabel,
  leadTimeSourceLabel,
  daysUntilContractExpiry,
  hasContractExpiringSoon,
  onTimePctLabel,
  costVarianceLabel,
} from './supplier'
export type { SupplierRiskLevel } from './supplier'

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
