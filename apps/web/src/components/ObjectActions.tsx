// Layer: meta — inline action panel (used by all object pages)
// Palantir Principle 4: actions live next to data. Operators never navigate away to act.
//
// Every action renders as a button that expands an inline form on click.
// Validates via validateAction() before submission, dispatches via dispatchAction().
// Shows audit trail context (edgesWritten) on success.

import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, CheckCircle2, ChevronDown, Loader2, X, XCircle, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { dispatchAction } from '@/lib/actions/dispatch'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

// ─── Prop shapes (discriminated by nodeType) ──────────────────────────────────

export type ObjectActionsProps =
  | {
      nodeType: 'variant'
      variantId: string
      currentStock: number
      hasOpenRequest?: boolean
    }
  | {
      nodeType: 'restock_request'
      requestId: string
      variantId?: string | null
      status: string
    }
  | {
      nodeType: 'stock_log'
      logId: string
      variantId: string
      isRevert: boolean
    }
  | {
      nodeType: 'purchase_order'
      poId: string
      currentStatus: string
    }

// ─── Inline form primitives ───────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{children}</label>
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground',
        'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring',
        props.className,
      )}
    />
  )
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={2}
      {...props}
      className={cn(
        'w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground resize-none',
        'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring',
        props.className,
      )}
    />
  )
}

// ─── Expandable action row ────────────────────────────────────────────────────

interface ActionShellProps {
  label: string
  variant?: 'default' | 'destructive' | 'outline'
  disabled?: boolean
  children: (close: () => void) => React.ReactNode
}

function ActionShell({ label, variant = 'outline', disabled, children }: ActionShellProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((v) => !v); }}
        className={cn(
          'flex w-full items-center justify-between px-3 py-2 text-xs font-medium transition-colors',
          variant === 'destructive'
            ? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40'
            : 'bg-muted/40 text-foreground hover:bg-muted',
          disabled && 'opacity-40 cursor-not-allowed',
        )}
      >
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2 bg-background border-t border-border">
          {children(() => { setOpen(false); })}
        </div>
      )}
    </div>
  )
}

// ─── Per-action forms ─────────────────────────────────────────────────────────

function RequestRestockForm({ variantId, hotelId, userId, onClose }: {
  variantId: string; hotelId: string; userId: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const q = parseInt(qty, 10)
    if (isNaN(q) || q <= 0) { toast.error('Quantity must be > 0'); return }
    setLoading(true)
    const result = await dispatchAction(
      { type: 'REQUEST_RESTOCK', variantId, hotelId, requestorId: userId, quantityNeeded: q, notes: notes || null },
      { hotelId, actorId: userId, triggeredBy: 'user' },
    )
    setLoading(false)
    if (result.success) {
      toast.success(`Restock requested · ${String(result.edgesWritten)} graph edge${result.edgesWritten !== 1 ? 's' : ''} written`)
      void qc.invalidateQueries({ queryKey: ['variant-restocks', variantId] })
      void qc.invalidateQueries({ queryKey: ['restock-requests'] })
      onClose()
    } else {
      toast.error(result.error.message)
    }
  }

  return (
    <>
      <div>
        <Label>Quantity needed</Label>
        <Input type="number" min={1} placeholder="0" value={qty} onChange={(e) => { setQty(e.target.value); }} />
      </div>
      <div>
        <Label>Notes (optional)</Label>
        <Textarea placeholder="Urgency reason, preferred supplier…" value={notes} onChange={(e) => { setNotes(e.target.value); }} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => { void submit(); }}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Submit'}
        </Button>
      </div>
    </>
  )
}

