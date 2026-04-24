import {
  Package, Truck, ShoppingCart, FileText,
  AlertTriangle, ClipboardList, RotateCcw,
} from 'lucide-react'
import type { ObjectPanelEntity } from '@/stores/app.store'

export const ENTITY_META: Record<ObjectPanelEntity, {
  icon: React.ElementType
  label: string
  route: string
  table: string
  select: string
}> = {
  variant:         { icon: Package,       label: 'Variant',         route: '/variant/',  table: 'product_variants', select: '*, products(id, name, sku), locations(name)' },
  product:         { icon: Package,       label: 'Product',         route: '/product/',  table: 'products',         select: '*, categories(name)' },
  supplier:        { icon: Truck,         label: 'Supplier',        route: '/supplier/',  table: 'suppliers',        select: '*' },
  restock_request: { icon: ShoppingCart,  label: 'Restock Request', route: '/restock/',  table: 'restock_requests', select: '*, product_variants(name, products(name))' },
  stock_log:       { icon: RotateCcw,     label: 'Stock Log',       route: '/log/',      table: 'stock_logs',       select: '*, product_variants(name)' },
  alert:           { icon: AlertTriangle, label: 'Alert',           route: '/alert/',    table: 'notifications',    select: '*' },
  purchase_order:  { icon: FileText,      label: 'Purchase Order',  route: '/po/',       table: 'purchase_orders',  select: '*, suppliers(name)' },
  shift_handover:  { icon: ClipboardList, label: 'Shift Handover',  route: '/handover/', table: 'shift_handovers',  select: '*' },
}

export const GRAPH_NODE_TYPE: Partial<Record<ObjectPanelEntity, string>> = {
  variant: 'variant', product: 'product', supplier: 'supplier',
  restock_request: 'restock_request', stock_log: 'stock_log',
  alert: 'alert', purchase_order: 'purchase_order',
}
