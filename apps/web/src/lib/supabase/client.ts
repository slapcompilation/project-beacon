import { createClient, processLock } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local'
  )
}

// Use Supabase's official `processLock` (per-tab, in-memory, timeout-aware)
// instead of the default `navigator.locks` lock — Web Locks can orphan when a
// tab or process dies before releasing, causing every other tab to hang on
// `acquireLock` indefinitely. processLock dies with its tab.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: processLock,
  },
})
