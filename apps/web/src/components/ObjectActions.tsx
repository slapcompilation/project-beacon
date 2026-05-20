// Inline expandable action forms. Used by every object page.
// Validates via the Action Registry; surfaces audit edge count on success.

import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, FormGroup, HTMLSelect, Icon, InputGroup, Intent, TextArea } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { dispatchAction } from '@/lib/actions/dispatch'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

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
        onClick={() => { setOpen((v) => !v) }}
        className={cn(
          'flex w-full items-center justify-between px-3 py-2 text-xs font-medium transition-colors',
          variant === 'destructive'
            ? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40'
            : 'bg-muted/40 text-foreground hover:bg-muted',
          disabled && 'opacity-40 cursor-not-allowed',
        )}
      >
        {label}
        <Icon icon="chevron-down" size={14} className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2 bg-background border-t border-border">
          {children(() => { setOpen(false) })}
        </div>
      )}
    </div>
  )
}

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
      <FormGroup label="Quantity needed" labelInfo="(required)">
        <InputGroup type="number" min={1} placeholder="0" value={qty} onChange={(e) => { setQty(e.target.value) }} />
      </FormGroup>
      <FormGroup label="Notes (optional)">
        <TextArea placeholder="Urgency reason, preferred supplier…" value={notes} onChange={(e) => { setNotes(e.target.value) }} fill rows={2} />
      </FormGroup>
      <div className="flex gap-2 justify-end">
        <Button size="small" variant="minimal" onClick={onClose}>Cancel</Button>
        <Button size="small" intent={Intent.PRIMARY} loading={loading} onClick={() => { void submit() }}>
          Submit
        </Button>
      </div>
    </>
  )
}

function PhotoUpload({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <FormGroup label="Photo evidence (optional)">
      {file ? (
        <div className="flex items-center gap-2 rounded border border-input bg-background px-2 py-1.5">
          <Icon icon="camera" size={12} className="text-muted-foreground shrink-0" />
          <span className="text-xs truncate flex-1">{file.name}</span>
          <Button variant="minimal" size="small" icon="cross" onClick={() => { onFile(null) }} aria-label="Remove" />
        </div>
      ) : (
        <Button
          variant="outlined"
          size="small"
          icon="camera"
          fill
          onClick={() => ref.current?.click()}
        >
          Attach photo
        </Button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { onFile(e.target.files?.[0] ?? null) }}
      />
    </FormGroup>
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
      <FormGroup label="Delta (+ add / − remove)">
        <InputGroup type="number" placeholder="+10 or -5" value={delta} onChange={(e) => { setDelta(e.target.value) }} />
      </FormGroup>
      <FormGroup label="Reason">
        <InputGroup placeholder="Counted stock, delivery shortfall…" value={reason} onChange={(e) => { setReason(e.target.value) }} />
      </FormGroup>
      <PhotoUpload file={photo} onFile={setPhoto} />
      <div className="flex gap-2 justify-end">
        <Button size="small" variant="minimal" onClick={onClose}>Cancel</Button>
        <Button size="small" intent={Intent.PRIMARY} loading={loading} onClick={() => { void submit() }}>
          Adjust
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
      <FormGroup label="Quantity to write off">
        <InputGroup type="number" min={1} placeholder="0" value={qty} onChange={(e) => { setQty(e.target.value) }} />
      </FormGroup>
      <FormGroup label="Waste reason">
        <InputGroup placeholder="Expired, spilled, damaged…" value={reason} onChange={(e) => { setReason(e.target.value) }} />
      </FormGroup>
      <PhotoUpload file={photo} onFile={setPhoto} />
      <div className="flex gap-2 justify-end">
        <Button size="small" variant="minimal" onClick={onClose}>Cancel</Button>
        <Button size="small" intent={Intent.DANGER} loading={loading} onClick={() => { void submit() }}>
          Write off
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
      <FormGroup label="Notes (optional)">
        <TextArea placeholder="Approval context…" value={notes} onChange={(e) => { setNotes(e.target.value) }} fill rows={2} />
      </FormGroup>
      <div className="flex gap-2 justify-end">
        <Button size="small" variant="minimal" onClick={onClose}>Cancel</Button>
        <Button size="small" intent={Intent.SUCCESS} icon="tick-circle" loading={loading} onClick={() => { void submit() }}>
          Approve
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
      <FormGroup label="Reason (optional)">
        <TextArea placeholder="Why is this being rejected?" value={reason} onChange={(e) => { setReason(e.target.value) }} fill rows={2} />
      </FormGroup>
      <div className="flex gap-2 justify-end">
        <Button size="small" variant="minimal" onClick={onClose}>Cancel</Button>
        <Button size="small" intent={Intent.DANGER} icon="cross-circle" loading={loading} onClick={() => { void submit() }}>
          Reject
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
      <FormGroup label="Revert reason">
        <InputGroup placeholder="Data entry error, system glitch…" value={reason} onChange={(e) => { setReason(e.target.value) }} />
      </FormGroup>
      <div className="flex gap-2 justify-end">
        <Button size="small" variant="minimal" onClick={onClose}>Cancel</Button>
        <Button size="small" intent={Intent.DANGER} loading={loading} onClick={() => { void submit() }}>
          Revert
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
      <FormGroup label="New status">
        <HTMLSelect
          value={status}
          onChange={(e) => { setStatus(e.target.value as POStatus) }}
          options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
          fill
        />
      </FormGroup>
      <div className="flex gap-2 justify-end">
        <Button size="small" variant="minimal" onClick={onClose}>Cancel</Button>
        <Button size="small" intent={Intent.PRIMARY} loading={loading} disabled={loading || status === currentStatus} onClick={() => { void submit() }}>
          Update
        </Button>
      </div>
    </>
  )
}

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
        <Icon icon="flash" size={14} />
        Actions
      </div>

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
      <Button size="small" variant="minimal" onClick={onClose}>Keep it</Button>
      <Button size="small" intent={Intent.DANGER} loading={loading} onClick={() => { void confirm() }}>
        Yes, cancel
      </Button>
    </div>
  )
}
