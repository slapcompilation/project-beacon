// Layer: Eye — Extracted CopilotChatView for reuse in ContextPanel + full page
// Multi-turn LLM conversation with tool-calling trace display.

import { useState, useRef, useEffect } from 'react'
import {
  Brain, Loader2, Send, RotateCcw, GitBranch,
  ChevronRight, CheckCircle2, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCopilotChat } from '@/features/eye/hooks'
import type { ChatMessage } from '@/features/eye/hooks'

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
        <Brain className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
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
              <GitBranch className="w-3 h-3" />
              {String(message.tool_trace.length)} tool{message.tool_trace.length !== 1 ? 's' : ''} called
              <span className="text-muted-foreground/60">
                ({String(message.tool_trace.reduce((s, t) => s + t.duration_ms, 0))}ms)
              </span>
              <ChevronRight className={cn('w-3 h-3 transition-transform', traceOpen && 'rotate-90')} />
            </button>
            {traceOpen && (
              <div className="mt-1.5 space-y-1 pl-4 border-l border-border/50">
                {message.tool_trace.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                    <span className="font-mono">{t.tool}</span>
                    <span className="text-muted-foreground/60">{String(t.duration_ms)}ms</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface CopilotChatViewProps {
  compact?: boolean
}

export function CopilotChatView({ compact }: CopilotChatViewProps) {
  const { messages, isLoading, error, send, clear } = useCopilotChat()
  const [chatInput, setChatInput] = useState('')
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

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
      {/* Chat body */}
      <div className={cn('flex-1 overflow-y-auto py-5 space-y-4', compact ? 'px-3' : 'px-6')}>
        {messages.length === 0 && !isLoading && (
          <div className="space-y-5">
            <div className={cn('text-center', compact ? 'py-4' : 'py-8')}>
              <MessageSquare className={cn('mx-auto text-muted-foreground/40 mb-3', compact ? 'w-6 h-6' : 'w-8 h-8')} />
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
              <Brain className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 animate-pulse" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
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

      {/* Chat input */}
      <div className={cn('border-t shrink-0 py-3 bg-background', compact ? 'px-3' : 'px-6 py-4')}>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
              title="New conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            onChange={(e) => { setChatInput(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            placeholder={isLoading ? 'Thinking...' : 'Ask anything...'}
            disabled={isLoading}
            className="flex-1 h-9 rounded-lg border border-border bg-card px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!chatInput.trim() || isLoading}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
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
