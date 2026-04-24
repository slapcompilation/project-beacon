// Layer: Floor — AR session state machine stub
//
// Phase 9 extension points (documented here for the AR implementation sprint):
//
//   1. DETECTION ENGINE
//      Replace `detected: null` with results from a WebXR / TensorFlow.js
//      model that identifies shelf labels, product barcodes, and stock levels
//      from the camera feed. Shape: Array<{ variantId, label, boundingBox, stockEstimate }>
//
//   2. ANCHOR TRACKING
//      Add `anchors: XRAnchor[]` to ARSessionState. When WebXR hit-test lands on
//      a shelf surface, create a persistent anchor so overlays stay positioned
//      correctly as the camera moves.
//
//   3. OVERLAY DATA
//      Hydrate detected variant IDs against the Reality Graph (useProducts,
//      useForecast, useWasteRadar) to build per-product overlay cards showing
//      stock level, runway, and anomaly flags — the "shelf label + intelligence"
//      composite view.
//
//   4. WRITE-BACK
//      Surface a one-tap stock correction flow when a detected quantity diverges
//      from the system count by > threshold. Pre-fill StockAdjustModal with the
//      detected delta.
//
//   5. PERMISSIONS
//      `camera: 'prompt' | 'granted' | 'denied'` drives the permission gate UI.
//      Request via `navigator.mediaDevices.getUserMedia({ video: true })` and
//      cache the result for the session.

import { useState, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ARSessionStatus =
  | 'idle'          // not started
  | 'requesting'    // camera permission in flight
  | 'active'        // camera live, overlays rendering
  | 'paused'        // camera suspended (tab blur, etc.)
  | 'denied'        // permission refused
  | 'unsupported'   // getUserMedia unavailable

export interface ARSessionState {
  status: ARSessionStatus
  /** Live MediaStream from getUserMedia — null when not active */
  stream: MediaStream | null
  /** Error description when status === 'denied' | 'unsupported' */
  errorMessage: string | null
  /**
   * Phase 9: detected shelf items.
   * Currently always empty — populated by the vision model in Phase 9.
   */
  detectedItems: ARDetectedItem[]
}

/**
 * Phase 9 shape — populated once the detection engine is wired in.
 * Defined here so consuming components can type-check against it now.
 */
export interface ARDetectedItem {
  variantId: string
  label: string
  /** Normalised [0,1] bounding box in camera-space */
  boundingBox: { x: number; y: number; width: number; height: number }
  /** Estimated on-shelf count from CV model (null if not determinable) */
  stockEstimate: number | null
  confidence: number  // 0–1
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseARSessionReturn extends ARSessionState {
  start: () => Promise<void>
  stop: () => void
}

const supported =
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices.getUserMedia === 'function'

export function useARSession(): UseARSessionReturn {
  const [state, setState] = useState<ARSessionState>({
    status: supported ? 'idle' : 'unsupported',
    stream: null,
    errorMessage: supported ? null : 'Camera API not available in this browser.',
    detectedItems: [],
  })

  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    if (!supported) return

    setState((s) => ({ ...s, status: 'requesting', errorMessage: null }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setState((s) => ({ ...s, status: 'active', stream, detectedItems: [] }))

      // Phase 9: start detection loop here
      // e.g. requestAnimationFrame(() => runDetectionLoop(stream, setState))
    } catch (err) {
      const isDenied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setState((s) => ({
        ...s,
        status: isDenied ? 'denied' : 'unsupported',
        stream: null,
        errorMessage: isDenied
          ? 'Camera permission denied. Enable camera access in your browser settings.'
          : 'Unable to access camera. Please try again.',
      }))
    }
  }, [])

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { t.stop(); })
      streamRef.current = null
    }
    setState((s) => ({ ...s, status: 'idle', stream: null, detectedItems: [] }))
  }, [])

  return { ...state, start, stop }
}
