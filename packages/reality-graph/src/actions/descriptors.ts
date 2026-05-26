// Action descriptors — typed metadata each BeaconAction declares so UIs can
// auto-render an open-form modal without hand-rolling one per action.
//
// AIP convention: every action has exactly one of
//   invocationMode: 'open-form'         // operator fills a modal
//                 | 'apply-immediately'  // one-click when defaults are valid
//
// `contextFields` are values the caller supplies (variantId from page route,
// hotelId from auth scope, requestorId from auth user) — the modal hides them
// from the operator but threads them into the dispatched action.

import type { BeaconAction } from './types'

export type ActionFieldKind =
  | 'string'
  | 'multiline'
  | 'number'
  | 'currency'
  | 'quantity'
  | 'enum'
  | 'date'

export interface ActionField {
  name:      string
  kind:      ActionFieldKind
  label:     string
  helper?:   string
  required?: boolean
  min?:      number
  max?:      number
  /** Required when kind === 'enum'. */
  options?:  ReadonlyArray<string>
  placeholder?: string
}

export type InvocationMode = 'open-form' | 'apply-immediately'

export interface ActionDescriptor {
  invocationMode: InvocationMode
  title:          string
  description:    string
  /** Visible fields, in render order. */
  fields:         ReadonlyArray<ActionField>
  /** Hidden fields supplied by the caller (route, auth, parent context). */
  contextFields:  ReadonlyArray<string>
  /** Tier required to submit. Soft constraints can lift to org-level. */
  approvalTier:   'self' | 'hotel-admin' | 'org-director'
  /** When apply-immediately, the action runs with the carried payload. */
  submitLabel?:   string
}

type ActionType = BeaconAction['type']

