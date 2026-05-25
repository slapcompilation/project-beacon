// Multi-turn LLM chat with tool-call trace display.

import { useState, useRef, useEffect } from 'react'
import { Button, Icon, InputGroup, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useCopilotChat } from '@/features/eye/hooks'
import type { ChatMessage } from '@/features/eye/hooks'
import { CopilotProposalCard } from './CopilotProposalCard'

const CHAT_PRESETS = [
  { label: "What needs my attention?",           query: "What needs my attention right now?" },
  { label: "Restock urgency",                    query: "Which items are running low and need ordering?" },
  { label: "Waste overview",                     query: "Are there any waste anomalies or unusual write-offs?" },
  { label: "Compare last week to this week",     query: "How does this week compare to last week?" },
  { label: "Which supplier should I watch?",     query: "Which suppliers have reliability issues right now?" },
]

function ChatBubble({ message }: { message: ChatMessage }) {
  const [traceOpen, setTraceOpen] = useState(false)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <div className="h-7 w-7 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0 mt-0.5">
        <Icon icon="lightbulb" size={14} className="text-violet-600 dark:text-violet-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:mb-2 [&_ul]:mb-2 [&_li]:mb-0.5 whitespace-pre-wrap">
          {message.content}
        </div>

        {message.tool_trace && message.tool_trace.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => { setTraceOpen(!traceOpen) }}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon icon="git-branch" size={12} />
              {String(message.tool_trace.length)} tool{message.tool_trace.length !== 1 ? 's' : ''} called
              <span className="text-muted-foreground/60">
                ({String(message.tool_trace.reduce((s, t) => s + t.duration_ms, 0))}ms)
              </span>
              <Icon icon="chevron-right" size={12} className={cn('transition-transform', traceOpen && 'rotate-90')} />
            </button>
            {traceOpen && (
              <div className="mt-1.5 space-y-1.5 pl-4 border-l border-border/50">
                {message.tool_trace.map((t, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Icon icon="tick-circle" size={12} className="text-green-500 shrink-0" />
                      <span className="font-mono">{t.tool}</span>
                      <span className="text-muted-foreground/60">{String(t.duration_ms)}ms</span>
                    </div>
                    {Object.keys(t.input).length > 0 && (
                      <pre className="ml-4 text-[10px] font-mono text-muted-foreground/80 whitespace-pre-wrap break-all">{summarizeInput(t.input)}</pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {message.action_proposals && message.action_proposals.length > 0 && (
          <div className="space-y-2">
            {message.action_proposals.map((p, i) => (
              <CopilotProposalCard key={i} proposal={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function summarizeInput(input: Record<string, unknown>): string {
  // One-line preview; truncate long blob values so the chat doesn't get noisy.
  const entries = Object.entries(input).map(([k, v]) => {
    let s: string
    if (v == null) s = 'null'
    else if (typeof v === 'string') s = v.length > 40 ? `"${v.slice(0, 40)}…"` : `"${v}"`
    else if (typeof v === 'number' || typeof v === 'boolean') s = String(v)
    else s = JSON.stringify(v)
    if (s.length > 60) s = `${s.slice(0, 60)}…`
    return `${k}: ${s}`
  })
  return entries.join(', ')
}

interface CopilotChatViewProps {
  compact?: boolean
}

export function CopilotChatView({ compact }: CopilotChatViewProps) {
  const { messages, isLoading, error, send, clear } = useCopilotChat()
  const [chatInput, setChatInput] = useState('')
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = () => {
    const q = chatInput.trim()
    if (!q || isLoading) return
    setChatInput('')
    void send(q)
  }

  return (
    <div className="flex flex-col h-full">
      <div className={cn('flex-1 overflow-y-auto py-5 space-y-4', compact ? 'px-3' : 'px-6')}>
        {messages.length === 0 && !isLoading && (
          <div className="space-y-5">
            <div className={cn('text-center', compact ? 'py-4' : 'py-8')}>
              <Icon icon="chat" size={compact ? 24 : 32} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Conversational Copilot</p>
              <p className="text-xs text-muted-foreground/70">
                Ask anything about your hotel operations.
              </p>
            </div>
            <div className={cn('flex flex-wrap gap-2 justify-center', compact && 'gap-1.5')}>
              {CHAT_PRESETS.map(({ label, query }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { void send(query) }}
                  className={cn(
                    'rounded-full border border-border bg-card hover:bg-muted/40 hover:border-foreground/20 transition-colors text-muted-foreground hover:text-foreground',
                    compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0 mt-0.5">
              <Icon icon="lightbulb" size={14} className="text-violet-600 dark:text-violet-400 animate-pulse" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1.5">
              <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
              Querying graph and reasoning...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      <div className={cn('border-t shrink-0 py-3 bg-background', compact ? 'px-3' : 'px-6 py-4')}>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              icon="undo"
              onClick={clear}
              title="New conversation"
              aria-label="New conversation"
            />
          )}
          <div className="flex-1">
            <InputGroup
              value={chatInput}
              onChange={(e) => { setChatInput(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
              placeholder={isLoading ? 'Thinking...' : 'Ask anything...'}
              disabled={isLoading}
              fill
            />
          </div>
          <Button
            intent={Intent.PRIMARY}
            icon={isLoading ? undefined : 'send-message'}
            loading={isLoading}
            disabled={!chatInput.trim() || isLoading}
            onClick={handleSend}
            aria-label="Send"
          />
        </div>
        {!compact && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            LLM-powered · tool-calling on live data · multi-turn conversation · action proposals
          </p>
        )}
      </div>
    </div>
  )
}
