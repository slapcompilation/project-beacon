// Single source for which agent proposes which BeaconAction type. Used by the
// Policy tab (earned-trust evidence per action type) and the Flywheel (recommend
// enabling a queue-only type once its agent proves calibrated + in production).

/** Action type → the agent that proposes it (null = manual / no single agent). */
export const ACTION_AGENT: Record<string, string | null> = {
  REQUEST_RESTOCK: 'restock_advisor',
  TRANSFER_STOCK:  'overstock_rebalancer',
  WRITE_OFF:       'waste_triage',
  ADJUST_STOCK:    null,
}

/** Agent → the action type it proposes (inverse of ACTION_AGENT). */
export const AGENT_ACTION: Record<string, string> = {
  restock_advisor:      'REQUEST_RESTOCK',
  overstock_rebalancer: 'TRANSFER_STOCK',
  waste_triage:         'WRITE_OFF',
}
