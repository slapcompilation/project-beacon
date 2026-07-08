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
  variant:         { icon: 'box',          label: 'Variant',         home: { label: 'Inventory', to: '/graph' },                          route: '/variant/' },
  product:         { icon: 'box',          label: 'Product',         home: { label: 'Inventory', to: '/graph' },                          route: '/product/' },
  supplier:        { icon: 'shop',         label: 'Supplier',        home: { label: 'Suppliers', to: '/mind?panel=suppliers' },           route: '/supplier/' },
  purchase_order:  { icon: 'truck',        label: 'Purchase Order',  home: { label: 'Purchase Orders', to: '/mind?panel=procurement' },   route: '/po/' },
  restock_request: { icon: 'box',          label: 'Restock Request', home: { label: 'Restock Requests', to: '/flow?panel=approvals' },    route: '/restock/' },
  stock_log:       { icon: 'history',      label: 'Stock Log',       home: { label: 'Stock Log', to: '/flow' },                           route: '/log/' },
  alert:           { icon: 'warning-sign', label: 'Alert',           home: { label: 'Alerts', to: '/eye' },                               route: '/alert/' },
  proposal:        { icon: 'annotation',   label: 'Proposal',        home: { label: 'Review Queue', to: '/review-queue' },                route: '/proposals/' },
  case:            { icon: 'folder-open',  label: 'Case',            home: { label: 'Cases', to: '/cases' },                              route: '/cases/' },
  document:        { icon: 'document',     label: 'Document',        home: { label: 'Documents', to: '/documents' },                      route: '/documents/' },
  constraint:      { icon: 'shield',       label: 'Constraint',      home: { label: 'Constraints', to: '/settings?section=constraints' }, route: '/constraints/' },
  principle:       { icon: 'learning',     label: 'Principle',       home: { label: 'Principles', to: '/settings?section=principles' },   route: '/principles/' },
  action_chain:    { icon: 'link',         label: 'Action Chain',    home: { label: 'Action Chains', to: '/action-chains' },              route: '/action-chains/' },
} satisfies Partial<Record<NodeType, ObjectPresentation>>

/** Object-page path for a node, or null when the type has no page. */
export function objectPath(nodeType: NodeType, id: string): string | null {
  const p = (OBJECT_PRESENTATION as Partial<Record<NodeType, ObjectPresentation>>)[nodeType]
  return p ? `${p.route}${id}` : null
}