function PhotoUpload({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <Label>Photo evidence (optional)</Label>
      {file ? (
        <div className="flex items-center gap-2 rounded border border-input bg-background px-2 py-1.5">
          <Camera className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs truncate flex-1">{file.name}</span>
          <button type="button" onClick={() => { onFile(null); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex w-full items-center gap-2 rounded border border-dashed border-input px-2 py-1.5 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
        >
          <Camera className="h-3 w-3" /> Attach photo
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { onFile(e.target.files?.[0] ?? null); }}
      />
    </div>
  )
}

function AdjustStockForm({ variantId, hotelId, userId, onClose }: {
  variantId: string; hotelId: string; userId: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const d = parseInt(delta, 10)
    if (isNaN(d) || d === 0) { toast.error('Delta cannot be zero'); return }
    if (!reason.trim()) { toast.error('Reason is required'); return }
    setLoading(true)
    const result = await dispatchAction(
      { type: 'ADJUST_STOCK', variantId, hotelId, userId, delta: d, reason },
      { hotelId, actorId: userId, triggeredBy: 'user' },
      { photoFile: photo },
    )
    setLoading(false)
    if (result.success) {
      toast.success(`Stock adjusted · ${String(result.edgesWritten)} edge${result.edgesWritten !== 1 ? 's' : ''} written`)
      void qc.invalidateQueries({ queryKey: ['variant-object', variantId] })
      void qc.invalidateQueries({ queryKey: ['variant-logs', variantId] })
      onClose()
    } else {
      toast.error(result.error.message)
    }
  }

  return (
    <>
      <div>
        <Label>Delta (+ add / − remove)</Label>
        <Input type="number" placeholder="+10 or -5" value={delta} onChange={(e) => { setDelta(e.target.value); }} />
      </div>
      <div>
        <Label>Reason</Label>
        <Input placeholder="Counted stock, delivery shortfall…" value={reason} onChange={(e) => { setReason(e.target.value); }} />
      </div>
      <PhotoUpload file={photo} onFile={setPhoto} />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => { void submit(); }}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Adjust'}
        </Button>
      </div>
    </>
  )
}

function WriteOffForm({ variantId, hotelId, userId, onClose }: {
  variantId: string; hotelId: string; userId: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const q = parseInt(qty, 10)
    if (isNaN(q) || q <= 0) { toast.error('Quantity must be > 0'); return }
    if (!reason.trim()) { toast.error('Waste reason is required'); return }
    setLoading(true)
    const result = await dispatchAction(
      { type: 'WRITE_OFF', variantId, hotelId, userId, quantity: q, wasteReason: reason },
      { hotelId, actorId: userId, triggeredBy: 'user' },
      { photoFile: photo },
    )
    setLoading(false)
    if (result.success) {
      toast.success(`Write-off recorded · ${String(result.edgesWritten)} edge${result.edgesWritten !== 1 ? 's' : ''} written`)
      void qc.invalidateQueries({ queryKey: ['variant-object', variantId] })
      void qc.invalidateQueries({ queryKey: ['variant-logs', variantId] })
      onClose()
    } else {
      toast.error(result.error.message)
    }
  }

  return (
    <>
      <div>
        <Label>Quantity to write off</Label>
        <Input type="number" min={1} placeholder="0" value={qty} onChange={(e) => { setQty(e.target.value); }} />
      </div>
      <div>
        <Label>Waste reason</Label>
        <Input placeholder="Expired, spilled, damaged…" value={reason} onChange={(e) => { setReason(e.target.value); }} />
      </div>
      <PhotoUpload file={photo} onFile={setPhoto} />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={loading} onClick={() => { void submit(); }}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Write off'}
        </Button>
      </div>
    </>
  )
}

function ApproveRestockForm({ requestId, variantId, hotelId, userId, onClose }: {
  requestId: string; variantId?: string | null; hotelId: string; userId: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    const result = await dispatchAction(
      { type: 'APPROVE_RESTOCK', requestId, hotelId, notes: notes || null, variantId: variantId ?? undefined },
      { hotelId, actorId: userId, triggeredBy: 'user' },
    )
    setLoading(false)
    if (result.success) {
      toast.success('Restock approved')
      void qc.invalidateQueries({ queryKey: ['restock-requests'] })
      void qc.invalidateQueries({ queryKey: ['restock-object', requestId] })
      onClose()
    } else {
      toast.error(result.error.message)
    }
  }

  return (
    <>
      <div>
        <Label>Notes (optional)</Label>
        <Textarea placeholder="Approval context…" value={notes} onChange={(e) => { setNotes(e.target.value); }} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading} onClick={() => { void submit(); }}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Approve</>}
        </Button>
      </div>
    </>
  )
}

