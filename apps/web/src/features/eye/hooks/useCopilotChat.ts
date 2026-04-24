// Layer: Eye — Multi-turn copilot chat hook with tool-calling trace
// Imperative hook (not TanStack Query — user-triggered conversations, not background fetches).

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tool_trace?: ToolTraceEntry[]
  timestamp: string
}

export interface ToolTraceEntry {
  tool: string
  input: Record<string, unknown>
  duration_ms: number
}

export interface ActionProposal {
  type: 'action_proposal'
  action: string
  params: Record<string, unknown>
  message: string
  requests?: unknown[]
}

export function useCopilotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idCounter = useRef(0)

  const nextId = () => {
    idCounter.current += 1
    return `msg-${String(Date.now())}-${String(idCounter.current)}`
  }

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return null

    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      // Send full conversation history for multi-turn
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await supabase.functions.invoke('copilot-chat', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { messages: history },
      }) as {
        data: {
          response: string
          tool_trace: ToolTraceEntry[]
          iterations: number
          error?: string
        } | null
        error: { message: string } | null
      }

      if (res.error) throw new Error(res.error.message)
      if (!res.data) throw new Error('No response from copilot')
      if (res.data.error) throw new Error(res.data.error)

      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: res.data.response,
        tool_trace: res.data.tool_trace,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMsg])
      return assistantMsg
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Copilot request failed'
      setError(msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  const clear = useCallback(() => {
    setMessages([])
    setError(null)
    idCounter.current = 0
  }, [])

  return { messages, isLoading, error, send, clear }
}
