// Layer: Cross-layer — Briefing (Sprint 12 + 13 + A)
// The command center. Ranked decision feed surfaces what to do today across all
// layers. Each section is a self-contained component in features/briefing/components/.
// Palantir principle: the system has already done the analysis before you open it.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Button, Collapse } from '@blueprintjs/core'
import {
  useCaptureSnapshot, snapshotCapturedToday, useIntelligenceHistory,
} from '@/features/briefing/hooks'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'
import { useScopeMode } from '@/hooks/useActiveOrgId'
import { useHasOrgScope } from '@/features/organizations/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { PortfolioCommandHome } from '@/features/mind/PortfolioCommandHome'
import type { AipTab } from '@/features/mind/AIPShell'

import { SituationBanner } from '@/features/briefing/components/SituationBanner'
import { SituationTimeline } from '@/features/briefing/components/SituationTimeline'
import { GetStartedBanner } from '@/features/briefing/components/GetStartedBanner'
import { ProposalsPanel } from '@/features/briefing/components/ProposalsPanel'
import { DecisionFeed } from '@/features/briefing/components/DecisionFeed'
import { PressureSection } from '@/features/briefing/components/PressureSection'
import { ProposalQualitySection } from '@/features/briefing/components/ProposalQualitySection'
import { OccupancyInsightSection } from '@/features/briefing/components/OccupancyInsightSection'
import { ShiftActivity } from '@/features/briefing/components/ShiftActivity'
import { HotelMap } from '@/features/canvas/HotelMap'
import { AipDecisionSummary } from '@/features/mind/AipDecisionSummary'

// Home is scope-aware: a chain owner in portfolio scope gets the org rollup
// (every property's signals + drill-in); a single property gets the briefing.
// One Home, two scopes — mirrors Mind's DecisionsHome.
export default function BriefingPage() {
  const scopeMode = useScopeMode()
  const hasOrgScope = useHasOrgScope()
  const navigate = useNavigate()
  const enterHotelScope = useAppStore((s) => s.enterHotelScope)

  if (hasOrgScope && scopeMode === 'organization') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <PortfolioCommandHome
          onNavigate={(tab: AipTab) => { void navigate(`/mind?aip=${tab}`) }}
          onHopToHotel={(hotelId) => { enterHotelScope(hotelId) }}  // stay on Home → that property's briefing
        />
      </div>
    )
  }
  return <HotelBriefing />
}

function HotelBriefing() {
  const [windowHours, setWindowHours] = useState<8 | 12 | 24 | 48>(8)
  const [copied, setCopied]           = useState(false)
  const [trendsOpen, setTrendsOpen]   = useState(false)

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

  // Phase F1 — Canvas surfaces the Copilot as a first-class pane. On first
  // entry we open the right panel + select the Copilot tab. Subsequent user
  // toggles win (we only run this once per BriefingPage mount).
  const setContextPanelOpen = useAppStore((s) => s.setContextPanelOpen)
  const setContextPanelTab  = useAppStore((s) => s.setContextPanelTab)
  useEffect(() => {
    setContextPanelOpen(true)
    setContextPanelTab('copilot')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const now = new Date()
  const greeting =
    now.getHours() < 12 ? 'Good morning' :
    now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

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
        <Button
          variant="minimal"
          size="small"
          icon={copied ? 'clipboard' : 'clipboard'}
          onClick={() => { void handleCopy() }}
        >
          {copied ? 'Copied' : 'Copy summary'}
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {/* Owner cockpit: the single "what the autonomous loop left for me"
              glance. Canvas is the one home; this deep-links into Mind. */}
          {isAdminOrOwner && <AipDecisionSummary />}
          {isAdminOrOwner && <GetStartedBanner />}
          <SituationBanner />
          <SituationTimeline />
          <ProposalsPanel currency={currency} />
          <HotelMap />
          <DecisionFeed currency={currency} />
          <ShiftActivity
            windowHours={windowHours}
            setWindowHours={setWindowHours}
            currency={currency}
          />

          {/* Trends — secondary analytics, collapsed so Home opens decisions-first */}
          <div>
            <Button
              variant="minimal"
              size="small"
              icon="chart"
              endIcon={trendsOpen ? 'chevron-up' : 'chevron-down'}
              onClick={() => { setTrendsOpen((v) => !v) }}
            >
              Trends
            </Button>
            <Collapse isOpen={trendsOpen}>
              <div className="space-y-6 pt-3">
                <PressureSection />
                <ProposalQualitySection />
                <OccupancyInsightSection />
              </div>
            </Collapse>
          </div>
        </div>
      </div>
    </div>
  )
}
