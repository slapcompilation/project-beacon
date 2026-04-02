// Layer: Floor — Minimal layout for scan-first UI (floor staff / limited access)
// Includes OfflineBanner so the offline queue is never invisible on the scan surface.
// Includes error recovery (retry/discard) so floor staff are never silently stuck.

import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { OfflineBanner } from '@/components/OfflineBanner'
import { ServiceWorkerUpdatePrompt } from '@/components/ServiceWorkerUpdatePrompt'
import { services } from '@/lib/services'
import { useSyncQueue } from '@/hooks/useSyncQueue'

export function ScanLayout() {
  const navigate = useNavigate()
  const { isOnline, isSyncing, pendingCount, syncError, retrySync, clearQueue } = useSyncQueue()

  const handleSignOut = async () => {
    try {
      await services.auth.signOut()
      void navigate('/login', { replace: true })
    } catch {
      toast.error('Failed to sign out')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-lg font-bold tracking-tight">Beacon</span>
        <Button variant="ghost" size="sm" onClick={() => { void handleSignOut() }}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </header>
      <OfflineBanner
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        syncError={syncError}
        onRetry={retrySync}
        onDiscardAll={clearQueue}
      />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <ServiceWorkerUpdatePrompt />
    </div>
  )
}
