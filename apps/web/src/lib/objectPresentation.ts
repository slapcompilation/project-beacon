// The A10 seed: one place that says how each ontology node type PRESENTS —
// icon, type label, breadcrumb home, and object-page route. Pages, panels,
// and graph links all read this instead of keeping their own copies (the old
// GraphConnections route map knew 7 of 13 types; links to the rest were dead).
// Next step on this road: per-property descriptions/tooltips from the graph.

import type { IconName } from '@blueprintjs/icons'
import type { NodeType, EdgeType } from '@beacon/reality-graph'

export interface ObjectPresentation {
  icon: IconName
  label: string
  /** Breadcrumb fallback — pages may override with a contextual parent. */
  home: { label: string; to: string }
  route: string
}

export const OBJECT_PRESENTATION = {
  variant:         { icon: 'box',          label: 'Variant',         home: { label: 'Inventory', to: '/floor?panel=stock' },              route: '/variant/' },
  product:         { icon: 'box',          label: 'Product',         home: { label: 'Inventory', to: '/floor?panel=stock' },              route: '/product/' },
  supplier:        { icon: 'shop',         label: 'Supplier',        home: { label: 'Suppliers', to: '/operations?panel=suppliers' },     route: '/supplier/' },
  purchase_order:  { icon: 'truck',        label: 'Purchase Order',  home: { label: 'Purchase Orders', to: '/operations?panel=procurement' }, route: '/po/' },
  restock_request: { icon: 'box',          label: 'Restock Request', home: { label: 'Restock Requests', to: '/mind?aip=restock-approvals' }, route: '/restock/' },
  stock_log:       { icon: 'history',      label: 'Stock Log',       home: { label: 'Stock Log', to: '/flow?panel=timeline' },            route: '/log/' },
  alert:           { icon: 'warning-sign', label: 'Alert',           home: { label: 'Alerts', to: '/floor?panel=alerts' },                route: '/alert/' },
  proposal:        { icon: 'annotation',   label: 'Proposal',        home: { label: 'Review Queue', to: '/review-queue' },                route: '/proposals/' },
  case:            { icon: 'folder-open',  label: 'Case',            home: { label: 'Cases', to: '/cases' },                              route: '/cases/' },
  document:        { icon: 'document',     label: 'Document',        home: { label: 'Documents', to: '/documents' },                      route: '/documents/' },
  constraint:      { icon: 'shield',       label: 'Constraint',      home: { label: 'Constraints', to: '/settings?section=constraints' }, route: '/constraints/' },
  principle:       { icon: 'learning',     label: 'Principle',       home: { label: 'Principles', to: '/settings?section=principles' },   route: '/principles/' },
  approved_answer: { icon: 'bookmark',     label: 'Approved Answer', home: { label: 'Approved Answers', to: '/mind?aip=answers' },        route: '/answers/' },
  action_chain:    { icon: 'link',         label: 'Action Chain',    home: { label: 'Action Chains', to: '/action-chains' },              route: '/action-chains/' },
} satisfies Partial<Record<NodeType, ObjectPresentation>>

/** Object-page path for a node, or null when the type has no page. */
export function objectPath(nodeType: NodeType, id: string): string | null {
  const p = (OBJECT_PRESENTATION as Partial<Record<NodeType, ObjectPresentation>>)[nodeType]
  return p ? `${p.route}${id}` : null
}

