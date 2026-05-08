// Layer: Eye — Copilot conversation API
//
// Phase B1 client wiring for the persisted copilot conversations introduced in
// migration 122. Every fallible call returns its data raw or throws a string
// error message; consumer hooks normalise to TanStack Query semantics. This
// matches the rest of the codebase pre-PR-#1 (BeaconResult migration is a
// separate follow-up).

import { supabase } from '@/lib/supabase/client'

// ─── Row shapes (mirror migration 122 columns) ──────────────────────────────

export interface CopilotConversationRow {
  id:               string
  hotel_id:         string
  user_id:          string
  title:            string | null
  agent_scope:      'hotel' | 'organization'
  started_at:       string
  last_message_at:  string
  message_count:    number
  archived_at:      string | null
}

export interface CopilotMessageRow {
  id:              string
  conversation_id: string
  role:            'user' | 'assistant' | 'system'
  content:         string
  tool_trace:      ToolTraceEntry[]
  iterations:      number
  model:           string | null
  action_proposal: Record<string, unknown> | null
  created_at:      string
}

export interface ToolTraceEntry {
  tool:        string
  input:       Record<string, unknown>
  duration_ms: number
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function fetchConversations(
  limit = 25,
): Promise<CopilotConversationRow[]> {
  const { data, error } = await supabase
    .from('copilot_conversations')
    .select('*')
    .is('archived_at', null)
    .order('last_message_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as CopilotConversationRow[]
}

export async function fetchMessages(
  conversationId: string,
): Promise<CopilotMessageRow[]> {
  const { data, error } = await supabase
    .from('copilot_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as CopilotMessageRow[]
}

// ─── Send (calls the copilot-chat edge function) ────────────────────────────

export interface SendMessageInput {
  /** Plain text from the operator. */
  content:        string
  /** Continue an existing conversation; omit to start a new one. */
  conversationId?: string | null
}

export interface SendMessageResponse {
  response:        string
  tool_trace:      ToolTraceEntry[]
  model:           string
  iterations:      number
  conversation_id: string
}

export async function sendCopilotMessage(
  input: SendMessageInput,
): Promise<SendMessageResponse> {
  const { data, error } = await supabase.functions.invoke<SendMessageResponse>(
    'copilot-chat',
    {
      body: {
        conversation_id: input.conversationId ?? undefined,
        messages:        [{ role: 'user', content: input.content }],
      },
    },
  )
  if (error) throw new Error(error.message)
  if (!data)  throw new Error('copilot-chat returned no data')
  return data
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function archiveConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('copilot_conversations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('copilot_conversations')
    .update({ title })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
