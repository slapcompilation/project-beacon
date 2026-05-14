// Layer: Floor — AR shelf preview page
//
// Phase 9 extension points:
//   - Detection engine wired into useARSession (see hook for full spec)
//   - CameraShelfView overlay cards hydrated from Reality Graph
//   - One-tap stock correction when detected qty diverges from system count
//   - WebXR anchor tracking for stable overlay positioning
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useNavigate } from 'react-router-dom'
import { Button, Callout, Intent } from '@blueprintjs/core'
import { useARSession } from '@/features/floor/hooks/useARSession'
import { CameraShelfView } from '@/features/floor/components/CameraShelfView'

export default function ARPreviewPage() {
  const navigate = useNavigate()
  const session = useARSession()

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <Button
          icon="arrow-left"
          variant="minimal"
          onClick={() => { void navigate(-1) }}
          aria-label="Back"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold leading-none">Floor · AR Preview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live shelf intelligence overlay
          </p>
        </div>
        {session.status === 'active' && (
          <Button size="small" onClick={session.stop}>
            Stop Camera
          </Button>
        )}
      </div>

      {/* Main — camera fills the available space */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
        <CameraShelfView
          session={session}
          onRequestStart={() => { void session.start() }}
          onStop={session.stop}
          className="flex-1 min-h-0"
        />

        <Callout intent={Intent.WARNING} icon="info-sign" title="Phase 9 — Detection engine not yet active">
          <p>
            The camera scaffold is in place. In Phase 9, the vision model will detect
            shelf labels and barcodes, match them to the Reality Graph, and render
            live stock · runway · anomaly overlays directly on the feed.
          </p>
          <ul className="list-disc list-inside space-y-0.5 mt-1">
            <li>Bounding-box overlay cards per detected variant</li>
            <li>One-tap stock correction when count diverges</li>
            <li>WebXR anchor tracking for stable overlay positioning</li>
            <li>Write-off pre-fill from detected discrepancy</li>
          </ul>
        </Callout>
      </div>
    </div>
  )
}