function RejectRestockForm({ requestId, variantId, hotelId, userId, onClose }: {
  requestId: string; variantId?: string | null; hotelId: string; userId: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    const result = await dispatchAction(
      { type: 'REJECT_RESTOCK', requestId, hotelId, reason: reason || null, variantId: variantId ?? undefined },
      { hotelId, actorId: userId, triggeredBy: 'user' },
    )
    setLoading(false)
    if (result.success) {
      toast.success('Restock rejected')
      void qc.invalidateQueries({ queryKey: ['restock-requests'] })
      void qc.invalidateQueries({ queryKey: ['restock-object', requestId] })
      onClose()
    } else {
      toast.error(result.error.message)
    }
  }

  return (
    <>
      <div>
        <Label>Reason (optional)</Label>
        <Textarea placeholder="Why is this being rejected?" value={reason} onChange={(e) => { setReason(e.target.value); }} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={loading} onClick={() => { void submit(); }}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><XCircle className="h-3 w-3 mr-1" />Reject</>}
        </Button>
      </div>
    </>
  )
}

function RevertLogForm({ logId, variantId, hotelId, userId, onClose }: {
  logId: string; variantId: string; hotelId: string; userId: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!reason.trim()) { toast.error('Revert reason is required'); return }
    setLoading(true)
    const result = await dispatchAction(
      { type: 'REVERT_ACTION', originalLogId: logId, variantId, hotelId, userId, revertReason: reason },
      { hotelId, actorId: userId, triggeredBy: 'revert' },
    )
    setLoading(false)
    if (result.success) {
      toast.success('Stock log reverted · compensating entry created')
      void qc.invalidateQueries({ queryKey: ['variant-logs', variantId] })
      void qc.invalidateQueries({ queryKey: ['stock-log-object', logId] })
      onClose()
    } else {
      toast.error(result.error.message)
    }
  }

  return (
    <>
      <p className="text-[10px] text-muted-foreground">
        A compensating stock entry will be created. The original log is preserved for audit.
      </p>
      <div>
        <Label>Revert reason</Label>
        <Input placeholder="Data entry error, system glitch…" value={reason} onChange={(e) => { setReason(e.target.value); }} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={loading} onClick={() => { void submit(); }}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Revert'}
        </Button>
      </div>
    </>
  )
}

