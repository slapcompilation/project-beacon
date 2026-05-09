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
  /** Structured action proposals parsed from the assistant text. Null when
   *  the assistant didn't suggest any mutation. UIs render Confirm / Edit /
   *  Cancel cards from these. NEVER auto-executed. */
  action_proposal: ActionProposal[] | null
  created_at:      string
}

export interface ToolTraceEntry {
  tool:        string
  input:       Record<string, unknown>
  duration_ms: number
}

/** Mirrors the shape emitted by the propose_* tools and the ```action fenced
 *  blocks the assistant writes per the system prompt. */
export interface ActionProposal {
  type:    'action_proposal'
  /** BeaconAction['type'] — e.g. 'REQUEST_RESTOCK', 'WRITE_OFF', 'BATCH_APPROVE'. */
  action:  string
  params:  Record<string, unknown>
  message?: string
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
  response:         string
  tool_trace:       ToolTraceEntry[]
  model:            string
  iterations:       number
  conversation_id:  string
  /** Always present (empty array when no proposals). The same payload is
   *  persisted on the assistant message row, so this is purely a convenience
   *  for the immediate response — the persisted row is the source of truth. */
  action_proposals: ActionProposal[]
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

// ─── Streaming send ──────────────────────────────────────────────────────────
//
// Same wire contract as `sendCopilotMessage` but consumes the edge function's
// SSE branch (Accept: text/event-stream). The async generator yields one
// event per `data:` line; consumers `for await (const event of ...)` and
// branch on `event.type`. Consumers MUST NOT throw inside the loop — return
// instead, or wrap in try/finally — leaking iterators leaves the underlying
// fetch open until GC.

export type CopilotStreamEvent =
  | { type: 'conversation_id'; conversation_id: string }
  | { type: 'text_delta';      delta: string }
  | { type: 'tool_call';       name: string; input: Record<string, unknown>; iteration: number }
  | { type: 'tool_result';     name: string; duration_ms: number; iteration: number }
  | {
      type:             'done'
      tool_trace:       ToolTraceEntry[]
      iterations:       number
      model:            string
      conversation_id:  string
      action_proposals: ActionProposal[]
    }
  | { type: 'error'; message: string }

export async function* streamCopilotMessage(
  input: SendMessageInput,
): AsyncGenerator<CopilotStreamEvent, void, void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL not set')

  const res = await fetch(`${supabaseUrl}/functions/v1/copilot-chat`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'text/event-stream',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      conversation_id: input.conversationId ?? undefined,
      messages:        [{ role: 'user', content: input.content }],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `copilot-chat returned HTTP ${String(res.status)}`)
  }
  if (!res.body) throw new Error('copilot-chat returned no body')

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE frames are separated by blank lines; events look like `data: {...}\n\n`.
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data: '))
        if (!line) continue
        const json = line.slice(6).trim()
        if (!json) continue
        try {
          yield JSON.parse(json) as CopilotStreamEvent
        } catch {
          // Malformed event — skip it. The next frame may parse fine.
        }
      }
    }
  } finally {
    // Release the lock so the network connection can finalize cleanly,
    // even if the consumer breaks out of the loop early.
    reader.releaseLock()
  }
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
