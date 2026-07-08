import type { IconName } from '@blueprintjs/icons'
import type { ObjectPanelEntity } from '@/stores/app.store'
import { OBJECT_PRESENTATION } from '@/lib/objectPresentation'

// Presentation (icon/label/route) comes from the registry; this file only owns
// the panel-specific data plumbing (table + select). shift_handover and
// location have no object page yet, so they stay fully inline.
const P = OBJECT_PRESENTATION

export const ENTITY_META: Record<ObjectPanelEntity, {
  icon: IconName
  label: string
  route: string
  table: string
  select: string
}> = {
  variant:         { icon: P.variant.icon,         label: P.variant.label,         route: P.variant.route,         table: 'product_variants', select: '*, products(id, name, sku), locations(name)' },
  product:         { icon: P.product.icon,         label: P.product.label,         route: P.product.route,         table: 'products',         select: '*, categories(name)' },
  supplier:        { icon: P.supplier.icon,        label: P.supplier.label,        route: P.supplier.route,        table: 'suppliers',        select: '*' },
  restock_request: { icon: P.restock_request.icon, label: P.restock_request.label, route: P.restock_request.route, table: 'restock_requests', select: '*, product_variants(name, products(name))' },
  stock_log:       { icon: P.stock_log.icon,       label: P.stock_log.label,       route: P.stock_log.route,       table: 'stock_logs',       select: '*, product_variants(name)' },
  alert:           { icon: P.alert.icon,           label: P.alert.label,           route: P.alert.route,           table: 'notifications',    select: '*' },
  purchase_order:  { icon: P.purchase_order.icon,  label: P.purchase_order.label,  route: P.purchase_order.route,  table: 'purchase_orders',  select: '*, suppliers(name)' },
  shift_handover:  { icon: 'clipboard',            label: 'Shift Handover',        route: '/handover/',            table: 'shift_handovers',  select: '*' },
  location:        { icon: 'map-marker',           label: 'Zone',                  route: '/location/',            table: 'locations',        select: '*' },
}

export const GRAPH_NODE_TYPE: Partial<Record<ObjectPanelEntity, string>> = {
  variant: 'variant', product: 'product', supplier: 'supplier',
  restock_request: 'restock_request', stock_log: 'stock_log',
  alert: 'alert', purchase_order: 'purchase_order',
}
