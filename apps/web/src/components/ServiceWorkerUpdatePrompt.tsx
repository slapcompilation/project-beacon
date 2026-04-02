// Layer: meta — notifies the operator when a new app version is ready.
// Workbox detects the waiting service worker; operator taps Update to reload
// into the new version without losing the current page's unsaved state warning.
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function ServiceWorkerUpdatePrompt() {
  const [dismissed, setDismissed] = useState(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, _reg) {
      // Workbox handles periodic checks automatically — no polling needed here
    },
  })

  if (!needRefresh || dismissed) return null

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border bg-slate-900 px-4 py-3 shadow-xl text-white">
      <RefreshCw className="h-4 w-4 flex-shrink-0 text-blue-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Update available</p>
        <p className="text-xs text-slate-400">Reload to get the latest version of Beacon.</p>
      </div>
      <Button
        size="sm"
        className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs flex-shrink-0"
        onClick={() => { void updateServiceWorker(true) }}
      >
        Update
      </Button>
      <button
        onClick={() => { setDismissed(true) }}
        className="flex-shrink-0 rounded p-1 text-slate-500 hover:text-slate-300"
        aria-label="Dismiss update prompt"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
