// Split surface:
//  - NotificationPrefsSection: per-user notification prefs (browser push + quiet
//    hours). Personal → lives on the Account page.
//  - AlertFeedbackPanel: the Alert Intelligence Loop — org-wide dismissed-reason
//    aggregation (model quality). Not a personal pref → rendered under Alert
//    Thresholds in Settings, where threshold calibration lives.

import { useMemo, useState } from 'react'
import {
  Button, Card, HTMLTable, InputGroup, Intent, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useUserPrefs, useUpdateUserPrefs } from '@/features/user/hooks'
import {
  useNotificationFeedback,
  type TypeFeedback,
} from '@/features/notifications/hooks'
import { SectionHeader, SettingRow } from './_shared'

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

/** Org-wide alert-quality feedback. Rendered under Alert Thresholds. */
export function AlertFeedbackPanel() {
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
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alert Intelligence Loop</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">Last 90 days · {String(totalDismissed)} dismissed</span>
      </div>
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
      <div className="px-4 py-2.5 bg-muted/20 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Overall incorrect data rate: <span className="font-semibold tabular-nums">{overallIncorrectRate.toFixed(1)}%</span>
        </span>
        <Tag intent={qualityLabel.intent} minimal>{qualityLabel.text}</Tag>
      </div>
    </Card>
  )
}

/** Per-user notification preferences. Personal → lives on the Account page. */
export function NotificationPrefsSection() {
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
    </div>
  )
}
