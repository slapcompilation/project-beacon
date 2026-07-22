// How each ontology node type LISTS its instances — the table to read (RLS-scoped,
// no hotel filter, so a list always matches the /objects count) and how to render
// a row. The Objects page cards link here; each row opens the type's Object View.
// Presentation (icon/label/route) still comes from OBJECT_PRESENTATION.

import type { OBJECT_PRESENTATION } from '@/lib/objectPresentation'

export type ObjectListType = keyof typeof OBJECT_PRESENTATION
type Row = Record<string, unknown>

export interface ObjectListSpec {
  table: string
  select: string
  orderBy?: { column: string; ascending?: boolean }
  title: (r: Row) => string
  subtitle?: (r: Row) => string | null
}

const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
const rec = (v: unknown): Row => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {})
const short = (r: Row): string => str(r.id).slice(0, 8)
const newest = { column: 'created_at', ascending: false }

export const OBJECT_LIST: Record<ObjectListType, ObjectListSpec> = {
  variant: {
    table: 'product_variants',
    select: '*, products(id, name, sku), locations(name)',
    title: (r) => str(rec(r.products).name) || 'Variant',
    subtitle: (r) => `${str(r.current_stock)} in stock · PAR ${str(r.low_stock_threshold)}`,
  },
  product: {
    table: 'products',
    select: '*, categories(name)',
    title: (r) => str(r.name) || 'Product',
    subtitle: (r) => [str(r.sku), str(rec(r.categories).name)].filter(Boolean).join(' · ') || null,
  },
  supplier: {
    table: 'suppliers',
    select: '*',
    title: (r) => str(r.name) || 'Supplier',
    subtitle: (r) => str(r.contact_email) || null,
  },
  purchase_order: {
    table: 'purchase_orders',
    select: '*, suppliers(name)',
    orderBy: newest,
    title: (r) => (rec(r.suppliers).name ? `PO — ${str(rec(r.suppliers).name)}` : `PO ${short(r)}`),
    subtitle: (r) => str(r.status) || null,
  },
  restock_request: {
    table: 'restock_requests',
    select: '*, product_variants(name, products(name))',
    orderBy: newest,
    title: (r) => str(rec(rec(r.product_variants).products).name) || str(rec(r.product_variants).name) || 'Restock',
    subtitle: (r) => `qty ${str(r.quantity_needed)} · ${str(r.status)}`,
  },
  stock_log: {
    table: 'stock_logs',
    select: '*, product_variants(name)',
    orderBy: { column: 'timestamp', ascending: false },
    title: (r) => str(rec(r.product_variants).name) || 'Stock Log',
    subtitle: (r) => `${str(r.quantity_change)} · ${str(r.reason)}`,
  },
  alert: {
    table: 'notifications',
    select: '*',
    orderBy: { column: 'timestamp', ascending: false },
    title: (r) => str(r.message) || 'Alert',
    subtitle: (r) => str(r.type) || null,
  },
  proposal: {
    table: 'proposals',
    select: 'id, action_type, status, confidence, created_at',
    orderBy: newest,
    title: (r) => str(r.action_type) || 'Proposal',
    subtitle: (r) => `${str(r.status)} · conf ${str(r.confidence)}`,
  },
  case: {
    table: 'cases',
    select: 'id, title, status, created_at',
    orderBy: newest,
    title: (r) => str(r.title) || `Case ${short(r)}`,
    subtitle: (r) => str(r.status) || null,
  },
  document: {
    table: 'documents',
    select: 'id, title, ingestion_stage, sensitivity, created_at',
    orderBy: newest,
    title: (r) => str(r.title) || `Document ${short(r)}`,
    subtitle: (r) => [str(r.ingestion_stage), str(r.sensitivity)].filter(Boolean).join(' · ') || null,
  },
  constraint: {
    table: 'constraints',
    select: 'id, body, bucket, severity, active, created_at',
    orderBy: newest,
    title: (r) => str(r.body).slice(0, 90) || `Constraint ${short(r)}`,
    subtitle: (r) => [str(r.bucket), str(r.severity)].filter(Boolean).join(' · ') || null,
  },
  principle: {
    table: 'principles',
    select: 'id, body, category, active, created_at',
    orderBy: newest,
    title: (r) => str(r.body).slice(0, 90) || `Principle ${short(r)}`,
    subtitle: (r) => str(r.category) || null,
  },
  action_chain: {
    table: 'action_chains',
    select: 'id, title, status, created_at',
    orderBy: newest,
    title: (r) => str(r.title) || `Action Chain ${short(r)}`,
    subtitle: (r) => str(r.status) || null,
  },
}
