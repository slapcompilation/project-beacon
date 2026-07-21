// Eye: Hotel-wide thresholds used by the alert engine.

import { Slider } from '@blueprintjs/core'
import { useAlertPreferences, useUpdateAlertPreferences } from '@/features/notifications/hooks'
import { SectionHeader } from './_shared'
import { AlertFeedbackPanel } from './NotificationsSection'

export function AlertThresholdsSection() {
  const { data: prefs } = useAlertPreferences()
  const update = useUpdateAlertPreferences()

  const daysThreshold  = prefs?.days_threshold  ?? 7
  const wasteThreshold = prefs?.waste_threshold ?? 10

  return (
    <div>
      <SectionHeader
        title="Alert Thresholds"
        description="Hotel-wide thresholds used by the alert engine. Changes apply to the next alert scan."
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

      <div className="mt-8">
        <div className="mb-3">
          <p className="text-sm font-semibold">Alert Intelligence Loop</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Why operators dismissed alerts in the last 90 days. A high incorrect-data rate signals these thresholds need tuning.
          </p>
        </div>
        <AlertFeedbackPanel />
      </div>
    </div>
  )
}
