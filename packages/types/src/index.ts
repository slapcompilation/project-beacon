// ─── RBAC ─────────────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'team_member' | 'limited_access'

export type Permission =
  | 'can_manage_users'
  | 'can_manage_categories'
  | 'can_approve_restocks'
  | 'can_undo_logs'
  | 'can_export_reports'
  | 'can_manage_hotels'
  | 'can_view_reports'
  | 'can_adjust_stock'
  | 'can_create_restocks'

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'can_manage_users',
    'can_manage_categories',
    'can_approve_restocks',
    'can_undo_logs',
    'can_export_reports',
    'can_manage_hotels',
    'can_view_reports',
    'can_adjust_stock',
    'can_create_restocks',
  ],
  admin: [
    'can_manage_users',
    'can_manage_categories',
    'can_approve_restocks',
    'can_undo_logs',
    'can_export_reports',
    'can_manage_hotels',
    'can_view_reports',
    'can_adjust_stock',
    'can_create_restocks',
  ],
  team_member: ['can_view_reports', 'can_adjust_stock', 'can_create_restocks'],
  limited_access: ['can_adjust_stock'],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Hotel {
  id: string
  name: string
  address: string
  timezone: string
  currency: string
  config: Record<string, unknown>
  created_at: string
  manager_approval_threshold: number
  director_approval_threshold: number
  escalation_timeout_hours: number
  /** Restock requests with estimated_cost at or below this value auto-approve. 0 = disabled. */
  auto_approve_threshold: number
  /** When true, system auto-generates draft POs when 3+ approved restocks exist for the same supplier. */
  auto_po_enabled: boolean
  /** Invoices with discrepancy_pct at or below this value auto-approve. Default 2%. */
  auto_invoice_tolerance_pct: number
  /** Parent organization. Every hotel belongs to exactly one org (Phase R1 — migration 111). */
  organization_id: string
}

// ─── Network tier (Phase R1 — Gallatin-inspired multi-echelon) ──────────────

/**
 * Organization — portfolio tier above hotels.
 * Single-property customers have a 1:1 auto-created org; multi-property
 * customers share one org across all their hotels. Org-scope contracts,
 * benchmarks, and agents attach here.
 */
