import { Outlet } from 'react-router-dom'
import { GlobalNav } from '@/features/foundryShell/GlobalNav'
import { ContextPanel } from './ContextPanel'
import { CommandBar } from '@/components/CommandBar'
import { NotificationsPanel } from '@/components/NotificationsPanel'
import { ServiceWorkerUpdatePrompt } from '@/components/ServiceWorkerUpdatePrompt'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { useKeyboardNav } from '@/hooks/useKeyboardNav'
import { useSilentAutoAlerts } from '@/features/notifications/hooks'

export function AppLayout() {
  useKeyboardNav()
  useSilentAutoAlerts()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">

      <div className="flex flex-1 overflow-hidden">
        <GlobalNav />
        <main className="flex-1 overflow-y-auto">
          <PanelErrorBoundary name="Page" className="h-full">
            <div className="page-fade h-full">
              <Outlet />
            </div>
          </PanelErrorBoundary>
        </main>
        <ContextPanel />
      </div>

      <CommandBar />
      <NotificationsPanel />
      <ServiceWorkerUpdatePrompt />
    </div>
  )
}
