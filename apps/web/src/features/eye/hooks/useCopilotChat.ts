// Layer: Eye — Multi-turn copilot chat hook with tool-calling trace
// Imperative hook (not TanStack Query — user-triggered conversations, not background fetches).

import { useState, useCallback, useRef } from 'react'
import type { ConstraintViolation } from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'
import { useApprovedAnswers, recordApprovedAnswerHit } from '@/features/approvedAnswers/hooks'
import { matchApprovedAnswers } from '@/features/approvedAnswers/api'
import { bestMatch } from '@/features/approvedAnswers/similarity'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useCurrentSelection } from '@/features/copilot/hooks'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tool_trace?: ToolTraceEntry[]
  action_proposals?: ActionProposal[]
  /** When set, the assistant message came from the ApprovedAnswers tier-1
   *  cache instead of a fresh LLM call. */
  served_from_cache?: { approvedAnswerId: string; similarity: number; question: string }
  /** Source user question — used by the Curate button to save the pair. */
  source_question?: string
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
  /** Suggest-time constraint check from the edge fn (#7). Hard → blocked. */
  violations?: ConstraintViolation[]
}

export function useCopilotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idCounter = useRef(0)
  const { data: approvedAnswers = [] } = useApprovedAnswers()
  const hotelId = useActiveHotelId()
  const selection = useCurrentSelection()

  const nextId = () => {
    idCounter.current += 1
    return `msg-${String(Date.now())}-${String(idCounter.current)}`
  }

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return null
    const trimmed = text.trim()

    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    // Tier-1 lookup: try semantic match via pgvector first (Phase 14.b);
    // fall back to client-side Jaccard if the embedding pipeline is down or
    // the OPENAI_API_KEY isn't set. On hit we skip the LLM entirely.
    let semanticHit: { id: string; question: string; answer: string; similarity: number } | null = null
    if (hotelId) {
      try {
        const matches = await matchApprovedAnswers({ hotelId, query: trimmed, threshold: 0.78, limit: 1 })
        if (matches.length > 0 && matches[0]) {
          semanticHit = matches[0]
        }
      } catch {
        // embed-text down — fall through to Jaccard
      }
    }

    const hit = semanticHit
      ? { item: { id: semanticHit.id, question: semanticHit.question, answer: semanticHit.answer }, score: semanticHit.similarity }
      : bestMatch(trimmed, approvedAnswers, (a) => a.question, 0.6)
    if (hit) {
      const cachedMsg: ChatMessage = {
        id:        nextId(),
        role:      'assistant',
        content:   hit.item.answer,
        timestamp: new Date().toISOString(),
        served_from_cache: {
          approvedAnswerId: hit.item.id,
          similarity:       Number(hit.score.toFixed(2)),
          question:         hit.item.question,
        },
        source_question: trimmed,
      }
      setMessages((prev) => [...prev, cachedMsg])
      setIsLoading(false)
      void recordApprovedAnswerHit(hit.item.id).catch(() => { /* fire-and-forget */ })
      return cachedMsg
    }

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
        body: { messages: history, selection: selection ?? undefined },
      }) as {
        data: {
          response: string
          tool_trace: ToolTraceEntry[]
          iterations: number
          action_proposals?: ActionProposal[]
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
        action_proposals: res.data.action_proposals ?? [],
        source_question: trimmed,
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
  }, [messages, approvedAnswers, hotelId, selection])

  const clear = useCallback(() => {
    setMessages([])
    setError(null)
    idCounter.current = 0
  }, [])

  return { messages, isLoading, error, send, clear }
}
