// Two auth patterns every edge function uses today:
//
// 1. verifyAuth(req): for user-invoked functions. Reads the Authorization
//    header, builds a supabase client BOUND TO THAT USER'S JWT (anon-key +
//    auth header), and verifies the JWT resolves to a real user. Every
//    subsequent .from(...) call is RLS-scoped to that user.
//
//    Use for: copilot-chat, entity-extract, document-ingest, embed-text,
//    agent-llm, parse-invoice, parse-shelf-photo, smart-import, ai-brief,
//    compute-similar-variants, fire-webhooks, eval-record, invite-member.
//
// 2. verifySharedSecret(req): for inbound webhooks. Checks an
//    x-beacon-secret header against WEBHOOK_SIGNING_SECRET env. Returns
//    a SERVICE_ROLE client because there's no end-user JWT.
//
//    Use for: ingest-pos, ingest-occupancy, square-webhook, mews-webhook.
//
// Wrong pattern picks were the failure mode the Phase-19 audit flagged:
// nothing crashes; reads succeed under RLS but writes silently 404.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json } from './http.ts'

interface UserScopedAuth {
  user:     { id: string; email?: string | null }
  supabase: SupabaseClient
}

/** User-bound supabase client. Throws via the returned Response on missing
 *  or invalid JWT — handler should `return` the Response immediately. */
export async function verifyAuth(req: Request): Promise<UserScopedAuth | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized: missing Authorization header' }, 401)

  const url     = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return json({ error: 'Server misconfiguration' }, 500)

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return json({ error: 'Unauthorized: invalid token' }, 401)

  return { user: { id: user.id, email: user.email }, supabase }
}

interface ServiceAuth {
  supabase: SupabaseClient
}

/** Webhook auth via x-beacon-secret header. Returns a service-role client
 *  because webhooks aren't user-bound. */
export function verifySharedSecret(req: Request): ServiceAuth | Response {
  const signingSecret = Deno.env.get('WEBHOOK_SIGNING_SECRET')
  if (!signingSecret) return json({ error: 'Server misconfiguration' }, 500)

  if (req.headers.get('x-beacon-secret') !== signingSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const url        = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Server misconfiguration' }, 500)

  return { supabase: createClient(url, serviceKey) }
}

/** True when verifyAuth/verifySharedSecret returned an error Response. */
export function isAuthError(v: unknown): v is Response {
  return v instanceof Response
}
