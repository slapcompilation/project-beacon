// Hotel: outbound webhooks fired on every BeaconAction.
// Payloads are HMAC-SHA256 signed; recipient verifies via X-Beacon-Signature header.

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Alert, Button, Callout, Card, Dialog, DialogBody, DialogFooter, FormGroup,
  InputGroup, Intent, Spinner, SpinnerSize, Switch, Tag,
} from '@blueprintjs/core'
import {
  useWebhookEndpoints,
  useCreateWebhookEndpoint,
  useUpdateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useWebhookDeliveries,
} from '@/features/webhooks/hooks'
import type { WebhookEndpoint } from '@/features/webhooks/api'
import { SectionHeader } from './_shared'

const ALL_ACTION_TYPES = [
  'ADJUST_STOCK', 'WRITE_OFF', 'REQUEST_RESTOCK', 'APPROVE_RESTOCK',
  'REJECT_RESTOCK', 'CANCEL_RESTOCK', 'RECEIVE_STOCK', 'REVERT_ACTION',
  'CREATE_SUPPLIER', 'CREATE_PO', 'UPDATE_PO_STATUS', 'SUBMIT_PO_INVOICE', 'MATCH_INVOICE',
] as const

const webhookSchema = z.object({
  name:   z.string().min(1, 'Name is required').max(80),
  url:    z.url('Must be a valid URL').refine((u) => u.startsWith('https://'), 'Must use HTTPS'),
  secret: z.string().min(16, 'Secret must be at least 16 characters'),
})
type WebhookFields = z.infer<typeof webhookSchema>

