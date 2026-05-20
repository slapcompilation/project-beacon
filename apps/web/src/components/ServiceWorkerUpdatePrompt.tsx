// Prompts to reload after Workbox detects a waiting service worker.

import { useRegisterSW } from 'virtual:pwa-register/react'
import { useState } from 'react'
import { Button, Icon } from '@blueprintjs/core'

export function ServiceWorkerUpdatePrompt() {
  const [dismissed, setDismissed] = useState(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW() {
      // Workbox polls automatically.
    },
  })

  if (!needRefresh || dismissed) return null

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border bg-slate-900 px-4 py-3 shadow-xl text-white">
      <Icon icon="refresh" size={14} className="flex-shrink-0 text-blue-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Update available</p>
        <p className="text-xs text-slate-400">Reload to get the latest version of Beacon.</p>
      </div>
      <Button
        size="small"
        onClick={() => { void updateServiceWorker(true) }}
        className="!h-7 !bg-blue-600 hover:!bg-blue-700 !text-white !text-xs flex-shrink-0"
      >
        Update
      </Button>
      <Button
        variant="minimal"
        size="small"
        icon="cross"
        onClick={() => { setDismissed(true) }}
        className="!text-slate-500 hover:!text-slate-300"
        aria-label="Dismiss update prompt"
      />
    </div>
  )
}
