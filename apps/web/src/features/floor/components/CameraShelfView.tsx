// @surface-orphan-ok — AR shelf scanning, complete and never wired to Floor. A real capability, not debris; deleting it is a product call.
// Layer: Floor — Camera viewfinder with shelf overlay skeleton
//
// Phase 9 extension: Replace placeholder overlays with real ARDetectedItem
// bounding boxes. Each box renders a mini EntityContextPanel card (stock, runway,
// anomaly flag) anchored to the detected product's shelf position.

import { useEffect, useRef } from 'react'
import { Button, Icon, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import type { ARSessionState, ARDetectedItem } from '../hooks/useARSession'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CameraShelfViewProps {
  session: ARSessionState
  onRequestStart: () => void
  onStop: () => void
  className?: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Phase 9: renders a floating overlay card anchored to a detected item's
 * bounding box. Currently shows a placeholder — replace with real intelligence.
 */
function DetectedItemOverlay({ item }: { item: ARDetectedItem }) {
  const style = {
    left:   `${String(item.boundingBox.x * 100)}%`,
    top:    `${String(item.boundingBox.y * 100)}%`,
    width:  `${String(item.boundingBox.width * 100)}%`,
    height: `${String(item.boundingBox.height * 100)}%`,
  }
  return (
    <div
      className="absolute border-2 border-blue-400 rounded"
      style={style}
    >
      {/* Overlay card — anchored to top-right of bounding box */}
      <div className="absolute -top-8 left-0 bg-black/80 backdrop-blur-sm rounded px-2 py-1 text-xs text-white whitespace-nowrap">
        {item.label}
        {item.stockEstimate != null && (
          <span className="ml-2 text-blue-300">~{item.stockEstimate} on shelf</span>
        )}
        {/* Phase 9: add runway, anomaly score, one-tap adjust button here */}
      </div>
    </div>
  )
}

function PermissionDeniedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <Icon icon="shield" size={32} intent={Intent.DANGER} />
      <p className="text-sm font-medium">Camera access denied</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Enable camera permissions in your browser settings, then try again.
      </p>
      <Button size="small" variant="outlined" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  )
}

function UnsupportedState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <Icon icon="disable" size={32} className="text-muted-foreground" />
      <p className="text-sm font-medium">Camera not available</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        AR Preview requires a device with a camera and a browser that supports
        the MediaDevices API (Chrome, Edge, Safari 14+).
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CameraShelfView({
  session,
  onRequestStart,
  onStop,
  className,
}: CameraShelfViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Wire the live stream into the <video> element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (session.stream) {
      video.srcObject = session.stream
      void video.play().catch(() => {/* autoplay blocked — user gesture required */})
    } else {
      video.srcObject = null
    }
  }, [session.stream])

  // Stop stream on unmount
  useEffect(() => {
    return () => { onStop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (session.status === 'unsupported') return <UnsupportedState />
  if (session.status === 'denied') return <PermissionDeniedState onRetry={onRequestStart} />

  if (session.status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          {/* Camera icon placeholder */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 text-muted-foreground">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium">AR Shelf Preview</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Point your camera at a shelf to see live stock intelligence overlays.
            {' '}
            <span className="text-amber-500">Phase 9 feature — overlay detection coming soon.</span>
          </p>
        </div>
        <Button intent={Intent.PRIMARY} onClick={onRequestStart}>
          Start Camera
        </Button>
      </div>
    )
  }

  if (session.status === 'requesting') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
        <p className="text-sm text-muted-foreground">Requesting camera access…</p>
      </div>
    )
  }

  // status === 'active' | 'paused'
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-black', className)}>
      {/* Live camera feed */}
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Detected item overlays — Phase 9: populated by detection engine */}
      {session.detectedItems.map((item) => (
        <DetectedItemOverlay key={item.variantId} item={item} />
      ))}

      {/* Phase 9 placeholder overlay — visible until detection engine is wired */}
      {session.detectedItems.length === 0 && session.status === 'active' && (
        <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
          <div className="rounded-full bg-black/60 backdrop-blur-sm px-4 py-2 text-xs text-white/70">
            Detection engine not yet active · Phase 9
          </div>
        </div>
      )}

      {/* Viewfinder reticle — Phase 9: becomes an alignment guide */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-48">
          {/* Corner brackets */}
          {(['top-left','top-right','bottom-left','bottom-right'] as const).map((corner) => (
            <div
              key={corner}
              className={cn(
                'absolute h-6 w-6 border-blue-400',
                corner === 'top-left' && 'top-0 left-0 border-t-2 border-l-2',
                corner === 'top-right' && 'top-0 right-0 border-t-2 border-r-2',
                corner === 'bottom-left' && 'bottom-0 left-0 border-b-2 border-l-2',
                corner === 'bottom-right' && 'bottom-0 right-0 border-b-2 border-r-2',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