export interface Organization {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** Org-scope roles (extend the echelon above hotel roles). */
export type OrgRole = 'org_director' | 'regional_manager'

/**
 * User ↔ Organization role assignment.
 * A user with a row here has BOTH their hotel role (on profiles) AND an
 * org-level role. Org role takes precedence for org-scope queries.
 */
export interface UserOrgMembership {
  id: string
  user_id: string
  organization_id: string
  role: OrgRole
  created_at: string
}

/**
 * Query scope declaration. Every agent, RPC, and query should declare which
 * echelon it operates at so scope is explicit rather than inferred.
 */
export type Scope = 'hotel' | 'organization'

export interface User {
  id: string
  email: string
  role: UserRole
  hotel_id: string
  preferences: UserPreferences
  created_at: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  compact_view: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  default_view: string
  language: string
  /**
   * Display format for dates throughout the UI.
   * Uses date-fns format tokens. Defaults to 'dd/MM/yyyy'.
   * e.g. 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd' | 'dd.MM.yyyy' | 'd MMM yyyy' | 'MMM d, yyyy'
   */
  date_format: string
}

export interface Category {
  id: string
  hotel_id: string
  name: string
  parent_id: string | null
  order: number
  require_photo_for_removal_over: number | null
  /** Occupancy demand elasticity 0.0–1.0. 1.0 = demand scales linearly with occupancy. */
  occupancy_sensitivity: number
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean'

export interface CustomFieldDef {
  id: string
  hotel_id: string
  name: string
  field_type: CustomFieldType
  required: boolean
  sort_order: number
  created_at: string
}

export interface Location {
  id: string
  hotel_id: string
  name: string
  parent_id: string | null
  created_at: string
}

/** Full per-variant inventory row grouped by location — Floor Layer */
export interface LocationInventoryRow {
  variant_id:          string
  product_name:        string
  variant_name:        string
  sku:                 string
  current_stock:       number
  low_stock_threshold: number
  cost:                number
  total_value:         number
  location_id:         string | null
  location_name:       string | null
  location_path:       string | null
  par_status:          'ok' | 'low' | 'critical' | 'out'
}

export interface Product {
  id: string
  hotel_id: string
  name: string
  description: string | null
  sku: string
  image_url: string | null
  cost: number
  category_id: string | null
  /** Free-form tags for cross-cutting classification, e.g. ["Bar","Premium"] */
  tags: string[]
  custom_attributes: Record<string, unknown>
  enabled: boolean
  created_at: string
  updated_at: string
}

export type VariantStatus = 'available' | 'in_use' | 'maintenance' | 'retired' | 'ordered'

export const VARIANT_STATUS_LABELS: Record<VariantStatus, string> = {
  available:   'Available',
  in_use:      'In Use',
  maintenance: 'Maintenance',
  retired:     'Retired',
  ordered:     'Ordered',
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku: string
  barcode: string | null
  current_stock: number
  expiry_date: string | null
  lot_number: string | null
  serial: string | null
  cost: number
  low_stock_threshold: number
  location_id: string | null
  custom_values: Record<string, unknown>
  enabled: boolean
  /** `active = false` marks a variant as temporarily inactive (out of service).
   *  Separate from `enabled` (soft-delete). Still tracked in stock counts. */
  active: boolean
  status: VariantStatus
  /** Date Reminder — arbitrary scheduled date (maintenance, warranty, inspection…) */
  reminder_date: string | null
  /** Human label for the reminder, e.g. "Boiler service due" */
  reminder_label: string | null
  /** Human-readable unit, e.g. "bottles", "kg", "cases". Empty string = no unit. */
  unit_of_measure: string
  /** TRUE once this variant has received at least one positive stock log.
   *  FALSE for newly created variants that have never been stocked.
   *  Distinguishes "never stocked" (setup) from "depleted" (operational emergency). */
  has_stock_history: boolean
  /** Default supplier for restocking. Enables lead-time synthesis. */
  default_supplier_id: string | null
}

// ─── Custom removal reasons ────────────────────────────────────────────────────

export interface CustomRemovalReason {
  id: string
  hotel_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface VariantCostHistory {
  id: string
  variant_id: string
  hotel_id: string
  cost: number
  effective_from: string
  changed_by: string | null
}

// ─── Derived / joined types ───────────────────────────────────────────────────

export type ProductWithVariants = Product & {
  product_variants: ProductVariant[]
  categories: Pick<Category, 'id' | 'name' | 'require_photo_for_removal_over'> | null
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export function getStockStatus(variants: ProductVariant[]): StockStatus {
  if (variants.length === 0) return 'out_of_stock'
  const total = variants.reduce((s, v) => s + v.current_stock, 0)
  if (total === 0) return 'out_of_stock'
  const anyLow = variants.some(
    (v) => v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold
  )
  if (anyLow) return 'low_stock'
  return 'in_stock'
}

export function getTotalStock(variants: ProductVariant[]): number {
  return variants.reduce((s, v) => s + v.current_stock, 0)
}

// ─── Stock & audit ────────────────────────────────────────────────────────────

export type RemovalCategory =
  | 'Breakage'
  | 'Theft'
  | 'Spoilage'
  | 'Consumed'
  | 'Returned to supplier'

export const REMOVAL_CATEGORIES: RemovalCategory[] = [
  'Breakage',
  'Theft',
  'Spoilage',
  'Consumed',
  'Returned to supplier',
]

export interface StockLog {
  id: string
  hotel_id: string
  variant_id: string
  user_id: string
  quantity_change: number
  balance_after: number
  reason: string
  timestamp: string
  is_revert: boolean
  revert_of: string | null
  sync_batch_id: string | null
  was_offline: boolean
  photo_url: string | null
  // Sign-agnostic movement category (removals + additions share one column).
  // Free-text: the RemovalCategory union seeds the removal vocab, but custom +
  // grown-ontology values also land here, so the field is typed open.
  category: string | null
}

export interface RestockReceive {
  id: string
  request_id: string
  hotel_id: string
  received_by: string | null
  quantity_received: number
  lot_number: string | null
  notes: string | null
  received_at: string
  unit_cost: number | null
}

export type RestockStatus =
  | 'pending'
  | 'pending_manager'
  | 'pending_director'
  | 'approved'
  | 'fulfilled'
  | 'cancelled'
  | 'rejected'

export type ApprovalTier = 'none' | 'manager' | 'director'

export interface RestockRequest {
  id: string
  hotel_id: string
  variant_id: string
  quantity_needed: number
  supplier: string | null
  requestor_id: string
  status: RestockStatus
  date: string
  notes: string | null
  is_auto_proposed: boolean
  // ─── Approval workflow ───────────────────────────────────────────────────
  estimated_cost:         number | null
  required_approval_tier: ApprovalTier
  approved_by:            string | null
  approved_at:            string | null
  approval_notes:         string | null
  rejected_by:            string | null
  rejected_at:            string | null
  rejected_reason:        string | null
  // ─── Escalation tracking ──────────────────────────────────────────────────
  escalation_count:       number
  last_escalated_at:      string | null
  created_at:             string
}

export interface Supplier {
  id: string
  hotel_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  /** Average delivery lead time in calendar days. Used for gap analysis. */
  lead_time_days: number | null
  /** Standard deviation of lead time in days. Used for safety stock sigma. */
  lead_time_stddev: number | null
  /** When learn_supplier_lead_times() last computed this supplier's lead time. */
  lead_time_computed_at: string | null
  /** How lead_time_days was determined. 'manual' entries are never auto-overwritten. */
  lead_time_source: 'manual' | 'po_history' | 'delivery_history'
  created_at: string
}

export interface ActionHistory {
  id: string
  hotel_id: string
  user_id: string
  action_type: string
  entity_type: string
  entity_id: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  timestamp: string
}

export interface Notification {
  id: string
  hotel_id: string
  user_id: string
  message: string
  type: 'low_stock' | 'expiry' | 'approval' | 'system' | 'predicted_outage' | 'waste_alert' | 'consumption_spike' | 'price_drift' | 'pos_variance' | 'po_discrepancy' | 'contract_expiry'
  timestamp: string
  read: boolean
  /** Operator feedback on why this was dismissed. Forms the intelligence feedback loop. */
  dismissed_reason: string | null
  /** Set for variant-scoped alerts — enables dedup and direct navigation. */
  variant_id: string | null
}

export interface SavedReport {
  id: string
  hotel_id: string
  user_id: string
  name: string
  filters: Record<string, unknown>
  columns: string[]
  schedule: string | null
  last_run: string | null
}

// ─── GDPR ─────────────────────────────────────────────────────────────────────

export interface GdprErasureRequest {
  id: string
  hotel_id: string
  user_id: string
  requested_by: string
  status: 'pending' | 'processed'
  requested_at: string
  processed_at: string | null
}

// ─── Offline sync ─────────────────────────────────────────────────────────────

export interface OfflineMutation {
  id: string
  variant_id: string
  delta: number
  reason: string
  client_timestamp: string
  client_id: string
  hotel_id: string
  user_id: string
  synced: boolean
}

// ─── Stocktake sessions ───────────────────────────────────────────────────────

export interface StocktakeSession {
  id: string
  hotel_id: string
  created_by: string | null
  status: 'draft' | 'committed' | 'cancelled'
  note: string | null
  started_at: string
  committed_at: string | null
}

export interface StocktakeLine {
  id: string
  session_id: string
  hotel_id: string
  variant_id: string
  system_qty: number
  counted_qty: number | null
  // joined via select
  product_variants: {
    name: string
    sku: string
    barcode: string | null
    cost: number
    products: { name: string } | null
  } | null
}

// ─── Auth session ─────────────────────────────────────────────────────────────

export interface AuthSession {
  user: {
    id: string
    email: string
    hotel_id: string
    role: UserRole
  }
  access_token: string
  expires_at: number
}

// ─── Reality Graph ─────────────────────────────────────────────────────────────

export type GraphNodeType =
  | 'hotel' | 'user' | 'product' | 'variant' | 'stock_log'
  | 'restock_request' | 'stocktake_session' | 'stocktake_line'
  | 'alert' | 'report'

export type GraphEdgeType =
  | 'belongs_to_hotel' | 'created_by' | 'causes'
  | 'consumes' | 'restocks' | 'reverts'
  | 'belongs_to_session' | 'triggered_alert'

export interface RelationshipEdge {
  id: string
  hotel_id: string
  source_type: GraphNodeType
  source_id: string
  edge_type: GraphEdgeType
  target_type: GraphNodeType
  target_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Eye Layer ────────────────────────────────────────────────────────────────

/** One row from get_waste_radar() — a variant with a write-off spike vs its 4-week baseline. Eye Layer. */
export interface WasteRadarRow {
  variant_id:          string
  variant_label:       string
  qty_7d:              number
  avg_weekly:          number
  pct_above_baseline:  number
  anomaly_score:       number          // 1–10; higher = stronger unexplained signal
  occupancy_band:      'low' | 'normal' | 'high'
  avg_occupancy_7d:    number          // 7-day hotel occupancy %
  waste_cost_7d:       number          // qty_7d × unit cost
  breakage_qty:        number
  theft_qty:           number
  spoilage_qty:        number
  top_user_email:      string | null   // user who wrote off the most units this week
  top_user_qty:        number | null
}

export interface ConsumptionStatRow {
  variant_id: string
  current_stock: number
  avg_daily: number
  days_until_zero: number | null
}

export interface ConsumptionForecastRow {
  variant_id: string
  product_name: string
  variant_name: string
  sku: string
  current_stock: number
  avg_daily: number
  days_until_zero: number | null
  recommended_order_qty: number
  has_open_request: boolean
}

export interface DeadStockRow {
  variant_id: string
  product_name: string
  variant_name: string
  sku: string
  current_stock: number
  unit_cost: number
  idle_value: number
  days_idle: number
}

export interface ConsumptionSpikeRow {
  variant_id: string
  product_name: string
  variant_name: string
  sku: string
  spike_date: string
  spike_units: number
  avg_daily: number
  spike_ratio: number
}

// ─── Mind Layer ───────────────────────────────────────────────────────────────

export interface ProcurementInsightRow {
  supplier_name: string
  total_orders: number
  fulfilled_orders: number
  avg_fulfillment_days: number | null
  total_spend: number
}

export interface DeliveryEvent {
  id: string
  hotel_id: string
  supplier_id: string
  restock_request_id: string | null
  ordered_qty: number
  received_qty: number
  expected_date: string        // ISO date
  actual_date: string | null   // ISO date; null = in transit
  unit_cost_expected: number | null
  unit_cost_actual: number | null
  notes: string | null
  created_at: string
}

export interface DeliveryEventInput {
  supplier_id: string
  restock_request_id?: string | null
  ordered_qty: number
  received_qty: number
  expected_date: string
  actual_date?: string | null
  unit_cost_expected?: number | null
  unit_cost_actual?: number | null
  notes?: string | null
}

/** Aggregated supplier performance from the supplier_scorecard view. */
export interface SupplierScorecard {
  supplier_id: string
  supplier_name: string
  hotel_id: string
  total_deliveries: number
  completed_deliveries: number
  on_time_deliveries: number
  on_time_rate: number | null           // 0–100 %
  avg_fill_rate: number | null          // 0–100 %
  avg_price_drift_pct: number | null    // % vs expected; positive = overcharged
  avg_days_late: number | null          // negative = arrived early
  last_delivery_date: string | null     // ISO date
  total_received_value: number
  pending_deliveries: number
}

export interface ChainBenchmarkRow {
  hotel_id:         string
  hotel_name:       string
  total_removed:    number
  total_wasted:     number
  waste_rate:       number
  total_added:      number
  avg_fill_rate:    number | null  // avg supplier fill % across all suppliers; null = no delivery data
  avg_on_time_rate: number | null  // avg on-time delivery %; null = no data
}

/** Row from get_invoice_intelligence() — per-supplier invoice pattern analysis */
export interface InvoiceIntelligenceRow {
  supplier_name:             string
  total_deliveries:          number
  deliveries_above_baseline: number
  consecutive_above_count:   number   // current streak of above-baseline deliveries
  avg_variance_pct:          number   // positive = overcharged vs expected cost
  total_financial_impact:    number   // total overcharge amount (currency)
  last_delivery_at:          string   // ISO timestamptz
  anomaly_flag:              boolean  // streak ≥3 OR avg overcharge >10%
  leverage_score:            number   // 0–100 negotiation signal
}

/** Row from get_supplier_synthesis() — composite urgency score per supplier */
export interface SupplierSynthesisRow {
  supplier_id:                string
  supplier_name:              string
  urgency_score:              number          // 0–100 composite risk score
  urgency_tier:               'critical' | 'review' | 'watch' | 'ok'
  reasons:                    string[]        // human-readable signal labels
  fill_rate:                  number | null   // 0–1
  on_time_rate:               number | null   // 0–1
  invoice_avg_variance_pct:   number | null   // positive = overcharge
  consecutive_overcharges:    number          // current streak
  price_drift_pct:            number | null   // positive = price up
  expiry_rate_pct:            number | null   // % of batches that expired
  spend_pct_of_total:         number | null   // this supplier's share of total spend
  total_overcharge:           number          // currency amount
  last_delivery_at:           string | null   // ISO timestamptz
}

/** Full per-property health row returned by get_chain_overview() */
export interface ChainPropertyRow {
  hotel_id: string
  hotel_name: string
  // Stock health
  total_variants: number
  low_stock_count: number
  out_of_stock_count: number
  avg_days_supply: number
  // Flow
  total_added_units: number
  waste_units: number
  waste_cost: number
  waste_rate: number          // 0–1
  stock_log_count: number
  // Restocks
  total_restocks: number
  pending_restocks: number
  // Supplier
  avg_supplier_score: number | null
  // Composite score
  health_score: number        // 0–100
}

export interface WasteCostRow {
  category_name: string
  total_units: number
  total_cost: number
}

/** Monthly per-property waste and activity row from get_chain_health_trend() — Mind Layer */
export interface ChainHealthTrendRow {
  hotel_id:      string
  hotel_name:    string
  period_month:  string   // ISO date string ('YYYY-MM-01')
  waste_cost:    number
  waste_units:   number
  log_count:     number
  restock_count: number
}

/** A flagged item within a shift handover — variant the outgoing manager wants to highlight */
export interface HandoverFlaggedItem {
  variant_id:   string
  product_name: string
  note:         string
  priority:     'urgent' | 'watch' | 'info'
}

/** Shift handover record returned by get_shift_handovers() — Flow Layer */
export interface ShiftHandover {
  id:            string
  created_by:    string | null
  author_email:  string | null
  window_hours:  number
  started_at:    string   // ISO timestamptz
  notes:         string | null
  flagged_items: HandoverFlaggedItem[]
  created_at:    string   // ISO timestamptz
}

/** Per-hotel alert threshold preferences from alert_preferences table — Eye Layer */
export interface AlertPreferences {
  days_threshold:  number   // alert when stock drops below this many days (1–60)
  waste_threshold: number   // alert when weekly waste exceeds this many units (1–500)
}

/** Per-supplier delivery reliability scorecard — Eye Layer */
export interface SupplierReliabilityRow {
  supplier_id:           string | null
  supplier_name:         string
  total_orders:          number
  on_time_orders:        number
  late_orders:           number
  on_time_pct:           number
  avg_delay_days:        number
  max_delay_days:        number
  total_value:           number
  avg_cost_variance_pct: number | null
  active_contracts:      number
  reliability_score:     number
  risk_tier:             'low' | 'medium' | 'high' | 'critical'
  last_delivery_date:    string | null
}

/** Active supplier contract with live price deviation — Mind Layer */
export interface SupplierContract {
  id:                  string
  supplier_id:         string | null
  supplier_name:       string
  variant_id:          string
  variant_name:        string
  product_name:        string
  sku:                 string
  contracted_price:    number
  min_order_qty:       number | null
  contract_start:      string   // ISO date
  contract_end:        string | null
  notes:               string | null
  is_active:           boolean
  created_at:          string
  /** Most recent unit_cost from a 'receive' stock_log for this variant */
  last_received_price: number | null
  /** (last_received - contracted) / contracted * 100, null if never received */
  price_deviation_pct: number | null
}

/** Per-day occupancy record for demand sensing. Eye Layer. */
export interface OccupancyLog {
  id: string
  hotel_id: string
  date: string        // ISO date
  occupancy_pct: number  // 0–100
  occupied_rooms: number | null
  total_rooms: number | null
  source: string
  source_system: string  // 'manual' | 'mews' | 'opera' | etc.
  external_reference_id: string | null
  notes: string | null
  created_at: string
}

/** Forward-looking occupancy forecast entered by managers or pushed by PMS. Eye Layer. */
export interface BookingForecast {
  id: string
  hotel_id: string
  date: string        // ISO date
  expected_occupancy_pct: number  // 0–100
  horizon_source: 'manual' | 'pms'
  created_by: string | null
  created_at: string
  updated_at: string
}

/** PMS connection health row returned by get_pms_health(). Eye Layer. */
export interface PMSHealthRow {
  source_system: string
  last_received_at: string | null
  hours_since_last: number | null
  status: 'connected' | 'warning' | 'disconnected' | 'never_connected'
  total_events: number
}

/** A tracked inventory batch — created when receiving stock with an expiry date. Flow Layer. */
export interface ProductBatch {
  id: string
  hotel_id: string
  variant_id: string
  lot_number: string | null
  expiry_date: string | null  // ISO date
  quantity: number
  received_at: string
  receive_id: string | null
  notes: string | null
  status: 'active' | 'depleted' | 'expired' | 'discarded'
}

/** Row returned by get_expiring_batches() — per-batch expiry with product context. Eye Layer. */
export interface ExpiryBatchRow {
  batch_id: string
  variant_id: string
  variant_name: string
  sku: string
  product_name: string
  category_name: string | null
  lot_number: string | null
  expiry_date: string  // ISO date
  quantity: number
  unit_cost: number
  cost_at_risk: number
  received_at: string
  days_until_expiry: number
  status: string
}

/** Per-supplier leverage summary from get_supplier_leverage() — Mind Layer */
export interface SupplierLeverageRow {
  supplier_id:           string
  supplier_name:         string
  total_deliveries:      number
  completed_deliveries:  number
  on_time_rate:          number | null
  avg_fill_rate:         number | null
  avg_price_drift_pct:   number | null   // positive = overcharged
  avg_days_late:         number | null   // negative = early
  total_spend:           number
  pending_deliveries:    number
  reliability_score:     number          // 0–100
  leverage_score:        number          // 0–100; higher = more negotiating room
  recommended_action:    'Find Alternative' | 'Renegotiate' | 'Monitor' | 'Preferred Supplier'
}

/** Per-delivery price data from get_supplier_price_history() */
export interface SupplierPriceHistoryRow {
  delivery_id:        string
  delivery_date:      string   // ISO date
  unit_cost_expected: number | null
  unit_cost_actual:   number | null
  price_drift_pct:    number | null
  ordered_qty:        number
  received_qty:       number
}

/** One receive line from get_cost_variance_report() — Mind Layer invoice matching */
export interface CostVarianceRow {
  receive_id: string
  received_at: string
  product_name: string
  variant_name: string
  sku: string
  supplier: string
  quantity_received: number
  unit_cost_actual: number
  unit_cost_expected: number
  variance_pct: number | null      // positive = overcharged
  variance_amount: number | null   // (actual - expected) × qty; positive = overcharged
}

// ─── Purchase Orders — Layer: Mind (procure-to-pay) ──────────────────────────

export type POStatus = 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'closed' | 'cancelled'
export type POInvoiceStatus = 'pending' | 'matched' | 'disputed' | 'approved'

export interface PurchaseOrder {
  id: string
  hotel_id: string
  po_number: string
  supplier_id: string | null
  supplier_name: string
  status: POStatus
  notes: string | null
  total_amount: number
  expected_delivery_date: string | null
  sent_at: string | null
  confirmed_at: string | null
  closed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface POLine {
  id: string
  po_id: string
  hotel_id: string
  variant_id: string
  request_id: string | null
  ordered_qty: number
  received_qty: number
  unit_cost: number
  line_total: number
  notes: string | null
}

export interface POInvoice {
  id: string
  hotel_id: string
  po_id: string
  invoice_number: string
  invoice_date: string
  invoice_amount: number
  po_amount: number
  discrepancy_amount: number
  status: POInvoiceStatus
  notes: string | null
  submitted_by: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

/** Aggregated PO row returned by get_po_summary() */
export interface POSummaryRow {
  id: string
  po_number: string
  supplier_name: string
  supplier_id: string | null
  status: POStatus
  total_amount: number
  line_count: number
  received_lines: number
  expected_delivery_date: string | null
  sent_at: string | null
  closed_at: string | null
  created_at: string
  invoice_count: number
  invoice_status: POInvoiceStatus | null
  invoice_discrepancy: number | null
}

// ─── Pick Lists — Layer: Flow ──────────────────────────────────────────────────

export type PickListStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled'

export interface PickList {
  id: string
  hotel_id: string
  name: string
  notes: string | null
  status: PickListStatus
  assigned_to: string | null
  due_date: string | null
  created_by: string
  completed_at: string | null
  created_at: string
}

export interface PickListItem {
  id: string
  pick_list_id: string
  variant_id: string
  quantity_planned: number
  quantity_picked: number
  notes: string | null
  picked_at: string | null
  created_at: string
}

/** PickListItem joined with variant + product info for display */
export interface PickListItemWithVariant extends PickListItem {
  product_variants: {
    id: string
    name: string
    sku: string
    barcode: string | null
    current_stock: number
    unit_of_measure: string
    cost: number
    products: { id: string; name: string } | null
  } | null
}

// ─── Pending Scans (Floor Layer ghost entries) ────────────────────────────────

export interface PendingScan {
  id: string
  hotel_id: string
  scanned_code: string
  location_id: string | null
  location_name: string | null
  approx_quantity: number | null
  notes: string | null
  status: 'unresolved' | 'resolved' | 'skipped'
  created_at: string
  created_by_email: string | null
}

// ─── FEFO batch map (Floor / Flow) ────────────────────────────────────────────

export interface FefoBatchRow {
  variant_id: string
  batch_id: string
  lot_number: string | null
  expiry_date: string | null
  quantity: number
  days_until_expiry: number | null
  supplier_id: string | null
  supplier_name: string | null
}

// ─── Supplier waste analytics (Eye Layer) ─────────────────────────────────────

export interface SupplierWasteRow {
  supplier_id: string
  supplier_name: string
  batches_received: number
  batches_wasted: number
  waste_rate_pct: number | null
  units_wasted: number
  cost_wasted: number
}

// ─── Approval analytics (Flow Layer) ──────────────────────────────────────────

export interface ApprovalVelocityRow {
  required_approval_tier: 'none' | 'manager' | 'director'
  total_requests: number
  approved_count: number
  rejected_count: number
  avg_hours_to_approve: number | null
  avg_hours_to_reject: number | null
  escalated_count: number
}

export interface SpendTrendRow {
  month: string              // ISO date string (DATE_TRUNC result)
  total_estimated: number | null
  actual_fulfilled: number | null  // sum of quantity_received × unit_cost from restock_receives
  request_count: number
  fulfilled_count: number
}

// ─── Supplier Intelligence (Mind Layer) ───────────────────────────────────────

/** Row from get_price_drift() — variant cost change vs N-month baseline */
export interface PriceDriftRow {
  variant_id:   string
  product_name: string
  variant_name: string
  cost_then:    number           // cost at window start
  cost_now:     number           // most recent cost
  pct_change:   number           // positive = more expensive; negative = cheaper
  direction:    'up' | 'down'
  last_changed: string           // ISO timestamptz
}

/** Row from get_spend_concentration() — per-supplier spend as % of total */
export interface SpendConcentrationRow {
  supplier_id:   string | null   // null for text-only legacy supplier references
  supplier_name: string
  total_spend:   number
  pct_of_total:  number          // 0–100
  order_count:   number
}

/** Row from get_supplier_expiry_rates() — expired-with-stock rate per supplier */
export interface SupplierExpiryRateRow {
  supplier_id:         string
  supplier_name:       string
  batches_received:    number
  batches_with_expiry: number
  batches_expired:     number
  expiry_rate_pct:     number | null  // pct of expiry-tracked batches that expired
  units_expired:       number
  cost_expired:        number
}

/** Row from get_price_variance_by_supplier() — invoice price vs baseline per supplier */
export interface PriceVarianceBySupplierRow {
  supplier_id:      string
  supplier_name:    string
  receive_count:    number
  avg_variance_pct: number | null  // positive = overcharged on average
  total_overcharge: number
  total_savings:    number
}

// ─── Causal Trace Engine (Eye → Mind cross-layer) ─────────────────────────────

/** One step in a causal trace chain returned by get_causal_trace() */
export interface CausalTraceStep {
  step:         number        // 0 = root; higher = further back in history
  node_type:    string        // 'notification' | 'stock_log' | 'restock_request' | etc.
  node_id:      string        // uuid of the actual record
  happened_at:  string        // ISO timestamptz
  actor:        string        // email or 'System'
  event_label:  string        // short label e.g. 'Stock Removal'
  description:  string        // full human-readable description with numbers
  causal_link:  string | null // how this connects to the chain; null for root
}

// ─── F&B + POS Intelligence ───────────────────────────────────────────────────

export interface MenuItem {
  id:         string
  hotel_id:   string
  name:       string
  category:   string | null
  sell_price: number | null
  is_active:  boolean
  created_at: string
}

export interface MenuItemIngredient {
  id:            string
  menu_item_id:  string
  variant_id:    string
  qty_per_serve: number
  unit:          string | null
  created_at:    string
}

export interface MenuItemWithIngredients extends MenuItem {
  menu_item_ingredients: (MenuItemIngredient & {
    product_variants: {
      id:   string
      name: string
      sku:  string
      cost: number
      products: { name: string }
    }
  })[]
}

export interface POSConnection {
  id:               string
  hotel_id:         string
  source_system:    string
  last_received_at: string | null
  total_events:     number
  created_at:       string
}

export interface POSHealthRow {
  source_system:    string
  last_received_at: string | null
  hours_since_last: number | null
  status:           'connected' | 'warning' | 'disconnected' | 'never_connected'
  total_events:     number
}

export interface POSSale {
  id:                    string
  hotel_id:              string
  menu_item_id:          string
  quantity_sold:         number
  sale_time:             string
  source_system:         string
  external_reference_id: string | null
  created_at:            string
}

/** Row from get_cogs_by_item() */
export interface COGSByItemRow {
  menu_item_id:          string
  name:                  string
  category:              string | null
  sell_price:            number | null
  qty_sold:              number
  avg_cost_per_serve:    number
  total_ingredient_cost: number
  margin_pct:            number | null
}

/** Row from get_pos_variance() */
export interface POSVarianceRow {
  variant_id:      string
  product_name:    string
  variant_name:    string
  sku:             string
  pos_implied_qty: number
  actual_qty:      number
  variance_qty:    number
  variance_pct:    number | null
}

// ─── GL Export (Sprint 11a) ───────────────────────────────────────────────────

export interface GLAccountMapping {
  id:              string
  hotel_id:        string
  mapping_type:    'category' | 'write_off' | 'default'
  mapping_key:     string
  gl_account_code: string
  gl_account_name: string
  created_at:      string
  updated_at:      string
}

export interface GLExportRow {
  transaction_date: string   // ISO date
  transaction_type: 'procurement_expense' | 'write_off'
  reference_id:     string
  reference_label:  string
  description:      string
  category_name:    string
  gl_account_code:  string
  gl_account_name:  string
  amount:           number
  currency:         string
  is_mapped:        boolean
}

export interface GLExportSummary {
  procurement_count: number
  procurement_total: number
  write_off_count:   number
  write_off_total:   number
  unmapped_count:    number
}

// ─── Briefing Action Feed (Sprint 12) ────────────────────────────────────────

export type BriefingActionType =
  | 'restock_proposal'
  | 'supplier_risk'
  | 'low_stock_no_po'
  | 'low_stock_po_in_flight'
  | 'invoice_discrepancy'
  | 'waste_spike_low_occupancy'
  | 'waste_spike_high_occupancy'
  | 'expiry_soon'
  | 'gl_unmapped'
  | 'gl_period_ending'

export interface BriefingAction {
  action_type:       BriefingActionType
  priority:          number
  entity_id:         string | null
  entity_type:       string | null
  entity_label:      string
  context:           string
  action_url:        string
  action_label:      string
  metadata:          Record<string, unknown>
  /** Secondary sort signal within a priority band. 1–10; higher = more correlated signals. */
  correlation_score: number
}

// ─── Persistent Intelligence Pipeline (Sprint 2) ─────────────────────────────

/** One row from get_intelligence_history() — daily snapshot for the sparkline. */
export interface IntelligenceHistoryRow {
  captured_at:     string   // ISO timestamptz
  situation_level: 'nominal' | 'elevated' | 'critical'
  situation_score: number
  act_now_count:   number
  monitor_count:   number
  proposal_count:  number
}

// ─── Situation Score — Cross-domain escalation engine (Sprint A) ─────────────

/** One cross-domain incident surfaced by get_situation_score(). */
export interface SituationIncident {
  domain:   'stock' | 'waste' | 'suppliers' | 'demand'
  severity: 'critical' | 'warning'
  label:    string
  context:  string
}

/** Result of get_situation_score() — fused multi-domain situation assessment. */
export interface SituationScore {
  /** nominal → no banner shown; elevated → amber; critical → red */
  level:     'critical' | 'elevated' | 'nominal'
  /** 0–100 weighted score */
  score:     number
  incidents: SituationIncident[]
}

// ─── Root Cause Attribution Engine (Sprint 4) ────────────────────────────────

/** Domain of a contributing factor in an anomaly explanation. */
export type AnomalyDomain = 'stock' | 'waste' | 'supply' | 'demand' | 'team'

/** One ranked factor contributing to an anomaly, from explain_anomaly(). */
export interface AnomalyContributingFactor {
  domain: AnomalyDomain
  label:  string
  weight: 'high' | 'medium' | 'low'
}

/** Cross-domain context snapshot attached to every anomaly explanation. */
export interface AnomalyCrossDomainContext {
  occupancy_7d:      number
  last_supply_days:  number | null
  supplier_name:     string | null
  open_po_number:    string | null
  has_open_request:  boolean
  mean_daily_30d:    number
  mean_daily_7d:     number
  /** null = no consumption data */
  days_until_zero:   number | null
}

/**
 * Full structured explanation from explain_anomaly().
 * Always pair with get_causal_trace() for the step-by-step event chain.
 */
export interface AnomalyExplanation {
  variant_id:             string
  variant_label:          string
  anomaly_type:           'waste_spike' | 'stock_depletion'
  /** One-sentence headline: what is happening and at what magnitude. */
  summary:                string
  /** The single most likely root cause, stated in operator language. */
  root_cause:             string
  /** 0–1 confidence based on corroborating signal count. Never display without this qualifier. */
  confidence:             number
  cross_domain_context:   AnomalyCrossDomainContext
  contributing_factors:   AnomalyContributingFactor[]
}

// ─── Probabilistic Intelligence Layer (Sprint 3) ─────────────────────────────

/**
 * Per-variant stockout probability row returned by compute_stockout_probability().
 * Eye Layer — never display without the confidence_score context.
 */
export interface StockoutProbabilityRow {
  variant_id:        string
  product_name:      string
  sku:               string
  current_stock:     number
  /** Mean daily consumption over rolling 30-day window (0-padded days included) */
  mean_daily_30d:    number
  /** Mean daily consumption over last 7 days */
  mean_daily_7d:     number
  /** Population stddev of daily consumption over 30-day window */
  stddev_daily:      number
  /** Deterministic days-until-zero at mean_daily_30d rate; 999 if no consumption */
  days_until_zero:   number
  /** P(stockout within 7 days) 0–100. null = fewer than 3 active data days. */
  stockout_prob_7d:  number | null
  /** P(stockout within 14 days) 0–100. null = insufficient data. */
  stockout_prob_14d: number | null
  /** P(stockout within 30 days) 0–100. null = insufficient data. */
  stockout_prob_30d: number | null
  /**
   * Data confidence 0–1. Full confidence (1.0) requires ≥ 14 active data days.
   * Never show a probability to the operator without qualifying it with this.
   */
  confidence_score:  number
  /**
   * - 'steady'      — coefficient of variation < 0.3 (predictable daily use)
   * - 'variable'    — CV 0.3–1.5 (moderate variability)
   * - 'event_driven'— CV > 1.5 (spiky, event-correlated consumption)
   * - 'sparse'      — fewer than 7 active data days; estimates unreliable
   */
  demand_pattern:    'steady' | 'variable' | 'event_driven' | 'sparse'
  /** Number of days in the 30-day window that had at least one removal */
  data_days:         number
}

// ─── Eye Layer Intelligence (Sprint 13) ──────────────────────────────────────

/** Full cross-layer context for a single variant, returned by get_variant_intelligence(). */
export interface VariantIntelligence {
  variant_id:          string
  variant_label:       string
  current_stock:       number
  low_stock_threshold: number
  /** 30-day non-POS daily avg consumption */
  avg_daily_use:       number
  /** 7-day non-POS daily avg (recent trend) */
  avg_daily_use_7d:    number
  /** % change: 7d avg vs 30d baseline. Positive = accelerating use. Null if no 30d baseline. */
  velocity_change_pct: number | null
  /** Days until zero at 30d avg rate. Null if no consumption data. */
  days_until_zero:     number | null
  /** Days until zero at 7d avg rate. Null if no 7d data. */
  days_until_zero_7d:  number | null
  open_po_id:          string | null
  open_po_number:      string | null
  expected_delivery:   string | null   // ISO date
  /** Units written off in last 7 days */
  waste_7d:            number
  /** 4-week rolling weekly avg write-offs */
  waste_avg_weekly:    number
  /** % above avg; null if avg = 0 */
  waste_spike_pct:     number | null
  expiry_date:         string | null   // ISO date
  value_at_risk:       number
  avg_occupancy_7d:    number
  unread_alert_count:  number
  last_received_at:    string | null   // ISO timestamptz
}

/** One row from get_stock_pressure() — forward-looking depletion risk per variant. */
export interface StockPressureItem {
  variant_id:          string
  label:               string
  current_stock:       number
  avg_daily_use:       number
  days_until_zero:     number
  low_stock_threshold: number
  open_po_id:          string | null
  open_po_number:      string | null
  expected_delivery:   string | null   // ISO date
  urgency_tier:        'critical' | 'warning' | 'watch'
}

// ─── 3-Way Match (Sprint 11b) ─────────────────────────────────────────────────

export type POMatchStatus = 'no_data' | 'pending_invoice' | 'pending_delivery' | 'matched' | 'variance'

/** Row returned by get_po_match() and get_po_match_summary() */
export interface POMatchRow {
  po_id:             string
  po_number:         string
  supplier_name:     string
  po_status:         string
  po_value:          number
  received_value:    number
  invoiced_value:    number
  variance_pct:      number
  match_status:      POMatchStatus
  /** Only present in get_po_match_summary() */
  discrepancy_id?:     string | null
  discrepancy_status?: string | null
}

export interface PODiscrepancy {
  id:              string
  hotel_id:        string
  po_id:           string
  supplier_name:   string | null
  po_value:        number
  received_value:  number
  invoiced_value:  number
  variance_pct:    number
  tolerance_pct:   number
  status:          'pending' | 'approved' | 'rejected'
  reviewed_by:     string | null
  reviewed_at:     string | null
  review_notes:    string | null
  detected_at:     string
}

/** Row from get_spend_forecast() — 30/60/90d forward spend projection */
export interface SpendForecastRow {
  horizon:           string   // '30d' | '60d' | '90d'
  horizon_days:      number
  forecast_spend:    number
  basis_avg_monthly: number
  basis_months:      number   // how many full months contributed to the avg
}

// ─── Probabilistic PAR Engine (Sprint 6) ─────────────────────────────────────

export interface OptimalPARRow {
  variant_id:                   string
  product_name:                 string
  sku:                          string
  current_stock:                number
  current_par:                  number
  // Consumption baseline
  mean_daily_30d:               number
  stddev_daily:                 number
  data_days:                    number
  demand_pattern:               'steady' | 'variable' | 'event_driven' | 'sparse'
  // Lead time
  supplier_name:                string | null
  lead_time_days:               number | null
  lead_time_stddev:             number        // 0 when no PO history
  lead_time_source:             'po_history' | 'supplier_stated' | 'hotel_median' | 'unknown'
  // Occupancy adjustment
  occupancy_correlation:        number | null // Pearson r; null < 10 overlap days
  occupancy_adj_factor:         number        // 1.0 = no adjustment
  // Derived inputs
  adj_mean_daily:               number
  sigma_demand_lt:              number
  safety_stock:                 number
  // Output
  recommended_par:              number
  par_delta:                    number        // recommended − current (negative = reduce)
  change_type:                  'increase' | 'decrease' | 'calibrated' | 'no_data' | 'no_lead_time'
  // Service level analysis
  service_level_at_current_par: number | null // 0–1; null when insufficient data
  expected_stockouts_per_year:  number | null // at current PAR
  // Meta
  confidence_score:             number        // 0–1
  rationale:                    string
}

// ─── CPOR Intelligence (Sprint 9) ────────────────────────────────────────────
// Layer: Mind — Financial intelligence
// Cost Per Occupied Room = (procurement spend + write-off cost) / occupied room nights

/** One calendar month of CPOR data from get_cpor_by_period(). */
export interface CPORPeriodRow {
  period_start:         string         // ISO date (first day of month)
  period_label:         string         // e.g. "Mar 2026"
  procurement_spend:    number
  write_off_cost:       number
  total_cost:           number
  occupied_room_nights: number | null  // null = no occupancy log entries for this period
  avg_occupancy_pct:    number | null
  cpor:                 number | null  // null when no occupancy data
  prev_period_cpor:     number | null
  cpor_change_pct:      number | null  // positive = cost rose (unfavourable); null = no comparison
}

/** Per-category cost breakdown from get_cost_by_category(). */
export interface CostByCategoryRow {
  category_id:       string | null  // null = uncategorised products
  category_name:     string
  procurement_spend: number
  write_off_cost:    number
  total_cost:        number
  cost_pct_of_total: number         // 0–100
  waste_rate_pct:    number | null  // null = no spend recorded
}

// ─── Smart Restock Proposals (Sprint 8) ──────────────────────────────────────
// Layer: Mind → Eye → Flow synthesis
// Probabilistically-enriched proposals: stddev confidence, PO-history lead times,
// Normal-approx stockout probability, PAR-aware quantity.

export interface SmartProposalRow {
  // Identity
  variant_id:              string
  product_name:            string
  variant_name:            string
  sku:                     string
  // Current state
  current_stock:           number
  par_level:               number
  // Consumption intelligence
  mean_daily_30d:          number
  stddev_daily:            number
  data_days:               number
  demand_pattern:          'steady' | 'variable' | 'event_driven' | 'sparse'
  // Depletion
  days_until_zero:         number | null
  /** P(stockout during reorder window) 0–100. null = insufficient data. */
  stockout_prob_lt:        number | null
  // Supplier + lead time
  preferred_supplier_id:   string | null
  preferred_supplier_name: string | null
  lead_time_days:          number | null
  lead_time_source:        'po_history' | 'supplier_stated' | 'hotel_median' | 'unknown'
  // Proposed order
  proposed_qty:            number
  unit_cost:               number
  estimated_cost:          number
  /** Active contracted price for preferred supplier, null if no contract. */
  contracted_price:        number | null
  // Assessment
  signal_type:             'critical' | 'warning' | 'watch'
  urgency_score:           number   // 0–1
  confidence_score:        number   // 0–1
  reasoning:               string
}

// ─── Team Performance Intelligence (Sprint 7) ────────────────────────────────
// Layer: Mind → Eye cross-layer
// Per-member write-off attribution, outlier detection, and team-relative benchmarking.

export interface TeamPerformanceRow {
  user_id:                    string
  email:                      string
  role:                       string
  // Write-off breakdown
  write_off_units:            number
  write_off_cost:             number
  breakage_units:             number
  theft_units:                number
  spoilage_units:             number
  // Operational activity
  consumption_units:          number
  consumption_logs:           number
  additions_logged:           number
  active_days:                number
  last_active_at:             string | null   // ISO timestamptz
  // Derived ratios
  avg_write_off_per_day:      number
  waste_rate_pct:             number | null   // null = no removals
  write_off_rate_vs_team_avg: number          // 1.0 = average; COALESCE'd to 1.0 when no data
  // Restock activity
  restock_requests_filed:     number
  stock_receives_processed:   number
  // Outlier detection
  is_outlier:                 boolean
  outlier_reason:             string | null   // null when not an outlier
}

// ─── Cross-Domain Incident Correlation (Sprint 13) ───────────────────────────

export interface ActiveIncidentRow {
  variant_id:               string
  variant_label:            string
  category_name:            string | null
  current_stock:            number
  par_level:                number
  // Primary signal
  primary_signal_type:      'waste_spike' | 'stockout' | 'below_par_sustained' | 'supply_gap'
  primary_signal:           string
  // Waste domain
  waste_units_7d:           number
  waste_avg_weekly:         number
  waste_spike_pct:          number | null
  waste_rate_pct:           number | null
  // Stock domain
  stockout_days:            number
  below_par_days:           number
  // Team correlation
  team_correlated:          boolean
  top_actor_email:          string | null
  top_actor_share_pct:      number
  // Supply correlation
  supply_correlated:        boolean
  days_since_last_receive:  number | null
  supplier_name:            string | null
  has_open_po:              boolean
  open_po_overdue:          boolean
  // Occupancy context
  occupancy_7d_avg:         number | null
  occupancy_explains:       boolean
  occupancy_contradicts:    boolean
  // Synthesis
  correlation_count:        number
  incident_severity:        'critical' | 'elevated' | 'watch'
  narrative:                string
}

// ─── Product Performance Intelligence (Sprint 12) ────────────────────────────

export interface ProductPerformanceRow {
  variant_id:          string
  product_name:        string
  variant_name:        string
  sku:                 string
  category_name:       string | null
  current_stock:       number
  par_level:           number
  consumption_units:   number
  consumption_value:   number
  waste_units:         number
  waste_cost:          number
  waste_rate_pct:      number | null   // null = no activity
  stockout_days:       number
  below_par_days:      number
  par_compliance_pct:  number
  performance_score:   number          // 0–100, higher = more attention needed
  performance_tier:    'critical' | 'waste_heavy' | 'stockout_prone' | 'at_risk' | 'idle' | 'efficient'
}

// ─── Budget vs Actual Tracker (Sprint 11) ────────────────────────────────────

export interface BudgetVsActualRow {
  category_id:      string | null
  category_name:    string
  period_month:     string           // ISO date — first day of month
  allocated_amount: number | null    // null = no budget set
  actual_spend:     number
  variance:         number | null    // allocated - actual; null if unbudgeted
  variance_pct:     number | null    // variance / allocated × 100
  spend_pct:        number | null    // actual / allocated × 100 (progress bar width)
  status:           'over' | 'warning' | 'on_track' | 'unbudgeted'
}

export interface BudgetTrendRow {
  period_month:           string          // ISO date
  period_label:           string          // e.g. "Mar 2026"
  total_budgeted:         number | null   // null = no budgets set for that month
  total_actual:           number
  categories_over_budget: number
  spend_pct:              number | null
  on_track:               boolean | null
}

// ─── Stocktake Variance Intelligence (Sprint 10) ─────────────────────────────

export interface StocktakeSessionSummary {
  session_id:           string
  started_at:           string        // ISO timestamptz
  committed_at:         string | null
  duration_minutes:     number | null
  created_by_email:     string | null
  note:                 string | null
  total_lines:          number        // all variants in session
  counted_lines:        number        // variants actually counted
  variance_items:       number        // counted_qty != system_qty
  anomaly_items:        number        // |unexplained| >= 3 OR cost >= $25
  total_variance_cost:  number        // sum of |unexplained| × unit_cost
}

export interface StocktakeVarianceRow {
  variant_id:            string
  variant_label:         string
  category_name:         string | null
  system_qty:            number        // stock at session start
  counted_qty:           number        // physical count
  write_offs_during:     number        // logged write-offs during session
  receives_during:       number        // logged receives during session
  raw_variance:          number        // counted - system (no adjustment)
  adjusted_expected:     number        // system - write_offs + receives
  unexplained_variance:  number        // counted - adjusted_expected
  variance_cost:         number        // |unexplained| × unit_cost
  is_anomaly:            boolean       // |unexplained| >= 3 OR cost >= $25
  direction:             'surplus' | 'deficit' | 'exact'
}