function generateSecret(): string {
  const arr = new Uint8Array(24)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function DeliveryBadge({ success }: { success: boolean }) {
  return (
    <Tag intent={success ? Intent.SUCCESS : Intent.DANGER} icon={success ? 'tick' : 'cross'} minimal>
      {success ? 'Delivered' : 'Failed'}
    </Tag>
  )
}

function EndpointDeliveries({ endpointId }: { endpointId: string }) {
  const { data: deliveries = [], isLoading } = useWebhookDeliveries(endpointId)

  if (isLoading) return <div className="flex justify-center py-4"><Spinner size={SpinnerSize.SMALL} /></div>
  if (deliveries.length === 0) return (
    <p className="text-xs text-muted-foreground py-3 text-center">No deliveries yet — webhooks fire after any BeaconAction</p>
  )

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {deliveries.map((d) => (
        <div key={d.id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/30 transition-colors">
          <DeliveryBadge success={d.success} />
          <span className="text-[10px] font-mono text-muted-foreground">{d.action_type}</span>
          {d.status_code != null && (
            <span className="text-[10px] text-muted-foreground">HTTP {d.status_code}</span>
          )}
          {d.duration_ms != null && (
            <span className="text-[10px] text-muted-foreground">{d.duration_ms}ms</span>
          )}
          {d.error && (
            <span className="text-[10px] text-red-500 truncate flex-1">{d.error}</span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
            {new Date(d.delivered_at).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  )
}

function WebhookEndpointModal({
  open,
  onClose,
  editing,
}: {
  open:     boolean
  onClose:  () => void
  editing?: WebhookEndpoint | null
}) {
  const create = useCreateWebhookEndpoint()
  const update = useUpdateWebhookEndpoint()
  const [selectedEvents, setSelectedEvents] = useState<string[]>(editing?.event_types ?? [])

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<WebhookFields>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name:   editing?.name   ?? '',
      url:    editing?.url    ?? '',
      secret: editing?.secret ?? '',
    },
  })

  useEffect(() => {
    reset({
      name:   editing?.name   ?? '',
      url:    editing?.url    ?? '',
      secret: editing?.secret ?? '',
    })
    setSelectedEvents(editing?.event_types ?? [])
  }, [editing, reset])

  const onSubmit = async (fields: WebhookFields) => {
    const input = {
      name:        fields.name,
      url:         fields.url,
      secret:      fields.secret,
      event_types: selectedEvents,
      enabled:     editing?.enabled ?? true,
    }
    if (editing) {
      await update.mutateAsync({ id: editing.id, patch: input })
    } else {
      await create.mutateAsync(input)
    }
    onClose()
  }

  const toggleEvent = (type: string) => {
    setSelectedEvents((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  return (
    <Dialog isOpen={open} onClose={onClose} title={editing ? 'Edit webhook' : 'Add webhook endpoint'} icon="notifications-updated">
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
        <DialogBody>
          <FormGroup
            label="Name"
            intent={errors.name ? Intent.DANGER : Intent.NONE}
            helperText={errors.name?.message}
          >
            <InputGroup intent={errors.name ? Intent.DANGER : Intent.NONE} placeholder="e.g. PMS sync, Supplier notify" {...register('name')} />
          </FormGroup>
          <FormGroup
            label="URL"
            intent={errors.url ? Intent.DANGER : Intent.NONE}
            helperText={errors.url?.message}
          >
            <InputGroup intent={errors.url ? Intent.DANGER : Intent.NONE} placeholder="https://your-endpoint.com/webhook" {...register('url')} />
          </FormGroup>
          <FormGroup
            label="Signing secret"
            intent={errors.secret ? Intent.DANGER : Intent.NONE}
            helperText={
              errors.secret?.message ??
              'Beacon signs every payload with X-Beacon-Signature: sha256=…'
            }
            labelInfo={
              <Button variant="minimal" size="small" intent={Intent.PRIMARY} onClick={() => { setValue('secret', generateSecret()) }}>
                Generate
              </Button>
            }
          >
            <InputGroup
              className="font-mono"
              intent={errors.secret ? Intent.DANGER : Intent.NONE}
              placeholder="min 16 characters"
              {...register('secret')}
            />
          </FormGroup>
          <FormGroup
            label="Event filter"
            helperText={
              selectedEvents.length === 0
                ? 'Firing on all action types'
                : `Firing on ${String(selectedEvents.length)} selected type${selectedEvents.length !== 1 ? 's' : ''}`
            }
            labelInfo={
              <Button variant="minimal" size="small" onClick={() => { setSelectedEvents([]) }}>
                All events (clear)
              </Button>
            }
          >
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto rounded border p-2">
              {ALL_ACTION_TYPES.map((type) => (
                <Tag
                  key={type}
                  interactive
                  minimal={!selectedEvents.includes(type)}
                  intent={selectedEvents.includes(type) ? Intent.PRIMARY : Intent.NONE}
                  onClick={() => { toggleEvent(type) }}
                  className="font-mono"
                >
                  {type}
                </Tag>
              ))}
            </div>
          </FormGroup>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button onClick={onClose}>Cancel</Button>
              <Button type="submit" intent={Intent.PRIMARY} loading={isSubmitting}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </>
          }
        />
      </form>
    </Dialog>
  )
}

function WebhookEndpointRow({
  ep,
  onEdit,
  onDelete,
}: {
  ep:       WebhookEndpoint
  onEdit:   () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded]  = useState(false)
  const update                   = useUpdateWebhookEndpoint()

  return (
    <Card compact className="!p-0 divide-y">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{ep.name}</p>
            {!ep.enabled && <Tag minimal>Disabled</Tag>}
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">{ep.url}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ep.event_types.length === 0
              ? 'All events'
              : ep.event_types.slice(0, 3).join(', ') + (ep.event_types.length > 3 ? ` +${String(ep.event_types.length - 3)}` : '')}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={ep.enabled}
            onChange={(e) => { void update.mutateAsync({ id: ep.id, patch: { enabled: e.currentTarget.checked } }) }}
            className="!mb-0"
          />
          <Button variant="minimal" size="small" onClick={() => { setExpanded((x) => !x) }}>
            {expanded ? 'Hide' : 'Log'}
          </Button>
          <Button icon="edit" variant="minimal" size="small" onClick={onEdit} aria-label="Edit webhook" />
          <Button icon="trash" variant="minimal" size="small" intent={Intent.DANGER} onClick={onDelete} aria-label="Delete webhook" />
        </div>
      </div>
      {expanded && (
        <div className="px-4 py-3 bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Recent deliveries</p>
          <EndpointDeliveries endpointId={ep.id} />
        </div>
      )}
    </Card>
  )
}

export function WebhooksSection() {
  const { data: endpoints = [], isLoading } = useWebhookEndpoints()
  const deleteEndpoint                      = useDeleteWebhookEndpoint()
  const [modalOpen, setModalOpen]           = useState(false)
  const [editing, setEditing]               = useState<WebhookEndpoint | null>(null)
  const [deleting, setDeleting]             = useState<WebhookEndpoint | null>(null)

  return (
    <div>
      <SectionHeader
        title="Outbound Webhooks"
        description="Notify external systems (PMS, supplier portals, Slack) whenever a BeaconAction completes. Payloads are HMAC-SHA256 signed."
      />

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner size={SpinnerSize.STANDARD} /></div>
      ) : (
        <div className="space-y-3">
          {endpoints.length === 0 ? (
            <Card compact className="px-4 py-8 text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">No webhook endpoints configured</p>
              <p className="text-xs text-muted-foreground">
                Add an endpoint to push BeaconAction events to your PMS, supplier systems, or automation tools.
              </p>
            </Card>
          ) : (
            endpoints.map((ep) => (
              <WebhookEndpointRow
                key={ep.id}
                ep={ep}
                onEdit={() => { setEditing(ep); setModalOpen(true) }}
                onDelete={() => { setDeleting(ep) }}
              />
            ))
          )}
          <Button icon="plus" onClick={() => { setEditing(null); setModalOpen(true) }}>
            Add endpoint
          </Button>
        </div>
      )}

      <Callout intent={Intent.NONE} icon="info-sign" compact title="Verification" className="mt-6">
        <p>
          Validate each request server-side: <code className="font-mono">HMAC_SHA256(body, secret)</code> must match
          the <code className="font-mono">X-Beacon-Signature</code> header (after stripping the <code className="font-mono">sha256=</code> prefix).
        </p>
        <p>Beacon retries are not automatic — re-delivery is available via the delivery log.</p>
      </Callout>

      <WebhookEndpointModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        editing={editing}
      />

      <Alert
        isOpen={!!deleting}
        intent={Intent.DANGER}
        icon="trash"
        cancelButtonText="Cancel"
        confirmButtonText="Delete"
        onConfirm={() => {
          if (deleting) { void deleteEndpoint.mutateAsync(deleting.id) }
          setDeleting(null)
        }}
        onCancel={() => { setDeleting(null) }}
      >
        <p className="font-semibold mb-1">Delete webhook endpoint</p>
        <p className="text-sm">{`Remove "${deleting?.name ?? ''}"? Delivery history will also be deleted.`}</p>
      </Alert>
    </div>
  )
}
