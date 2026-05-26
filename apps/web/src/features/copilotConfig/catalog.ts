// Mirror of the tool names + descriptions defined in
// supabase/functions/copilot-chat/index.ts. Kept in sync by hand for v1 —
// the edge function and this catalog should be edited together when tools
// are added or removed. A typed schema migration could remove the drift
// risk later (Phase 10.c if needed).

export type CopilotToolCategory = 'query' | 'propose' | 'search'

export interface CopilotToolEntry {
  name:        string
  category:    CopilotToolCategory
  label:       string
  description: string
}

export const COPILOT_TOOL_CATALOG: ReadonlyArray<CopilotToolEntry> = [
  // Query tools — read-only
  { name: 'get_shift_intelligence',          category: 'query',   label: 'Shift Intelligence',           description: 'Per-shift performance: variance, anomalies, top contributors.' },
  { name: 'get_waste_radar',                 category: 'query',   label: 'Waste Radar',                  description: 'Recent waste / write-off summary with anomaly flags.' },
  { name: 'get_consumption_forecast',        category: 'query',   label: 'Consumption Forecast',         description: 'Projected usage for a variant over N days.' },
  { name: 'get_active_incidents',            category: 'query',   label: 'Active Incidents',             description: 'Open incidents + their connected root-cause chains.' },
  { name: 'get_supplier_reliability',        category: 'query',   label: 'Supplier Reliability',         description: 'On-time %, cost variance, recent PO history per supplier.' },
  { name: 'get_variant_intelligence',        category: 'query',   label: 'Variant Intelligence',         description: 'Full variant context: stock, par, consumption, supplier mix.' },
  { name: 'explain_anomaly',                 category: 'query',   label: 'Explain Anomaly',              description: 'Root-cause graph traversal for a flagged event.' },
  { name: 'get_team_performance',            category: 'query',   label: 'Team Performance',             description: 'Per-user / per-shift activity + accuracy metrics.' },
  { name: 'get_stock_pressure',              category: 'query',   label: 'Stock Pressure',               description: 'Variants under threshold + projected stockouts.' },
  { name: 'get_dead_stock',                  category: 'query',   label: 'Dead Stock',                   description: 'Long-tail SKUs with no movement.' },
  { name: 'get_occupancy_adjusted_forecast', category: 'query',   label: 'Occupancy-Adjusted Forecast',  description: 'Demand projection weighted by booking calendar.' },
  { name: 'get_restock_requests',            category: 'query',   label: 'Restock Requests',             description: 'Open / recent restock requests for a variant.' },

  { name: 'search_products',                 category: 'search',  label: 'Search Products',              description: 'Free-text product lookup → variant id resolution.' },

  // Propose tools — mutation-shaped; the copilot returns an action_proposal
  // for the operator to confirm. Nothing auto-dispatches.
  { name: 'propose_restock',                 category: 'propose', label: 'Propose Restock',              description: 'Suggest a REQUEST_RESTOCK action for operator approval.' },
  { name: 'propose_stock_adjustment',        category: 'propose', label: 'Propose Stock Adjustment',     description: 'Suggest an ADJUST_STOCK / WRITE_OFF for approval.' },
  { name: 'propose_batch_approval',          category: 'propose', label: 'Propose Batch Approval',       description: 'Suggest BATCH_APPROVE for the queued restocks.' },
]
