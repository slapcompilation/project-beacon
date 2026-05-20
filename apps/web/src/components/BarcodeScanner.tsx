import { useEffect, useRef, useState } from 'react'
import { Button, Icon, InputGroup, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'

interface Props {
  onDetected: (code: string) => void
}

// BarcodeDetector is browser-native, not yet typed in lib.dom
const BarcodeDetectorAPI = (window as Window & { BarcodeDetector?: unknown }).BarcodeDetector as
  | (new (opts: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
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
    streamRef.current?.getTracks().forEach((t) => { t.stop() })
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
          // ignore per-frame decode errors
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
      {isSupported && (
        <div className="relative overflow-hidden rounded-xl bg-black aspect-[4/3] flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

          {status === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <Icon icon="camera" size={40} className="text-white/70" />
              <Button onClick={() => { void start() }}>Start Camera</Button>
            </div>
          )}

          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Spinner size={SpinnerSize.STANDARD} />
            </div>
          )}

          {status === 'scanning' && (
            <>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-2/3 h-1/3 border-2 border-white/70 rounded-lg" />
              </div>
              <Button
                onClick={stop}
                size="small"
                icon="disable"
                className="absolute bottom-3 right-3"
              >
                Stop
              </Button>
            </>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center">
              <Icon icon="disable" size={32} className="text-white/70" />
              <p className="text-sm text-white/80">{errorMsg}</p>
              <Button onClick={() => { void start() }} size="small">Retry</Button>
            </div>
          )}
        </div>
      )}

      {!isSupported && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Barcode camera scanning is not supported in this browser. Use the manual input below.
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <InputGroup
          placeholder="Type or paste SKU / barcode…"
          value={manualValue}
          onChange={(e) => { setManualValue(e.target.value) }}
          className="flex-1"
          autoComplete="off"
        />
        <Button type="submit" intent={Intent.PRIMARY} disabled={!manualValue.trim()}>
          Search
        </Button>
      </form>
    </div>
  )
}
