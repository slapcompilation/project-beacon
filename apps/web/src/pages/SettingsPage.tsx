// Layer: Mind (hotel/chain config) + Floor (display preferences) + Eye (alert thresholds)
// Palantir-style Settings: two-column layout, progressive disclosure by role,
// inline auto-save for preferences, explicit Save only for structured entity forms.
//
// 100% Blueprint — no shadcn primitives, no lucide icons. The visual seam
// against shadcn-era pages is intentional during the migration.

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Alert,
  Button,
  Callout,
  Card,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  HTMLSelect,
  HTMLTable,
  Icon,
  InputGroup,
  Intent,
  Slider,
  Spinner,
  SpinnerSize,
  Switch,
  Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { getCurrencySymbol } from '@/lib/currency'
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
} from '@/features/categories/hooks'
import { useActiveHotel, useUpdateHotel, useUpdateHotelConfig, useUpdateAutonomousSettings } from '@/features/hotel/hooks'
import { useUserPrefs, useUpdateUserPrefs } from '@/features/user/hooks'
import { TeamSection } from '@/features/team/components/TeamSection'
import {
  useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation,
} from '@/features/locations/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'
import { hasPermission } from '@beacon/types'
import type { Category, Location, CustomFieldDef, CustomFieldType } from '@beacon/types'
import {
  useCustomFieldDefs, useCreateCustomFieldDef, useUpdateCustomFieldDef, useDeleteCustomFieldDef,
} from '@/features/custom-fields/hooks'
import {
  useCustomRemovalReasons,
  useCreateCustomRemovalReason,
  useUpdateCustomRemovalReason,
  useDeleteCustomRemovalReason,
} from '@/features/removal-reasons/hooks'
import {
  useNotificationFeedback,
  useAlertPreferences,
  useUpdateAlertPreferences,
} from '@/features/notifications/hooks'
import type { TypeFeedback } from '@/features/notifications/hooks'
import {
  useWebhookEndpoints,
  useCreateWebhookEndpoint,
  useUpdateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useWebhookDeliveries,
} from '@/features/webhooks/hooks'
import type { WebhookEndpoint } from '@/features/webhooks/api'
import { useApprovalThresholds, useUpdateApprovalThresholds } from '@/features/restock/hooks'
import { useCronHealthSummary } from '@/features/monitor/hooks'
import { useOrganizations } from '@/features/organizations/hooks'

// ─── Nav config ────────────────────────────────────────────────────────────────

type SectionId =
  | 'notifications'
  | 'alert-thresholds'
  | 'approval-thresholds'
  | 'autonomous'
  | 'categories'
  | 'locations'
  | 'custom-fields'
  | 'move-reasons'
  | 'hotel'
  | 'team'
  | 'webhooks'
  | 'danger'

interface NavItem {
  id: SectionId
  label: string
  icon: IconName
  layerDot: string
  /** Minimum role required to see this section. undefined = all roles. */
  requirePermission?: Parameters<typeof hasPermission>[1]
}