// Property glossary (A10): plain-language definitions the ontology serves as
// tooltips, so "what does PAR mean?" is answered by the graph, not a training
// doc. Wire via <Metric info={GLOSSARY.par} …/>.
export const GLOSSARY = {
  par:              'The stock level this item should be kept at. Falling below PAR flags it as low; PAR is set per item by the operator.',
  days_until_zero:  'How many days until stock runs out, projected from the last 30 days of consumption.',
  consumed_30d:     'Units consumed over the last 30 days — write-offs and reverts excluded.',
  stock_value:      'What the current stock is worth: units on hand × unit cost.',
  reorder_point:    'The statistically-derived stock level to reorder at: expected demand over the supplier lead time plus a safety buffer for demand swings.',
  reliability:      'Composite 0–10 score of this supplier over the last 90 days: on-time rate, delays, and cost variance.',
  on_time_pct:      'Share of this supplier\'s orders delivered by the promised date in the last 90 days.',
  avg_delay:        'Average days late across this supplier\'s deliveries; the max shows the worst case.',
  cost_variance:    'How far invoiced prices drift from contracted prices. Positive = paying more than agreed.',
  total_value:      'The full monetary value of this purchase order across all line items.',
  line_items:       'Order lines received vs ordered — 100% means the PO is fully delivered.',
  qty_received:     'Units delivered against this request so far, vs the quantity requested.',
  confidence:       'How sure the agent is of this proposal (0–1). High-confidence proposals may auto-execute; low ones always wait for a person.',
} as const


// Runtime enumerations of the ontology vocabulary. TS unions vanish at
// runtime; these exhaustive records are how surfaces list every node/edge
// type — the compiler forces an entry whenever the ontology grows.
export const NODE_LABELS: Record<NodeType, string> = {
  hotel:             'Hotel',
  user:              'User',
  product:           'Product',
  variant:           'Variant',
  stock_log:         'Stock Log',
  restock_request:   'Restock',
  stocktake_session: 'Stocktake',
  stocktake_line:    'Stocktake Line',
  alert:             'Alert',
  report:            'Report',
  supplier:          'Supplier',
  product_batch:     'Batch',
  restock_receive:   'Receive',
  purchase_order:    'Purchase Order',
  po_invoice:        'Invoice',
  occupancy_log:     'Occupancy',
  document:          'Document',
  proposal:          'Proposal',
  principle:         'Principle',
  approved_answer:   'Answer',
  case:              'Case',
  constraint:        'Constraint',
  stock_transfer:    'Transfer',
  action_chain:      'Action Chain',
  delivery_event:    'Delivery',
  location:          'Location',
  category:          'Category',
  removal_reason:    'Reason',
  pick_list:         'Pick List',
  pick_list_item:    'Pick Item',
  menu_item:         'Menu Item',
  menu_item_ingredient: 'Ingredient',
  event:             'Event',
  chunk:             'Chunk',
  entity:            'Entity',
}

export const EDGE_LABELS: Record<EdgeType, string> = {
  causes:            'Causes',
  consumes:          'Consumes',
  restocks:          'Restocks',
  fulfills:          'Fulfills',
  reverts:           'Reverts',
  triggered_alert:   'Triggered alert',
  approved_by:       'Approved by',
  rejected_by:       'Rejected by',
  modified_by:       'Modified by',
  sourced_from:      'Sourced from',
  delivery_sourced_from: 'Delivered by',
  receipt_sourced_from:  'Received from',
  po_sourced_from:       'Ordered from',
  recipe_consumes:       'Recipe uses',
  pick_consumes:         'Picks',
  transfer_approved_by:  'Transfer approved by',
  linked_to_po:      'Linked to PO',
  invoiced_by:       'Invoiced by',
  influenced_by_occupancy: 'Influenced by occupancy',
  influenced_by_principle: 'Influenced by principle',
  log_fulfills_request:    'Log fulfils request',
  batch_of:          'Batch of',
  discarded_via:     'Discarded via',
  belongs_to_session: 'Session',
  similar_to:        'Similar to',
  transfers:         'Transfers',
  proposed_by:       'Proposed by',
  benchmarks:        'Benchmarks',
  harmonized_to:     'Harmonized to',
  describes_entity:  'Describes',
  cited_in:          'Cited in',
  applies_to:        'Applies to',
  derived_from:      'Derived from',
  mentions:          'Mentions',
  resolved_to:       'Resolved to',
}
