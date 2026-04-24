// Layer: Cross-layer — Briefing (Sprint 12 + 13 + A)
// The command center. Ranked decision feed surfaces what to do today across all
// layers. Each section is a self-contained component in features/briefing/components/.
// Palantir principle: the system has already done the analysis before you open it.

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Clipboard, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useCaptureSnapshot, snapshotCapturedToday, useIntelligenceHistory,
} from '@/features/briefing/hooks'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { useCurrency } from '@/hooks/useCurrency'

import { SituationBanner } from '@/features/briefing/components/SituationBanner'
import { SituationTimeline } from '@/features/briefing/components/SituationTimeline'
import { GetStartedBanner } from '@/features/briefing/components/GetStartedBanner'
import { ProposalsPanel } from '@/features/briefing/components/ProposalsPanel'
import { DecisionFeed } from '@/features/briefing/components/DecisionFeed'
import { PressureSection } from '@/features/briefing/components/PressureSection'
import { ProposalQualitySection } from '@/features/briefing/components/ProposalQualitySection'
import { OccupancyInsightSection } from '@/features/briefing/components/OccupancyInsightSection'
import { ShiftActivity } from '@/features/briefing/components/ShiftActivity'

export default function BriefingPage() {
  const [windowHours, setWindowHours] = useState<8 | 12 | 24 | 48>(8)
  const [copied, setCopied]           = useState(false)

  const activeHotel   = useActiveHotel()
  const currency      = useCurrency()
  const role          = useAuthStore((s) => s.role ?? 'limited_access')
  const captureSnap   = useCaptureSnapshot()
  const { data: history = [] } = useIntelligenceHistory(30)

  // Auto-capture snapshot once per day on mount (server is idempotent; client guards too)
  useEffect(() => {
    if (!snapshotCapturedToday(activeHotel?.id ?? null)) {
      captureSnap.mutate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHotel?.id])

  const now = new Date()
  const greeting =
    now.getHours() < 12 ? 'Good morning' :
    now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  // Freshness label from latest snapshot
  const latestSnapshot = history.at(-1)
  const freshnessLabel = latestSnapshot
    ? (() => {
        const d = new Date(latestSnapshot.captured_at)
        return d.toDateString() === now.toDateString()
          ? `Analyzed today at ${format(d, 'HH:mm')}`
          : `Analyzed ${formatDistanceToNow(d, { addSuffix: true })}`
      })()
    : null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${greeting}, ${activeHotel?.name ?? 'hotel'} — ${format(now, 'EEE d MMM yyyy, HH:mm')}`)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => { setCopied(false) }, 2000)
  }

  const isAdminOrOwner = role === 'admin' || role === 'owner'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-8 py-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">
            {greeting}{activeHotel?.name ? `, ${activeHotel.name}` : ''}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(now, 'EEEE, d MMMM yyyy')}
            {freshnessLabel ? ` · ${freshnessLabel}` : ' · Decision feed'}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={() => { void handleCopy() }}>
          {copied ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          Copy summary
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {isAdminOrOwner && <GetStartedBanner />}
          <SituationBanner />
          <SituationTimeline />
          <ProposalsPanel currency={currency} />
          <DecisionFeed currency={currency} />
          <PressureSection />
          <ProposalQualitySection />
          <OccupancyInsightSection />
          <ShiftActivity
            windowHours={windowHours}
            setWindowHours={setWindowHours}
            currency={currency}
          />
        </div>
      </div>
    </div>
  )
}
