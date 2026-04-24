import { Outlet } from 'react-router-dom'
import { Topbar } from './Topbar'
import { CommandDock } from './CommandDock'
import { ContextPanel } from './ContextPanel'
import { OfflineBanner } from '@/components/OfflineBanner'
import { CommandBar } from '@/components/CommandBar'
import { NotificationsPanel } from '@/components/NotificationsPanel'
import { ServiceWorkerUpdatePrompt } from '@/components/ServiceWorkerUpdatePrompt'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { useKeyboardNav } from '@/hooks/useKeyboardNav'
import { useEyeLayerPrefetch } from '@/hooks/useEyeLayerPrefetch'
import { useSilentAutoAlerts } from '@/features/notifications/hooks'

export function AppLayout() {
  useRealtimeSync()
  useKeyboardNav()
  useEyeLayerPrefetch()
  useSilentAutoAlerts()
  const { isOnline, isSyncing, pendingCount, syncError, retrySync, clearQueue } = useSyncQueue()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <OfflineBanner
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        syncError={syncError}
        onRetry={retrySync}
        onDiscardAll={clearQueue}
      />
      <Topbar />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-12">
          <PanelErrorBoundary name="Page" className="h-full">
            <div className="page-fade h-full">
              <Outlet />
            </div>
          </PanelErrorBoundary>
        </main>
        <ContextPanel />
      </div>

      <CommandDock />
      <CommandBar />
      <NotificationsPanel />
      <ServiceWorkerUpdatePrompt />
    </div>
  )
}
