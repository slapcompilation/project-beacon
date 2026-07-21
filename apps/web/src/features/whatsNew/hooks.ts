// What's New unseen-tracking. Last-seen is per browser (localStorage) — release
// notes are global, so there's no server state to keep. The sidebar dot lights
// when the newest entry is newer than what this user has seen.

import { useCallback, useSyncExternalStore } from 'react'
import { CHANGELOG } from './changelog'

const KEY = 'beacon.whatsNew.lastSeen'
const newest = CHANGELOG[0]?.date ?? ''

function read(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

// useSyncExternalStore needs a stable subscribe; last-seen only changes via
// markSeen in this tab, so a storage-event listener covers other tabs.
function subscribe(cb: () => void): () => void {
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener('storage', cb) }
}

export function useWhatsNew() {
  const lastSeen = useSyncExternalStore(subscribe, read, () => '')
  const hasUnseen = newest !== '' && newest > lastSeen

  const markSeen = useCallback(() => {
    try { localStorage.setItem(KEY, newest) } catch { /* private mode — dot just stays */ }
    // localStorage writes don't fire storage events in the same tab; nudge subscribers.
    window.dispatchEvent(new Event('storage'))
  }, [])

  return { entries: CHANGELOG, hasUnseen, markSeen }
}
