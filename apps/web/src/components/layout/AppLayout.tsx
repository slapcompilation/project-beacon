import { Outlet } from 'react-router-dom'
import { GlobalNav } from '@/features/foundryShell/GlobalNav'
import { CommandBar } from '@/components/CommandBar'
import { NotificationsPanel } from '@/components/NotificationsPanel'
import { ServiceWorkerUpdatePrompt } from '@/components/ServiceWorkerUpdatePrompt'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { useKeyboardNav } from '@/hooks/useKeyboardNav'

export function AppLayout() {
  useKeyboardNav()

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
      </div>

      <CommandBar />
      <NotificationsPanel />
      <ServiceWorkerUpdatePrompt />
    </div>
  )
}