function UpdatePOStatusForm({ poId, hotelId, userId, currentStatus, onClose }: {
  poId: string; hotelId: string; userId: string; currentStatus: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const STATUSES = ['draft', 'sent', 'confirmed', 'partially_received', 'closed', 'cancelled'] as const
  type POStatus = typeof STATUSES[number]
  const [status, setStatus] = useState<POStatus>(currentStatus as POStatus)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (status === currentStatus) { onClose(); return }
    setLoading(true)
    const result = await dispatchAction(
      { type: 'UPDATE_PO_STATUS', poId, hotelId, status },
      { hotelId, actorId: userId, triggeredBy: 'user' },
    )
    setLoading(false)
    if (result.success) {
      toast.success(`PO status → ${status}`)
      void qc.invalidateQueries({ queryKey: ['po-object', poId] })
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      onClose()
    } else {
      toast.error(result.error.message)
    }
  }

  return (
    <>
      <div>
        <Label>New status</Label>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as POStatus); }}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="h-7 text-xs" disabled={loading || status === currentStatus} onClick={() => { void submit(); }}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Update'}
        </Button>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ObjectActions(props: ObjectActionsProps) {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  const role    = useAuthStore((s) => s.role)

  const canApprove = role === 'owner' || role === 'admin'
  const canAdjust  = role !== 'limited_access'

  if (!hotelId) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Zap className="h-3.5 w-3.5" />
        Actions
      </div>

      {/* ── Variant actions ──────────────────────────────────────── */}
      {props.nodeType === 'variant' && (
        <>
          <ActionShell label="Request restock" disabled={props.hasOpenRequest}>
            {(close) => (
              <RequestRestockForm
                variantId={props.variantId}
                hotelId={hotelId}
                userId={userId}
                onClose={close}
              />
            )}
          </ActionShell>

          {canAdjust && (
            <ActionShell label="Adjust stock">
              {(close) => (
                <AdjustStockForm
                  variantId={props.variantId}
                  hotelId={hotelId}
                  userId={userId}
                  onClose={close}
                />
              )}
            </ActionShell>
          )}

          {canAdjust && (
            <ActionShell label="Write off (waste)" variant="destructive">
              {(close) => (
                <WriteOffForm
                  variantId={props.variantId}
                  hotelId={hotelId}
                  userId={userId}
                  onClose={close}
                />
              )}
            </ActionShell>
          )}
        </>
      )}

      {/* ── Restock request actions ──────────────────────────────── */}
      {props.nodeType === 'restock_request' && (
        <>
              {canApprove && (props.status === 'pending_manager' || props.status === 'pending_director') && (
            <ActionShell label="Approve restock">
              {(close) => (
                <ApproveRestockForm
                  requestId={props.requestId}
                  variantId={props.variantId}
                  hotelId={hotelId}
                  userId={userId}
                  onClose={close}
                />
              )}
            </ActionShell>
          )}

          {canApprove && (props.status === 'pending_manager' || props.status === 'pending_director') && (
            <ActionShell label="Reject restock" variant="destructive">
              {(close) => (
                <RejectRestockForm
                  requestId={props.requestId}
                  variantId={props.variantId}
                  hotelId={hotelId}
                  userId={userId}
                  onClose={close}
                />
              )}
            </ActionShell>
          )}

          {(props.status === 'pending' || props.status === 'pending_manager' || props.status === 'pending_director') && (
            <ActionShell label="Cancel restock" variant="destructive">
              {(close) => <CancelRestockInline requestId={props.requestId} variantId={props.variantId} hotelId={hotelId} userId={userId} onClose={close} />}
            </ActionShell>
          )}
        </>
      )}

      {/* ── Stock log actions ────────────────────────────────────── */}
      {props.nodeType === 'stock_log' && !props.isRevert && canAdjust && (
        <ActionShell label="Revert this log entry" variant="destructive">
          {(close) => (
            <RevertLogForm
              logId={props.logId}
              variantId={props.variantId}
              hotelId={hotelId}
              userId={userId}
              onClose={close}
            />
          )}
        </ActionShell>
      )}

      {/* ── Purchase order actions ───────────────────────────────── */}
      {props.nodeType === 'purchase_order' && canApprove && (
        <ActionShell label="Update PO status">
          {(close) => (
            <UpdatePOStatusForm
              poId={props.poId}
              hotelId={hotelId}
              userId={userId}
              currentStatus={props.currentStatus}
              onClose={close}
            />
          )}
        </ActionShell>
      )}
    </div>
  )
}

// ─── Inline cancel (simple confirm, no form) ──────────────────────────────────

function CancelRestockInline({ requestId, variantId, hotelId, userId, onClose }: {
  requestId: string; variantId?: string | null; hotelId: string; userId: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)

  const confirm = async () => {
    setLoading(true)
    const result = await dispatchAction(
      { type: 'CANCEL_RESTOCK', requestId, hotelId, variantId: variantId ?? undefined },
      { hotelId, actorId: userId, triggeredBy: 'user' },
    )
    setLoading(false)
    if (result.success) {
      toast.success('Restock cancelled')
      void qc.invalidateQueries({ queryKey: ['restock-requests'] })
      void qc.invalidateQueries({ queryKey: ['restock-object', requestId] })
      onClose()
    } else {
      toast.error(result.error.message)
    }
  }

  return (
    <div className="flex gap-2 justify-end">
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Keep it</Button>
      <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={loading} onClick={() => { void confirm(); }}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, cancel'}
      </Button>
    </div>
  )
}
