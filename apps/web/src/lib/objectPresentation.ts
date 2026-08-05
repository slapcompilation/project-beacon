// The A10 seed: one place that says how each ontology node type PRESENTS —
// icon, type label, breadcrumb home, and object-page route. Pages, panels,
// and graph links all read this instead of keeping their own copies (the old
// GraphConnections route map knew 7 of 13 types; links to the rest were dead).
// Next step on this road: per-property descriptions/tooltips from the graph.

import type { IconName } from '@blueprintjs/icons'
import type { NodeType } from '@beacon/reality-graph'

export interface ObjectPresentation {
  icon: IconName
  label: string
  /** Breadcrumb fallback — pages may override with a contextual parent. */
  home: { label: string; to: string }
  route: string
}

export const OBJECT_PRESENTATION = {
  variant:         { icon: 'box', label: 'Variant', home: { label: 'Variant', to: '/objects/variant' }, route: '/objects/variant/' },
  product:         { icon: 'box', label: 'Product', home: { label: 'Product', to: '/objects/product' }, route: '/objects/product/' },
  supplier:        { icon: 'shop', label: 'Supplier', home: { label: 'Supplier', to: '/objects/supplier' }, route: '/objects/supplier/' },
  purchase_order:  { icon: 'truck', label: 'Purchase Order', home: { label: 'Purchase Order', to: '/objects/purchase_order' }, route: '/objects/purchase_order/' },
  restock_request: { icon: 'box', label: 'Restock Request', home: { label: 'Restock Request', to: '/objects/restock_request' }, route: '/objects/restock_request/' },
  stock_log:       { icon: 'history', label: 'Stock Log', home: { label: 'Stock Log', to: '/objects/stock_log' }, route: '/objects/stock_log/' },
  alert:           { icon: 'warning-sign', label: 'Alert', home: { label: 'Alert', to: '/objects/alert' }, route: '/objects/alert/' },
  proposal:        { icon: 'annotation', label: 'Proposal', home: { label: 'Proposal', to: '/objects/proposal' }, route: '/objects/proposal/' },
  case:            { icon: 'folder-open', label: 'Case', home: { label: 'Case', to: '/objects/case' }, route: '/objects/case/' },
  document:        { icon: 'document', label: 'Document', home: { label: 'Document', to: '/objects/document' }, route: '/objects/document/' },
  constraint:      { icon: 'shield', label: 'Constraint', home: { label: 'Constraint', to: '/objects/constraint' }, route: '/objects/constraint/' },
  principle:       { icon: 'learning', label: 'Principle', home: { label: 'Principle', to: '/objects/principle' }, route: '/objects/principle/' },
  approved_answer: { icon: 'bookmark', label: 'Approved Answer', home: { label: 'Approved Answer', to: '/objects/approved_answer' }, route: '/objects/approved_answer/' },
  action_chain:    { icon: 'link', label: 'Action Chain', home: { label: 'Action Chain', to: '/objects/action_chain' }, route: '/objects/action_chain/' },
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
  // stock_value moved onto the ontology in migration 349 — it is a computed
  // property of `variant` now, and its description travels with the definition.
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
  purchase_order_line: 'PO Line',
  shift_handover:     'Shift Handover',
  budget_allocation:  'Budget Allocation',
  gl_account_mapping: 'GL Mapping',
  po_discrepancy:      'PO Discrepancy',
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

/** A link type's display name. `link_types.label` is the authority and
 *  useLinkTypes() reads it; this is the fallback for a raw api name arriving
 *  from an edge row — `line_fulfills_request` reads as "Line fulfills request".
 *
 *  It replaces a Record of forty-three hand-written hospitality labels, which
 *  could only ever name links somebody had already thought of. */
export function linkLabel(apiName: string): string {
  const words = apiName.replace(/_/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : apiName
}