const NAV: NavItem[] = [
  // Eye
  { id: 'notifications',       label: 'Notifications',      icon: 'notifications',           layerDot: 'bg-slate-400' },
  { id: 'alert-thresholds',    label: 'Alert Thresholds',   icon: 'dashboard',               layerDot: 'bg-orange-500' },
  // Flow
  { id: 'approval-thresholds', label: 'Approval Thresholds',icon: 'shield',                  layerDot: 'bg-amber-500',  requirePermission: 'can_manage_hotels' },
  { id: 'autonomous',          label: 'Autonomous Ops',     icon: 'predictive-analysis',     layerDot: 'bg-amber-500',  requirePermission: 'can_manage_hotels' },
  // Inventory
  { id: 'categories',        label: 'Categories',       icon: 'folder-open',                 layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'locations',         label: 'Locations',        icon: 'map-marker',                  layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'custom-fields',     label: 'Custom Fields',    icon: 'horizontal-bar-chart-desc',   layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'move-reasons',      label: 'Move Reasons',     icon: 'clipboard',                   layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  // Hotel
  { id: 'hotel',             label: 'Hotel Profile',    icon: 'office',                      layerDot: 'bg-purple-500', requirePermission: 'can_manage_hotels' },
  { id: 'team',              label: 'Team',             icon: 'people',                      layerDot: 'bg-purple-500', requirePermission: 'can_manage_users' },
  { id: 'webhooks',          label: 'Webhooks',         icon: 'notifications-updated',       layerDot: 'bg-purple-500', requirePermission: 'can_manage_hotels' },
  // Danger zone
  { id: 'danger',            label: 'GDPR',             icon: 'shield',                      layerDot: 'bg-red-500',    requirePermission: 'can_manage_users' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

// ─── Eye: Alert feedback loop ──────────────────────────────────────────────────
// Principle 8: Notification intelligence loop — aggregate dismissed_reason by
// alert type to surface model quality (incorrect_data rate) and operator habits.

const REASON_LABELS: Record<string, string> = {
  resolved:          'Resolved',
  already_knew:      'Already knew',
  incorrect_data:    'Incorrect data',
  will_handle_later: 'Will handle later',
  none:              'No reason',
}
const REASON_ORDER = ['resolved', 'already_knew', 'incorrect_data', 'will_handle_later', 'none']

const TYPE_LABELS: Record<string, string> = {
  low_stock:             'Low Stock',
  expiry:                'Expiry',
  waste_alert:           'Waste Alert',
  predicted_outage:      'Predicted Outage',
  accelerated_depletion: 'Accelerated Depletion',
  occupancy_spike:       'Occupancy Spike',
  theft_alert:           'Theft',
  approval:              'Approval',
  system:                'System',
}

function FeedbackLoopPanel() {
  const { data: feedback = [], isLoading } = useNotificationFeedback()

  const totalDismissed = useMemo(() => feedback.reduce((s, r) => s + r.total, 0), [feedback])
  const overallIncorrectRate = useMemo(() => {
    if (totalDismissed === 0) return 0
    const totalIncorrect = feedback.reduce((s, r) => s + (r.reasons['incorrect_data'] ?? 0), 0)
    return (totalIncorrect / totalDismissed) * 100
  }, [feedback, totalDismissed])

  const qualityLabel =
    overallIncorrectRate < 10  ? { text: 'Well-calibrated', intent: Intent.SUCCESS } :
    overallIncorrectRate < 20  ? { text: 'Some noise — review thresholds', intent: Intent.WARNING } :
                                  { text: 'High noise — thresholds need tuning', intent: Intent.DANGER }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Loading feedback data…
      </div>
    )
  }

  if (feedback.length === 0) {
    return (
      <Card className="px-5 py-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">No feedback signal yet</p>
        <p className="mt-1 text-xs text-muted-foreground/70 max-w-xs mx-auto">
          Dismiss alerts with a reason from the Notifications panel to start building this dataset.
          Incorrect data rate &lt; 10% means the model is well-calibrated.
        </p>
      </Card>
    )
  }

  return (
    <Card compact className="!p-0 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alert Intelligence Loop</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">Last 90 days · {String(totalDismissed)} dismissed</span>
      </div>

      {/* Table */}
      <HTMLTable compact striped className="w-full">
        <thead>
          <tr>
            <th className="text-left w-36">Alert type</th>
            <th className="text-right w-14">Total</th>
            {REASON_ORDER.map((r) => (
              <th key={r} className={cn(
                'text-right',
                r === 'incorrect_data' && 'text-orange-500',
              )}>
                {REASON_LABELS[r]}
                {r === 'incorrect_data' && ' ⚠'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {feedback.map((row: TypeFeedback) => (
            <tr key={row.type}>
              <td className="font-medium">{TYPE_LABELS[row.type] ?? row.type}</td>
              <td className="text-right tabular-nums font-semibold">{row.total}</td>
              {REASON_ORDER.map((r) => {
                const count = row.reasons[r] ?? 0
                const pct   = row.total > 0 ? Math.round((count / row.total) * 100) : 0
                return (
                  <td key={r} className={cn(
                    'text-right tabular-nums',
                    count === 0 ? 'text-muted-foreground/40' :
                    r === 'incorrect_data' && pct >= 20 ? 'text-red-600 dark:text-red-400 font-semibold' :
                    r === 'incorrect_data' && pct >= 10 ? 'text-yellow-600 dark:text-yellow-500 font-medium' :
                    'text-foreground',
                  )}>
                    {count === 0 ? '—' : `${String(count)} (${String(pct)}%)`}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </HTMLTable>

      {/* Footer — overall quality signal */}
      <div className="px-4 py-2.5 bg-muted/20 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Overall incorrect data rate: <span className="font-semibold tabular-nums">{overallIncorrectRate.toFixed(1)}%</span>
        </span>
        <Tag intent={qualityLabel.intent} minimal>{qualityLabel.text}</Tag>
      </div>
    </Card>
  )
}

// ─── Eye: Notification config ──────────────────────────────────────────────────

function NotificationsSection() {
  const { data: prefs } = useUserPrefs()
  const update = useUpdateUserPrefs()
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  )

  const requestPush = async () => {
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  return (
    <div>
      <SectionHeader
        title="Notifications"
        description="Browser push notifications and quiet hours configuration."
      />
      <div>
        {'Notification' in window && (
          <SettingRow
            label="Browser push notifications"
            description="Low-stock alerts, restock approvals, system events"
          >
            {permission === 'granted' ? (
              <Tag intent={Intent.SUCCESS} minimal>Enabled</Tag>
            ) : permission === 'denied' ? (
              <Tag minimal>Blocked by browser</Tag>
            ) : (
              <Button intent={Intent.PRIMARY} size="small" onClick={() => { void requestPush() }}>
                Enable
              </Button>
            )}
          </SettingRow>
        )}

        <SettingRow
          label="Quiet hours — start"
          description="Suppress notifications from this time"
        >
          <InputGroup
            type="time"
            className="w-32"
            defaultValue={prefs?.quiet_hours_start ?? ''}
            onBlur={(e) => {
              const v = e.target.value
              update.mutate({ quiet_hours_start: v || null })
            }}
          />
        </SettingRow>

        <SettingRow
          label="Quiet hours — end"
          description="Resume notifications at this time"
        >
          <InputGroup
            type="time"
            className="w-32"
            defaultValue={prefs?.quiet_hours_end ?? ''}
            onBlur={(e) => {
              const v = e.target.value
              update.mutate({ quiet_hours_end: v || null })
            }}
          />
        </SettingRow>
      </div>
      {prefs?.quiet_hours_start && prefs.quiet_hours_end && (
        <p className="mt-2 text-xs text-muted-foreground">
          Silenced from {prefs.quiet_hours_start} to {prefs.quiet_hours_end}.
        </p>
      )}

      {/* Feedback loop aggregation */}
      <div className="mt-8">
        <div className="mb-3">
          <p className="text-sm font-semibold">Alert Intelligence Loop</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Why operators dismissed alerts in the last 90 days. High incorrect-data rate signals threshold miscalibration.
          </p>
        </div>
        <FeedbackLoopPanel />
      </div>
    </div>
  )
}

// ─── Eye: Alert Thresholds ─────────────────────────────────────────────────────

function AlertThresholdsSection() {
  const { data: prefs } = useAlertPreferences()
  const update = useUpdateAlertPreferences()

  const daysThreshold  = prefs?.days_threshold  ?? 7
  const wasteThreshold = prefs?.waste_threshold ?? 10

  return (
    <div>
      <SectionHeader
        title="Alert Thresholds"
        description="Hotel-wide thresholds used by the Eye Layer alert engine. Changes apply to the next alert scan."
      />
      <div>
        <div className="py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium">Low-stock warning window</p>
              <p className="text-xs text-muted-foreground">Alert when days-until-zero falls below this threshold</p>
            </div>
            <span className="tabular-nums text-sm font-semibold text-foreground w-16 text-right">
              {String(daysThreshold)}d
            </span>
          </div>
          <Slider
            min={1}
            max={60}
            stepSize={1}
            labelStepSize={10}
            value={daysThreshold}
            onChange={(v) => {
              update.mutate({ days_threshold: v, waste_threshold: wasteThreshold })
            }}
            className="w-full"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">1d (urgent)</span>
            <span className="text-[10px] text-muted-foreground">60d (conservative)</span>
          </div>
        </div>

        <div className="py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium">Waste alert minimum</p>
              <p className="text-xs text-muted-foreground">Alert when wasted units in the period exceeds this</p>
            </div>
            <span className="tabular-nums text-sm font-semibold text-foreground w-16 text-right">
              {String(wasteThreshold)} units
            </span>
          </div>
          <Slider
            min={1}
            max={500}
            stepSize={1}
            labelStepSize={100}
            value={wasteThreshold}
            onChange={(v) => {
              update.mutate({ days_threshold: daysThreshold, waste_threshold: v })
            }}
            className="w-full"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">1 (sensitive)</span>
            <span className="text-[10px] text-muted-foreground">500 (tolerant)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Flow: Categories ──────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  parentId: z.string().nullable().optional(),
  requirePhotoOver: z.number().int().min(0).nullable().optional(),
})
type CategoryFields = z.infer<typeof categorySchema>

function CategoryModal({
  open, onClose, editing, categories,
}: {
  open: boolean
  onClose: () => void
  editing?: Category | null
  categories: Category[]
}) {
  const create = useCreateCategory()
  const update = useUpdateCategory()

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<CategoryFields>({
    resolver: zodResolver(categorySchema),
    values: editing
      ? { name: editing.name, parentId: editing.parent_id, requirePhotoOver: editing.require_photo_for_removal_over }
      : { name: '', parentId: null, requirePhotoOver: null },
  })

  const onSubmit = async (data: CategoryFields) => {
    const parentId = data.parentId ?? null
    const requirePhotoOver = data.requirePhotoOver ?? null
    if (editing) {
      await update.mutateAsync({ id: editing.id, name: data.name, parentId, requirePhotoOver })
    } else {
      await create.mutateAsync({ name: data.name, parentId })
    }
    reset()
    onClose()
  }

  const parentOptions = categories.filter((c) => !c.parent_id && c.id !== editing?.id)

  return (
    <Dialog
      isOpen={open}
      onClose={onClose}
      title={editing ? 'Edit Category' : 'Add Category'}
      icon="folder-open"
    >
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
        <DialogBody>
          <FormGroup
            label="Name"
            labelFor="cat-name"
            intent={errors.name ? Intent.DANGER : Intent.NONE}
            helperText={errors.name?.message}
          >
            <InputGroup
              id="cat-name"
              placeholder="e.g. Beverages"
              intent={errors.name ? Intent.DANGER : Intent.NONE}
              {...register('name')}
            />
          </FormGroup>
          <FormGroup label="Parent category" labelFor="cat-parent">
            <Controller
              name="parentId"
              control={control}
              render={({ field }) => (
                <HTMLSelect
                  id="cat-parent"
                  fill
                  value={field.value ?? '__none__'}
                  onChange={(e) => { field.onChange(e.target.value === '__none__' ? null : e.target.value) }}
                  options={[
                    { value: '__none__', label: 'None (top-level)' },
                    ...parentOptions.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
            />
          </FormGroup>
          {editing && (
            <FormGroup
              label="Require photo for removals over (units)"
              labelFor="cat-photo"
              helperText="Staff must attach a photo when removing more than this quantity."
            >
              <InputGroup
                id="cat-photo"
                type="number"
                min={0}
                step={1}
                placeholder="Leave blank to disable"
                {...register('requirePhotoOver', { valueAsNumber: true })}
              />
            </FormGroup>
          )}
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" intent={Intent.PRIMARY} loading={isSubmitting}>
                {editing ? 'Save Changes' : 'Add Category'}
              </Button>
            </>
          }
        />
      </form>
    </Dialog>
  )
}

function CategoriesSection() {
  const { data: categories = [], isLoading } = useCategories()
  const deleteCategory = useDeleteCategory()
  const updateCategory = useUpdateCategory()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const topLevel = categories.filter((c) => !c.parent_id)
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId)

  const handleDrop = (targetCat: Category) => {
    if (!dragId || dragId === targetCat.id) return
    const dragged = categories.find((c) => c.id === dragId)
    if (!dragged) return
    // Only allow: drag any cat → into a top-level cat (makes it a child)
    // or drag a child → top-level row to remove its parent
    const newParentId = targetCat.parent_id === null ? targetCat.id : null
    if (dragged.parent_id === newParentId) return // no change
    updateCategory.mutate({
      id: dragged.id,
      name: dragged.name,
      parentId: newParentId,
      requirePhotoOver: dragged.require_photo_for_removal_over,
    })
    setDragId(null); setDropTargetId(null)
  }

  const renderCatRow = (cat: Category, indent = false) => (
    <div
      key={cat.id}
      draggable
      onDragStart={(e) => { e.stopPropagation(); setDragId(cat.id) }}
      onDragOver={(e) => { e.preventDefault(); setDropTargetId(cat.id) }}
      onDragLeave={() => { setDropTargetId(null) }}
      onDrop={(e) => { e.preventDefault(); handleDrop(cat) }}
      onDragEnd={() => { setDragId(null); setDropTargetId(null) }}
      className={cn(
        'flex items-center justify-between px-4 py-2.5 transition-colors',
        indent && 'pl-10 bg-muted/30',
        dropTargetId === cat.id && dragId !== cat.id && 'bg-primary/10 ring-1 ring-inset ring-primary/30'
      )}
    >
      <div className="flex items-center gap-2">
        <Icon icon="drag-handle-vertical" size={14} className="text-muted-foreground/40 cursor-grab flex-shrink-0" />
        <div>
          <span className={cn('text-sm', indent ? 'text-muted-foreground' : 'font-medium')}>{cat.name}</span>
          {cat.require_photo_for_removal_over != null && (
            <span className="ml-2 text-xs text-muted-foreground">photo &gt;{cat.require_photo_for_removal_over}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          icon="edit"
          variant="minimal"
          size="small"
          aria-label="Edit category"
          onClick={() => { setEditing(cat); setModalOpen(true) }}
        />
        <Button
          icon="trash"
          variant="minimal"
          size="small"
          intent={Intent.DANGER}
          aria-label="Delete category"
          onClick={() => { deleteCategory.mutate(cat.id) }}
        />
      </div>
    </div>
  )

  return (
    <div>
      <SectionHeader title="Categories" description="Organise products into categories and sub-categories. Drag a category onto another to nest it." />
      <div className="flex justify-end mb-3">
        <Button icon="plus" intent={Intent.PRIMARY} onClick={() => { setEditing(null); setModalOpen(true) }}>
          Add Category
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Spinner size={SpinnerSize.SMALL} />Loading…
        </div>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No categories yet.</p>
      ) : (
        <Card compact className="!p-0 divide-y">
          {topLevel.map((cat) => (
            <div key={cat.id}>
              {renderCatRow(cat)}
              {childrenOf(cat.id).map((child) => renderCatRow(child, true))}
            </div>
          ))}
        </Card>
      )}
      <CategoryModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        editing={editing}
        categories={categories}
      />
    </div>
  )
}

// ─── Flow: Locations ───────────────────────────────────────────────────────────

function LocationsSection() {
  const { data: locations = [], isLoading } = useLocations()
  const createLocation = useCreateLocation()
  const updateLocation = useUpdateLocation()
  const deleteLocation = useDeleteLocation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addName, setAddName] = useState('')
  const [addParentId, setAddParentId] = useState<string>('__none__')
  const [adding, setAdding] = useState(false)

  const topLevel = locations.filter((l) => !l.parent_id)
  const childrenOf = (id: string) => locations.filter((l) => l.parent_id === id)

  const handleAdd = async () => {
    if (!addName.trim()) return
    await createLocation.mutateAsync({ name: addName.trim(), parent_id: addParentId === '__none__' ? null : addParentId })
    setAddName(''); setAddParentId('__none__'); setAdding(false)
  }

  const handleSaveEdit = async (loc: Location) => {
    if (!editName.trim()) return
    await updateLocation.mutateAsync({ id: loc.id, input: { name: editName.trim() } })
    setEditingId(null)
  }

  const renderRow = (loc: Location, indent = false) => (
    <div key={loc.id} className={cn('flex items-center gap-3 px-4 py-2.5', indent && 'pl-10 bg-muted/30')}>
      <Icon icon="map-marker" size={14} className={cn('flex-shrink-0', indent ? 'text-muted-foreground/60' : 'text-muted-foreground')} />
      {editingId === loc.id ? (
        <InputGroup
          className="flex-1"
          value={editName}
          onChange={(e) => { setEditName(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveEdit(loc); if (e.key === 'Escape') setEditingId(null) }}
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm">{loc.name}</span>
      )}
      {editingId === loc.id ? (
        <Button size="small" onClick={() => void handleSaveEdit(loc)}>Save</Button>
      ) : (
        <>
          <Button
            icon="edit"
            variant="minimal"
            size="small"
            aria-label="Edit location"
            onClick={() => { setEditingId(loc.id); setEditName(loc.name) }}
          />
          <Button
            icon="trash"
            variant="minimal"
            size="small"
            intent={Intent.DANGER}
            aria-label="Delete location"
            onClick={() => { deleteLocation.mutate(loc.id) }}
          />
        </>
      )}
    </div>
  )

  return (
    <div>
      <SectionHeader title="Storage Locations" description="Define floors, rooms, and storage units. Assign them to variants." />
      <div className="flex justify-end mb-3">
        <Button icon="plus" intent={Intent.PRIMARY} onClick={() => { setAdding(true) }}>Add Location</Button>
      </div>
      {adding && (
        <Card compact className="mb-3 !bg-muted/30">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <InputGroup
              placeholder="Location name…"
              value={addName}
              onChange={(e) => { setAddName(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
              autoFocus
            />
            <HTMLSelect
              value={addParentId}
              onChange={(e) => { setAddParentId(e.target.value) }}
              options={[
                { value: '__none__', label: 'Top level' },
                ...topLevel.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button onClick={() => { setAdding(false) }}>Cancel</Button>
            <Button intent={Intent.PRIMARY} onClick={() => void handleAdd()} disabled={!addName.trim()} loading={createLocation.isPending}>
              Add Location
            </Button>
          </div>
        </Card>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Spinner size={SpinnerSize.SMALL} />Loading…</div>
      ) : locations.length === 0 && !adding ? (
        <Card compact className="py-10 flex flex-col items-center gap-2 text-center">
          <Icon icon="map-marker" size={32} className="text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No locations yet.</p>
        </Card>
      ) : locations.length > 0 ? (
        <Card compact className="!p-0 divide-y">
          {topLevel.map((loc) => (
            <div key={loc.id}>{renderRow(loc)}{childrenOf(loc.id).map((c) => renderRow(c, true))}</div>
          ))}
        </Card>
      ) : null}
    </div>
  )
}

// ─── Flow: Custom Fields ───────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text', number: 'Number', date: 'Date', boolean: 'Yes/No',
}

function CustomFieldsSection() {
  const { data: fields = [], isLoading } = useCustomFieldDefs()
  const createField = useCreateCustomFieldDef()
  const updateField = useUpdateCustomFieldDef()
  const deleteField = useDeleteCustomFieldDef()
  const [addingOpen, setAddingOpen] = useState(false)
  const [editingField, setEditingField] = useState<CustomFieldDef | null>(null)
  const [addName, setAddName] = useState('')
  const [deleteFieldConfirm, setDeleteFieldConfirm] = useState<{ id: string; name: string } | null>(null)
  const [addType, setAddType] = useState<CustomFieldType>('text')
  const [editName, setEditName] = useState('')
  const [dragFieldId, setDragFieldId] = useState<string | null>(null)
  const [dropFieldId, setDropFieldId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!addName.trim()) return
    await createField.mutateAsync({ name: addName.trim(), field_type: addType })
    setAddName(''); setAddType('text'); setAddingOpen(false)
  }

  const handleSaveEdit = async (field: CustomFieldDef) => {
    if (!editName.trim()) return
    await updateField.mutateAsync({ id: field.id, input: { name: editName.trim() } })
    setEditingField(null)
  }

  const handleFieldDrop = (targetField: CustomFieldDef) => {
    if (!dragFieldId || dragFieldId === targetField.id) return
    // Swap sort_orders between the two fields
    const dragged = fields.find((f) => f.id === dragFieldId)
    if (!dragged) return
    updateField.mutate({ id: dragged.id, input: { sort_order: targetField.sort_order } })
    updateField.mutate({ id: targetField.id, input: { sort_order: dragged.sort_order } })
    setDragFieldId(null); setDropFieldId(null)
  }

  return (
    <div>
      <SectionHeader title="Custom Fields" description="Add extra fields to all product variants. Mark as required to enforce data entry. Drag to reorder." />
      <div className="flex justify-end mb-3">
        <Button icon="plus" intent={Intent.PRIMARY} onClick={() => { setAddingOpen(true) }}>Add Field</Button>
      </div>
      {addingOpen && (
        <Card compact className="mb-3 !bg-muted/30">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <InputGroup
              placeholder="Field name…"
              value={addName}
              onChange={(e) => { setAddName(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
              autoFocus
            />
            <HTMLSelect
              value={addType}
              onChange={(e) => { setAddType(e.target.value as CustomFieldType) }}
              options={[
                { value: 'text',    label: 'Text' },
                { value: 'number',  label: 'Number' },
                { value: 'date',    label: 'Date' },
                { value: 'boolean', label: 'Yes/No' },
              ]}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button onClick={() => { setAddingOpen(false) }}>Cancel</Button>
            <Button intent={Intent.PRIMARY} onClick={() => void handleAdd()} disabled={!addName.trim()} loading={createField.isPending}>
              Add Field
            </Button>
          </div>
        </Card>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Spinner size={SpinnerSize.SMALL} />Loading…</div>
      ) : fields.length === 0 && !addingOpen ? (
        <p className="text-sm text-muted-foreground py-4">No custom fields yet.</p>
      ) : fields.length > 0 ? (
        <Card compact className="!p-0 divide-y">
          {fields.map((field) => (
            <div
              key={field.id}
              draggable
              onDragStart={() => { setDragFieldId(field.id) }}
              onDragOver={(e) => { e.preventDefault(); setDropFieldId(field.id) }}
              onDragLeave={() => { setDropFieldId(null) }}
              onDrop={(e) => { e.preventDefault(); handleFieldDrop(field) }}
              onDragEnd={() => { setDragFieldId(null); setDropFieldId(null) }}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-colors',
                dropFieldId === field.id && dragFieldId !== field.id && 'bg-primary/10 ring-1 ring-inset ring-primary/30'
              )}
            >
              <Icon icon="drag-handle-vertical" size={14} className="text-muted-foreground/40 cursor-grab flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {editingField?.id === field.id ? (
                  <InputGroup
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveEdit(field); if (e.key === 'Escape') setEditingField(null) }}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{field.name}</span>
                    <Tag minimal>{FIELD_TYPE_LABELS[field.field_type]}</Tag>
                    {field.required && (
                      <Tag minimal intent={Intent.DANGER}>Required</Tag>
                    )}
                  </div>
                )}
              </div>
              {editingField?.id === field.id ? (
                <Button size="small" onClick={() => void handleSaveEdit(field)}>Save</Button>
              ) : (
                <>
                  <Switch
                    checked={field.required}
                    onChange={(e) => {
                      updateField.mutate({ id: field.id, input: { required: e.currentTarget.checked } })
                    }}
                    aria-label={`Mark ${field.name} as required`}
                    className="!mb-0"
                  />
                  <Button
                    icon="edit"
                    variant="minimal"
                    size="small"
                    aria-label="Edit field"
                    onClick={() => { setEditingField(field); setEditName(field.name) }}
                  />
                  <Button
                    icon="trash"
                    variant="minimal"
                    size="small"
                    intent={Intent.DANGER}
                    aria-label="Delete field"
                    onClick={() => { setDeleteFieldConfirm({ id: field.id, name: field.name }) }}
                  />
                </>
              )}
            </div>
          ))}
        </Card>
      ) : null}
      <Alert
        isOpen={deleteFieldConfirm !== null}
        intent={Intent.DANGER}
        icon="trash"
        cancelButtonText="Cancel"
        confirmButtonText="Remove"
        onCancel={() => { setDeleteFieldConfirm(null) }}
        onConfirm={() => {
          if (deleteFieldConfirm) deleteField.mutate(deleteFieldConfirm.id)
          setDeleteFieldConfirm(null)
        }}
      >
        <p className="font-semibold mb-1">{`Remove field "${deleteFieldConfirm?.name ?? ''}"?`}</p>
        <p className="text-sm">Any existing data for this field will be lost.</p>
      </Alert>
    </div>
  )
}

// ─── Mind: Hotel Profile ───────────────────────────────────────────────────────

const CURRENCY_GROUPS = [
  {
    label: 'Major / G10',
    currencies: [
      { code: 'USD', name: 'US Dollar' },
      { code: 'EUR', name: 'Euro' },
      { code: 'GBP', name: 'British Pound' },
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'CHF', name: 'Swiss Franc' },
      { code: 'AUD', name: 'Australian Dollar' },
      { code: 'CAD', name: 'Canadian Dollar' },
      { code: 'NZD', name: 'New Zealand Dollar' },
      { code: 'SEK', name: 'Swedish Krona' },
      { code: 'NOK', name: 'Norwegian Krone' },
      { code: 'DKK', name: 'Danish Krone' },
    ],
  },
  {
    label: 'Asia-Pacific',
    currencies: [
      { code: 'CNY', name: 'Chinese Yuan' },
      { code: 'HKD', name: 'Hong Kong Dollar' },
      { code: 'SGD', name: 'Singapore Dollar' },
      { code: 'KRW', name: 'South Korean Won' },
      { code: 'TWD', name: 'Taiwan Dollar' },
      { code: 'THB', name: 'Thai Baht' },
      { code: 'MYR', name: 'Malaysian Ringgit' },
      { code: 'IDR', name: 'Indonesian Rupiah' },
      { code: 'PHP', name: 'Philippine Peso' },
      { code: 'VND', name: 'Vietnamese Dong' },
      { code: 'INR', name: 'Indian Rupee' },
      { code: 'PKR', name: 'Pakistani Rupee' },
      { code: 'BDT', name: 'Bangladeshi Taka' },
    ],
  },
  {
    label: 'Middle East',
    currencies: [
      { code: 'AED', name: 'UAE Dirham' },
      { code: 'SAR', name: 'Saudi Riyal' },
      { code: 'QAR', name: 'Qatari Riyal' },
      { code: 'KWD', name: 'Kuwaiti Dinar' },
      { code: 'BHD', name: 'Bahraini Dinar' },
      { code: 'OMR', name: 'Omani Rial' },
      { code: 'JOD', name: 'Jordanian Dinar' },
      { code: 'ILS', name: 'Israeli Shekel' },
    ],
  },
  {
    label: 'Europe (non-EUR)',
    currencies: [
      { code: 'PLN', name: 'Polish Zloty' },
      { code: 'CZK', name: 'Czech Koruna' },
      { code: 'HUF', name: 'Hungarian Forint' },
      { code: 'RON', name: 'Romanian Leu' },
      { code: 'TRY', name: 'Turkish Lira' },
      { code: 'RUB', name: 'Russian Ruble' },
      { code: 'UAH', name: 'Ukrainian Hryvnia' },
    ],
  },
  {
    label: 'Americas',
    currencies: [
      { code: 'MXN', name: 'Mexican Peso' },
      { code: 'BRL', name: 'Brazilian Real' },
      { code: 'COP', name: 'Colombian Peso' },
      { code: 'PEN', name: 'Peruvian Sol' },
      { code: 'CLP', name: 'Chilean Peso' },
      { code: 'ARS', name: 'Argentine Peso' },
    ],
  },
  {
    label: 'Africa',
    currencies: [
      { code: 'ZAR', name: 'South African Rand' },
      { code: 'EGP', name: 'Egyptian Pound' },
      { code: 'NGN', name: 'Nigerian Naira' },
      { code: 'KES', name: 'Kenyan Shilling' },
      { code: 'GHS', name: 'Ghanaian Cedi' },
      { code: 'MAD', name: 'Moroccan Dirham' },
    ],
  },
] as const

// Native <optgroup>/<option> children for Blueprint HTMLSelect — supports
// labelled groups, which HTMLSelect's `options` prop does not.
function CurrencyOptions() {
  return (
    <>
      {CURRENCY_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {getCurrencySymbol(c.code)}  {c.code}  {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}

const hotelSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  currency: z.string().length(3, 'Select a currency'),
})
type HotelFields = z.infer<typeof hotelSchema>

// ─── Flow: Move Reasons ────────────────────────────────────────────────────────

function MoveReasonsSection() {
  const hotel = useActiveHotel()
  const updateHotelConfig = useUpdateHotelConfig()
  const { data: reasons = [], isLoading } = useCustomRemovalReasons()
  const createReason = useCreateCustomRemovalReason()
  const updateReason = useUpdateCustomRemovalReason()
  const deleteReason = useDeleteCustomRemovalReason()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const requireRemovalReason = hotel?.config.require_removal_reason === true

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    await createReason.mutateAsync({ name, sortOrder: reasons.length })
    setNewName('')
  }

  const handleSaveEdit = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    await updateReason.mutateAsync({ id, patch: { name } })
    setEditingId(null)
  }

  return (
    <div>
      <SectionHeader
        title="Move Reasons"
        description="Custom removal reason categories shown in the stock adjustment modal, alongside built-in ones."
      />

      {/* Require removal category toggle */}
      <Card compact className="mb-5">
        <SettingRow
          label="Require move reason category"
          description="Operators must select a category when removing stock. Enables enforcement in the adjustment modal."
        >
          <Switch
            checked={requireRemovalReason}
            onChange={(e) => {
              void updateHotelConfig.mutateAsync({ key: 'require_removal_reason', value: e.currentTarget.checked })
            }}
            className="!mb-0"
          />
        </SettingRow>
      </Card>

      {/* Custom reasons list */}
      <Card compact className="!p-0 divide-y">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </div>
        )}
        {!isLoading && reasons.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No custom reasons yet — built-in reasons (Breakage, Theft, etc.) are always available.
          </div>
        )}
        {reasons.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <Icon icon="drag-handle-vertical" size={14} className="text-muted-foreground/40 flex-shrink-0" />
            {editingId === r.id ? (
              <InputGroup
                className="flex-1"
                value={editName}
                onChange={(e) => { setEditName(e.target.value) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { void handleSaveEdit(r.id) }
                  if (e.key === 'Escape') { setEditingId(null) }
                }}
                autoFocus
              />
            ) : (
              <span className="flex-1 text-sm">{r.name}</span>
            )}
            <div className="flex items-center gap-1">
              {editingId === r.id ? (
                <>
                  <Button size="small" intent={Intent.PRIMARY} onClick={() => { void handleSaveEdit(r.id) }}>Save</Button>
                  <Button size="small" variant="minimal" onClick={() => { setEditingId(null) }}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button
                    icon="edit"
                    variant="minimal"
                    size="small"
                    aria-label="Edit reason"
                    onClick={() => { setEditingId(r.id); setEditName(r.name) }}
                  />
                  <Button
                    icon="trash"
                    variant="minimal"
                    size="small"
                    intent={Intent.DANGER}
                    aria-label="Delete reason"
                    onClick={() => { deleteReason.mutate(r.id) }}
                  />
                </>
              )}
            </div>
          </div>
        ))}

        {/* Add new reason */}
        <div className="flex items-center gap-2 px-4 py-3">
          <InputGroup
            className="flex-1"
            placeholder="e.g. Event consumption, Guest request…"
            value={newName}
            onChange={(e) => { setNewName(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { void handleAdd() }
            }}
          />
          <Button
            icon="plus"
            intent={Intent.PRIMARY}
            disabled={!newName.trim()}
            loading={createReason.isPending}
            onClick={() => { void handleAdd() }}
          >
            Add
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ─── Mind: Hotel Profile ───────────────────────────────────────────────────────

function HotelProfileSection() {
  const hotel = useActiveHotel()
  const updateHotel = useUpdateHotel()
  const { data: orgs = [] } = useOrganizations()
  const org = orgs.find((o) => o.id === hotel?.organization_id) ?? null

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<HotelFields>({
    resolver: zodResolver(hotelSchema),
    values: hotel
      ? { name: hotel.name, address: hotel.address, timezone: hotel.timezone, currency: hotel.currency }
      : undefined,
  })

  const onSubmit = async (data: HotelFields) => {
    await updateHotel.mutateAsync(data)
    reset(data)
  }

  return (
    <div>
      <SectionHeader title="Hotel Profile" description="Name, address, timezone and display currency for this property." />

      {/* Organization affiliation — read-only echelon context */}
      {org && (
        <Callout icon="office" compact className="mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Part of organization
              </p>
              <p className="text-sm font-medium truncate">{org.name}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">Org-scope contracts and benchmarks attach here</span>
          </div>
        </Callout>
      )}

      <Card compact>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
          <FormGroup
            label="Hotel name"
            labelFor="hotel-name"
            intent={errors.name ? Intent.DANGER : Intent.NONE}
            helperText={errors.name?.message}
          >
            <InputGroup id="hotel-name" intent={errors.name ? Intent.DANGER : Intent.NONE} {...register('name')} />
          </FormGroup>
          <FormGroup
            label="Address"
            labelFor="hotel-address"
            intent={errors.address ? Intent.DANGER : Intent.NONE}
            helperText={errors.address?.message}
          >
            <InputGroup id="hotel-address" intent={errors.address ? Intent.DANGER : Intent.NONE} {...register('address')} />
          </FormGroup>
          <div className="grid grid-cols-2 gap-3">
            <FormGroup
              label="Timezone"
              labelFor="hotel-timezone"
              intent={errors.timezone ? Intent.DANGER : Intent.NONE}
              helperText={errors.timezone?.message}
            >
              <InputGroup id="hotel-timezone" placeholder="Europe/Athens" intent={errors.timezone ? Intent.DANGER : Intent.NONE} {...register('timezone')} />
            </FormGroup>
            <FormGroup
              label="Display currency"
              labelFor="hotel-currency"
              intent={errors.currency ? Intent.DANGER : Intent.NONE}
              helperText={errors.currency?.message}
            >
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <HTMLSelect
                    id="hotel-currency"
                    fill
                    value={field.value}
                    onChange={(e) => { field.onChange(e.target.value) }}
                  >
                    <option value="" disabled>Select currency…</option>
                    <CurrencyOptions />
                  </HTMLSelect>
                )}
              />
            </FormGroup>
          </div>
          <Button type="submit" intent={Intent.PRIMARY} disabled={!isDirty} loading={isSubmitting}>
            Save Changes
          </Button>
        </form>
      </Card>
    </div>
  )
}

// ─── Mind: Team ────────────────────────────────────────────────────────────────
// Extracted to features/team/components/TeamSection.tsx as part of the
// Blueprint migration. Settings just imports + renders it.


// ─── Approval Thresholds ───────────────────────────────────────────────────────

function ApprovalThresholdsSection() {
  const { data, isLoading } = useApprovalThresholds()
  const update = useUpdateApprovalThresholds()
  const hotel  = useActiveHotel()
  const sym    = getCurrencySymbol(hotel?.currency ?? 'USD')

  const [manager,    setManager]    = useState('')
  const [director,   setDirector]   = useState('')
  const [escalation, setEscalation] = useState('')

  // Sync inputs when data loads
  const managerVal    = data?.manager_approval_threshold  ?? 100
  const directorVal   = data?.director_approval_threshold ?? 500
  const escalationVal = data?.escalation_timeout_hours    ?? 24

  const handleSave = () => {
    const m = parseFloat(manager    || String(managerVal))
    const d = parseFloat(director   || String(directorVal))
    const e = parseInt(escalation   || String(escalationVal), 10)
    if (isNaN(m) || isNaN(d) || isNaN(e)) { return }
    update.mutate({ managerThreshold: m, directorThreshold: d, escalationTimeoutHours: e })
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Loading thresholds…
      </div>
    )
  }

  return (
    <div>
      <SectionHeader
        title="Approval Thresholds"
        description="Restock requests above these spend limits are routed for sign-off before they can be ordered. Manager tier requires admin or owner; Director tier requires owner only."
      />
      <div className="space-y-5 max-w-sm">
        <FormGroup
          label="Manager approval above"
          helperText={`Orders above this value require admin or owner approval · Current: ${sym}${managerVal.toFixed(2)}`}
        >
          <InputGroup
            type="number"
            min={0}
            step={10}
            leftElement={<span className="px-3 py-1 text-sm text-muted-foreground">{sym}</span>}
            placeholder={String(managerVal)}
            value={manager}
            onChange={(e) => { setManager(e.target.value) }}
          />
        </FormGroup>

        <FormGroup
          label="Director approval above"
          helperText={`Orders above this value require owner approval only · Current: ${sym}${directorVal.toFixed(2)}`}
        >
          <InputGroup
            type="number"
            min={0}
            step={50}
            leftElement={<span className="px-3 py-1 text-sm text-muted-foreground">{sym}</span>}
            placeholder={String(directorVal)}
            value={director}
            onChange={(e) => { setDirector(e.target.value) }}
          />
        </FormGroup>

        <FormGroup
          label="Auto-escalation timeout"
          helperText={`Hours before a stale pending_manager request is auto-escalated to pending_director · Current: ${String(escalationVal)}h · checked every 30 min`}
        >
          <InputGroup
            type="number"
            min={1}
            max={168}
            step={1}
            rightElement={<span className="px-3 py-1 text-xs text-muted-foreground">hrs</span>}
            placeholder={String(escalationVal)}
            value={escalation}
            onChange={(e) => { setEscalation(e.target.value) }}
          />
        </FormGroup>

        <Button
          intent={Intent.PRIMARY}
          onClick={handleSave}
          disabled={!manager && !director && !escalation}
          loading={update.isPending}
        >
          Save thresholds
        </Button>

        <Callout intent={Intent.NONE} icon="info-sign" compact title="How it works">
          <p>When a restock request is created, its estimated cost (qty × unit cost) is compared against these thresholds automatically. Cost history is used as fallback when the variant has no current price set.</p>
          <p>Requests that sit in pending_manager past the escalation timeout are automatically promoted to pending_director by a scheduled job.</p>
        </Callout>
      </div>
    </div>
  )
}

// ─── Flow: Autonomous Operations ──────────────────────────────────────────────

/**
 * Live status panel for the autonomous loop. Reads `get_cron_health_summary()`
 * (admin/owner only). Per CLAUDE.md self-apply: surface our own observability
 * data on the operator surface — every number carries derived context.
 */
function CronHealthPanel() {
  const { data, isLoading, isError } = useCronHealthSummary()

  if (isLoading) {
    return (
      <Callout icon={<Spinner size={14} />} compact>
        Checking autonomous loop…
      </Callout>
    )
  }
  if (isError || !data) {
    return (
      <Callout intent={Intent.WARNING} icon="warning-sign" compact>
        Health summary unavailable for this role.
      </Callout>
    )
  }

  const cycle = data.jobs.find((j) => j.jobname === 'beacon-intelligence-cycle')
  const failingJobs = data.jobs.filter((j) => j.consecutive_failures >= 2)
  const overallHealthy = failingJobs.length === 0 && data.open_critical === 0

  const cycleStatus =
    cycle?.consecutive_failures && cycle.consecutive_failures >= 2 ? 'failing'
    : (cycle?.last_status === 'succeeded') ? 'healthy'
    : (cycle?.last_status === 'failed') ? 'degraded'
    : 'idle'

  const statusIntent =
    cycleStatus === 'healthy'  ? Intent.SUCCESS
    : cycleStatus === 'failing' ? Intent.DANGER
    : cycleStatus === 'degraded'? Intent.WARNING
    : Intent.NONE

  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="pulse" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Autonomous loop status
          </span>
        </div>
        <Tag intent={statusIntent} minimal>
          {cycleStatus === 'healthy'   && 'Healthy'}
          {cycleStatus === 'failing'   && `Failing (${String(cycle?.consecutive_failures ?? 0)} in a row)`}
          {cycleStatus === 'degraded'  && 'Last run failed'}
          {cycleStatus === 'idle'      && 'No runs yet'}
        </Tag>
      </div>

      <div className="px-3 py-2 space-y-1">
        {data.jobs.map((j) => {
          const last = j.last_run_at ? new Date(j.last_run_at) : null
          const ago = last ? Math.round((Date.now() - last.getTime()) / 60000) : null
          const labelMin = ago == null ? '—' : ago < 1 ? 'just now' : ago < 60 ? `${String(ago)}m ago` : `${String(Math.round(ago / 60))}h ago`
          const ok = j.last_status === 'succeeded'
          return (
            <div key={j.jobname} className="flex items-center gap-2 text-[11px] tabular-nums">
              <span
                className={cn(
                  'h-1 w-1 rounded-full inline-block flex-shrink-0',
                  ok ? 'bg-emerald-500' : j.last_status === 'failed' ? 'bg-red-500' : 'bg-muted-foreground/40',
                )}
              />
              <span className="font-mono text-muted-foreground truncate flex-1">{j.jobname}</span>
              <span className="text-muted-foreground/70 shrink-0">{j.schedule}</span>
              <span className={cn('shrink-0 w-16 text-right', ok ? 'text-foreground' : 'text-red-600 dark:text-red-400')}>
                {labelMin}
              </span>
            </div>
          )
        })}
      </div>

      {!overallHealthy && (
        <div className="px-3 py-2 border-t bg-red-50/60 dark:bg-red-950/20 flex items-start gap-2">
          <Icon icon="warning-sign" size={14} className="text-red-600 dark:text-red-400 mt-px flex-shrink-0" />
          <p className="text-[11px] text-red-700 dark:text-red-400 leading-relaxed">
            {data.open_critical > 0 && `${String(data.open_critical)} unacknowledged critical event${data.open_critical === 1 ? '' : 's'}. `}
            {failingJobs.length > 0 && `${String(failingJobs.length)} job${failingJobs.length === 1 ? '' : 's'} failing. `}
            Investigate via <code className="font-mono">cron.job_run_details</code> and <code className="font-mono">system_health_events</code>.
          </p>
        </div>
      )}
    </Card>
  )
}

function AutonomousSection() {
  const hotel = useActiveHotel()
  const update = useUpdateAutonomousSettings()
  const sym = getCurrencySymbol(hotel?.currency ?? 'USD')

  const [threshold, setThreshold] = useState('')
  const [poEnabled, setPoEnabled] = useState<boolean | null>(null)
  const [tolerance, setTolerance] = useState('')

  const currentThreshold = hotel?.auto_approve_threshold ?? 0
  const currentPoEnabled = hotel?.auto_po_enabled ?? false
  const currentTolerance = hotel?.auto_invoice_tolerance_pct ?? 2

  // Track whether toggle has been changed from loaded value
  const effectivePoEnabled = poEnabled ?? currentPoEnabled

  const handleSave = () => {
    const t = parseFloat(threshold || String(currentThreshold))
    const tol = parseFloat(tolerance || String(currentTolerance))
    if (isNaN(t) || isNaN(tol)) return
    update.mutate({
      auto_approve_threshold: t,
      auto_po_enabled: effectivePoEnabled,
      auto_invoice_tolerance_pct: tol,
    })
  }

  const isDirty = threshold !== '' || tolerance !== '' || poEnabled !== null

  if (!hotel) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Loading hotel…
      </div>
    )
  }

  return (
    <div>
      <SectionHeader
        title="Autonomous Operations"
        description="Configure what the system is allowed to do without human approval. All autonomous actions are fully auditable in the Flow Timeline."
      />
      <div className="space-y-6 max-w-sm">
        {/* Auto-approve threshold */}
        <FormGroup
          label="Auto-approve restock threshold"
          helperText={`Pending restock requests with estimated cost at or below this amount are auto-approved. Set to 0 to disable · Current: ${sym}${currentThreshold.toFixed(2)}${currentThreshold === 0 ? ' (disabled)' : ''}`}
        >
          <InputGroup
            type="number"
            min={0}
            step={5}
            leftElement={<span className="px-3 py-1 text-sm text-muted-foreground">{sym}</span>}
            placeholder={String(currentThreshold)}
            value={threshold}
            onChange={(e) => { setThreshold(e.target.value) }}
          />
        </FormGroup>

        {/* Auto PO generation */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-3">
            <p className="text-sm font-medium">Auto-generate Purchase Orders</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When 3+ approved restocks exist for the same supplier, automatically create a draft PO
            </p>
          </div>
          <Switch
            checked={effectivePoEnabled}
            onChange={(e) => { setPoEnabled(e.currentTarget.checked) }}
            className="!mb-0"
          />
        </div>

        {/* Invoice tolerance */}
        <FormGroup
          label="Invoice auto-approve tolerance"
          helperText={`Invoices with discrepancy at or below this percentage are auto-approved after 3-way match · Current: ${String(currentTolerance)}%`}
        >
          <InputGroup
            type="number"
            min={0}
            max={100}
            step={0.5}
            rightElement={<span className="px-3 py-1 text-xs text-muted-foreground">%</span>}
            placeholder={String(currentTolerance)}
            value={tolerance}
            onChange={(e) => { setTolerance(e.target.value) }}
          />
        </FormGroup>

        <Button
          intent={Intent.PRIMARY}
          onClick={handleSave}
          disabled={!isDirty}
          loading={update.isPending}
        >
          Save autonomous settings
        </Button>

        {/* Live cron health — replaces static "Active agents" copy */}
        <CronHealthPanel />

        <Callout intent={Intent.NONE} icon="info-sign" compact title="What's running">
          <p>Intelligence cycle (every 15 min): anomaly alerts, restock proposals, preemptive restocks, stale escalations, discrepancy detection, and the auto-approvals configured above.</p>
          <p>Event-driven triggers (real-time): critical stockouts, PO auto-close on full receipt, consumption-spike detection.</p>
          <p>Weekly: PAR optimization, supplier lead-time learning (Sun 4am UTC), per-variant alert threshold learning (Sun 4:30am UTC), price drift (Mon 6am UTC). Daily: POS variance (5am UTC), proposal-outcomes feedback flywheel (3am UTC).</p>
          <p>Health monitor (every 5 min): scans <code className="font-mono">cron.job_run_details</code>, opens <code className="font-mono">system_health_events</code> rows on failure streaks.</p>
        </Callout>
      </div>
    </div>
  )
}

// ─── Mind: Webhooks ────────────────────────────────────────────────────────────

// All action types that can trigger a webhook
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

  // Reset form when editing target changes
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
      {/* Header row */}
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
      {/* Delivery log */}
      {expanded && (
        <div className="px-4 py-3 bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Recent deliveries</p>
          <EndpointDeliveries endpointId={ep.id} />
        </div>
      )}
    </Card>
  )
}

function WebhooksSection() {
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

// ─── GDPR ──────────────────────────────────────────────────────────────────────

const gdprSchema = z.object({ email: z.email('Enter a valid email') })
type GdprFields = z.infer<typeof gdprSchema>

function DangerZoneSection() {
  const [result, setResult] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GdprFields>({
    resolver: zodResolver(gdprSchema),
  })

  const onSubmit = async (data: GdprFields) => {
    setResult(null)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', data.email)
      .maybeSingle<{ id: string }>()

    if (profileError || !profileData) { toast.error('No user found with that email address'); return }

    const { error } = await supabase.rpc('anonymize_user_pii', {
      p_user_id: profileData.id,
      p_user_email: data.email,
    })

    if (error) { toast.error(error.message) } else {
      setResult(`PII for ${data.email} has been anonymised.`)
      reset()
    }
  }

  return (
    <div>
      <SectionHeader
        title="GDPR · Right to Erasure"
        description="Anonymise a user's personally identifiable data from all stock logs within this hotel. This action is irreversible."
      />
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-3 max-w-sm">
        <FormGroup
          label="User email"
          labelFor="gdpr-email"
          intent={errors.email ? Intent.DANGER : Intent.NONE}
          helperText={errors.email?.message}
        >
          <InputGroup
            id="gdpr-email"
            type="email"
            placeholder="user@example.com"
            intent={errors.email ? Intent.DANGER : Intent.NONE}
            {...register('email')}
          />
        </FormGroup>
        {result && (
          <Callout intent={Intent.SUCCESS} icon="tick" compact>{result}</Callout>
        )}
        <Button type="submit" intent={Intent.DANGER} loading={isSubmitting}>
          Anonymise User Data
        </Button>
      </form>
    </div>
  )
}

// ─── Section renderer ──────────────────────────────────────────────────────────

function renderSection(id: SectionId) {
  switch (id) {
    case 'notifications':       return <NotificationsSection />
    case 'alert-thresholds':    return <AlertThresholdsSection />
    case 'approval-thresholds': return <ApprovalThresholdsSection />
    case 'autonomous':          return <AutonomousSection />
    case 'categories':       return <CategoriesSection />
    case 'locations':        return <LocationsSection />
    case 'custom-fields':    return <CustomFieldsSection />
    case 'move-reasons':     return <MoveReasonsSection />
    case 'hotel':            return <HotelProfileSection />
    case 'team':             return <TeamSection />
    case 'webhooks':         return <WebhooksSection />
    case 'danger':           return <DangerZoneSection />
  }
}

// ─── Layer group labels ────────────────────────────────────────────────────────

const LAYER_GROUPS: { dot: string; label: string; ids: SectionId[] }[] = [
  { dot: 'bg-slate-400',   label: 'Eye',         ids: ['notifications', 'alert-thresholds'] },
  { dot: 'bg-amber-500',   label: 'Flow',        ids: ['approval-thresholds', 'autonomous'] },
  { dot: 'bg-blue-500',    label: 'Inventory',   ids: ['categories', 'locations', 'custom-fields', 'move-reasons'] },
  { dot: 'bg-purple-500',  label: 'Hotel',       ids: ['hotel', 'team', 'webhooks'] },
  { dot: 'bg-red-500',     label: 'Danger',      ids: ['danger'] },
]

// ─── Settings page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const role = useAuthStore((s) => s.role)
  const [searchParams, setSearchParams] = useSearchParams()

  // Filter nav items by role
  const visibleIds = useCallback((): Set<SectionId> => {
    const s = new Set<SectionId>()
    for (const item of NAV) {
      if (!item.requirePermission || (role && hasPermission(role, item.requirePermission))) {
        s.add(item.id)
      }
    }
    return s
  }, [role])()

  // Active section is URL-driven — fully deep-linkable
  const urlSection = searchParams.get('section') as SectionId | null
  const safeActive: SectionId = (urlSection && visibleIds.has(urlSection))
    ? urlSection
    : ([...visibleIds][0] ?? 'notifications')

  const setActiveSection = (id: SectionId) => { setSearchParams({ section: id }, { replace: true }) }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Notifications, autonomous loop, hotel profile, team, webhooks &amp; data governance</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <nav className="w-52 flex-shrink-0 border-r overflow-y-auto py-4 px-2 space-y-4">
          {LAYER_GROUPS.map((group) => {
            const groupItems = group.ids
              .map((id) => NAV.find((n) => n.id === id))
              .filter((item): item is NavItem => !!item && visibleIds.has(item.id))
            if (groupItems.length === 0) return null

            return (
              <div key={group.label}>
                <div className="flex items-center gap-1.5 px-2 mb-1">
                  <span className={cn('h-1.5 w-1.5 rounded-full inline-block flex-shrink-0', group.dot)} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                {groupItems.map((item) => {
                  const isActive = safeActive === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveSection(item.id) }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon icon={item.icon} size={14} className="flex-shrink-0" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Right content */}
        <main className="flex-1 overflow-y-auto px-8 py-6 max-w-2xl">
          {renderSection(safeActive)}
        </main>
      </div>
    </div>
  )
}
