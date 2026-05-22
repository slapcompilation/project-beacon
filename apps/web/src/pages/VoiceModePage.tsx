// Layer: Floor — Voice Mode (ElevenLabs Conversational AI pattern)
//
// Voice-driven interface that triggers BeaconActions through speech.
// The agent has access to: adjustStock, requestRestock, writeOff, checkBalance.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Button,
  Callout,
  Card,
  Icon,
  Intent,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { dispatchAction } from '@/lib/actions/dispatch'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'

// ─── Tool definitions ────────────────────────────────────────────────────────

const VOICE_TOOLS = [
  { name: 'adjustStock',    example: '"Adjust Tomatoes down 5, spoilage"',     action: 'ADJUST_STOCK' },
  { name: 'requestRestock', example: '"Request 20 units of Chicken Breast"',   action: 'REQUEST_RESTOCK' },
  { name: 'writeOff',       example: '"Write off 3 Olive Oil, expired"',       action: 'WRITE_OFF' },
  { name: 'checkBalance',   example: '"What\'s the current stock of Salmon?"', action: 'READ_ONLY' },
]

// ─── Transcript entry ─────────────────────────────────────────────────────────

interface TranscriptEntry {
  role:      'user' | 'agent'
  text:      string
  action?:   string
  success?:  boolean
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SessionState = 'idle' | 'connecting' | 'active' | 'error'

export default function VoiceModePage() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined

  const [session,    setSession]    = useState<SessionState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [lastAction, setLastAction] = useState<string | null>(null)

