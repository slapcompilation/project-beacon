import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  onDetected: (code: string) => void
}

// BarcodeDetector is a browser-native API, not yet in TypeScript's lib
const BarcodeDetectorAPI = (window as Window & { BarcodeDetector?: unknown }).BarcodeDetector as
  | (new (opts: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
    })
  | undefined

const isSupported = typeof BarcodeDetectorAPI !== 'undefined'

type ScanStatus = 'idle' | 'starting' | 'scanning' | 'error'

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [manualValue, setManualValue] = useState('')

  const stop = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    streamRef.current?.getTracks().forEach((t) => { t.stop(); })
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }

  useEffect(() => () => { stop() }, [])

  const start = async () => {
    if (!isSupported) return
    setStatus('starting')
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('scanning')

      const detector = new BarcodeDetectorAPI({
        formats: ['ean_13', 'ean_8', 'qr_code', 'code_128', 'code_39', 'upc_a', 'upc_e'],
      })

      intervalRef.current = setInterval(() => {
        if (!videoRef.current) return
        void detector.detect(videoRef.current).then((barcodes) => {
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            stop()
            onDetected(barcodes[0].rawValue)
          }
        }).catch(() => {
          // Ignore per-frame decode errors
        })
      }, 300)
    } catch {
      stop()
      setStatus('error')
      setErrorMsg('Camera access denied or unavailable.')
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = manualValue.trim()
    if (val) { setManualValue(''); onDetected(val) }
  }

  return (
    <div className="space-y-4">
      {/* Camera viewfinder */}
      {isSupported && (
        <div className="relative overflow-hidden rounded-xl bg-black aspect-[4/3] flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {status === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <Camera className="h-10 w-10 text-white/70" />
              <Button onClick={() => { void start() }} variant="secondary">
                Start Camera
              </Button>
            </div>
          )}

          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {status === 'scanning' && (
            <>
              {/* Scan guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-2/3 h-1/3 border-2 border-white/70 rounded-lg" />
              </div>
              <Button
                onClick={stop}
                size="sm"
                variant="secondary"
                className="absolute bottom-3 right-3"
              >
                <CameraOff className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center">
              <CameraOff className="h-8 w-8 text-white/70" />
              <p className="text-sm text-white/80">{errorMsg}</p>
              <Button onClick={() => { void start() }} variant="secondary" size="sm">Retry</Button>
            </div>
          )}
        </div>
      )}

      {!isSupported && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Barcode camera scanning is not supported in this browser.
          Use the manual input below.
        </div>
      )}

      {/* Manual input — always shown */}
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <Input
          placeholder="Type or paste SKU / barcode…"
          value={manualValue}
          onChange={(e) => { setManualValue(e.target.value); }}
          className="flex-1"
          autoComplete="off"
        />
        <Button type="submit" disabled={!manualValue.trim()}>
          Search
        </Button>
      </form>
    </div>
  )
}
