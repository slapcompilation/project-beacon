import { createClient, processLock } from '@supabase/supabase-js'
import { getActivePurposeHeader } from './purposeHeader'

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
  // Inject the active access purpose on every request so RLS can narrow reads
  // by it (purpose-based controls). Only NARROWS — the role clearance still caps.
  global: {
    fetch: (input, init) => {
      const purpose = getActivePurposeHeader()
      if (!purpose) return fetch(input, init)
      const headers = new Headers(init?.headers)
      headers.set('x-beacon-purpose', purpose)
      return fetch(input, { ...init, headers })
    },
  },
})
