// Layer: Eye — Copilot conversation hooks
//
// TanStack Query wiring for the persisted copilot. The chat UI consumes
// these hooks; the keyword-router-based EyeCopilotPage continues to work
// unchanged until the UI revamp PR.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import {
  archiveConversation,
  fetchConversations,
  fetchMessages,
  renameConversation,
  sendCopilotMessage,
  type SendMessageInput,
  type SendMessageResponse,
} from '../api'

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

  return useMutation<SendMessageResponse, Error, SendMessageInput>({
    mutationFn: (input) => sendCopilotMessage(input),
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

// Re-export types for convenience at call sites
export type {
  ActionProposal,
  CopilotConversationRow,
  CopilotMessageRow,
  SendMessageResponse,
  ToolTraceEntry,
} from '../api'
