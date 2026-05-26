// HTTP plumbing shared by every edge function: CORS headers, JSON helper,
// preflight handler. Keep this dependency-free so any function can import it.

export const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-beacon-secret',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Returns a 200 OK to OPTIONS preflight when applicable; otherwise null
 *  so the handler can continue. */
export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return null
}
