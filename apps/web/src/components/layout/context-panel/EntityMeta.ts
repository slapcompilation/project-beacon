import type { IconName } from '@blueprintjs/icons'
import type { ObjectPanelEntity } from '@/stores/app.store'
import { OBJECT_PRESENTATION } from '@/lib/objectPresentation'
import { OBJECT_LIST } from '@/features/objects/objectList'

// Presentation (icon/label/route) comes from OBJECT_PRESENTATION; table + select
// come from OBJECT_LIST — this file holds no copies of either (G3: its
// hand-maintained table/select strings had drifted into verbatim duplicates).
// shift_handover has no object page or list entry, so it stays inline.
const P = OBJECT_PRESENTATION
const L = OBJECT_LIST

const fromRegistries = (k: keyof typeof L) =>
  ({ icon: P[k].icon, label: P[k].label, route: P[k].route, table: L[k].table, select: L[k].select })

export const ENTITY_META: Record<ObjectPanelEntity, {
  icon: IconName
  label: string
  route: string
  table: string
  select: string
}> = {
  variant:         fromRegistries('variant'),
  product:         fromRegistries('product'),
  supplier:        fromRegistries('supplier'),
  restock_request: fromRegistries('restock_request'),
  stock_log:       fromRegistries('stock_log'),
  alert:           fromRegistries('alert'),
  purchase_order:  fromRegistries('purchase_order'),
  shift_handover:  { icon: 'clipboard',   label: 'Shift Handover', route: '/handover/', table: 'shift_handovers', select: '*' },
  location:        { icon: 'map-marker',  label: 'Zone',           route: '/location/', table: 'locations',       select: '*' },
}

export const GRAPH_NODE_TYPE: Partial<Record<ObjectPanelEntity, string>> = {
  variant: 'variant', product: 'product', supplier: 'supplier',
  restock_request: 'restock_request', stock_log: 'stock_log',
  alert: 'alert', purchase_order: 'purchase_order',
}
