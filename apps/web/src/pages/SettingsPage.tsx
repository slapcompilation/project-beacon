// Layer: Mind (hotel/chain config) + Floor (display preferences) + Eye (alert thresholds)
// Palantir-style Settings: two-column layout, progressive disclosure by role,
// inline auto-save for preferences, explicit Save only for structured entity forms.

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  Bell, FolderOpen, MapPin, SlidersHorizontal,
  Building2, ShieldAlert, Plus, Pencil,
  Trash2, Loader2, GripVertical, ClipboardList, Gauge,
  Users, Crown, User, UserCheck, Check, X, Info, Bot,
  Activity, AlertTriangle,
} from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { getCurrencySymbol } from '@/lib/currency'
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
} from '@/features/categories/hooks'
import { useActiveHotel, useUpdateHotel, useUpdateHotelConfig, useUpdateAutonomousSettings } from '@/features/hotel/hooks'
import { useUserPrefs, useUpdateUserPrefs, useDateFormat } from '@/features/user/hooks'
import {
  useTeamMembers, useInviteTeamMember, useUpdateMemberRole, useRemoveTeamMember,
} from '@/features/team/hooks'
import {
  useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation,
} from '@/features/locations/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'
import { hasPermission } from '@beacon/types'
import type { Category, Location, CustomFieldDef, CustomFieldType, UserRole } from '@beacon/types'
import type { TeamMember } from '@/features/team/api'
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

// ─── Section nav config ────────────────────────────────────────────────────────

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
  icon: React.ElementType
  layerDot: string
  /** Minimum role required to see this section. undefined = all roles. */
  requirePermission?: Parameters<typeof hasPermission>[1]
}

