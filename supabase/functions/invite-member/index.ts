import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    // Verify caller identity via their JWT
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const callerRole = user.app_metadata?.role as string | undefined
    const hotelId = user.app_metadata?.hotel_id as string | undefined

    if (!hotelId || !['owner', 'admin'].includes(callerRole ?? '')) {
      return json({ error: 'Insufficient permissions' }, 403)
    }

    const { email, role } = await req.json() as { email?: string; role?: string }

    if (!email || !role) return json({ error: 'email and role are required' }, 400)
    if (!['admin', 'team_member', 'limited_access'].includes(role)) {
      return json({ error: 'Invalid role' }, 400)
    }

    // Use service role to send invite email
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { hotel_id: hotelId, role },
      })

    if (inviteError) return json({ error: inviteError.message }, 400)

    // Set app_metadata immediately so the JWT is correct on first sign-in
    await adminClient.auth.admin.updateUserById(inviteData.user.id, {
      app_metadata: { hotel_id: hotelId, role },
    })

    return json({ success: true, userId: inviteData.user.id }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