  const connect = useCallback(async () => {
    if (!agentId) {
      toast.error('Set VITE_ELEVENLABS_AGENT_ID in .env to enable voice mode')
      return
    }
    if (!hotelId) { toast.error('No active hotel'); return }

    setSession('connecting')
    setTranscript([])

    try {
      // @ts-ignore — @11labs/client is an optional runtime dep
      const { Conversation } = await import('@11labs/client') as unknown as {
        Conversation: {
          startSession: (opts: {
            agentId: string
            clientTools: Record<string, (args: Record<string, unknown>) => Promise<string>>
            onMessage: (msg: { message: string; source: string }) => void
            onConnect: () => void
            onDisconnect: () => void
            onError: (err: string) => void
          }) => Promise<{ endSession: () => void }>
        }
      }

      const clientTools = {
        adjustStock: async (args: Record<string, unknown>) => {
          const result = await dispatchAction(
            {
              type:      'ADJUST_STOCK',
              variantId: args['variantId'] as string,
              hotelId:   hotelId,
              userId,
              delta:     args['delta'] as number,
              reason:    args['reason'] as string,
            },
            { hotelId, actorId: userId, triggeredBy: 'user' },
          )
          setLastAction(result.success ? `Adjusted · ${result.edgesWritten} edges` : `Error: ${result.error.message}`)
          setTranscript((prev) => [...prev, { role: 'agent', text: result.success ? `Stock adjusted by ${args['delta']}` : result.error.message, action: 'ADJUST_STOCK', success: result.success }])
          return result.success ? 'done' : result.error.message
        },

        requestRestock: async (args: Record<string, unknown>) => {
          const result = await dispatchAction(
            {
              type:        'REQUEST_RESTOCK',
              variantId:   args['variantId'] as string,
              hotelId,
              requestorId: userId,
              quantityNeeded: args['quantity'] as number,
              notes:       args['notes'] as string | null,
            },
            { hotelId, actorId: userId, triggeredBy: 'user' },
          )
          setTranscript((prev) => [...prev, { role: 'agent', text: result.success ? 'Restock requested' : result.error.message, action: 'REQUEST_RESTOCK', success: result.success }])
          return result.success ? 'done' : result.error.message
        },

        writeOff: async (args: Record<string, unknown>) => {
          const result = await dispatchAction(
            {
              type:        'WRITE_OFF',
              variantId:   args['variantId'] as string,
              hotelId,
              userId,
              quantity:    args['quantity'] as number,
              wasteReason: args['reason'] as string,
            },
            { hotelId, actorId: userId, triggeredBy: 'user' },
          )
          setTranscript((prev) => [...prev, { role: 'agent', text: result.success ? `${args['quantity']} written off` : result.error.message, action: 'WRITE_OFF', success: result.success }])
          return result.success ? 'done' : result.error.message
        },
      }

      const conv = await Conversation.startSession({
        agentId,
        clientTools,
        onMessage: (msg) => {
          setTranscript((prev) => [...prev, { role: msg.source === 'user' ? 'user' : 'agent', text: msg.message }])
        },
        onConnect:    () => { setSession('active'); },
        onDisconnect: () => { setSession('idle'); },
        onError:      (err) => { toast.error(`Voice error: ${err}`); setSession('error') },
      })

      ;(window as unknown as Record<string, unknown>).__beaconVoiceEnd = () => { conv.endSession(); }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg.includes('Cannot find module') ? 'Install @11labs/client: pnpm add @11labs/client' : msg)
      setSession('error')
    }
  }, [agentId, hotelId, userId])

  function disconnect() {
    const end = (window as unknown as Record<string, () => void>).__beaconVoiceEnd
    if (end) end()
    setSession('idle')
  }

  const configured = !!agentId

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b shrink-0">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Icon icon="headset" size={14} intent={Intent.PRIMARY} />
          Voice Mode
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Speak stock adjustments, restocks, and write-offs — hands-free floor operations
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Setup warning */}
        {!configured && (
          <Callout intent={Intent.WARNING} icon="warning-sign" title="Configuration required">
            <p>Add to your <code className="font-mono bg-muted/50 px-1 rounded">.env</code>:</p>
            <pre className="font-mono bg-muted/30 rounded px-2 py-1 text-[10px] mt-1">
              {`VITE_ELEVENLABS_AGENT_ID=your_agent_id`}
            </pre>
            <p className="mt-1">Also install the SDK: <code className="font-mono bg-muted/50 px-1 rounded">pnpm --filter @beacon/web add @11labs/client</code></p>
            <p className="text-muted-foreground mt-1">Create an ElevenLabs Conversational AI agent with the tools: adjustStock, requestRestock, writeOff.</p>
          </Callout>
        )}

        {/* Tool reference */}
        <div className="grid grid-cols-2 gap-2">
          {VOICE_TOOLS.map((t) => (
            <Card key={t.name} compact>
              <p className="text-[10px] font-mono font-semibold text-primary">{t.name}</p>
              <p className="text-[10px] text-muted-foreground italic mt-1">{t.example}</p>
            </Card>
          ))}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Session Transcript</p>
            <Card compact className="!p-0 divide-y max-h-64 overflow-y-auto">
              {transcript.map((entry, i) => (
                <div key={i} className={cn('px-3 py-2 flex items-start gap-2', entry.role === 'user' ? 'bg-muted/20' : 'bg-background')}>
                  <span className={cn('text-[9px] font-bold uppercase tracking-wide shrink-0 mt-0.5', entry.role === 'user' ? 'text-primary' : 'text-muted-foreground')}>
                    {entry.role === 'user' ? 'You' : 'Agent'}
                  </span>
                  <span className="text-xs flex-1">{entry.text}</span>
                  {entry.action && (
                    entry.success
                      ? <Icon icon="tick-circle" size={14} className="text-emerald-500 shrink-0" />
                      : <Icon icon="warning-sign" size={14} className="text-red-500 shrink-0" />
                  )}
                </div>
              ))}
            </Card>
          </div>
        )}

        {lastAction && session === 'active' && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Icon icon="tick-circle" size={14} className="text-emerald-500" />
            {lastAction}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="border-t px-6 py-4 shrink-0 bg-background">
        <div className="flex items-center gap-3">
          {session === 'idle' || session === 'error' ? (
            <Button
              icon="record"
              intent={Intent.PRIMARY}
              disabled={!configured}
              onClick={() => { void connect() }}
            >
              Start voice session
            </Button>
          ) : session === 'connecting' ? (
            <Button disabled loading>
              Connecting…
            </Button>
          ) : (
            <Button
              icon="record"
              intent={Intent.DANGER}
              onClick={disconnect}
              className="animate-pulse"
            >
              End session
            </Button>
          )}
          {session === 'active' && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
              <Icon icon="volume-up" size={14} />
              Listening…
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          All voice actions route through the action registry · edges written to graph · fully auditable
        </p>
      </div>
    </div>
  )
}
