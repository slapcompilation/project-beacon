// Route-level dynamic imports that survive a deploy mid-session.
//
// When a new build ships, Vite emits new content-hashed chunk filenames and the
// old ones stop existing. A tab still running the previous index.html then throws
// "Failed to fetch dynamically imported module" the first time it lazy-loads a
// route whose chunk hash changed. The fix is the standard one: on a failed import
// reload once to pull the fresh index.html + chunk map; only surface the error if
// a reload didn't help (so a genuinely broken chunk can't loop forever).

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOAD_KEY = 'beacon:chunk-reload'

export function lazyWithRetry<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await importer()
      sessionStorage.removeItem(RELOAD_KEY)  // loaded fine → arm the next reload
      return mod
    } catch (err) {
      if (sessionStorage.getItem(RELOAD_KEY) !== '1') {
        sessionStorage.setItem(RELOAD_KEY, '1')
        window.location.reload()
        // Hold the Suspense fallback until the reload swaps the document.
        return new Promise<{ default: T }>(() => { /* never resolves */ })
      }
      throw err  // already reloaded once on a fresh build — a real failure.
    }
  })
}
