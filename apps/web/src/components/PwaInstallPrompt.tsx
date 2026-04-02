import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-prompt-dismissed-until'
const COOLDOWN_MS   = 7 * 24 * 60 * 60 * 1000   // 7 days

function isPromptSuppressed(): boolean {
  const until = localStorage.getItem(DISMISSED_KEY)
  return until != null && Date.now() < Number(until)
}

/**
 * Shows an "Add to home screen" banner when the browser fires beforeinstallprompt.
 * Dismissed state is stored in localStorage with a 7-day cooldown so repeat
 * sessions on the same device don't keep nagging the operator.
 */
export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(isPromptSuppressed)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => { window.removeEventListener('beforeinstallprompt', handler); }
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
      <Download className="h-5 w-5 flex-shrink-0 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Install Beacon</p>
        <p className="text-xs text-muted-foreground">Add to home screen for quick access</p>
      </div>
      <Button size="sm" onClick={() => { void handleInstall() }}>
        Install
      </Button>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
