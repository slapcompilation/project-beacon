// Layer: Eye — Copilot conversation hooks
//
// TanStack Query wiring for the persisted copilot. Consumed by the
// CopilotChatView slide-over (rendered in ContextPanel).

import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'
import {
  archiveConversation,
  fetchConversations,
  fetchMessages,
  renameConversation,
  sendCopilotMessage,
  streamCopilotMessage,
  type ActionProposal,
  type CopilotStreamEvent,
  type SelectionContext,
  type SendMessageInput,
  type SendMessageResponse,
  type ToolTraceEntry,
} from '../api'

// ─── Selection-aware copilot (Phase D) ───────────────────────────────────────
// Derives "what is the operator currently looking at" from the route (primary)
// and the context-panel's open entity (fallback). The copilot's send hooks
// auto-attach this to every message so the edge fn can inject it into the
// system prompt and bias tool defaults / action proposals toward it.

const ROUTE_SELECTIONS: ReadonlyArray<{ kind: string; re: RegExp; idGroup?: number; constantId?: string }> = [
  { kind: 'variant',         re: /^\/variant\/([^/?#]+)/ },
  { kind: 'product',         re: /^\/product\/([^/?#]+)/ },
  { kind: 'supplier',        re: /^\/supplier\/([^/?#]+)/ },
  { kind: 'restock_request', re: /^\/restock\/([^/?#]+)/ },
  { kind: 'purchase_order',  re: /^\/po\/([^/?#]+)/ },
  { kind: 'alert',           re: /^\/alert\/([^/?#]+)/ },
  { kind: 'principle',       re: /^\/principles\/([^/?#]+)/ },
  { kind: 'constraint',      re: /^\/constraints\/([^/?#]+)/ },
  { kind: 'case',            re: /^\/cases\/([^/?#]+)/ },
  { kind: 'document',        re: /^\/documents\/([^/?#]+)/ },
  { kind: 'action_chain',    re: /^\/action-chains\/([^/?#]+)/ },
  // H4: the scenario sandbox is its own selection kind — the copilot edge fn
  // surfaces the overlay tools (apply_overlay_edit, query_simulation_result)
  // only when the operator is looking at one.
  { kind: 'scenario',        re: /^\/scenarios\/([^/?#]+)/ },
  { kind: 'objective',       re: /^\/modeling-objectives\/([^/?#]+)/ },
  { kind: 'agent',           re: /^\/agents\/([^/?#]+)/ },
  // Phase F1 — Canvas: the briefing page IS the selection. No entity id; the
  // edge fn's system prompt treats this as "the operator is on the Canvas
  // briefing" so tool defaults are chosen accordingly.
  { kind: 'briefing',        re: /^\/briefing\/?$/, constantId: 'current' },
]

export function useCurrentSelection(): SelectionContext | null {
  const { pathname } = useLocation()
  const contextEntity = useAppStore((s) => s.contextEntity)

  for (const pat of ROUTE_SELECTIONS) {
    const m = pat.re.exec(pathname)
    if (m) return { kind: pat.kind, id: pat.constantId ?? m[1] }
  }
  // Fallback: whatever entity the operator has opened in the context panel.
  if (contextEntity) return { kind: contextEntity.type, id: contextEntity.id }
  return null
}

export const copilotKeys = {
  conversations: (userId: string)            => ['copilot', 'conversations', userId] as const,
  messages:      (conversationId: string)    => ['copilot', 'messages',      conversationId] as const,
}

export function useCopilotConversations(limit = 25) {
  const userId = useAuthStore((s) => s.userId)
  return useQuery({
    queryKey:  copilotKeys.conversations(userId ?? ''),
    queryFn:   () => fetchConversations(limit),
    enabled:   !!userId,
    staleTime: 60 * 1000,
  })
}

export function useCopilotMessages(conversationId: string | null) {
  return useQuery({
    queryKey:  copilotKeys.messages(conversationId ?? ''),
    queryFn:   () => fetchMessages(conversationId ?? ''),
    enabled:   !!conversationId,
    staleTime: 30 * 1000,  // realtime invalidation can layer on later
  })
}

/** Sends a user message and returns the assistant's reply. On success it
 *  invalidates the message list (so the UI re-fetches the persisted pair)
 *  and the conversation list (so titles + last_message_at refresh). */
export function useSendCopilotMessage() {
  const queryClient = useQueryClient()
  const userId      = useAuthStore((s) => s.userId)
  const selection   = useCurrentSelection()

  return useMutation<SendMessageResponse, Error, SendMessageInput>({
    mutationFn: (input) => sendCopilotMessage({ selection, ...input }),
    onSuccess: (data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: copilotKeys.messages(vars.conversationId ?? data.conversation_id),
      })
      void queryClient.invalidateQueries({
        queryKey: copilotKeys.conversations(userId ?? ''),
      })
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useArchiveConversation() {
  const queryClient = useQueryClient()
  const userId      = useAuthStore((s) => s.userId)

  return useMutation({
    mutationFn: archiveConversation,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: copilotKeys.conversations(userId ?? ''),
      })
      toast.success('Conversation archived')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRenameConversation() {
  const queryClient = useQueryClient()
  const userId      = useAuthStore((s) => s.userId)

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameConversation(id, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: copilotKeys.conversations(userId ?? ''),
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Streaming hook ──────────────────────────────────────────────────────────
//
// Companion to `useSendCopilotMessage` for surfaces that want progressive
// rendering: `streamingText` accumulates token-by-token, `currentTool` shows
// which tool the agent is calling right now, and the rest fills in on `done`.
// On completion the message + conversation lists are invalidated so the
// persisted rows replace the local in-flight state.

interface StreamingState {
  isStreaming:     boolean
  streamingText:   string
  currentTool:     { name: string; input: Record<string, unknown> } | null
  toolTrace:       ToolTraceEntry[]
  conversationId:  string | null
  actionProposals: ActionProposal[]
  iterations:      number
  error:           Error | null
}

const INITIAL_STATE: StreamingState = {
  isStreaming:     false,
  streamingText:   '',
  currentTool:     null,
  toolTrace:       [],
  conversationId:  null,
  actionProposals: [],
  iterations:      0,
  error:           null,
}

export function useStreamingCopilotMessage() {
  const queryClient = useQueryClient()
  const userId      = useAuthStore((s) => s.userId)
  const selection   = useCurrentSelection()
  const [state, setState] = useState<StreamingState>(INITIAL_STATE)

  const reset = useCallback(() => { setState(INITIAL_STATE) }, [])

  const send = useCallback(async (input: SendMessageInput) => {
    setState({
      ...INITIAL_STATE,
      isStreaming:    true,
      conversationId: input.conversationId ?? null,
    })

    try {
      for await (const event of streamCopilotMessage({ selection, ...input })) {
        applyEvent(event, setState)
        if (event.type === 'done') {
          // Persisted rows are now authoritative — refresh the lists.
          void queryClient.invalidateQueries({
            queryKey: copilotKeys.messages(event.conversation_id),
          })
          void queryClient.invalidateQueries({
            queryKey: copilotKeys.conversations(userId ?? ''),
          })
        }
        if (event.type === 'error') {
          throw new Error(event.message)
        }
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setState((s) => ({ ...s, error: e, isStreaming: false }))
      toast.error(e.message)
      return
    }

    setState((s) => ({ ...s, isStreaming: false }))
  }, [queryClient, userId, selection])

  return { ...state, send, reset, selection }
}

function applyEvent(
  event: CopilotStreamEvent,
  setState: React.Dispatch<React.SetStateAction<StreamingState>>,
) {
  switch (event.type) {
    case 'conversation_id':
      setState((s) => ({ ...s, conversationId: event.conversation_id }))
      return
    case 'text_delta':
      setState((s) => ({ ...s, streamingText: s.streamingText + event.delta }))
      return
    case 'tool_call':
      setState((s) => ({ ...s, currentTool: { name: event.name, input: event.input } }))
      return
    case 'tool_result':
      setState((s) => ({
        ...s,
        currentTool: null,
        toolTrace: [...s.toolTrace, { tool: event.name, input: {}, duration_ms: event.duration_ms }],
      }))
      return
    case 'done':
      setState((s) => ({
        ...s,
        actionProposals: event.action_proposals,
        iterations:      event.iterations,
        toolTrace:       event.tool_trace,         // server-authoritative trace replaces our incremental one
      }))
      return
    case 'error':
      // Handled in the caller via throw — nothing to apply here.
      return
  }
}

// Re-export types for convenience at call sites
export type {
  ActionProposal,
  CopilotConversationRow,
  CopilotMessageRow,
  CopilotStreamEvent,
  SendMessageResponse,
  ToolTraceEntry,
} from '../api'
