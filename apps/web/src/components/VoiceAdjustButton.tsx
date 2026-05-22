// Voice-activated stock adjustment. Shows transcript and parse-failure feedback.

import { useEffect, useState } from 'react'
import { Button, Icon, Intent } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useSpeechRecognition, parseVoiceCommand } from '@/hooks/useSpeechRecognition'

interface Props {
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

  useEffect(() => {
    if (listening) setFeedback({ kind: 'idle' })
  }, [listening])

  if (!supported) return null

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="small"
          intent={listening ? Intent.DANGER : Intent.NONE}
          variant={listening ? undefined : 'outlined'}
          icon={listening ? undefined : 'microphone'}
          loading={listening}
          onClick={() => { if (listening) { stop() } else { start() } }}
          title={
            listening
              ? 'Stop listening'
              : 'Voice adjust — say "adjust Pilsner by -3 spillage"'
          }
          className={cn(listening && 'animate-pulse')}
        >
          {listening ? 'Listening…' : 'Voice'}
        </Button>

        {error && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <Icon icon="microphone" size={12} />
            {error === 'not-allowed' ? 'Mic blocked' : error}
          </span>
        )}
      </div>

      {feedback.kind !== 'idle' && (
        <div
          className={cn(
            'flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs max-w-xs',
            feedback.kind === 'ok'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300'
              : 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300',
          )}
        >
          <Icon
            icon={feedback.kind === 'ok' ? 'tick-circle' : 'warning-sign'}
            size={12}
            className="mt-px shrink-0"
          />
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
