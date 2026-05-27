// Restock spend tiers that route requests for sign-off.

import { useState } from 'react'
import {
  Button, Callout, FormGroup, InputGroup, Intent, Spinner, SpinnerSize,
} from '@blueprintjs/core'
import { getCurrencySymbol } from '@/lib/currency'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useApprovalThresholds, useUpdateApprovalThresholds } from '@/features/restock/hooks'
import { SectionHeader } from './_shared'

export function ApprovalThresholdsSection() {
  const { data, isLoading } = useApprovalThresholds()
  const update = useUpdateApprovalThresholds()
  const hotel  = useActiveHotel()
  const sym    = getCurrencySymbol(hotel?.currency ?? 'USD')

  const [manager,    setManager]    = useState('')
  const [director,   setDirector]   = useState('')
  const [escalation, setEscalation] = useState('')

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
