import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local'
  )
}

// In-memory lock keyed by name. Replaces navigator.locks (Web Locks API),
// which can orphan a lock when a tab/process dies before releasing it —
// causing every other tab to hang on `acquireLock` indefinitely. An in-memory
// queue is per-tab, so if the tab dies its locks die with it.
const memoryLocks = new Map<string, Promise<unknown>>()

async function inMemoryLock<R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const previous = memoryLocks.get(name) ?? Promise.resolve()
  const next = previous.then(fn, fn)
  memoryLocks.set(name, next.catch(() => {}))
  try {
    return await next
  } finally {
    if (memoryLocks.get(name) === next.catch(() => {})) {
      memoryLocks.delete(name)
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: inMemoryLock,
  },
})
