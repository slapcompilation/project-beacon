// Layer: Floor — voice-activated stock adjustment button
// Phase 6: shows raw transcript + parse-failure feedback so operators know
// exactly what was heard and whether it was understood.

import { useEffect, useState } from 'react'
import { Mic, MicOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSpeechRecognition, parseVoiceCommand } from '@/hooks/useSpeechRecognition'

interface Props {
  /** Called when a valid command is parsed. Populate your form with these values. */
  onCommand: (productQuery: string, delta: number, reason: string) => void
  className?: string
}

type FeedbackState =
  | { kind: 'idle' }
  | { kind: 'ok'; transcript: string }
  | { kind: 'fail'; transcript: string }

const FEEDBACK_TTL_MS = 4000

export function VoiceAdjustButton({ onCommand, className }: Props) {
  const { listening, transcript, error, supported, start, stop, reset } =
    useSpeechRecognition()

  const [feedback, setFeedback] = useState<FeedbackState>({ kind: 'idle' })

  // Parse and fire whenever a final transcript arrives
  useEffect(() => {
    if (!transcript) return

    const cmd = parseVoiceCommand(transcript)
    if (cmd) {
      setFeedback({ kind: 'ok', transcript })
      onCommand(cmd.productQuery, cmd.delta, cmd.reason)
    } else {
      setFeedback({ kind: 'fail', transcript })
    }
    reset()

    const t = setTimeout(() => { setFeedback({ kind: 'idle' }) }, FEEDBACK_TTL_MS)
    return () => { clearTimeout(t) }
  }, [transcript, onCommand, reset])

  // Clear feedback when listening starts again
  useEffect(() => {
    if (listening) setFeedback({ kind: 'idle' })
  }, [listening])

  if (!supported) return null

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={listening ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => { if (listening) { stop() } else { start() } }}
          title={
            listening
              ? 'Stop listening'
              : 'Voice adjust — say "adjust Pilsner by -3 spillage"'
          }
          className={cn(listening && 'animate-pulse')}
        >
          {listening ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Listening…
            </>
          ) : (
            <>
              <Mic className="mr-1.5 h-3.5 w-3.5" />
              Voice
            </>
          )}
        </Button>

        {/* Mic permission error */}
        {error && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <MicOff className="h-3 w-3" />
            {error === 'not-allowed' ? 'Mic blocked' : error}
          </span>
        )}
      </div>

      {/* Transcript feedback */}
      {feedback.kind !== 'idle' && (
        <div
          className={cn(
            'flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs max-w-xs',
            feedback.kind === 'ok'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300'
              : 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300',
          )}
        >
          {feedback.kind === 'ok' ? (
            <CheckCircle2 className="mt-px h-3 w-3 shrink-0" />
          ) : (
            <AlertCircle className="mt-px h-3 w-3 shrink-0" />
          )}
          <span>
            {feedback.kind === 'ok' ? (
              <>
                <span className="font-medium">Heard: </span>
                {feedback.transcript}
              </>
            ) : (
              <>
                <span className="font-medium">Didn't parse: </span>
                "{feedback.transcript}"
                <span className="block mt-0.5 opacity-70">
                  Try: "adjust [product] by -3 spillage"
                </span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