export const actionDescriptors: Record<ActionType, ActionDescriptor> = {
  // ── Restock lifecycle ─────────────────────────────────────────────────────
  REQUEST_RESTOCK: {
    invocationMode: 'open-form',
    title:          'Request restock',
    description:    'Operator-initiated restock request. Approval routes to whoever owns inbound purchasing.',
    fields: [
      { name: 'quantityNeeded', kind: 'quantity', label: 'Quantity', required: true, min: 1 },
      { name: 'urgency',        kind: 'enum',     label: 'Urgency',  options: ['low', 'medium', 'high'] },
      { name: 'supplier',       kind: 'string',   label: 'Supplier', placeholder: 'Leave blank to assign later' },
      { name: 'notes',          kind: 'multiline', label: 'Notes' },
    ],
    contextFields: ['variantId', 'hotelId', 'requestorId'],
    approvalTier:  'self',
    submitLabel:   'Submit request',
  },

  APPROVE_RESTOCK: {
    invocationMode: 'apply-immediately',
    title:          'Approve restock',
    description:    'Marks the request approved and emits the audit edge.',
    fields:         [{ name: 'notes', kind: 'multiline', label: 'Notes' }],
    contextFields:  ['requestId', 'hotelId', 'variantId'],
    approvalTier:   'hotel-admin',
  },

  REJECT_RESTOCK: {
    invocationMode: 'open-form',
    title:          'Reject restock',
    description:    'Rejection requires a reason so the originator can adjust.',
    fields:         [{ name: 'reason', kind: 'multiline', label: 'Reason', required: true }],
    contextFields:  ['requestId', 'hotelId', 'variantId'],
    approvalTier:   'hotel-admin',
  },

  CANCEL_RESTOCK: {
    invocationMode: 'apply-immediately',
    title:          'Cancel restock',
    description:    'Withdraws a pending request.',
    fields:         [],
    contextFields:  ['requestId', 'hotelId', 'variantId'],
    approvalTier:   'self',
  },

  RECEIVE_STOCK: {
    invocationMode: 'open-form',
    title:          'Receive stock',
    description:    'Record arrival against a purchase request. Quantity drives the inventory increment.',
    fields: [
      { name: 'quantityReceived', kind: 'quantity', label: 'Quantity received', required: true, min: 1 },
      { name: 'lotNumber',        kind: 'string',   label: 'Lot number' },
      { name: 'unitCost',         kind: 'currency', label: 'Unit cost' },
      { name: 'expiryDate',       kind: 'date',     label: 'Expiry date' },
      { name: 'notes',            kind: 'multiline', label: 'Notes' },
    ],
    contextFields: ['requestId', 'variantId', 'hotelId', 'supplierId'],
    approvalTier:  'self',
  },

  // ── Stock adjustments ─────────────────────────────────────────────────────
  ADJUST_STOCK: {
    invocationMode: 'open-form',
    title:          'Adjust stock',
    description:    'Manual count correction. Positive deltas add; negative deltas remove. Use Write-off for waste.',
    fields: [
      { name: 'delta',           kind: 'number',   label: 'Delta',  required: true, helper: 'Use negative for removals' },
      { name: 'reason',          kind: 'string',   label: 'Reason', required: true },
      { name: 'removalCategory', kind: 'string',   label: 'Removal category', helper: 'Optional — e.g. damaged, expired, sample' },
    ],
    contextFields: ['variantId', 'hotelId', 'userId'],
    approvalTier:  'self',
  },

  WRITE_OFF: {
    invocationMode: 'open-form',
    title:          'Write off',
    description:    'Removes units due to waste, breakage, or spoilage. Routed to the waste cycle for analytics.',
    fields: [
      { name: 'quantity',    kind: 'quantity',  label: 'Quantity', required: true, min: 1 },
      { name: 'wasteReason', kind: 'multiline', label: 'Reason',   required: true },
    ],
    contextFields: ['variantId', 'hotelId', 'userId'],
    approvalTier:  'self',
  },

  REVERT_ACTION: {
    invocationMode: 'open-form',
    title:          'Revert action',
    description:    'Appends a compensating transaction. The original log is never modified.',
    fields:         [{ name: 'revertReason', kind: 'multiline', label: 'Reason', required: true }],
    contextFields:  ['originalLogId', 'variantId', 'hotelId', 'userId'],
    approvalTier:   'hotel-admin',
  },

  // ── Suppliers ─────────────────────────────────────────────────────────────
  CREATE_SUPPLIER: {
    invocationMode: 'open-form',
    title:          'Create supplier',
    description:    'Adds a supplier to the hotel directory.',
    fields: [
      { name: 'name',         kind: 'string',    label: 'Name', required: true },
      { name: 'contactName',  kind: 'string',    label: 'Contact name' },
      { name: 'email',        kind: 'string',    label: 'Email' },
      { name: 'phone',        kind: 'string',    label: 'Phone' },
      { name: 'leadTimeDays', kind: 'number',    label: 'Lead time (days)', min: 0 },
      { name: 'notes',        kind: 'multiline', label: 'Notes' },
    ],
    contextFields: ['hotelId'],
    approvalTier:  'self',
  },

  UPDATE_SUPPLIER: {
    invocationMode: 'open-form',
    title:          'Edit supplier',
    description:    'Updates supplier directory entry; emits modified_by audit edge.',
    fields: [
      { name: 'name',         kind: 'string',    label: 'Name' },
      { name: 'contactName',  kind: 'string',    label: 'Contact name' },
      { name: 'email',        kind: 'string',    label: 'Email' },
      { name: 'phone',        kind: 'string',    label: 'Phone' },
      { name: 'leadTimeDays', kind: 'number',    label: 'Lead time (days)', min: 0 },
      { name: 'notes',        kind: 'multiline', label: 'Notes' },
    ],
    contextFields: ['supplierId', 'hotelId'],
    approvalTier:  'self',
  },

  DELETE_SUPPLIER: {
    invocationMode: 'apply-immediately',
    title:          'Remove supplier',
    description:    'Removes a supplier from the hotel directory. Existing edges referencing this supplier remain as historical context.',
    fields:         [],
    contextFields:  ['supplierId', 'hotelId'],
    approvalTier:   'hotel-admin',
  },

  LOG_DELIVERY: {
    invocationMode: 'open-form',
    title:          'Log delivery',
    description:    'Records a received delivery against a supplier. Powers reliability scoring + cost-variance tracking.',
    fields: [
      { name: 'orderedQty',       kind: 'quantity', label: 'Ordered qty',       required: true, min: 1 },
      { name: 'receivedQty',      kind: 'quantity', label: 'Received qty',      required: true, min: 0 },
      { name: 'expectedDate',     kind: 'string',   label: 'Expected date',     required: true },
      { name: 'actualDate',       kind: 'string',   label: 'Actual date' },
      { name: 'unitCostExpected', kind: 'number',   label: 'Unit cost (expected)', min: 0 },
      { name: 'unitCostActual',   kind: 'number',   label: 'Unit cost (actual)',   min: 0 },
      { name: 'notes',            kind: 'multiline', label: 'Notes' },
    ],
    contextFields: ['hotelId', 'supplierId', 'restockRequestId'],
    approvalTier:  'self',
  },

  // ── Procurement ───────────────────────────────────────────────────────────
  CREATE_PO: {
    // Multi-line PO modal stays hand-rolled — line editor is bespoke.
    invocationMode: 'apply-immediately',
    title:          'Create purchase order',
    description:    'Multi-line PO; built via the procurement builder.',
    fields:         [],
    contextFields:  ['hotelId', 'supplierId', 'supplierName', 'poNumber', 'lines', 'expectedDeliveryDate', 'notes'],
    approvalTier:   'hotel-admin',
  },

  UPDATE_PO_STATUS: {
    invocationMode: 'open-form',
    title:          'Update PO status',
    description:    'Transition the purchase order through its lifecycle.',
    fields: [
      {
        name: 'status', kind: 'enum', label: 'Status', required: true,
        options: ['draft', 'sent', 'confirmed', 'partially_received', 'closed', 'cancelled'],
      },
    ],
    contextFields: ['poId', 'hotelId'],
    approvalTier:  'hotel-admin',
  },

  SUBMIT_PO_INVOICE: {
    invocationMode: 'open-form',
    title:          'Submit invoice',
    description:    'Attach an invoice to a purchase order. Three-way match runs on submission.',
    fields: [
      { name: 'invoiceNumber', kind: 'string',   label: 'Invoice number',  required: true },
      { name: 'invoiceDate',   kind: 'date',     label: 'Invoice date',    required: true },
      { name: 'invoiceAmount', kind: 'currency', label: 'Invoice amount',  required: true, min: 0 },
      { name: 'notes',         kind: 'multiline', label: 'Notes' },
    ],
    contextFields: ['poId', 'hotelId'],
    approvalTier:  'hotel-admin',
  },

  MATCH_INVOICE: {
    invocationMode: 'apply-immediately',
    title:          'Match invoice',
    description:    'Marks an invoice three-way matched.',
    fields:         [],
    contextFields:  ['invoiceId', 'poId', 'hotelId'],
    approvalTier:   'hotel-admin',
  },

  // ── Lateral transfers ─────────────────────────────────────────────────────
  TRANSFER_STOCK: {
    invocationMode: 'open-form',
    title:          'Transfer stock from sister property',
    description:    'Lateral-before-external move. The source hotel must approve before stock moves.',
    fields: [
      { name: 'quantity', kind: 'quantity',  label: 'Quantity', required: true, min: 1 },
      { name: 'reason',   kind: 'multiline', label: 'Reason',   required: true },
    ],
    contextFields: ['fromHotelId', 'toHotelId', 'variantId'],
    approvalTier:  'hotel-admin',
  },

  APPROVE_TRANSFER: {
    invocationMode: 'apply-immediately',
    title:          'Approve transfer',
    description:    'Source hotel approves; stock movement is atomic.',
    fields:         [],
    contextFields:  ['transferId', 'hotelId'],
    approvalTier:   'hotel-admin',
  },
}

/** Returns the descriptor for an action type, or throws if unregistered. */
export function getActionDescriptor(type: ActionType): ActionDescriptor {
  const d = actionDescriptors[type]
  if (!d) throw new Error(`No descriptor registered for action ${type}`)
  return d
}
