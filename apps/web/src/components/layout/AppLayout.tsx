import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PlatformSidebar } from '@/features/platformShell/PlatformSidebar'
import { titleForPath } from '@/features/platformShell/apps'
import { ServiceWorkerUpdatePrompt } from '@/components/ServiceWorkerUpdatePrompt'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { useAppStore } from '@/stores/app.store'

export function AppLayout() {
  const { pathname } = useLocation()
  const pushRecent = useAppStore((s) => s.pushRecent)

  // Recent is client-side: nothing on the server records a visit yet.
  useEffect(() => {
    if (titleForPath(pathname)) pushRecent(pathname)
  }, [pathname, pushRecent])

  return (
    <div className="platform-shell">
      <PlatformSidebar />
      <main className="platform-main">
        <PanelErrorBoundary name="Page" className="h-full">
          <div className="page-fade h-full">
            <Outlet />
          </div>
        </PanelErrorBoundary>
      </main>
      <ServiceWorkerUpdatePrompt />
    </div>
  )
}
