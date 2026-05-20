// "Add to home screen" banner. 7-day cooldown after dismiss.

import { useEffect, useState } from 'react'
import { Button, Icon, Intent } from '@blueprintjs/core'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-prompt-dismissed-until'
const COOLDOWN_MS   = 7 * 24 * 60 * 60 * 1000

function isPromptSuppressed(): boolean {
  const until = localStorage.getItem(DISMISSED_KEY)
  return until != null && Date.now() < Number(until)
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(isPromptSuppressed)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => { window.removeEventListener('beforeinstallprompt', handler) }
  }, [])

  if (!deferredPrompt || dismissed) return null

  const handleInstall = async () => {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + COOLDOWN_MS))
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border bg-background px-4 py-3 shadow-lg">
      <Icon icon="download" size={20} intent={Intent.PRIMARY} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Install Beacon</p>
        <p className="text-xs text-muted-foreground">Add to home screen for quick access</p>
      </div>
      <Button size="small" intent={Intent.PRIMARY} onClick={() => { void handleInstall() }}>
        Install
      </Button>
      <Button
        variant="minimal"
        size="small"
        icon="cross"
        onClick={handleDismiss}
        aria-label="Dismiss"
      />
    </div>
  )
}