const NAV: NavItem[] = [
  // Eye
  { id: 'notifications',       label: 'Notifications',      icon: Bell,             layerDot: 'bg-slate-400' },
  { id: 'alert-thresholds',    label: 'Alert Thresholds',   icon: Gauge,            layerDot: 'bg-orange-500' },
  // Flow
  { id: 'approval-thresholds', label: 'Approval Thresholds',icon: ShieldAlert,      layerDot: 'bg-amber-500',  requirePermission: 'can_manage_hotels' },
  { id: 'autonomous',          label: 'Autonomous Ops',     icon: Bot,              layerDot: 'bg-amber-500',  requirePermission: 'can_manage_hotels' },
  // Inventory
  { id: 'categories',        label: 'Categories',       icon: FolderOpen,       layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'locations',         label: 'Locations',        icon: MapPin,           layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'custom-fields',     label: 'Custom Fields',    icon: SlidersHorizontal,layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'move-reasons',      label: 'Move Reasons',     icon: ClipboardList,    layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  // Hotel
  { id: 'hotel',             label: 'Hotel Profile',    icon: Building2,        layerDot: 'bg-purple-500', requirePermission: 'can_manage_hotels' },
  { id: 'team',              label: 'Team',             icon: Users,            layerDot: 'bg-purple-500', requirePermission: 'can_manage_users' },
  { id: 'webhooks',          label: 'Webhooks',         icon: Bell,             layerDot: 'bg-purple-500', requirePermission: 'can_manage_hotels' },
  // Danger zone
  { id: 'danger',            label: 'GDPR',             icon: ShieldAlert,      layerDot: 'bg-red-500',    requirePermission: 'can_manage_users' },
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
    overallIncorrectRate < 10  ? { text: 'Well-calibrated', color: 'text-emerald-600 dark:text-emerald-400' } :
    overallIncorrectRate < 20  ? { text: 'Some noise — review thresholds', color: 'text-yellow-600 dark:text-yellow-500' } :
                                  { text: 'High noise — thresholds need tuning', color: 'text-red-600 dark:text-red-400' }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />Loading feedback data…
      </div>
    )
  }

  if (feedback.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-5 py-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">No feedback signal yet</p>
        <p className="mt-1 text-xs text-muted-foreground/70 max-w-xs mx-auto">
          Dismiss alerts with a reason from the Notifications panel to start building this dataset.
          Incorrect data rate &lt; 10% means the model is well-calibrated.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alert Intelligence Loop</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">Last 90 days · {totalDismissed} dismissed</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground w-36">Alert type</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-14">Total</th>
              {REASON_ORDER.map((r) => (
                <th key={r} className={cn(
                  'text-right px-3 py-2 font-medium',
                  r === 'incorrect_data' ? 'text-orange-500' : 'text-muted-foreground',
                )}>
                  {REASON_LABELS[r]}
                  {r === 'incorrect_data' && ' ⚠'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {feedback.map((row: TypeFeedback) => (
              <tr key={row.type} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2 font-medium">{TYPE_LABELS[row.type] ?? row.type}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{row.total}</td>
                {REASON_ORDER.map((r) => {
                  const count = row.reasons[r] ?? 0
                  const pct   = row.total > 0 ? Math.round((count / row.total) * 100) : 0
                  return (
                    <td key={r} className={cn(
                      'px-3 py-2 text-right tabular-nums',
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
        </table>
      </div>

      {/* Footer — overall quality signal */}
      <div className="px-4 py-2.5 bg-muted/20 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Overall incorrect data rate: <span className="font-semibold tabular-nums">{overallIncorrectRate.toFixed(1)}%</span>
        </span>
        <span className={cn('text-xs font-medium', qualityLabel.color)}>{qualityLabel.text}</span>
      </div>
    </div>
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
              <Badge variant="secondary" className="text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30">Enabled</Badge>
            ) : permission === 'denied' ? (
              <Badge variant="outline" className="text-muted-foreground">Blocked by browser</Badge>
            ) : (
              <Button size="sm" className="h-7 text-xs" onClick={() => { void requestPush() }}>
                Enable
              </Button>
            )}
          </SettingRow>
        )}

        <SettingRow
          label="Quiet hours — start"
          description="Suppress notifications from this time"
        >
          <Input
            type="time"
            className="w-32 h-8 text-sm"
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
          <Input
            type="time"
            className="w-32 h-8 text-sm"
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
              {daysThreshold}d
            </span>
          </div>
          <Slider
            min={1}
            max={60}
            step={1}
            value={[daysThreshold]}
            onValueChange={([v]) => {
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
              {wasteThreshold} units
            </span>
          </div>
          <Slider
            min={1}
            max={500}
            step={1}
            value={[wasteThreshold]}
            onValueChange={([v]) => {
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" placeholder="e.g. Beverages" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Parent category</Label>
            <Controller
              name="parentId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? '__none__'}
                  onValueChange={(v) => { field.onChange(v === '__none__' ? null : v) }}
                >
                  <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (top-level)</SelectItem>
                    {parentOptions.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {editing && (
            <div className="space-y-1.5">
              <Label htmlFor="cat-photo">Require photo for removals over (units)</Label>
              <Input id="cat-photo" type="number" min="0" step="1" placeholder="Leave blank to disable"
                {...register('requirePhotoOver', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">Staff must attach a photo when removing more than this quantity.</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Add Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
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
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab flex-shrink-0" />
        <div>
          <span className={cn('text-sm', indent ? 'text-muted-foreground' : 'font-medium')}>{cat.name}</span>
          {cat.require_photo_for_removal_over != null && (
            <span className="ml-2 text-xs text-muted-foreground">photo &gt;{cat.require_photo_for_removal_over}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => { setEditing(cat); setModalOpen(true) }}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => { deleteCategory.mutate(cat.id) }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )

  return (
    <div>
      <SectionHeader title="Categories" description="Organise products into categories and sub-categories. Drag a category onto another to nest it." />
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
          <Plus className="mr-2 h-3.5 w-3.5" />Add Category
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" />Loading…
        </div>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No categories yet.</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {topLevel.map((cat) => (
            <div key={cat.id}>
              {renderCatRow(cat)}
              {childrenOf(cat.id).map((child) => renderCatRow(child, true))}
            </div>
          ))}
        </div>
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
      <MapPin className={cn('h-3.5 w-3.5 flex-shrink-0', indent ? 'text-muted-foreground/60' : 'text-muted-foreground')} />
      {editingId === loc.id ? (
        <Input className="h-7 text-sm flex-1" value={editName}
          onChange={(e) => { setEditName(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveEdit(loc); if (e.key === 'Escape') setEditingId(null) }}
          autoFocus />
      ) : (
        <span className="flex-1 text-sm">{loc.name}</span>
      )}
      {editingId === loc.id ? (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleSaveEdit(loc)}>Save</Button>
      ) : (
        <>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => { setEditingId(loc.id); setEditName(loc.name) }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => { deleteLocation.mutate(loc.id) }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  )

  return (
    <div>
      <SectionHeader title="Storage Locations" description="Define floors, rooms, and storage units. Assign them to variants." />
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => { setAdding(true) }}><Plus className="mr-2 h-3.5 w-3.5" />Add Location</Button>
      </div>
      {adding && (
        <div className="mb-3 rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-8 text-sm" placeholder="Location name…" value={addName}
              onChange={(e) => { setAddName(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }} autoFocus />
            <Select value={addParentId} onValueChange={setAddParentId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Top level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Top level</SelectItem>
                {topLevel.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => { setAdding(false) }}>Cancel</Button>
            <Button size="sm" onClick={() => void handleAdd()} disabled={!addName.trim() || createLocation.isPending}>
              {createLocation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Add Location
            </Button>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : locations.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No locations yet.</p>
        </div>
      ) : locations.length > 0 ? (
        <div className="rounded-lg border divide-y">
          {topLevel.map((loc) => (
            <div key={loc.id}>{renderRow(loc)}{childrenOf(loc.id).map((c) => renderRow(c, true))}</div>
          ))}
        </div>
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
        <Button size="sm" onClick={() => { setAddingOpen(true) }}><Plus className="mr-2 h-3.5 w-3.5" />Add Field</Button>
      </div>
      {addingOpen && (
        <div className="mb-3 rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-8 text-sm" placeholder="Field name…" value={addName}
              onChange={(e) => { setAddName(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }} autoFocus />
            <Select value={addType} onValueChange={(v) => { setAddType(v as CustomFieldType) }}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="boolean">Yes/No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => { setAddingOpen(false) }}>Cancel</Button>
            <Button size="sm" onClick={() => void handleAdd()} disabled={!addName.trim() || createField.isPending}>
              {createField.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Add Field
            </Button>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : fields.length === 0 && !addingOpen ? (
        <p className="text-sm text-muted-foreground py-4">No custom fields yet.</p>
      ) : fields.length > 0 ? (
        <div className="rounded-lg border divide-y">
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
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {editingField?.id === field.id ? (
                  <Input className="h-7 text-sm" value={editName}
                    onChange={(e) => { setEditName(e.target.value) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveEdit(field); if (e.key === 'Escape') setEditingField(null) }}
                    autoFocus />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{field.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {FIELD_TYPE_LABELS[field.field_type]}
                    </span>
                    {field.required && (
                      <span className="text-xs font-medium text-destructive">Required</span>
                    )}
                  </div>
                )}
              </div>
              {editingField?.id === field.id ? (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleSaveEdit(field)}>Save</Button>
              ) : (
                <>
                  {/* Required toggle */}
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={field.required}
                      onCheckedChange={(checked) => {
                        updateField.mutate({ id: field.id, input: { required: checked } })
                      }}
                      aria-label={`Mark ${field.name} as required`}
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { setEditingField(field); setEditName(field.name) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { setDeleteFieldConfirm({ id: field.id, name: field.name }) }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <ConfirmDialog
        open={deleteFieldConfirm !== null}
        title={`Remove field "${deleteFieldConfirm?.name ?? ''}"?`}
        description="Any existing data for this field will be lost."
        confirmLabel="Remove"
        destructive
        onConfirm={() => { if (deleteFieldConfirm) deleteField.mutate(deleteFieldConfirm.id) }}
        onCancel={() => { setDeleteFieldConfirm(null) }}
      />
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

function CurrencySelectItems() {
  return (
    <>
      {CURRENCY_GROUPS.map((group, idx) => (
        <SelectGroup key={group.label}>
          {idx > 0 && <SelectSeparator />}
          <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
            {group.label}
          </SelectLabel>
          {group.currencies.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="font-mono text-xs w-8 inline-block text-muted-foreground">
                {getCurrencySymbol(c.code)}
              </span>
              <span className="font-mono text-xs mr-2">{c.code}</span>
              <span className="text-xs text-muted-foreground">{c.name}</span>
            </SelectItem>
          ))}
        </SelectGroup>
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

  const requireRemovalReason = hotel?.config?.require_removal_reason === true

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
      <div className="mb-5 rounded-lg border p-4">
        <SettingRow
          label="Require move reason category"
          description="Operators must select a category when removing stock. Enables enforcement in the adjustment modal."
        >
          <Switch
            checked={requireRemovalReason}
            onCheckedChange={(v) => {
              void updateHotelConfig.mutateAsync({ key: 'require_removal_reason', value: v })
            }}
          />
        </SettingRow>
      </div>

      {/* Custom reasons list */}
      <div className="rounded-lg border divide-y">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…
          </div>
        )}
        {!isLoading && reasons.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No custom reasons yet — built-in reasons (Breakage, Theft, etc.) are always available.
          </div>
        )}
        {reasons.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
            {editingId === r.id ? (
              <Input
                className="h-7 text-sm flex-1"
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
                  <Button size="sm" className="h-7 text-xs" onClick={() => { void handleSaveEdit(r.id) }}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingId(null) }}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setEditingId(r.id); setEditName(r.name) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { deleteReason.mutate(r.id) }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Add new reason */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Input
            className="h-8 text-sm flex-1"
            placeholder="e.g. Event consumption, Guest request…"
            value={newName}
            onChange={(e) => { setNewName(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { void handleAdd() }
            }}
          />
          <Button
            size="sm"
            className="h-8"
            disabled={!newName.trim() || createReason.isPending}
            onClick={() => { void handleAdd() }}
          >
            {createReason.isPending
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Add
          </Button>
        </div>
      </div>
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
        <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Part of organization
            </p>
            <p className="text-sm font-medium truncate">{org.name}</p>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">Org-scope contracts and benchmarks attach here</span>
        </div>
      )}

      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="rounded-lg border p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="hotel-name">Hotel name</Label>
          <Input id="hotel-name" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hotel-address">Address</Label>
          <Input id="hotel-address" {...register('address')} />
          {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="hotel-timezone">Timezone</Label>
            <Input id="hotel-timezone" placeholder="Europe/Athens" {...register('timezone')} />
            {errors.timezone && <p className="text-sm text-destructive">{errors.timezone.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Display currency</Label>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <CurrencySelectItems />
                  </SelectContent>
                </Select>
              )}
            />
            {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
          </div>
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </div>
  )
}

// ─── Mind: Team ────────────────────────────────────────────────────────────────
// Role config, matrix, invite modal — ported from TeamPage

interface RoleConfig {
  label: string
  icon: React.ElementType
  color: string
  badgeClass: string
  description: string
  capabilities: string[]
  restrictions: string[]
}

const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  owner: {
    label: 'Owner', icon: Crown, color: 'text-purple-700',
    badgeClass: 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
    description: 'Full access to everything including billing and user management.',
    capabilities: ['All admin capabilities', 'Manage team members & roles', 'Hotel profile & billing', 'GDPR erasure', 'Delete hotel data'],
    restrictions: [],
  },
  admin: {
    label: 'Admin', icon: User, color: 'text-blue-700',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    description: 'Full operational access. Cannot manage users or billing.',
    capabilities: ['View & edit all inventory', 'Adjust stock & run stocktakes', 'Approve restocks', 'Manage categories & suppliers', 'View all reports & audit log'],
    restrictions: ['Cannot add or remove team members', 'Cannot change billing'],
  },
  team_member: {
    label: 'Team Member', icon: User, color: 'text-green-700',
    badgeClass: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300',
    description: 'Day-to-day operational access. No admin capabilities.',
    capabilities: ['View inventory', 'Adjust stock', 'Run stocktakes', 'View dashboard & alerts', 'Scan QR codes'],
    restrictions: ['Cannot manage team', 'Cannot approve restocks', 'No reports access', 'No settings access'],
  },
  limited_access: {
    label: 'Limited Access', icon: UserCheck, color: 'text-slate-600',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
    description: 'Scan-first mobile role for floor staff. Minimal access, maximum security.',
    capabilities: ['Scan QR/barcodes', 'Adjust stock quantities', 'View item details'],
    restrictions: ['No inventory list', 'No reports or audit', 'No settings', 'No team management', 'No dashboard'],
  },
}

const ASSIGNABLE_ROLES: { value: Exclude<UserRole, 'owner'>; label: string }[] = [
  { value: 'admin',          label: 'Admin' },
  { value: 'team_member',    label: 'Team Member' },
  { value: 'limited_access', label: 'Limited Access' },
]

const MATRIX_ROWS: { label: string; owner: boolean; admin: boolean; team_member: boolean; limited_access: boolean }[] = [
  { label: 'View inventory',          owner: true,  admin: true,  team_member: true,  limited_access: true  },
  { label: 'Adjust stock / scan',     owner: true,  admin: true,  team_member: true,  limited_access: true  },
  { label: 'Run stocktake',           owner: true,  admin: true,  team_member: true,  limited_access: false },
  { label: 'Add / edit products',     owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'Approve restocks',        owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'View reports',            owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'View audit log',          owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'Manage categories',       owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'Manage suppliers',        owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'Manage team members',     owner: true,  admin: false, team_member: false, limited_access: false },
  { label: 'Hotel profile / billing', owner: true,  admin: false, team_member: false, limited_access: false },
  { label: 'GDPR erasure',            owner: true,  admin: false, team_member: false, limited_access: false },
]

function TeamRoleMatrix() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-52">Capability</TableHead>
            {(['owner', 'admin', 'team_member', 'limited_access'] as const).map((role) => {
              const cfg = ROLE_CONFIG[role]
              const Icon = cfg.icon
              return (
                <TableHead key={role} className="text-center w-28">
                  <div className="flex flex-col items-center gap-1">
                    <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                    <span className="text-xs">{cfg.label}</span>
                  </div>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {MATRIX_ROWS.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="text-sm">{row.label}</TableCell>
              {(['owner', 'admin', 'team_member', 'limited_access'] as const).map((role) => (
                <TableCell key={role} className="text-center">
                  {row[role]
                    ? <Check className="h-3.5 w-3.5 text-green-600 mx-auto" />
                    : <X className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TeamRoleCards() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(Object.entries(ROLE_CONFIG) as [UserRole, RoleConfig][]).map(([role, cfg]) => {
        const Icon = cfg.icon
        return (
          <div key={role} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={cn('h-4 w-4', cfg.color)} />
              <span className="text-sm font-semibold">{cfg.label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{cfg.description}</p>
            <ul className="space-y-0.5">
              {cfg.capabilities.slice(0, 3).map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 text-green-500 mt-px flex-shrink-0" />{c}
                </li>
              ))}
              {cfg.restrictions[0] && (
                <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <X className="h-3 w-3 text-red-400 mt-px flex-shrink-0" />{cfg.restrictions[0]}
                </li>
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

const inviteSchema = z.object({
  email: z.email('Enter a valid email'),
  role: z.enum(['admin', 'team_member', 'limited_access']),
})
type InviteFields = z.infer<typeof inviteSchema>

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invite = useInviteTeamMember()
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<InviteFields>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'team_member' },
  })
  const selectedRole = watch('role')
  const roleInfo = ROLE_CONFIG[selectedRole]
  const RoleIcon = roleInfo.icon

  const onSubmit = async (data: InviteFields) => {
    await invite.mutateAsync(data)
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email address</Label>
            <Input id="inv-email" type="email" placeholder="colleague@hotel.com" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={(v) => { setValue('role', v as InviteFields['role']) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-md bg-muted/50 border px-3 py-2 flex gap-2">
              <RoleIcon className={cn('h-3.5 w-3.5 mt-px flex-shrink-0', roleInfo.color)} />
              <p className="text-xs text-muted-foreground leading-relaxed">{roleInfo.description}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TeamMemberRow({ member, currentUserId, canManage }: {
  member: TeamMember
  currentUserId: string
  canManage: boolean
}) {
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveTeamMember()
  const fmtDate = useDateFormat()
  const isSelf = member.id === currentUserId
  const cfg = ROLE_CONFIG[member.role]
  const Icon = cfg.icon
  const [confirmRemove, setConfirmRemove] = useState<{ id: string } | null>(null)

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase">
              {member.email[0]}
            </div>
            <div>
              <p className="text-sm font-medium">{member.email}</p>
              {isSelf && <p className="text-xs text-muted-foreground">You</p>}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={cn('gap-1.5 cursor-help', cfg.badgeClass)}>
                  <Icon className="h-3 w-3" />{cfg.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs font-medium mb-1">{cfg.label}</p>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {fmtDate(new Date(member.created_at))}
        </TableCell>
        <TableCell className="text-right">
          {canManage && !isSelf && member.role !== 'owner' && (
            <div className="flex items-center justify-end gap-2">
              <Select
                value={member.role}
                onValueChange={(v) => { updateRole.mutate({ userId: member.id, role: v }) }}
                disabled={updateRole.isPending}
              >
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => { setConfirmRemove({ id: member.id }) }}
                disabled={removeMember.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>
      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove team member?"
        description={`Remove ${member.email} from the team? They will lose access immediately.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => { removeMember.mutate(member.id) }}
        onCancel={() => { setConfirmRemove(null) }}
      />
    </>
  )
}

type TeamView = 'members' | 'roles'

function TeamSection() {
  const { data: members = [], isLoading } = useTeamMembers()
  const role = useAuthStore((s) => s.role)
  const userId = useAuthStore((s) => s.session?.user.id ?? '')
  const canManage = !!role && hasPermission(role, 'can_manage_users')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [view, setView] = useState<TeamView>('members')

  const ownerCount  = members.filter((m) => m.role === 'owner').length
  const adminCount  = members.filter((m) => m.role === 'admin').length
  const memberCount = members.filter((m) => m.role === 'team_member').length
  const limitedCount = members.filter((m) => m.role === 'limited_access').length

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold">Team</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''}{' '}
            {[
              ownerCount  > 0 && `· ${String(ownerCount)} owner`,
              adminCount  > 0 && `· ${String(adminCount)} admin`,
              memberCount > 0 && `· ${String(memberCount)} team member`,
              limitedCount > 0 && `· ${String(limitedCount)} limited`,
            ].filter(Boolean).join(' ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              onClick={() => { setView('members') }}
              className={cn('px-3 py-1.5 font-medium transition-colors', view === 'members' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              Members
            </button>
            <button
              onClick={() => { setView('roles') }}
              className={cn('px-3 py-1.5 font-medium transition-colors border-l', view === 'roles' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              Role Matrix
            </button>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => { setInviteOpen(true) }}>
              <Plus className="mr-2 h-3.5 w-3.5" />Invite Member
            </Button>
          )}
        </div>
      </div>

      {view === 'roles' ? (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">Role Descriptions</h3>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <TeamRoleCards />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Permission Matrix</h3>
            <TeamRoleMatrix />
          </div>
        </div>
      ) : isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No team members yet.</p>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => { setInviteOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />Invite your first member
            </Button>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TeamMemberRow key={m.id} member={m} currentUserId={userId} canManage={canManage} />
            ))}
          </TableBody>
        </Table>
      )}

      <InviteModal open={inviteOpen} onClose={() => { setInviteOpen(false) }} />
    </div>
  )
}

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
        <Loader2 className="h-4 w-4 animate-spin" />Loading thresholds…
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
        <div>
          <Label className="text-sm font-medium">Manager approval above</Label>
          <p className="text-xs text-muted-foreground mb-2">Orders above this value require admin or owner approval</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{sym}</span>
            <Input
              type="number"
              min={0}
              step={10}
              className="pl-7 h-9 text-sm"
              placeholder={String(managerVal)}
              value={manager}
              onChange={(e) => { setManager(e.target.value) }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Current: {sym}{managerVal.toFixed(2)}</p>
        </div>

        <div>
          <Label className="text-sm font-medium">Director approval above</Label>
          <p className="text-xs text-muted-foreground mb-2">Orders above this value require owner approval only</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{sym}</span>
            <Input
              type="number"
              min={0}
              step={50}
              className="pl-7 h-9 text-sm"
              placeholder={String(directorVal)}
              value={director}
              onChange={(e) => { setDirector(e.target.value) }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Current: {sym}{directorVal.toFixed(2)}</p>
        </div>

        <div>
          <Label className="text-sm font-medium">Auto-escalation timeout</Label>
          <p className="text-xs text-muted-foreground mb-2">Hours before a stale pending_manager request is auto-escalated to pending_director</p>
          <div className="relative">
            <Input
              type="number"
              min={1}
              max={168}
              step={1}
              className="pr-10 h-9 text-sm"
              placeholder={String(escalationVal)}
              value={escalation}
              onChange={(e) => { setEscalation(e.target.value) }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">hrs</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Current: {String(escalationVal)}h · checked every 30 min by scheduled job</p>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={update.isPending || (!manager && !director && !escalation)}
          className="gap-1.5"
        >
          {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save thresholds
        </Button>

        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How it works</p>
          <p>When a restock request is created, its estimated cost (qty × unit cost) is compared against these thresholds automatically. Cost history is used as fallback when the variant has no current price set.</p>
          <p>Requests that sit in pending_manager past the escalation timeout are automatically promoted to pending_director by a scheduled job.</p>
        </div>
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
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />Checking autonomous loop…
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        Health summary unavailable for this role.
      </div>
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

  const statusColor =
    cycleStatus === 'healthy'  ? 'text-emerald-600 dark:text-emerald-400'
    : cycleStatus === 'failing' ? 'text-red-600 dark:text-red-400'
    : cycleStatus === 'degraded'? 'text-amber-600 dark:text-amber-400'
    : 'text-muted-foreground'

  const statusDot =
    cycleStatus === 'healthy'  ? 'bg-emerald-500'
    : cycleStatus === 'failing' ? 'bg-red-500'
    : cycleStatus === 'degraded'? 'bg-amber-500'
    : 'bg-muted-foreground/40'

  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Autonomous loop status
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full inline-block', statusDot)} />
          <span className={cn('text-xs font-medium', statusColor)}>
            {cycleStatus === 'healthy'   && 'Healthy'}
            {cycleStatus === 'failing'   && `Failing (${String(cycle?.consecutive_failures ?? 0)} in a row)`}
            {cycleStatus === 'degraded'  && 'Last run failed'}
            {cycleStatus === 'idle'      && 'No runs yet'}
          </span>
        </div>
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
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 mt-px flex-shrink-0" />
          <p className="text-[11px] text-red-700 dark:text-red-400 leading-relaxed">
            {data.open_critical > 0 && `${String(data.open_critical)} unacknowledged critical event${data.open_critical === 1 ? '' : 's'}. `}
            {failingJobs.length > 0 && `${String(failingJobs.length)} job${failingJobs.length === 1 ? '' : 's'} failing. `}
            Investigate via <code className="font-mono">cron.job_run_details</code> and <code className="font-mono">system_health_events</code>.
          </p>
        </div>
      )}
    </div>
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
        <Loader2 className="h-4 w-4 animate-spin" />Loading hotel…
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
        <div>
          <Label className="text-sm font-medium">Auto-approve restock threshold</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Pending restock requests with estimated cost at or below this amount are auto-approved. Set to 0 to disable.
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{sym}</span>
            <Input
              type="number"
              min={0}
              step={5}
              className="pl-7 h-9 text-sm"
              placeholder={String(currentThreshold)}
              value={threshold}
              onChange={(e) => { setThreshold(e.target.value) }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Current: {sym}{currentThreshold.toFixed(2)}
            {currentThreshold === 0 ? ' (disabled)' : ''}
          </p>
        </div>

        {/* Auto PO generation */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Auto-generate Purchase Orders</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When 3+ approved restocks exist for the same supplier, automatically create a draft PO
              </p>
            </div>
            <Switch
              checked={effectivePoEnabled}
              onCheckedChange={(v) => { setPoEnabled(v) }}
            />
          </div>
        </div>

        {/* Invoice tolerance */}
        <div>
          <Label className="text-sm font-medium">Invoice auto-approve tolerance</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Invoices with discrepancy at or below this percentage are auto-approved after 3-way match
          </p>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              className="pr-8 h-9 text-sm"
              placeholder={String(currentTolerance)}
              value={tolerance}
              onChange={(e) => { setTolerance(e.target.value) }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Current: {String(currentTolerance)}%
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={update.isPending || !isDirty}
          className="gap-1.5"
        >
          {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save autonomous settings
        </Button>

        {/* Live cron health — replaces static "Active agents" copy */}
        <CronHealthPanel />

        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">What's running</p>
          <p>Intelligence cycle (every 15 min): anomaly alerts, restock proposals, preemptive restocks, stale escalations, discrepancy detection, and the auto-approvals configured above.</p>
          <p>Event-driven triggers (real-time): critical stockouts, PO auto-close on full receipt, consumption-spike detection.</p>
          <p>Weekly: PAR optimization, supplier lead-time learning (Sun 4am UTC), price drift (Mon 6am UTC). Daily: POS variance (5am UTC).</p>
          <p>Health monitor (every 5 min): scans <code className="font-mono">cron.job_run_details</code>, opens <code className="font-mono">system_health_events</code> rows on failure streaks.</p>
        </div>
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
  url:    z.string().url('Must be a valid URL').refine((u) => u.startsWith('https://'), 'Must use HTTPS'),
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
    <span className={cn(
      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
      success
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
        : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    )}>
      {success ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      {success ? 'Delivered' : 'Failed'}
    </span>
  )
}

function EndpointDeliveries({ endpointId }: { endpointId: string }) {
  const { data: deliveries = [], isLoading } = useWebhookDeliveries(endpointId)

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit webhook' : 'Add webhook endpoint'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input {...register('name')} placeholder="e.g. PMS sync, Supplier notify" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>URL</Label>
            <Input {...register('url')} placeholder="https://your-endpoint.com/webhook" />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Signing secret</Label>
              <button
                type="button"
                onClick={() => { setValue('secret', generateSecret()) }}
                className="text-[10px] text-primary hover:underline"
              >
                Generate
              </button>
            </div>
            <Input {...register('secret')} className="font-mono text-xs" placeholder="min 16 characters" />
            {errors.secret && <p className="text-xs text-destructive">{errors.secret.message}</p>}
            <p className="text-[10px] text-muted-foreground">
              Beacon signs every payload with <code className="font-mono">X-Beacon-Signature: sha256=…</code>
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Event filter</Label>
              <button
                type="button"
                onClick={() => { setSelectedEvents([]) }}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                All events (clear)
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto rounded border p-2">
              {ALL_ACTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { toggleEvent(type) }}
                  className={cn(
                    'rounded px-2 py-0.5 text-[10px] font-mono font-medium transition-colors',
                    selectedEvents.includes(type)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70',
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {selectedEvents.length === 0
                ? 'Firing on all action types'
                : `Firing on ${selectedEvents.length} selected type${selectedEvents.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? 'Save' : 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
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
    <div className="rounded-lg border divide-y">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{ep.name}</p>
            {!ep.enabled && (
              <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">Disabled</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">{ep.url}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ep.event_types.length === 0
              ? 'All events'
              : ep.event_types.slice(0, 3).join(', ') + (ep.event_types.length > 3 ? ` +${ep.event_types.length - 3}` : '')}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={ep.enabled}
            onCheckedChange={(v) => { void update.mutateAsync({ id: ep.id, patch: { enabled: v } }) }}
          />
          <button
            type="button"
            onClick={() => { setExpanded((x) => !x) }}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground text-[10px]"
          >
            {expanded ? 'Hide' : 'Log'}
          </button>
          <button type="button" onClick={onEdit} className="p-1.5 rounded hover:bg-muted transition-colors">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button type="button" onClick={onDelete} className="p-1.5 rounded hover:bg-muted transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      {/* Delivery log */}
      {expanded && (
        <div className="px-4 py-3 bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Recent deliveries</p>
          <EndpointDeliveries endpointId={ep.id} />
        </div>
      )}
    </div>
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
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {endpoints.length === 0 ? (
            <div className="rounded-lg border px-4 py-8 text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">No webhook endpoints configured</p>
              <p className="text-xs text-muted-foreground">
                Add an endpoint to push BeaconAction events to your PMS, supplier systems, or automation tools.
              </p>
            </div>
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add endpoint
          </Button>
        </div>
      )}

      <div className="mt-6 rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Verification</p>
        <p>
          Validate each request server-side: <code className="font-mono">HMAC_SHA256(body, secret)</code> must match
          the <code className="font-mono">X-Beacon-Signature</code> header (after stripping the <code className="font-mono">sha256=</code> prefix).
        </p>
        <p>Beacon retries are not automatic — re-delivery is available via the delivery log.</p>
      </div>

      <WebhookEndpointModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete webhook endpoint"
        description={`Remove "${deleting?.name}"? Delivery history will also be deleted.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) { void deleteEndpoint.mutateAsync(deleting.id) }
          setDeleting(null)
        }}
        onCancel={() => { setDeleting(null) }}
      />
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
        <div className="space-y-1.5">
          <Label htmlFor="gdpr-email">User email</Label>
          <Input id="gdpr-email" type="email" placeholder="user@example.com" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        {result && (
          <p className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">{result}</p>
        )}
        <Button type="submit" variant="destructive" size="sm" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                  const Icon = item.icon
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
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
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
