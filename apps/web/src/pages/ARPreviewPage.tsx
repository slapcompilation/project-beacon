// Layer: Floor — AR shelf preview page
//
// Phase 9 extension points:
//   - Detection engine wired into useARSession (see hook for full spec)
//   - CameraShelfView overlay cards hydrated from Reality Graph
//   - One-tap stock correction when detected qty diverges from system count
//   - WebXR anchor tracking for stable overlay positioning

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
          variant="ghost"
          size="icon"
          onClick={() => { void navigate(-1) }}
          className="shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold leading-none">Floor · AR Preview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live shelf intelligence overlay
          </p>
        </div>
        {session.status === 'active' && (
          <Button
            variant="outline"
            size="sm"
            onClick={session.stop}
          >
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

        {/* Phase 9 notice */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <Info className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
            <p className="font-medium">Phase 9 — Detection engine not yet active</p>
            <p>
              The camera scaffold is in place. In Phase 9, the vision model will detect
              shelf labels and barcodes, match them to the Reality Graph, and render
              live stock · runway · anomaly overlays directly on the feed.
            </p>
            <ul className="list-disc list-inside space-y-0.5 mt-1 text-amber-600 dark:text-amber-500">
              <li>Bounding-box overlay cards per detected variant</li>
              <li>One-tap stock correction when count diverges</li>
              <li>WebXR anchor tracking for stable overlay positioning</li>
              <li>Write-off pre-fill from detected discrepancy</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
